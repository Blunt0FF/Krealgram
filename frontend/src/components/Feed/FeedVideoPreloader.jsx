import React, { useEffect, useRef } from 'react';
import { getVideoUrl } from '../../utils/mediaUrlResolver';

const FeedVideoPreloader = ({ posts, currentIndex = 0 }) => {
  const preloadedVideos = useRef(new Set());
  const videoElements = useRef(new Map());

  // Функция для определения Safari
  const isSafari = () => {
    return navigator.userAgent.includes('Safari') && !navigator.userAgent.includes('Chrome');
  };

  useEffect(() => {
    if (!posts || posts.length === 0) return;

    // Предзагружаем видео только для видимых постов (текущая страница)
    const videosToPreload = [];
    const startIndex = Math.max(0, currentIndex - 2); // Уменьшаем с 3 до 2 постов назад
    const endIndex = Math.min(posts.length, currentIndex + 4); // Уменьшаем с 7 до 4 постов вперед
    
    console.log(`[VIDEO_PRELOADER] Диапазон предзагрузки: ${startIndex} - ${endIndex} (всего постов: ${posts.length})`);
    
    for (let i = startIndex; i < endIndex; i++) {
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
    console.log(`[VIDEO_PRELOADER] Начинаем предзагрузку ${videosToPreload.length} видео`);
    videosToPreload.forEach(({ id, url, index }) => {
      try {
        const resolvedUrl = getVideoUrl(url);
        console.log(`[VIDEO_PRELOADER] Предзагружаем видео ${id} (индекс: ${index})`);
        
        // Создаем скрытый video элемент для предзагрузки
        const video = document.createElement('video');
        video.crossOrigin = 'anonymous';
        // Менее агрессивная предзагрузка - только для ближайших постов
        video.preload = index <= currentIndex + 1 ? 'metadata' : 'none';
        video.muted = true;
        video.playsInline = true;
        
        const handleLoadedMetadata = () => {
          if (!preloadedVideos.current.has(id)) {
            preloadedVideos.current.add(id);
            console.log(`[VIDEO_PRELOADER] ✅ Видео предзагружено: ${id}`);
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

    // Очистка старых предзагруженных видео
    const currentRange = new Set();
    for (let i = startIndex; i < endIndex; i++) {
      if (posts[i]) {
        currentRange.add(posts[i]._id);
      }
    }
    
    // Удаляем видео, которые больше не в диапазоне
    videoElements.current.forEach((video, id) => {
      if (!currentRange.has(id)) {
        console.log(`[VIDEO_PRELOADER] 🗑️ Удаляем предзагруженное видео: ${id}`);
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