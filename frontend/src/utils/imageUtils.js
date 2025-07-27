import { processMediaUrl } from './urlUtils';
import axios from 'axios';
import { API_URL } from '../config';
import { getAvatarUrl as resolveAvatarUrl } from './mediaUrlResolver';
import heic2any from 'heic2any';

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

    console.log('🔧 Starting avatar compression for:', file.name, 'Size:', file.size, 'Type:', file.type);

    // Проверяем, является ли файл HEIC/HEIF
    const isHeic = file.type === 'image/heic' || file.type === 'image/heif' || 
                   file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif');
    
    let processedFile = file;
    
    if (isHeic) {
      console.log('🔧 HEIC/HEIF file detected, converting to JPEG');
      try {
        // Конвертируем HEIC в JPEG
        const convertedBlob = await heic2any({
          blob: file,
          toType: 'image/jpeg',
          quality: 0.8
        });
        
        processedFile = new File([convertedBlob], file.name.replace(/\.(heic|heif)$/i, '.jpg'), {
          type: 'image/jpeg',
          lastModified: Date.now()
        });
        
        console.log('🔧 HEIC converted to JPEG for avatar:', {
          originalSize: file.size,
          convertedSize: processedFile.size
        });
      } catch (conversionError) {
        console.warn('⚠️ HEIC conversion failed for avatar, using original file:', conversionError);
        processedFile = file;
      }
    }

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
            const compressedFile = new File([blob], processedFile.name, {
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
      img.src = URL.createObjectURL(processedFile);
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
        // Проверяем, есть ли в localStorage флаг о том, что прокси не работает
        const proxyBroken = localStorage.getItem('proxyBroken') === 'true';
        
        if (proxyBroken) {
          // Если прокси сломан, используем прямые URL Google Drive
          return `https://drive.google.com/thumbnail?id=${fileId}&sz=w150-h150-c`;
        } else {
          // Пробуем прокси
          return `${API_URL}/api/proxy-drive/${fileId}?type=thumbnail`;
        }
      }
    } catch (error) {
      // В случае ошибки возвращаем оригинал
      return resolveAvatarUrl(avatarPath);
    }
  }

  // Для локальных файлов или других URL возвращаем оригинал
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

// Функция для принудительного обновления кэша аватаров
export const refreshAvatarCache = () => {
  // Очищаем кэш изображений в браузере
  if ('caches' in window) {
    caches.keys().then(cacheNames => {
      cacheNames.forEach(cacheName => {
        if (cacheName.includes('image') || cacheName.includes('avatar')) {
          caches.delete(cacheName);
        }
      });
    });
  }
  
  // Принудительно перезагружаем изображения на странице
  const avatarImages = document.querySelectorAll('img[src*="avatar"], img[src*="proxy-drive"]');
  avatarImages.forEach(img => {
    const currentSrc = img.src;
    if (currentSrc && !currentSrc.includes('default-avatar.png')) {
      const separator = currentSrc.includes('?') ? '&' : '?';
      img.src = `${currentSrc}${separator}t=${Date.now()}`;
    }
  });
};

