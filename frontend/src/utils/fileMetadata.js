// Утилита для получения метаданных файлов
import { API_URL } from '../config';

const fileMetadataCache = new Map();

/**
 * Получает метаданные файла по его ID
 * @param {string} fileId - ID файла в Google Drive
 * @returns {Promise<{fileName: string, mimeType: string, size: number}>}
 */
export const getFileMetadata = async (fileId) => {
  if (!fileId) return null;
  
  // Проверяем кэш
  if (fileMetadataCache.has(fileId)) {
    return fileMetadataCache.get(fileId);
  }
  
  try {
    const response = await fetch(`${API_URL}/api/file-metadata/${fileId}`);
    
    if (!response.ok) {
      console.warn(`[FILE-METADATA] Не удалось получить метаданные для ${fileId}:`, response.status);
      return null;
    }
    
    const data = await response.json();
    
    if (data.success) {
      // Кэшируем результат
      fileMetadataCache.set(fileId, data);
      return data;
    }
    
    return null;
  } catch (error) {
    console.error(`[FILE-METADATA] Ошибка получения метаданных для ${fileId}:`, error);
    return null;
  }
};

/**
 * Извлекает ID файла из URL Google Drive
 * @param {string} url - URL файла Google Drive
 * @returns {string|null} - ID файла или null
 */
export const extractFileIdFromUrl = (url) => {
  if (!url) return null;
  
  // Паттерны для извлечения ID из разных форматов URL Google Drive
  const patterns = [
    /\/d\/([a-zA-Z0-9-_]+)/, // /d/FILE_ID
    /id=([a-zA-Z0-9-_]+)/,   // id=FILE_ID
    /uc\?id=([a-zA-Z0-9-_]+)/, // uc?id=FILE_ID
    /\/([a-zA-Z0-9-_]{25,})/ // Длинный ID в конце URL
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  return null;
};

/**
 * Получает оригинальное название файла из URL
 * @param {string} url - URL файла
 * @returns {Promise<string>} - Оригинальное название файла
 */
export const getOriginalFileName = async (url) => {
  if (!url) return 'unknown';
  
  const fileId = extractFileIdFromUrl(url);
  if (!fileId) {
    // Если не удалось извлечь ID, возвращаем последнюю часть URL
    return url.split('/').pop() || 'unknown';
  }
  
  const metadata = await getFileMetadata(fileId);
  return metadata?.fileName || 'unknown';
}; 