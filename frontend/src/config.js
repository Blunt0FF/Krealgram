// config.js

export const REMOTE_URL = import.meta.env.VITE_API_URL || 'https://krealgram-backend.onrender.com';
export const LOCAL_URL = 'http://localhost:3000';

export let API_URL = REMOTE_URL;
export let SOCKET_URL = import.meta.env.VITE_SOCKET_URL || `wss://${REMOTE_URL.split('://')[1]}`;

export function setApiUrl(url) {
  API_URL = url || REMOTE_URL;
  window.API_URL = API_URL;
}

export async function checkAndSetApiUrl() {
  // Проверяем хост для определения среды
  const hostname = window.location.hostname;
  const isLocalhost = ['localhost', '127.0.0.1'].includes(hostname);
  const isKrealgram = ['krealgram.com', 'www.krealgram.com', 'krealgram.vercel.app'].includes(hostname);
  
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
    setApiUrl(REMOTE_URL);
    return;
  }
  
  // Для доменов Krealgram всегда используем удаленный URL
  if (isKrealgram) {
    setApiUrl(REMOTE_URL);
    SOCKET_URL = `wss://${REMOTE_URL.split('://')[1]}`;
    return;
  }

  // Если локальная разработка - пытаемся использовать локальный бэкенд
  if (isLocalhost) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const response = await fetch(`${LOCAL_URL}/api/auth/ping`, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Origin': window.location.origin,
          'Accept': 'application/json'
        }
      });

      clearTimeout(timeoutId);

      const responseBody = await response.json();

      if (response.ok && responseBody.status === 'ok') {
        setApiUrl(LOCAL_URL);
        SOCKET_URL = `ws://${LOCAL_URL.split('://')[1]}`;
        return;
      }
    } catch (error) {
      // Если локальный бэкенд недоступен, явно переключаемся на удаленный
      setApiUrl(REMOTE_URL);
      SOCKET_URL = `wss://${REMOTE_URL.split('://')[1]}`;
      return;
    }
  }

  // Если локальный бэкенд недоступен или это не локальная среда - используем удаленный
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