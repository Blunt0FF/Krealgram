const Post = require('../models/postModel');
const User = require('../models/userModel'); // Needed to add post to user's posts array
const fs = require('fs'); // For file system operations (deleting images)
const path = require('path'); // For working with paths
const Like = require('../models/likeModel'); // Import the Like model

// @desc    Create a new post
// @route   POST /api/posts
// @access  Private
exports.createPost = async (req, res) => {
  try {
    const { caption, videoUrl, videoData } = req.body;
    const authorId = req.user.id; // User ID from authMiddleware

    console.log('=== CREATE POST DEBUG ===');
    console.log('Request body:', req.body);
    console.log('Has file:', !!req.file);
    console.log('Author ID:', authorId);

    let imagePath = null;
    let mediaType = 'image';
    let youtubeData = null;

    // Проверяем, есть ли URL видео
    if (videoUrl) {
      console.log('Processing video URL:', videoUrl);
      console.log('Video data:', videoData);
      
      // Для всех видео URL устанавливаем placeholder
      imagePath = '/video-placeholder.svg';
      mediaType = 'video';
      
      if (videoData) {
        const parsedVideoData = typeof videoData === 'string' ? JSON.parse(videoData) : videoData;
        console.log('Parsed video data:', parsedVideoData);
        
        if (parsedVideoData.platform === 'youtube') {
          // Для YouTube сохраняем данные для встраивания
          youtubeData = {
            videoId: parsedVideoData.videoId,
            embedUrl: parsedVideoData.embedUrl,
            thumbnailUrl: parsedVideoData.thumbnailUrl,
            title: '', // Можно добавить получение через YouTube API
            duration: ''
          };
          // Используем thumbnail как изображение если есть
          if (parsedVideoData.thumbnailUrl) {
            imagePath = parsedVideoData.thumbnailUrl;
          }
        } else {
          // Для других платформ (TikTok, VK, Instagram)
          youtubeData = {
            platform: parsedVideoData.platform,
            videoId: parsedVideoData.videoId,
            originalUrl: parsedVideoData.originalUrl,
            embedUrl: parsedVideoData.embedUrl,
            thumbnailUrl: parsedVideoData.thumbnailUrl,
            note: parsedVideoData.note || 'External video content'
          };
        }
      } else {
        // Если нет videoData, создаем базовую структуру
        youtubeData = {
          platform: 'unknown',
          originalUrl: videoUrl,
          note: 'External video content'
        };
      }
    } else if (req.file) {
      // Обычная загрузка файла
      imagePath = req.file.path || req.file.filename;
      mediaType = req.file.mimetype.startsWith('video/') ? 'video' : 'image';
    }

    // Проверяем что у нас есть хотя бы что-то для отображения
    if (!imagePath && !videoUrl && !caption?.trim()) {
      console.log('No video URL, no file, and no caption provided');
      return res.status(400).json({ message: 'Media content or caption is required for the post.' });
    }

    // Если нет imagePath но есть videoUrl, НЕ устанавливаем placeholder для внешних видео
    if (!imagePath && videoUrl && !youtubeData) {
      // Только для случаев когда нет youtubeData (например, прямые ссылки на видео файлы)
      imagePath = '/video-placeholder.svg';
      mediaType = 'video';
    } else if (!imagePath && videoUrl && youtubeData) {
      // Для внешних видео (TikTok, YouTube и т.д.) НЕ устанавливаем imagePath
      // Оставляем imagePath пустым, чтобы система использовала youtubeData
      mediaType = 'video';
    }
    
    // Если нет медиа вообще, но есть подпись, используем текстовый пост
    if (!imagePath && !videoUrl && caption?.trim()) {
      imagePath = '/text-post-placeholder.svg';
      mediaType = 'image';
    }

    console.log('Final post data:', {
      imagePath,
      mediaType,
      youtubeData,
      videoUrl,
      caption
    });

    const newPost = new Post({
      author: authorId,
      image: imagePath,
      mediaType: mediaType,
      caption: caption || '',
      videoUrl: videoUrl || null,
      youtubeUrl: videoUrl || null, // Для обратной совместимости
      youtubeData: youtubeData
    });

    const savedPost = await newPost.save();

    // Add post to user's posts array
    await User.findByIdAndUpdate(authorId, { $push: { posts: savedPost._id } });

    // Return the post with author data
    const populatedPost = await Post.findById(savedPost._id).populate('author', 'username avatar');

    res.status(201).json({
      message: 'Post created successfully',
      post: populatedPost
    });

  } catch (error) {
    console.error('Error creating post:', error);
    console.error('Error stack:', error.stack);
    console.error('Request body:', req.body);
    console.error('Request file:', req.file);
    
    // Clean up uploaded file if DB error occurred
    if (req.file && req.file.path) {
      fs.unlink(path.join(__dirname, '..', 'uploads', req.file.filename), (err) => {
        if (err) console.error("Error deleting file on failed post creation:", err);
      });
    }
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: 'Validation Error: ' + error.message });
    }
    
    // Более подробная информация об ошибке
    const errorMessage = error.message || 'Unknown error occurred';
    const errorCode = error.code || 'UNKNOWN_ERROR';
    
    res.status(500).json({ 
      message: 'Server error while creating post.', 
      error: errorMessage,
      code: errorCode,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
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
          const { getMediaUrl } = require('../utils/urlUtils'); imageUrl = getMediaUrl(post.image, 'image');
        } else {
          imageUrl = null; // Нет изображения
        }
        
        return {
          ...post,
          imageUrl: imageUrl,
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
      const { getMediaUrl } = require('../utils/urlUtils'); imageUrl = getMediaUrl(post.image, 'image');
    } else {
      imageUrl = null; // Нет изображения
    }
    
    const postWithImageUrl = {
        ...post,
        imageUrl: imageUrl,
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
        imageUrl: (() => { const { getMediaUrl } = require('../utils/urlUtils'); return getMediaUrl(populatedPost.image, 'image'); })()
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

// @desc    Delete a post
// @route   DELETE /api/posts/:id
// @access  Private
exports.deletePost = async (req, res) => {
  try {
    const postId = req.params.id;
    const userId = req.user.id;

    const post = await Post.findById(postId);

    if (!post) {
      return res.status(404).json({ message: 'Post not found.' });
    }

    // Check if the current user is the author of the post
    if (post.author.toString() !== userId) {
      return res.status(403).json({ message: 'Access denied. You are not the author of this post.' });
    }

    // 1. Delete the image from the uploads/ folder
    const imageFilePath = path.join(__dirname, '..', 'uploads', post.image);
    fs.unlink(imageFilePath, (err) => {
      if (err) {
        // Log the error, but do not interrupt the process of deleting the post from the DB,
        // as it might just be a missing file or an access issue.
        console.error(`Error deleting image file ${post.image}:`, err);
      }
    });

    // 2. Delete the post from the DB (this should also trigger Mongoose pre/post remove hooks if defined for cascading delete)
    await post.deleteOne(); // Use deleteOne() on the document or Post.findByIdAndDelete(postId)

    // 3. Delete related data (if cascading delete is not configured via Mongoose middleware)
    //    - Delete comments on the post
    //    - Delete likes on the post
    //    - Delete notifications related to the post
    //    - Delete the post from the user's posts array
    // For this, we'll need the Comment, Like, Notification, and User models
    const Comment = require('../models/commentModel');
    const Like = require('../models/likeModel');
    const Notification = require('../models/notificationModel');
    // User model is already imported at the top if createPost uses it

    await Comment.deleteMany({ post: postId });
    await Like.deleteMany({ post: postId });
    
    // Correctly delete notifications related to the post from all documents
    await Notification.updateMany(
      { 'notifications.post': postId },
      { $pull: { notifications: { post: postId } } }
    );

    await User.findByIdAndUpdate(userId, { $pull: { posts: postId } });

    res.status(200).json({ message: 'Post deleted successfully.' });

  } catch (error) {
    console.error('Error deleting post:', error);
    if (error.kind === 'ObjectId') {
        return res.status(400).json({ message: 'Invalid Post ID.' });
    }
    res.status(500).json({ message: 'Server error while deleting post.', error: error.message });
  }
};

// @desc    Get all posts of a specific user
// @route   GET /api/posts/user/:userId
// @access  Private (or Public, depending on requirements)
exports.getUserPosts = async (req, res) => {
  try {
    const { userId } = req.params;
    const { getMediaUrl, getVideoThumbnailUrl, getMobileThumbnailUrl, getReliableThumbnailUrl } = require('../utils/urlUtils');    const page = parseInt(req.query.page) || 1;
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
      const { getMediaUrl } = require('../utils/urlUtils'); imageUrl = getMediaUrl(post.image, 'image');
    } else {
      imageUrl = null; // Нет изображения
    }
      
      return {
        ...post,
        imageUrl: imageUrl
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
    console.log('Getting video users...');
    
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

    console.log(`Found ${videoUsers.length} video users`);
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
    const { getMediaUrl, getVideoThumbnailUrl } = require('../utils/urlUtils');

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
      const { getMediaUrl, getVideoThumbnailUrl } = require('../utils/urlUtils');
      
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
        youtubeData: videoObj.youtubeData
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

// @desc    Скачать и загрузить внешнее видео (TikTok, Instagram)
// @route   POST /api/posts/external-video/download
// @access  Private
exports.downloadExternalVideo = async (req, res) => {
  try {
    const { url, platform } = req.body;
    
    if (!url || !platform) {
      return res.status(400).json({
        success: false,
        message: "URL and platform are required"
      });
    }

    // Поддерживаемые платформы для загрузки
    const supportedPlatforms = ["tiktok", "instagram"];
    if (!supportedPlatforms.includes(platform.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: `Platform ${platform} is not supported for download`
      });
    }

    // Здесь можно добавить логику загрузки видео
    // Пока возвращаем mock данные для тестирования
    const mockResponse = {
      success: true,
      message: "Video download initiated",
      videoUrl: `https://res.cloudinary.com/demo/video/upload/sample.mp4`, // Mock URL
      thumbnailUrl: `https://res.cloudinary.com/demo/image/upload/sample.jpg`, // Mock thumbnail
      publicId: `external_video_${Date.now()}`,
      platform: platform,
      originalUrl: url
    };

    res.json(mockResponse);
  } catch (error) {
    console.error("Error downloading external video:", error);
    res.status(500).json({
      success: false,
      message: "Failed to download external video",
      error: error.message
    });
  }
};
