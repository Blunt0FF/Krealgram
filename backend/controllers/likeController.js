const Like = require('../models/likeModel');
const Post = require('../models/postModel');
const User = require('../models/userModel');
const { addNotification, removeNotification } = require('./notificationController');
const mongoose = require('mongoose');

// @desc    Post/remove like from post
// @route   POST /api/likes/:postId/toggle
// @access  Private
exports.toggleLikePost = async (req, res) => {
  const { postId } = req.params;
  const userId = req.user.id;

  console.log('Toggle like request:', { postId, userId });

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Find post and check its existence
    const post = await Post.findById(postId).session(session);
    if (!post) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'Post not found.' });
    }

    // Use the 'Like' collection as the single source of truth
    const existingLike = await Like.findOne({ user: userId, post: postId }).session(session);

    if (existingLike) {
      // --- UNLIKE LOGIC ---
      // Remove like from all collections
      await Promise.all([
        Like.findByIdAndDelete(existingLike._id, { session }),
        Post.updateOne(
          { _id: postId },
          { $pull: { likes: userId } },
          { session }
        ),
        User.updateOne(
          { _id: userId },
          { $pull: { likes: postId } },
          { session }
        )
      ]);

      // Remove notification about like
      if (post.author.toString() !== userId.toString()) {
        await removeNotification(post.author, {
          sender: userId,
          type: 'like',
          post: postId
        });
      }

    } else {
      // --- LIKE LOGIC ---
      // Add like to all collections
      await Promise.all([
        new Like({ user: userId, post: postId }).save({ session }),
        Post.updateOne(
          { _id: postId },
          { $addToSet: { likes: userId } },
          { session }
        ),
        User.updateOne(
          { _id: userId },
          { $addToSet: { likes: postId } },
          { session }
        )
      ]);

      // Create notification about like
      if (post.author.toString() !== userId.toString()) {
        await addNotification(post.author, {
          sender: userId,
          type: 'like',
          post: postId
        });
      }
    }

    await session.commitTransaction();
    session.endSession();

    // Get updated post with actual like count
    const updatedPost = await Post.findById(postId)
      .select('likes')
      .lean();

    const likeCount = updatedPost.likes.length;

    console.log('Updated post like status:', {
      postId,
      liked: !existingLike, // If there was no existing like, it means we added one
      likeCount,
      likes: updatedPost.likes
    });

    res.status(200).json({
      message: !existingLike ? 'Post liked successfully' : 'Post unliked successfully',
      liked: !existingLike,
      likeCount,
      likes: updatedPost.likes
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('Error toggling like:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: 'Validation error: ' + error.message });
    }
    res.status(500).json({ message: 'Server error while toggling like.', error: error.message });
  }
};