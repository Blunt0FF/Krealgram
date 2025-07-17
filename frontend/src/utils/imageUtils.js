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

    // Создаем canvas для сжатия
    const img = await createImageBitmap(file);

    // Максимальный размер аватара
    const MAX_SIZE = 500;
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

    // Вычисляем новые размеры с сохранением пропорций
    const ratio = Math.min(MAX_SIZE / img.width, MAX_SIZE / img.height);
    canvas.width = img.width * ratio;
    canvas.height = img.height * ratio;

    // Рисуем изображение с новым размером
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // Конвертируем в Blob с сохранением оригинального формата
    return await new Promise((resolve) => {
      canvas.toBlob((blob) => {
        resolve(new File([blob], file.name, { type: file.type }));
      }, file.type, 0.8);
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

    // Сжимаем аватар перед загрузкой
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
export const getImageUrl = processMediaUrl;
export const getAvatarUrl = (avatarPath) => {
  return resolveAvatarUrl(avatarPath);
};

// Улучшенная функция для получения URL видео с оптимизацией для мобильных устройств
export const getVideoUrl = (videoPath, options = {}) => {
  if (!videoPath) return null;
  
  // Используем улучшенную обработку из mediaUrlResolver
  return processMediaUrl(videoPath, 'video');
};
