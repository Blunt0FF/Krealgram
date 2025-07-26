const Post = require('../models/postModel');
const User = require('../models/userModel'); // Needed to add post to user's posts array
const fs = require('fs'); // For file system operations (deleting images)
const path = require('path'); // For working with paths
const Like = require('../models/likeModel'); // Import the Like model
const { getMediaUrl, getVideoThumbnailUrl } = require('../utils/urlUtils');
const axios = require('axios');
const os = require('os');
const VideoDownloader = require('../services/videoDownloader');
const googleDrive = require('../config/googleDrive');
const UniversalThumbnailGenerator = require('../utils/universalThumbnailGenerator');
const GoogleDriveFileManager = require('../utils/googleDriveFileManager');

console.log('[VIDEO_DOWNLOADER] Using API services + axios for real video downloads');

// @desc    Create a new post
// @route   POST /api/posts
// @access  Private
exports.createPost = async (req, res) => {
  try {
    const { caption, videoUrl, videoData, image, youtubeData: incomingYoutubeData } = req.body;
    
    if (!req.user || !req.user.id) {
      return res.status(401).json({ 
        message: 'Unauthorized: User not authenticated',
        error: 'User ID is missing'
      });
    }

    const authorId = req.user.id;
    let imagePath, mediaType, thumbnailUrl, youtubeData = null;

    // Обработка внешних видео
    if (videoUrl && !req.file) {
      try {
        // Парсим входящие videoData
        const incomingVideoData = typeof videoData === 'string' 
          ? JSON.parse(videoData) 
          : videoData;
        
        // Проверяем, является ли это YouTube видео
        if (incomingVideoData?.platform === 'youtube' || videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be')) {
          const { processYouTubeUrl } = require('../utils/mediaHelper');
          const parsedVideoData = processYouTubeUrl(videoUrl);
          
          youtubeData = {
            videoId: incomingVideoData?.videoId || parsedVideoData.videoId,
            embedUrl: incomingVideoData?.embedUrl || parsedVideoData.embedUrl,
            thumbnailUrl: incomingVideoData?.thumbnailUrl || parsedVideoData.thumbnailUrl,
            platform: 'youtube',
            originalUrl: videoUrl
          };

          imagePath = youtubeData.thumbnailUrl;
          mediaType = 'video';
          thumbnailUrl = youtubeData.thumbnailUrl;
        } else {
          // Для TikTok, Instagram и других платформ (включая загруженные на Google Drive)
          youtubeData = {
            platform: incomingVideoData?.platform || 'external',
            originalUrl: videoUrl,
            videoUrl: incomingVideoData?.videoUrl || videoUrl,
            thumbnailUrl: incomingVideoData?.thumbnailUrl,
            title: incomingVideoData?.title || 'External Video',
            isExternalLink: incomingVideoData?.isExternalLink || false
          };

          imagePath = incomingVideoData?.videoUrl || videoUrl;
          mediaType = 'video';
          thumbnailUrl = incomingVideoData?.thumbnailUrl;
        }
      } catch (error) {
        console.error('Video URL processing error:', error);
        return res.status(400).json({ message: 'Invalid video URL', error: error.message });
      }
    } 
    // Обычная загрузка файла через Google Drive
    else if (req.uploadResult) {
      imagePath = req.uploadResult.secure_url;
      mediaType = req.uploadResult.resource_type;
      
      if (req.uploadResult.thumbnailUrl) {
        thumbnailUrl = req.uploadResult.thumbnailUrl;
      }
    } 
    // Если нет данных вообще
    else {
      if (!caption?.trim()) {
        return res.status(400).json({ message: 'Media content or caption is required for the post.' });
      }
    }

    // Создание поста
    const newPost = new Post({
      author: authorId,
      caption: caption || '',
      image: imagePath,
      mediaType: mediaType || 'image',
      videoUrl: videoUrl,
      youtubeData: youtubeData,
      thumbnailUrl: thumbnailUrl
    });

    const savedPost = await newPost.save();

    // ВАЖНО: Добавляем пост в массив постов пользователя
    await User.findByIdAndUpdate(
      authorId, 
      { $push: { posts: savedPost._id } },
      { new: true }
    );

    // Населяем пост данными автора
    const populatedPost = await Post.findById(savedPost._id)
      .populate('author', 'username avatar');

    // Добавляем размер файла в ответ, если есть uploadResult
    if (req.uploadResult && req.uploadResult.bytes) {
      populatedPost.bytes = req.uploadResult.bytes;
    }

    res.status(201).json(populatedPost);

  } catch (error) {
    console.error('Error creating post:', error);
    
    // Очистка файлов в случае ошибки
    if (req.file && req.file.path) {
      try {
        fs.unlink(req.file.path, (err) => {
          if (err) console.error("Error deleting file on failed post creation:", err);
        });
      } catch (cleanupError) {
        console.error("Error during file cleanup:", cleanupError);
      }
    }
    
    res.status(500).json({ 
      message: 'Server error while creating post.', 
      error: error.message 
    });
  }
};

