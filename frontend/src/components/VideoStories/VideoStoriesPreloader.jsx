import React, { useEffect, useRef } from 'react';
import { getVideoUrl } from '../../utils/mediaUrlResolver';

const VideoStoriesPreloader = ({ videos, currentIndex = 0 }) => {
  const preloadedVideos = useRef(new Set());
  const videoElements = useRef(new Map());

  // Функция для определения Safari
  const isSafari = () => {
    return navigator.userAgent.includes('Safari') && !navigator.userAgent.includes('Chrome');
  };

  // Функция для извлечения имени файла
  const getFileName = (url) => {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const fileName = pathname.split('/').pop();
      return fileName || 'unknown';
    } catch {
      // Если не удается распарсить URL, берем последнюю часть
      const parts = url.split('/');
      return parts[parts.length - 1] || 'unknown';
    }
  };

  useEffect(() => {
    if (!videos || videos.length === 0) return;

    // Предзагружаем 2 следующих видео после текущего
    const videosToPreload = [];
    const startIndex = currentIndex + 1;
    const endIndex = Math.min(videos.length, currentIndex + 3); // +3 потому что currentIndex + 1, +2, +3
    
    for (let i = startIndex; i < endIndex; i++) {
      const video = videos[i];
      if (video && !preloadedVideos.current.has(video._id)) {
        // Определяем URL видео
        let videoUrl = null;
        
        if (video?.youtubeData?.videoId) {
          // Для YouTube видео предзагружаем thumbnail
          videoUrl = `https://img.youtube.com/vi/${video.youtubeData.videoId}/maxresdefault.jpg`;
        } else {
          // Для обычных видео
          videoUrl = getVideoUrl(video?.videoUrl || video?.image);
        }
        
        if (videoUrl) {
          videosToPreload.push({
            id: video._id,
            url: videoUrl,
            index: i,
            isYouTube: !!video?.youtubeData?.videoId
          });
        }
      }
    }

    // Предзагружаем видео
    videosToPreload.forEach(({ id, url, index, isYouTube }) => {
      try {
        if (isYouTube) {
          // Для YouTube предзагружаем thumbnail
          const img = document.createElement('img');
          img.crossOrigin = 'anonymous';
          
          const handleLoad = () => {
            if (!preloadedVideos.current.has(id)) {
              preloadedVideos.current.add(id);
              const fileName = getFileName(url);
              console.log(`📱 Stories YouTube preloaded: ${fileName} (story ${index + 1})`);
            }
          };

          const handleError = () => {
            // Убираем логирование ошибок
          };

          img.addEventListener('load', handleLoad, { once: true });
          img.addEventListener('error', handleError);
          img.src = url;
          videoElements.current.set(id, img);

          // Очистка через 30 секунд
          setTimeout(() => {
            const img = videoElements.current.get(id);
            if (img) {
              img.removeEventListener('load', handleLoad);
              img.removeEventListener('error', handleError);
              img.src = '';
              videoElements.current.delete(id);
            }
          }, 30000);
        } else {
          // Для обычных видео
          const video = document.createElement('video');
          video.crossOrigin = 'anonymous';
          
          // Настройки предзагрузки в зависимости от браузера
          if (isSafari()) {
            // Для Safari более агрессивная предзагрузка
            video.preload = 'auto';
          } else {
            // Для других браузеров
            video.preload = 'metadata';
          }
          
          video.muted = true;
          video.playsInline = true;
          
          const handleLoadedMetadata = () => {
            if (!preloadedVideos.current.has(id)) {
              preloadedVideos.current.add(id);
              const fileName = getFileName(url);
              console.log(`📱 Stories video preloaded: ${fileName} (story ${index + 1})`);
            }
          };

          const handleError = () => {
            // Убираем логирование ошибок
          };

          video.addEventListener('loadedmetadata', handleLoadedMetadata, { once: true });
          video.addEventListener('error', handleError);
          video.addEventListener('canplay', handleLoadedMetadata, { once: true });

          video.src = url;
          videoElements.current.set(id, video);

          // Очистка через 30 секунд
          setTimeout(() => {
            const video = videoElements.current.get(id);
            if (video) {
              video.removeEventListener('loadedmetadata', handleLoadedMetadata);
              video.removeEventListener('error', handleError);
              video.removeEventListener('canplay', handleLoadedMetadata);
              video.src = '';
              video.load();
              videoElements.current.delete(id);
            }
          }, 30000);
        }
      } catch (error) {
        // Убираем логирование ошибок
      }
    });

    // Очистка старых предзагруженных видео
    const currentRange = new Set();
    for (let i = startIndex; i < endIndex; i++) {
      if (videos[i]) {
        currentRange.add(videos[i]._id);
      }
    }
    
    // Удаляем видео, которые больше не в диапазоне
    videoElements.current.forEach((element, id) => {
      if (!currentRange.has(id)) {
        if (element.tagName === 'VIDEO') {
          element.src = '';
          element.load();
        } else {
          element.src = '';
        }
        videoElements.current.delete(id);
        preloadedVideos.current.delete(id);
      }
    });

    // Очистка при размонтировании
    return () => {
      // Очищаем все элементы
      videoElements.current.forEach((element, id) => {
        if (element.tagName === 'VIDEO') {
          element.src = '';
          element.load();
        } else {
          element.src = '';
        }
      });
      videoElements.current.clear();
    };
  }, [videos, currentIndex]);

  return null; // Компонент не рендерит ничего видимого
};

export default VideoStoriesPreloader; 