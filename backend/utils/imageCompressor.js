const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;
const ffmpeg = require('fluent-ffmpeg');

// Убедимся, что временные директории существуют
const TEMP_DIR = path.resolve(process.cwd(), 'temp');
const TEMP_INPUT_DIR = path.join(TEMP_DIR, 'input');
const TEMP_OUTPUT_DIR = path.join(TEMP_DIR, 'output');

const ensureTempDirs = async () => {
  try {
    console.log('[TEMP_DIRS] Текущая рабочая директория:', process.cwd());
    console.log('[TEMP_DIRS] Полный путь к TEMP_DIR:', TEMP_DIR);
    console.log('[TEMP_DIRS] Полный путь к TEMP_INPUT_DIR:', TEMP_INPUT_DIR);
    console.log('[TEMP_DIRS] Полный путь к TEMP_OUTPUT_DIR:', TEMP_OUTPUT_DIR);

    await fs.mkdir(TEMP_DIR, { recursive: true });
    await fs.mkdir(TEMP_INPUT_DIR, { recursive: true });
    await fs.mkdir(TEMP_OUTPUT_DIR, { recursive: true });

    console.log('[TEMP_DIRS] ✅ Все временные директории созданы');
  } catch (error) {
    console.error('[TEMP_DIRS] ❌ Ошибка создания временных директорий:', error);
    throw error;
  }
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
      
      const pipeline = sharp(inputPath, { 
        failOnError: false, 
        limitInputPixels: 2 * 1024 * 1024 * 1024 
      }).rotate(); 

      let outputFormat = ext.substring(1);

      // Список HEIC форматов
      const heicFormats = ['heic', 'heif', 'x-heic', 'x-heif'];

      // Определяем формат вывода с учётом исходного формата
      switch (outputFormat) {
        case 'jpg':
        case 'jpeg':
          pipeline.jpeg({ 
            quality: 80, 
            progressive: true, 
            mozjpeg: true,
            chromaSubsampling: '4:4:4'
          });
          break;
        case 'png':
          pipeline.png({ 
            compressionLevel: 9, 
            quality: 85, 
            effort: 8,
            adaptiveFiltering: true
          });
          break;
        case 'webp':
          pipeline.webp({ 
            quality: 80, 
            effort: 6,
            nearLossless: true
          });
          break;
        case 'gif':
          pipeline.gif({
            reductionEffort: 5,
            colors: 256
          });
          break;
        default:
          // Для HEIC и неизвестных форматов конвертируем в JPEG
          if (heicFormats.includes(outputFormat)) {
            console.log(`[IMAGE_COMPRESSOR] Конвертируем HEIC/HEIF в JPEG`);
            pipeline.jpeg({ 
              quality: 80, 
              progressive: true, 
              mozjpeg: true 
            });
            outputFormat = 'jpg';
          } else {
            pipeline.jpeg({ 
              quality: 80, 
              progressive: true, 
              mozjpeg: true 
            });
            outputFormat = 'jpg';
          }
          break;
      }

      const info = await pipeline.toFile(tempOutputPath);

      const outputBuffer = await fs.readFile(tempOutputPath);

      console.log(`[IMAGE_COMPRESSOR] ✅ Обработка завершена. Исходный размер: ${info.size} байт`, info);

      return {
        buffer: outputBuffer,
        info: {
          ...info,
          filename: `${filename}.${outputFormat}`
        }
      };
    } catch (error) {
      console.error(`[IMAGE_COMPRESSOR] ❌ Ошибка обработки изображения:`, error);
      throw error;
    } finally {
      // Очистка временного файла
      await fs.unlink(tempOutputPath).catch(err => {
        if (err.code !== 'ENOENT') {
          console.error(`Failed to clean up temp file: ${tempOutputPath}`, err);
        }
      });
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
      
      const thumbnailFilename = `thumb_${compressed.info.filename.replace(/\.[^/.]+$/, '.webp')}`;
      const thumbnailPath = path.join(TEMP_OUTPUT_DIR, thumbnailFilename);
      
      // Сохраняем превью на диск
      await fs.writeFile(thumbnailPath, thumbnailBuffer);
      
      console.log(`[IMAGE_COMPRESSOR] ✅ Превью сохранено: ${thumbnailPath}`);
      
      return {
        original: compressed,
        thumbnail: {
          buffer: thumbnailBuffer,
          filename: thumbnailFilename,
          path: thumbnailPath
        }
      };
    } catch (error) {
      console.error(`[IMAGE_COMPRESSOR] ❌ Ошибка оптимизации для веба:`, error);
      throw error;
    }
  }

  /**
   * Оптимизирует изображение для веба, работая с буфером
   * @param {Buffer} inputBuffer - буфер изображения
   * @param {string} originalName - оригинальное имя файла
   * @returns {Promise<Object>}
   */
  async optimizeForWebFromBuffer(inputBuffer, originalName) {
    const tempInputPath = path.join(TEMP_INPUT_DIR, `temp-${Date.now()}-${originalName}`);
    
    try {
      // Сохраняем буфер во временный файл
      await fs.writeFile(tempInputPath, inputBuffer);
      
      const result = await this.optimizeForWeb(tempInputPath, originalName);
      
      return result;
    } catch (error) {
      console.error(`[IMAGE_COMPRESSOR] ❌ Ошибка оптимизации буфера:`, error);
      throw error;
    } finally {
      // Удаляем временный файл
      await fs.unlink(tempInputPath).catch(err => {
        if (err.code !== 'ENOENT') {
          console.error(`Failed to clean up temp file: ${tempInputPath}`, err);
        }
      });
    }
  }
}

const imageCompressor = new ImageCompressor();

module.exports = ImageCompressor;
module.exports.ImageCompressor = ImageCompressor;
module.exports.TEMP_OUTPUT_DIR = TEMP_OUTPUT_DIR; // Экспортируем для использования в других модулях 