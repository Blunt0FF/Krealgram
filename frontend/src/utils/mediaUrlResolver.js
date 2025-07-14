import { API_URL, getCurrentDomain } from '../config';

const ALLOWED_DOMAINS = [
  'krealgram.com',
  'krealgram.vercel.app',
  'krealgram-backend.onrender.com',
  'drive.google.com',
  'localhost', // Добавляем localhost
  'localhost:3000',
  'localhost:4000'
];

export const resolveMediaUrl = (url, type = 'image') => {
  console.log(`🔗 Resolving ${type} URL`, { 
    url, 
    type, 
    environment: {
      hostname: window.location.hostname,
      protocol: window.location.protocol,
      API_URL: import.meta.env.VITE_API_URL || 'http://localhost:3000'
    }
  });

  // Строгая проверка URL
  if (!url || typeof url !== 'string') {
    console.warn(`❌ Invalid URL for ${type}:`, url);
    return getDefaultUrl(type);
  }

  // Trim и нормализация URL
  const trimmedUrl = url.trim();

  // Специальная обработка Google Drive URL
  if (trimmedUrl.includes('drive.google.com/uc')) {
    console.log('🌐 Processing Google Drive URL:', trimmedUrl);
    return trimmedUrl;
  }

  // Проверка абсолютных URL
  if (/^https?:\/\//i.test(trimmedUrl)) {
    console.log('✅ Absolute URL detected:', trimmedUrl);
    return trimmedUrl;
  }

  // Обработка относительных путей
  if (trimmedUrl.startsWith('/')) {
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
    const fullUrl = `${baseUrl}${trimmedUrl}`;
    console.log('🔗 Constructed full URL:', fullUrl);
    return fullUrl;
  }

  console.warn(`⚠️ Unhandled URL type for ${type}:`, trimmedUrl);
  return getDefaultUrl(type);
};

const getDefaultUrl = (type) => {
  const defaults = {
    'avatar': '/default-avatar.png',
    'image': '/default-post-placeholder.png',
    'video': '/video-placeholder.png'
  };
  
  console.log(`🖼️ Returning default ${type} URL`);
  return defaults[type] || '/default-placeholder.png';
};

export const getImageUrl = (url) => resolveMediaUrl(url, 'image');
export const getVideoUrl = (url) => resolveMediaUrl(url, 'video');
export const getAvatarUrl = (url) => resolveMediaUrl(url, 'avatar');

// Функция для проверки безопасности домена
export const isUrlAllowed = (url) => {
  try {
    const parsedUrl = new URL(url);
    return ALLOWED_DOMAINS.some(domain => {
      // Точное совпадение или поддомен
      return parsedUrl.hostname === domain || 
             parsedUrl.hostname.endsWith(`.${domain}`) ||
             parsedUrl.hostname.includes(domain);
    });
  } catch {
    return false;
  }
}; 