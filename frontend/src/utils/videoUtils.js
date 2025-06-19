// Утилиты для работы с видео

// Получение thumbnail для Cloudinary видео
export const getCloudinaryVideoThumbnail = (videoUrl, options = {}) => {
  if (!videoUrl || !videoUrl.includes('cloudinary.com')) {
    return videoUrl;
  }

  const { width = 400, height = 400, quality = 'auto' } = options;
  
  // Заменяем /video/upload/ на версию с thumbnail
  return videoUrl.replace(
    '/video/upload/',
    `/video/upload/w_${width},h_${height},c_fill,q_${quality},f_jpg/`
  );
};

// Получение превью для любого типа медиа
export const getMediaThumbnail = (post, options = {}) => {
  if (!post) return '/video-placeholder.svg';

  // YouTube видео
  if (post.youtubeData && post.youtubeData.thumbnailUrl) {
    return post.youtubeData.thumbnailUrl;
  }

  // Видео URL напрямую
  if (post.videoUrl) {
    // YouTube URL
    const youtubeRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const youtubeMatch = post.videoUrl.match(youtubeRegex);
    if (youtubeMatch) {
      return `https://img.youtube.com/vi/${youtubeMatch[1]}/maxresdefault.jpg`;
    }
    
    // Для TikTok, VK, Instagram - используем placeholder
    if (post.videoUrl.includes('tiktok.com') || 
        post.videoUrl.includes('vm.tiktok.com') ||
        post.videoUrl.includes('vk.com') || 
        post.videoUrl.includes('vkvideo.ru') ||
        post.videoUrl.includes('instagram.com') || 
        post.videoUrl.includes('instagr.am')) {
      return '/video-placeholder.svg';
    }
    
    // Для других видео URL возвращаем placeholder
    return '/video-placeholder.svg';
  }

  // Cloudinary видео - проверяем все возможные поля
  if (post.mediaType === 'video' && (post.imageUrl || post.image)) {
    const videoUrl = post.imageUrl || post.image;
    
    // Если это placeholder, возвращаем его
    if (videoUrl === '/video-placeholder.svg' || videoUrl.startsWith('/video-placeholder')) {
      return '/video-placeholder.svg';
    }
    
    // Если это Cloudinary видео
    if (videoUrl && videoUrl.includes('cloudinary.com')) {
      return getCloudinaryVideoThumbnail(videoUrl, options);
    } else if (videoUrl && videoUrl.startsWith('http')) {
      // Для других внешних URL возвращаем как есть
      return videoUrl;
    } else if (videoUrl) {
      // Для локальных видео файлов возвращаем placeholder
      return '/video-placeholder.svg';
    }
  }

  // Если это видео но нет URL - возвращаем placeholder
  if (post.mediaType === 'video') {
    return '/video-placeholder.svg';
  }

  // Обычные изображения
  const imageUrl = post.imageUrl || post.image;
  return imageUrl || null;
};

// Создание встраиваемого URL для YouTube
export const createYouTubeEmbedUrl = (url) => {
  const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
  const match = url.match(regex);
  
  if (match) {
    return `https://www.youtube.com/embed/${match[1]}`;
  }
  
  return url;
};

// Проверка является ли URL видео ссылкой
export const isVideoUrl = (url) => {
  const videoPatterns = [
    /youtube\.com\/watch\?v=/,
    /youtu\.be\//,
    /tiktok\.com\/@[\w.-]+\/video\/\d+/,
    /vm\.tiktok\.com\/[\w.-]+/,
    /vk\.com\/video/,
    /vkvideo\.ru\/video/,
    /instagram\.com\/(?:p|reel)\//
  ];

  return videoPatterns.some(pattern => pattern.test(url));
}; 