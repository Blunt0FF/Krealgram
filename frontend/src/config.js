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
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1000);

    await fetch(`${LOCAL_URL}/api/auth/ping`, {
      method: 'GET',
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    console.log('[CONFIG] Local server reachable, switching to LOCAL_URL');
    setApiUrl(LOCAL_URL);
    SOCKET_URL = `ws://${LOCAL_URL.split('://')[1]}`;
  } catch (error) {
    console.warn('[CONFIG] Local server not available, using REMOTE_URL');
    setApiUrl(REMOTE_URL);
    SOCKET_URL = `wss://${REMOTE_URL.split('://')[1]}`;
  }
}