import { API_URL, getCurrentDomain } from '../config';

const ALLOWED_DOMAINS = [
  'krealgram.com',
  'www.krealgram.com',
  'krealgram.vercel.app',
  'localhost',
  'krealgram-backend.onrender.com',
  '127.0.0.1'
];

// Функция для извлечения Google Drive File ID из различных форматов URL
const extractGoogleDriveFileId = (url) => {
  if (!url || !url.includes('drive.google.com')) return null;
  
  try {
    // Формат: https://drive.google.com/uc?id=FILE_ID
    const ucMatch = url.match(/[?&]id=([^&]+)/);
    if (ucMatch) return ucMatch[1];
    
    // Формат: https://drive.google.com/file/d/FILE_ID/view
    const fileMatch = url.match(/\/file\/d\/([^/]+)/);
    if (fileMatch) return fileMatch[1];
    
    // Формат: https://drive.google.com/open?id=FILE_ID
    const openMatch = url.match(/open\?id=([^&]+)/);
    if (openMatch) return openMatch[1];
    
    // Если URL заканчивается на FILE_ID
    const parts = url.split('/');
    const lastPart = parts[parts.length - 1];
    if (lastPart && lastPart.length > 20 && !lastPart.includes('.')) {
      return lastPart;
    }
    
    return null;
  } catch (error) {
    console.error('Ошибка извлечения Google Drive ID:', error);
    return null;
  }
};

export const resolveMediaUrl = (url, type = 'image') => {
  const startTime = performance.now();
  
  // Определяем мобильное устройство
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  
  try {
    // Если URL пустой - возвращаем дефолтное изображение только для определенных типов
    if (!url) {
      const defaultMap = {
        'image': '/default-post-placeholder.png',
        'video': '/video-placeholder.svg',
        'avatar': '/default-avatar.png',
        'message': null  // Для сообщений возвращаем null
      };
      
      return defaultMap[type] || '/default-avatar.png';
    }

    // Если передан объект, извлекаем URL с минимальными проверками
    if (typeof url === 'object' && url !== null) {
      const urlKeys = [
        'imageUrl', 'image', 'thumbnailUrl', 
        'videoUrl', 'avatarUrl', 'url', 
        'secure_url', 'path'
      ];

      for (const key of urlKeys) {
        if (url[key]) {
          url = url[key];
          break;
        }
      }
      
      if (typeof url === 'object') {
        return type === 'message' ? null : '/default-avatar.png';
      }
    }

    // Если URL все еще пустой после извлечения
    if (!url) {
      return type === 'message' ? null : '/default-avatar.png';
    }

    // Обработка локальных путей для сообщений
    if (url.startsWith('/opt/render/') || url.startsWith('/tmp/') || url.startsWith('/var/')) {
      // Извлекаем только имя файла, убирая все лишние пути
      const filename = url.split('/').pop();
      
      // Проверяем, что имя файла корректное
      if (!filename || filename === url) {
        return type === 'message' ? null : '/default-avatar.png';
      }
      
      // Для сообщений используем проксирование через API
      const proxyUrl = `${API_URL}/api/proxy-drive/${encodeURIComponent(filename)}?type=${type}`;
      
      return proxyUrl;
    }

    // Если уже полный HTTP/HTTPS URL
    if (url.startsWith('http')) {
      // Google Drive обработка
      if (url.includes('drive.google.com')) {
        const fileId = extractGoogleDriveFileId(url);
        
        if (fileId) {
          // Всегда используем прокси для Google Drive файлов
          const proxyUrl = `${API_URL}/api/proxy-drive/${fileId}?type=${type}`;
          return proxyUrl;
        } else {
          // Если не удалось извлечь ID, возвращаем оригинальный URL как fallback
          console.warn('Не удалось извлечь Google Drive ID из URL:', url);
          return url;
        }
      }

      // Проверяем, что URL с разрешенного домена
      try {
        const parsedUrl = new URL(url);
        const currentDomain = getCurrentDomain();
        
        // Если текущий домен не совпадает с доменом URL, используем проксирование
        if (!ALLOWED_DOMAINS.some(domain => parsedUrl.hostname.includes(domain))) {
          const proxyUrl = `${API_URL}/api/proxy-drive/${encodeURIComponent(url)}?type=${type}`;
          return proxyUrl;
        }
      } catch (error) {
        // Тихо обрабатываем ошибку
      }
      
      return url;
    }

    // Локальные пути
    const localUrlMap = {
      'image': `${API_URL}/uploads/${url}`,
      'video': `${API_URL}/uploads/${url}`,
      'avatar': `${API_URL}/uploads/avatars/${url}`,
      'message': `${API_URL}/uploads/${url}`
    };

    return localUrlMap[type] || `${API_URL}/uploads/${url}`;

  } catch (error) {
    console.error('Ошибка в resolveMediaUrl:', error);
    return type === 'message' ? null : '/default-avatar.png';
  } finally {
    const endTime = performance.now();
    // Убираем лишний лог
    // console.log(`resolveMediaUrl: ${endTime - startTime}ms`, { url, type });
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

// Отладочная функция для тестирования
export const testMediaUrlResolver = () => {
  const testCases = [
    { input: null, type: 'avatar', description: 'Null значение' },
    { input: '', type: 'avatar', description: 'Пустая строка' },
    { input: 'test.jpg', type: 'avatar', description: 'Локальный файл' },
    { input: '/uploads/avatars/test.jpg', type: 'avatar', description: 'Путь с uploads' },
    { input: 'https://drive.google.com/uc?id=123', type: 'avatar', description: 'Google Drive URL' },
    { input: { avatarUrl: 'test.jpg' }, type: 'avatar', description: 'Объект с avatarUrl' }
  ];

  console.group('🔍 MediaUrlResolver Test');
  testCases.forEach(({ input, type, description }) => {
    try {
      const result = resolveMediaUrl(input, type);
      console.log(`📸 ${description}:`, {
        input,
        type,
        result
      });
    } catch (error) {
      console.error(`❌ Ошибка для ${description}:`, error);
    }
  });
  console.groupEnd();
}; 