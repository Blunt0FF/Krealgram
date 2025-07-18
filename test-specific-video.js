const axios = require('axios');

// Тестируем конкретные видео ID из логов
const videoIds = [
  '1oGGepcWXhr9kISLTCB7Ge4s21XFLNA_P', // dance.mp4 (работает)
  '1JxjbX6fuUTqpYmZE7fIAYSwOLjE6ShQY'  // thumb_151-m2jDw-AJPec.webp (превью)
];

async function testSpecificVideos() {
  console.log('🧪 Тестируем конкретные видео ID...\n');
  
  for (const videoId of videoIds) {
    try {
      console.log(`📹 Тестируем видео ID: ${videoId}`);
      
      // Тест 1: Прямой доступ к Google Drive
      console.log('  1️⃣ Прямой доступ к Google Drive...');
      try {
        const directUrl = `https://drive.google.com/uc?export=download&id=${videoId}`;
        const directResponse = await axios.get(directUrl, {
          timeout: 10000,
          validateStatus: (status) => status < 500
        });
        console.log(`     ✅ Статус: ${directResponse.status}`);
        console.log(`     📊 Content-Type: ${directResponse.headers['content-type']}`);
        console.log(`     📏 Размер: ${directResponse.data?.length || 0} байт`);
      } catch (error) {
        console.log(`     ❌ Ошибка: ${error.message}`);
      }
      
      // Тест 2: Проксирование через наш сервер
      console.log('  2️⃣ Проксирование через наш сервер...');
      try {
        const proxyUrl = `http://localhost:3000/api/proxy-drive/${videoId}?type=video`;
        const proxyResponse = await axios.get(proxyUrl, {
          timeout: 10000,
          validateStatus: (status) => status < 500
        });
        console.log(`     ✅ Статус: ${proxyResponse.status}`);
        console.log(`     📊 Content-Type: ${proxyResponse.headers['content-type']}`);
        console.log(`     📏 Размер: ${proxyResponse.data?.length || 0} байт`);
      } catch (error) {
        console.log(`     ❌ Ошибка: ${error.message}`);
        if (error.response) {
          console.log(`     📊 Статус: ${error.response.status}`);
          console.log(`     📋 Данные: ${error.response.data}`);
        }
      }
      
      // Тест 3: Метаданные
      console.log('  3️⃣ Метаданные файла...');
      try {
        const metaUrl = `http://localhost:3000/api/proxy-drive/${videoId}`;
        const metaResponse = await axios.head(metaUrl, {
          timeout: 10000,
          validateStatus: (status) => status < 500
        });
        console.log(`     ✅ Статус: ${metaResponse.status}`);
        console.log(`     📊 Content-Type: ${metaResponse.headers['content-type']}`);
        console.log(`     📏 Content-Length: ${metaResponse.headers['content-length']}`);
      } catch (error) {
        console.log(`     ❌ Ошибка: ${error.message}`);
      }
      
      console.log('  ---\n');
      
    } catch (error) {
      console.error(`❌ Общая ошибка для ${videoId}:`, error.message);
    }
  }
}

testSpecificVideos(); 