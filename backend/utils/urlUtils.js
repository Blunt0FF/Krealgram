
// Функция для получения правильного URL медиа файла
const getMediaUrl = (imagePath, type = 'image') => {
  if (!imagePath) return null;
  
  // Если уже полный URL, возвращаем как есть
  if (imagePath.startsWith('http')) {
    return imagePath;
  }
  
  // Проверяем используется ли Google Drive
  if (process.env.USE_GOOGLE_DRIVE === 'true') {
    // Для Google Drive используем прокси
    return `https://krealgram-backend.onrender.com/api/proxy-drive/${imagePath}`;
  }
  
  // Для локальной разработки используем статические файлы
  return `/uploads/${imagePath}`;
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
    // Для Google Drive используем прямую ссылку
    return `https://drive.google.com/uc?id=${imagePath}`;
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
    // Для Google Drive используем прямую ссылку
    return `https://drive.google.com/uc?id=${imagePath}`;
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
    // Для Google Drive используем прямую ссылку
    return `https://drive.google.com/uc?id=${imagePath}`;
  }
  
  // Для локальной разработки используем статические файлы
  return `/uploads/${imagePath}`;
};

module.exports = {
  getMediaUrl,
  getVideoThumbnailUrl,
  getMobileThumbnailUrl,
  getReliableThumbnailUrl
}; 