// Улучшенная функция для обновления аватара при ошибке загрузки
export const refreshAvatarOnError = (imgElement, avatarPath) => {
  if (!avatarPath || avatarPath.includes('default-avatar.png')) {
    return;
  }
  
  // Проверяем, является ли это Google Drive URL и прокси не работает
  if (avatarPath.includes('drive.google.com') && imgElement.src.includes('proxy-drive')) {
    try {
      const fileId = avatarPath.match(/\/uc\?id=([^&]+)/)?.[1] || 
                     avatarPath.match(/\/d\/([^/]+)/)?.[1] || 
                     avatarPath.split('id=')[1];
      
      if (fileId) {
        // Помечаем, что прокси не работает
        localStorage.setItem('proxyBroken', 'true');
        
        // Переключаемся на прямые URL Google Drive
        const directUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w150-h150-c`;
        imgElement.src = directUrl;
        
        console.log('🔄 Switched to direct Google Drive URL for avatar');
        return;
      }
    } catch (error) {
      console.warn('⚠️ Error switching to direct Google Drive URL:', error);
    }
  }
  
  // Обычный fallback - добавляем кэш-бастер
  const separator = imgElement.src.includes('?') ? '&' : '?';
  imgElement.src = `${imgElement.src}${separator}t=${Date.now()}`;
};

// Упрощенная функция для получения URL аватара с кэш-бастером только при необходимости
export const getAvatarUrlWithCacheBuster = (avatarPath, forceRefresh = false) => {
  const baseUrl = getAvatarThumbnailUrl(avatarPath);
  if (baseUrl && !baseUrl.includes('default-avatar.png') && forceRefresh) {
    const separator = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${separator}t=${Date.now()}`;
  }
  return baseUrl;
};

// Функция для проверки состояния прокси
export const checkProxyStatus = async () => {
  try {
    const testFileId = 'test123';
    const response = await fetch(`${API_URL}/api/proxy-drive/${testFileId}?type=thumbnail`);
    
    if (response.ok) {
      // Прокси работает, сбрасываем флаг
      localStorage.removeItem('proxyBroken');
      console.log('✅ Proxy is working, resetting flag');
      return true;
    } else {
      // Прокси не работает
      localStorage.setItem('proxyBroken', 'true');
      console.log('❌ Proxy is broken, setting flag');
      return false;
    }
  } catch (error) {
    // Прокси не работает
    localStorage.setItem('proxyBroken', 'true');
    console.log('❌ Proxy check failed, setting flag');
    return false;
  }
};

// Глобальная функция для обновления кэша аватаров по всему сайту
export const refreshAllAvatarCaches = async () => {
  try {
    console.log('🔄 Starting global avatar cache refresh...');
    
    // 1. Очищаем кэш браузера
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      for (const cacheName of cacheNames) {
        if (cacheName.includes('image') || cacheName.includes('avatar')) {
          await caches.delete(cacheName);
          console.log(`🗑️ Deleted cache: ${cacheName}`);
        }
      }
    }
    
    // 2. Обновляем данные пользователя в localStorage
    try {
      const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
      if (storedUser._id) {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/api/users/profile/${storedUser._id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
          const userData = await response.json();
          localStorage.setItem('user', JSON.stringify(userData.user));
          console.log('✅ Updated current user data in localStorage');
        }
      }
    } catch (error) {
      console.error('❌ Error updating current user data:', error);
    }
    
    // 3. Обновляем недавних пользователей
    try {
      const { getRecentUsers, addRecentUser } = await import('./recentUsers');
      const recent = getRecentUsers();
      
      if (recent.length > 0) {
        const token = localStorage.getItem('token');
        const updatedUsers = [];
        
        for (const user of recent) {
          try {
            const response = await fetch(`${API_URL}/api/users/profile/${user._id}`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (response.ok) {
              const data = await response.json();
              updatedUsers.push(data.user);
            }
          } catch (error) {
            console.warn(`⚠️ Could not update user ${user._id}:`, error);
            updatedUsers.push(user);
          }
        }
        
        if (updatedUsers.length > 0) {
          localStorage.setItem('recentUsers', JSON.stringify(updatedUsers));
          console.log(`✅ Updated ${updatedUsers.length} recent users`);
        }
      }
    } catch (error) {
      console.error('❌ Error updating recent users:', error);
    }
    
    // 4. Принудительно перезагружаем все аватары на странице
    const avatarImages = document.querySelectorAll('img[src*="avatar"], img[src*="proxy-drive"]');
    let refreshedCount = 0;
    
    avatarImages.forEach(img => {
      const currentSrc = img.src;
      if (currentSrc && !currentSrc.includes('default-avatar.png')) {
        const separator = currentSrc.includes('?') ? '&' : '?';
        img.src = `${currentSrc}${separator}t=${Date.now()}`;
        refreshedCount++;
      }
    });
    
    console.log(`🔄 Refreshed ${refreshedCount} avatar images on page`);
    console.log('✅ Global avatar cache refresh completed');
    
    return {
      success: true,
      refreshedImages: refreshedCount,
      updatedUsers: true
    };
    
  } catch (error) {
    console.error('❌ Error in global avatar cache refresh:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Функция для проверки и обновления кэша аватаров при загрузке страницы
export const initializeAvatarCache = () => {
  // Проверяем, нужно ли обновить кэш (например, если прошло больше часа)
  const lastUpdate = localStorage.getItem('avatarCacheLastUpdate');
  const now = Date.now();
  const oneHour = 60 * 60 * 1000; // 1 час в миллисекундах
  
  if (!lastUpdate || (now - parseInt(lastUpdate)) > oneHour) {
    console.log('🔄 Avatar cache is stale, refreshing...');
    setTimeout(() => {
      refreshAllAvatarCaches().then(() => {
        localStorage.setItem('avatarCacheLastUpdate', now.toString());
      });
    }, 2000); // Задержка 2 секунды после загрузки страницы
  }
};
