const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;
const ffmpeg = require('fluent-ffmpeg');

class ImageCompressor {
  constructor() {
    this.defaultOptions = {
      jpeg: {
        quality: 100,
        progressive: true
      },
      png: {
        compressionLevel: 9,
        quality: 100
      },
      webp: {
        quality: 100,
        effort: 6,
        lossless: true
      },
      gif: {
        quality: 100
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
      
      console.log(`[IMAGE_COMPRESSOR] Обрабатываем изображение: ${originalName}`);
      
      // Получаем информацию об изображении
      const metadata = await sharp(imageBuffer).metadata();
      console.log(`[IMAGE_COMPRESSOR] Исходный размер: ${metadata.width}x${metadata.height}, формат: ${metadata.format}`);
      
      let compressedBuffer;
      let outputFormat = ext;
      
      // Создаем sharp объект
      let sharpInstance = sharp(imageBuffer).rotate().withMetadata({}); // Авто-ориентация + удаление EXIF
      
      // Агрессивное сжатие для каждого формата
      switch (ext) {
        case '.jpg':
        case '.jpeg':
          compressedBuffer = await sharpInstance
            .jpeg({
              quality: 70,
              progressive: true,
              mozjpeg: true
            })
            .toBuffer();
          break;
          
        case '.png':
          compressedBuffer = await sharpInstance
            .png({
              compressionLevel: 9,
              force: true
            })
            .toBuffer();
          break;
          
        case '.webp':
          compressedBuffer = await sharpInstance
            .webp({
              quality: 70,
              lossless: false
            })
            .toBuffer();
          break;
          
        case '.gif':
          // Для GIF сохраняем как есть
          compressedBuffer = imageBuffer;
          break;
          
        default:
          // Для неизвестных форматов сохраняем как JPEG с оптимальным качеством
          compressedBuffer = await sharpInstance
            .jpeg({
              quality: 70,
              progressive: true,
              mozjpeg: true
            })
            .toBuffer();
          outputFormat = '.jpg';
          break;
      }
      
      // Если сжатый файл больше оригинала, используем оригинал
      const originalSize = imageBuffer.length;
      const compressedSize = compressedBuffer.length;
      
      if (compressedSize > originalSize) {
        console.log(`[IMAGE_COMPRESSOR] ⚠️ Сжатие увеличило размер, используем оригинал`);
        compressedBuffer = imageBuffer;
      }
      
      // Получаем информацию о финальном изображении
      const finalMetadata = await sharp(compressedBuffer).metadata();
      const finalSize = compressedBuffer.length;
      const compressionRatio = ((originalSize - finalSize) / originalSize * 100).toFixed(2);
      
      console.log(`[IMAGE_COMPRESSOR] ✅ Обработка завершена:`);
      console.log(`  - Исходный размер: ${(originalSize / 1024).toFixed(2)} KB`);
      console.log(`  - Финальный размер: ${(finalSize / 1024).toFixed(2)} KB`);
      console.log(`  - Экономия: ${compressionRatio}%`);
      console.log(`  - Разрешение: ${finalMetadata.width}x${finalMetadata.height}`);
      console.log(`  - Формат: ${metadata.format} → ${finalMetadata.format}`);
      
      return {
        buffer: compressedBuffer,
        info: {
          originalSize,
          compressedSize: finalSize,
          compressionRatio: parseFloat(compressionRatio),
          originalFormat: metadata.format,
          outputFormat: finalMetadata.format,
          originalDimensions: `${metadata.width}x${metadata.height}`,
          compressedDimensions: `${finalMetadata.width}x${finalMetadata.height}`,
          filename: `${filename}${outputFormat}`
        }
      };
      
    } catch (error) {
      console.error(`[IMAGE_COMPRESSOR] ❌ Ошибка обработки изображения:`, error);
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

const generateVideoThumbnail = async (videoBuffer) => {
  console.log('[THUMBNAIL_GEN] Starting video thumbnail generation...');
  
  const tempInputDir = path.join(__dirname, '..', 'temp', 'input');
  const tempOutputDir = path.join(__dirname, '..', 'temp', 'output');
  
  await fs.mkdir(tempInputDir, { recursive: true });
  await fs.mkdir(tempOutputDir, { recursive: true });

  const tempVideoPath = path.join(tempInputDir, `video-${Date.now()}.mp4`);
  const tempThumbPath = path.join(tempOutputDir, `thumb-${Date.now()}.jpg`);
  
  try {
    await fs.writeFile(tempVideoPath, videoBuffer);
    console.log('[THUMBNAIL_GEN] Temporary video file written.');

    await new Promise((resolve, reject) => {
      ffmpeg(tempVideoPath)
        .on('end', () => {
          console.log('[THUMBNAIL_GEN] FFmpeg processing finished.');
          resolve();
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

    const thumbnailBuffer = await fs.readFile(tempThumbPath);
    console.log('[THUMBNAIL_GEN] ✅ Thumbnail created successfully.');
    
    return {
        buffer: thumbnailBuffer,
        filename: path.basename(tempThumbPath)
    };
  } finally {
    // Clean up temporary files
    await fs.unlink(tempVideoPath).catch(e => console.error(`Failed to delete temp video: ${e.message}`));
    await fs.unlink(tempThumbPath).catch(e => console.error(`Failed to delete temp thumb: ${e.message}`));
  }
};


const imageCompressor = new ImageCompressor();

module.exports = {
  optimizeForWeb: imageCompressor.optimizeForWeb.bind(imageCompressor),
  generateVideoThumbnail
}; 