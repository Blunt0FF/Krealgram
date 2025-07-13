// API Configuration
export const REMOTE_URL = 'https://krealgram-backend.onrender.com';
export const LOCAL_URL = 'http://localhost:3000';

export let API_URL = REMOTE_URL; // Default to remote

// WebSocket Configuration
export let SOCKET_URL = `wss://${REMOTE_URL.split('://')[1]}`; // Default to remote

export const getBaseUrl = () => {
  // Приоритет определения базового URL
  if (import.meta.env.VITE_BASE_URL) {
    return import.meta.env.VITE_BASE_URL;
  }

  // Vercel и krealgram.com
  if (window.location.hostname === 'krealgram.com' || 
      window.location.hostname === 'www.krealgram.com') {
    return 'https://krealgram-backend.onrender.com';
  }

  // Локальная разработка
  if (window.location.hostname === 'localhost' || 
      window.location.hostname === '127.0.0.1') {
    return LOCAL_URL;
  }

  // Fallback к удаленному бэкенду
  return REMOTE_URL;
};

export async function checkAndSetApiUrl() {
  // Добавляем статическую переменную для отслеживания вызова
  if (checkAndSetApiUrl.called) return;
  checkAndSetApiUrl.called = true;

  try {
    const baseUrl = getBaseUrl();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // Увеличено время ожидания до 5 секунд

    // Проверяем доступность базового URL
    const response = await fetch(`${baseUrl}/api/health`, { 
      method: 'GET',
      signal: controller.signal,
      headers: {
        'Origin': window.location.origin
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const healthData = await response.json();
    console.log('[API Health]', healthData);

    clearTimeout(timeoutId);
    API_URL = baseUrl;
    SOCKET_URL = baseUrl.startsWith('https') 
      ? `wss://${baseUrl.split('://')[1]}` 
      : `ws://${baseUrl.split('://')[1]}`;
  } catch (error) {
    console.warn('Не удалось установить API URL, используем удаленный:', REMOTE_URL, error);
    API_URL = REMOTE_URL;
    SOCKET_URL = `wss://${REMOTE_URL.split('://')[1]}`;
  }
}

// Call this in App.jsx on mount 