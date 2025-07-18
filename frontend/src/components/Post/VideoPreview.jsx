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
    
    // Для всех остальных видео - воспроизведение
    handleVideoPlay();
  };

  // Управление воспроизведением видео
  const handleVideoPlay = () => {
    if (!showVideo) {
      setShowVideo(true);
      setTimeout(() => {
        if (videoRef.current) {
          // Проверяем готовность видео перед воспроизведением
          if (videoRef.current.readyState >= 2 && !videoRef.current.error) { // HAVE_CURRENT_DATA
            videoRef.current.play().catch(err => {
              console.error('Video play error:', err);
              // Fallback: показываем модалку, если не удалось воспроизвести
              onClick && onClick();
            });
            setIsVideoPlaying(true);
          } else {
            console.log('Video not ready, waiting for data...', {
              readyState: videoRef.current?.readyState,
              error: videoRef.current?.error
            });
            // Ждем загрузки данных
            const checkReady = () => {
              if (videoRef.current && videoRef.current.readyState >= 2 && !videoRef.current.error) {
                videoRef.current.play().catch(err => {
                  console.error('Video play error after waiting:', err);
                  onClick && onClick();
                });
                setIsVideoPlaying(true);
              } else if (videoRef.current && videoRef.current.error) {
                console.error('Video has error, cannot play');
                onClick && onClick();
              } else {
                setTimeout(checkReady, 100);
              }
            };
            checkReady();
          }
        }
      }, 100);
    } else if (videoRef.current) {
      if (isVideoPlaying) {
        videoRef.current.pause();
        setIsVideoPlaying(false);
      } else {
        // Если видео закончилось, перезапускаем его
        if (videoRef.current.ended) {
          videoRef.current.currentTime = 0;
          console.log('Restarting ended video');
        }
        videoRef.current.play().catch(err => {
          console.error('Video play error:', err);
          onClick && onClick();
        });
        setIsVideoPlaying(true);
      }
    }
  };

  // Обработка окончания видео
  const handleVideoEnded = () => {
    console.log('Video ended naturally');
    setIsVideoPlaying(false);
    // Не скрываем видео сразу, даем пользователю возможность перезапустить
    setTimeout(() => {
      setShowVideo(false);
    }, 2000); // Показываем видео еще 2 секунды после окончания
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
          onCanPlay={() => {
            console.log('Video can play');
            setVideoLoaded(true);
          }}
          onCanPlayThrough={() => {
            console.log('Video can play through');
            // Убеждаемся, что видео без звука для избежания проблем с декодированием
            if (videoRef.current) {
              videoRef.current.muted = true;
            }
          }}
          onWaiting={() => {
            console.log('Video is waiting for data...');
          }}
          onStalled={() => {
            console.warn('Video playback stalled');
          }}
          onSuspend={() => {
            console.log('Video loading suspended');
          }}
          onLoadStart={() => {
            console.log('Video load started');
          }}
          onLoadedMetadata={() => {
            console.log('Video metadata loaded');
          }}
          onAbort={() => {
            console.warn('Video loading aborted');
          }}
          onEmptied={() => {
            console.warn('Video source emptied');
          }}
          onError={(e) => {
            console.warn('Video playback error, switching to preview mode', e);
            const video = e.target;
            console.log('Video error details:', {
              error: video.error,
              networkState: video.networkState,
              readyState: video.readyState,
              src: video.src,
              currentTime: video.currentTime,
              duration: video.duration,
              paused: video.paused,
              ended: video.ended
            });
            
            // Проверяем тип ошибки
            if (video.error) {
              console.log('Media error code:', video.error.code);
              console.log('Media error message:', video.error.message);
            }
            
            // Не скрываем видео сразу, пытаемся исправить
            if (video.networkState === 3) { // NETWORK_NO_SOURCE
              console.log('Network error, trying to reload video');
              setTimeout(() => {
                if (videoRef.current) {
                  videoRef.current.load();
                }
              }, 2000);
            } else if (video.readyState >= 2) {
              // Видео загружено, но произошла ошибка воспроизведения
              console.log('Playback error, trying to restart video');
              
              // Если это ошибка декодирования аудио, пытаемся воспроизвести без аудио
              if (video.error && video.error.code === 3 && video.error.message.includes('audio')) {
                console.log('Audio decode error, trying to play without audio');
                if (videoRef.current) {
                  videoRef.current.muted = true;
                  videoRef.current.currentTime = 0;
                  videoRef.current.play().catch(err => {
                    console.error('Failed to restart video without audio:', err);
                    setShowVideo(false);
                    setIsVideoPlaying(false);
                  });
                }
              } else {
                // Для других ошибок пытаемся обычный перезапуск
                setTimeout(() => {
                  if (videoRef.current) {
                    videoRef.current.currentTime = 0;
                    videoRef.current.play().catch(err => {
                      console.error('Failed to restart video:', err);
                      setShowVideo(false);
                      setIsVideoPlaying(false);
                    });
                  }
                }, 1000);
              }
            } else {
              // Для других ошибок переключаемся на превью
              setShowVideo(false);
              setIsVideoPlaying(false);
            }
          }}
          onClick={(e) => {
            e.stopPropagation();
            // Если видео закончилось, перезапускаем его при клике
            if (videoRef.current && videoRef.current.ended) {
              videoRef.current.currentTime = 0;
              videoRef.current.play().catch(err => {
                console.error('Video restart error:', err);
              });
              setIsVideoPlaying(true);
            }
          }}
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