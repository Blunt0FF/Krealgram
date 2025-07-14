const express = require('express');
const router = express.Router();
const postController = require('../controllers/postController');
const authMiddleware = require('../middlewares/authMiddleware');
const { upload, uploadToGoogleDrive } = require('../middlewares/uploadMiddleware'); // Google Drive middleware

// Создаем гибкий middleware для опциональной загрузки файлов
const optionalUpload = (req, res, next) => {
  // Проверяем content-type
  const contentType = req.headers['content-type'] || '';
  
  // Если это multipart/form-data
  if (contentType.includes('multipart/form-data')) {
    // Используем multer middleware для Google Drive
    upload.single('image')(req, res, async (err) => {
      if (err) {
        console.error('Multer upload error:', err);
        
        // Обработка ошибок Multer
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ 
            message: 'File too large. Maximum size is 50MB.',
            error: err.message 
          });
        }
        
        if (err.message && err.message.includes('Поддерживаются только изображения и видео файлы')) {
          return res.status(400).json({ 
            message: 'Unsupported file type. Please upload images or videos only.', 
            error: err.message 
          });
        }
        
        // Если ошибка multer но есть videoUrl, игнорируем ошибку
        if (req.body && req.body.videoUrl) {
          return next();
        }
        
        return res.status(400).json({ 
          message: 'File upload error',
          error: err.message 
        });
      }
      
      // Если файл есть, загружаем на Google Drive
      if (req.file) {
        try {
          await uploadToGoogleDrive(req, res, next);
        } catch (uploadError) {
          console.error('Google Drive upload error:', uploadError);
          return res.status(500).json({ 
            message: 'Failed to upload file to Google Drive',
            error: uploadError.message 
          });
        }
      } else {
        next();
      }
    });
  } else {
    // Для обычных JSON запросов просто переходим дальше
    next();
  }
};

// @route   POST api/posts
// @desc    Создать новый пост
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

// @route   POST api/posts/external-video/download
// @desc    Скачать и загрузить внешнее видео (TikTok, Instagram)
// @access  Private
router.post('/external-video/download', authMiddleware, postController.downloadExternalVideo);

// @route   POST api/posts/external-video
// @desc    Создать пост с внешним видео (YouTube iframe, TikTok ссылки)
// @access  Private
router.post("/external-video", authMiddleware, postController.createExternalVideoPost);
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
// @desc    Получить все посты
// @access  Private
router.get('/', authMiddleware, postController.getAllPosts);

// @route   GET api/posts/:id
// @desc    Получить пост по ID
// @access  Private
router.get('/:id', authMiddleware, postController.getPostById);

// @route   PUT api/posts/:id
// @desc    Обновление поста (caption)
// @access  Private (только автор)
router.put('/:id', authMiddleware, postController.updatePost);

// @route   DELETE api/posts/:id
// @desc    Удалить пост
// @access  Private
router.delete('/:id', authMiddleware, postController.deletePost);

module.exports = router; 