// @desc    Get all posts (feed)
// @route   GET /api/posts
// @access  Private (assuming the feed is available to authenticated users)
exports.getAllPosts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1; // Current page, default 1
    const limit = parseInt(req.query.limit) || 10; // Number of posts per page, default 10
    const skip = (page - 1) * limit; // Number of documents to skip
    const currentUserId = req.user?.id; // ID of the current user

    const posts = await Post.find()
      .populate('author', 'username avatar email') // Load author data
      .populate({
        path: 'comments',
        populate: {
            path: 'user',
            select: 'username avatar'
        },
        options: { sort: { createdAt: -1 } },
        perDocumentLimit: 3 // Ограничиваем количество комментариев для каждого поста
      })
      .populate('likes', '_id') // Load likes array
      .sort({ createdAt: -1 }) // Sort by creation date (newest first)
      .skip(skip)
      .limit(limit)
      .lean(); // .lean() for performance, if Mongoose methods are not needed

    const totalPosts = await Post.countDocuments(); // Total number of posts for pagination

    // Get true comment counts
    const postIds = posts.map(p => p._id);
    const Comment = require('../models/commentModel');
    const commentCounts = await Comment.aggregate([
      { $match: { post: { $in: postIds } } },
      { $group: { _id: '$post', count: { $sum: 1 } } }
    ]);

    const countsMap = commentCounts.reduce((acc, curr) => {
      acc[curr._id.toString()] = curr.count;
      return acc;
    }, {});

    // Add full URL for images and information about likes
    const postsWithFullInfo = posts.map(post => {
        let imageUrl;
        let thumbnailUrl;
        
        // Логика определения imageUrl (как было раньше)
        if (!post.image && post.youtubeData) {
          imageUrl = null;
        } else if (post.image === '/video-placeholder.svg' || (post.image && post.image.startsWith('/'))) {
          imageUrl = post.image;
        } else if (post.image && post.image.startsWith('http')) {
          imageUrl = post.image;
        } else if (post.image) {
          imageUrl = getMediaUrl(post.image, 'image');
        } else {
          imageUrl = null;
        }
        
        // Приоритет: thumbnailUrl из поста, затем youtubeData, затем генерация
        if (post.thumbnailUrl) {
          thumbnailUrl = post.thumbnailUrl;
        } else if (post.youtubeData && post.youtubeData.thumbnailUrl) {
          thumbnailUrl = post.youtubeData.thumbnailUrl;
        } else if (post.image && post.image.startsWith('/')) {
          // Для статических файлов генерируем thumbnailUrl
          thumbnailUrl = `/uploads/thumb_${post.image.split('/').pop().replace(/\.[^/.]+$/, '.webp')}`;
        }
        
        return {
          ...post,
          imageUrl: imageUrl,
          thumbnailUrl: thumbnailUrl,
          likes: post.likes ? post.likes.map(like => like._id || like) : [],
          likesCount: post.likes ? post.likes.length : 0,
          isLikedByCurrentUser: currentUserId ? post.likes?.some(like => like.toString() === currentUserId.toString()) : false,
          commentsCount: countsMap[post._id.toString()] || (post.comments ? post.comments.length : 0)
        };
    });

    // Return direct array of posts for compatibility with frontend
    res.status(200).json(postsWithFullInfo);

  } catch (error) {
    console.error('Error fetching posts:', error);
    res.status(500).json({ message: 'Server error while fetching posts.', error: error.message });
  }
};

