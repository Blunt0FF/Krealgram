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

      // Получаем список существующих файлов в папке превью
      const existingFiles = await this._listFilesInPreviewFolder();

      // Генерируем уникальное имя файла
      const thumbnailFileName = this._generateUniqueFileName(originalName, existingFiles);

      console.log('[THUMBNAIL_GEN] Сгенерировано имя файла:', thumbnailFileName);

      const thumbnailBuffer = await sharp(inputPath)
        .rotate()
        .resize(300, 300, { fit: 'cover', position: 'center' })
        .webp({ quality: 75 })
        .toBuffer();

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
        fileId: result.data.id
      });

      return {
        thumbnailUrl: result.data.webContentLink,
        thumbnailFileName: thumbnailFileName,
        fileId: result.data.id
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
      // Получаем список существующих файлов в папке превью
      const existingFiles = await this._listFilesInPreviewFolder();

      // Генерируем уникальное имя файла
      const thumbnailFileName = this._generateUniqueFileName(originalName.replace(/\.[^/.]+$/, '.gif'), existingFiles);

      const tempThumbPath = path.join(this.previewDir, thumbnailFileName);

      // Создаем директорию, если она не существует
      await fs.mkdir(this.previewDir, { recursive: true });

      return new Promise((resolve, reject) => {
        ffmpeg(inputPath)
          .outputOptions([
            '-vf', 'fps=30,scale=320:-1',
            '-t', '30',  // Максимальная длительность 30 секунд
            '-compression_level', '6'
          ])
          .toFormat('gif')
          .on('end', async () => {
            try {
              // Читаем файл
              const gifBuffer = await fs.readFile(tempThumbPath);

              // Проверяем размер GIF
              const maxSizeMB = 2;
              const sizeMB = gifBuffer.length / (1024 * 1024);
              
              if (sizeMB > maxSizeMB) {
                console.warn(`[THUMBNAIL_GEN] GIF слишком большой (${sizeMB.toFixed(2)}MB), пропускаем`);
                await fs.unlink(tempThumbPath);
                resolve(null);
                return;
              }

              // Загружаем в Google Drive
              const fileMetadata = {
                name: thumbnailFileName,
                parents: [process.env.GOOGLE_DRIVE_PREVIEWS_FOLDER_ID]
              };

              const result = await googleDrive.drive.files.create({
                resource: fileMetadata,
                media: {
                  mimeType: 'image/gif',
                  body: gifBuffer
                },
                fields: 'id, webContentLink'
              });

              // Удаляем временный файл
              await fs.unlink(tempThumbPath);

              resolve({
                thumbnailUrl: result.data.webContentLink,
                thumbnailFileName: thumbnailFileName,
                fileId: result.data.id
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
      console.error('[THUMBNAIL_GEN] Ошибка создания GIF-превью:', error);
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