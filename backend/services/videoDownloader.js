const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { exec } = require('child_process');
const axios = require('axios');
const ffmpeg = require('fluent-ffmpeg');
const axiosLib = require('axios');
const googleDrive = require('../config/googleDrive');
const { generateVideoThumbnail } = require('../utils/imageCompressor');
const { forceCleanupAfterOperation } = require('../utils/tempCleanup');

async function resolveYtDlpCommand() {
  return new Promise((resolve) => {
    exec('command -v yt-dlp', async (err, stdout) => {
      if (!err && stdout && stdout.trim()) {
        return resolve({ command: 'yt-dlp', argsPrefix: [] });
      }
      exec('python3 -m yt_dlp --version', async (pyErr) => {
        if (!pyErr) {
          return resolve({ command: 'python3', argsPrefix: ['-m', 'yt_dlp'] });
        }
        try {
          const binDir = path.join(__dirname, '../temp');
          const binPath = path.join(binDir, 'yt-dlp');
          if (!fs.existsSync(binPath)) {
            await fs.promises.mkdir(binDir, { recursive: true });
            const url = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp';
            const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 20000 });
            await fs.promises.writeFile(binPath, Buffer.from(response.data));
            await fs.promises.chmod(binPath, 0o755);
          }
          if (fs.existsSync(binPath)) {
            return resolve({ command: binPath, argsPrefix: [] });
          }
        } catch (e) {
          console.log('⚠️ Не удалось скачать yt-dlp:', e.message);
        }
        return resolve(null);
      });
    });
  });
}

