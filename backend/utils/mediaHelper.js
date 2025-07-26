const path = require('path');
const fs = require('fs').promises;

// Конфигурация для разных сред
const getMediaConfig = () => {
  return {
    isDevelopment: process.env.NODE_ENV !== 'production',
    localUploadPath: 'uploads/',
    maxFileSize: 100 * 1024 * 1024, // 100MB
    allowedTypes: {
      image: [
        'image/jpeg', 
        'image/png', 
        'image/gif', 
        'image/webp', 
        'image/heic',     // Добавляем HEIC
        'image/heif',     // Добавляем HEIF
        'image/x-heic',   // Альтернативный MIME для HEIC
        'image/x-heif'    // Альтернативный MIME для HEIF
      ],
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

const mediaConfig = {
  cloudinaryConfig: {
    useCloudinary: false
  }
};

// Функция для получения URL медиа файла (только Google Drive)
const getMediaUrl = (url, config = mediaConfig) => {
  return url; // Просто возвращаем URL без дополнительной обработки
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