import React, { useEffect, useRef } from 'react';
import { getVideoUrl } from '../../utils/mediaUrlResolver';

const FeedVideoPreloader = ({ posts, currentIndex = 0 }) => {
  const preloadedVideos = useRef(new Set());
  const videoElements = useRef(new Map());

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
    if (!posts || posts.length === 0) return;

    // Предзагружаем видео для первых 10 постов
    const videosToPreload = [];
    const maxPreloadPosts = Math.min(10, posts.length);
    
    for (let i = 0; i < maxPreloadPosts; i++) {
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
            url: post.imageUrl || post.image,
            index: i
          });
        }
      }
    }

    // Сортируем по приоритету: сначала ближайшие к текущему индексу
    videosToPreload.sort((a, b) => {
      const aDistance = Math.abs(a.index - currentIndex);
      const bDistance = Math.abs(b.index - currentIndex);
      return aDistance - bDistance;
    });

    // Предзагружаем видео с приоритетом
    videosToPreload.forEach(({ id, url, index }) => {
      try {
        const resolvedUrl = getVideoUrl(url);
        
        // Создаем скрытый video элемент для предзагрузки
        const video = document.createElement('video');
        video.crossOrigin = 'anonymous';
        
        // Загружаем само видео, а не только метаданные
        video.preload = 'auto';
        video.muted = true;
        video.playsInline = true;
        
        const handleCanPlayThrough = () => {
          if (!preloadedVideos.current.has(id)) {
            preloadedVideos.current.add(id);
            const fileName = getFileName(url);
            console.log(`🎬 Feed video preloaded: ${fileName} (post ${index + 1})`);
          }
        };

        const handleError = (e) => {
          // Убираем логирование ошибок предзагрузки, так как они не критичны
        };

        video.addEventListener('canplaythrough', handleCanPlayThrough, { once: true });
        video.addEventListener('error', handleError);

        video.src = resolvedUrl;
        videoElements.current.set(id, video);

        // Очистка через 60 секунд (увеличиваем время для лучшей производительности)
        setTimeout(() => {
          const video = videoElements.current.get(id);
          if (video) {
            video.removeEventListener('canplaythrough', handleCanPlayThrough);
            video.removeEventListener('error', handleError);
            video.src = '';
            video.load();
            videoElements.current.delete(id);
          }
        }, 60000);
      } catch (error) {
        // Убираем логирование ошибок
      }
    });

    // Очистка старых предзагруженных видео
    const currentRange = new Set();
    for (let i = 0; i < maxPreloadPosts; i++) {
      if (posts[i]) {
        currentRange.add(posts[i]._id);
      }
    }
    
    // Удаляем видео, которые больше не в диапазоне
    videoElements.current.forEach((video, id) => {
      if (!currentRange.has(id)) {
        video.src = '';
        video.load();
        videoElements.current.delete(id);
        preloadedVideos.current.delete(id);
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