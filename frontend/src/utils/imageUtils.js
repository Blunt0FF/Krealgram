import { API_URL } from '../config';

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
      const targetSize = 250; // Целевой размер для аватара

      canvas.width = targetSize;
      canvas.height = targetSize;

      // Обрезка и масштабирование изображения до квадрата targetSize x targetSize
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
      // Если квадратное, sourceX и sourceY остаются 0, sourceWidth и sourceHeight равны img.width/height

      ctx.drawImage(img, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, targetSize, targetSize);

      try {
        const dataUrl = canvas.toDataURL('image/webp', 0.8); // Качество 0.8 для WebP
        resolve(dataUrl);
      } catch (error) {
        console.error('Ошибка конвертации в WebP, пытаемся JPEG:', error);
        // Попытка отката на JPEG, если WebP не поддерживается (маловероятно в современных браузерах)
        try {
          const dataUrlJpeg = canvas.toDataURL('image/jpeg', 0.85);
          resolve(dataUrlJpeg);
        } catch (jpegError) {
          reject(new Error('Ошибка конвертации изображения в canvas.toDataURL: ' + jpegError.message));
        }
      }
    };
    img.onerror = () => {
      reject(new Error('Не удалось загрузить изображение для сжатия аватара.'));
    };

    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target && typeof e.target.result === 'string') {
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
  console.group('🖼️ getImageUrl Debugging');
  console.log('Input:', { 
    imagePath, 
    type: typeof imagePath, 
    options 
  });

  try {
    if (!imagePath) {
      console.warn('❌ Empty image path, returning default');
      console.groupEnd();
      return '/default-post-placeholder.png';
    }
  
    // Улучшенная обработка Google Drive URL
    if (imagePath.includes('drive.google.com')) {
      console.log('🔍 Detected Google Drive URL');
      try {
        const url = new URL(imagePath);
        console.log('URL Object:', {
          href: url.href,
          origin: url.origin,
          pathname: url.pathname,
          search: url.search
        });

        const fileId = 
          url.searchParams.get('id') || 
          url.pathname.split('/').pop() || 
          imagePath.match(/\/file\/d\/([^/]+)/)?.[1];
        
        console.log('Google Drive URL parsing:', { 
          url: imagePath, 
          extractedId: fileId 
        });
        
        if (fileId) {
          const proxyUrl = `${API_URL}/api/proxy-drive/${fileId}`;
          console.log('✅ Constructed proxy URL:', proxyUrl);
          console.groupEnd();
          return proxyUrl;
        } else {
          console.warn('❌ Could not extract file ID from Google Drive URL');
        }
      } catch (e) {
        console.error('❌ Error parsing Google Drive URL:', {
          url: imagePath,
          error: e.message,
          stack: e.stack
        });
      }
    }
  
    // Если уже полный URL - возвращаем как есть
    if (imagePath.startsWith('http')) {
      console.log('🌐 Returning full HTTP URL:', imagePath);
      console.groupEnd();
      return imagePath;
    }
  
    // Для локальных путей добавляем базовый URL
    const finalUrl = `${API_URL}/uploads/${imagePath}`;
    console.log('📁 Constructed local URL:', finalUrl);
    console.groupEnd();
    return finalUrl;
  } catch (globalError) {
    console.error('🚨 Unexpected error in getImageUrl:', {
      error: globalError.message,
      stack: globalError.stack
    });
    console.groupEnd();
    return '/default-post-placeholder.png';
  }
};

/**
 * Получает URL для аватара
 * @param {string} avatarPath - путь к аватару
 * @returns {string} - полный URL аватара
 */
export const getAvatarUrl = (avatarPath) => {
  // Если пустой путь - возвращаем дефолтный аватар
  if (!avatarPath) return '/default-avatar.png';
  
  // Google Drive URL
  if (avatarPath.includes('drive.google.com')) {
    return `${API_URL}/api/proxy-drive/${avatarPath.split('id=')[1]}`;
  }
  
  // Cloudinary или локальные пути
  if (avatarPath.startsWith('krealgram/')) {
    return `https://res.cloudinary.com/dibcwdwsd/image/upload/${avatarPath}`;
  }
  
  // Если уже полный URL - возвращаем как есть
  if (avatarPath.startsWith('http')) {
    return avatarPath;
  }
  
  // Для локальных путей добавляем базовый URL
  return `${API_URL}/uploads/${avatarPath}`;
};

export const getVideoUrl = (videoPath, options = {}) => {
  if (!videoPath) return null;

  // Если это Google Drive URL, используем наш прокси
  if (videoPath.includes('drive.google.com')) {
    try {
      const url = new URL(videoPath);
      const fileId = url.searchParams.get('id');
      if (fileId) {
        // Принудительно используем https для API_URL
        const secureApiUrl = API_URL.replace(/^http:/, 'https');
        return `${secureApiUrl}/api/proxy-drive/${fileId}`;
      }
    } catch (e) {
      console.error("Invalid Google Drive URL", videoPath);
      return videoPath; // fallback to original path
    }
  }

  // Если это уже полный URL (начинается с http/https), возвращаем как есть
  if (videoPath.startsWith('http://') || videoPath.startsWith('https://')) {
    return videoPath;
  }
  
  // Если это base64 данные, возвращаем как есть
  if (videoPath.startsWith('data:')) {
    return videoPath;
  }
  
  // Если путь начинается с krealgram/, значит это путь к Cloudinary
  if (videoPath.startsWith('krealgram/')) {
    let cloudinaryUrl = `https://res.cloudinary.com/dibcwdwsd/video/upload/`;
    return cloudinaryUrl + videoPath;
  }
  
  // Для остальных файлов используем локальный путь
  return `${API_URL}/uploads/${videoPath}`;
}; 

// Утилиты для работы с изображениями и видео
export const generateVideoPreviewUrl = (videoPath) => {
  // Используем Google Drive URL
  let googleDriveUrl = `https://drive.google.com/uc?id=`;
  return googleDriveUrl + videoPath;
};

export const isValidMediaUrl = (url) => {
  // Проверка URL медиафайлов
  return url && (
    url.startsWith('http') || 
    url.startsWith('/') || 
    url.includes('drive.google.com')
  );
}; 