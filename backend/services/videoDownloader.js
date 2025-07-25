const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const ffmpeg = require('fluent-ffmpeg');
const axios = require('axios');
const googleDrive = require('../config/googleDrive');
const { generateVideoThumbnail } = require('../utils/imageCompressor');

// Функция для создания GIF-превью из видео
const generateGifThumbnail = async (videoPath) => {
  try {
    console.log('[GIF_THUMBNAIL] Создаем GIF-превью из видео:', videoPath);
    
    // Проверяем существование файла
    if (!fs.existsSync(videoPath)) {
      console.error('[GIF_THUMBNAIL] ❌ Видео файл не найден:', videoPath);
      return null;
    }
    
    const tempGifPath = path.join(path.dirname(videoPath), `gif-preview-${Date.now()}.gif`);
    console.log('[GIF_THUMBNAIL] Временный GIF путь:', tempGifPath);
    
    return new Promise((resolve, reject) => {
      console.log('[GIF_THUMBNAIL] Запускаем ffmpeg...');
      
      ffmpeg(videoPath)
        .outputOptions([
          '-vf', 'fps=15,scale=320:-1',
          '-t', '3',  // Максимальная длительность 3 секунды
          '-compression_level', '6'
        ])
        .toFormat('gif')
        .on('start', (commandLine) => {
          console.log('[GIF_THUMBNAIL] FFmpeg команда:', commandLine);
        })
        .on('progress', (progress) => {
          console.log('[GIF_THUMBNAIL] Прогресс:', progress.percent, '%');
        })
        .on('end', async () => {
          try {
            console.log('[GIF_THUMBNAIL] FFmpeg завершен, читаем файл...');
            
            // Проверяем существование созданного файла
            if (!fs.existsSync(tempGifPath)) {
              console.error('[GIF_THUMBNAIL] ❌ GIF файл не создан:', tempGifPath);
              resolve(null);
              return;
            }
            
            // Читаем файл
            const gifBuffer = await fs.promises.readFile(tempGifPath);
            console.log('[GIF_THUMBNAIL] Файл прочитан, размер:', gifBuffer.length, 'байт');
            
            // Проверяем размер GIF
            const maxSizeMB = 5;
            const sizeMB = gifBuffer.length / (1024 * 1024);
            
            if (sizeMB > maxSizeMB) {
              console.warn(`[GIF_THUMBNAIL] GIF слишком большой (${sizeMB.toFixed(2)}MB), пропускаем`);
              await fs.promises.unlink(tempGifPath);
              resolve(null);
              return;
            }
            
            console.log(`[GIF_THUMBNAIL] ✅ GIF создан, размер: ${sizeMB.toFixed(2)}MB`);
            resolve({
              buffer: gifBuffer,
              path: tempGifPath,
              filename: path.basename(tempGifPath)
            });
          } catch (error) {
            console.error('[GIF_THUMBNAIL] Ошибка чтения GIF:', error);
            reject(error);
          }
        })
        .on('error', (err) => {
          console.error('[GIF_THUMBNAIL] ❌ Ошибка создания GIF:', err);
          reject(err);
        })
        .save(tempGifPath);
    });
  } catch (error) {
    console.error('[GIF_THUMBNAIL] Ошибка создания GIF-превью:', error);
    throw error;
  }
};


class VideoDownloader {
  constructor() {
    this.tempDir = path.join(__dirname, '../temp');
    this.previewDir = path.join(this.tempDir, 'preview');
    this.ensureTempDir();
  }

  ensureTempDir() {
    try {
      fs.mkdirSync(this.tempDir, { recursive: true });
      fs.mkdirSync(this.previewDir, { recursive: true });
    } catch (error) {
      console.error('Ошибка создания временных директорий:', error);
    }
  }

  detectPlatform(url) {
    if (url.includes('youtube.com/shorts') || url.includes('youtu.be') && url.includes('shorts')) return 'youtube-shorts';
    if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
    if (url.includes('tiktok.com')) return 'tiktok';
    if (url.includes('instagram.com')) return 'instagram';
    if (url.includes('vk.com')) return 'vk';
    if (url.includes('twitter.com') || url.includes('x.com')) return 'twitter';
    return null;
  }

