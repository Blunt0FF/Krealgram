// config.js

export const REMOTE_URL = 'https://krealgram-backend.onrender.com';
export const LOCAL_URL = 'http://localhost:3000';
export const API_URL = REMOTE_URL;

export function getApiUrl() {
  return API_URL;
}

export function setApiUrl(url) {
  // Заглушка для обратной совместимости
  console.warn('setApiUrl is deprecated');
}

export async function checkAndSetApiUrl() {
  // Всегда возвращаем Render URL
  return REMOTE_URL;
}

export const ALLOWED_DOMAINS = [
  'krealgram.com', 
  'krealgram.vercel.app', 
  'krealgram-backend.onrender.com',
  'localhost', 
  'localhost:3000', 
  'localhost:4000'
];

export const SOCKET_URL = `wss://${REMOTE_URL.split('://')[1]}`;

// Добавляем функцию для проверки текущего домена
export function getCurrentDomain() {
  const hostname = window.location.hostname;
  const allowedDomains = {
    'krealgram.com': 'krealgram.com',
    'krealgram.vercel.app': 'krealgram.vercel.app'
  };

  return allowedDomains[hostname] || hostname;
}