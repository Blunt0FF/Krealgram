const express = require('express');
const router = express.Router();
const postController = require('../controllers/postController');
const authMiddleware = require('../middlewares/authMiddleware');
const { uploadPost } = require('../middlewares/uploadMiddleware'); // Наш multer middleware

// @route   POST api/posts
// @desc    Создание нового поста (с загрузкой изображения)
// @access  Private
router.post('/', authMiddleware, uploadPost, postController.createPost);

// @route   GET api/posts
// @desc    Получение всех постов (лента с пагинацией)
// @access  Private
router.get('/', authMiddleware, postController.getAllPosts);

// @route   GET api/posts/:id
// @desc    Получение одного поста по ID
// @access  Private 
router.get('/:id', authMiddleware, postController.getPostById);

// @route   PUT api/posts/:id
// @desc    Обновление поста (caption)
// @access  Private (только автор)
router.put('/:id', authMiddleware, postController.updatePost);

// @route   DELETE api/posts/:id
// @desc    Удаление поста
// @access  Private (только автор)
router.delete('/:id', authMiddleware, postController.deletePost);

// @route   GET api/posts/user/:userId
// @desc    Получение всех постов конкретного пользователя
// @access  Private
router.get('/user/:userId', authMiddleware, postController.getUserPosts);

// @route   GET api/posts/:postId/likes
// @desc    Получение всех лайков для поста
// @access  Public (или authMiddleware, если нужна инфо о currentUser)
router.get('/:postId/likes', postController.getPostLikes);

module.exports = router; 