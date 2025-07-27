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

    // Предзагружаем видео для первых 10 постов
    const videosToPreload = [];
    const maxPreloadPosts = Math.min(10, posts.length);
    
    console.log(`🎬 FeedVideoPreloader: Processing ${maxPreloadPosts} posts, currentIndex: ${currentIndex}`);
    
    for (let i = 0; i < maxPreloadPosts; i++) {
      const post = posts[i];
      if (post && !preloadedVideos.current.has(post._id)) {
        // Проверяем, является ли это видео
        const isVideo = 
          post.mediaType === 'video' ||
          post.videoUrl ||
          post.youtubeData ||
          (post.imageUrl && (post.imageUrl.includes('.mp4') || post.imageUrl.includes('video/'))) ||
          (post.image && (post.image.includes('.mp4') || post.image.includes('video/')));
        
        if (isVideo) {
          let videoUrl = post.videoUrl || post.imageUrl || post.image;
          
          // Для YouTube видео используем оригинальный URL
          if (post.youtubeData && post.youtubeData.originalUrl) {
            videoUrl = post.youtubeData.originalUrl;
          }
          
          videosToPreload.push({
            id: post._id,
            url: videoUrl,
            index: i,
            post: post
          });
          console.log(`🎬 Found video at index ${i}: ${post._id} (${videoUrl.split('/').pop() || 'unknown'})`);
        }
      }
    }
    
    console.log(`🎬 Total videos to preload: ${videosToPreload.length}`);

    // Сортируем по приоритету: сначала ближайшие к текущему индексу
    videosToPreload.sort((a, b) => {
      const aDistance = Math.abs(a.index - currentIndex);
      const bDistance = Math.abs(b.index - currentIndex);
      return aDistance - bDistance;
    });

    // Предзагружаем видео с приоритетом
    videosToPreload.forEach(({ id, url, index, post }) => {
      try {
        console.log(`🎬 Starting preload for video ${id} at index ${index}`);
        const resolvedUrl = getVideoUrl(url);
        
        // Создаем скрытый video элемент для предзагрузки
        const video = document.createElement('video');
        video.crossOrigin = 'anonymous';
        // Агрессивная предзагрузка для всех видео в видимом диапазоне
        video.preload = 'metadata';
        video.muted = true;
        video.playsInline = true;
        
        const handleLoadedMetadata = () => {
          if (!preloadedVideos.current.has(id)) {
            preloadedVideos.current.add(id);
            console.log(`🎬 Video preloaded successfully: ${url.split('/').pop() || 'unknown'} (ID: ${id})`);
          }
        };

        const handleError = (e) => {
          console.warn(`🎬 Video preload failed: ${url.split('/').pop() || 'unknown'} (ID: ${id})`, e);
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