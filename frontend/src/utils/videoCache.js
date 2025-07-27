// Утилита для кэширования предзагруженных видео
class VideoCache {
  constructor() {
    this.cache = new Map();
    this.preloadedElements = new Map();
  }

  /**
   * Добавляет предзагруженное видео в кэш
   * @param {string} url - URL видео
   * @param {HTMLVideoElement} videoElement - Предзагруженный video элемент
   */
  addPreloadedVideo(url, videoElement) {
    this.preloadedElements.set(url, videoElement);
    console.log(`📦 Video cached: ${url}`);
  }

  /**
   * Получает предзагруженное видео из кэша
   * @param {string} url - URL видео
   * @returns {HTMLVideoElement|null} - Предзагруженный video элемент или null
   */
  getPreloadedVideo(url) {
    const videoElement = this.preloadedElements.get(url);
    if (videoElement) {
      console.log(`🎯 Using cached video: ${url}`);
      return videoElement;
    }
    return null;
  }

  /**
   * Проверяет, есть ли видео в кэше
   * @param {string} url - URL видео
   * @returns {boolean} - true если видео в кэше
   */
  hasVideo(url) {
    return this.preloadedElements.has(url);
  }

  /**
   * Создает новый video элемент с предзагруженными данными
   * @param {string} url - URL видео
   * @returns {HTMLVideoElement} - Новый video элемент
   */
  createVideoElement(url) {
    const preloadedVideo = this.getPreloadedVideo(url);
    
    if (preloadedVideo && preloadedVideo.readyState >= 1) {
      // Если видео уже загружено, клонируем элемент
      const newVideo = preloadedVideo.cloneNode(true);
      newVideo.style.display = 'block'; // Показываем клонированный элемент
      console.log(`🚀 Using preloaded video data: ${url} (readyState: ${preloadedVideo.readyState})`);
      return newVideo;
    }
    
    // Если нет в кэше или не загружено, создаем обычный элемент
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    video.src = url;
    
    return video;
  }

  /**
   * Очищает кэш
   */
  clear() {
    this.preloadedElements.forEach((video, url) => {
      video.src = '';
      video.load();
    });
    this.preloadedElements.clear();
    console.log('🗑️ Video cache cleared');
  }

  /**
   * Получает статистику кэша
   * @returns {Object} - Статистика кэша
   */
  getStats() {
    return {
      total: this.preloadedElements.size,
      loaded: Array.from(this.preloadedElements.values()).filter(v => v.readyState >= 1).length
    };
  }
}

// Создаем глобальный экземпляр кэша
const videoCache = new VideoCache();

export default videoCache; 