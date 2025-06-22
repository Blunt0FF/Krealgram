const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const cloudinary = require('cloudinary').v2;
const Tiktok = require('tiktokapi-src');
const fetch = require('node-fetch');

class VideoDownloader {
  constructor() {
    this.tempDir = path.join(__dirname, '../temp');
    this.ensureTempDir();

    // Cloudinary configuration
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
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
      
      // Загружаем в Cloudinary
      console.log('📤 Uploading to Cloudinary...');
      const cloudinaryResult = await this.uploadToCloudinary(videoBuffer, 'video', 'tiktok');

      return {
        success: true,
        platform: 'tiktok',
        videoInfo: {
          title: result.result.description || result.result.desc || 'TikTok Video',
          duration: result.result.video?.duration || null,
          uploader: result.result.author?.nickname || 'TikTok User',
          viewCount: result.result.statistics?.playCount || null
        },
        cloudinaryUrl: cloudinaryResult.secure_url,
        publicId: cloudinaryResult.public_id,
        duration: cloudinaryResult.duration,
        width: cloudinaryResult.width,
        height: cloudinaryResult.height,
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

  async uploadToCloudinary(buffer, resourceType = 'video', folder = 'external-videos') {
    return new Promise((resolve, reject) => {
      const uploadOptions = {
        resource_type: resourceType,
        folder: folder,
        quality: 'auto',
        fetch_format: 'auto'
      };

      if (resourceType === 'video') {
        uploadOptions.transformation = [
          { quality: '720p', if: 'w_gt_1280' },
          { quality: 'auto', if: 'else' }
        ];
      }

      const uploadStream = cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          if (error) {
            console.error('❌ Cloudinary upload error:', error);
            reject(error);
          } else {
            console.log('✅ Cloudinary upload successful:', result.public_id);
            resolve(result);
          }
        }
      );

      uploadStream.end(buffer);
    });
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

