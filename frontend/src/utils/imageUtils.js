import { processMediaUrl } from './urlUtils';
import axios from 'axios';
import { API_URL } from '../config';
import { getAvatarUrl as resolveAvatarUrl } from './mediaUrlResolver';

const isImageFile = (file) => {
  return file && file.type.startsWith('image/');
};

export const compressImage = async (file, maxSizeKB = 500, maxWidth = 1920) => {
  // Заглушка для сжатия изображений
  return file;
};

export const getFileSizeKB = (dataUrl) => {
  return Math.round(dataUrl.length / 1024);
}; 

// Возвращаем оригинальный файл без сжатия
export const compressPostImage = (file) => {
  return Promise.resolve(file);
};

export const compressAvatar = async (file) => {
  try {
    // Проверяем, что файл является изображением
    if (!isImageFile(file)) {
      throw new Error('Файл не является изображением.');
    }

    console.log('🔧 Starting avatar compression for:', file.name, 'Size:', file.size);

    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        // Сохраняем оригинальный размер для достижения 3.4MB
        const maxWidth = img.width;
        const maxHeight = img.height;
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

        console.log('🔧 Avatar canvas dimensions:', width, 'x', height);

        // Рисуем изображение на canvas с правильной ориентацией
        ctx.drawImage(img, 0, 0, width, height);
        
        // Конвертируем в blob с качеством 65% для достижения 3-3.4MB
        canvas.toBlob((blob) => {
          if (blob) {
            const compressedFile = new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now()
            });
            console.log('🔧 Avatar compression result:', {
              originalSize: file.size,
              compressedSize: compressedFile.size,
              compressionRatio: (compressedFile.size / file.size * 100).toFixed(1) + '%',
              targetAchieved: compressedFile.size <= 3.4 * 1024 * 1024 ? '✅' : '❌',
              sizeMB: (compressedFile.size / (1024 * 1024)).toFixed(2) + ' MB'
            });
            resolve(compressedFile);
          } else {
            reject(new Error('Failed to compress avatar'));
          }
        }, 'image/jpeg', 0.65); // Качество 65% для достижения 3-3.4MB
      };
      
      img.onerror = () => reject(new Error('Failed to load avatar image'));
      img.src = URL.createObjectURL(file);
    });
  } catch (error) {
    console.error('Ошибка сжатия аватара:', error);
    return file; // Возвращаем оригинальный файл в случае ошибки
  }
};

export const uploadAvatar = async (file) => {
  try {
    // Если передан base64, конвертируем в File
    if (typeof file === 'string') {
      const response = await fetch(file);
      const blob = await response.blob();
      const mimeType = response.headers.get('content-type') || 'image/jpeg';
      file = new File([blob], `avatar.${mimeType.split('/')[1]}`, { type: mimeType });
    }

    // Проверяем, что файл является изображением
    if (!isImageFile(file)) {
      throw new Error('Файл не является изображением.');
    }

    // Сжимаем изображение на клиенте (как для постов)
    const compressedFile = await compressAvatar(file);

    // Создаем FormData для загрузки
    const formData = new FormData();
    formData.append('avatar', compressedFile);

    const token = localStorage.getItem('token');
    const response = await axios.put(
      `${API_URL}/api/users/profile`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${token}`
        }
      }
    );

    return response.data;
  } catch (error) {
    console.error('Ошибка загрузки аватара:', error);
    throw error;
  }
};

// Алиасы для обратной совместимости
import { resolveMediaUrl } from './mediaUrlResolver';
export const getImageUrl = resolveMediaUrl;

// Функция для получения thumbnail версии аватара
export const getAvatarThumbnailUrl = (avatarPath) => {
  if (!avatarPath) {
    return '/default-avatar.png';
  }

  // Если это Google Drive URL, пытаемся получить thumbnail
  if (avatarPath.includes('drive.google.com')) {
    try {
      const fileId = avatarPath.match(/\/uc\?id=([^&]+)/)?.[1] || 
                     avatarPath.match(/\/d\/([^/]+)/)?.[1] || 
                     avatarPath.split('id=')[1];
      
      if (fileId) {
        // Возвращаем URL для thumbnail
        const thumbnailUrl = `${API_URL}/api/proxy-drive/${fileId}`;
        console.log(`[AVATAR_THUMBNAIL] Для аватара ${fileId} используем thumbnail: ${thumbnailUrl}`);
        return thumbnailUrl;
      }
    } catch (error) {
      console.error('[AVATAR_THUMBNAIL] Ошибка обработки Google Drive URL:', error);
      // В случае ошибки возвращаем оригинал
      return resolveAvatarUrl(avatarPath);
    }
  }

  // Для локальных файлов или других URL возвращаем оригинал
  console.log(`[AVATAR_THUMBNAIL] Для аватара ${avatarPath} используем оригинал`);
  return resolveAvatarUrl(avatarPath);
};

// Синхронная версия для использования в компонентах
export const getAvatarUrl = (avatarPath) => {
  return resolveAvatarUrl(avatarPath);
};

// Улучшенная функция для получения URL видео с оптимизацией для мобильных устройств
export const getVideoUrl = (videoPath, options = {}) => {
  if (!videoPath) return null;
  
  // Используем улучшенную обработку из mediaUrlResolver
  return processMediaUrl(videoPath, 'video');
};
