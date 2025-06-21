// Глобальный менеджер видео - обеспечивает что только одно видео играет одновременно

class VideoManager {
  constructor() {
    this.currentVideo = null;
    this.observers = new Set();
  }

  // Устанавливает текущее активное видео
  setCurrentVideo(video) {
    // Если уже есть активное видео и это не то же самое видео
    if (this.currentVideo && this.currentVideo !== video) {
      this.currentVideo.pause();
    }
    
    this.currentVideo = video;
    this.notifyObservers();
  }

  // Останавливает текущее видео
  pauseCurrentVideo() {
    if (this.currentVideo) {
      this.currentVideo.pause();
      this.currentVideo = null;
      this.notifyObservers();
    }
  }

  // Останавливает все видео на странице кроме указанного
  pauseAllExcept(exceptVideo = null) {
    const allVideos = document.querySelectorAll('video');
    allVideos.forEach(video => {
      if (video !== exceptVideo) {
        video.pause();
      }
    });
    
    this.currentVideo = exceptVideo;
    this.notifyObservers();
  }

  // Останавливает все видео в ленте при открытии модалки
  pauseAllFeedVideos() {
    const allVideos = document.querySelectorAll('video');
    allVideos.forEach(video => {
      // Останавливаем видео которые НЕ в модалках
      if (!video.closest('.post-modal-overlay') && 
          !video.closest('.video-stories-modal-overlay')) {
        video.pause();
      }
    });
    this.currentVideo = null;
    this.notifyObservers();
  }

  // Получает текущее активное видео
  getCurrentVideo() {
    return this.currentVideo;
  }

  // Добавляет наблюдателя для изменений
  addObserver(callback) {
    this.observers.add(callback);
  }

  // Удаляет наблюдателя
  removeObserver(callback) {
    this.observers.delete(callback);
  }

  // Уведомляет всех наблюдателей об изменениях
  notifyObservers() {
    this.observers.forEach(callback => callback(this.currentVideo));
  }

  // Инициализирует слушатели событий для всех видео на странице
  initializeVideoListeners() {
    const allVideos = document.querySelectorAll('video');
    
    allVideos.forEach(video => {
      // Удаляем старые слушатели если есть
      video.removeEventListener('play', this.handleVideoPlay);
      video.removeEventListener('pause', this.handleVideoPause);
      
      // Добавляем новые слушатели
      video.addEventListener('play', this.handleVideoPlay.bind(this));
      video.addEventListener('pause', this.handleVideoPause.bind(this));
    });
  }

  handleVideoPlay = (event) => {
    this.setCurrentVideo(event.target);
  }

  handleVideoPause = (event) => {
    if (this.currentVideo === event.target) {
      this.currentVideo = null;
      this.notifyObservers();
    }
  }

  // Очищает все слушатели
  cleanup() {
    const allVideos = document.querySelectorAll('video');
    allVideos.forEach(video => {
      video.removeEventListener('play', this.handleVideoPlay);
      video.removeEventListener('pause', this.handleVideoPause);
    });
    this.observers.clear();
    this.currentVideo = null;
  }
}

// Создаем глобальный экземпляр
const videoManager = new VideoManager();

// Инициализируем при загрузке DOM
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      videoManager.initializeVideoListeners();
    });
  } else {
    videoManager.initializeVideoListeners();
  }
}

export default videoManager; 