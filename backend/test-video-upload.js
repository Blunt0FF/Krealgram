require('dotenv').config();

const fs = require('fs');
const path = require('path');
const googleDrive = require('./config/googleDrive');

// Тестовый скрипт для проверки загрузки видео и GIF-превью
async function testVideoUpload() {
  try {
    console.log('🧪 Тестируем загрузку видео и GIF-превью...');
    
    // Инициализируем Google Drive
    await googleDrive.initialize();
    console.log('✅ Google Drive инициализирован');
    
    // Проверяем переменные окружения
    console.log('📁 Папки Google Drive:');
    console.log('- VIDEOS:', process.env.GOOGLE_DRIVE_VIDEOS_FOLDER_ID);
    console.log('- GIFS:', process.env.GOOGLE_DRIVE_GIFS_FOLDER_ID);
    console.log('- PREVIEWS:', process.env.GOOGLE_DRIVE_PREVIEWS_FOLDER_ID);
    console.log('- POSTS:', process.env.GOOGLE_DRIVE_POSTS_FOLDER_ID);
    
    // Создаем тестовый буфер (1KB)
    const testBuffer = Buffer.alloc(1024, 'A');
    
    // Тестируем загрузку видео
    console.log('\n🎬 Тестируем загрузку видео...');
    const videoResult = await googleDrive.uploadFile(
      testBuffer,
      'test-video.mp4',
      'video/mp4',
      process.env.GOOGLE_DRIVE_VIDEOS_FOLDER_ID
    );
    console.log('✅ Видео загружено:', videoResult.secure_url);
    
    // Тестируем загрузку GIF-превью
    console.log('\n🖼️ Тестируем загрузку GIF-превью...');
    const gifResult = await googleDrive.uploadFile(
      testBuffer,
      'test-preview.gif',
      'image/gif',
      process.env.GOOGLE_DRIVE_GIFS_FOLDER_ID
    );
    console.log('✅ GIF-превью загружено:', gifResult.secure_url);
    
    // Тестируем загрузку обычного превью
    console.log('\n📸 Тестируем загрузку обычного превью...');
    const previewResult = await googleDrive.uploadFile(
      testBuffer,
      'test-preview.jpg',
      'image/jpeg',
      process.env.GOOGLE_DRIVE_PREVIEWS_FOLDER_ID
    );
    console.log('✅ Обычное превью загружено:', previewResult.secure_url);
    
    console.log('\n🎉 Все тесты прошли успешно!');
    
  } catch (error) {
    console.error('❌ Ошибка тестирования:', error);
  }
}

testVideoUpload(); 