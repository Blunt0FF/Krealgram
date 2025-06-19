const express = require('express');
const router = express.Router();
const postController = require('../controllers/postController');
const authMiddleware = require('../middlewares/authMiddleware');
const { uploadPost } = require('../middlewares/uploadMiddleware'); // Наш multer middleware

// Создаем гибкий middleware для опциональной загрузки файлов
const optionalUpload = (req, res, next) => {
  // Проверяем content-type
  const contentType = req.headers['content-type'] || '';
  
  // Если это multipart/form-data но есть videoUrl в body, скорее всего это URL запрос
  if (contentType.includes('multipart/form-data')) {
    // Используем multer middleware
    uploadPost(req, res, (err) => {
      if (err) {
        // Если ошибка multer но есть videoUrl, игнорируем ошибку
        if (req.body && req.body.videoUrl) {
          return next();
        }
        return next(err);
      }
      next();
    });
  } else {
    // Для обычных JSON запросов просто переходим дальше
    next();
  }
};

// @route   POST api/posts
// @desc    Создание нового поста (с загрузкой изображения или URL видео)
// @access  Private
router.post('/', authMiddleware, optionalUpload, postController.createPost);

// СПЕЦИФИЧНЫЕ ROUTES ДОЛЖНЫ БЫТЬ ПЕРЕД ОБЩИМИ!

// @route   GET api/posts/test-video-users
// @desc    Тестовый endpoint для проверки
// @access  Private
router.get('/test-video-users', authMiddleware, postController.testVideoUsers);

// @route   GET api/posts/video-users
// @desc    Получить пользователей с видео для stories
// @access  Private
router.get('/video-users', authMiddleware, postController.getVideoUsers);

// @route   GET api/posts/user/:userId/videos
// @desc    Получить все видео конкретного пользователя
// @access  Private
router.get('/user/:userId/videos', authMiddleware, postController.getUserVideos);

// @route   GET api/posts/user/:userId
// @desc    Получение всех постов конкретного пользователя
// @access  Private
router.get('/user/:userId', authMiddleware, postController.getUserPosts);

// @route   GET api/posts/:postId/likes
// @desc    Получение всех лайков для поста
// @access  Public (или authMiddleware, если нужна инфо о currentUser)
router.get('/:postId/likes', postController.getPostLikes);

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

module.exports = router; 