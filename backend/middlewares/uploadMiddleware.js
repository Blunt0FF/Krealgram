const multer = require('multer');
const path = require('path');
const axios = require('axios');

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
      file.mimetype === 'video/quicktime' ||
      file.mimetype === 'video/webm') {
    cb(null, true); // Принимаем файл
  } else {
    cb(new Error('Unsupported file type! Please upload images (jpeg, png, gif, webp) or videos (mp4, mov, webm, quicktime).'), false); // Отклоняем файл
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

// Вспомогательная функция для загрузки на Imgur
async function uploadToImgur(filePath) {
  const fs = require('fs');
  const FormData = require('form-data');
  const form = new FormData();
  form.append('image', fs.createReadStream(filePath));
  const clientId = process.env.IMGUR_CLIENT_ID;
  if (!clientId) throw new Error('IMGUR_CLIENT_ID not set');
  const res = await axios.post('https://api.imgur.com/3/image', form, {
    headers: {
      ...form.getHeaders(),
      Authorization: `Client-ID ${clientId}`
    }
  });
  return res.data.data.link;
}

// Для изображений: diskStorage + Imgur
const imageStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, `${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`);
  }
});

// Переопределяем uploadPost для поддержки Imgur
const uploadPost = multer({
  storage: {
    _handleFile: async function (req, file, cb) {
      // Если изображение — грузим на Imgur
      if (file.mimetype.startsWith('image/')) {
        const disk = multer({ storage: imageStorage }).single(file.fieldname);
        disk(req, {}, async (err) => {
          if (err) return cb(err);
          try {
            const imgurUrl = await uploadToImgur(req.file.path);
            // Удаляем локальный файл после загрузки
            require('fs').unlink(req.file.path, () => {});
            req.file.secure_url = imgurUrl;
            req.file.mimetype = file.mimetype;
            cb(null, req.file);
          } catch (e) {
            cb(e);
          }
        });
      } else {
        // Видео — Cloudinary (старый storage)
        postStorage._handleFile(req, file, cb);
      }
    },
    _removeFile: function (req, file, cb) {
      cb(null);
    }
  },
  limits: {
    fileSize: 50 * 1024 * 1024
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
    console.log('=== UPLOAD MIDDLEWARE DEBUG ===');
    console.log('Field name:', fieldName);
    console.log('Use Cloudinary:', useCloudinary);
    console.log('Request has file:', !!req.file);
    
    upload(req, res, (err) => {
      if (err) {
        console.error('Upload error:', err);
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
          // Игнорируем неожиданные поля вместо выброса ошибки
          console.warn(`Unexpected field ignored: ${err.field}`);
          return next();
        }
        return next(err);
      }
      
      console.log('Upload successful, file:', req.file ? {
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        secure_url: req.file.secure_url,
        public_id: req.file.public_id
      } : 'No file');
      
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