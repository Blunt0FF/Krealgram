const axios = require('axios');

// Проверяем GIF файлы в папке Google Drive
async function testGifFolder() {
  try {
    console.log('🧪 Проверяем GIF файлы в Google Drive...');
    
    // ID папки GIF из .env
    const gifFolderId = '17JyWlFZn3As7tsJa_dbr3RfW0ochbkbL';
    console.log('📁 Папка GIF:', gifFolderId);
    
    // Тестируем доступ к папке через API
    const testUrl = `http://localhost:3000/api/proxy-drive/${gifFolderId}`;
    console.log('🔗 Тестируем доступ к папке:', testUrl);
    
    try {
      const response = await axios.get(testUrl, {
        timeout: 10000,
        validateStatus: (status) => status < 500
      });
      console.log('✅ Папка доступна:', response.status);
    } catch (error) {
      console.log('❌ Папка недоступна:', error.message);
    }
    
    // Проверяем несколько возможных GIF файлов
    const possibleGifIds = [
      '1JxjbX6fuUTqpYmZE7fIAYSwOLjE6ShQY', // thumb_151-m2jDw-AJPec.webp (из логов)
      '17JyWlFZn3As7tsJa_dbr3RfW0ochbkbL'  // ID самой папки
    ];
    
    for (const gifId of possibleGifIds) {
      try {
        console.log(`\n🖼️ Тестируем GIF ID: ${gifId}`);
        
        const gifUrl = `http://localhost:3000/api/proxy-drive/${gifId}?type=image`;
        const response = await axios.get(gifUrl, {
          timeout: 10000,
          validateStatus: (status) => status < 500
        });
        
        console.log(`   ✅ Статус: ${response.status}`);
        console.log(`   📊 Content-Type: ${response.headers['content-type']}`);
        console.log(`   📏 Размер: ${response.data?.length || 0} байт`);
        
        if (response.headers['content-type'].includes('gif')) {
          console.log('   🎉 Это GIF файл!');
        } else if (response.headers['content-type'].includes('webp')) {
          console.log('   📸 Это WebP файл (превью)');
        }
        
      } catch (error) {
        console.log(`   ❌ Ошибка: ${error.message}`);
        if (error.response) {
          console.log(`   📊 Статус: ${error.response.status}`);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Общая ошибка:', error);
  }
}

testGifFolder(); 