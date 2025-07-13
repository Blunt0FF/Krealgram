import React, { useState, useRef, useEffect } from 'react';
import { getVideoPreviewThumbnail, getStaticThumbnail } from '../../utils/videoUtils';
import { getVideoUrl } from '../../utils/imageUtils';

const VideoPreview = ({ post, onClick, onDoubleClick, className = '', style = {} }) => {
  const [imageError, setImageError] = useState(false);
  const [staticError, setStaticError] = useState(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const videoRef = useRef(null);
  
  const gifUrl = getVideoPreviewThumbnail(post);
  const staticUrl = getStaticThumbnail(post);

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
    
    // Для загруженных видео - воспроизведение
    handleVideoPlay();
  };

  // Управление воспроизведением видео
  const handleVideoPlay = () => {
    if (!showVideo) {
      setShowVideo(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.play().catch(err => {
            console.error('Video play error:', err);
            // Fallback: показываем модалку, если не удалось воспроизвести
            onClick && onClick();
          });
          setIsVideoPlaying(true);
        }
      }, 100);
    } else if (videoRef.current) {
      if (isVideoPlaying) {
        videoRef.current.pause();
        setIsVideoPlaying(false);
      } else {
        videoRef.current.play().catch(err => {
          console.error('Video play error:', err);
          onClick && onClick();
        });
        setIsVideoPlaying(true);
      }
    }
  };

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
          src={getVideoUrl(post.imageUrl || post.image)}
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
          onPlay={() => setIsVideoPlaying(true)}
          onPause={() => setIsVideoPlaying(false)}
          onEnded={() => {
            setIsVideoPlaying(false);
            setShowVideo(false);
          }}
          onClick={(e) => e.stopPropagation()}
        />
      )}

      {/* Основное GIF превью */}
      {!imageError && !showVideo && (
        <img
          src={gifUrl}
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
      {(imageError || !gifUrl) && !showVideo && (
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
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'rgba(0,0,0,0.5)',
            borderRadius: '50%',
            width: '60px',
            height: '60px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            zIndex: 10
          }}
          onClick={handleVideoClick}
        >
          <svg width="32" height="32" fill="white" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z"/>
          </svg>
        </div>
      )}
    </div>
  );
};

export default VideoPreview; 