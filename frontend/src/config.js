// API Configuration - ВСЕГДА используем Render
const getApiUrl = () => {
  // Проверяем локальный бэкенд
  const localBackendUrl = 'http://localhost:3000';
  const productionBackendUrl = 'https://krealgram-backend.onrender.com';

  return new Promise((resolve) => {
    const startTime = Date.now();
    
    fetch(`${localBackendUrl}/api/health`, { 
      method: 'GET', 
      timeout: 5000, // Увеличим таймаут до 5 секунд
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    })
      .then(response => {
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        console.group('🌐 Backend Connection Check');
        console.log(`🔍 Checking local backend: ${localBackendUrl}`);
        console.log(`⏱️ Response time: ${duration}ms`);
        
        if (response.ok) {
          console.log('✅ Local backend is available');
          console.groupEnd();
          resolve(localBackendUrl);
        } else {
          console.log('❌ Local backend not responding');
          console.log('🌍 Falling back to production');
          console.groupEnd();
          resolve(productionBackendUrl);
        }
      })
      .catch((error) => {
        console.group('🌐 Backend Connection Check');
        console.log('❌ Local backend connection failed');
        console.log('Error details:', error.message);
        console.log('🌍 Falling back to production');
        console.groupEnd();
        resolve(productionBackendUrl);
      });
  });
};

// Экспортируем как функцию для динамической загрузки
export const getApiUrlSync = () => {
  const localBackendUrl = 'http://localhost:3000';
  const productionBackendUrl = 'https://krealgram-backend.onrender.com';

  try {
    const storedBackendUrl = localStorage.getItem('BACKEND_URL');
    if (storedBackendUrl) {
      console.log('🔄 Using stored backend URL:', storedBackendUrl);
      return storedBackendUrl;
    }
  } catch {}

  return productionBackendUrl;
};

// Асинхронная инициализация
getApiUrl().then(url => {
  try {
    localStorage.setItem('BACKEND_URL', url);
    console.log('💾 Saved backend URL:', url);
  } catch {}
});

// Экспорт текущего URL
export const API_URL = getApiUrlSync();

// WebSocket Configuration - ВСЕГДА используем Render
export const SOCKET_URL = 'wss://krealgram-backend.onrender.com';

// Other configuration constants can be added here 