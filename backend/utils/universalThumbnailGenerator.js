const fs = require('fs').promises;
const path = require('path');
const sharp = require('sharp');
const ffmpeg = require('fluent-ffmpeg');
const googleDrive = require('../config/googleDrive');

class UniversalThumbnailGenerator {
  constructor() {
    this.previewDir = path.join(__dirname, '../temp/preview');
  }

  /**
   * Генерирует уникальное имя файла с инкрементом
   * @param {string} originalName - оригинальное имя файла
   * @param {string[]} existingFiles - список существующих файлов
   * @returns {string} - уникальное имя файла
   */
  _generateUniqueFileName(originalName, existingFiles = []) {
    const ext = path.extname(originalName);
    const baseName = path.basename(originalName, ext);
    let newName = `thumb_${baseName}.webp`;
    let counter = 1;

    while (existingFiles.includes(newName)) {
      newName = `thumb_${baseName}(${counter}).webp`;
      counter++;
    }

    return newName;
  }

  /**
   * Создание превью для изображений
   * @param {string} inputPath - путь к исходному файлу
   * @param {string} originalName - оригинальное имя файла
   * @returns {Promise<Object>} - результат создания превью
   */
  async generateImageThumbnail(inputPath, originalName) {
    try {
      console.log(`[THUMBNAIL_GEN] Генерация превью: ${originalName}`);

      // Проверяем существование файла
      const fileExists = await fs.access(inputPath)
        .then(() => true)
        .catch(() => false);

      if (!fileExists) {
        console.error(`[THUMBNAIL_GEN] Файл не найден: ${inputPath}`);
        throw new Error(`Файл не найден: ${inputPath}`);
      }

      // Создаем папку для превью с префиксом thumb_
      const thumbDir = path.join(path.dirname(inputPath), 'thumb_');
      await fs.promises.mkdir(thumbDir, { recursive: true });

      // Генерируем имя файла с префиксом thumb_
      const thumbnailFileName = `thumb_${originalName.replace(/\.[^/.]+$/, '.webp')}`;
      const thumbnailPath = path.join(thumbDir, thumbnailFileName);

      console.log('[THUMBNAIL_GEN] Путь превью:', thumbnailPath);

      const thumbnailBuffer = await sharp(inputPath)
        .rotate()
        .resize(300, 300, { fit: 'cover', position: 'center' })
        .webp({ quality: 90 })
        .toBuffer();

      // Сохраняем превью локально
      await fs.promises.writeFile(thumbnailPath, thumbnailBuffer);

      const fileMetadata = {
        name: thumbnailFileName,
        parents: [process.env.GOOGLE_DRIVE_PREVIEWS_FOLDER_ID]
      };

      const result = await googleDrive.drive.files.create({
        resource: fileMetadata,
        media: {
          mimeType: 'image/webp',
          body: thumbnailBuffer
        },
        fields: 'id, webContentLink'
      });

      console.log('[THUMBNAIL_GEN] Превью успешно создано:', {
        thumbnailUrl: result.data.webContentLink,
        thumbnailFileName: thumbnailFileName,
        fileId: result.data.id,
        localPath: thumbnailPath
      });

      // Автоматическая очистка через 10 минут
      setTimeout(async () => {
        try {
          await fs.promises.unlink(thumbnailPath);
          console.log(`[THUMBNAIL_CLEANUP] Удален файл превью: ${thumbnailPath}`);
        } catch (cleanupError) {
          if (cleanupError.code !== 'ENOENT') {
            console.error(`[THUMBNAIL_CLEANUP] Ошибка удаления: ${cleanupError.message}`);
          }
        }
      }, 10 * 60 * 1000);

      return {
        thumbnailUrl: result.data.webContentLink,
        thumbnailFileName: thumbnailFileName,
        fileId: result.data.id,
        localPath: thumbnailPath
      };
    } catch (error) {
      console.error(`[THUMBNAIL_GEN] Ошибка генерации превью: ${error.message}`);
      throw error;
    }
  }

