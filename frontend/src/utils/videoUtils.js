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

// Функция для извлечения Google Drive File ID из различных форматов URL
const extractGoogleDriveFileId = (url) => {
  if (!url || !url.includes('drive.google.com')) return null;
  
  try {
    // Формат: https://drive.google.com/uc?id=FILE_ID
    const ucMatch = url.match(/[?&]id=([^&]+)/);
    if (ucMatch) return ucMatch[1];
    
    // Формат: https://drive.google.com/file/d/FILE_ID/view
    const fileMatch = url.match(/\/file\/d\/([^/]+)/);
    if (fileMatch) return fileMatch[1];
    
    // Формат: https://drive.google.com/open?id=FILE_ID
    const openMatch = url.match(/open\?id=([^&]+)/);
    if (openMatch) return openMatch[1];
    
    // Если URL заканчивается на FILE_ID
    const parts = url.split('/');
    const lastPart = parts[parts.length - 1];
    if (lastPart && lastPart.length > 20 && !lastPart.includes('.')) {
      return lastPart;
    }
    
    return null;
  } catch (error) {
    console.error('Ошибка извлечения Google Drive ID:', error);
    return null;
  }
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
    const fileId = extractGoogleDriveFileId(post.videoUrl);
      
      if (fileId) {
        const secureApiUrl = window.location.origin.replace(/^http:/, 'https');
        return `${secureApiUrl}/api/proxy-drive/${fileId}?type=thumbnail`;
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
    const fileId = extractGoogleDriveFileId(videoUrl);
      
      if (fileId) {
        const secureApiUrl = window.location.origin.replace(/^http:/, 'https');
        
        // Приоритет: thumbnail, затем первый кадр
        return `${secureApiUrl}/api/proxy-drive/${fileId}?type=thumbnail,first_frame`;
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
  const videoId = extractYouTubeId(url);
  
  if (!videoId) return url;
  
  // Создаем embed URL с дополнительными параметрами
  return `https://www.youtube.com/embed/${videoId}?` + 
         'enablejsapi=1' +
         '&origin=' + encodeURIComponent(window.location.origin) +
         '&rel=0' +
         '&showinfo=0' +
         '&modestbranding=1' +
         '&iv_load_policy=3' +
         '&disablekb=1' +
         '&autoplay=0' +
         '&controls=1';
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
  if (!url) return null;

  const videoId = extractYouTubeId(url);
  if (!videoId) return null;

  return {
    videoId,
    embedUrl: `https://www.youtube.com/embed/${videoId}`,
    thumbnailUrl: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
    mobileThumbnailUrl: `https://img.youtube.com/vi/${videoId}/default.jpg`,
    platform: 'youtube',
    originalUrl: url
  };
};

// Извлечение YouTube ID из различных форматов URL
export const extractYouTubeId = (url) => {
  if (!url) return null;
  
  // Массив регулярных выражений для разных форматов YouTube URL
  const patterns = [
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)([a-zA-Z0-9_-]{11})/,
    /(?:https?:\/\/)?youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /(?:https?:\/\/)?img\.youtube\.com\/vi\/([a-zA-Z0-9_-]{11})/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
  }
  }

  return null;
}; 

export const generateVideoPreviewUrl = (videoPath) => {
  // Используем processMediaUrl для получения превью
  return processMediaUrl(videoPath, 'video');
}; 