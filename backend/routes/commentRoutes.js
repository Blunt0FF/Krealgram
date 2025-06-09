const express = require('express');
const router = express.Router();
const commentController = require('../controllers/commentController');
const authMiddleware = require('../middlewares/authMiddleware');

// @route   POST /api/comments
// @desc    Добавление комментария к посту (postId в теле запроса)
// @access  Private
router.post('/', authMiddleware, commentController.addComment);

// @route   POST /api/comments/:postId
// @desc    Добавление комментария к посту (postId в параметрах)
// @access  Private
router.post('/:postId', authMiddleware, commentController.addCommentToPost);

// @route   DELETE /api/comments/:commentId
// @desc    Удаление комментария
// @access  Private (автор комментария или автор поста)
router.delete('/:commentId', authMiddleware, commentController.deleteComment);

// @route   GET /api/comments/:postId
// @desc    Получение всех комментариев для поста (с пагинацией)
// @access  Public (можно добавить authMiddleware, если нужно)
router.get('/:postId', commentController.getCommentsForPost);

module.exports = router;

module.exports = router; 