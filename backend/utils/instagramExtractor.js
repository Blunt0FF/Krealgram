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
    
    // Пробуем получить данные через Instagram API
    const apiUrl = `https://www.instagram.com/api/v1/media/${shortcode}/info/`;
    
    const response = await axios.get(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
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
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      },
      timeout: 15000
    });
    
    const html = response.data;
    
    // Ищем JSON данные в HTML
    const jsonMatch = html.match(/window\._sharedData\s*=\s*({.+?});/);
    if (jsonMatch) {
      const sharedData = JSON.parse(jsonMatch[1]);
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
    }
    
    // Альтернативный поиск через meta теги
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
    
    throw new Error('No video data found in HTML');
    
  } catch (error) {
    console.log('❌ HTML parsing method failed:', error.message);
    throw error;
  }
}

// Метод 3: Использование внешнего API (fallback)
async function extractViaExternalAPI(url) {
  try {
    console.log('🔍 Trying external API method...');
    
    // Здесь можно добавить вызов к рабочему внешнему API
    // Например, если получим ключ от RapidAPI
    
    // Пример с гипотетическим API
    const apiResponse = await axios.post('https://api.example.com/instagram', {
      url: url
    }, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000
    });
    
    if (apiResponse.data && apiResponse.data.download_url) {
      return {
        success: true,
        platform: 'instagram',
        videoUrl: apiResponse.data.download_url,
        thumbnailUrl: apiResponse.data.thumbnail_url || null,
        title: apiResponse.data.title || 'Instagram Video',
        author: apiResponse.data.author || 'Unknown',
        originalUrl: url
      };
    }
    
    throw new Error('External API returned no data');
    
  } catch (error) {
    console.log('❌ External API method failed:', error.message);
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
    // extractViaExternalAPI  // Закомментировано, пока нет рабочего API
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
  extractViaExternalAPI
}; 