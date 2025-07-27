import React, { useState, useEffect, useRef, useCallback } from 'react';
import { processMediaUrl } from '../../utils/urlUtils';
import VideoPreloader from './VideoPreloader';
import './VideoPlayer.css';

const VideoPlayer = ({ 
  src, 
  poster, 
  autoplay = false, 
  controls = true, 
  muted = false, 
  loop = false,
  className = '',
  style = {},
  onClick,
  onDoubleClick,
  onLoad,
  onError,
  preload = true,
  priority = 'low'
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState(null);
  const videoRef = useRef(null);
  const [videoUrl, setVideoUrl] = useState(null);

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

  // Обрабатываем URL видео
  useEffect(() => {
    if (!src) return;
    
    const resolvedUrl = processMediaUrl(src, 'video');
    setVideoUrl(resolvedUrl);
  }, [src]);

  // Обработчики событий видео
  const handleLoadedMetadata = useCallback(() => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      setIsLoaded(true);
      const fileName = getFileName(videoRef.current.src);
      console.log(`🎬 VideoPlayer loaded: ${fileName}`);
      onLoad?.(videoRef.current);
    }
  }, [onLoad]);

  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  }, []);

  const handlePlay = useCallback(() => {
    setIsPlaying(true);
  }, []);

  const handlePause = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const handleError = useCallback((e) => {
    console.error('Video error:', e);
    setError(e);
    onError?.(e);
  }, [onError]);

  const handleCanPlay = useCallback(() => {
    setIsLoaded(true);
  }, []);

  const videoProps = {
    ref: videoRef,
    src: videoUrl,
    poster: poster,
    controls: controls,
    muted: muted,
    loop: loop,
    playsInline: true, // Важно для iOS
    webkitPlaysinline: true, // Для старых версий Safari
    preload: 'auto', // Используем предзагруженное видео
    crossOrigin: 'anonymous',
    onLoadedMetadata: handleLoadedMetadata,
    onTimeUpdate: handleTimeUpdate,
    onPlay: handlePlay,
    onPause: handlePause,
    onError: handleError,
    onCanPlay: handleCanPlay,
    style: {
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      backgroundColor: '#000'
    }
  };

  // Автозапуск
  useEffect(() => {
    if (autoplay && videoRef.current) {
      const playPromise = videoRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          console.log('Autoplay prevented:', error);
        });
      }
    }
  }, [autoplay]);

  if (!videoUrl) return null;

  return (
    <div className={`video-player-wrapper ${className}`} style={style}>
      {/* Предзагрузка видео */}
      {preload && (
        <VideoPreloader 
          videoUrl={videoUrl} 
          priority={priority}
          onLoad={() => {
            const fileName = getFileName(videoUrl);
            console.log('VideoPlayer preloader completed:', fileName);
          }}
          onError={(e) => console.error('Video preload error:', e)}
        />
      )}
      
      {/* Основной видео элемент */}
      <video {...videoProps} />
      
      {/* Индикатор загрузки */}
      {!isLoaded && !error && (
        <div className="video-loading-indicator">
          <div className="loading-spinner"></div>
          <span>Загрузка видео...</span>
        </div>
      )}
      
      {/* Индикатор ошибки */}
      {error && (
        <div className="video-error-indicator">
          <span>Ошибка загрузки видео</span>
          <button onClick={() => window.location.reload()}>Повторить</button>
        </div>
      )}
    </div>
  );
};

export default VideoPlayer; 