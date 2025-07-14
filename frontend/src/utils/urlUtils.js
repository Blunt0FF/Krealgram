import { resolveMediaUrl, isUrlAllowed } from './mediaUrlResolver';
import { API_URL } from '../config';

/**
 * Универсальная функция для обработки URL с различных источников
 * @param {string|object} url - URL или объект с URL
 * @param {string} type - Тип медиа (image, video, avatar)
 * @returns {string} Обработанный URL
 */
export const processMediaUrl = (url, type = 'image') => {
  console.group(`🔗 processMediaUrl [${type}]`);
  console.log('Input:', { url, type });

  // Если передан объект, извлекаем URL
  if (typeof url === 'object' && url !== null) {
    url = 
      url.imageUrl || 
      url.image || 
      url.thumbnailUrl || 
      url.videoUrl || 
      url.avatarUrl || 
      url.url || 
      null;
  }

  const resolvedUrl = resolveMediaUrl(url, type);
  console.log('✅ Resolved URL:', resolvedUrl);
  console.groupEnd();

  return resolvedUrl;
};

// Алиасы для обратной совместимости
export const getImageUrl = processMediaUrl;
export const getVideoUrl = processMediaUrl;
export const getAvatarUrl = processMediaUrl;

// Дополнительные утилиты
export const isValidUrl = (url) => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

export const sanitizeUrl = (url) => {
  if (!url) return null;
  
  try {
    const parsedUrl = new URL(url);
    return isUrlAllowed(url) ? url : null;
  } catch {
    return null;
  }
}; 