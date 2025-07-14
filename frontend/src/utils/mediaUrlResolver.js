import { API_URL, getCurrentDomain } from '../config';

const ALLOWED_DOMAINS = [
  'krealgram.com',
  'www.krealgram.com',
  'krealgram.vercel.app',
  'localhost',
  'krealgram-backend.onrender.com',
  '127.0.0.1'
];

export const resolveMediaUrl = (url, type = 'image') => {
  console.group(`🔗 resolveMediaUrl [${type}]`);
  console.log('Input URL:', url);

  try {
    // Если URL пустой - возвращаем дефолтное изображение
    if (!url) {
      const defaultMap = {
        'image': '/default-post-placeholder.png',
        'video': '/video-placeholder.svg',
        'avatar': '/default-avatar.png'
      };
      console.log('🚫 Empty URL, returning default', defaultMap[type]);
      return defaultMap[type] || '/default-avatar.png';
    }

    // Если передан объект, извлекаем URL с расширенной отладкой
    if (typeof url === 'object' && url !== null) {
      const urlKeys = [
        'imageUrl', 'image', 'thumbnailUrl', 
        'videoUrl', 'avatarUrl', 'url', 
        'secure_url', 'path'
      ];

      for (const key of urlKeys) {
        if (url[key]) {
          console.log(`🔍 Extracted URL from key '${key}':`, url[key]);
          url = url[key];
          break;
        }
      }
      
      if (typeof url === 'object') {
        console.warn('⚠️ Could not extract URL from object:', url);
        return '/default-avatar.png';
      }
    }

    // Если URL все еще пустой после извлечения
    if (!url) {
      console.warn('⚠️ Could not extract URL');
      return '/default-avatar.png';
    }

    // Если уже полный HTTP/HTTPS URL
    if (url.startsWith('http')) {
      // Google Drive обработка с расширенной отладкой
      if (url.includes('drive.google.com')) {
        try {
          const fileId = 
            new URL(url).searchParams.get('id') || 
            url.split('/').pop() || 
            url.match(/\/file\/d\/([^/]+)/)?.[1] ||
            url.match(/\/uc\?id=([^&]+)/)?.[1];
          
          if (fileId) {
            console.log('🔑 Google Drive FileID:', fileId);
            const proxyUrl = `${API_URL}/api/proxy-drive/${fileId}?type=${type}`;
            console.log('🌐 Proxy URL:', proxyUrl);
            return proxyUrl;
          }
        } catch (error) {
          console.error('❌ Google Drive URL parsing error:', error);
        }
      }

      // YouTube превью с расширенной отладкой
      const youtubeMatchers = [
        /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
        /youtu\.be\/([a-zA-Z0-9_-]{11})/,
        /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/
      ];

      for (const matcher of youtubeMatchers) {
        const match = url.match(matcher);
        if (match) {
          const youtubeId = match[1];
          const youtubePreviewUrl = `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`;
          console.log('📺 YouTube Preview URL:', youtubePreviewUrl);
          return youtubePreviewUrl;
        }
      }

      // Проверяем, что URL с разрешенного домена
      try {
        const parsedUrl = new URL(url);
        const currentDomain = getCurrentDomain();
        
        // Если текущий домен не совпадает с доменом URL, используем проксирование
        if (!ALLOWED_DOMAINS.some(domain => parsedUrl.hostname.includes(domain))) {
          console.log(`🌍 Proxying URL from domain: ${parsedUrl.hostname}`);
          const proxyUrl = `${API_URL}/api/proxy-drive/${encodeURIComponent(url)}?type=${type}`;
          console.log('🔀 Proxy URL:', proxyUrl);
          return proxyUrl;
        }
      } catch (error) {
        console.warn('⚠️ URL parsing error:', error);
      }

      console.log('✅ Returning original URL:', url);
      return url;
    }

    // Локальные пути с расширенной отладкой
    const localUrlMap = {
      'image': `${API_URL}/uploads/${url}`,
      'video': `${API_URL}/uploads/${url}`,
      'avatar': `${API_URL}/uploads/avatars/${url}`
    };

    const localUrl = localUrlMap[type];
    console.log('📁 Local URL:', localUrl);
    return localUrl;

  } catch (error) {
    console.error('❌ Critical error in resolveMediaUrl:', error);
    return '/default-avatar.png';
  } finally {
    console.groupEnd();
  }
};

export const getImageUrl = (url) => resolveMediaUrl(url, 'image');
export const getVideoUrl = (url) => resolveMediaUrl(url, 'video');
export const getAvatarUrl = (url) => resolveMediaUrl(url, 'avatar');

// Функция для проверки безопасности домена
export const isUrlAllowed = (url) => {
  try {
    const parsedUrl = new URL(url);
    return ALLOWED_DOMAINS.some(domain => 
      parsedUrl.hostname.includes(domain)
    );
  } catch {
    return false;
  }
}; 