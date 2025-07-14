import { API_URL, getCurrentDomain } from '../config';

const ALLOWED_DOMAINS = [
  'krealgram.com',
  'krealgram.vercel.app',
  'krealgram-backend.onrender.com',
  'drive.google.com'
];

export const resolveMediaUrl = (url, type = 'image') => {
  console.group(`🔗 resolveMediaUrl [${type}]`);
  
  // Расширенное логирование
  console.log('🌐 Current Environment:', {
    hostname: window.location.hostname,
    protocol: window.location.protocol,
    API_URL: API_URL,
    currentDomain: getCurrentDomain()
  });

  console.log('Input URL:', url);

  // Если URL пустой - возвращаем дефолтное изображение
  if (!url) {
    const defaultMap = {
      'image': '/default-post-placeholder.png',
      'video': '/video-placeholder.svg',
      'avatar': '/default-avatar.png'
    };
    return defaultMap[type] || '/default-avatar.png';
  }

  // Если уже полный HTTP/HTTPS URL
  if (url.startsWith('http')) {
    // ВСЕГДА проксируем, кроме YouTube
    const youtubeMatchers = [
      /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
      /youtu\.be\/([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/
    ];

    for (const matcher of youtubeMatchers) {
      const match = url.match(matcher);
      if (match) {
        const youtubeId = match[1];
        return `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`;
      }
    }

    // Если это уже полный URL с проксированием
    if (url.includes('/api/proxy-drive/')) {
      return url;
    }

    // Проверяем, что URL с разрешенного домена
    try {
      const parsedUrl = new URL(url);
      
      // Если домен не в списке разрешенных - проксируем
      if (!ALLOWED_DOMAINS.some(domain => parsedUrl.hostname.includes(domain))) {
        console.log(`[MediaUrlResolver] Проксируем URL с домена ${parsedUrl.hostname}`);
        return `${API_URL}/api/proxy-drive/${encodeURIComponent(url)}`;
      }
    } catch (error) {
      console.error('URL parsing error:', error);
      // Если не удалось распарсить URL, проксируем
      return `${API_URL}/api/proxy-drive/${encodeURIComponent(url)}`;
    }

    return url;
  }

  // Локальные пути - ВСЕГДА через прокси
  const localUrlMap = {
    'image': `${API_URL}/api/proxy-drive/${url}`,
    'video': `${API_URL}/api/proxy-drive/${url}`,
    'avatar': `${API_URL}/api/proxy-drive/avatars/${url}`
  };

  return localUrlMap[type];
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