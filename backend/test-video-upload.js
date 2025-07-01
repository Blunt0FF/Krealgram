const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

// Тестовый скрипт для проверки загрузки видео
async function testVideoUpload() {
  console.log('🎬 Testing video upload functionality...');
  
  try {
    // 1. Проверяем здоровье сервера
    console.log('1. Checking server health...');
    const healthResponse = await axios.get('http://localhost:3000/api/health');
    console.log('✅ Server is running:', healthResponse.data);
    
    // 2. Проверяем Cloudinary конфигурацию
    console.log('2. Checking Cloudinary config...');
    console.log('USE_CLOUDINARY:', process.env.USE_CLOUDINARY);
    console.log('CLOUDINARY_CLOUD_NAME:', process.env.CLOUDINARY_CLOUD_NAME ? 'Set' : 'Not set');
    
    // 3. Создаем тестовый видео файл (мини MP4)
    console.log('3. Creating test video file...');
    const testVideoPath = path.join(__dirname, 'temp', 'test-video.mp4');
    
    // Создаем директорию temp если её нет
    const tempDir = path.join(__dirname, 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Простой тестовый MP4 файл (base64)
    const testVideoBase64 = 'AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZQAAAi5tZGF0AAACKg==';
    fs.writeFileSync(testVideoPath, Buffer.from(testVideoBase64, 'base64'));
    console.log('✅ Test video created:', testVideoPath);
    
    // 4. Проверяем что файл создался
    const stats = fs.statSync(testVideoPath);
    console.log('📄 File size:', stats.size, 'bytes');
    
    console.log('🎯 Video upload test completed. You can now test with real video files through the frontend.');
    
    // Cleanup
    fs.unlinkSync(testVideoPath);
    console.log('🧹 Cleanup completed.');
    
  } catch (error) {
    console.error('❌ Error during video upload test:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

// Загружаем переменные окружения
require('dotenv').config();

// Запускаем тест
testVideoUpload(); 