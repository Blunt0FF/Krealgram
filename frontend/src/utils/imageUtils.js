import { API_URL } from '../config';
import axios from 'axios'; // Added missing import for axios

/**
 * Сжимает изображение до указанного размера и качества
 * @param {File} file - файл изображения
 * @param {number} maxWidth - максимальная ширина
 * @param {number} maxHeight - максимальная высота  
 * @param {number} quality - качество (0.1 - 1.0)
 * @param {string} type - тип выходного изображения (например, 'image/jpeg' или 'image/webp')
 * @returns {Promise<Blob>} - Blob сжатого изображения
 */
export const compressImage = (file, maxWidth = 800, maxHeight = 800, quality = 0.8, type = 'image/jpeg') => {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      // Вычисляем новые размеры с сохранением пропорций
      let { width, height } = img;
      
      if (width > height) {
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = (width * maxHeight) / height;
          height = maxHeight;
        }
      }

      // Устанавливаем размеры canvas
      canvas.width = width;
      canvas.height = height;

      // Рисуем сжатое изображение
      ctx.drawImage(img, 0, 0, width, height);

      // Конвертируем в Blob
      canvas.toBlob(
        (blob) => {
          if (blob) {
            console.log(`Изображение сжато: ${file.size} байт -> ${blob.size} байт`);
            resolve(blob);
          } else {
            reject(new Error('Ошибка создания Blob из canvas'));
          }
        },
        type, // Используем переданный тип
        quality
      );
    };

    img.onerror = () => {
      reject(new Error('Ошибка загрузки изображения'));
    };

    // Загружаем изображение
    const reader = new FileReader();
    reader.onload = (e) => {
      img.src = e.target.result;
    };
    reader.onerror = () => {
      reject(new Error('Ошибка чтения файла'));
    };
    reader.readAsDataURL(file);
  });
};

/**
 * Сжимает аватар до квадратного изображения WebP 250x250 и возвращает base64 строку.
 * @param {File} file - файл изображения
 * @returns {Promise<string>} - base64 строка сжатого аватара (data:image/webp;base64,...)
 */
export const compressAvatar = (file) => {
  return new Promise((resolve, reject) => {
    if (!isImageFile(file)) {
      return reject(new Error('Файл не является изображением.'));
    }

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const targetSize = 500; // Увеличенный размер для лучшего качества

      canvas.width = targetSize;
      canvas.height = targetSize;

      // Обрезка и масштабирование изображения до квадрата
      let sourceX = 0;
      let sourceY = 0;
      let sourceWidth = img.width;
      let sourceHeight = img.height;

      if (img.width > img.height) { // Горизонтальное изображение
        sourceX = (img.width - img.height) / 2;
        sourceWidth = img.height;
      } else if (img.height > img.width) { // Вертикальное изображение
        sourceY = (img.height - img.width) / 2;
        sourceHeight = img.width;
      }

      ctx.drawImage(img, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, targetSize, targetSize);

      // Сжатие с несколькими попытками
      const compressImage = (quality, type) => {
        try {
          const dataUrl = canvas.toDataURL(type, quality);
          const sizeKB = getFileSizeKB(dataUrl);
          
          console.log(`Аватар сжат: ${type}, качество ${quality}, размер ${sizeKB} КБ`);
          
          return { dataUrl, sizeKB };
        } catch (error) {
          console.error(`Ошибка сжатия ${type}:`, error);
          return null;
        }
      };

      // Пытаемся сжать в WebP, затем в JPEG
      const webpResult = compressImage(0.8, 'image/webp');
      const jpegResult = webpResult && webpResult.sizeKB > 200 
        ? compressImage(0.6, 'image/jpeg') 
        : null;

      if (webpResult && webpResult.sizeKB <= 200) {
        console.log('Выбран WebP формат');
        resolve(webpResult.dataUrl);
      } else if (jpegResult) {
        console.log('Выбран JPEG формат');
        resolve(jpegResult.dataUrl);
      } else {
        // Последняя попытка с минимальным качеством
        const fallbackResult = compressImage(0.4, 'image/jpeg');
        if (fallbackResult) {
          console.log('Выбран fallback JPEG формат');
          resolve(fallbackResult.dataUrl);
        } else {
          reject(new Error('Не удалось сжать изображение'));
        }
      }
    };

    img.onerror = () => {
      reject(new Error('Не удалось загрузить изображение для сжатия аватара.'));
    };

    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target && typeof e.target.result === 'string') {
        console.log('Тип загруженного изображения:', e.target.result.substring(0, 50));
        img.src = e.target.result;
      } else {
        reject(new Error('Ошибка чтения файла аватара.'));
      }
    };
    reader.onerror = () => {
      reject(new Error('Ошибка FileReader при чтении файла аватара.'));
    };
    reader.readAsDataURL(file);
  });
};

