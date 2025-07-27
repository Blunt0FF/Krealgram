import React, { useEffect, useRef, useState } from 'react';
import { processMediaUrl } from '../../utils/urlUtils';

const VideoPreloader = ({ videoUrl, onLoad, onError, priority = 'low' }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState(null);
  const videoRef = useRef(null);

  useEffect(() => {
    if (!videoUrl) return;

    const resolvedUrl = processMediaUrl(videoUrl, 'video');

    // Создаем скрытый video элемент для предзагрузки
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    
    // Для Safari используем более агрессивную предзагрузку
    const isSafari = navigator.userAgent.includes('Safari') && !navigator.userAgent.includes('Chrome');
    if (isSafari) {
      video.preload = 'auto';
    }

    const handleLoadedMetadata = () => {
      setIsLoaded(true);
      onLoad?.(resolvedUrl);
      console.log(`🎥 Video preloaded: ${resolvedUrl.split('/').pop() || 'unknown'}`);
    };

    const handleError = (e) => {
      console.error('Video preload error:', e);
      setError(e);
      onError?.(e);
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('error', handleError);
    video.addEventListener('canplay', handleLoadedMetadata);

    video.src = resolvedUrl;
    videoRef.current = video;

    return () => {
      if (videoRef.current) {
        videoRef.current.removeEventListener('loadedmetadata', handleLoadedMetadata);
        videoRef.current.removeEventListener('error', handleError);
        videoRef.current.removeEventListener('canplay', handleLoadedMetadata);
        videoRef.current.src = '';
        videoRef.current.load();
      }
    };
  }, [videoUrl, priority, onLoad, onError]);

  return null; // Компонент не рендерит ничего видимого
};

export default VideoPreloader; 