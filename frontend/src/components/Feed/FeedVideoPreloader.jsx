import React, { useEffect, useRef } from 'react';
import { processMediaUrl } from '../../utils/urlUtils';

const FeedVideoPreloader = ({ posts, currentIndex = 0 }) => {
  const preloadedVideos = useRef(new Set());
  const videoElements = useRef(new Map());

  // Функция для определения Safari
  const isSafari = () => {
    return navigator.userAgent.includes('Safari') && !navigator.userAgent.includes('Chrome');
  };

  useEffect(() => {
    if (!posts || posts.length === 0) return;

    // Предзагружаем только видео файлы (не изображения)
    const videosToPreload = [];
    for (let i = currentIndex; i < Math.min(currentIndex + 3, posts.length); i++) {
      const post = posts[i];
      if (post && (post.imageUrl || post.image) && !preloadedVideos.current.has(post._id)) {
        // Проверяем, является ли это видео
        const isVideo = 
          post.mediaType === 'video' ||
          (post.imageUrl && (post.imageUrl.includes('.mp4') || post.imageUrl.includes('video/'))) ||
          (post.image && (post.image.includes('.mp4') || post.image.includes('video/'))) ||
          post.videoUrl ||
          post.youtubeData;
        
        if (isVideo) {
          videosToPreload.push({
            id: post._id,
            url: post.imageUrl || post.image
          });
        }
      }
    }

    // Предзагружаем видео
    videosToPreload.forEach(({ id, url }) => {
      try {
        const resolvedUrl = processMediaUrl(url, 'video');
        
        // Создаем скрытый video элемент для предзагрузки
        const video = document.createElement('video');
        video.crossOrigin = 'anonymous';
        video.preload = isSafari() ? 'auto' : 'metadata';
        video.muted = true;
        video.playsInline = true;
        
        const handleLoadedMetadata = () => {
          if (!preloadedVideos.current.has(id)) {
            preloadedVideos.current.add(id);
            console.log(`Video preloaded: ${id}`);
          }
        };

        const handleError = (e) => {
          // Убираем логирование ошибок предзагрузки, так как они не критичны
          // console.error(`Video preload error for ${id}:`, e);
        };

        video.addEventListener('loadedmetadata', handleLoadedMetadata, { once: true });
        video.addEventListener('error', handleError);
        video.addEventListener('canplay', handleLoadedMetadata, { once: true });

        video.src = resolvedUrl;
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
      } catch (error) {
        console.error(`Error setting up video preload for ${id}:`, error);
      }
    });

    // Очистка при размонтировании
    return () => {
      // Очищаем все video элементы
      videoElements.current.forEach((video, id) => {
        video.src = '';
        video.load();
      });
      videoElements.current.clear();
    };
  }, [posts, currentIndex]);

  return null; // Компонент не рендерит ничего видимого
};

export default FeedVideoPreloader; 