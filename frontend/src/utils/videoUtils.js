import { processMediaUrl } from './urlUtils';

// Утилиты для работы с видео

// Получение thumbnail для видео
export const getVideoThumbnail = (videoUrl, options = {}) => {
  // Возвращаем оригинальный URL, если нет специальной обработки
    return videoUrl;
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
  
  return '/video-placeholder.svg';
};

// Получение GIF превью ТОЛЬКО для профиля
export const getProfileGifThumbnail = (post) => {
  // Используем processMediaUrl для получения превью
  return processMediaUrl(post, 'video');
};

// Получение превью для любого типа медиа (для модалки и фоновых изображений)
export const getMediaThumbnail = (post) => {
  if (!post) return '/video-placeholder.svg';

  // Приоритет: новые поля с backend для мобильных превью
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

  // Проверяем YouTube URL
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
    return `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`;
  }

  // Для Google Drive видео
  if (post.videoUrl && post.videoUrl.includes('drive.google.com')) {
    try {
      const url = new URL(post.videoUrl);
      const fileId = url.searchParams.get('id') || 
                     post.videoUrl.split('/').pop() || 
                     post.videoUrl.match(/\/file\/d\/([^/]+)/)?.[1];
      
      if (fileId) {
        const secureApiUrl = window.location.origin.replace(/^http:/, 'https');
        return `${secureApiUrl}/api/proxy-drive/${fileId}?type=thumbnail`;
      }
    } catch (e) {
      console.error("Invalid Google Drive URL", {
        videoUrl: post.videoUrl,
        error: e.message
      });
    }
  }

  // Для изображений
  return post.imageUrl || post.image || '/video-placeholder.svg';
};

// Получение GIF превью для VideoPreview в ленте
export const getVideoPreviewThumbnail = (post, options = {}) => {
  if (!post) return '/video-placeholder.svg';

  // Приоритет: новые поля с backend для мобильных превью
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

  // Проверяем YouTube URL
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
    return `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`;
  }

  // Для загруженных видео создаем GIF превью для ленты
  const videoUrl = post.videoUrl || post.video || post.image || post.imageUrl;
  
  // Для Google Drive видео
  if (videoUrl && videoUrl.includes('drive.google.com')) {
    try {
      const url = new URL(videoUrl);
      const fileId = url.searchParams.get('id') || 
                     videoUrl.split('/').pop() || 
                     videoUrl.match(/\/file\/d\/([^/]+)/)?.[1];
      
      if (fileId) {
        const secureApiUrl = window.location.origin.replace(/^http:/, 'https');
        
        // Приоритет: thumbnail, затем первый кадр
        return `${secureApiUrl}/api/proxy-drive/${fileId}?type=thumbnail,first_frame`;
      }
    } catch (e) {
      console.error("Invalid Google Drive URL", {
        videoUrl: videoUrl,
        error: e.message
      });
    }
  }

    // Проверяем тип файла
    const isWebm = videoUrl.includes('.webm');
    
    // Для webm файлов используем fl_animated для правильной обработки
    if (isWebm) {
      const isMobile = window.innerWidth <= 900;
      
      if (isMobile) {
        // Мобильные: простой GIF для webm
        const gifUrl = videoUrl.replace(
          '/video/upload/',
          `/video/upload/w_300,c_scale,f_gif,fl_animated,q_70/`
        );
        return gifUrl;
      } else {
        // Десктоп: простой GIF для webm
        const gifUrl = videoUrl.replace(
          '/video/upload/',
          `/video/upload/w_400,c_scale,f_gif,fl_animated,q_80/`
        );
        return gifUrl;
      }
    } else {
      // Для других видео форматов (mp4, mov и т.д.)
      const isMobile = window.innerWidth <= 900;
      
      if (isMobile) {
        // Мобильные: простой GIF без проблемных параметров
        const gifUrl = videoUrl.replace(
          '/video/upload/',
          `/video/upload/w_300,c_scale,f_gif,q_70/`
        );
        return gifUrl;
      } else {
        // Десктоп: простой GIF без проблемных параметров
        const gifUrl = videoUrl.replace(
          '/video/upload/',
          `/video/upload/w_400,c_scale,f_gif,q_80/`
        );
        return gifUrl;
    }
  }

  return '/video-placeholder.svg';
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

// Создание данных YouTube для модальных окон
export const createYouTubeData = (url) => {
  const youtubeId = extractYouTubeId(url);
  if (!youtubeId) return null;

  return {
    videoId: youtubeId,
    thumbnailUrl: `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`,
    embedUrl: `https://www.youtube.com/embed/${youtubeId}`
  };
};

// Извлечение YouTube ID из различных форматов URL
export const extractYouTubeId = (url) => {
  const youtubeMatchers = [
    /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/
  ];

  for (const matcher of youtubeMatchers) {
    const match = url.match(matcher);
    if (match) return match[1];
  }
  return null;
}; 

export const generateVideoPreviewUrl = (videoPath) => {
  // Используем processMediaUrl для получения превью
  return processMediaUrl(videoPath, 'video');
}; 