// @desc    Get a single post by ID
// @route   GET /api/posts/:id
// @access  Private (or Public)
exports.getPostById = async (req, res) => {
  try {
    const postId = req.params.id;
    const currentUserId = req.user?.id; // ID of the current user
    
    const post = await Post.findById(postId)
      .populate('author', 'username avatar email') // Author data
      .populate({
        path: 'comments', // Post comments
        populate: {
          path: 'user',
          select: 'username avatar' // Comment author
        },
        options: { sort: { createdAt: -1 } } // Sort comments by date
      })
      .populate('likes', '_id username')
      .lean(); // Use .lean() for performance

    if (!post) {
      return res.status(404).json({ message: 'Post not found.' });
    }

    // Check if the current user has liked the post
    const isLikedByCurrentUser = currentUserId ? 
      post.likes?.some(like => 
        like && like._id && like._id.toString() === currentUserId.toString()
      ) : false;

    // Add full URL for the post image and likes information
    let imageUrl;
    let thumbnailUrl;
    
    // Логика определения imageUrl (как было раньше)
    if (!post.image && post.youtubeData) {
      imageUrl = null; // Не устанавливаем imageUrl, фронтенд будет использовать youtubeData
    }
    // Для видео с внешними URL (TikTok, VK, Instagram) или placeholder
    else if (post.image === '/video-placeholder.svg' || (post.image && post.image.startsWith('/'))) {
      imageUrl = post.image; // Оставляем как есть для статических файлов
    } else if (post.image && post.image.startsWith('http')) {
      imageUrl = post.image; // Уже полный URL (Cloudinary, YouTube thumbnail)
    } else if (post.image) {
      imageUrl = getMediaUrl(post.image, 'image');
    } else {
      imageUrl = null; // Нет изображения
    }
    
    // Приоритет: thumbnailUrl из поста, затем youtubeData, затем генерация
    if (post.thumbnailUrl) {
      thumbnailUrl = post.thumbnailUrl;
    } else if (post.youtubeData && post.youtubeData.thumbnailUrl) {
      thumbnailUrl = post.youtubeData.thumbnailUrl;
    } else if (post.image && post.image.startsWith('/')) {
      // Для статических файлов генерируем thumbnailUrl
      thumbnailUrl = `/uploads/thumb_${post.image.split('/').pop().replace(/\.[^/.]+$/, '.webp')}`;
    }
    
    const postWithImageUrl = {
        ...post,
        imageUrl: imageUrl,
        thumbnailUrl: thumbnailUrl,
        likesCount: post.likes ? post.likes.length : 0,
        isLikedByCurrentUser: isLikedByCurrentUser,
        commentsCount: post.comments ? post.comments.length : 0
    };

    res.status(200).json({
      message: 'Post fetched successfully',
      post: postWithImageUrl
    });

  } catch (error) {
    console.error('Error fetching post by ID:', error);
    if (error.kind === 'ObjectId') {
        return res.status(400).json({ message: 'Invalid Post ID.' });
    }
    res.status(500).json({ message: 'Server error while fetching post.', error: error.message });
  }
};

// @desc    Update a post (caption only)
// @route   PUT /api/posts/:id
// @access  Private
exports.updatePost = async (req, res) => {
  try {
    const postId = req.params.id;
    const { caption } = req.body;
    const userId = req.user.id;

    if (caption === undefined) {
      return res.status(400).json({ message: 'Caption field is required for update.' });
    }

    const post = await Post.findById(postId);

    if (!post) {
      return res.status(404).json({ message: 'Post not found.' });
    }

    // Check if the current user is the author of the post
    if (post.author.toString() !== userId) {
      return res.status(403).json({ message: 'Access denied. You are not the author of this post.' });
    }

    post.caption = caption.trim();
    const updatedPost = await post.save();

    // To return the post with author data and full image URL
    const populatedPost = await Post.findById(updatedPost._id)
                                   .populate('author', 'username avatar')
                                   .lean();
    
    const responsePost = {
        ...populatedPost,
        imageUrl: (() => { return getMediaUrl(populatedPost.image, 'image'); })()
    };

    res.status(200).json({
      message: 'Post updated successfully',
      post: responsePost
    });

  } catch (error) {
    console.error('Error updating post:', error);
    if (error.kind === 'ObjectId') {
        return res.status(400).json({ message: 'Invalid Post ID.' });
    }
    if (error.name === 'ValidationError') {
        return res.status(400).json({ message: 'Validation Error: ' + error.message });
    }
    res.status(500).json({ message: 'Server error while updating post.', error: error.message });
  }
};

