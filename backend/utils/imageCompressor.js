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
          console.log('[THUMBNAIL_GEN] ✅ Thumbnail created successfully.');
          const thumbnailBuffer = await fs.readFile(tempThumbPath);
          resolve({
            buffer: thumbnailBuffer,
            filename: path.basename(tempThumbPath)
          });
        } catch (readError) {
          reject(readError);
        } finally {
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

const generateGifThumbnail = async (inputPath) => {
  console.log('[THUMBNAIL_GEN] Starting GIF thumbnail generation...');
  
  const tempThumbPath = path.join(TEMP_OUTPUT_DIR, `thumb-${Date.now()}.gif`);
  
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .on('end', async () => {
        try {
          console.log('[THUMBNAIL_GEN] ✅ GIF Thumbnail created successfully.');
          const thumbnailBuffer = await fs.readFile(tempThumbPath);
          resolve({
            buffer: thumbnailBuffer,
            filename: path.basename(tempThumbPath)
          });
        } catch (readError) {
          reject(readError);
        } finally {
          await fs.unlink(tempThumbPath).catch(err => console.error('Failed to cleanup gif thumb.', err));
        }
      })
      .on('error', (err) => {
        console.error('[THUMBNAIL_GEN] FFmpeg error:', err.message);
        reject(err);
      })
      .outputOptions([
        '-vf', 'fps=1,scale=320:-1:flags=lanczos', // 1 кадр в секунду, масштабирование
        '-loop', '0', // Бесконечный цикл
        '-t', '3' // Длительность 3 секунды
      ])
      .toFormat('gif')
      .save(tempThumbPath);
  });
};

const imageCompressor = new ImageCompressor();

module.exports = {
  optimizeForWeb: imageCompressor.optimizeForWeb.bind(imageCompressor),
  generateVideoThumbnail,
  generateGifThumbnail,
  TEMP_INPUT_DIR, // Экспортируем для использования в middleware
}; 