import { resolveMediaUrl, isUrlAllowed } from './mediaUrlResolver';
import { API_URL } from '../config';

/**
 * Универсальная функция для обработки URL с различных источников
 * @param {string|object} url - URL или объект с URL
 * @param {string} type - Тип медиа (image, video, avatar)
 * @returns {string} Обработанный URL
 */
export const processMediaUrl = (url, type = 'image') => {
  // Добавляем более подробное логирование только для сообщений
  const shouldLog = type === 'message';
  
  if (shouldLog) {
    console.group('🖼️ Медиа в сообщении');
    console.log('Входной URL (полный путь):', url);
    console.log('Тип:', type);
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

  // Для сообщений извлекаем только имя файла
  if (type === 'message' && typeof url === 'string') {
    const filename = url.split('/').pop();
    
    if (shouldLog) {
      console.log('Извлеченное имя файла:', filename);
    }
    
    const proxyUrl = `${API_URL}/api/proxy-drive/${process.env.GOOGLE_DRIVE_MESSAGES_FOLDER_ID}/${filename}?type=${type}`;
    
    if (shouldLog) {
      console.log('Proxy URL для сообщения:', proxyUrl);
    }
    
    return proxyUrl;
  }

  const resolvedUrl = resolveMediaUrl(url, type);

  if (shouldLog) {
    console.log('Обработанный URL:', resolvedUrl);
    console.groupEnd();
  }

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