const fs = require('fs').promises;
const path = require('path');
const sharp = require('sharp');
const stream = require('stream');
const util = require('util');

const pipeline = util.promisify(stream.pipeline);

class ImageCompressor {
  constructor() {
    // Максимальный размер изображения в байтах (4 МБ)
    this.MAX_FILE_SIZE = 4 * 1024 * 1024;
    
    // Максимальная ширина/высота изображения
    this.MAX_DIMENSION = 2048;
  }

  /**
   * Потоковое сжатие изображения с минимальным использованием памяти
   * @param {string} inputPath - путь к исходному файлу
   * @param {string} originalName - оригинальное имя файла
   * @returns {Promise<string>} путь к сжатому файлу
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
        return inputPath;
      }

      console.log(`[IMAGE_COMPRESSOR] Начинаем сжатие файла ${originalName} (${fileSizeMB} МБ)`);

      // Создаем директорию для сжатых файлов
      const outputDir = path.join(path.dirname(inputPath), 'compressed');
      await fs.mkdir(outputDir, { recursive: true });
      
      const outputPath = path.join(outputDir, `compressed_${originalName}`);

      // Создаем потоки для чтения и записи
      const readStream = fs.createReadStream(inputPath);
      const writeStream = fs.createWriteStream(outputPath);

      // Создаем поток сжатия с sharp
      const compressStream = sharp()
        .resize({
          width: this.MAX_DIMENSION,
          height: this.MAX_DIMENSION,
          fit: 'inside',
          withoutEnlargement: true
        })
        .jpeg({ 
          quality: 75, 
          mozjpeg: true 
        });

      // Объединяем потоки
      await pipeline(
        readStream,
        compressStream,
        writeStream
      );

      // Проверяем размер сжатого файла
      const compressedStats = await fs.stat(outputPath);
      const compressedSizeMB = (compressedStats.size / 1024 / 1024).toFixed(2);
      const compressionRatio = ((1 - compressedStats.size / stats.size) * 100).toFixed(1);

      console.log(`[IMAGE_COMPRESSOR] ✅ Сжатие завершено:`);
      console.log(`[IMAGE_COMPRESSOR]   Оригинал: ${fileSizeMB} МБ`);
      console.log(`[IMAGE_COMPRESSOR]   Сжатый: ${compressedSizeMB} МБ`);
      console.log(`[IMAGE_COMPRESSOR]   Степень сжатия: ${compressionRatio}%`);

      return outputPath;
    } catch (error) {
      console.error(`[IMAGE_COMPRESSOR] ❌ Ошибка сжатия ${originalName}:`, error);
      return inputPath; // В случае ошибки возвращаем оригинальный файл
    }
  }

  /**
   * Очистка временных файлов
   * @param {string} inputPath - путь к исходному файлу
   */
  async cleanupTempFiles(inputPath) {
    try {
      const compressedDir = path.join(path.dirname(inputPath), 'compressed');
      
      // Проверяем, существует ли директория
      try {
        await fs.access(compressedDir);
      } catch (error) {
        // Директория не существует, ничего не делаем
        return;
      }
      
      const files = await fs.readdir(compressedDir);
      
      for (const file of files) {
        const filePath = path.join(compressedDir, file);
        await fs.unlink(filePath);
      }
      
      await fs.rmdir(compressedDir);
    } catch (error) {
      console.warn('[IMAGE_COMPRESSOR] Ошибка очистки временных файлов:', error);
    }
  }

  /**
   * Создание превью для изображения
   * @param {string} inputPath - путь к исходному файлу
   * @returns {Promise<Buffer>} буфер превью
   */
  async createThumbnail(inputPath) {
    try {
      return await sharp(inputPath)
        .resize(300, 300, { 
          fit: 'cover', 
          position: 'center' 
        })
        .webp({ quality: 80 })
        .toBuffer();
    } catch (error) {
      console.error('[IMAGE_COMPRESSOR] Ошибка создания превью:', error);
      throw error;
    }
  }
}

module.exports = { ImageCompressor }; 