const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');

// Тестируем создание GIF-превью
async function testGifGeneration() {
  try {
    console.log('🧪 Тестируем создание GIF-превью...');
    
    // Создаем тестовый видео файл (1KB буфер)
    const testVideoPath = path.join(__dirname, 'test-video.mp4');
    const testBuffer = Buffer.alloc(1024, 'A');
    fs.writeFileSync(testVideoPath, testBuffer);
    
    console.log('📹 Создан тестовый видео файл:', testVideoPath);
    
    // Создаем GIF-превью
    const gifPath = path.join(__dirname, `test-gif-${Date.now()}.gif`);
    
    console.log('🔄 Создаем GIF-превью...');
    
    return new Promise((resolve, reject) => {
      ffmpeg(testVideoPath)
        .outputOptions([
          '-vf', 'fps=8,scale=320:-1',
          '-t', '3',
          '-compression_level', '9',
          '-q:v', '30'
        ])
        .toFormat('gif')
        .on('start', (commandLine) => {
          console.log('🚀 FFmpeg команда:', commandLine);
        })
        .on('progress', (progress) => {
          console.log('📊 Прогресс:', progress);
        })
        .on('end', async () => {
          try {
            console.log('✅ GIF создан успешно!');
            
            // Проверяем размер файла
            const stats = fs.statSync(gifPath);
            const sizeMB = stats.size / (1024 * 1024);
            console.log(`📏 Размер GIF: ${sizeMB.toFixed(2)} MB`);
            
            if (sizeMB > 5) {
              console.log('⚠️ GIF слишком большой (>5MB), будет удален');
              fs.unlinkSync(gifPath);
            } else {
              console.log('✅ GIF подходящего размера');
            }
            
            // Очистка
            fs.unlinkSync(testVideoPath);
            if (fs.existsSync(gifPath)) {
              fs.unlinkSync(gifPath);
            }
            
            resolve();
          } catch (error) {
            console.error('❌ Ошибка после создания GIF:', error);
            reject(error);
          }
        })
        .on('error', (err) => {
          console.error('❌ Ошибка создания GIF:', err);
          reject(err);
        })
        .save(gifPath);
    });
    
  } catch (error) {
    console.error('❌ Общая ошибка:', error);
  }
}

testGifGeneration(); 