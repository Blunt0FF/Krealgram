const YTDlpWrap = require('yt-dlp-wrap');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const cloudinary = require('../config/cloudinary');

class VideoDownloader {
  constructor() {
    // Автоматически определяем путь к yt-dlp
    let ytDlpPath;
    if (process.env.RENDER) {
      // На Render используем pip установку
      ytDlpPath = 'yt-dlp';
    } else if (fs.existsSync('/Users/admin/Library/Python/3.9/bin/yt-dlp')) {
      // Локальная установка через pip
      ytDlpPath = '/Users/admin/Library/Python/3.9/bin/yt-dlp';
    } else {
      // Системная установка
      ytDlpPath = 'yt-dlp';
    }
    
    this.ytDlp = new YTDlpWrap(ytDlpPath);
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

  // Загрузка видео с помощью yt-dlp
  async downloadVideo(url, platform) {
    const videoId = uuidv4();
    const tempVideoPath = path.join(this.tempDir, `${videoId}.%(ext)s`);
    
    try {
      console.log(`🔄 Начинаю загрузку видео с ${platform}: ${url}`);
      
      // Настройки для разных платформ
      const options = [
        '--format', 'best[height<=720]', // Ограничиваем качество для экономии места
        '--output', tempVideoPath,
        '--no-playlist',
        '--extract-flat', 'false'
      ];

      // Специальные настройки для разных платформ
      if (platform === 'tiktok') {
        options.push('--cookies-from-browser', 'chrome');
      } else if (platform === 'instagram') {
        options.push('--cookies-from-browser', 'chrome');
      }

      // Загружаем видео
      await this.ytDlp.execPromise([url, ...options]);
      
      // Находим загруженный файл
      const files = fs.readdirSync(this.tempDir);
      const videoFile = files.find(file => file.startsWith(videoId));
      
      if (!videoFile) {
        throw new Error('Видео файл не найден после загрузки');
      }

      const fullVideoPath = path.join(this.tempDir, videoFile);
      console.log(`✅ Видео успешно загружено: ${fullVideoPath}`);
      
      return {
        filePath: fullVideoPath,
        fileName: videoFile,
        videoId: videoId
      };
      
    } catch (error) {
      console.error(`❌ Ошибка загрузки видео с ${platform}:`, error);
      throw new Error(`Не удалось загрузить видео с ${platform}: ${error.message}`);
    }
  }

  // Загрузка в Cloudinary
  async uploadToCloudinary(filePath, platform) {
    try {
      console.log(`🔄 Загружаю видео в Cloudinary: ${filePath}`);
      
      const result = await cloudinary.uploader.upload(filePath, {
        resource_type: 'video',
        folder: `external_videos/${platform}`,
        quality: 'auto',
        format: 'mp4',
        transformation: [
          { width: 720, height: 1280, crop: 'limit' },
          { quality: 'auto:good' }
        ]
      });

      console.log(`✅ Видео успешно загружено в Cloudinary:`, result.secure_url);
      
      return {
        publicId: result.public_id,
        url: result.secure_url,
        thumbnailUrl: result.secure_url.replace('/video/upload/', '/image/upload/').replace('.mp4', '.jpg'),
        duration: result.duration,
        width: result.width,
        height: result.height,
        format: result.format,
        bytes: result.bytes
      };
      
    } catch (error) {
      console.error('❌ Ошибка загрузки в Cloudinary:', error);
      throw new Error(`Не удалось загрузить видео в Cloudinary: ${error.message}`);
    }
  }

  // Получение информации о видео
  async getVideoInfo(url) {
    try {
      const info = await this.ytDlp.getVideoInfo(url);
      return {
        title: info.title,
        description: info.description,
        duration: info.duration,
        uploader: info.uploader,
        thumbnail: info.thumbnail,
        viewCount: info.view_count,
        uploadDate: info.upload_date
      };
    } catch (error) {
      console.error('Ошибка получения информации о видео:', error);
      return null;
    }
  }

  // Очистка временных файлов
  async cleanup(filePath) {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`🗑️ Временный файл удален: ${filePath}`);
      }
    } catch (error) {
      console.error('Ошибка удаления временного файла:', error);
    }
  }

  // Основной метод для загрузки и обработки видео
  async processExternalVideo(url) {
    let tempFilePath = null;
    
    try {
      // Определяем платформу
      const platform = this.detectPlatform(url);
      if (platform === 'unknown') {
        throw new Error('Неподдерживаемая платформа');
      }

      console.log(`🎬 Обрабатываю видео с платформы: ${platform}`);

      try {
        // Пытаемся использовать yt-dlp
        const videoInfo = await this.getVideoInfo(url);
        const downloadResult = await this.downloadVideo(url, platform);
        tempFilePath = downloadResult.filePath;
        const cloudinaryResult = await this.uploadToCloudinary(tempFilePath, platform);
        await this.cleanup(tempFilePath);

        return {
          success: true,
          platform: platform,
          originalUrl: url,
          videoInfo: videoInfo,
          cloudinary: cloudinaryResult,
          mediaType: 'video',
          image: cloudinaryResult.publicId
        };
      } catch (ytDlpError) {
        console.log(`⚠️ yt-dlp не работает для ${platform}, используем fallback:`, ytDlpError.message);
        
        // Очищаем временный файл если был создан
        if (tempFilePath) {
          await this.cleanup(tempFilePath);
        }
        
        // Используем fallback метод
        return await this.processVideoFallback(url, platform);
      }

    } catch (error) {
      // Очищаем временный файл в случае ошибки
      if (tempFilePath) {
        await this.cleanup(tempFilePath);
      }
      
      console.error('❌ Ошибка обработки внешнего видео:', error);
      throw error;
    }
  }

  // Проверка поддерживаемых платформ
  static getSupportedPlatforms() {
    return [
      'tiktok',
      'instagram', 
      'vk',
      'youtube',
      'twitter'
    ];
  }

  // Fallback метод для платформ без yt-dlp
  async processVideoFallback(url, platform) {
    console.log(`🔄 Используем fallback для ${platform}`);
    
    // Для YouTube используем простой метод
    if (platform === 'youtube') {
      const SimpleDownloader = require('./simpleVideoDownloader');
      const simpleDownloader = new SimpleDownloader();
      return await simpleDownloader.processExternalVideo(url);
    }
    
    // Для других платформ создаем заглушку
    const videoId = uuidv4();
    const mockThumbnail = `https://via.placeholder.com/640x360/000000/FFFFFF?text=${platform.toUpperCase()}+Video`;
    
    try {
      // Загружаем заглушку в Cloudinary
      const result = await cloudinary.uploader.upload(mockThumbnail, {
        resource_type: 'image',
        folder: `external_videos/${platform}`,
        public_id: `placeholder_${videoId}`,
        quality: 'auto',
        format: 'jpg'
      });

      return {
        success: true,
        platform: platform,
        originalUrl: url,
        videoInfo: {
          title: `${platform.charAt(0).toUpperCase() + platform.slice(1)} Video`,
          uploader: 'Unknown',
          thumbnail: mockThumbnail
        },
        cloudinary: {
          publicId: result.public_id,
          url: result.secure_url,
          thumbnailUrl: result.secure_url,
          width: result.width,
          height: result.height,
          format: result.format,
          bytes: result.bytes
        },
        mediaType: 'video',
        image: result.public_id,
        isPlaceholder: true // Помечаем как заглушку
      };
    } catch (error) {
      throw new Error(`Не удалось создать заглушку для ${platform}: ${error.message}`);
    }
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

module.exports = VideoDownloader; 