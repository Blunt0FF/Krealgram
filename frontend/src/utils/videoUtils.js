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

// Получение GIF превью ТОЛЬКО для профиля
export const getProfileGifThumbnail = (post, options = {}) => {
  if (!post) return '/video-placeholder.svg';

  // YouTube видео - возвращаем статичный thumbnail
  if (post.youtubeData && post.youtubeData.thumbnailUrl) {
    return post.youtubeData.thumbnailUrl;
  }

  // Проверяем YouTube URL в разных полях
  const checkYouTubeUrl = (url) => {
    if (!url) return null;
    
    // Улучшенная регулярка для YouTube URL
    let videoId = null;
    
    // Стандартный YouTube URL
    if (url.includes('youtube.com/watch?v=')) {
      const match = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
      videoId = match ? match[1] : null;
    }
    // Короткий YouTube URL
    else if (url.includes('youtu.be/')) {
      const match = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
      videoId = match ? match[1] : null;
    }
    // Embed URL
    else if (url.includes('youtube.com/embed/')) {
      const match = url.match(/embed\/([a-zA-Z0-9_-]{11})/);
      videoId = match ? match[1] : null;
    }
    
    return videoId;
  };

  // Проверяем все возможные поля с YouTube URL
  const youtubeId = checkYouTubeUrl(post.videoUrl) || 
                   checkYouTubeUrl(post.youtubeUrl) || 
                   checkYouTubeUrl(post.video) ||
                   checkYouTubeUrl(post.image) ||
                   checkYouTubeUrl(post.imageUrl);

  if (youtubeId) {
    return `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`;
  }

  // Для Cloudinary видео создаем GIF превью
  const videoUrl = post.videoUrl || post.video || post.image || post.imageUrl;
  if (videoUrl && videoUrl.includes('cloudinary.com')) {
    // GIF на всю длину видео
    const isMobile = window.innerWidth <= 768;
    
    if (isMobile) {
      // Мобильные: полная длина, низкий FPS для экономии трафика
      const gifUrl = videoUrl.replace(
        '/video/upload/',
        `/video/upload/w_300,c_scale,f_gif,fps_12,q_70/`
      );
      return gifUrl;
    } else {
      // Десктоп: полная длина, хороший FPS
      const gifUrl = videoUrl.replace(
        '/video/upload/',
        `/video/upload/w_400,c_scale,f_gif,fps_18,q_80/`
      );
      return gifUrl;
    }
  }

  // Для обычных изображений
  return post.image || post.imageUrl || '/video-placeholder.svg';
};

// Получение превью для любого типа медиа (для модалки и фоновых изображений)
export const getMediaThumbnail = (post, options = {}) => {
  if (!post) return '/video-placeholder.svg';

  // YouTube видео - проверяем все возможные источники
  if (post.youtubeData && post.youtubeData.thumbnailUrl) {
    return post.youtubeData.thumbnailUrl;
  }

  // Видео URL напрямую
  if (post.videoUrl) {
    // YouTube URL - улучшенная проверка
    let youtubeId = null;
    
    // Стандартный YouTube URL
    if (post.videoUrl.includes('youtube.com/watch?v=')) {
      const match = post.videoUrl.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
      youtubeId = match ? match[1] : null;
    }
    // Короткий YouTube URL
    else if (post.videoUrl.includes('youtu.be/')) {
      const match = post.videoUrl.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
      youtubeId = match ? match[1] : null;
    }
    // Embed URL
    else if (post.videoUrl.includes('youtube.com/embed/')) {
      const match = post.videoUrl.match(/embed\/([a-zA-Z0-9_-]{11})/);
      youtubeId = match ? match[1] : null;
    }
    
    if (youtubeId) {
      // Используем maxresdefault для лучшего качества, fallback на hqdefault
      const thumbnail = `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`;
      return thumbnail;
    }
    
    // Для внешних видео возвращаем placeholder
    return '/video-placeholder.svg';
  }

  // Для загруженных видео - используем GIF на мобильных и JPG на десктопе
  const videoUrl = post.videoUrl || post.video || post.image || post.imageUrl;
  if (videoUrl && videoUrl.includes('cloudinary.com')) {
    const isMobile = window.innerWidth <= 768;
    
    if (isMobile) {
      // На мобильных используем полную длину GIF для лучшей совместимости
      const thumbnail = videoUrl.replace(
        '/video/upload/',
        `/video/upload/w_${options.width || 300},c_scale,f_gif,fps_12,q_70/`
      );
      return thumbnail;
    } else {
      // На десктопе используем статичное JPG превью
      const thumbnail = videoUrl.replace(
        '/video/upload/',
        `/video/upload/w_${options.width || 400},c_scale,f_jpg,so_0,q_auto/`
      );
      return thumbnail;
    }
  }

  // Возвращаем оригинальное изображение или placeholder
  return post.image || post.imageUrl || '/video-placeholder.svg';
};

