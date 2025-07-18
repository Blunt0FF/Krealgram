const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const API_URL = process.env.API_URL || 'http://localhost:3000';

async function testUpload() {
  console.log('🧪 Тестирование загрузки файлов...\n');
  
  try {
    // Создаем тестовый файл
    const testFilePath = path.join(__dirname, 'test-image.jpg');
    const testImageData = Buffer.from('fake-image-data', 'utf8');
    fs.writeFileSync(testFilePath, testImageData);
    
    console.log('📁 Создан тестовый файл:', testFilePath);
    
    // Создаем FormData
    const formData = new FormData();
    formData.append('image', fs.createReadStream(testFilePath), {
      filename: 'test-image.jpg',
      contentType: 'image/jpeg'
    });
    formData.append('caption', 'Тестовый пост');
    
    console.log('📤 Отправляем запрос на загрузку...');
    
    const response = await axios.post(`${API_URL}/api/posts`, formData, {
      headers: {
        ...formData.getHeaders(),
        'Authorization': 'Bearer YOUR_TOKEN_HERE' // Замените на реальный токен
      },
      timeout: 30000
    });
    
    console.log('✅ Успешная загрузка!');
    console.log('📊 Статус:', response.status);
    console.log('📋 Ответ:', response.data);
    
    // Удаляем тестовый файл
    fs.unlinkSync(testFilePath);
    
  } catch (error) {
    console.error('❌ Ошибка загрузки:', error.message);
    
    if (error.response) {
      console.log('📊 Статус:', error.response.status);
      console.log('📋 Данные:', error.response.data);
    }
    
    // Удаляем тестовый файл в случае ошибки
    const testFilePath = path.join(__dirname, 'test-image.jpg');
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
    }
  }
}

// Проверяем статус Google Drive
async function checkGoogleDriveStatus() {
  console.log('🔍 Проверка статуса Google Drive...\n');
  
  try {
    const response = await axios.get(`${API_URL}/api/proxy-drive/test`, {
      timeout: 10000,
      validateStatus: (status) => status < 500
    });
    
    console.log('✅ Google Drive доступен');
    console.log('📊 Статус:', response.status);
    
  } catch (error) {
    console.log('❌ Google Drive недоступен:', error.message);
    
    if (error.response) {
      console.log('📊 Статус:', error.response.status);
      console.log('📋 Данные:', error.response.data);
    }
  }
}

// Запускаем тесты
async function runTests() {
  await checkGoogleDriveStatus();
  console.log('\n' + '='.repeat(50) + '\n');
  await testUpload();
}

runTests().catch(console.error); 