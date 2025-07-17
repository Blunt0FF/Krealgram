const axios = require('axios');

// Тестовые Google Drive URL
const testUrls = [
  'https://drive.google.com/uc?id=1a2B3c4D5EfG6H7I8J9K0L1M2N3O4P5Q6R7S8T9U0V1W2X3Y4Z5',
  'https://drive.google.com/file/d/1a2B3c4D5EfG6H7I8J9K0L1M2N3O4P5Q6R7S8T9U0V1W2X3Y4Z5/view',
  'https://drive.google.com/open?id=1a2B3c4D5EfG6H7I8J9K0L1M2N3O4P5Q6R7S8T9U0V1W2X3Y4Z5'
];

const API_URL = process.env.API_URL || 'http://localhost:3000';

async function testProxy() {
  console.log('🧪 Тестирование проксирования Google Drive...\n');
  
  for (const url of testUrls) {
    try {
      console.log(`📡 Тестируем URL: ${url}`);
      
      // Извлекаем ID из URL
      const idMatch = url.match(/[?&]id=([^&]+)/) || 
                     url.match(/\/file\/d\/([^/]+)/) ||
                     url.match(/open\?id=([^&]+)/);
      
      if (!idMatch) {
        console.log('❌ Не удалось извлечь ID из URL');
        continue;
      }
      
      const fileId = idMatch[1];
      console.log(`🆔 Извлеченный ID: ${fileId}`);
      
      // Тестируем прокси
      const proxyUrl = `${API_URL}/api/proxy-drive/${fileId}`;
      console.log(`🔗 Прокси URL: ${proxyUrl}`);
      
      const response = await axios.get(proxyUrl, {
        timeout: 10000,
        validateStatus: (status) => status < 500 // Принимаем 404 как валидный ответ
      });
      
      console.log(`✅ Статус: ${response.status}`);
      console.log(`📊 Размер ответа: ${response.data?.length || 0} байт`);
      console.log(`📋 Content-Type: ${response.headers['content-type']}`);
      console.log('---\n');
      
    } catch (error) {
      console.log(`❌ Ошибка: ${error.message}`);
      if (error.response) {
        console.log(`📊 Статус: ${error.response.status}`);
        console.log(`📋 Данные: ${error.response.data}`);
      }
      console.log('---\n');
    }
  }
}

// Запускаем тест
testProxy().catch(console.error); 