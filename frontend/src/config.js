// config.js

export const REMOTE_URL = import.meta.env.VITE_API_URL || 'https://krealgram-backend.onrender.com';
export const LOCAL_URL = 'http://localhost:3000';

export let API_URL = REMOTE_URL;
export let SOCKET_URL = import.meta.env.VITE_SOCKET_URL || `wss://${REMOTE_URL.split('://')[1]}`;

export function setApiUrl(url) {
  console.log('[CONFIG] Setting API_URL:', url);
  API_URL = url || REMOTE_URL;
  window.API_URL = API_URL;
}

export async function checkAndSetApiUrl() {
  // Проверяем хост для определения среды
  const hostname = window.location.hostname;
  const isLocalhost = ['localhost', '127.0.0.1'].includes(hostname);
  
  // Список разрешенных доменов
  const allowedDomains = [
    'krealgram.com', 
    'www.krealgram.com', 
    'krealgram.vercel.app', 
    'localhost', 
    '127.0.0.1'
  ];

  // Проверяем, что текущий домен разрешен
  const isDomainAllowed = allowedDomains.some(domain => hostname.includes(domain));

  if (!isDomainAllowed) {
    console.warn(`[CONFIG] Домен ${hostname} не разрешен. Используем удаленный URL.`);
    setApiUrl(REMOTE_URL);
    return;
  }
  
  // Если локальная разработка - пытаемся использовать локальный бэкенд
  if (isLocalhost) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1500);

      const response = await fetch(`${LOCAL_URL}/api/auth/ping`, {
        method: 'GET',
        signal: controller.signal
      });

      if (response.ok) {
        console.log('[CONFIG] Local server reachable, using LOCAL_URL');
        setApiUrl(LOCAL_URL);
        SOCKET_URL = `ws://${LOCAL_URL.split('://')[1]}`;
        return;
      }
    } catch (error) {
      console.warn('[CONFIG] Local server not available');
    }
  }

  // Если локальный бэкенд недоступен или это не локальная среда - используем удаленный
  console.log('[CONFIG] Using REMOTE_URL');
  setApiUrl(REMOTE_URL);
  SOCKET_URL = `wss://${REMOTE_URL.split('://')[1]}`;
}

// Добавляем функцию для проверки текущего домена
export function getCurrentDomain() {
  const hostname = window.location.hostname;
  const allowedDomains = {
    'krealgram.com': 'krealgram.com',
    'www.krealgram.com': 'krealgram.com',
    'krealgram.vercel.app': 'krealgram.vercel.app',
    'localhost': 'localhost',
    '127.0.0.1': 'localhost'
  };

  return allowedDomains[hostname] || hostname;
}