// Метод для удаления поста с очисткой файлов в Google Drive
exports.deletePost = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.id;

    // Находим пост
    const post = await Post.findById(postId);

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // Проверяем права пользователя
    if (post.author.toString() !== userId) {
      return res.status(403).json({ message: 'Not authorized to delete this post' });
    }

    // Извлекаем ID файлов из URL Google Drive
    const extractGoogleDriveId = (url) => {
      const match = url.match(/\/uc\?id=([^&]+)/);
      return match ? match[1] : null;
    };

    const fileIds = [];

    // Добавляем ID основного изображения/видео
    if (post.image) {
      const mainFileId = extractGoogleDriveId(post.image);
      if (mainFileId) fileIds.push(mainFileId);
      }

    // Внутри функции deletePost
    if (post.thumbnailUrl) {
      try {
        // Извлекаем ID превью из Google Drive URL
        const thumbnailFileId = new URL(post.thumbnailUrl).searchParams.get('id');
        
        if (thumbnailFileId) {
          fileIds.push(thumbnailFileId);
          console.log(`[POST_DELETE] Добавлен ID превью: ${thumbnailFileId}`);
      }
      } catch (error) {
        console.error(`[POST_DELETE] Ошибка извлечения ID превью: ${error.message}`);
      }
    }

    // Удаляем файлы из Google Drive
    const deleteResults = await GoogleDriveFileManager.deleteFiles(fileIds.filter(Boolean));

    console.log('[POST_DELETE] Результаты удаления файлов:', deleteResults);

    // Удаляем пост из базы данных
    await Post.findByIdAndDelete(postId);

    // Обновляем пользователя - удаляем ссылку на пост и уменьшаем счетчик
    await User.findByIdAndUpdate(
      userId, 
      { 
        $pull: { posts: postId }, 
        $inc: { postsCount: -1 } 
      }
    );

    res.status(200).json({ 
      message: 'Post deleted successfully',
      deletedFiles: {
        success: deleteResults.success,
        failed: deleteResults.failed
      }
    });

  } catch (error) {
    console.error('Error deleting post:', error);
    res.status(500).json({ message: 'Server error while deleting post', error: error.message });
  }
};

