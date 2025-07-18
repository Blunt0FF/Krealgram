const axios = require('axios');

/**
 * Простой Instagram видео экстрактор
 * Использует несколько методов для извлечения видео с Instagram
 */

// Метод 1: Попытка извлечения через публичные данные Instagram
async function extractViaInstagramAPI(url) {
  try {
    console.log('🔍 Trying Instagram public data extraction...');
    
    // Извлекаем shortcode из URL
    const shortcodeMatch = url.match(/\/(?:p|reel)\/([^\/\?]+)/);
    if (!shortcodeMatch) {
      throw new Error('Invalid Instagram URL format');
    }
    
    const shortcode = shortcodeMatch[1];
    console.log(`📝 Extracted shortcode: ${shortcode}`);
    
    // Сначала получаем сессию
    const sessionResponse = await axios.get('https://www.instagram.com/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1'
      },
      timeout: 10000
    });
    
    // Извлекаем csrf token
    const csrfMatch = sessionResponse.data.match(/"csrf_token":"([^"]+)"/);
    const csrfToken = csrfMatch ? csrfMatch[1] : '';
    
    // Пробуем получить данные через Instagram API
    const apiUrl = `https://www.instagram.com/api/v1/media/${shortcode}/info/`;
    
    const response = await axios.get(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'X-CSRFToken': csrfToken,
        'X-Requested-With': 'XMLHttpRequest',
        'X-IG-App-ID': '936619743392459',
        'X-IG-WWW-Claim': '0',
        'Referer': 'https://www.instagram.com/',
        'Origin': 'https://www.instagram.com',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin'
      },
      timeout: 10000
    });
    
    if (response.data && response.data.items && response.data.items[0]) {
      const media = response.data.items[0];
      
      if (media.video_versions && media.video_versions.length > 0) {
        const videoUrl = media.video_versions[0].url;
        
        return {
          success: true,
          platform: 'instagram',
          videoUrl: videoUrl,
          thumbnailUrl: media.image_versions2?.candidates?.[0]?.url || null,
          title: media.caption?.text || 'Instagram Video',
          author: media.user?.username || 'Unknown',
          duration: media.video_duration || null,
          originalUrl: url
        };
      }
    }
    
    throw new Error('No video data found in API response');
    
  } catch (error) {
    console.log('❌ Instagram API method failed:', error.message);
    throw error;
  }
}

// Метод 2: Попытка извлечения через HTML парсинг
async function extractViaHTMLParsing(url) {
  try {
    console.log('🔍 Trying HTML parsing method...');
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1'
      },
      timeout: 15000
    });
    
    const html = response.data;
    
    // Ищем JSON данные в HTML (новый формат)
    const jsonMatch = html.match(/<script type="application\/ld\+json">(.+?)<\/script>/);
    if (jsonMatch) {
      try {
        const jsonData = JSON.parse(jsonMatch[1]);
        if (jsonData.video && jsonData.video.contentUrl) {
          return {
            success: true,
            platform: 'instagram',
            videoUrl: jsonData.video.contentUrl,
            thumbnailUrl: jsonData.image || null,
            title: jsonData.name || 'Instagram Video',
            author: jsonData.author?.name || 'Unknown',
            originalUrl: url
          };
        }
      } catch (e) {
        console.log('Failed to parse JSON-LD:', e.message);
      }
    }
    
    // Ищем старый формат JSON данных
    const sharedDataMatch = html.match(/window\._sharedData\s*=\s*({.+?});/);
    if (sharedDataMatch) {
      try {
        const sharedData = JSON.parse(sharedDataMatch[1]);
      const media = sharedData?.entry_data?.PostPage?.[0]?.graphql?.shortcode_media;
      
      if (media && media.video_url) {
        return {
          success: true,
          platform: 'instagram',
          videoUrl: media.video_url,
          thumbnailUrl: media.display_url,
          title: media.edge_media_to_caption?.edges?.[0]?.node?.text || 'Instagram Video',
          author: media.owner?.username || 'Unknown',
          duration: media.video_duration || null,
          originalUrl: url
        };
        }
      } catch (e) {
        console.log('Failed to parse _sharedData:', e.message);
      }
    }
    
    // Поиск через meta теги
    const metaVideoMatch = html.match(/<meta property="og:video" content="([^"]+)"/);
    const metaTitleMatch = html.match(/<meta property="og:title" content="([^"]+)"/);
    const metaImageMatch = html.match(/<meta property="og:image" content="([^"]+)"/);
    
    if (metaVideoMatch) {
      return {
        success: true,
        platform: 'instagram',
        videoUrl: metaVideoMatch[1],
        thumbnailUrl: metaImageMatch ? metaImageMatch[1] : null,
        title: metaTitleMatch ? metaTitleMatch[1] : 'Instagram Video',
        author: 'Unknown',
        originalUrl: url
      };
    }
    
    // Поиск через дополнительные meta теги
    const additionalVideoMatch = html.match(/<meta name="twitter:player:stream" content="([^"]+)"/);
    if (additionalVideoMatch) {
      return {
        success: true,
        platform: 'instagram',
        videoUrl: additionalVideoMatch[1],
        thumbnailUrl: null,
        title: 'Instagram Video',
        author: 'Unknown',
        originalUrl: url
      };
    }
    
    throw new Error('No video data found in HTML');
    
  } catch (error) {
    console.log('❌ HTML parsing method failed:', error.message);
    throw error;
  }
}

