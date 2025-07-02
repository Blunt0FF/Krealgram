// Конфигурация Cloudinary для продакшена
// Для использования нужно установить: npm install cloudinary

const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// Настройка подключения к Cloudinary
// В .env файле должны быть:
// CLOUDINARY_CLOUD_NAME=your_cloud_name
// CLOUDINARY_API_KEY=your_api_key  
// CLOUDINARY_API_SECRET=your_api_secret
// USE_CLOUDINARY=true (для продакшена)

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Настройка хранилища для постов
const postStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    console.log('Cloudinary processing file:', file.originalname, file.mimetype, file.size);
    
    // Базовые параметры
    const baseParams = {
      folder: 'krealgram/posts',
      allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'mov', 'webm', 'avi', 'quicktime'],
      resource_type: 'auto', // Автоматически определяет тип (image/video)
    };

    // Если это GIF файл, не применяем трансформацию чтобы сохранить анимацию
    if (file.mimetype === 'image/gif') {
      return {
        ...baseParams,
        flags: 'animated', // Сохраняем анимацию для GIF
        // НЕ применяем transformation для GIF
      };
    }

    // Для остальных изображений применяем трансформацию
    if (file.mimetype.startsWith('image/')) {
      return {
        ...baseParams,
        transformation: [
          { width: 1080, height: 1080, crop: 'limit', quality: 'auto' }
        ],
      };
    }

    // Для видео создаем превью первого кадра
    if (file.mimetype.startsWith('video/') || file.mimetype === 'video/quicktime') {
      return {
        ...baseParams,
        resource_type: 'video',
        format: 'mp4', // Конвертируем MOV в MP4 для лучшей совместимости
        chunk_size: 6000000,
        eager: [
          { 
            format: 'jpg',
            transformation: [
              { width: 400, height: 400, crop: 'fill', gravity: 'center' }
            ]
          }
        ]
      };
    }

    // Для остальных типов файлов
    return baseParams;
  },
});

// Настройка хранилища для аватаров
const avatarStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'krealgram/avatars',
    allowed_formats: ['jpg', 'jpeg', 'png'],
    transformation: [
      { width: 400, height: 400, crop: 'fill', gravity: 'face', quality: 'auto' }
    ],
  },
});

// Настройка хранилища для сообщений
const messageStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    // Базовые параметры
    const baseParams = {
      folder: 'krealgram/messages',
      allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'mp4', 'mov'],
      resource_type: 'auto', // Автоматически определяет тип (image/video)
    };

    // Если это GIF файл, не применяем трансформацию чтобы сохранить анимацию
    if (file.mimetype === 'image/gif') {
      return {
        ...baseParams,
        flags: 'animated', // Сохраняем анимацию для GIF
        // НЕ применяем transformation для GIF
      };
    }

    // Для остальных файлов применяем трансформацию
    return {
      ...baseParams,
      transformation: [
        { width: 800, height: 800, crop: 'limit', quality: 'auto' }
      ],
    };
  },
});

// Multer middleware для разных типов загрузок
const uploadPost = multer({ 
  storage: postStorage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB для видео
  },
  fileFilter: (req, file, cb) => {
    console.log('Multer fileFilter check:', file.originalname, file.mimetype);
    
    // Разрешенные MIME типы
    const allowedMimeTypes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
      'video/mp4', 'video/mov', 'video/quicktime', 'video/webm', 'video/avi'
    ];
    
    if (allowedMimeTypes.includes(file.mimetype)) {
      console.log('✓ File type accepted:', file.mimetype);
      cb(null, true);
    } else {
      console.log('✗ File type rejected:', file.mimetype);
      cb(new Error(`Unsupported file type: ${file.mimetype}`), false);
    }
  }
});

const uploadAvatar = multer({ 
  storage: avatarStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

const uploadMessage = multer({ 
  storage: messageStorage,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB
  },
});

// Экспортируем объекты с правильными свойствами
uploadPost.storage = postStorage;
uploadMessage.storage = messageStorage;

// Функция для удаления изображения из Cloudinary
const deleteImage = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    console.error('Error deleting image from Cloudinary:', error);
    throw error;
  }
};

// Функция для получения оптимизированного URL
const getOptimizedUrl = (publicId, options = {}) => {
  return cloudinary.url(publicId, {
    fetch_format: 'auto',
    quality: 'auto',
    ...options
  });
};

module.exports = {
  cloudinary,
  uploadPost,
  uploadAvatar,
  uploadMessage,
  deleteImage,
  getOptimizedUrl,
}; 