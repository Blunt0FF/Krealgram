// Утилиты для работы с видео

import { API_URL } from '../config';
import { getBaseUrl } from '../config';

export const getVideoUrl = (videoPath, options = {}) => {
  console.group('🎥 getVideoUrl Debugging');
  
  // Если передан объект, пытаемся извлечь путь
  if (typeof videoPath === 'object' && videoPath !== null) {
    videoPath = 
      videoPath.videoUrl || 
      videoPath.imageUrl || 
      videoPath.image || 
      videoPath.url || 
      '/video-placeholder.png';
  }

  console.log('Input:', { 
    videoPath, 
    type: typeof videoPath, 
    options 
  });

  try {
    if (!videoPath) {
      console.warn('❌ Empty video path, returning default');
      console.groupEnd();
      return '/video-placeholder.png';
    }

    const baseUrl = getBaseUrl();

    // Обработка локальных путей
    if (videoPath.startsWith('/Users/') || videoPath.startsWith('/home/')) {
      const fileName = videoPath.split('/').pop();
      const proxyUrl = `${baseUrl}/uploads/${fileName}`;
      console.log('📁 Constructed local video URL:', proxyUrl);
      console.groupEnd();
      return proxyUrl;
    }
  
    // Улучшенная обработка Google Drive URL
    if (videoPath.includes('drive.google.com')) {
      console.log('🔍 Detected Google Drive URL');
      try {
        const url = new URL(videoPath);
        console.log('URL Object:', {
          href: url.href,
          origin: url.origin,
          pathname: url.pathname,
          search: url.search
        });

        const fileId = 
          url.searchParams.get('id') || 
          url.pathname.split('/').pop() ||
          videoPath.match(/\/file\/d\/([^/]+)/)?.[1];
        
        console.log('Google Drive URL parsing:', { 
          url: videoPath, 
          extractedId: fileId 
        });
        
        if (fileId) {
          const proxyUrl = `${baseUrl}/api/proxy-drive/${fileId}`;
          console.log('✅ Constructed proxy video URL:', proxyUrl);
          console.groupEnd();
          return proxyUrl;
        }
      } catch (e) {
        console.error('❌ Google Drive URL parsing error:', e);
      }
    }

    // Если уже полный URL - возвращаем как есть
    if (videoPath.startsWith('http')) {
      console.log('🌐 Returning full video URL:', videoPath);
      console.groupEnd();
      return videoPath;
    }

    // Локальные пути в uploads
    const localUrl = `${baseUrl}/uploads/${videoPath}`;
    console.log('📂 Constructed uploads video URL:', localUrl);
    console.groupEnd();
    return localUrl;
  } catch (error) {
    console.error('❌ getVideoUrl error:', error);
    console.groupEnd();
    return '/video-placeholder.png';
  }
};

export const getVideoThumbnail = (post, options = {}) => {
  if (!post) return '/video-placeholder.png';

  const { 
    width = 300, 
    height = 300, 
    crop = 'pad', 
    quality = 'auto' 
  } = options;

  // Приоритет: thumbnailUrl, gifPreview, статический плейсхолдер
  if (post.thumbnailUrl) return post.thumbnailUrl;
  if (post.gifPreview) return post.gifPreview;

  return '/video-placeholder.png';
};

export const generateVideoPreview = (videoUrl, options = {}) => {
  if (!videoUrl) return null;

  const { 
    width = 300, 
    height = 300, 
    format = 'gif' 
  } = options;

  // Для Google Drive видео
  if (videoUrl.includes('drive.google.com')) {
    // Логика генерации превью для Google Drive
    return null;
  }

  return null;
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
    // Проверяем тип файла
    const isWebm = videoUrl.includes('.webm');
    
    // Для webm файлов используем fl_animated для правильной обработки
    if (isWebm) {
      const isMobile = window.innerWidth <= 768;
      
      if (isMobile) {
        // Мобильные: простой GIF для webm
        const gifUrl = videoUrl.replace(
          '/video/upload/',
          `/video/upload/w_300,h_300,c_fill,f_gif,fl_animated,q_70/`
        );
        return gifUrl;
      } else {
        // Десктоп: простой GIF для webm
        const gifUrl = videoUrl.replace(
          '/video/upload/',
          `/video/upload/w_400,h_400,c_fill,f_gif,fl_animated,q_80/`
        );
        return gifUrl;
      }
    } else {
      // Для других видео форматов (mp4, mov и т.д.)
      const isMobile = window.innerWidth <= 768;
      
      if (isMobile) {
        // Мобильные: простой GIF без проблемных параметров
        const gifUrl = videoUrl.replace(
          '/video/upload/',
          `/video/upload/w_300,h_300,c_fill,f_gif,q_70/`
        );
        return gifUrl;
      } else {
        // Десктоп: простой GIF без проблемных параметров
        const gifUrl = videoUrl.replace(
          '/video/upload/',
          `/video/upload/w_400,h_400,c_fill,f_gif,q_80/`
        );
        return gifUrl;
      }
    }
  }

  // Для обычных изображений
  return post.image || post.imageUrl || '/video-placeholder.svg';
};

// Получение превью для любого типа медиа (для модалки и фоновых изображений)
export const getMediaThumbnail = (post) => {
  console.log('getMediaThumbnail input:', JSON.stringify(post, null, 2));

  // YouTube превью
  if (post.youtubeData && post.youtubeData.thumbnailUrl) {
    console.log('Using YouTube thumbnail:', post.youtubeData.thumbnailUrl);
    return post.youtubeData.thumbnailUrl;
  }

  // Cloudinary видео превью
  if (post.imageUrl && post.imageUrl.includes('cloudinary.com/') && post.imageUrl.includes('/video/')) {
    const thumbnailUrl = post.imageUrl.replace(
      '/video/upload/', 
      '/video/upload/w_400,c_limit,f_jpg,so_0,q_auto/'
    );
    console.log('Using Cloudinary video thumbnail:', thumbnailUrl);
    return thumbnailUrl;
  }

  // Cloudinary изображение
  if (post.imageUrl && post.imageUrl.includes('cloudinary.com/')) {
    console.log('Using Cloudinary image:', post.imageUrl);
    return post.imageUrl;
  }

  // Google Drive превью
  if (post.imageUrl && post.imageUrl.includes('drive.google.com')) {
    const thumbnailUrl = `${API_URL}/api/proxy-drive/${post.imageUrl.split('id=')[1]}`;
    console.log('Using Google Drive thumbnail:', thumbnailUrl);
    return thumbnailUrl;
  }

  // Fallback превью
  console.log('Using fallback placeholder');
  return '/video-placeholder.svg';
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
  if (videoUrl && videoUrl.includes('cloudinary.com')) {
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
  }

  // Для Google Drive видео
  if (videoUrl && videoUrl.includes('drive.google.com')) {
    try {
      const url = new URL(videoUrl);
      const fileId = url.searchParams.get('id');
      if (fileId) {
        const secureApiUrl = window.location.origin.replace(/^http:/, 'https');
        return `${secureApiUrl}/api/proxy-drive/${fileId}?type=thumbnail`;
      }
    } catch (e) {
      console.error("Invalid Google Drive URL", videoUrl);
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

// Извлечение YouTube ID из различных форматов URL
export const extractYouTubeId = (url) => {
  if (!url) return null;
  
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
  
  return videoId;
}; 