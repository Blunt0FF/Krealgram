const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;
const ffmpeg = require('fluent-ffmpeg');

// Убедимся, что временные директории существуют
const TEMP_DIR = path.resolve(process.cwd(), 'backend/temp');
const TEMP_INPUT_DIR = path.join(TEMP_DIR, 'input');
const TEMP_OUTPUT_DIR = path.join(TEMP_DIR, 'output');

const ensureTempDirs = async () => {
  await fs.mkdir(TEMP_INPUT_DIR, { recursive: true });
  await fs.mkdir(TEMP_OUTPUT_DIR, { recursive: true });
};

// Вызовем функцию при инициализации модуля
ensureTempDirs();


class ImageCompressor {
  /**
   * Сжимает изображение из файла без потери качества
   * @param {string} inputPath - путь к исходному файлу
   * @param {string} originalName - оригинальное имя файла
   * @returns {Promise<{buffer: Buffer, info: Object}>}
   */
  async compressImage(inputPath, originalName) {
    const tempOutputPath = path.join(TEMP_OUTPUT_DIR, `compressed-${Date.now()}-${originalName}`);
    
    try {
      const ext = path.extname(originalName).toLowerCase();
      const filename = path.basename(originalName, ext);
      
      console.log(`[IMAGE_COMPRESSOR] Обрабатываем изображение: ${originalName}`);
      
      const pipeline = sharp(inputPath, { failOnError: false }).rotate(); // failOnError: false для обработки некорректных изображений

      let outputFormat = ext.substring(1);

      switch (outputFormat) {
        case 'jpg':
        case 'jpeg':
          pipeline.jpeg({ quality: 80, progressive: true, mozjpeg: true });
          break;
        case 'png':
          pipeline.png({ compressionLevel: 9, quality: 85, effort: 8 });
          break;
        case 'webp':
          pipeline.webp({ quality: 80, effort: 6 });
          break;
        default:
          pipeline.jpeg({ quality: 80, progressive: true, mozjpeg: true });
          outputFormat = 'jpg';
          break;
      }

      const info = await pipeline.toFile(tempOutputPath);
      const outputBuffer = await fs.readFile(tempOutputPath);

      console.log(`[IMAGE_COMPRESSOR] ✅ Обработка завершена. Info:`, info);

      return {
        buffer: outputBuffer,
        info: {
          ...info,
          filename: `${filename}.${outputFormat}`
        }
      };
    } finally {
      // Очистка временного файла
      await fs.unlink(tempOutputPath).catch(err => console.error(`Failed to clean up temp file: ${tempOutputPath}`, err));
    }
  }

  /**
   * Создает превью для изображения из файла
   * @param {string} inputPath - путь к исходному файлу
   * @returns {Promise<Buffer>}
   */
  async createThumbnail(inputPath) {
    try {
      console.log(`[IMAGE_COMPRESSOR] Создаем превью 300x300`);
      
      return await sharp(inputPath, { failOnError: false })
        .rotate()
        .resize(300, 300, { fit: 'cover', position: 'center' })
        .webp({ quality: 75 })
        .toBuffer();
        
    } catch (error) {
      console.error(`[IMAGE_COMPRESSOR] ❌ Ошибка создания превью:`, error);
      throw error;
    }
  }

  /**
   * Оптимизирует изображение для веба, работая с файловыми путями
   * @param {string} inputPath - путь к исходному файлу
   * @param {string} originalName - оригинальное имя файла
   * @returns {Promise<Object>}
   */
  async optimizeForWeb(inputPath, originalName) {
    try {
      const compressed = await this.compressImage(inputPath, originalName);
      const thumbnailBuffer = await this.createThumbnail(inputPath);
      
      return {
        original: compressed,
        thumbnail: {
          buffer: thumbnailBuffer,
          filename: `thumb_${compressed.info.filename.replace(/\.[^/.]+$/, '.webp')}`
        }
      };
    } catch (error) {
      console.error(`[IMAGE_COMPRESSOR] ❌ Ошибка оптимизации для веба:`, error);
      throw error;
    }
  }
}

