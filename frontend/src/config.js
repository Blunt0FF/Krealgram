const isDevelopment = import.meta.env.DEV;

// API Configuration
export const API_URL = isDevelopment ? 'http://localhost:3000' : 'https://krealgram-backend.onrender.com';

// WebSocket Configuration  
export const SOCKET_URL = isDevelopment ? 'ws://localhost:3000' : 'wss://krealgram-backend.onrender.com';

// Other configuration constants can be added here 