/**
 * Возвращает оригинальный файл для поста (без сжатия на фронте)
 * @param {File} file - файл изображения  
 * @returns {Promise<File>} - Оригинальный файл без изменений
 */
export const compressPostImage = (file) => {
  // Возвращаем оригинальный файл без сжатия
  // Сжатие будет происходить на backend с сохранением оригинального разрешения
  return Promise.resolve(file);
};

// Сжатие изображения для сообщений (до 100КБ)
export const compressMessageImage = (file, maxSizeKB = 100) => {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      // Вычисляем новые размеры для сообщений
      const maxWidth = 800;
      const maxHeight = 600;
      let { width, height } = img;
      
      if (width > height) {
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = (width * maxHeight) / height;
          height = maxHeight;
        }
      }
      
      canvas.width = width;
      canvas.height = height;
      
      // Рисуем изображение
      ctx.drawImage(img, 0, 0, width, height);
      
      // Сжимаем до нужного размера
      let quality = 0.9;
      let compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
      
      // Если размер больше maxSizeKB, уменьшаем качество
      while (compressedDataUrl.length > maxSizeKB * 1024 && quality > 0.1) {
        quality -= 0.1;
        compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
      }
      
      resolve(compressedDataUrl);
    };
    
    img.src = URL.createObjectURL(file);
  });
};

// Сжатие аватара с продвинутыми настройками (до 50КБ)
export const compressAvatarAdvanced = (file, maxSizeKB = 50) => {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      // Аватар всегда квадратный
      const size = 400;
      canvas.width = size;
      canvas.height = size;
      
      // Обрезаем изображение по центру
      const { width, height } = img;
      const minDimension = Math.min(width, height);
      const startX = (width - minDimension) / 2;
      const startY = (height - minDimension) / 2;
      
      ctx.drawImage(img, startX, startY, minDimension, minDimension, 0, 0, size, size);
      
      // Сжимаем
      let quality = 0.8;
      let compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
      
      while (compressedDataUrl.length > maxSizeKB * 1024 && quality > 0.1) {
        quality -= 0.1;
        compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
      }
      
      resolve(compressedDataUrl);
    };
    
    img.src = URL.createObjectURL(file);
  });
};

// Проверка типа файла
export const isImageFile = (file) => {
  return file && file.type.startsWith('image/');
};

// Получение размера файла в КБ
export const getFileSizeKB = (dataUrl) => {
  return Math.round(dataUrl.length / 1024);
}; 

export const getImageUrl = (imagePath, options = {}) => {
  // Если передан объект, извлекаем URL
  if (typeof imagePath === 'object' && imagePath !== null) {
    const urlSources = [
      'imageUrl', 
      'image', 
      'thumbnailUrl', 
      'url', 
      'src',
      'preview',
      'gifPreview',
      'originalFilename'
    ];

    for (const source of urlSources) {
      if (imagePath[source]) {
        imagePath = imagePath[source];
        break;
      }
    }
  }

  // Если URL пустой, возвращаем placeholder
  if (!imagePath) {
    return '/default-post-placeholder.png';
  }

  // Обработка Google Drive URL
  if (imagePath.includes('drive.google.com')) {
    const googleDrivePatterns = [
      /https:\/\/drive\.google\.com\/uc\?id=([^&]+)/,
      /https:\/\/drive\.google\.com\/file\/d\/([^/]+)/,
      /https:\/\/drive\.google\.com\/open\?id=([^&]+)/
    ];

    for (const pattern of googleDrivePatterns) {
      const match = imagePath.match(pattern);
      if (match && match[1]) {
        const baseUrl = window.location.hostname.includes('krealgram.com') || window.location.hostname.includes('vercel.app')
          ? 'https://krealgram-backend.onrender.com'
          : 'http://localhost:3000';
        return `${baseUrl}/api/proxy-drive/${match[1]}`;
      }
    }
  }

  // Если это уже полный URL, возвращаем как есть
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath;
  }

  const hostname = window.location.hostname;
  const isProduction = 
    hostname === 'krealgram.com' ||
    hostname === 'www.krealgram.com' ||
    hostname.endsWith('.krealgram.com') ||
    hostname.endsWith('.vercel.app');

  const baseUrl = isProduction 
    ? 'https://krealgram-backend.onrender.com' 
    : 'http://localhost:3000';

  // Очистка пути от абсолютных путей файловой системы
  const cleanPath = imagePath.split('/').pop();

  // Специальная обработка для разных сценариев
  if (imagePath.startsWith('/uploads/')) {
    return `${baseUrl}${imagePath}`;
  }

  if (imagePath.startsWith('/')) {
    return imagePath; // Статические файлы из public
  }

  // Проверяем, не является ли путь полным путем файловой системы
  if (imagePath.includes('/opt/render/project/')) {
    const filename = imagePath.split('/').pop();
    return `${baseUrl}/uploads/messages/${filename}`;
  }

  return `${baseUrl}/uploads/messages/${cleanPath}`;
};

