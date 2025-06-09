const express = require('express');
const router = express.Router();
const likeController = require('../controllers/likeController');
const authMiddleware = require('../middlewares/authMiddleware');

// @route   POST /api/likes/:postId/toggle
// @desc    Поставить или убрать лайк с поста
// @access  Private
router.post('/:postId/toggle', authMiddleware, likeController.toggleLikePost);

module.exports = router; 