// @desc    Get all posts of a specific user
// @route   GET /api/posts/user/:userId
// @access  Private (or Public, depending on requirements)
exports.getUserPosts = async (req, res) => {
  try {
    const { userId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Check if the user exists (optional, but useful)
    const userExists = await User.findById(userId);
    if (!userExists) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const posts = await Post.find({ author: userId })
      .populate('author', 'username avatar email') // Although we filter by author, keep it for data consistency
      .populate({
        path: 'comments',
        populate: {
            path: 'user',
            select: 'username avatar'
        },
        options: { sort: { createdAt: -1 } } // all comments
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const totalPosts = await Post.countDocuments({ author: userId });

    const postsWithImageUrls = posts.map(post => {
      let imageUrl;
      let thumbnailUrl;
      
          // Для внешних видео с youtubeData (TikTok, YouTube и т.д.) без image
    if (!post.image && post.youtubeData) {
      imageUrl = null; // Не устанавливаем imageUrl, фронтенд будет использовать youtubeData
    }
    // Для видео с внешними URL (TikTok, VK, Instagram) или placeholder
    else if (post.image === '/video-placeholder.svg' || (post.image && post.image.startsWith('/'))) {
      imageUrl = post.image; // Оставляем как есть для статических файлов
    } else if (post.image && post.image.startsWith('http')) {
      imageUrl = post.image; // Уже полный URL (Cloudinary, YouTube thumbnail)
    } else if (post.image) {
      imageUrl = getMediaUrl(post.image, 'image');
    } else {
      imageUrl = null; // Нет изображения
    }

    // Новая логика для thumbnailUrl
    if (post.thumbnailUrl) {
      thumbnailUrl = post.thumbnailUrl;
    } else if (post.image && post.image.startsWith('/')) {
      // Для статических файлов генерируем thumbnailUrl
      thumbnailUrl = `/uploads/thumb_${post.image.split('/').pop().replace(/\.[^/.]+$/, '.webp')}`;
    }
      
      return {
        ...post,
        imageUrl: imageUrl,
        thumbnailUrl: thumbnailUrl
      };
    });

    res.status(200).json({
      message: `Posts for user ${userExists.username} fetched successfully`,
      posts: postsWithImageUrls,
      currentPage: page,
      totalPages: Math.ceil(totalPosts / limit),
      totalPosts
    });

  } catch (error) {
    console.error('Error fetching user posts:', error);
    if (error.kind === 'ObjectId') {
        return res.status(400).json({ message: 'Invalid user or post ID.' });
    }
    res.status(500).json({ message: 'Server error while fetching user posts.', error: error.message });
  }
};

// @desc    Get likes for a post
// @route   GET /api/posts/:postId/likes
// @access  Public (or Private, if needed)
exports.getPostLikes = async (req, res) => {
  try {
    const { postId } = req.params;

    // Check if the post exists (optional, but improves the response)
    const postExists = await Post.findById(postId).select('_id').lean();
    if (!postExists) {
      return res.status(404).json({ message: 'Post not found.' });
    }

    const likes = await Like.find({ post: postId })
      .populate('user', 'username avatar _id') // Load data of the user who liked
      .select('user createdAt') // Select only the necessary fields from the Like document
      .sort({ createdAt: -1 }); // Sort by like date (newest first)

    res.status(200).json({
      message: 'Likes for the post fetched successfully',
      likes, // Array of like objects, each containing user information
      count: likes.length
    });

  } catch (error) {
    console.error('Error fetching likes for post:', error);
    if (error.kind === 'ObjectId') {
        return res.status(400).json({ message: 'Invalid Post ID.' });
    }
    res.status(500).json({ message: 'Server error while fetching likes.', error: error.message });
  }
};

// @desc    Получить пользователей, которые загружали видео
// @route   GET /api/posts/video-users
// @access  Private
exports.getVideoUsers = async (req, res) => {
  try {
    const videoUsers = await Post.aggregate([
      {
        $match: {
          $or: [
            { mediaType: 'video' },
            { youtubeData: { $exists: true, $ne: null } },
            { videoUrl: { $exists: true, $ne: null } }
          ]
        }
      },
      {
        $group: {
          _id: '$author',
          videoCount: { $sum: 1 },
          lastVideoDate: { $max: '$createdAt' }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'userInfo'
        }
      },
      {
        $match: {
          'userInfo.0': { $exists: true } // Только если пользователь существует
        }
      },
      {
        $unwind: '$userInfo'
      },
      {
        $project: {
          _id: '$userInfo._id',
          username: '$userInfo.username',
          avatar: '$userInfo.avatar',
          videoCount: 1,
          lastVideoDate: 1
        }
      },
      {
        $sort: { lastVideoDate: -1 }
      },
      {
        $limit: 20
      }
    ]);

    res.json({ success: true, users: videoUsers });
  } catch (error) {
    console.error('Error fetching video users:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching video users',
      error: error.message
    });
  }
};

// @desc    Получить все видео конкретного пользователя
// @route   GET /api/posts/user/:userId/videos
// @access  Private
exports.getUserVideos = async (req, res) => {
  try {
    const { userId } = req.params;

    const userVideos = await Post.find({
      author: userId,
      $or: [
        { mediaType: 'video' },
        { youtubeData: { $exists: true, $ne: null } }
      ]
    })
      .populate('author', 'username avatar')
      .populate({
        path: 'comments',
        populate: {
          path: 'user',
          select: 'username avatar'
        },
        options: { sort: { createdAt: 1 } } // Сортируем комментарии по возрастанию (старые сначала)
      })
      .populate('likes', '_id') // Загружаем лайки тоже
      .sort({ createdAt: -1 });

    // Добавляем информацию о лайках, комментариях и правильные URL для видео
    const videosWithInfo = userVideos.map(video => {
      const videoObj = video.toObject();
      
      // Добавляем правильные URL для видео файлов
  
      
      if (videoObj.image) {
        // Для локальных видео файлов создаем правильные URL
        if (videoObj.mediaType === 'video') {
          videoObj.videoUrl = getMediaUrl(videoObj.image, 'video');
          videoObj.imageUrl = getVideoThumbnailUrl(videoObj.image); // Превью для видео
        } else {
          videoObj.imageUrl = getMediaUrl(videoObj.image, 'image');
          videoObj.videoUrl = getMediaUrl(videoObj.image, 'video'); // На случай если это видео
        }
      }
      
      console.log('📹 Video data:', {
        id: videoObj._id,
        mediaType: videoObj.mediaType,
        image: videoObj.image,
        imageUrl: videoObj.imageUrl,
        videoUrl: videoObj.videoUrl,
        mobileThumbnailUrl: videoObj.mobileThumbnailUrl,
        youtubeData: videoObj.youtubeData,
      });
      
      return {
        ...videoObj,
        likesCount: video.likes ? video.likes.length : 0,
        commentsCount: video.comments ? video.comments.length : 0
      };
    });

    res.json({ success: true, posts: videosWithInfo });
  } catch (error) {
    console.error('Error fetching user videos:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Тестовый endpoint для проверки
// @route   GET /api/posts/test-video-users
// @access  Private
exports.testVideoUsers = async (req, res) => {
  try {
    console.log('Test video users endpoint called');
    console.log('User from middleware:', req.user);
    
    // Простой тест - найти все посты с видео
    const videoPosts = await Post.find({
      $or: [
        { mediaType: 'video' },
        { youtubeData: { $exists: true, $ne: null } },
        { videoUrl: { $exists: true, $ne: null } }
      ]
    }).populate('author', 'username avatar').limit(5);
    
    console.log(`Found ${videoPosts.length} video posts`);
    
    res.json({ 
      success: true, 
      message: 'Test endpoint working',
      videoPosts: videoPosts.length,
      user: req.user ? req.user.username : 'No user'
    });
  } catch (error) {
    console.error('Test video users error:', error);
    res.status(500).json({
      success: false,
      message: 'Test endpoint error',
      error: error.message
    });
  }
};

// Функция для определения платформы
const detectPlatform = (url) => {
  if (url.includes('tiktok.com') || url.includes('vm.tiktok.com')) {
    return 'tiktok';
  } else if (url.includes('instagram.com')) {
    return 'instagram';
  } else if (url.includes('youtube.com') || url.includes('youtu.be')) {
    return 'youtube';
  } else if (url.includes('twitter.com') || url.includes('x.com')) {
    return 'twitter';
  }
  return 'unknown';
};

// Instagram API извлечение
const extractInstagramVideoAPI = async (url) => {
  try {
    console.log('📷 Extracting Instagram video via improved methods...');
    
    // Импортируем наш новый экстрактор
    const { extractInstagramVideo } = require('../utils/instagramExtractor');
    
    // Используем новый экстрактор
    const result = await extractInstagramVideo(url);
    
    if (result && result.success && result.videoUrl) {
      console.log('✅ Instagram extraction successful via new extractor');
      return result.videoUrl; // Возвращаем простую строку как TikTok для совместимости
    }
    
    throw new Error('New Instagram extractor failed');

  } catch (error) {
    console.error('❌ Instagram extraction error:', error.message);
    
    // Fallback к старому SaveGram методу
    try {
      console.log('🔄 Trying fallback SaveGram API...');
      
      const shortcode = url.match(/\/p\/([^\/\?]+)/)?.[1] || url.match(/\/reel\/([^\/\?]+)/)?.[1];
      if (!shortcode) {
        throw new Error('Could not extract shortcode from Instagram URL');
      }
      
      const response = await axios.post('https://savegram.app/api/ajaxSearch', {
        q: url,
        t: 'media',
        lang: 'en'
      }, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://savegram.app/en'
        },
        timeout: 15000
      });

      if (response.data && response.data.status === 'ok' && response.data.data) {
        console.log('✅ SaveGram fallback response received');
        
        const htmlData = response.data.data;
        const linkMatches = htmlData.match(/href="(https:\/\/dl\.snapcdn\.app\/get\?token=[^"]+)"/g);
        
        if (linkMatches && linkMatches.length > 0) {
          let videoUrl = null;
          
          for (const match of linkMatches) {
            const extractedUrl = match.match(/href="([^"]+)"/)[1];
            
            try {
              const tokenMatch = extractedUrl.match(/token=([^&]+)/);
              if (tokenMatch) {
                const token = tokenMatch[1];
                const decoded = Buffer.from(token.split('.')[1], 'base64').toString();
                const payload = JSON.parse(decoded);
                
                if (payload.url && payload.url.includes('.mp4')) {
                  videoUrl = extractedUrl;
                  console.log('✅ Found video URL via SaveGram fallback');
                  break;
                }
              }
            } catch (decodeError) {
              videoUrl = linkMatches[linkMatches.length - 1].match(/href="([^"]+)"/)[1];
            }
          }
          
          if (videoUrl) {
            console.log('✅ SaveGram fallback API successful');
            return videoUrl;
          }
        }
      }
    } catch (fallbackError) {
      console.log('❌ SaveGram fallback also failed:', fallbackError.message);
    }

    // Последний fallback к демо-видео
    console.log('🎬 All Instagram methods failed, using demo video');
    return 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
  }
};

