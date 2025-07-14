import { API_URL } from '../config';

const ALLOWED_DOMAINS = [
  'krealgram.com',
  'krealgram.vercel.app',
  'localhost',
  'krealgram-backend.onrender.com',
  '127.0.0.1'
];

export const resolveMediaUrl = (url, type = 'image') => {
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
    // Google Drive обработка
    if (url.includes('drive.google.com')) {
      try {
        const fileId = new URL(url).searchParams.get('id') || 
                       url.split('/').pop() || 
                       url.match(/\/file\/d\/([^/]+)/)?.[1];
        
        if (fileId) {
          // Используем текущий домен для проксирования
          return `${API_URL}/api/proxy-drive/${fileId}`;
        }
      } catch (error) {
        console.error('Google Drive URL parsing error:', error);
      }
    }

    // YouTube превью
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

    return url;
  }

  // Локальные пути
  const localUrlMap = {
    'image': `${API_URL}/uploads/${url}`,
    'video': `${API_URL}/uploads/${url}`,
    'avatar': `${API_URL}/uploads/avatars/${url}`
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