// Получение GIF превью для VideoPreview в ленте
export const getVideoPreviewThumbnail = (post, options = {}) => {
  if (!post) return '/video-placeholder.svg';

  // YouTube видео - возвращаем статичный thumbnail
  if (post.youtubeData && post.youtubeData.thumbnailUrl) {
    return post.youtubeData.thumbnailUrl;
  }

  // Проверяем YouTube URL в разных полях
  const checkYouTubeUrl = (url) => {
    if (!url) return null;
    
    // Улучшенная регулярка для YouTube URL
    let videoId = null;
    
    // Стандартный YouTube URL
    if (url.includes('youtube.com/watch?v=')) {
      const match = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
      videoId = match ? match[1] : null;
    }
    // Короткий YouTube URL
    else if (url.includes('youtu.be/')) {
      const match = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
      videoId = match ? match[1] : null;
    }
    // Embed URL
    else if (url.includes('youtube.com/embed/')) {
      const match = url.match(/embed\/([a-zA-Z0-9_-]{11})/);
      videoId = match ? match[1] : null;
    }
    
    return videoId;
  };

  const youtubeId = checkYouTubeUrl(post.videoUrl) || 
                   checkYouTubeUrl(post.youtubeUrl) || 
                   checkYouTubeUrl(post.video) ||
                   checkYouTubeUrl(post.image) ||
                   checkYouTubeUrl(post.imageUrl);

  if (youtubeId) {
    return `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`;
  }

  // Для загруженных видео создаем GIF превью для ленты
  const videoUrl = post.videoUrl || post.video || post.image || post.imageUrl;
  if (videoUrl && videoUrl.includes('cloudinary.com')) {
    // GIF на всю длину видео
    const isMobile = window.innerWidth <= 768;
    
    if (isMobile) {
      // Мобильные: полная длина, низкий FPS для экономии трафика
      const gifUrl = videoUrl.replace(
        '/video/upload/',
        `/video/upload/w_300,c_scale,f_gif,fps_12,q_70/`
      );
      return gifUrl;
    } else {
      // Десктоп: полная длина, хороший FPS
      const gifUrl = videoUrl.replace(
        '/video/upload/',
        `/video/upload/w_400,c_scale,f_gif,fps_18,q_80/`
      );
      return gifUrl;
    }
  }

  // Для обычных изображений
  return post.image || post.imageUrl || '/video-placeholder.svg';
};

// Создание встраиваемого URL для YouTube с базовыми параметрами
export const createYouTubeEmbedUrl = (url) => {
  if (!url) return url;
  
  // Улучшенная проверка YouTube URL
  let videoId = null;
  
  // Стандартный YouTube URL
  if (url.includes('youtube.com/watch?v=')) {
    const match = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
    videoId = match ? match[1] : null;
  }
  // Короткий YouTube URL
  else if (url.includes('youtu.be/')) {
    const match = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
    videoId = match ? match[1] : null;
  }
  // Embed URL
  else if (url.includes('youtube.com/embed/')) {
    const match = url.match(/embed\/([a-zA-Z0-9_-]{11})/);
    videoId = match ? match[1] : null;
  }
  
  if (videoId) {
    // Добавляем базовые параметры для стабильной работы
    const params = new URLSearchParams({
      'rel': '0',                   // Не показывать похожие видео
      'modestbranding': '1',        // Убираем брендинг YouTube
      'playsinline': '1',           // Воспроизведение inline
      'controls': '1',              // Показываем контролы
      'autoplay': '0'               // Не автовоспроизведение
    });
    
    return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
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