import React, { useEffect, useRef } from 'react';
import { getVideoUrl } from '../../utils/mediaUrlResolver';

const VideoStoriesPreloader = ({ videos, currentIndex = 0 }) => {
  const preloadedVideos = useRef(new Set());
  const videoElements = useRef(new Map());
  const videoUrls = useRef(new Map()); // Кэш для URL видео

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

    // Предзагружаем видео с реальной загрузкой
    videosToPreload.forEach(({ id, url, index, isYouTube }) => {
      try {
        if (isYouTube) {
          // Для YouTube предзагружаем thumbnail
          const img = document.createElement('img');
          img.crossOrigin = 'anonymous';
          
          const handleLoad = () => {
            if (!preloadedVideos.current.has(id)) {
              preloadedVideos.current.add(id);
            }
          };

          const handleError = () => {
            // Убираем логирование ошибок
          };

          img.addEventListener('load', handleLoad, { once: true });
          img.addEventListener('error', handleError);
          img.src = url;
          videoElements.current.set(id, img);
          videoUrls.current.set(id, url);

          // Очистка через 60 секунд
          setTimeout(() => {
            const img = videoElements.current.get(id);
            if (img) {
              img.removeEventListener('load', handleLoad);
              img.removeEventListener('error', handleError);
              img.src = '';
              videoElements.current.delete(id);
              videoUrls.current.delete(id);
            }
          }, 60000);
        } else {
          // Для обычных видео - реальная загрузка
          const video = document.createElement('video');
          video.crossOrigin = 'anonymous';
          video.preload = 'auto'; // Реальная загрузка видео
          video.muted = true;
          video.playsInline = true;
          
          const handleCanPlay = () => {
            if (!preloadedVideos.current.has(id)) {
              preloadedVideos.current.add(id);
            }
          };

          const handleError = () => {
            // Убираем логирование ошибок
          };

          video.addEventListener('canplay', handleCanPlay, { once: true });
          video.addEventListener('error', handleError);
          video.addEventListener('loadeddata', handleCanPlay, { once: true });

          video.src = url;
          videoElements.current.set(id, video);
          videoUrls.current.set(id, url);

          // Очистка через 60 секунд
          setTimeout(() => {
            const video = videoElements.current.get(id);
            if (video) {
              video.removeEventListener('canplay', handleCanPlay);
              video.removeEventListener('error', handleError);
              video.removeEventListener('loadeddata', handleCanPlay);
              video.src = '';
              video.load();
              videoElements.current.delete(id);
              videoUrls.current.delete(id);
            }
          }, 60000);
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
        videoUrls.current.delete(id);
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
      videoUrls.current.clear();
    };
  }, [videos, currentIndex]);

  // Экспортируем функции для использования в других компонентах
  useEffect(() => {
    // Добавляем глобальные функции для доступа к предзагруженным видео в сторис
    window.getPreloadedStoriesVideoUrl = (videoId) => {
      return videoUrls.current.get(videoId);
    };
    
    window.isStoriesVideoPreloaded = (videoId) => {
      return preloadedVideos.current.has(videoId);
    };

    return () => {
      delete window.getPreloadedStoriesVideoUrl;
      delete window.isStoriesVideoPreloaded;
    };
  }, []);

  return null; // Компонент не рендерит ничего видимого
};

export default VideoStoriesPreloader; 