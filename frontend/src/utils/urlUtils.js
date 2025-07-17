import { resolveMediaUrl, isUrlAllowed } from './mediaUrlResolver';
import { API_URL } from '../config';

// Простой кэш для URL
const URL_CACHE = new Map();

/**
 * Универсальная функция для обработки URL с различных источников
 * @param {string|object} url - URL или объект с URL
 * @param {string} type - Тип медиа (image, video, avatar)
 * @returns {string} Обработанный URL
 */
export const processMediaUrl = (url, type = 'image') => {
  // Создаем уникальный ключ кэша
  const cacheKey = JSON.stringify({ url, type });
  
  // Проверяем кэш перед обработкой
  if (URL_CACHE.has(cacheKey)) {
    return URL_CACHE.get(cacheKey);
  }

  // Если передан объект, извлекаем URL
  if (typeof url === 'object' && url !== null) {
    url = 
      url.imageUrl || 
      url.image || 
      url.thumbnailUrl || 
      url.url || 
      null;
  }

  // Для сообщений извлекаем только имя файла и используем проксирование
  if (type === 'message' && typeof url === 'string') {
    // Если это уже полный URL, используем его как есть
    if (url.startsWith('http')) {
      const resolvedUrl = resolveMediaUrl(url, type);
      URL_CACHE.set(cacheKey, resolvedUrl);
      return resolvedUrl;
    }
    
    // Если это локальный путь, извлекаем имя файла
    const filename = url.split('/').pop();
    if (filename && filename !== url) {
      const proxyUrl = `${API_URL}/api/proxy-drive/${encodeURIComponent(filename)}?type=${type}`;
      URL_CACHE.set(cacheKey, proxyUrl);
      return proxyUrl;
    }
  }

  const resolvedUrl = resolveMediaUrl(url, type);

  // Кэшируем результат
  URL_CACHE.set(cacheKey, resolvedUrl);

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
  return urls.map(url => {
    try {
      const resolvedUrl = processMediaUrl(url, type);
      return { 
        original: url, 
        resolved: resolvedUrl,
        success: true 
      };
    } catch (error) {
      return { 
        original: url, 
        resolved: null,
        success: false,
        error: error.message 
      };
    }
  });
}; 