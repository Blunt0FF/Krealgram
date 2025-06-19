const multer = require('multer');
const path = require('path');

// Check if Cloudinary should be used
const useCloudinary = process.env.USE_CLOUDINARY === 'true';

let postStorage, messageMediaStorage;

if (useCloudinary) {
  // Use Cloudinary storage
  const { uploadPost, uploadMessage } = require('../config/cloudinary');
  postStorage = uploadPost.storage;
  messageMediaStorage = uploadMessage.storage;
} else {
  // Use local storage
  postStorage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, 'uploads/'); // Папка для изображений постов
    },
    filename: function (req, file, cb) {
      // Генерируем уникальное имя файла: полеName-время.расширение
      cb(null, `${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`);
    }
  });

  messageMediaStorage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, 'uploads/messages/'); // Папка для медиа файлов сообщений
    },
    filename: function (req, file, cb) {
      // Создаем уникальное имя файла: timestamp_originalname
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, 'message_' + uniqueSuffix + path.extname(file.originalname));
    }
  });
}

// Фильтр для файлов постов (принимаем изображения И видео)
const postFileFilter = (req, file, cb) => {
  // Проверяем тип файла
  if (file.mimetype === 'image/jpeg' || 
      file.mimetype === 'image/png' || 
      file.mimetype === 'image/gif' || 
      file.mimetype === 'image/webp' ||
      file.mimetype === 'video/mp4' ||
      file.mimetype === 'video/mov' ||
      file.mimetype === 'video/webm') {
    cb(null, true); // Принимаем файл
  } else {
    cb(new Error('Unsupported file type! Please upload images (jpeg, png, gif, webp) or videos (mp4, mov, webm).'), false); // Отклоняем файл
  }
};

// Фильтр файлов для сообщений - разрешаем только изображения и видео
const messageMediaFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image and video files are allowed!'), false);
  }
};

// Инициализация multer для постов
const uploadPost = multer({
  storage: postStorage,
  limits: {
    fileSize: 1024 * 1024 * 10 // Лимит размера файла: 10MB
  },
  fileFilter: postFileFilter
});

// Настройка multer для медиа файлов сообщений
const uploadMessageMedia = multer({
  storage: messageMediaStorage,
  fileFilter: messageMediaFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB лимит
  }
});

// Создаем гибкий middleware для обработки разных полей
const createFlexibleUpload = (upload, fieldName) => {
  return (req, res, next) => {
    upload(req, res, (err) => {
      if (err) {
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
          // Игнорируем неожиданные поля вместо выброса ошибки
          console.warn(`Unexpected field ignored: ${err.field}`);
          return next();
        }
        return next(err);
      }
      next();
    });
  };
};

// Экспортируем middleware для разных типов загрузки
module.exports = {
  uploadPost: createFlexibleUpload(uploadPost.single('image'), 'image'), // Для постов
  uploadMessageMedia: createFlexibleUpload(uploadMessageMedia.single('media'), 'media'), // Для сообщений
  uploadPostDirect: uploadPost.single('image'), // Прямой middleware без обработки ошибок
  uploadMessageMediaDirect: uploadMessageMedia.single('media') // Прямой middleware без обработки ошибок
}; 