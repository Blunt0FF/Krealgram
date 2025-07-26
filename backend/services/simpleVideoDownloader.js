const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const googleDrive = require('../config/googleDrive');

class SimpleVideoDownloader {
  constructor() {
    this.tempInputDir = path.join(__dirname, '../backend/temp/input');
    this.tempOutputDir = path.join(__dirname, '../backend/temp/output');
    this.previewDir = path.join(__dirname, '../backend/temp/preview');
  }

  async generateGifPreview(videoPath, platform, videoId) {
    try {
      const outputFilename = `${platform}_${videoId}_preview.gif`;
      const outputPath = path.join(this.previewDir, outputFilename);

      // Создаем директорию для превью, если она не существует
      if (!fs.existsSync(this.previewDir)) {
        fs.mkdirSync(this.previewDir, { recursive: true });
      }

      // Генерируем GIF превью с помощью ffmpeg
      const ffmpeg = require('fluent-ffmpeg');
      return new Promise((resolve, reject) => {
        ffmpeg(videoPath)
          .fps(30)
          .duration(30)
          .size('320x?')
          .outputOptions('-vf', 'scale=320:-2')
          .toFormat('gif')
          .on('end', () => {
            resolve(outputPath);
          })
          .on('error', (err) => {
            console.error('❌ Ошибка создания превью:', err);
            reject(err);
          })
          .save(outputPath);
      });
    } catch (error) {
      console.error('❌ Ошибка генерации превью:', error);
      throw error;
    }
  }

  async uploadPreviewToGoogleDrive(thumbnailPath, platform, videoId) {
    try {
      const fileMetadata = {
        name: `${platform}_${videoId}_preview.gif`,
        parents: [process.env.GOOGLE_DRIVE_GIFS_FOLDER_ID || process.env.GOOGLE_DRIVE_PREVIEWS_FOLDER_ID]
      };
      
      const media = {
        mimeType: 'image/gif',
        body: fs.createReadStream(thumbnailPath)
      };

      const result = await googleDrive.drive.files.create({
        resource: fileMetadata,
        media: media,
        fields: 'id, webViewLink, webContentLink'
      });

      return result.data.webContentLink;
    } catch (error) {
      console.error('❌ Ошибка загрузки превью в Google Drive:', error);
      throw new Error(`Не удалось загрузить превью в Google Drive: ${error.message}`);
    }
  }

  async processVideoPreview(videoUrl, platform, videoId) {
    try {
      const inputFilename = `${platform}_${videoId}_input${path.extname(videoUrl)}`;
      const inputPath = path.join(this.tempInputDir, inputFilename);

      // Создаем директории, если они не существуют
      if (!fs.existsSync(this.tempInputDir)) {
        fs.mkdirSync(this.tempInputDir, { recursive: true });
      }

      // Скачиваем видео
      const response = await axios({
        method: 'get',
        url: videoUrl,
        responseType: 'stream'
      });

      const writer = fs.createWriteStream(inputPath);
      response.data.pipe(writer);

      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });

      // Генерируем превью
      const thumbnailPath = await this.generateGifPreview(inputPath, platform, videoId);

      // Загружаем превью в Google Drive
      const thumbnailResult = await this.uploadPreviewToGoogleDrive(thumbnailPath, platform, videoId);

      // Удаляем временные файлы
      fs.unlinkSync(inputPath);
      fs.unlinkSync(thumbnailPath);

      return {
        inputPath,
        thumbnailPath,
        thumbnailUrl: thumbnailResult
      };
    } catch (error) {
      console.error('❌ Ошибка обработки видео:', error);
      throw error;
    }
  }
}

module.exports = SimpleVideoDownloader; 
 