// Twitter API извлечение
const extractTwitterVideoAPI = async (url) => {
  try {
    console.log('🐦 Extracting Twitter video via multiple APIs...');
    
    // Подход 1: TwitterVid API
    try {
      console.log('🔄 Trying TwitterVid API...');
      const response = await axios.post('https://twittervid.com/api/download', {
        url: url
      }, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Content-Type': 'application/json'
        },
        timeout: 15000
      });

      if (response.data && response.data.download_url) {
        console.log('✅ TwitterVid API successful');
        return {
          videoUrl: response.data.download_url,
          title: response.data.title || 'Twitter Video',
          author: response.data.author || 'Twitter User',
          thumbnail: response.data.thumbnail || ''
        };
      }
    } catch (error) {
      console.log('❌ TwitterVid API failed:', error.message);
    }

    // Подход 2: SaveTwitter API
    try {
      console.log('🔄 Trying SaveTwitter API...');
      const response = await axios.post('https://savetwitter.net/api/download', {
        url: url,
        format: 'mp4'
      }, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Content-Type': 'application/json'
        },
        timeout: 15000
      });

      if (response.data && response.data.video_url) {
        console.log('✅ SaveTwitter API successful');
        return {
          videoUrl: response.data.video_url,
          title: response.data.title || 'Twitter Video',
          author: response.data.author || 'Twitter User',
          thumbnail: response.data.thumbnail || ''
        };
      }
    } catch (error) {
      console.log('❌ SaveTwitter API failed:', error.message);
    }

    // Подход 3: TWOffline API
    try {
      console.log('🔄 Trying TWOffline API...');
      const response = await axios.post('https://twoffline.net/api/download', {
        url: url
      }, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Content-Type': 'application/json'
        },
        timeout: 15000
      });

      if (response.data && response.data.download_link) {
        console.log('✅ TWOffline API successful');
        return {
          videoUrl: response.data.download_link,
          title: response.data.title || 'Twitter Video',
          author: response.data.username || 'Twitter User',
          thumbnail: response.data.thumbnail || ''
        };
      }
    } catch (error) {
      console.log('❌ TWOffline API failed:', error.message);
    }

    // Fallback к демо-видео
    console.log('🎬 All Twitter APIs failed, using demo video');
    return {
      videoUrl: 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4',
      title: 'Demo Video (Twitter API Unavailable)',
      author: 'Demo User',
      thumbnail: 'https://via.placeholder.com/300x300?text=Twitter+Demo'
    };

  } catch (error) {
    console.error('❌ Twitter extraction error:', error);
    return {
      videoUrl: 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4',
      title: 'Demo Video (Twitter Error)',
      author: 'Demo User',
      thumbnail: 'https://via.placeholder.com/300x300?text=Twitter+Error'
    };
  }
};