  getSupportedPlatforms() {
    return ['youtube', 'youtube-shorts', 'tiktok', 'instagram'];
  }

  async extractTikTokVideoAPI(url) {
    try {
        console.log('🎵 Extracting TikTok video via new API...');
        const apiUrl = 'https://www.tikwm.com/api/';
        const response = await axios.get(apiUrl, { params: { url, hd: 1 } });

        if (response.data && response.data.code === 0 && response.data.data) {
            const videoData = response.data.data;
            const videoUrl = videoData.hdplay || videoData.play;
            if (videoUrl) {
                console.log('✅ TikTok video URL extracted via API');
                return {
                    videoUrl: videoUrl,
                    title: videoData.title || 'TikTok Video',
                    uploader: videoData.author?.nickname || 'TikTok User',
                    duration: videoData.duration || null,
                    thumbnailUrl: videoData.cover
                };
            }
        }
        throw new Error('Could not extract TikTok video URL from API response.');
    } catch (error) {
        console.error('❌ TikTok extraction failed:', error.message);
        throw error;
    }
  }

  async downloadTikTokVideo(url) {
    try {
      console.log('🎵 Downloading TikTok video:', url);
      
      const { videoUrl, title, uploader, duration, thumbnailUrl: originalThumbnailUrl } = await this.extractTikTokVideoAPI(url);

      console.log('📥 Downloading video buffer from:', videoUrl);
      const response = await axios.get(videoUrl, { responseType: 'arraybuffer' });
      
      const videoBuffer = Buffer.from(response.data, 'binary');

      if (videoBuffer.length === 0) {
        throw new Error('Downloaded video file is empty (0 bytes).');
      }
      
      console.log('✅ Video downloaded, size:', videoBuffer.length, 'bytes');
      
      console.log('📤 Uploading to Google Drive...');
      const timestamp = Date.now();
      const driveResult = await googleDrive.uploadFile(videoBuffer, `tiktok-video-${timestamp}.mp4`, 'video/mp4', process.env.GOOGLE_DRIVE_VIDEOS_FOLDER_ID);

      const tempVideoPath = path.join(this.tempDir, `tiktok-${Date.now()}.mp4`);
      await fs.promises.writeFile(tempVideoPath, videoBuffer);

      let generatedThumbnailUrl = null;
      try {
        const gifResult = await generateGifThumbnail(tempVideoPath);
        console.log('🖼️ GIF Preview создан:', gifResult);

        if (gifResult && gifResult.buffer) {
          const thumbnailDriveResult = await googleDrive.uploadFile(
            gifResult.buffer, 
            gifResult.filename, 
            'image/gif', 
            process.env.GOOGLE_DRIVE_GIFS_FOLDER_ID || process.env.GOOGLE_DRIVE_PREVIEWS_FOLDER_ID
          );
          generatedThumbnailUrl = thumbnailDriveResult.secure_url;
          
          // Удаляем временный GIF файл
          await fs.promises.unlink(gifResult.path);
        }
      } catch (previewError) {
        console.error('❌ Ошибка создания GIF Preview:', previewError);
      }

      await fs.promises.unlink(tempVideoPath);

      return {
        success: true,
        platform: 'tiktok',
        videoInfo: {
          title: title,
          duration: duration,
          uploader: uploader,
        },
        videoUrl: driveResult.secure_url,
        thumbnailUrl: generatedThumbnailUrl || originalThumbnailUrl || driveResult.thumbnailUrl, 
        fileId: driveResult.public_id,
        originalUrl: url
      };

    } catch (error) {
      console.error('❌ TikTok download error:', error);
      throw error;
    }
  }