// Метод 3: Использование yt-dlp (fallback)
async function extractViaYtDlp(url) {
  try {
    console.log('🔍 Trying yt-dlp method...');
    
    const { spawn } = require('child_process');
    const path = require('path');
    
    return new Promise((resolve, reject) => {
      const ytDlp = spawn('yt-dlp', [
        '--print', '%(url)s|%(title)s|%(uploader)s|%(duration)s|%(thumbnail)s',
        '--no-playlist',
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
        if (code === 0 && output.trim()) {
          const [videoUrl, title, uploader, duration, thumbnail] = output.trim().split('|');
    
          if (videoUrl && videoUrl !== 'NA') {
            resolve({
        success: true,
        platform: 'instagram',
              videoUrl: videoUrl,
              thumbnailUrl: thumbnail !== 'NA' ? thumbnail : null,
              title: title !== 'NA' ? title : 'Instagram Video',
              author: uploader !== 'NA' ? uploader : 'Unknown',
              duration: duration !== 'NA' ? parseInt(duration) : null,
        originalUrl: url
            });
          } else {
            reject(new Error('yt-dlp returned no video URL'));
          }
        } else {
          reject(new Error(`yt-dlp failed: ${errorOutput}`));
        }
      });
    });
    
  } catch (error) {
    console.log('❌ yt-dlp method failed:', error.message);
    throw error;
  }
}

// Основная функция экстрактора
async function extractInstagramVideo(url) {
  console.log(`🚀 Starting Instagram video extraction for: ${url}`);
  
  // Проверяем, что это действительно Instagram URL
  if (!url.includes('instagram.com')) {
    throw new Error('Not an Instagram URL');
  }
  
  // Список методов для попытки извлечения
  const extractionMethods = [
    extractViaInstagramAPI,
    extractViaHTMLParsing,
    extractViaYtDlp  // Добавляем yt-dlp как fallback
  ];
  
  let lastError = null;
  
  // Пробуем каждый метод по очереди
  for (const method of extractionMethods) {
    try {
      const result = await method(url);
      
      if (result && result.success && result.videoUrl) {
        console.log('✅ Instagram video extraction successful!');
        console.log(`📹 Video URL: ${result.videoUrl}`);
        console.log(`🖼️ Thumbnail: ${result.thumbnailUrl}`);
        console.log(`📝 Title: ${result.title}`);
        
        return result;
      }
    } catch (error) {
      lastError = error;
      console.log(`⚠️ Method failed: ${error.message}`);
      // Продолжаем со следующим методом
    }
  }
  
  // Если все методы не сработали
  console.log('❌ All Instagram extraction methods failed');
  throw new Error(`Instagram extraction failed: ${lastError?.message || 'Unknown error'}`);
}

// Функция для проверки, является ли URL Instagram видео
function isInstagramVideoURL(url) {
  return url.includes('instagram.com') && (url.includes('/p/') || url.includes('/reel/'));
}

// Функция для извлечения shortcode из Instagram URL
function extractShortcode(url) {
  const match = url.match(/\/(?:p|reel)\/([^\/\?]+)/);
  return match ? match[1] : null;
}

module.exports = {
  extractInstagramVideo,
  isInstagramVideoURL,
  extractShortcode,
  
  // Экспортируем отдельные методы для тестирования
  extractViaInstagramAPI,
  extractViaHTMLParsing,
  extractViaYtDlp
}; 