  /**
   * Создание GIF-превью для видео
   * @param {string} inputPath - путь к исходному видео
   * @param {string} originalName - оригинальное имя файла
   * @returns {Promise<Object>} - результат создания GIF-превью
   */
  async generateVideoThumbnail(inputPath, originalName) {
    try {
      // Создаем папку для превью с префиксом thumb_
      const thumbDir = path.join(path.dirname(inputPath), 'thumb_');
      await fs.promises.mkdir(thumbDir, { recursive: true });

      // Генерируем имя файла с префиксом thumb_
      const thumbnailFileName = `thumb_${originalName.replace(/\.[^/.]+$/, '.gif')}`;
      const tempThumbPath = path.join(thumbDir, thumbnailFileName);

      return new Promise((resolve, reject) => {
        ffmpeg(inputPath)
          .outputOptions([
            // Меньше fps, лучшее сжатие, 30 секунд
            '-vf', 'fps=8,scale=320:-1',
            '-t', '30',
            '-compression_level', '9',
            '-q:v', '30'
          ])
          .toFormat('gif')
          .on('end', async () => {
            try {
              // Читаем файл
              const gifBuffer = await fs.promises.readFile(tempThumbPath);

              // Проверяем размер GIF
              const maxSizeMB = 2;
              const sizeMB = gifBuffer.length / (1024 * 1024);
              
              if (sizeMB > maxSizeMB) {
                console.warn(`[THUMBNAIL_GEN] GIF слишком большой (${sizeMB.toFixed(2)}MB), пропускаем`);
                await fs.promises.unlink(tempThumbPath);
                resolve(null);
                return;
              }

              // Загружаем в Google Drive в папку GIF
              const fileMetadata = {
                name: thumbnailFileName,
                parents: [process.env.GOOGLE_DRIVE_GIFS_FOLDER_ID || process.env.GOOGLE_DRIVE_PREVIEWS_FOLDER_ID]
              };

              const result = await googleDrive.drive.files.create({
                resource: fileMetadata,
                media: {
                  mimeType: 'image/gif',
                  body: gifBuffer
                },
                fields: 'id, webContentLink'
              });

              // Автоматическая очистка через 10 минут
              setTimeout(async () => {
                try {
                  await fs.promises.unlink(tempThumbPath);
                  console.log(`[THUMBNAIL_CLEANUP] Удален файл превью: ${tempThumbPath}`);
                } catch (cleanupError) {
                  console.error(`[THUMBNAIL_CLEANUP] Ошибка удаления: ${cleanupError.message}`);
                }
              }, 10 * 60 * 1000);

              resolve({
                thumbnailUrl: result.data.webContentLink,
                thumbnailFileName: thumbnailFileName,
                fileId: result.data.id,
                localPath: tempThumbPath
              });
            } catch (uploadError) {
              reject(uploadError);
            }
          })
          .on('error', (err) => {
            console.error('Ошибка создания GIF-превью:', err);
            reject(err);
          })
          .save(tempThumbPath);
      });
    } catch (error) {
      console.error('Ошибка генерации превью для видео:', error);
      throw error;
    }
  }

  /**
   * Получает список файлов в папке превью
   * @returns {Promise<string[]>} - список имен файлов
   */
  async _listFilesInPreviewFolder() {
    try {
      console.log('[THUMBNAIL_DEBUG] Получаем список файлов в папке превью:', {
        previewFolderId: process.env.GOOGLE_DRIVE_PREVIEWS_FOLDER_ID,
        currentEnv: process.env
      });

      const response = await googleDrive.drive.files.list({
        q: `'${process.env.GOOGLE_DRIVE_PREVIEWS_FOLDER_ID}' in parents`,
        fields: 'files(name)'
      });

      console.log('[THUMBNAIL_DEBUG] Найдено файлов:', response.data.files.length);
      return response.data.files.map(file => file.name);
    } catch (error) {
      console.error('Ошибка получения списка файлов:', error);
      return [];
    }
  }
}

module.exports = UniversalThumbnailGenerator; 