// Функция для скачивания файла по URL
const downloadFile = async (url, filepath) => {
  try {
    console.log('📥 Starting download from:', url.substring(0, 100) + '...');
    
    const response = await axios({
      method: 'GET',
      url: url,
      responseType: 'stream',
      timeout: 30000, // 30 секунд таймаут
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    const writer = fs.createWriteStream(filepath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', () => {
        console.log('✅ Download completed successfully');
        resolve();
      });
      writer.on('error', (error) => {
        console.log('❌ Download error:', error.message);
        reject(error);
      });
      
      // Добавляем таймаут для записи файла
      setTimeout(() => {
        reject(new Error('Download timeout'));
      }, 60000);
    });
  } catch (error) {
    console.log('❌ Download request failed:', error.message);
    throw error;
  }
};

// @desc    Скачать и загрузить внешнее видео (TikTok, Instagram, VK)
// @route   POST /api/posts/external-video/download
// @access  Private
exports.downloadExternalVideo = async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ success: false, message: 'URL is required' });
    }

    console.log(`🎬 Downloading video from URL: ${url}`);
    
    const downloader = new VideoDownloader();
    const result = await downloader.downloadVideo(url);

    if (result.success) {
      console.log(`✅ Video downloaded and uploaded to Google Drive successfully`);
      
      // Формируем данные для создания поста на фронтенде
      const videoData = {
        mediaType: "video",
        image: result.videoUrl, // Используем videoUrl как основное изображение
        videoUrl: result.videoUrl,
        thumbnailUrl: result.thumbnailUrl, // <--- Убедимся, что это поле передается
        gifPreview: result.gifPreviewUrl, // Добавляем GIF-превью
        googleDriveFileId: result.fileId, // ID файла в Google Drive
        youtubeData: {
          platform: result.platform,
          originalUrl: result.originalUrl,
          note: `Downloaded ${result.platform} video`,
          title: result.videoInfo.title || '',
          isExternalLink: false,
          videoUrl: result.videoUrl, // Дублируем для совместимости
          thumbnailUrl: result.thumbnailUrl // <--- И здесь тоже
        }
      };

      res.json({
        success: true,
        message: 'Video downloaded and uploaded successfully',
        isExternalLink: false, // Это загруженное видео
        videoUrl: result.videoUrl,
        thumbnailUrl: result.thumbnailUrl, // <--- И в корне ответа
        originalUrl: result.originalUrl,
        platform: result.platform,
        title: result.videoInfo.title || '',
        note: `Downloaded ${result.platform} video`,
        videoData: videoData
      });

    } else {
      throw new Error(result.message || 'Failed to download video');
    }

  } catch (error) {
    console.error('❌ Error in downloadExternalVideo:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to download external video',
    });
  }
};


