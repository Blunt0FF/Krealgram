import React, { useState, useRef, useEffect, useMemo } from 'react';
import { getVideoPreviewThumbnail, getStaticThumbnail } from '../../utils/videoUtils';
import { getVideoUrl, getImageUrl } from '../../utils/imageUtils';
import videoManager from '../../utils/videoManager';
import useVideoPreloader from '../../hooks/useVideoPreloader';

// Функция для определения мобильного устройства
const isMobile = () => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
         (navigator.maxTouchPoints && navigator.maxTouchPoints > 2 && /MacIntel/.test(navigator.platform));
};

// Функция для определения Safari
const isSafari = () => {
  return navigator.userAgent.includes('Safari') && !navigator.userAgent.includes('Chrome');
};

// Функция для получения превью поста (как в профиле)
const getPostThumbnail = (post) => {
  // Используем ту же логику, что и в профиле и уведомлениях
  const urls = [
    post.thumbnailUrl,
    post.imageUrl,
    post.image,
    post.youtubeData?.thumbnailUrl,
    post.preview,
    post.gifPreview,
    '/default-post-placeholder.png'
  ].filter(Boolean);

  // Используем getImageUrl как в профиле
  return getImageUrl(urls[0]);
};

const VideoPreview = ({ post, onClick, onDoubleClick, className = '', style = {} }) => {
  const [imageError, setImageError] = useState(false);
  const [staticError, setStaticError] = useState(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const videoRef = useRef(null);
  
  // Используем ту же логику что и в профиле
  const thumbnailUrl = useMemo(() => getPostThumbnail(post), [post]);
  const gifUrl = useMemo(() => getVideoPreviewThumbnail(post), [post]);
  const staticUrl = useMemo(() => getStaticThumbnail(post), [post]);
  
  // Получаем URL видео для предзагрузки
  const videoUrl = post.imageUrl || post.image;
  
  // Предзагрузка видео с высоким приоритетом для Safari
  const { isPreloaded, error: preloadError } = useVideoPreloader(
    videoUrl, 
    isSafari() ? 'high' : 'low'
  );
  
  // Получаем URL видео для воспроизведения (всегда вычисляем, даже если не показываем)
  const resolvedVideoUrl = useMemo(() => {
    return getVideoUrl(post.imageUrl || post.image);
  }, [post.imageUrl, post.image]);

  // Улучшенная обработка ошибок загрузки
  const handleImageError = () => {
    console.warn('GIF preview failed, switching to static thumbnail');
    setImageError(true);
  };

  const handleStaticError = () => {
    console.warn('Static thumbnail failed, showing placeholder');
    setStaticError(true);
  };

  // Обработка клика для разных типов видео
  const handleVideoClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // YouTube и внешние видео - всегда открываем модалку
    if (post.videoUrl && (post.videoUrl.includes('youtube') || post.videoUrl.includes('youtu.be'))) {
      onClick && onClick();
      return;
    }
    
    // Для мобильных устройств - открываем модалку для лучшей совместимости
    if (isMobile()) {
      onClick && onClick();
      return;
    }
    
    // Для десктопа - воспроизведение
    handleVideoPlay();
  };

  // Управление воспроизведением видео
  const handleVideoPlay = () => {
    if (!showVideo) {
      setShowVideo(true);
      // Увеличиваем задержку для Safari
      const delay = isSafari() ? 200 : 100;
      setTimeout(() => {
        if (videoRef.current) {
          const playPromise = videoRef.current.play();
          if (playPromise !== undefined) {
            playPromise.then(() => {
              setIsVideoPlaying(true);
            }).catch(err => {
              console.error('Video play error:', err);
              setShowVideo(false);
              setIsVideoPlaying(false);
            });
          }
        }
      }, delay);
    } else if (videoRef.current) {
      if (isVideoPlaying) {
        videoRef.current.pause();
        setIsVideoPlaying(false);
      } else {
        const playPromise = videoRef.current.play();
        if (playPromise !== undefined) {
          playPromise.then(() => {
            setIsVideoPlaying(true);
          }).catch(err => {
            console.error('Video play error:', err);
            setShowVideo(false);
            setIsVideoPlaying(false);
          });
        }
      }
    }
  };

  // Обработка окончания видео
  const handleVideoEnded = () => {
    // Проверяем, что видео действительно закончилось
    if (videoRef.current && videoRef.current.duration) {
      const progress = (videoRef.current.currentTime / videoRef.current.duration) * 100;
      
      if (progress >= 98) {
        console.log('Video ended naturally at:', progress.toFixed(1) + '%', 
          videoRef.current.currentTime.toFixed(1) + 's / ' + 
          videoRef.current.duration.toFixed(1) + 's');
        setIsVideoPlaying(false);
        setShowVideo(false);
      } else {
        console.log('Video ended prematurely at:', progress.toFixed(1) + '%', 
          videoRef.current.currentTime.toFixed(1) + 's / ' + 
          videoRef.current.duration.toFixed(1) + 's');
        // Если видео прервалось раньше времени, не скрываем его
      }
    }
    // Не перезапускаем автоматически - пользователь может кликнуть снова
  };

  // Обработка загрузки видео
  const handleVideoLoaded = () => {
    setVideoLoaded(true);
  };

  // Очистка при размонтировании
  useEffect(() => {
    return () => {
      if (videoRef.current) {
        videoRef.current.pause();
      }
    };
  }, []);

  // Если обе картинки не загрузились, показываем placeholder
  if (imageError && staticError) {
    return (
      <div 
        className={`post-video-placeholder ${className}`}
        style={{ 
          width: '100%',
          height: 'auto',
          maxHeight: '600px',
          cursor: 'pointer',
          ...style
        }}
        onClick={onClick}
      >
        <img 
          src="/video-placeholder.svg" 
          alt="Video placeholder" 
          style={{
            width: '100%',
            height: 'auto',
            maxHeight: '600px',
            objectFit: 'contain'
          }}
        />
      </div>
    );
  }

  return (
    <div 
      className={`post-video-placeholder ${className}`}
      style={{ 
        width: '100%',
        height: 'auto',
        maxHeight: '600px',
        cursor: showVideo ? 'default' : 'pointer',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...style
      }}
      onClick={showVideo ? undefined : handleVideoClick}
      onDoubleClick={onDoubleClick}
    >
      {/* Видео для воспроизведения */}
      {showVideo && (post.imageUrl || post.image) && (
        <video
          ref={videoRef}
          src={resolvedVideoUrl}
          type="video/mp4"
          style={{
            width: '100%',
            height: 'auto',
            maxHeight: '600px',
            objectFit: 'contain',
            display: 'block',
            pointerEvents: 'auto'
          }}
          controls
          playsInline
          webkit-playsinline="true"
          x5-playsinline="true"
          x5-video-player-type="h5"
          x5-video-player-fullscreen="true"
          x5-video-orientation="portrait"
          preload={isSafari() ? 'auto' : 'metadata'}
          muted={false}
          onPlay={() => {
            setIsVideoPlaying(true);
            videoManager.setCurrentVideo(videoRef.current);
          }}
          onPause={() => {
            setIsVideoPlaying(false);
            if (videoManager.getCurrentVideo() === videoRef.current) {
              videoManager.pauseCurrentVideo();
            }
          }}
          onEnded={handleVideoEnded}
          onLoadedData={handleVideoLoaded}
          onLoadedMetadata={() => {
            console.log('Video metadata loaded, duration:', videoRef.current?.duration);
          }}
          onCanPlayThrough={() => {
            // Видео полностью загружено и готово к воспроизведению
            setVideoLoaded(true);
            console.log('Video can play through, duration:', videoRef.current?.duration);
          }}
          onStalled={() => {
            // Видео застряло - можно попробовать перезагрузить
            console.log('Video stalled, attempting to resume...');
          }}
          onWaiting={() => {
            // Видео буферизуется
            console.log('Video buffering...');
          }}
          onTimeUpdate={() => {
            // Отслеживаем прогресс видео
            if (videoRef.current && videoRef.current.duration) {
              const progress = (videoRef.current.currentTime / videoRef.current.duration) * 100;
              
              // Если видео близко к концу (95% и больше), но не достигло конца
              if (progress >= 95 && progress < 99) {
                console.log('Video near end:', progress.toFixed(1) + '%', 
                  videoRef.current.currentTime.toFixed(1) + 's / ' + 
                  videoRef.current.duration.toFixed(1) + 's');
              }
            }
          }}
          onError={(e) => {
            console.warn('Video playback error, switching to preview mode');
            console.log('Video error details:', e.target.error);
            console.log('Video src:', e.target.src);
            console.log('Video current time:', e.target.currentTime);
            console.log('Video duration:', e.target.duration);
            setShowVideo(false);
            setIsVideoPlaying(false);
          }}
          onClick={(e) => e.stopPropagation()}
        />
      )}

      {/* Основное GIF превью (как в профиле) */}
      {!imageError && !showVideo && thumbnailUrl && (
        <img
          src={thumbnailUrl}
          alt="Video preview"
          style={{
            width: '100%',
            height: 'auto',
            maxHeight: '600px',
            objectFit: 'contain',
            display: 'block'
          }}
          onError={handleImageError}
        />
      )}
      
      {/* Fallback статичное превью */}
      {(imageError || !thumbnailUrl) && !showVideo && (
        <img
          src={staticUrl}
          alt="Video static preview"
          style={{
            width: '100%',
            height: 'auto',
            maxHeight: '600px',
            objectFit: 'contain',
            display: 'block'
          }}
          onError={handleStaticError}
        />
      )}

      {/* Кнопка воспроизведения */}
      {!showVideo && (
        <div 
          className="play-button"
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '60px',
            height: '60px',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            zIndex: 10
          }}
          onClick={handleVideoClick}
        >
          <svg 
            width="24" 
            height="24" 
            viewBox="0 0 24 24" 
            fill="white"
          >
            <path d="M8 5v14l11-7z"/>
          </svg>
        </div>
      )}
    </div>
  );
};

export default VideoPreview; 