export const getAvatarUrl = (avatarPath) => {
  if (!avatarPath) return '/default-avatar.png';

  // Если это уже полный URL с проксированием
  if (avatarPath.includes('/api/proxy-drive/')) {
    return avatarPath;
  }

  const hostname = window.location.hostname;
  const isProduction =
    hostname === 'krealgram.com' ||
    hostname === 'www.krealgram.com' ||
    hostname.endsWith('.krealgram.com') ||
    hostname.endsWith('.vercel.app');

  const baseUrl = isProduction
    ? 'https://krealgram-backend.onrender.com'
    : 'http://localhost:3000';

  // Обработка Google Drive URL
  if (avatarPath.includes('drive.google.com')) {
    const googleDrivePatterns = [
      /https:\/\/drive\.google\.com\/uc\?id=([^&]+)/,
      /https:\/\/drive\.google\.com\/file\/d\/([^/]+)/,
      /https:\/\/drive\.google\.com\/open\?id=([^&]+)/
    ];

    for (const pattern of googleDrivePatterns) {
      const match = avatarPath.match(pattern);
      if (match && match[1]) {
        return `${baseUrl}/api/proxy-drive/${match[1]}`;
      }
    }
  }

  // Если уже полный URL, возвращаем как есть
  if (avatarPath.startsWith('http')) return avatarPath;

  // Локальные пути
  return `${baseUrl}/uploads/${avatarPath}`;
};

export const getVideoUrl = (videoPath) => {
  if (!videoPath) return null;

  const hostname = window.location.hostname;
  const isProduction =
    hostname === 'krealgram.com' ||
    hostname === 'www.krealgram.com' ||
    hostname.endsWith('.krealgram.com') ||
    hostname.endsWith('.vercel.app');

  const baseUrl = isProduction
    ? 'https://krealgram-backend.onrender.com'
    : 'http://localhost:3000';

  // Обработка Google Drive URL
  if (videoPath.includes('drive.google.com')) {
    const googleDrivePatterns = [
      /https:\/\/drive\.google\.com\/uc\?id=([^&]+)/,
      /https:\/\/drive\.google\.com\/file\/d\/([^/]+)/,
      /https:\/\/drive\.google\.com\/open\?id=([^&]+)/
    ];

    for (const pattern of googleDrivePatterns) {
      const match = videoPath.match(pattern);
      if (match && match[1]) {
        return `${baseUrl}/api/proxy-drive/${match[1]}`;
      }
    }
  }

  // Если уже полный URL, возвращаем как есть
  if (videoPath.startsWith('http') || videoPath.startsWith('data:')) return videoPath;

  // Локальные пути
  return `${baseUrl}/uploads/${videoPath}`;
};

export const generateVideoPreviewUrl = (videoPath) => {
  const hostname = window.location.hostname;
  const isProduction =
    hostname === 'krealgram.com' ||
    hostname === 'www.krealgram.com' ||
    hostname.endsWith('.krealgram.com');

  const baseUrl = isProduction
    ? 'https://krealgram-backend.onrender.com'
    : 'http://localhost:3000';

  if (videoPath.includes('drive.google.com')) {
    try {
      const url = new URL(videoPath);
      const fileId = url.searchParams.get('id');
      if (fileId) return `${baseUrl}/api/proxy-drive/${fileId}`;
    } catch (e) {
      console.error('Invalid Google Drive URL', videoPath);
    }
  }

  return `https://drive.google.com/uc?id=${videoPath}`;
};

export const uploadAvatar = async (file) => {
  try {
    const formData = new FormData();
    formData.append('avatar', file);

    const response = await axios.put(
      `${API_URL}/api/users/profile`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        withCredentials: true,
        timeout: 30000
      }
    );

    return response.data;
  } catch (error) {
    if (error.response) {
      const errorMessage = error.response.data.message ||
        (error.response.status === 401 ? 'Требуется повторная авторизация' :
        error.response.status === 400 ? 'Некорректные данные' :
        'Не удалось загрузить аватар');

      throw new Error(errorMessage);
    } else if (error.request) {
      throw new Error('Нет ответа от сервера. Проверьте подключение.');
    } else {
      throw new Error(error.message || 'Ошибка при настройке запроса');
    }
  }
};