  async downloadInstagramVideo(url) {
    try {
      console.log('📷 Downloading Instagram video:', url);
      
      // Используем наш Instagram экстрактор
      const { extractInstagramVideo } = require('../utils/instagramExtractor');
      
      const result = await extractInstagramVideo(url);
      
      if (!result || !result.success || !result.videoUrl) {
        throw new Error('Failed to extract Instagram video URL');
      }

      console.log('📥 Downloading video buffer from:', result.videoUrl);
      const response = await axios.get(result.videoUrl, { 
        responseType: 'arraybuffer',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      const videoBuffer = Buffer.from(response.data, 'binary');

      if (videoBuffer.length === 0) {
        throw new Error('Downloaded video file is empty (0 bytes).');
      }
      
      console.log('✅ Video downloaded, size:', videoBuffer.length, 'bytes');
      
      console.log('📤 Uploading to Google Drive...');
      const timestamp = Date.now();
      const driveResult = await googleDrive.uploadFile(
        videoBuffer, 
        `instagram-video-${timestamp}.mp4`, 
        'video/mp4', 
        process.env.GOOGLE_DRIVE_VIDEOS_FOLDER_ID
      );

      const tempVideoPath = path.join(this.tempDir, `instagram-${Date.now()}.mp4`);
      await fs.promises.writeFile(tempVideoPath, videoBuffer);

      let generatedThumbnailUrl = null;
      try {
        const gifResult = await generateGifThumbnail(tempVideoPath);
        console.log('🖼️ GIF Preview создан:', gifResult);

        if (gifResult && gifResult.buffer) {
          const thumbnailDriveResult = await googleDrive.uploadFile(
            gifResult.buffer, 
            gifResult.filename, 
            'image/gif', 
            process.env.GOOGLE_DRIVE_GIFS_FOLDER_ID || process.env.GOOGLE_DRIVE_PREVIEWS_FOLDER_ID
          );
          generatedThumbnailUrl = thumbnailDriveResult.secure_url;
          
          // Удаляем временный GIF файл
          await fs.promises.unlink(gifResult.path);
        }
      } catch (previewError) {
        console.error('❌ Ошибка создания GIF Preview:', previewError);
      }

      // Очищаем временные файлы
      await fs.promises.unlink(tempVideoPath);

      return {
        success: true,
        platform: 'instagram',
        videoInfo: {
          title: result.title || 'Instagram Video',
          duration: result.duration || null,
          uploader: result.author || 'Instagram User',
        },
        videoUrl: driveResult.secure_url,
        thumbnailUrl: generatedThumbnailUrl || result.thumbnailUrl || driveResult.thumbnailUrl,
        fileId: driveResult.public_id,
        originalUrl: url
      };

    } catch (error) {
      console.error('❌ Instagram download error:', error);
      throw error;
    }
  }

  async downloadYouTubeShorts(url) {
    try {
      console.log('📱 Downloading YouTube Shorts:', url);
      
      // Используем yt-dlp для скачивания YouTube Shorts
      const videoInfo = await this.getVideoInfo(url);
      const tempVideoPath = path.join(this.tempDir, `youtube-shorts-${Date.now()}.mp4`);
      
      console.log('📥 Downloading video file...');
      const downloadedPath = await this.downloadVideoFile(url, tempVideoPath);
      
      if (!downloadedPath) {
        throw new Error('Failed to download YouTube Shorts video');
      }
      
      console.log('📖 Reading video buffer...');
      const videoBuffer = await fs.promises.readFile(downloadedPath);
      
      if (videoBuffer.length === 0) {
        throw new Error('Downloaded video file is empty (0 bytes).');
      }
      
      console.log(`📤 Uploading to Google Drive...`);
      const timestamp = Date.now();
      const driveResult = await googleDrive.uploadFile(
        videoBuffer, 
        `youtube-shorts-${timestamp}.mp4`, 
        'video/mp4', 
        process.env.GOOGLE_DRIVE_VIDEOS_FOLDER_ID
      );

      // Создаем GIF превью
      let generatedThumbnailUrl = null;
      try {
        const gifResult = await generateGifThumbnail(downloadedPath);
        console.log('🖼️ GIF Preview создан:', gifResult);

        if (gifResult && gifResult.buffer) {
          const thumbnailDriveResult = await googleDrive.uploadFile(
            gifResult.buffer, 
            gifResult.filename, 
            'image/gif', 
            process.env.GOOGLE_DRIVE_GIFS_FOLDER_ID || process.env.GOOGLE_DRIVE_PREVIEWS_FOLDER_ID
          );
          generatedThumbnailUrl = thumbnailDriveResult.secure_url;
          
          // Удаляем временный GIF файл
          await fs.promises.unlink(gifResult.path);
        }
      } catch (previewError) {
        console.error('❌ Ошибка создания GIF Preview:', previewError);
      }

      // Очищаем временные файлы
      await fs.promises.unlink(downloadedPath);

      return {
        success: true,
        platform: 'youtube-shorts',
        videoInfo: {
          title: videoInfo.title || 'YouTube Shorts',
          duration: videoInfo.duration || null,
          uploader: videoInfo.uploader || 'YouTube User',
          viewCount: videoInfo.viewCount || null
        },
        videoUrl: driveResult.secure_url,
        thumbnailUrl: generatedThumbnailUrl || driveResult.thumbnailUrl,
        fileId: driveResult.public_id,
        originalUrl: url
      };

    } catch (error) {
      console.error('❌ YouTube Shorts download error:', error);
      throw error;
    }
  }

  async downloadVKVideo(url) {
    try {
      console.log('🔵 Downloading VK video:', url);
      
      // Для VK пока используем внешние ссылки
      // В будущем можно добавить поддержку VK API
      
      return {
        success: true,
        platform: 'vk',
        videoInfo: {
          title: 'VK Video',
          uploader: 'VK User',
          duration: null,
          viewCount: null
        },
        externalLink: true,
        originalUrl: url,
        thumbnailUrl: 'https://via.placeholder.com/400x400/4C75A3/FFFFFF?text=🔵+VK',
        note: 'External VK video link'
      };

    } catch (error) {
      console.error('❌ VK download error:', error);
      throw error;
    }
  }

  async downloadVideo(url) {
    const platform = this.detectPlatform(url);
    
    if (!platform) {
      throw new Error('Unsupported platform');
    }

    switch (platform) {
      case 'tiktok':
        return await this.downloadTikTokVideo(url);
      
      case 'instagram':
        return await this.downloadInstagramVideo(url);
      
      case 'vk':
        return await this.downloadVKVideo(url);
      
      case 'youtube-shorts':
        return await this.downloadYouTubeShorts(url);
      
      case 'youtube':
        // YouTube остается как iframe
        throw new Error('YouTube should use iframe embedding');
      
      default:
        throw new Error(`Platform ${platform} not supported for download`);
    }
  }

  async getVideoInfo(url) {
    return new Promise((resolve, reject) => {
      const ytDlp = spawn('yt-dlp', [
        '--print', '%(title)s|%(uploader)s|%(duration)s|%(view_count)s',
        url
      ]);

      let output = '';
      let errorOutput = '';

      ytDlp.stdout.on('data', (data) => {
        output += data.toString();
      });

      ytDlp.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      ytDlp.on('close', (code) => {
        if (code === 0) {
          const [title, uploader, duration, viewCount] = output.trim().split('|');
          resolve({
            title: title || 'Unknown Title',
            uploader: uploader || 'Unknown Uploader',
            duration: parseInt(duration) || 0,
            viewCount: parseInt(viewCount) || 0
          });
        } else {
          reject(new Error(`yt-dlp failed: ${errorOutput}`));
        }
      });
    });
  }

  async downloadVideoFile(url, outputPath) {
    return new Promise((resolve, reject) => {
      const ytDlp = spawn('yt-dlp', [
        '-f', 'best[height<=720]', // Ограничиваем качество для экономии места
        '-o', outputPath,
        url
      ]);

      let errorOutput = '';

      ytDlp.stderr.on('data', (data) => {
        errorOutput += data.toString();
        console.log('yt-dlp:', data.toString().trim());
      });

      ytDlp.on('close', async (code) => {
        if (code === 0) {
          try {
            // Находим скачанный файл
            const files = await fs.promises.readdir(this.tempDir);
            const videoFile = files.find(file => file.startsWith(path.basename(outputPath, '.%(ext)s')));
            
            if (videoFile) {
              resolve(path.join(this.tempDir, videoFile));
            } else {
              reject(new Error('Downloaded file not found'));
            }
          } catch (error) {
            reject(error);
          }
        } else {
          reject(new Error(`yt-dlp download failed: ${errorOutput}`));
        }
      });
    });
  }

  async cleanup(filePath) {
    try {
      await fs.promises.unlink(filePath);
      console.log('🗑️ Temporary file cleaned up');
    } catch (error) {
      console.warn('⚠️ Failed to cleanup temporary file:', error.message);
    }
  }

  generateVideoId() {
    return `video_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}



module.exports = VideoDownloader; 

