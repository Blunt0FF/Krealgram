import React, { useEffect, useRef } from 'react';
import { getVideoUrl } from '../../utils/mediaUrlResolver';
import { getOriginalFileName } from '../../utils/fileMetadata';
import videoCache from '../../utils/videoCache';

const FeedVideoPreloader = ({ posts, currentIndex = 0 }) => {
  const preloadedVideos = useRef(new Set());
  const videoElements = useRef(new Map());
  const lastProcessedIndex = useRef(-1);
  const processingTimeout = useRef(null);

  // Функция для определения Safari
  const isSafari = () => {
    return navigator.userAgent.includes('Safari') && !navigator.userAgent.includes('Chrome');
  };

  useEffect(() => {
    if (!posts || posts.length === 0) return;

    // Предзагружаем видео с приоритетом и ограничением одновременных загрузок
    const maxConcurrentLoads = 2; // Уменьшаем количество одновременных загрузок
    let currentLoads = 0;
    
    const loadVideo = async ({ id, url, index }) => {
      // Проверяем, не загружается ли уже это видео
      if (videoElements.current.has(id)) {
        return;
      }
      
      // Для первых 10 постов не ограничиваем количество одновременных загрузок
      if (index >= 10 && currentLoads >= maxConcurrentLoads) {
        // Если достигли лимита, ждем немного
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      currentLoads++;
      
      try {
        const resolvedUrl = getVideoUrl(url);
        
        // Получаем оригинальное название файла
        const originalFileName = await getOriginalFileName(url);
        
        // Создаем скрытый video элемент для предзагрузки
        const video = document.createElement('video');
        video.crossOrigin = 'anonymous';
        // Для первых 10 постов загружаем более агрессивно
        video.preload = index < 10 ? 'metadata' : (index <= currentIndex + 3 ? 'metadata' : 'none');
        video.muted = true;
        video.playsInline = true;
        video.style.display = 'none'; // Скрываем элемент
        
        const handleLoadedMetadata = () => {
          if (!preloadedVideos.current.has(id)) {
            preloadedVideos.current.add(id);
            const prefix = index < 10 ? '🔥' : '🎬';
            console.log(`${prefix} Video preloaded: ${originalFileName} (post ${index + 1})`);
            
            // Дополнительная проверка для Safari
            if (isSafari()) {
              console.log(`🦁 Safari: Video metadata loaded for ${originalFileName}`);
            }
          }
        };

        const handleError = (e) => {
          // Убираем логирование ошибок предзагрузки, так как они не критичны
        };

        video.addEventListener('loadedmetadata', handleLoadedMetadata, { once: true });
        video.addEventListener('error', handleError);
        video.addEventListener('canplay', handleLoadedMetadata, { once: true });
        video.addEventListener('loadstart', () => {
          // Убираем логи начала загрузки, чтобы уменьшить спам
          // console.log(`🚀 Starting to load video: ${originalFileName}`);
        });

        video.src = resolvedUrl;
        videoElements.current.set(id, video);
        
        // Добавляем видео в кэш для использования в компонентах
        videoCache.addPreloadedVideo(resolvedUrl, video);
        
        // Проверяем, что видео действительно загружается
        setTimeout(() => {
          if (video.readyState >= 1) {
            const prefix = index < 10 ? '🔥' : '✅';
            console.log(`${prefix} Video actually loaded: ${originalFileName} (post ${index + 1}, readyState: ${video.readyState})`);
          } else {
            // Убираем логи для readyState: 0, так как это нормально для предзагрузки
            // console.log(`⚠️ Video loading status: ${originalFileName} (readyState: ${video.readyState})`);
          }
        }, index < 10 ? 2000 : 3000); // Для первых 10 постов проверяем быстрее

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
      } finally {
        currentLoads--;
      }
    };

    // Для первых 10 постов загружаем сразу, без дебаунсинга
    if (currentIndex < 10) {
      // Загружаем первые 10 постов сразу
      const initialVideos = [];
      const endIndex = Math.min(10, posts.length);
      
      for (let i = 0; i < endIndex; i++) {
        const post = posts[i];
        if (post && (post.imageUrl || post.image) && !preloadedVideos.current.has(post._id)) {
          const isVideo = 
            post.mediaType === 'video' ||
            (post.imageUrl && (post.imageUrl.includes('.mp4') || post.imageUrl.includes('video/'))) ||
            (post.image && (post.image.includes('.mp4') || post.image.includes('video/'))) ||
            post.videoUrl ||
            post.youtubeData;
          
          if (isVideo) {
            initialVideos.push({
              id: post._id,
              url: post.imageUrl || post.image,
              index: i
            });
          }
        }
      }
      
      // Загружаем первые 10 видео параллельно
      console.log(`🚀 Starting to preload ${initialVideos.length} videos from first 10 posts`);
      initialVideos.forEach(loadVideo);
      return;
    }

    // Дебаунсинг только для прокрутки после первых 10 постов
    if (processingTimeout.current) {
      clearTimeout(processingTimeout.current);
    }

    processingTimeout.current = setTimeout(() => {
      // Проверяем, не обрабатывали ли мы уже этот индекс
      if (lastProcessedIndex.current === currentIndex) {
        return;
      }
      
      lastProcessedIndex.current = currentIndex;

      // Предзагружаем видео для следующих постов при прокрутке
      const videosToPreload = [];
      
      // Определяем диапазон для предзагрузки - только ближайшие посты
      const startIndex = Math.max(0, currentIndex - 2); // Начинаем с 2 постов назад
      const endIndex = Math.min(posts.length, currentIndex + 8); // Загружаем на 8 постов вперед
      
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

      // Запускаем загрузку видео
      videosToPreload.forEach(loadVideo);

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
          video.src = '';
          video.load();
          videoElements.current.delete(id);
          preloadedVideos.current.delete(id);
        }
      });

    }, 300); // Задержка 300мс для дебаунсинга

    // Очистка при размонтировании
    return () => {
      if (processingTimeout.current) {
        clearTimeout(processingTimeout.current);
      }
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