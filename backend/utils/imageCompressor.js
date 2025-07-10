const sharp = require('sharp');
const path = require('path');

class ImageCompressor {
  constructor() {
    this.defaultOptions = {
      jpeg: {
        quality: 85,
        progressive: true,
        mozjpeg: true
      },
      png: {
        compressionLevel: 9,
        progressive: true,
        quality: 85
      },
      webp: {
        quality: 85,
        effort: 6
      },
      gif: {
        // GIF сжатие через sharp ограничено
        quality: 85
      }
    };
  }

  /**
   * Сжимает изображение без потери качества
   * @param {Buffer} imageBuffer - буфер изображения
   * @param {string} originalName - оригинальное имя файла
   * @param {Object} options - опции сжатия
   * @returns {Promise<{buffer: Buffer, info: Object}>}
   */
  async compressImage(imageBuffer, originalName, options = {}) {
    try {
      const ext = path.extname(originalName).toLowerCase();
      const filename = path.basename(originalName, ext);
      
      console.log(`[IMAGE_COMPRESSOR] Сжимаем изображение: ${originalName}`);
      
      // Получаем информацию об изображении
      const metadata = await sharp(imageBuffer).metadata();
      console.log(`[IMAGE_COMPRESSOR] Исходный размер: ${metadata.width}x${metadata.height}, формат: ${metadata.format}`);
      
      let compressedBuffer;
      let outputFormat = ext;
      
      // Создаем sharp объект
      let sharpInstance = sharp(imageBuffer);
      
      // Если изображение очень большое, уменьшаем его
      if (metadata.width > 2048 || metadata.height > 2048) {
        console.log(`[IMAGE_COMPRESSOR] Уменьшаем размер изображения`);
        sharpInstance = sharpInstance.resize(2048, 2048, {
          fit: 'inside',
          withoutEnlargement: true
        });
      }
      
      // Сжимаем в зависимости от формата
      switch (ext) {
        case '.jpg':
        case '.jpeg':
          compressedBuffer = await sharpInstance
            .jpeg({
              quality: options.quality || this.defaultOptions.jpeg.quality,
              progressive: this.defaultOptions.jpeg.progressive,
              mozjpeg: this.defaultOptions.jpeg.mozjpeg
            })
            .toBuffer();
          break;
          
        case '.png':
          compressedBuffer = await sharpInstance
            .png({
              compressionLevel: this.defaultOptions.png.compressionLevel,
              progressive: this.defaultOptions.png.progressive,
              quality: options.quality || this.defaultOptions.png.quality
            })
            .toBuffer();
          break;
          
        case '.webp':
          compressedBuffer = await sharpInstance
            .webp({
              quality: options.quality || this.defaultOptions.webp.quality,
              effort: this.defaultOptions.webp.effort
            })
            .toBuffer();
          break;
          
        case '.gif':
          // Для GIF конвертируем в WebP для лучшего сжатия
          compressedBuffer = await sharpInstance
            .webp({
              quality: options.quality || this.defaultOptions.gif.quality,
              effort: 6
            })
            .toBuffer();
          outputFormat = '.webp';
          break;
          
        default:
          // Для неизвестных форматов конвертируем в JPEG
          compressedBuffer = await sharpInstance
            .jpeg({
              quality: options.quality || this.defaultOptions.jpeg.quality,
              progressive: this.defaultOptions.jpeg.progressive
            })
            .toBuffer();
          outputFormat = '.jpg';
          break;
      }
      
      // Получаем информацию о сжатом изображении
      const compressedMetadata = await sharp(compressedBuffer).metadata();
      
      const originalSize = imageBuffer.length;
      const compressedSize = compressedBuffer.length;
      const compressionRatio = ((originalSize - compressedSize) / originalSize * 100).toFixed(2);
      
      console.log(`[IMAGE_COMPRESSOR] ✅ Сжатие завершено:`);
      console.log(`  - Исходный размер: ${(originalSize / 1024).toFixed(2)} KB`);
      console.log(`  - Сжатый размер: ${(compressedSize / 1024).toFixed(2)} KB`);
      console.log(`  - Сжатие: ${compressionRatio}%`);
      console.log(`  - Новый размер: ${compressedMetadata.width}x${compressedMetadata.height}`);
      console.log(`  - Формат: ${metadata.format} → ${compressedMetadata.format}`);
      
      return {
        buffer: compressedBuffer,
        info: {
          originalSize,
          compressedSize,
          compressionRatio: parseFloat(compressionRatio),
          originalFormat: metadata.format,
          outputFormat: compressedMetadata.format,
          originalDimensions: `${metadata.width}x${metadata.height}`,
          compressedDimensions: `${compressedMetadata.width}x${compressedMetadata.height}`,
          filename: `${filename}${outputFormat}`
        }
      };
      
    } catch (error) {
      console.error(`[IMAGE_COMPRESSOR] ❌ Ошибка сжатия изображения:`, error);
      throw error;
    }
  }

  /**
   * Создает превью изображения
   * @param {Buffer} imageBuffer - буфер изображения
   * @param {Object} options - опции превью
   * @returns {Promise<Buffer>}
   */
  async createThumbnail(imageBuffer, options = {}) {
    const {
      width = 300,
      height = 300,
      quality = 80,
      format = 'webp'
    } = options;

    try {
      console.log(`[IMAGE_COMPRESSOR] Создаем превью ${width}x${height}`);
      
      const thumbnailBuffer = await sharp(imageBuffer)
        .resize(width, height, {
          fit: 'cover',
          position: 'center'
        })
        .toFormat(format, { quality })
        .toBuffer();
        
      console.log(`[IMAGE_COMPRESSOR] ✅ Превью создано: ${(thumbnailBuffer.length / 1024).toFixed(2)} KB`);
      
      return thumbnailBuffer;
      
    } catch (error) {
      console.error(`[IMAGE_COMPRESSOR] ❌ Ошибка создания превью:`, error);
      throw error;
    }
  }

  /**
   * Оптимизирует изображение для веба
   * @param {Buffer} imageBuffer - буфер изображения
   * @param {string} originalName - оригинальное имя файла
   * @returns {Promise<Object>}
   */
  async optimizeForWeb(imageBuffer, originalName) {
    try {
      // Сжимаем основное изображение
      const compressed = await this.compressImage(imageBuffer, originalName);
      
      // Создаем превью
      const thumbnail = await this.createThumbnail(imageBuffer, {
        width: 300,
        height: 300,
        quality: 75,
        format: 'webp'
      });
      
      return {
        original: compressed,
        thumbnail: {
          buffer: thumbnail,
          filename: `thumb_${compressed.info.filename.replace(/\.[^/.]+$/, '.webp')}`
        }
      };
      
    } catch (error) {
      console.error(`[IMAGE_COMPRESSOR] ❌ Ошибка оптимизации для веба:`, error);
      throw error;
    }
  }
}

module.exports = new ImageCompressor(); 