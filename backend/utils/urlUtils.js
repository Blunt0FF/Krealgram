// Функция для получения правильного URL медиа файла с проксированием Google Drive
const getMediaUrl = (imagePath, type = 'image') => {
  if (!imagePath) return null;

  if (imagePath.startsWith('http')) {
    return imagePath;
  }

  // Для видео используем прямые ссылки на Google Drive
  if (type === 'video' && imagePath && imagePath.length > 20 && !imagePath.includes('/')) {
    return `https://drive.google.com/uc?export=download&id=${imagePath}`;
  }
  
  // Для изображений используем проксирование
  if (imagePath && imagePath.length > 20 && !imagePath.includes('/')) {
    // Это похоже на Google Drive ID
    return `/api/proxy-drive/${imagePath}`;
  }

  return `/uploads/${imagePath}`;
};

const getVideoThumbnailUrl = (imagePath) => {
  if (!imagePath) return null;

  if (imagePath.startsWith('http')) {
    return imagePath;
  }

  // Всегда используем проксирование для Google Drive файлов
  if (imagePath && imagePath.length > 20 && !imagePath.includes('/')) {
    return `/api/proxy-drive/${imagePath}`;
  }

  return `/uploads/${imagePath}`;
};

const getMobileThumbnailUrl = (imagePath) => {
  if (!imagePath) return null;

  if (imagePath.startsWith('http')) {
    return imagePath;
  }

  // Всегда используем проксирование для Google Drive файлов
  if (imagePath && imagePath.length > 20 && !imagePath.includes('/')) {
    return `/api/proxy-drive/${imagePath}`;
  }

  return `/uploads/${imagePath}`;
};

const getReliableThumbnailUrl = (imagePath) => {
  if (!imagePath) return null;

  if (imagePath.startsWith('http')) {
    return imagePath;
  }

  // Всегда используем проксирование для Google Drive файлов
  if (imagePath && imagePath.length > 20 && !imagePath.includes('/')) {
    return `/api/proxy-drive/${imagePath}`;
  }

  return `/uploads/${imagePath}`;
};

module.exports = {
  getMediaUrl,
  getVideoThumbnailUrl,
  getMobileThumbnailUrl,
  getReliableThumbnailUrl
};