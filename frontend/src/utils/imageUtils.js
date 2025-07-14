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

// Алиасы для обратной совместимости
export const getImageUrl = processMediaUrl;
export const getAvatarUrl = (avatarPath) => {
  return resolveAvatarUrl(avatarPath);
};
export const getVideoUrl = processMediaUrl;
