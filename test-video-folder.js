const googleDrive = require('./backend/config/googleDrive');

async function testVideoFolder() {
  try {
    console.log('🧪 Проверяем папку с видео в Google Drive...');
    
    // Инициализируем Google Drive
    await googleDrive.initialize();
    console.log('✅ Google Drive инициализирован');
    
    const videosFolderId = process.env.GOOGLE_DRIVE_VIDEOS_FOLDER_ID;
    console.log('📁 Папка видео:', videosFolderId);
    
    // Получаем список всех файлов в папке видео
    const response = await googleDrive.drive.files.list({
      q: `'${videosFolderId}' in parents and trashed = false`,
      fields: 'files(id, name, mimeType, size, thumbnailLink, videoMediaMetadata, processingStatus)',
      pageSize: 100
    });
    
    console.log(`\n📊 Найдено файлов: ${response.data.files.length}`);
    
    // Фильтруем только видео файлы
    const videoFiles = response.data.files.filter(file => 
      file.mimeType && file.mimeType.startsWith('video/')
    );
    
    console.log(`🎬 Видео файлов: ${videoFiles.length}`);
    
    // Выводим информацию о каждом видео
    videoFiles.forEach((file, index) => {
      console.log(`\n${index + 1}. ${file.name}`);
      console.log(`   ID: ${file.id}`);
      console.log(`   MIME: ${file.mimeType}`);
      console.log(`   Размер: ${(file.size / 1024 / 1024).toFixed(2)} MB`);
      console.log(`   Превью: ${file.thumbnailLink ? '✅' : '❌'}`);
      console.log(`   Статус: ${file.processingStatus || 'N/A'}`);
      
      if (file.videoMediaMetadata) {
        console.log(`   Длительность: ${file.videoMediaMetadata.durationMillis}ms`);
        console.log(`   Разрешение: ${file.videoMediaMetadata.width}x${file.videoMediaMetadata.height}`);
      }
    });
    
    // Тестируем проксирование для каждого видео
    console.log('\n🔗 Тестируем проксирование...');
    
    for (const video of videoFiles) {
      try {
        const proxyUrl = `http://localhost:3000/api/proxy-drive/${video.id}?type=video`;
        console.log(`\n📹 Тестируем: ${video.name}`);
        console.log(`   URL: ${proxyUrl}`);
        
        // Делаем HEAD запрос для проверки доступности
        const axios = require('axios');
        const response = await axios.head(proxyUrl, {
          timeout: 5000,
          validateStatus: (status) => status < 500
        });
        
        console.log(`   ✅ Статус: ${response.status}`);
        console.log(`   📊 Content-Type: ${response.headers['content-type']}`);
        console.log(`   📏 Content-Length: ${response.headers['content-length']}`);
        
      } catch (error) {
        console.log(`   ❌ Ошибка: ${error.message}`);
        if (error.response) {
          console.log(`   📊 Статус: ${error.response.status}`);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
  }
}

testVideoFolder(); 