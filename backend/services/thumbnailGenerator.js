const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const googleDrive = require('../config/googleDrive');

class ThumbnailGenerator {
  constructor() {
    this.previewDir = path.join(__dirname, '../backend/temp/preview');
    
    // Создаем директорию для превью, если она не существует
    if (!fs.existsSync(this.previewDir)) {
      fs.mkdirSync(this.previewDir, { recursive: true });
    }
  }

  async generateGifPreview(videoPath, platform, videoId) {
    try {
      const outputFilename = `${platform}_${videoId}_preview.gif`;
      const outputPath = path.join(this.previewDir, outputFilename);

      return new Promise((resolve, reject) => {
        ffmpeg(videoPath)
          .fps(30)
          .duration(30)
          .size('320x?')
          .outputOptions('-vf', 'scale=320:-2')
          .toFormat('gif')
          .on('end', () => {
            console.log(`✅ Превью успешно создано: ${outputPath}`);
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
      console.log(`🔄 Загружаю превью в Google Drive: ${thumbnailPath}`);
      
      const fileMetadata = {
        name: `${platform}_${videoId}_preview.gif`,
        parents: [process.env.GOOGLE_DRIVE_PREVIEW_FOLDER_ID]
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

      console.log(`✅ Превью успешно загружено в Google Drive:`, result.data.webContentLink);
      return result.data.webContentLink;
    } catch (error) {
      console.error('❌ Ошибка загрузки превью в Google Drive:', error);
      throw new Error(`Не удалось загрузить превью в Google Drive: ${error.message}`);
    }
  }

  async processVideoPreview(videoPath, platform, videoId) {
    try {
      // Генерируем превью
      const thumbnailPath = await this.generateGifPreview(videoPath, platform, videoId);

      // Загружаем превью в Google Drive
      const thumbnailResult = await this.uploadPreviewToGoogleDrive(thumbnailPath, platform, videoId);

      // Удаляем временный файл превью
      fs.unlinkSync(thumbnailPath);

      return {
        thumbnailPath,
        thumbnailUrl: thumbnailResult
      };
    } catch (error) {
      console.error('❌ Ошибка обработки видео:', error);
      throw error;
    }
  }
}

module.exports = new ThumbnailGenerator(); 