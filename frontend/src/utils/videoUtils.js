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
  
  // Приоритет: новые поля с backend -> старые поля -> placeholder
  if (post.mobileThumbnailUrl) {
    return post.mobileThumbnailUrl;
  }
  
  if (post.thumbnailUrl) {
    return post.thumbnailUrl;
  }
  
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

// Универсальная функция получения GIF превью
const getUniversalGifThumbnail = (videoUrl, maxDuration = 30) => {
  if (!videoUrl) return null;

  // Проверяем, что это Google Drive URL
  if (videoUrl.includes('drive.google.com')) {
    // Для Google Drive используем оригинальный URL как превью
    return videoUrl;
  }

  // Fallback, если URL не распознан
  return null;
};

// Получение GIF превью ТОЛЬКО для профиля
export const getProfileGifThumbnail = (post, options = {}) => {
  if (!post) return '/video-placeholder.svg';

  // Приоритет: GIF-превью от бэкенда с полной длиной
  if (post.gifPreview) {
    return post.gifPreview;
  }

  // YouTube видео - возвращаем статичный thumbnail
  if (post.youtubeData && post.youtubeData.thumbnailUrl) {
    return post.youtubeData.thumbnailUrl;
  }

  // Для видео создаем универсальный GIF
  const videoUrl = post.videoUrl || post.video || post.image || post.imageUrl;
  const universalGif = getUniversalGifThumbnail(videoUrl, 30);
  
  return universalGif || post.image || post.imageUrl || '/video-placeholder.svg';
};

// Получение превью для модального окна
export const getModalVideoThumbnail = (post, options = {}) => {
  if (!post) return '/video-placeholder.svg';

  // Приоритет: thumbnail URL, YouTube thumbnail, Cloudinary статичное превью
  if (post.thumbnailUrl) return post.thumbnailUrl;

  // YouTube видео - возвращаем статичный thumbnail
  if (post.youtubeData && post.youtubeData.thumbnailUrl) {
    return post.youtubeData.thumbnailUrl;
  }

  // Проверяем YouTube URL в разных полях
  const checkYouTubeUrl = (url) => {
    if (!url) return null;
    
    let videoId = null;
    
    if (url.includes('youtube.com/watch?v=')) {
      const match = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
      videoId = match ? match[1] : null;
    }
    else if (url.includes('youtu.be/')) {
      const match = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
      videoId = match ? match[1] : null;
    }
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

  // Для Cloudinary видео создаем статичное JPG превью
  const videoUrl = post.videoUrl || post.video || post.image || post.imageUrl;
  if (videoUrl && videoUrl.includes('cloudinary.com')) {
    return videoUrl.replace(
      '/video/upload/',
      `/video/upload/w_800,c_scale,f_jpg,so_0,q_auto/`
    );
  }

  // Для обычных изображений
  return post.image || post.imageUrl || '/video-placeholder.svg';
};

export const getMediaThumbnail = (post, options = {}) => {
  if (!post) return '/video-placeholder.svg';

  // Приоритет: новые поля с backend
  if (post.thumbnailUrl) {
    return post.thumbnailUrl;
  }
  
  if (post.mobileThumbnailUrl) {
    return post.mobileThumbnailUrl;
  }

  // YouTube видео - проверяем все возможные источники
  if (post.youtubeData && post.youtubeData.thumbnailUrl) {
    return post.youtubeData.thumbnailUrl;
  }

  // YouTube URL - улучшенная проверка
  let youtubeId = null;
  
  if (post.videoUrl) {
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
  }
  
  if (youtubeId) {
    // Используем maxresdefault для лучшего качества
    return `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`;
  }

  // Для загруженных видео возвращаем статичное JPG превью
  const videoUrl = post.videoUrl || post.video || post.image || post.imageUrl;
  if (videoUrl && videoUrl.includes('cloudinary.com')) {
    return videoUrl.replace(
      '/video/upload/',
      `/video/upload/w_400,c_scale,f_jpg,so_0,q_auto/`
    );
  }

  return '/video-placeholder.svg';
};

// Получение превью для любого типа медиа (для модалки и фоновых изображений)
export const getVideoPreviewThumbnail = (post, options = {}) => {
  if (!post) return '/video-placeholder.svg';

  // Приоритет: GIF-превью от бэкенда с полной длиной
  if (post.gifPreview) {
    return post.gifPreview;
  }

  // Приоритет: новые поля с backend для превью
  if (post.mobileThumbnailUrl) {
    return post.mobileThumbnailUrl;
  }
  
  if (post.thumbnailUrl) {
    return post.thumbnailUrl;
  }

  // YouTube видео - возвращаем статичный thumbnail
  if (post.youtubeData && post.youtubeData.thumbnailUrl) {
    return post.youtubeData.thumbnailUrl;
  }

  // Для загруженных видео создаем универсальный GIF
  const videoUrl = post.videoUrl || post.video || post.image || post.imageUrl;
  const universalGif = getUniversalGifThumbnail(videoUrl, 30);
  
  return universalGif || '/video-placeholder.svg';
};

// Создание встраиваемого URL для YouTube
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
    return `https://www.youtube.com/embed/${videoId}`;
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

export const createYouTubeData = (url) => {
  const videoId = extractYouTubeId(url);
  if (!videoId) return null;
  
  return {
    type: 'video',
    youtubeId: videoId,
    embedUrl: `https://www.youtube.com/embed/${videoId}`,
    thumbnailUrl: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
    originalUrl: url
  };
};

export const extractYouTubeId = (url) => {
  const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const match = url.match(youtubeRegex);
  return match ? match[1] : null;
}; 