import React, { useEffect, useRef } from 'react';
import { getVideoUrl } from '../../utils/mediaUrlResolver';

const FeedVideoPreloader = ({ posts, currentIndex = 0 }) => {
  const preloadedVideos = useRef(new Set());
  const videoElements = useRef(new Map());
  const videoUrls = useRef(new Map()); // Кэш для URL видео

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

    // Предзагружаем видео с реальной загрузкой
    videosToPreload.forEach(({ id, url, index }) => {
      try {
        const resolvedUrl = getVideoUrl(url);
        
        // Сохраняем URL в кэше для быстрого доступа
        videoUrls.current.set(id, resolvedUrl);
        
        // Создаем скрытый video элемент для предзагрузки
        const video = document.createElement('video');
        video.crossOrigin = 'anonymous';
        // Реальная загрузка видео, как в сообщениях
        video.preload = 'auto';
        video.muted = true;
        video.playsInline = true;
        
        const handleCanPlay = () => {
          if (!preloadedVideos.current.has(id)) {
            preloadedVideos.current.add(id);
          }
        };

        const handleError = (e) => {
          // Убираем логирование ошибок предзагрузки
        };

        video.addEventListener('canplay', handleCanPlay, { once: true });
        video.addEventListener('error', handleError);
        video.addEventListener('loadeddata', handleCanPlay, { once: true });

        video.src = resolvedUrl;
        videoElements.current.set(id, video);

        // Очистка через 60 секунд (увеличиваем время для реальной загрузки)
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
        videoUrls.current.delete(id);
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
      videoUrls.current.clear();
    };
  }, [posts, currentIndex]);

  // Экспортируем функции для использования в других компонентах
  useEffect(() => {
    // Добавляем глобальные функции для доступа к предзагруженным видео
    window.getPreloadedVideoUrl = (postId) => {
      return videoUrls.current.get(postId);
    };
    
    window.isVideoPreloaded = (postId) => {
      return preloadedVideos.current.has(postId);
    };

    return () => {
      delete window.getPreloadedVideoUrl;
      delete window.isVideoPreloaded;
    };
  }, []);

  return null; // Компонент не рендерит ничего видимого
};

export default FeedVideoPreloader; 