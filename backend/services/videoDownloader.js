const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const { uploadToGoogleDrive } = require('../utils/mediaHelper');
const Tiktok = require('tiktokapi-src');


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

  async downloadTikTokVideo(url) {
    try {
      console.log('🎵 Downloading TikTok video:', url);
      
      // Пробуем разные версии API
      let result = null;
      let videoUrl = null;
      
      for (const version of ['v2', 'v1', 'v3']) {
        try {
          console.log(`🔄 Trying TikTok API ${version}...`);
          result = await Tiktok.Downloader(url, { version });
          
          if (result.status === 'success' && result.result) {
            if (result.result.video) {
              if (Array.isArray(result.result.video.downloadAddr)) {
                videoUrl = result.result.video.downloadAddr[0]; // v1 API
              } else if (typeof result.result.video === 'string') {
                videoUrl = result.result.video; // v2 API
              }
              
              if (videoUrl) {
                console.log(`✅ Got video URL from ${version}:`, videoUrl);
                break;
              }
            }
          }
        } catch (versionError) {
          console.log(`❌ ${version} failed:`, versionError.message);
        }
      }

      if (!videoUrl || !result) {
        throw new Error('Failed to get video URL from all TikTok APIs');
      }

      // Скачиваем видео
      console.log('📥 Downloading video buffer...');
      const response = await fetch(videoUrl);
      
      if (!response.ok) {
        throw new Error(`Failed to download video: ${response.status}`);
      }
      
      const videoBuffer = await response.buffer();
      console.log('✅ Video downloaded, size:', videoBuffer.length, 'bytes');
      
      console.log('📤 Uploading to Google Drive...');
      const driveResult = await uploadToGoogleDrive(videoBuffer, 'video.mp4', 'video/mp4');

      return {
        success: true,
        platform: 'tiktok',
        videoInfo: {
          title: result.result.description || result.result.desc || 'TikTok Video',
          duration: result.result.video?.duration || null,
          uploader: result.result.author?.nickname || 'TikTok User',
          viewCount: result.result.statistics?.playCount || null
        },
        videoUrl: driveResult.videoUrl, // Прямая ссылка на видео в GDrive
        thumbnailUrl: driveResult.thumbnailUrl, // Ссылка на превью
        fileId: driveResult.fileId, // ID файла в GDrive
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

