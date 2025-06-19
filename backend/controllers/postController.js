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
    const { caption } = req.body;
    const authorId = req.user.id; // User ID from authMiddleware

    if (!req.file) {
      return res.status(400).json({ message: 'Image is required for the post.' });
    }

    // Get the image path - either Cloudinary URL or local file
    const imagePath = req.file.path || req.file.filename; // Cloudinary returns path, local returns filename
    
    // Определяем тип медиа файла
    const mediaType = req.file.mimetype.startsWith('video/') ? 'video' : 'image';

    const newPost = new Post({
      author: authorId,
      image: imagePath, // Save relative path or filename
      mediaType: mediaType, // Сохраняем тип медиа
      caption: caption || ''
    });

    const savedPost = await newPost.save();

    // Add post to user's posts array (optional, but was in the old User model)
    await User.findByIdAndUpdate(authorId, { $push: { posts: savedPost._id } });

    // To return the post with author data
    const populatedPost = await Post.findById(savedPost._id).populate('author', 'username avatar');

    res.status(201).json({
      message: 'Post created successfully',
      post: populatedPost
    });

  } catch (error) {
    console.error('Error creating post:', error);
    // If the error is related to file upload (e.g., type), multer will pass it.
    // More specific multer error handling can be added if uploadMiddleware is configured for it.
    if (req.file && req.file.path) {
        // Attempt to delete the uploaded file if a DB error occurred after upload
        fs.unlink(path.join(__dirname, '..', 'uploads', req.file.filename), (err) => {
            if (err) console.error("Error deleting file on failed post creation:", err);
        });
    }
    if (error.name === 'ValidationError') {
        return res.status(400).json({ message: 'Validation Error: ' + error.message });
    }
    res.status(500).json({ message: 'Server error while creating post.', error: error.message });
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
        const imageUrl = post.image.startsWith('http') ? post.image : `${req.protocol}://${req.get('host')}/uploads/${post.image}`;
        
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
    const imageUrl = post.image.startsWith('http') ? post.image : `${req.protocol}://${req.get('host')}/uploads/${post.image}`;
    
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
        imageUrl: `${req.protocol}://${req.get('host')}/uploads/${populatedPost.image}`
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

    const postsWithImageUrls = posts.map(post => ({
      ...post,
      imageUrl: post.image.startsWith('http') ? post.image : `${req.protocol}://${req.get('host')}/uploads/${post.image}`
    }));

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