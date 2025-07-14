import { API_URL, getCurrentDomain } from '../config';

const ALLOWED_DOMAINS = [
  'krealgram.com',
  'www.krealgram.com',
  'krealgram.vercel.app',
  'localhost',
  'krealgram-backend.onrender.com',
  '127.0.0.1'
];

export const resolveMediaUrl = (url, type = 'image') => {
  // Уменьшаем количество логов
  const shouldLog = type === 'message' || type === 'avatar';
  
  if (shouldLog) {
    console.group(`🔗 resolveMediaUrl [${type}]`);
    console.log('Input URL:', url);
  }

  try {
    // Если URL пустой - возвращаем дефолтное изображение только для определенных типов
    if (!url) {
      const defaultMap = {
        'image': '/default-post-placeholder.png',
        'video': '/video-placeholder.svg',
        'avatar': '/default-avatar.png',
        'message': null  // Для сообщений возвращаем null
      };
      
      if (shouldLog) {
        console.log('🚫 Empty URL, returning default', defaultMap[type]);
      }
      
      return defaultMap[type] || '/default-avatar.png';
    }

    // Если передан объект, извлекаем URL с расширенной отладкой
    if (typeof url === 'object' && url !== null) {
      const urlKeys = [
        'imageUrl', 'image', 'thumbnailUrl', 
        'videoUrl', 'avatarUrl', 'url', 
        'secure_url', 'path'
      ];

      for (const key of urlKeys) {
        if (url[key]) {
          if (shouldLog) {
            console.log(`🔍 Extracted URL from key '${key}':`, url[key]);
          }
          url = url[key];
          break;
        }
      }
      
      if (typeof url === 'object') {
        if (shouldLog) {
          console.warn('⚠️ Could not extract URL from object:', url);
        }
        return type === 'message' ? null : '/default-avatar.png';
      }
    }

    // Если URL все еще пустой после извлечения
    if (!url) {
      if (shouldLog) {
        console.warn('⚠️ Could not extract URL');
      }
      return type === 'message' ? null : '/default-avatar.png';
    }

    // Обработка локальных путей для сообщений
    if (url.startsWith('/opt/render/') || url.startsWith('/tmp/') || url.startsWith('/var/')) {
      // Извлекаем только имя файла, убирая все лишние пути
      const filename = url.split('/').pop();
      
      // Проверяем, что имя файла корректное
      if (!filename || filename === url) {
        if (shouldLog) {
          console.warn('⚠️ Некорректное имя файла:', filename);
        }
        return type === 'message' ? null : '/default-avatar.png';
      }
      
      const proxyUrl = `${API_URL}/api/proxy-drive/${process.env.GOOGLE_DRIVE_MESSAGES_FOLDER_ID}/${filename}?type=${type}`;
      
      if (shouldLog) {
        console.log('📁 Message file path detected:', {
          originalPath: url,
          extractedFilename: filename,
          proxyUrl
        });
      }
      
      return proxyUrl;
    }

    // Если уже полный HTTP/HTTPS URL
    if (url.startsWith('http')) {
      // Google Drive обработка с расширенной отладкой
      if (url.includes('drive.google.com')) {
        try {
          const fileId = 
            new URL(url).searchParams.get('id') || 
            url.split('/').pop() || 
            url.match(/\/file\/d\/([^/]+)/)?.[1] ||
            url.match(/\/uc\?id=([^&]+)/)?.[1];
          
          if (fileId) {
            if (shouldLog) {
              console.log('🔑 Google Drive FileID:', fileId);
            }
            const proxyUrl = `${API_URL}/api/proxy-drive/${fileId}?type=${type}`;
            
            if (shouldLog) {
              console.log('🌐 Proxy URL:', proxyUrl);
            }
            
            return proxyUrl;
          }
        } catch (error) {
          if (shouldLog) {
            console.error('❌ Google Drive URL parsing error:', error);
          }
        }
      }

      // Проверяем, что URL с разрешенного домена
      try {
        const parsedUrl = new URL(url);
        const currentDomain = getCurrentDomain();
        
        // Если текущий домен не совпадает с доменом URL, используем проксирование
        if (!ALLOWED_DOMAINS.some(domain => parsedUrl.hostname.includes(domain))) {
          if (shouldLog) {
            console.log(`🌍 Proxying URL from domain: ${parsedUrl.hostname}`);
          }
          const proxyUrl = `${API_URL}/api/proxy-drive/${encodeURIComponent(url)}?type=${type}`;
          
          if (shouldLog) {
            console.log('🔀 Proxy URL:', proxyUrl);
          }
          
          return proxyUrl;
        }
      } catch (error) {
        if (shouldLog) {
          console.warn('⚠️ URL parsing error:', error);
        }
      }

      if (shouldLog) {
        console.log('✅ Returning original URL:', url);
      }
      
      return url;
    }

    // Локальные пути с расширенной отладкой
    const localUrlMap = {
      'image': `${API_URL}/uploads/${url}`,
      'video': `${API_URL}/uploads/${url}`,
      'avatar': `${API_URL}/uploads/avatars/${url}`,
      'message': `${API_URL}/uploads/${url}`
    };

    const localUrl = localUrlMap[type];
    
    if (shouldLog) {
      console.log('📁 Local URL:', localUrl);
    }
    
    return localUrl;

  } catch (error) {
    if (shouldLog) {
      console.error('❌ Critical error in resolveMediaUrl:', error);
    }
    return type === 'message' ? null : '/default-avatar.png';
  } finally {
    if (shouldLog) {
      console.groupEnd();
    }
  }
};

export const getImageUrl = (url) => resolveMediaUrl(url, 'image');
export const getVideoUrl = (url) => resolveMediaUrl(url, 'video');
export const getAvatarUrl = (url) => resolveMediaUrl(url, 'avatar');

// Функция для проверки безопасности домена
export const isUrlAllowed = (url) => {
  try {
    const parsedUrl = new URL(url);
    return ALLOWED_DOMAINS.some(domain => 
      parsedUrl.hostname.includes(domain)
    );
  } catch {
    return false;
  }
}; 