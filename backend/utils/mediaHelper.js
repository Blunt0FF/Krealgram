const path = require('path');
const fs = require('fs').promises;

// Конфигурация для разных сред
const getMediaConfig = () => {
  return {
    isDevelopment: process.env.NODE_ENV !== 'production',
    useCloudinary: process.env.USE_CLOUDINARY === 'true',
    cloudinaryConfig: {
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET
    },
    localUploadPath: 'uploads/',
    maxFileSize: 50 * 1024 * 1024, // 50MB
    allowedTypes: {
      image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
      video: ['video/mp4', 'video/webm', 'video/ogg']
    }
  };
};

// Функция для валидации медиа файла
const validateMediaFile = (file, type = 'image') => {
  const config = getMediaConfig();
  const allowedTypes = config.allowedTypes[type] || config.allowedTypes.image;
  
  if (!allowedTypes.includes(file.mimetype)) {
    throw new Error(`Invalid file type. Allowed types: ${allowedTypes.join(', ')}`);
  }
  
  if (file.size > config.maxFileSize) {
    throw new Error(`File too large. Maximum size: ${config.maxFileSize / (1024 * 1024)}MB`);
  }
  
  return true;
};

// Функция для обработки YouTube URL
const processYouTubeUrl = (url) => {
  const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
  const match = url.match(regex);
  
  if (!match) {
    throw new Error('Invalid YouTube URL');
  }
  
  const videoId = match[1];
  return {
    videoId,
    embedUrl: `https://www.youtube.com/embed/${videoId}`,
    thumbnailUrl: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
    watchUrl: `https://www.youtube.com/watch?v=${videoId}`
  };
};

// Функция для получения URL медиа файла (локальный или Cloudinary)
const getMediaUrl = (filename, type = 'post') => {
  const config = getMediaConfig();
  
  if (config.useCloudinary) {
    // В продакшене с Cloudinary будем возвращать Cloudinary URL
    return `https://res.cloudinary.com/${config.cloudinaryConfig.cloud_name}/image/upload/v1/${filename}`;
  } else {
    // В разработке используем локальные файлы
    return `/uploads/${type === 'message' ? 'messages/' : ''}${filename}`;
  }
};

// Функция для удаления локального файла
const deleteLocalFile = async (filePath) => {
  try {
    await fs.unlink(filePath);
    console.log(`Deleted local file: ${filePath}`);
  } catch (error) {
    console.error(`Error deleting local file ${filePath}:`, error.message);
  }
};

// Функция для создания структуры ответа медиа
const createMediaResponse = (file, youtubeData = null) => {
  if (youtubeData) {
    return {
      type: 'video',
      youtubeId: youtubeData.videoId, // Поддерживаем и youtubeId для совместимости с фронтендом
      videoId: youtubeData.videoId,
      url: youtubeData.watchUrl,
      embedUrl: youtubeData.embedUrl,
      thumbnail: youtubeData.thumbnailUrl
    };
  }
  
  if (file) {
    return {
      type: file.mimetype.startsWith('image/') ? 'image' : 'video',
      url: getMediaUrl(file.filename, 'message'),
      filename: file.filename,
      originalName: file.originalname,
      size: file.size
    };
  }
  
  return null;
};

module.exports = {
  getMediaConfig,
  validateMediaFile,
  processYouTubeUrl,
  getMediaUrl,
  deleteLocalFile,
  createMediaResponse
}; 