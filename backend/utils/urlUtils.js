const path = require('path');

// Функция для получения правильного URL медиа файла
const getMediaUrl = (imagePath, type = 'image') => {
  if (!imagePath) return null;
  
  // Если уже полный URL, возвращаем как есть
  if (imagePath.startsWith('http')) {
    return imagePath;
  }
  
  // Проверяем используется ли Google Drive
  if (process.env.USE_GOOGLE_DRIVE === 'true') {
    // Используем проксирование через бэкенд
    return `/api/proxy-drive/${imagePath}`;
  }
  
  // Для локальной разработки используем статические файлы
  return `/uploads/${type === 'message' ? 'messages/' : ''}${imagePath}`;
};

// Функция для получения URL превью видео
const getVideoThumbnailUrl = (imagePath) => {
  if (!imagePath) return null;
  
  // Если уже полный URL, возвращаем как есть
  if (imagePath.startsWith('http')) {
    return imagePath;
  }
  
  // Проверяем используется ли Google Drive
  if (process.env.USE_GOOGLE_DRIVE === 'true') {
    // Используем проксирование через бэкенд
    return `/api/proxy-drive/${imagePath}`;
  }
  
  // Для локальной разработки используем статические файлы
  return `/uploads/${imagePath}`;
};

// Функция для получения мобильного превью
const getMobileThumbnailUrl = (imagePath) => {
  if (!imagePath) return null;
  
  // Если уже полный URL, возвращаем как есть
  if (imagePath.startsWith('http')) {
    return imagePath;
  }
  
  // Проверяем используется ли Google Drive
  if (process.env.USE_GOOGLE_DRIVE === 'true') {
    // Используем проксирование через бэкенд
    return `/api/proxy-drive/${imagePath}`;
  }
  
  // Для локальной разработки используем статические файлы
  return `/uploads/${imagePath}`;
};

const getReliableThumbnailUrl = (imagePath) => {
  if (!imagePath) return null;
  
  // Если уже полный URL, возвращаем как есть
  if (imagePath.startsWith('http')) {
    return imagePath;
  }
  
  // Проверяем используется ли Google Drive
  if (process.env.USE_GOOGLE_DRIVE === 'true') {
    // Используем проксирование через бэкенд
    return `/api/proxy-drive/${imagePath}`;
  }
  
  // Для локальной разработки используем статические файлы
  return `/uploads/${imagePath}`;
};

const getAvatarUrl = (avatarPath) => {
  if (!avatarPath) return '/default-avatar.png';

  // Если это уже полный URL с проксированием
  if (avatarPath.includes('/api/proxy-drive/')) {
    return avatarPath;
  }

  const baseUrl = process.env.NODE_ENV === 'production'
    ? 'https://krealgram-backend.onrender.com'
    : 'http://localhost:3000';

  // Обработка Google Drive ID напрямую
  if (/^[a-zA-Z0-9_-]{33}$/.test(avatarPath)) {
    return `/api/proxy-drive/${avatarPath}`;
  }

  // Обработка Google Drive URL
  const googleDrivePatterns = [
    /https:\/\/drive\.google\.com\/uc\?id=([^&]+)/,
    /https:\/\/drive\.google\.com\/file\/d\/([^/]+)/,
    /https:\/\/drive\.google\.com\/open\?id=([^&]+)/
  ];

  for (const pattern of googleDrivePatterns) {
    const match = avatarPath.match(pattern);
    if (match && match[1]) {
      return `/api/proxy-drive/${match[1]}`;
    }
  }

  // Если уже полный URL, возвращаем как есть
  if (avatarPath.startsWith('http')) return avatarPath;

  // Локальные пути
  return `${baseUrl}/uploads/${avatarPath}`;
};

module.exports = {
  getMediaUrl,
  getVideoThumbnailUrl,
  getMobileThumbnailUrl,
  getReliableThumbnailUrl,
  getAvatarUrl
}; 





