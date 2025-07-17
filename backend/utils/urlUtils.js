// Функция для получения правильного URL медиа файла с проксированием Google Drive
const getMediaUrl = (imagePath, type = 'image') => {
  if (!imagePath) return null;

  if (imagePath.startsWith('http')) {
    return imagePath;
  }

  if (process.env.USE_GOOGLE_DRIVE === 'true') {
    // Проксируем запрос через сервер
    return `/api/proxy-drive/${imagePath}`;
  }

  return `/uploads/${imagePath}`;
};

const getVideoThumbnailUrl = (imagePath) => {
  if (!imagePath) return null;

  if (imagePath.startsWith('http')) {
    return imagePath;
  }

  if (process.env.USE_GOOGLE_DRIVE === 'true') {
    return `/api/proxy-drive/${imagePath}`;
  }

  return `/uploads/${imagePath}`;
};

const getMobileThumbnailUrl = (imagePath) => {
  if (!imagePath) return null;

  if (imagePath.startsWith('http')) {
    return imagePath;
  }

  if (process.env.USE_GOOGLE_DRIVE === 'true') {
    return `/api/proxy-drive/${imagePath}`;
  }

  return `/uploads/${imagePath}`;
};

const getReliableThumbnailUrl = (imagePath) => {
  if (!imagePath) return null;

  if (imagePath.startsWith('http')) {
    return imagePath;
  }

  if (process.env.USE_GOOGLE_DRIVE === 'true') {
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