const generateVideoThumbnail = async (inputPath) => {
  console.log('[THUMBNAIL_GEN] Starting video thumbnail generation from path...');
  
  const tempThumbPath = path.join(TEMP_OUTPUT_DIR, `thumb-${Date.now()}.jpg`);
  
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .on('end', async () => {
        try {
          // Проверяем существование файла
          const fileExists = await fs.access(tempThumbPath)
            .then(() => true)
            .catch(() => false);
          
          if (!fileExists) {
            console.error('[THUMBNAIL_GEN] Thumbnail file was not created');
            return reject(new Error('Thumbnail file was not created'));
          }

          const thumbnailBuffer = await fs.readFile(tempThumbPath);
          
          console.log('[THUMBNAIL_GEN] ✅ Thumbnail created successfully.');
          resolve({
            buffer: thumbnailBuffer,
            filename: path.basename(tempThumbPath),
            path: tempThumbPath
          });
        } catch (readError) {
          console.error('[THUMBNAIL_GEN] Error reading thumbnail:', readError);
          reject(readError);
        } finally {
          // Удаляем временный файл
          await fs.unlink(tempThumbPath).catch(err => console.error('Failed to cleanup thumb.', err));
        }
      })
      .on('error', (err) => {
        console.error('[THUMBNAIL_GEN] FFmpeg error:', err.message);
        reject(err);
      })
      .screenshots({
        timestamps: ['1%'],
        filename: path.basename(tempThumbPath),
        folder: path.dirname(tempThumbPath),
        size: '320x?' 
      });
  });
};

const generateGifThumbnail = async (inputPath, options = {}) => {
  console.log('[THUMBNAIL_GEN] Starting GIF thumbnail generation (30s, good quality)...');

  const PREVIEW_DIR = path.join(__dirname, '../temp/preview');
  const MAX_DURATION = options.maxDuration || 10; // Максимальная длительность 10 секунд
  const MAX_FPS = options.maxFps || 10; // Максимальный FPS
  const MAX_SCALE = options.maxScale || 480; // Максимальное разрешение

  // Создаем директорию для превью
  await fs.mkdir(PREVIEW_DIR, { recursive: true }).catch(err => {
    if (err.code !== 'EEXIST') {
      console.error('[THUMBNAIL_GEN] Error creating preview directory:', err);
    }
  });

  const tempThumbPath = path.join(PREVIEW_DIR, `thumb-${Date.now()}.gif`);

  // Получаем длительность видео
  const getDuration = () => {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(inputPath, (err, metadata) => {
        if (err) {
          console.error('[THUMBNAIL_GEN] Error getting video duration:', err);
          resolve(MAX_DURATION);
        } else {
          const duration = metadata.format.duration;
          resolve(Math.min(duration, MAX_DURATION));
        }
      });
    });
  };

  return new Promise(async (resolve, reject) => {
    try {
      const videoDuration = await getDuration();
      
      // Ограничиваем длительность и FPS
      const command = ffmpeg(inputPath)
        .outputOptions([
          `-t ${videoDuration}`, // Ограничиваем длительность
          `-vf fps=${MAX_FPS},scale=${MAX_SCALE}:-1:flags=lanczos`, // Ограничиваем FPS и размер
          '-loop 0', // Зацикливаем GIF
          '-f gif' // Формат GIF
        ])
        .on('start', (commandLine) => {
          console.log('[THUMBNAIL_GEN] Spawned FFmpeg with command:', commandLine);
        })
        .on('error', (err) => {
          console.error('[THUMBNAIL_GEN] FFmpeg GIF error:', err.message);
          reject(err);
        })
        .on('end', () => {
          console.log('[THUMBNAIL_GEN] ✅ GIF Thumbnail created successfully.');
          resolve(tempThumbPath);
        })
        .save(tempThumbPath);

    } catch (error) {
      console.error('[THUMBNAIL_GEN] Error generating GIF:', error);
      reject(error);
    }
  });
};

