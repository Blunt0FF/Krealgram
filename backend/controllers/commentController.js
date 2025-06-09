const Comment = require('../models/commentModel');
const Post = require('../models/postModel');
const User = require('../models/userModel');
const { addNotification } = require('./notificationController');
const mongoose = require('mongoose');

// @desc    Добавление комментария к посту (postId в теле запроса)
// @route   POST /api/comments
// @access  Private
exports.addComment = async (req, res) => {
  const session = await mongoose.startSession(); // Для транзакции
  session.startTransaction();
  try {
    const { postId, text } = req.body;
    const userId = req.user.id;

    if (!postId) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: 'ID post is required.' });
    }

    if (!text || text.trim() === '') {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: 'Comment text cannot be empty.' });
    }

    const post = await Post.findById(postId).session(session);
    if (!post) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'Post not found.' });
    }

    const comment = new Comment({
      post: postId,
      user: userId,
      text: text.trim()
    });

    const savedComment = await comment.save({ session });

    // Добавляем комментарий в массив комментариев поста
    post.comments.push(savedComment._id);
    await post.save({ session });

    // Добавляем комментарий в массив комментариев пользователя (автора комментария)
    await User.findByIdAndUpdate(userId, { $push: { comments: savedComment._id } }, { session });
    
    // Создаем уведомление для автора поста, если комментирует не он сам
    if (post.author.toString() !== userId.toString()) {
      await addNotification(post.author, {
        sender: userId,
        type: 'comment',
        post: postId,
        comment: savedComment._id
      });
    }

    await session.commitTransaction();
    session.endSession();

    // Для ответа популяризуем автора комментария
    const populatedComment = await Comment.findById(savedComment._id).populate('user', 'username avatar');

    res.status(201).json({
      message: 'Comment added successfully',
      comment: populatedComment
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('Error adding comment:', error);
    if (error.name === 'ValidationError') {
        return res.status(400).json({ message: `Validation Error: ${error.message}` });
    }
    res.status(500).json({ message: 'Server error while adding comment.', error: error.message });
  }
};

// @desc    Добавление комментария к посту (postId в параметрах)
// @route   POST /api/comments/:postId
// @access  Private
exports.addCommentToPost = async (req, res) => {
  const session = await mongoose.startSession(); // Для транзакции
  session.startTransaction();
  try {
    const { postId } = req.params;
    const { text } = req.body;
    const userId = req.user.id;

    if (!text || text.trim() === '') {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: 'Comment text cannot be empty.' });
    }

    const post = await Post.findById(postId).session(session);
    if (!post) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'Post not found.' });
    }

    const comment = new Comment({
      post: postId,
      user: userId,
      text: text.trim()
    });

    const savedComment = await comment.save({ session });

    // Добавляем комментарий в массив комментариев поста
    post.comments.push(savedComment._id);
    await post.save({ session });

    // Добавляем комментарий в массив комментариев пользователя (автора комментария)
    await User.findByIdAndUpdate(userId, { $push: { comments: savedComment._id } }, { session });
    
    // Создаем уведомление для автора поста, если комментирует не он сам
    if (post.author.toString() !== userId.toString()) {
      await addNotification(post.author, {
        sender: userId,
        type: 'comment',
        post: postId,
        comment: savedComment._id
      });
    }

    await session.commitTransaction();
    session.endSession();

    // Для ответа популяризуем автора комментария
    const populatedComment = await Comment.findById(savedComment._id).populate('user', 'username avatar');

    res.status(201).json({
      message: 'Comment added successfully',
      comment: populatedComment
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('Error adding comment:', error);
    if (error.name === 'ValidationError') {
        return res.status(400).json({ message: `Validation Error: ${error.message}` });
    }
    res.status(500).json({ message: 'Server error while adding comment.', error: error.message });
  }
};

// @desc    Удаление комментария
// @route   DELETE /api/comments/:commentId
// @access  Private
exports.deleteComment = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { commentId } = req.params;
    const userId = req.user.id; // ID текущего пользователя

    const comment = await Comment.findById(commentId).session(session);
    if (!comment) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'Comment not found.' });
    }

    const post = await Post.findById(comment.post).session(session);
    if (!post) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'Related post not found. Comment cannot exist without a post.' });
    }

    const isPostAuthor = post && post.author.toString() === userId.toString();

    // Allow deletion if user is the comment author or the post author
    if (comment.user.toString() !== userId && !isPostAuthor) {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({ message: 'Access denied. You are not the author of this comment or post.' });
    }

    // Удаляем ID комментария из массива comments у поста
    // Используем $pull напрямую в Post.findByIdAndUpdate для атомарности в рамках транзакции
    await Post.findByIdAndUpdate(comment.post, { $pull: { comments: commentId } }, { session });

    // Удаляем ID комментария из массива comments у автора комментария
    await User.findByIdAndUpdate(comment.user, { $pull: { comments: commentId } }, { session });
    
    // Удаляем сам комментарий
    // Важно: findByIdAndDelete не возвращает документ по умолчанию, если нужна дополнительная логика с ним, используйте findById а потом .deleteOne()
    await Comment.findByIdAndDelete(commentId, { session });

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({ message: 'Comment deleted successfully' });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('Error deleting comment:', error);
    if (error.kind === 'ObjectId') {
        return res.status(400).json({ message: 'Invalid comment or post ID.' });
    }
    res.status(500).json({ message: 'Server error while deleting comment.', error: error.message });
  }
};

// @desc    Получение всех комментариев для поста
// @route   GET /api/comments/:postId
// @access  Public (или Private, в зависимости от требований)
exports.getCommentsForPost = async (req, res) => {
  try {
    const { postId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 15; // Можно увеличить лимит для комментариев
    const skip = (page - 1) * limit;

    // Проверка, существует ли пост (опционально, но улучшает ответ)
    const postExists = await Post.findById(postId).select('_id').lean(); // Быстрая проверка
    if (!postExists) {
      return res.status(404).json({ message: 'Post not found.' });
    }

    const comments = await Comment.find({ post: postId })
      .populate('user', 'username avatar') // Загружаем данные автора комментария
      .sort({ createdAt: -1 }) // Сортируем по дате создания (новые сначала)
      .skip(skip)
      .limit(limit)
      .lean();

    const totalComments = await Comment.countDocuments({ post: postId });

    res.status(200).json({
      message: 'Comments fetched successfully',
      comments,
      currentPage: page,
      totalPages: Math.ceil(totalComments / limit),
      totalComments
    });

  } catch (error) {
    console.error('Error fetching comments:', error);
    if (error.kind === 'ObjectId') {
        return res.status(400).json({ message: 'Invalid post ID.' });
    }
    res.status(500).json({ message: 'Server error while fetching comments.', error: error.message });
  }
}; 