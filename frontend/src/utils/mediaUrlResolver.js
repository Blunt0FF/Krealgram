import { API_URL, getCurrentDomain } from '../config';

const ALLOWED_DOMAINS = [
  'krealgram.com',
  'www.krealgram.com',
  'krealgram.vercel.app',
  'localhost',
  'krealgram-backend.onrender.com',
  '127.0.0.1'
];

// Принудительное проксирование через Render только для Google Drive
const RENDER_PROXY_URL = 'https://krealgram-backend.onrender.com/api/proxy-drive/';

export const resolveMediaUrl = (url, type = 'image') => {
  console.group(`🔗 resolveMediaUrl [${type}]`);
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
    // Проксирование ТОЛЬКО для Google Drive
    if (url.includes('drive.google.com')) {
      try {
        const fileId = 
          new URL(url).searchParams.get('id') || 
          url.split('/').pop() || 
          url.match(/\/file\/d\/([^/]+)/)?.[1] ||
          url.match(/\/uc\?id=([^&]+)/)?.[1];
        
        if (fileId) {
          console.log('🔒 Проксирование Google Drive:', fileId);
          return `${RENDER_PROXY_URL}${fileId}`;
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