// @desc    Create post with external video (YouTube iframe, TikTok links, etc.)
// @route   POST /api/posts/external-video
// @access  Private
exports.createExternalVideoPost = async (req, res) => {
  try {
    const { url, caption } = req.body;
    const userId = req.user._id;

    // Только подготовка данных, без создания поста
    const videoData = {
      platform: 'youtube',
      url: url,
      caption: caption || ''
    };

      res.status(200).json({
        success: true,
      videoData: videoData
    });
  } catch (error) {
    console.error('Error processing external video:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process external video' 
    });
  }
};

// Функция для извлечения видео через API сервисы (только для TikTok, Instagram, Twitter)
const extractVideoFromPlatform = async (url, platform) => {
  console.log(`🔗 Extracting ${platform} video via API...`);
  
  try {
    if (platform === 'tiktok') {
      return await extractTikTokVideoAPI(url);
    } else if (platform === 'instagram') {
      return await extractInstagramVideoAPI(url);
    } else if (platform === 'twitter') {
      return await extractTwitterVideoAPI(url);
    } else if (platform === 'youtube') {
      throw new Error('YouTube should use iframe embedding, not download');
    } else {
      throw new Error(`Unsupported platform: ${platform}`);
    }
  } catch (error) {
    console.log(`❌ API extraction failed for ${platform}:`, error.message);
    throw error;
  }
};

// TikTok API извлечение
const extractTikTokVideoAPI = async (url) => {
  try {
    console.log('🎵 Extracting TikTok video via API...');
    
    // Используем публичный API для TikTok
    const apiUrl = 'https://tikwm.com/api/';
    
    const response = await axios.post(apiUrl, {
      url: url,
      hd: 1
    }, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (response.data && response.data.code === 0 && response.data.data) {
      const videoUrl = response.data.data.hdplay || response.data.data.play;
      if (videoUrl) {
        console.log('✅ TikTok video URL extracted via API');
        return videoUrl;
      }
    }
    
    throw new Error('Could not extract TikTok video URL');
  } catch (error) {
    console.log('❌ TikTok API failed, trying alternative...');
    
    // Альтернативный API
    try {
      const altResponse = await axios.get(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}&hd=1`);
      
      if (altResponse.data && altResponse.data.code === 0 && altResponse.data.data) {
        const videoUrl = altResponse.data.data.hdplay || altResponse.data.data.play;
        if (videoUrl) {
          console.log('✅ TikTok video URL extracted via alternative API');
          return videoUrl;
        }
      }
      
      throw new Error('Alternative TikTok API also failed');
    } catch (altError) {
      throw new Error(`TikTok extraction failed: ${error.message}`);
    }
  }
};
