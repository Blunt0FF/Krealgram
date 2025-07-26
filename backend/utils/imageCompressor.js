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
  constructor() {
    // Максимальный размер изображения в байтах (4 МБ)
    this.MAX_FILE_SIZE = 4 * 1024 * 1024;
    
    // Максимальная ширина/высота изображения
    this.MAX_DIMENSION = 2048;
  }

  /**
   * Сжимает изображение из файла без потери качества
   * @param {string} inputPath - путь к исходному файлу
   * @param {string} originalName - оригинальное имя файла
   * @returns {Promise<{buffer: Buffer, info: Object}>}
   */
  async compressImage(inputPath, originalName) {
    try {
      const stats = await fs.stat(inputPath);
      const fileSizeMB = (stats.size / 1024 / 1024).toFixed(2);
      
      console.log(`[IMAGE_COMPRESSOR] Обрабатываем файл: ${originalName}`);
      console.log(`[IMAGE_COMPRESSOR] Размер файла: ${fileSizeMB} МБ`);
      console.log(`[IMAGE_COMPRESSOR] Лимит сжатия: ${(this.MAX_FILE_SIZE / 1024 / 1024).toFixed(2)} МБ`);
      
      // Если файл меньше MAX_FILE_SIZE, возвращаем его без изменений
      if (stats.size <= this.MAX_FILE_SIZE) {
        console.log(`[IMAGE_COMPRESSOR] Файл ${originalName} не требует сжатия (${fileSizeMB} МБ <= ${(this.MAX_FILE_SIZE / 1024 / 1024).toFixed(2)} МБ)`);
        const buffer = await fs.readFile(inputPath);
        return {
          buffer: buffer,
          info: {
            size: stats.size,
            filename: originalName
          }
        };
      }

      console.log(`[IMAGE_COMPRESSOR] Начинаем сжатие файла ${originalName} (${fileSizeMB} МБ)`);

      const tempOutputPath = path.join(TEMP_OUTPUT_DIR, `compressed-${Date.now()}-${originalName}`);
      
      const ext = path.extname(originalName).toLowerCase();
      const filename = path.basename(originalName, ext);
      
      const pipeline = sharp(inputPath, { failOnError: false })
        .rotate() // failOnError: false для обработки некорректных изображений
        .resize({
          width: this.MAX_DIMENSION,
          height: this.MAX_DIMENSION,
          fit: 'inside',
          withoutEnlargement: true
        });

      let outputFormat = ext.substring(1);

      switch (outputFormat) {
        case 'jpg':
        case 'jpeg':
          pipeline.jpeg({ quality: 80, progressive: true, mozjpeg: true });
          break;
        case 'png':
          pipeline.png({ compressionLevel: 9, quality: 80, effort: 8 });
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

      // Проверяем размер сжатого файла
      const compressedSizeMB = (outputBuffer.length / 1024 / 1024).toFixed(2);
      const compressionRatio = ((1 - outputBuffer.length / stats.size) * 100).toFixed(1);

      console.log(`[IMAGE_COMPRESSOR] ✅ Сжатие завершено:`);
      console.log(`[IMAGE_COMPRESSOR]   Оригинал: ${fileSizeMB} МБ`);
      console.log(`[IMAGE_COMPRESSOR]   Сжатый: ${compressedSizeMB} МБ`);
      console.log(`[IMAGE_COMPRESSOR]   Степень сжатия: ${compressionRatio}%`);

      // Очистка временного файла
      await fs.unlink(tempOutputPath).catch(err => console.error(`Failed to clean up temp file: ${tempOutputPath}`, err));

      return {
        buffer: outputBuffer,
        info: {
          ...info,
          filename: `${filename}.${outputFormat}`
        }
      };
    } catch (error) {
      console.error(`[IMAGE_COMPRESSOR] ❌ Ошибка сжатия ${originalName}:`, error);
      // В случае ошибки возвращаем оригинальный файл
      const buffer = await fs.readFile(inputPath);
      return {
        buffer: buffer,
        info: {
          size: buffer.length,
          filename: originalName
        }
      };
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

const imageCompressor = new ImageCompressor();

module.exports = {
  ImageCompressor,
  imageCompressor,
  optimizeForWeb: imageCompressor.optimizeForWeb.bind(imageCompressor),
  TEMP_INPUT_DIR, // Экспортируем для использования в middleware
}; 