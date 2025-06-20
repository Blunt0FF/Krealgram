const express = require('express');
const router = express.Router();
const axios = require('axios');
const cloudinary = require('../config/cloudinary');

// Поддерживаемые платформы
const SUPPORTED_PLATFORMS = {
  tiktok: /tiktok\.com|vm\.tiktok\.com/,
  instagram: /instagram\.com\/(?:p|reel)\//,
  vk: /vk\.com\/video|vkvideo\.ru/,
  youtube: /youtube\.com\/watch\?v=|youtu\.be\//
};

// Определение платформы по URL
const detectPlatform = (url) => {
  for (const [platform, regex] of Object.entries(SUPPORTED_PLATFORMS)) {
    if (regex.test(url)) {
      return platform;
    }
  }
  return null;
};

// API для загрузки видео с внешних платформ
const downloadVideoFromUrl = async (url, platform) => {
  try {
    // Для начала используем простой подход - пытаемся загрузить через различные API
    
    // Пример использования RapidAPI или других сервисов
    const downloaderAPIs = [
      {
        name: 'TikTok Downloader',
        url: 'https://tiktok-video-no-watermark2.p.rapidapi.com/',
        headers: {
          'X-RapidAPI-Key': process.env.RAPIDAPI_KEY || '',
          'X-RapidAPI-Host': 'tiktok-video-no-watermark2.p.rapidapi.com'
        },
        platforms: ['tiktok']
      },
      {
        name: 'Instagram Downloader',
        url: 'https://instagram-downloader-download-instagram-videos-stories.p.rapidapi.com/index',
        headers: {
          'X-RapidAPI-Key': process.env.RAPIDAPI_KEY || '',
          'X-RapidAPI-Host': 'instagram-downloader-download-instagram-videos-stories.p.rapidapi.com'
        },
        platforms: ['instagram']
      }
    ];

    // Альтернативный подход - использование бесплатных API
    const freeAPIs = [
      {
        name: 'SaveFrom.net API',
        url: 'https://worker-savefrom.herokuapp.com/api/download',
        platforms: ['tiktok', 'instagram', 'vk']
      },
      {
        name: 'SnapTik API',
        url: 'https://snaptik.app/abc',
        platforms: ['tiktok']
      }
    ];

    // Пытаемся загрузить через разные API
    for (const api of freeAPIs) {
      if (api.platforms.includes(platform)) {
        try {
          const response = await axios.post(api.url, {
            url: url,
            format: 'mp4'
          }, {
            timeout: 30000,
            headers: api.headers || {
              'Content-Type': 'application/json',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
          });

          if (response.data && response.data.download_url) {
            return response.data.download_url;
          }
        } catch (error) {
          console.log(`API ${api.name} failed:`, error.message);
          continue;
        }
      }
    }

    throw new Error('No working downloader API found');
  } catch (error) {
    throw new Error(`Failed to download video: ${error.message}`);
  }
};

// Загрузка видео на Cloudinary
const uploadToCloudinary = async (videoUrl, originalUrl) => {
  try {
    const result = await cloudinary.uploader.upload(videoUrl, {
      resource_type: 'video',
      folder: 'krealgram/posts',
      transformation: [
        { quality: 'auto' },
        { format: 'mp4' }
      ]
    });

    return {
      url: result.secure_url,
      publicId: result.public_id,
      duration: result.duration,
      format: result.format,
      originalUrl: originalUrl
    };
  } catch (error) {
    throw new Error(`Failed to upload to Cloudinary: ${error.message}`);
  }
};

// POST /api/video-downloader/download
router.post('/download', async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    // Определяем платформу
    const platform = detectPlatform(url);
    if (!platform) {
      return res.status(400).json({ error: 'Unsupported platform' });
    }

    // Для YouTube и TikTok возвращаем как внешние видео (встраивание)
    if (platform === 'youtube' || platform === 'tiktok') {
      return res.json({
        success: true,
        platform: platform,
        originalUrl: url,
        embedUrl: url,
        type: 'external'
      });
    }

    // Пытаемся загрузить видео с других платформ
    try {
      const downloadUrl = await downloadVideoFromUrl(url, platform);
      
      // Загружаем на Cloudinary
      const cloudinaryResult = await uploadToCloudinary(downloadUrl, url);

      res.json({
        success: true,
        platform: platform,
        originalUrl: url,
        cloudinaryUrl: cloudinaryResult.url,
        publicId: cloudinaryResult.publicId,
        duration: cloudinaryResult.duration,
        type: 'uploaded'
      });
    } catch (downloadError) {
      // Если загрузка не удалась, возвращаем как внешнее видео
      console.log(`Failed to download ${platform} video, returning as external:`, downloadError.message);
      
      res.json({
        success: true,
        platform: platform,
        originalUrl: url,
        embedUrl: url,
        type: 'external',
        note: 'Video will be displayed as external embed due to download limitations'
      });
    }

  } catch (error) {
    console.error('Video download error:', error);
    res.status(500).json({ 
      error: error.message,
      fallback: 'Try using the original URL as external video'
    });
  }
});

// GET /api/video-downloader/platforms
router.get('/platforms', (req, res) => {
  res.json({
    supported: Object.keys(SUPPORTED_PLATFORMS),
    patterns: SUPPORTED_PLATFORMS
  });
});

// POST /api/video-downloader/validate
router.post('/validate', (req, res) => {
  const { url } = req.body;
  
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  const platform = detectPlatform(url);
  
  res.json({
    valid: !!platform,
    platform: platform,
    supported: !!platform
  });
});

module.exports = router; 