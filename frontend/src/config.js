// API Configuration
export const REMOTE_URL = 'https://krealgram-backend.onrender.com';
export const LOCAL_URL = 'http://localhost:3000';

export let API_URL = REMOTE_URL; // Default to remote

// WebSocket Configuration
export let SOCKET_URL = `wss://${REMOTE_URL.split('://')[1]}`; // Default to remote

export async function checkAndSetApiUrl() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1000); // 1 second timeout

    await fetch(LOCAL_URL, { 
      method: 'HEAD',
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    API_URL = LOCAL_URL;
    SOCKET_URL = `ws://${LOCAL_URL.split('://')[1]}`;
  } catch (error) {
    API_URL = REMOTE_URL;
    SOCKET_URL = `wss://${REMOTE_URL.split('://')[1]}`;
  }
}

export const getBaseUrl = () => {
  // Приоритет: 
  // 1. Явно указанные переменные окружения
  // 2. Vercel
  // 3. Локальный хост
  // 4. Удаленный бэкенд

  if (import.meta.env.VITE_BASE_URL) {
    return import.meta.env.VITE_BASE_URL;
  }

  // Vercel production
  if (import.meta.env.VITE_VERCEL === 'true') {
    return 'https://krealgram-backend.onrender.com';
  }

  // Локальная разработка
  if (window.location.hostname === 'localhost' || 
      window.location.hostname === '127.0.0.1') {
    return LOCAL_URL;
  }

  // Если домен krealgram.com
  if (window.location.hostname === 'krealgram.com') {
    return 'https://krealgram-backend.onrender.com';
  }

  // Fallback к удаленному бэкенду
  return REMOTE_URL;
};

// Call this in App.jsx on mount 