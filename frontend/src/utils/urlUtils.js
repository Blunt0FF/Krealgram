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

// Функция для тестирования обработки URL
export const testMediaUrlResolution = (urls, type = 'image') => {
  console.group('🔍 URL Resolution Test');
  console.log('Test URLs:', urls);
  console.log('Media Type:', type);

  const results = urls.map(url => {
    try {
      const resolvedUrl = processMediaUrl(url, type);
      console.log(`URL: ${url} → Resolved: ${resolvedUrl}`);
      return { 
        original: url, 
        resolved: resolvedUrl,
        success: true 
      };
    } catch (error) {
      console.error(`Error resolving URL: ${url}`, error);
      return { 
        original: url, 
        resolved: null,
        success: false,
        error: error.message 
      };
    }
  });

  console.log('Resolution Results:', results);
  console.groupEnd();

  return results;
}; 