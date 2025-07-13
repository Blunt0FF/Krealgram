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

    await fetch(LOCAL_URL, { // Changed from '/api/health' to root
      method: 'HEAD',
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    API_URL = LOCAL_URL;
    SOCKET_URL = `ws://${LOCAL_URL.split('://')[1]}`;
    console.log('Using local backend');
  } catch (error) {
    API_URL = REMOTE_URL;
    SOCKET_URL = `wss://${REMOTE_URL.split('://')[1]}`;
    console.log('Using remote backend');
  }
}

// Call this in App.jsx on mount" 