// Функция для создания GIF-превью из видео
const generateGifThumbnail = async (videoPath) => {
  try {
    // Проверяем существование файла
    if (!fs.existsSync(videoPath)) {
      console.error('[GIF_THUMBNAIL] ❌ Видео файл не найден:', videoPath);
      return null;
    }
    
    const tempGifPath = path.join(path.dirname(videoPath), `gif-preview-${Date.now()}.gif`);
    
    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .outputOptions([
          '-vf', 'fps=20,scale=300:-1', 
          '-t', '3', 
        ])
        .toFormat('gif')
        .on('end', async () => {
          try {
            // Проверяем существование созданного файла
            if (!fs.existsSync(tempGifPath)) {
              console.error('[GIF_THUMBNAIL] ❌ GIF файл не создан:', tempGifPath);
              resolve(null);
              return;
            }
            
            // Читаем файл
            const gifBuffer = await fs.promises.readFile(tempGifPath);
            
            // Проверяем размер GIF
            const maxSizeMB = 5;  // Уменьшаем максимальный размер
            const sizeMB = gifBuffer.length / (1024 * 1024);
            
            if (sizeMB > maxSizeMB) {
              console.warn(`[GIF_THUMBNAIL] GIF слишком большой (${sizeMB.toFixed(2)}MB), пропускаем`);
              await fs.promises.unlink(tempGifPath);
              resolve(null);
              return;
            }
            
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
    if (url.includes('youtube.com/shorts')) return 'youtube-shorts';
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
      const { videoUrl, title, uploader, duration, thumbnailUrl: originalThumbnailUrl } = await this.extractTikTokVideoAPI(url);

      // Проверяем размер видео перед скачиванием
      const headResponse = await axios.head(videoUrl);
      const contentLength = headResponse.headers['content-length'];
      if (contentLength && parseInt(contentLength) > 100 * 1024 * 1024) { // 100MB лимит
        throw new Error('Video file too large (>100MB)');
      }

      const response = await axios.get(videoUrl, { responseType: 'arraybuffer' });
      
      const videoBuffer = Buffer.from(response.data, 'binary');

      if (videoBuffer.length === 0) {
        throw new Error('Downloaded video file is empty (0 bytes).');
      }
      
      // Проверяем размер скачанного файла
      if (videoBuffer.length > 100 * 1024 * 1024) {
        throw new Error('Downloaded video exceeds 100MB limit');
      }
      
      // Полный оригинальный URL без протокола и www
      const normalizedUrl = url.replace(/^https?:\/\//, '').replace(/^www\./, '');
      const filename = `${normalizedUrl}.mp4`;
      
      const driveResult = await googleDrive.uploadFile(videoBuffer, filename, 'video/mp4', process.env.GOOGLE_DRIVE_VIDEOS_FOLDER_ID);

      const tempVideoPath = path.join(this.tempDir, `tiktok-${Date.now()}.mp4`);
      await fs.promises.writeFile(tempVideoPath, videoBuffer);

      let generatedThumbnailUrl = null;
      let generatedThumbnailFileId = null;
      try {
        const gifResult = await generateGifThumbnail(tempVideoPath);

        if (gifResult && gifResult.buffer) {
          const thumbnailFilename = `gif-preview-${normalizedUrl}.gif`;
          const thumbnailDriveResult = await googleDrive.uploadFile(
            gifResult.buffer, 
            thumbnailFilename, 
            'image/gif', 
            process.env.GOOGLE_DRIVE_GIFS_FOLDER_ID || process.env.GOOGLE_DRIVE_PREVIEWS_FOLDER_ID
          );
          generatedThumbnailUrl = thumbnailDriveResult.secure_url;
          generatedThumbnailFileId = thumbnailDriveResult.fileId;
          
          // Удаляем временный GIF файл
          await fs.promises.unlink(gifResult.path);
        }
      } catch (previewError) {
        console.error('❌ Ошибка создания GIF Preview:', previewError);
      }

      await fs.promises.unlink(tempVideoPath);

      // Очищаем temp после завершения операции
      forceCleanupAfterOperation();

      console.log('🎬 TikTok video uploaded:', {
        filename,
        fileId: driveResult.fileId,
        url: url,
        size: videoBuffer.length
      });

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
        gifPreviewUrl: generatedThumbnailUrl || null,
        thumbnailFileId: generatedThumbnailFileId || null,
        fileId: driveResult.fileId,
        originalUrl: url
      };

    } catch (error) {
      console.error('❌ TikTok download error:', error);
      // Очищаем temp даже при ошибке
      forceCleanupAfterOperation();
      throw error;
    }
  }

  async downloadInstagramVideo(url) {
    try {
      // Используем наш Instagram экстрактор
      const { extractInstagramVideo } = require('../utils/instagramExtractor');
      
      const result = await extractInstagramVideo(url);
      
      if (!result || !result.success || !result.videoUrl) {
        throw new Error('Failed to extract Instagram video URL');
      }

      // Проверяем размер видео перед скачиванием
      const headResponse = await axios.head(result.videoUrl);
      const contentLength = headResponse.headers['content-length'];
      if (contentLength && parseInt(contentLength) > 100 * 1024 * 1024) { // 100MB лимит
        throw new Error('Video file too large (>100MB)');
      }

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
      
      // Проверяем размер скачанного файла
      if (videoBuffer.length > 100 * 1024 * 1024) {
        throw new Error('Downloaded video exceeds 100MB limit');
      }
      
      // Полный оригинальный URL без протокола и www
      const normalizedUrl = url.replace(/^https?:\/\//, '').replace(/^www\./, '');
      const filename = `${normalizedUrl}.mp4`;
      
      const driveResult = await googleDrive.uploadFile(
        videoBuffer, 
        filename, 
        'video/mp4', 
        process.env.GOOGLE_DRIVE_VIDEOS_FOLDER_ID
      );

      const tempVideoPath = path.join(this.tempDir, `instagram-${Date.now()}.mp4`);
      await fs.promises.writeFile(tempVideoPath, videoBuffer);

      let generatedThumbnailUrl = null;
      let generatedThumbnailFileId = null;
      try {
        const gifResult = await generateGifThumbnail(tempVideoPath);
        console.log('🖼️ GIF Preview создан:', gifResult);

        if (gifResult && gifResult.buffer) {
          const thumbnailFilename = `gif-preview-${normalizedUrl}.gif`;
          const thumbnailDriveResult = await googleDrive.uploadFile(
            gifResult.buffer, 
            thumbnailFilename, 
            'image/gif', 
            process.env.GOOGLE_DRIVE_GIFS_FOLDER_ID || process.env.GOOGLE_DRIVE_PREVIEWS_FOLDER_ID
          );
          generatedThumbnailUrl = thumbnailDriveResult.secure_url;
          generatedThumbnailFileId = thumbnailDriveResult.fileId;
          
          // Удаляем временный GIF файл
          await fs.promises.unlink(gifResult.path);
        }
      } catch (previewError) {
        console.error('❌ Ошибка создания GIF Preview:', previewError);
      }

      // Очищаем временные файлы
      await fs.promises.unlink(tempVideoPath);

      // Очищаем temp после завершения операции
      forceCleanupAfterOperation();

      console.log('🎬 Instagram video uploaded:', {
        filename,
        fileId: driveResult.fileId,
        url: url,
        size: videoBuffer.length
      });

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
        gifPreviewUrl: generatedThumbnailUrl || null,
        thumbnailFileId: generatedThumbnailFileId || null,
        fileId: driveResult.fileId,
        originalUrl: url
      };

    } catch (error) {
      console.error('❌ Instagram download error:', error);
      
      // Очищаем temp даже при ошибке
      forceCleanupAfterOperation();
      
      // Проверяем специфические ошибки Instagram
      if (error.message.includes('VIDEO_RESTRICTED_18_PLUS') || error.message.includes('VIDEO_REQUIRES_LOGIN')) {
        throw error; // Передаем ошибку как есть
      }
      
      throw error;
    }
  }

  async downloadYouTubeShorts(url) {
    try {
      // Используем yt-dlp для скачивания YouTube Shorts
      const videoInfo = await this.getVideoInfo(url);
      const tempVideoPath = path.join(this.tempDir, `youtube-shorts-${Date.now()}.mp4`);
      
      const downloadedPath = await this.downloadVideoFile(url, tempVideoPath);
      
      if (!downloadedPath) {
        throw new Error('Failed to download YouTube Shorts video');
      }
      
      const videoBuffer = await fs.promises.readFile(downloadedPath);
      
      if (videoBuffer.length === 0) {
        throw new Error('Downloaded video file is empty (0 bytes).');
      }
      
      // Полный оригинальный URL без протокола и www
      const normalizedUrl = url.replace(/^https?:\/\//, '').replace(/^www\./, '');
      const filename = `${normalizedUrl}.mp4`;
      
      const driveResult = await googleDrive.uploadFile(
        videoBuffer, 
        filename, 
        'video/mp4', 
        process.env.GOOGLE_DRIVE_VIDEOS_FOLDER_ID
      );

      // Создаем GIF превью
      let generatedThumbnailUrl = null;
      let generatedThumbnailFileId = null;
      try {
        const gifResult = await generateGifThumbnail(downloadedPath);

        if (gifResult && gifResult.buffer) {
          const thumbnailFilename = `gif-preview-${normalizedUrl}.gif`;
          const thumbnailDriveResult = await googleDrive.uploadFile(
            gifResult.buffer, 
            thumbnailFilename, 
            'image/gif', 
            process.env.GOOGLE_DRIVE_GIFS_FOLDER_ID || process.env.GOOGLE_DRIVE_PREVIEWS_FOLDER_ID
          );
          generatedThumbnailUrl = thumbnailDriveResult.secure_url;
          generatedThumbnailFileId = thumbnailDriveResult.fileId;
          
          // Удаляем временный GIF файл
          await fs.promises.unlink(gifResult.path);
        }
      } catch (previewError) {
        console.error('❌ Ошибка создания GIF Preview:', previewError);
      }

      // Очищаем временные файлы
      await fs.promises.unlink(downloadedPath);

      // Очищаем temp после завершения операции
      forceCleanupAfterOperation();

      console.log('🎬 YouTube Shorts video uploaded:', {
        filename,
        fileId: driveResult.fileId,
        url: url,
        size: videoBuffer.length
      });

      return {
        success: true,
        platform: 'youtube-shorts',
        videoInfo: videoInfo,
        videoUrl: driveResult.secure_url,
        thumbnailUrl: generatedThumbnailUrl || driveResult.thumbnailUrl,
        gifPreviewUrl: generatedThumbnailUrl || null,
        thumbnailFileId: generatedThumbnailFileId || null,
        fileId: driveResult.fileId,
        originalUrl: url,
        description: (videoInfo.description && videoInfo.description.trim()) ? videoInfo.description : (videoInfo.title || '')
      };

    } catch (error) {
      console.error('❌ YouTube Shorts download error:', error);
      // Очищаем temp даже при ошибке
      forceCleanupAfterOperation();
      throw error;
    }
  }

  async downloadVKVideo(url) {
    try {
      // VK видео остается как внешняя ссылка
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
      const start = async () => {
        const resolved = await resolveYtDlpCommand();
        if (!resolved) {
          return reject(new Error('yt-dlp not available in environment'));
        }
        const { command, argsPrefix } = resolved;
        const ytDlp = spawn(command, [
          ...argsPrefix,
          '--print', '%(title)s|%(uploader)s|%(duration)s|%(view_count)s|%(description)s',
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

        ytDlp.on('error', (err) => {
          reject(new Error(`yt-dlp not available: ${err.message}`));
        });

        ytDlp.on('close', (code) => {
          if (code === 0) {
            const parts = output.trim().split('|');
            const title = parts[0] || '';
            const uploader = parts[1] || '';
            const duration = parts[2] || '';
            const viewCount = parts[3] || '';
            // Описание может содержать символы |, поэтому соединяем остаток обратно
            const description = parts.length > 4 ? parts.slice(4).join('|') : '';
            resolve({
              title: title || 'Unknown Title',
              uploader: uploader || 'Unknown Uploader',
              duration: parseInt(duration) || 0,
              viewCount: parseInt(viewCount) || 0,
              description: description || ''
            });
          } else {
            reject(new Error(`yt-dlp failed: ${errorOutput}`));
          }
        });
      };
      start();
    });
  }

  async downloadVideoFile(url, outputPath) {
    return new Promise((resolve, reject) => {
      const start = async () => {
        const resolved = await resolveYtDlpCommand();
        if (!resolved) {
          return reject(new Error('yt-dlp not available in environment'));
        }
        const { command, argsPrefix } = resolved;
        const ytDlp = spawn(command, [
          ...argsPrefix,
          '-f', 'best[height<=720]',
          '-o', outputPath,
          url
        ]);

        let errorOutput = '';

        ytDlp.stderr.on('data', (data) => {
          errorOutput += data.toString();
        });

        ytDlp.on('error', (err) => {
          reject(new Error(`yt-dlp not available: ${err.message}`));
        });

        ytDlp.on('close', async (code) => {
          if (code === 0) {
            try {
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
      };
      start();
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



// Экспортируем класс для обратной совместимости
module.exports = VideoDownloader;

// Экспортируем функцию отдельно
module.exports.generateGifThumbnail = generateGifThumbnail; 

