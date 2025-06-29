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
 * Сжимает изображение поста
 * @param {File} file - файл изображения  
 * @returns {Promise<Blob>} - Blob сжатого изображения поста
 */
export const compressPostImage = (file) => {
  // Для постов можно использовать WebP для лучшего сжатия, если поддерживается, или JPEG
  return compressImage(file, 1080, 1080, 0.85, 'image/jpeg'); // Ширина 1080, качество 0.85, формат JPEG
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
  if (!imagePath) return null;
  
  // Если это уже полный URL (начинается с http/https), возвращаем как есть
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    // Если это Cloudinary URL и нужно добавить флаги для GIF
    if (imagePath.includes('res.cloudinary.com') && !imagePath.includes('fl_animated')) {
      const isGif = options.isGif === true || options.mimeType === 'image/gif' || 
                    imagePath.toLowerCase().includes('gif');
      if (isGif) {
        // Вставляем максимальные настройки для GIF после /upload/
        return imagePath.replace('/upload/', '/upload/fl_animated,q_100,f_auto/');
      } else {
        // Обычный флаг для других изображений
        return imagePath.replace('/upload/', '/upload/fl_animated/');
      }
    }
    return imagePath;
  }
  
  // Если это base64 данные, возвращаем как есть
  if (imagePath.startsWith('data:')) {
    return imagePath;
  }
  
  // Если путь начинается с krealgram/, значит это путь к Cloudinary
  if (imagePath.startsWith('krealgram/')) {
    let cloudinaryUrl = `https://res.cloudinary.com/dibcwdwsd/image/upload/`;
    
    // Проверяем если это GIF файл и нужно сохранить анимацию
    const isGif = imagePath.toLowerCase().includes('gif') || 
                  imagePath.toLowerCase().endsWith('.gif') ||
                  options.isGif === true ||
                  options.mimeType === 'image/gif';
    
    // Добавляем флаги для максимального качества GIF
    if (isGif) {
      cloudinaryUrl += `fl_animated,q_100,f_auto/`; // Максимальное качество + автоформат для лучшей производительности
    } else {
      cloudinaryUrl += `fl_animated/`; // Обычный флаг для других изображений
    }
    
    return cloudinaryUrl + imagePath;
  }
  
  // Для остальных файлов используем локальный путь
  return `${API_URL}/uploads/${imagePath}`;
};

export const getAvatarUrl = (avatarPath) => {
  if (!avatarPath) {
    return '/default-avatar.png';
  }
  
  // Для Safari добавляем crossOrigin anonymous для Cloudinary URLs
  const imageUrl = getImageUrl(avatarPath);
  if (!imageUrl) {
    return '/default-avatar.png';
  }
  
  return imageUrl;
};

// Специальная функция для видео URLs
export const getVideoUrl = (videoPath, options = {}) => {
  if (!videoPath) return null;
  
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