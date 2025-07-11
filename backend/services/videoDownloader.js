const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const axios = require('axios'); // Используем axios для большей надежности
const { uploadBufferToGoogleDrive } = require('../middlewares/uploadMiddleware');


class VideoDownloader {
  constructor() {
    this.tempDir = path.join(__dirname, '../temp');
    this.ensureTempDir();
  }

  async ensureTempDir() {
    try {
      await fs.promises.access(this.tempDir);
    } catch {
      await fs.promises.mkdir(this.tempDir, { recursive: true });
    }
  }

  detectPlatform(url) {
    if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
    if (url.includes('tiktok.com')) return 'tiktok';
    if (url.includes('instagram.com')) return 'instagram';
    if (url.includes('vk.com')) return 'vk';
    if (url.includes('twitter.com') || url.includes('x.com')) return 'twitter';
    return null;
  }

  getSupportedPlatforms() {
    return ['youtube', 'tiktok', 'instagram'];
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
      
      const { videoUrl, title, uploader, duration, thumbnailUrl } = await this.extractTikTokVideoAPI(url);

      console.log('📥 Downloading video buffer from:', videoUrl);
      const response = await axios.get(videoUrl, { responseType: 'arraybuffer' });
      
      const videoBuffer = Buffer.from(response.data, 'binary');

      if (videoBuffer.length === 0) {
        throw new Error('Downloaded video file is empty (0 bytes).');
      }
      
      console.log('✅ Video downloaded, size:', videoBuffer.length, 'bytes');
      
      console.log('📤 Uploading to Google Drive...');
      // Указываем контекст 'post', чтобы создавалось превью, если это возможно
      const driveResult = await uploadBufferToGoogleDrive(videoBuffer, 'tiktok-video.mp4', 'video/mp4', 'post');

      return {
        success: true,
        platform: 'tiktok',
        videoInfo: {
          title: title,
          duration: duration,
          uploader: uploader,
        },
        videoUrl: driveResult.secure_url,
        // Если image compressor создаст превью для видео, оно будет здесь
        thumbnailUrl: driveResult.thumbnailUrl || thumbnailUrl, 
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
      
      // Для Instagram пока используем внешние ссылки
      // В будущем можно добавить instagram-downloader или другие библиотеки
      
      return {
        success: true,
        platform: 'instagram',
        videoInfo: {
          title: 'Instagram Video',
          uploader: 'Instagram User',
          duration: null,
          viewCount: null
        },
        externalLink: true,
        originalUrl: url,
        thumbnailUrl: 'https://via.placeholder.com/400x400/E4405F/FFFFFF?text=📷+Instagram',
        note: 'External Instagram video link'
      };

    } catch (error) {
      console.error('❌ Instagram download error:', error);
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

