// Утилиты для работы с видео

// Получение thumbnail для Cloudinary видео
export const getCloudinaryVideoThumbnail = (videoUrl, options = {}) => {
  if (!videoUrl || !videoUrl.includes('cloudinary.com')) {
    return videoUrl;
  }

  const { width = 400, height = 'auto', quality = 'auto' } = options;
  
  // Создаем thumbnail с сохранением пропорций (без c_fill)
  if (height === 'auto') {
    return videoUrl.replace(
      '/video/upload/',
      `/video/upload/w_${width},c_scale,q_${quality},f_jpg,so_0/`
    );
  } else {
    return videoUrl.replace(
      '/video/upload/',
      `/video/upload/w_${width},h_${height},c_fit,q_${quality},f_jpg,so_0/`
    );
  }
};

// Получение статичного превью для fallback
export const getStaticThumbnail = (post) => {
  if (!post) return '/video-placeholder.svg';
  
  // Cloudinary видео - создаем статичное превью
  if (post.mediaType === 'video' || (post.imageUrl && post.imageUrl.includes('cloudinary.com') && post.imageUrl.includes('/video/'))) {
    const videoUrl = post.imageUrl || post.image;
    if (videoUrl && videoUrl.includes('cloudinary.com')) {
      const thumbnail = videoUrl.replace(
        '/video/upload/',
        `/video/upload/w_400,c_scale,f_jpg,so_0,q_auto/`
      );
      return thumbnail;
    }
  }
  
  return '/video-placeholder.svg';
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
      const thumbnail = `https://img.youtube.com/vi/${youtubeMatch[1]}/hqdefault.jpg`;
      return thumbnail;
    }
    
    // TikTok URL - пытаемся извлечь thumbnail
    if (post.videoUrl.includes('tiktok.com') || post.videoUrl.includes('vm.tiktok.com')) {
      // Для TikTok используем placeholder, так как их API требует авторизацию
      return '/video-placeholder.svg';
    }
    
    // VK URL - пытаемся извлечь thumbnail
    if (post.videoUrl.includes('vk.com') || post.videoUrl.includes('vkvideo.ru')) {
      // Для VK используем placeholder, так как их API требует токен
      return '/video-placeholder.svg';
    }
    
    // Instagram URL - пытаемся извлечь thumbnail
    if (post.videoUrl.includes('instagram.com') || post.videoUrl.includes('instagr.am')) {
      // Для Instagram используем placeholder, так как их API ограничен
      return '/video-placeholder.svg';
    }
    
    // Для других видео URL возвращаем placeholder
    return '/video-placeholder.svg';
  }

  // Cloudinary видео - проверяем все возможные поля
  if (post.mediaType === 'video' || (post.imageUrl && post.imageUrl.includes('cloudinary.com') && post.imageUrl.includes('/video/'))) {
    const videoUrl = post.imageUrl || post.image;
    
    // Если это placeholder, возвращаем его
    if (videoUrl === '/video-placeholder.svg' || videoUrl?.startsWith('/video-placeholder')) {
      return '/video-placeholder.svg';
    }
    
    // Если это Cloudinary видео
    if (videoUrl && videoUrl.includes('cloudinary.com')) {
      // Для профиля создаем статичные превью
      if (options.forProfile) {
        const thumbnail = videoUrl.replace(
          '/video/upload/',
          `/video/upload/w_${options.width || 300},h_${options.height || 300},c_fill,q_auto,f_jpg,so_0/`
        );
        return thumbnail;
      }
      // Для других случаев используем анимированные превью
      if (options.animated) {
        const thumbnail = videoUrl.replace(
          '/video/upload/',
          `/video/upload/w_${options.width || 300},c_scale,f_gif,so_0,eo_3,dl_3/`
        );
        return thumbnail;
      }
      
      // Для ленты (Post.jsx) используем зацикленные 10-секундные GIF с высоким FPS
      const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
      if (isMobile) {
        // На мобильных: зацикленные 10 сек, 30 FPS
        const thumbnail = videoUrl.replace(
          '/video/upload/',
          `/video/upload/w_400,c_scale,f_gif,so_0,eo_10,fps_30,q_80,fl_loop/`
        );
        return thumbnail;
      } else {
        // На десктопе: зацикленные 10 сек, 30 FPS, высокое качество
        const thumbnail = videoUrl.replace(
          '/video/upload/',
          `/video/upload/w_400,c_scale,f_gif,so_0,eo_10,fps_30,q_90,fl_loop/`
        );
        return thumbnail;
      }
    } else if (videoUrl && (videoUrl.startsWith('http://') || videoUrl.startsWith('https://'))) {
      // Для других внешних URL пытаемся получить thumbnail
      if (videoUrl.includes('cloudinary.com')) {
        if (options.forProfile) {
          const thumbnail = videoUrl.replace(
            '/video/upload/',
            `/video/upload/w_${options.width || 300},h_${options.height || 300},c_fill,q_auto,f_jpg,so_0/`
          );
          return thumbnail;
        }
        if (options.animated) {
          const thumbnail = videoUrl.replace(
            '/video/upload/',
            `/video/upload/w_${options.width || 300},c_scale,f_gif,so_0,eo_3,dl_3/`
          );
          return thumbnail;
        }
        
        // Для ленты используем зацикленные 10-секундные GIF с высоким FPS
        const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
        if (isMobile) {
          const thumbnail = videoUrl.replace(
            '/video/upload/',
            `/video/upload/w_400,c_scale,f_gif,so_0,eo_10,fps_30,q_80,fl_loop/`
          );
          return thumbnail;
        } else {
          const thumbnail = videoUrl.replace(
            '/video/upload/',
            `/video/upload/w_400,c_scale,f_gif,so_0,eo_10,fps_30,q_90,fl_loop/`
          );
          return thumbnail;
        }
      }
      return videoUrl; // Возвращаем как есть для внешних URL
    } else if (videoUrl && !videoUrl.startsWith('http')) {
      // Для локальных видео файлов возвращаем placeholder
      return '/video-placeholder.svg';
    }
    
    // Fallback для видео без URL
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