const generateUniversalGifThumbnail = async (inputPath) => {
  console.log('[THUMBNAIL_GEN] Starting universal GIF thumbnail generation...');

  const PREVIEW_DIR = path.join(__dirname, '../temp/preview');
  // Создаем директорию для превью, если она не существует
  if (!fs.existsSync(PREVIEW_DIR)) {
    fs.mkdirSync(PREVIEW_DIR, { recursive: true });
  }

  // Получаем длительность видео
  const getDuration = () => {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(inputPath, (err, metadata) => {
        if (err) {
          console.error('[THUMBNAIL_GEN] Error getting video duration:', err);
          resolve(30); // Fallback к 30 секундам
        } else {
          const duration = metadata.format.duration;
          resolve(Math.min(duration, 30)); // Не больше 30 секунд
        }
      });
    });
  };

  const tempThumbPath = path.join(PREVIEW_DIR, `thumb-${Date.now()}.gif`);

  // Получаем длительность видео
  const videoDuration = await getDuration();
  const previewDuration = Math.min(videoDuration, 30);

  // Для длинных видео берем только первые 10 секунд
  const effectiveDuration = Math.min(previewDuration, 10);

  return new Promise(async (resolve, reject) => {
    let attempts = 0;
    const maxAttempts = 3;
    let currentFps = 30; // Начинаем с 30 кадров
    let currentQuality = 5;
    let currentScale = 480; // HD качество
    
    while (attempts < maxAttempts) {
      try {
        const command = ffmpeg(inputPath)
          .on('start', (commandLine) => {
            console.log('[THUMBNAIL_GEN] Spawned FFmpeg with command: ' + commandLine);
          })
          .on('error', (err) => {
            console.error('[THUMBNAIL_GEN] FFmpeg error:', err.message);
            reject(err);
          });
        
        command
          .outputOptions([
            '-vf', `fps=${currentFps},scale=${currentScale}:-1:flags=lanczos`,
            '-loop', '0',
            '-t', `${effectiveDuration}`, // Используем эффективную длительность
            '-gifflags', '+transdiff',
            '-pix_fmt', 'rgb8',
            '-compression_level', `${currentQuality}`
          ])
          .toFormat('gif')
          .save(tempThumbPath);
        
        command.on('end', async () => {
          try {
            const thumbnailBuffer = await fs.readFile(tempThumbPath);
            const stats = await fs.stat(tempThumbPath);
            const sizeMB = stats.size / (1024 * 1024);
            
            if (sizeMB <= 1) {
              console.log(`[THUMBNAIL_GEN] ✅ GIF создан за ${attempts + 1} попытку, размер: ${sizeMB.toFixed(2)}MB`);
              resolve(tempThumbPath);
            } else {
              console.log(`[THUMBNAIL_GEN] GIF слишком большой (${sizeMB.toFixed(2)}MB), пробуем уменьшить...`);
              attempts++;
              currentFps = Math.max(10, currentFps - 5); // Уменьшаем FPS
              currentQuality = Math.max(1, currentQuality - 1);
              currentScale = Math.max(240, currentScale - 120); // Уменьшаем разрешение
              await fs.unlink(tempThumbPath);
              if (attempts >= maxAttempts) {
                console.warn('[THUMBNAIL_GEN] Не удалось создать GIF - слишком большой размер');
                resolve(null); // Возвращаем null, если не удалось создать
              }
            }
          } catch (err) {
            console.error('[THUMBNAIL_GEN] Ошибка чтения превью:', err);
            reject(err);
            await fs.unlink(tempThumbPath).catch(() => {});
          }
        });
      } catch (err) {
        reject(err);
        await fs.unlink(tempThumbPath).catch(() => {});
      }
    }
  });
};

const imageCompressor = new ImageCompressor();

module.exports = {
  optimizeForWeb: imageCompressor.optimizeForWeb.bind(imageCompressor),
  generateVideoThumbnail,
  generateGifThumbnail,
  generateUniversalGifThumbnail,
  TEMP_INPUT_DIR, // Экспортируем для использования в middleware
}; 