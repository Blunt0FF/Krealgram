const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const cloudinary = require('../config/cloudinary');

class SimpleVideoDownloader {
  constructor() {
    this.tempDir = path.join(__dirname, '../temp');
    
    // Создаем временную директорию если её нет
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  // Определяем платформу по URL
  detectPlatform(url) {
    if (url.includes('tiktok.com')) return 'tiktok';
    if (url.includes('instagram.com')) return 'instagram';
    if (url.includes('vk.com') || url.includes('vk.ru')) return 'vk';
    if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
    if (url.includes('twitter.com') || url.includes('x.com')) return 'twitter';
    return 'unknown';
  }

  // Извлекаем ID видео из YouTube URL
  extractYouTubeId(url) {
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
  }

  // Получение информации о YouTube видео
  async getYouTubeInfo(videoId) {
    try {
      // Используем простое API для получения информации о видео
      const response = await axios.get(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
      
      return {
        title: response.data.title,
        author_name: response.data.author_name,
        thumbnail_url: response.data.thumbnail_url,
        duration: null, // Не доступно через oEmbed
        platform: 'youtube'
      };
    } catch (error) {
      console.error('Ошибка получения информации о YouTube видео:', error);
      return null;
    }
  }

  // Загрузка превью в Cloudinary
  async uploadThumbnailToCloudinary(thumbnailUrl, platform, videoId) {
    try {
      console.log(`🔄 Загружаю превью в Cloudinary: ${thumbnailUrl}`);
      
      const result = await cloudinary.uploader.upload(thumbnailUrl, {
        resource_type: 'image',
        folder: `external_videos/${platform}/thumbnails`,
        public_id: `thumb_${videoId}`,
        quality: 'auto',
        format: 'jpg'
      });

      console.log(`✅ Превью успешно загружено в Cloudinary:`, result.secure_url);
      
      return {
        publicId: result.public_id,
        url: result.secure_url,
        width: result.width,
        height: result.height,
        format: result.format,
        bytes: result.bytes
      };
      
    } catch (error) {
      console.error('❌ Ошибка загрузки превью в Cloudinary:', error);
      throw new Error(`Не удалось загрузить превью в Cloudinary: ${error.message}`);
    }
  }

  // Основной метод для обработки внешних видео (пока только YouTube)
  async processExternalVideo(url) {
    try {
      const platform = this.detectPlatform(url);
      
      if (platform === 'youtube') {
        const videoId = this.extractYouTubeId(url);
        if (!videoId) {
          throw new Error('Не удалось извлечь ID видео из YouTube URL');
        }

        console.log(`🎬 Обрабатываю YouTube видео: ${videoId}`);

        // Получаем информацию о видео
        const videoInfo = await this.getYouTubeInfo(videoId);
        if (!videoInfo) {
          throw new Error('Не удалось получить информацию о YouTube видео');
        }

        // Загружаем превью в Cloudinary
        const thumbnailResult = await this.uploadThumbnailToCloudinary(
          videoInfo.thumbnail_url, 
          platform, 
          videoId
        );

        return {
          success: true,
          platform: platform,
          originalUrl: url,
          videoInfo: {
            title: videoInfo.title,
            uploader: videoInfo.author_name,
            thumbnail: videoInfo.thumbnail_url,
            videoId: videoId
          },
          cloudinary: {
            publicId: thumbnailResult.publicId,
            url: thumbnailResult.url,
            thumbnailUrl: thumbnailResult.url,
            width: thumbnailResult.width,
            height: thumbnailResult.height,
            format: thumbnailResult.format,
            bytes: thumbnailResult.bytes
          },
          mediaType: 'video',
          image: thumbnailResult.publicId, // Для совместимости с существующей схемой
          youtubeData: {
            videoId: videoId,
            embedUrl: `https://www.youtube.com/embed/${videoId}`,
            thumbnailUrl: thumbnailResult.url,
            title: videoInfo.title,
            platform: 'youtube',
            originalUrl: url
          }
        };
      } else {
        throw new Error(`Платформа ${platform} пока не поддерживается. Доступна только YouTube.`);
      }

    } catch (error) {
      console.error('❌ Ошибка обработки внешнего видео:', error);
      throw error;
    }
  }

  // Проверка поддерживаемых платформ
  static getSupportedPlatforms() {
    return ['youtube']; // Пока только YouTube
  }

  // Проверка валидности URL
  static isValidUrl(url) {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
}

module.exports = SimpleVideoDownloader; 