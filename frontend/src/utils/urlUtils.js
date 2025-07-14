import { API_URL, ALLOWED_DOMAINS } from '../config';
import { resolveMediaUrl } from './mediaUrlResolver';

export const processMediaUrl = (input) => {
  console.log('🔗 processMediaUrl', input);
  
  const { url, type = 'image' } = input;
  
  if (!url) {
    console.warn('❌ Empty URL provided');
    return resolveMediaUrl('', type);
  }

  console.log('Current API_URL:', API_URL);
  
  // Специальная обработка Google Drive URL
  if (url.includes('drive.google.com/uc')) {
    console.log('🌐 Google Drive URL detected:', url);
    return resolveMediaUrl(url, type);
  }

  // Проверка абсолютных URL
  if (/^https?:\/\//i.test(url)) {
    try {
      const parsedUrl = new URL(url);
      
      // Если домен не в списке разрешенных - проксируем
      if (!ALLOWED_DOMAINS.some(domain => parsedUrl.hostname.includes(domain))) {
        console.log(`🔀 Proxying URL from domain: ${parsedUrl.hostname}`);
        const proxiedUrl = `${API_URL}/api/proxy-drive/${encodeURIComponent(url)}`;
        console.log('✅ Proxied URL:', proxiedUrl);
        return proxiedUrl;
      }
    } catch (error) {
      console.error('URL parsing error:', error);
    }
  }

  // Относительные пути
  if (url.startsWith('/')) {
    const fullUrl = `${API_URL}${url}`;
    console.log('🔗 Constructed full URL:', fullUrl);
    return fullUrl;
  }

  // Если ничего не подошло
  console.warn('⚠️ Unhandled URL:', url);
  return resolveMediaUrl(url, type);
};

export const isValidUrl = (url) => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

export const sanitizeUrl = (url) => {
  if (!url) return '';
  
  try {
    const sanitized = url.trim().replace(/\s+/g, '');
    return isValidUrl(sanitized) ? sanitized : '';
  } catch {
    return '';
  }
}; 