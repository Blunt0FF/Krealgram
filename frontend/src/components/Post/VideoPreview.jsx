import React, { useState, useRef } from 'react';
import { getVideoPreviewThumbnail, getStaticThumbnail, getMediaThumbnail } from '../../utils/videoUtils';

const VideoPreview = ({ post, onClick, onDoubleClick, className = '', style = {} }) => {
  const [imageError, setImageError] = useState(false);
  const [staticError, setStaticError] = useState(false);
  const [mobileError, setMobileError] = useState(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const videoRef = useRef(null);
  const clickTimeoutRef = useRef(null);
  
  const isMobile = window.innerWidth <= 768;
  const gifUrl = getVideoPreviewThumbnail(post);
  const staticUrl = getStaticThumbnail(post);
  const mobileUrl = getMediaThumbnail(post, { width: 300 });

  const handleImageError = () => {
    setImageError(true);
  };

  const handleStaticError = () => {
    setStaticError(true);
  };

  const handleMobileError = () => {
    setMobileError(true);
  };

  const handleVideoClick = (e) => {
    e.preventDefault();
    
    // Для YouTube видео ВСЕГДА открываем модалку
    if (post.videoUrl && (post.videoUrl.includes('youtube') || post.videoUrl.includes('youtu.be'))) {
      onClick && onClick();
      return;
    }
    
    // Для других внешних видео тоже открываем модалку
    if (post.videoUrl || post.youtubeData) {
      onClick && onClick();
      return;
    }

    // Для загруженных видео - только воспроизведение, НЕ модалка
    handleVideoPlay();
  };

  const handleVideoPlay = () => {
    if (!showVideo) {
      setShowVideo(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.play();
          setIsVideoPlaying(true);
        }
      }, 100);
    } else if (videoRef.current) {
      if (isVideoPlaying) {
        videoRef.current.pause();
        setIsVideoPlaying(false);
      } else {
        videoRef.current.play();
        setIsVideoPlaying(true);
      }
    }
  };

  // Если все превью не загрузились, показываем placeholder
  if (imageError && staticError && mobileError) {
    return (
      <div 
        className={`post-video-placeholder ${className}`}
        style={{ 
          width: '100%',
          height: 'auto',
          maxHeight: '900px',
          cursor: 'pointer',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          ...style
        }}
        onClick={handleVideoClick}
        onDoubleClick={onDoubleClick}
      >
        <div style={{
          background: 'rgba(0,0,0,0.7)',
          borderRadius: '50%',
          width: '60px',
          height: '60px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <svg width="24" height="24" fill="white" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z"/>
          </svg>
        </div>
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
        cursor: 'pointer',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...style
      }}
      onClick={handleVideoClick}
      onDoubleClick={onDoubleClick}
    >
      {/* Видео для воспроизведения */}
      {showVideo && (post.imageUrl || post.image) && (
        <video
          ref={videoRef}
          src={post.imageUrl || post.image}
          style={{
            width: '100%',
            height: 'auto',
            maxHeight: '600px',
            objectFit: 'contain',
            display: 'block'
          }}
          controls
          playsInline
          onPlay={() => setIsVideoPlaying(true)}
          onPause={() => setIsVideoPlaying(false)}
          onEnded={() => {
            setIsVideoPlaying(false);
            setShowVideo(false);
          }}
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
      
      {/* Fallback мобильное превью */}
      {imageError && !mobileError && !showVideo && isMobile && (
        <img
          src={mobileUrl}
          alt="Video preview"
          style={{
            width: '100%',
            height: 'auto',
            maxHeight: '600px',
            objectFit: 'contain',
            display: 'block'
          }}
          onError={handleMobileError}
        />
      )}
      
      {/* Fallback статичное превью */}
      {imageError && (!isMobile || mobileError) && !staticError && !showVideo && (
        <img
          src={staticUrl}
          alt="Video preview"
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

      {/* Play кнопка */}
      {!showVideo && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'rgba(0,0,0,0.7)',
          borderRadius: '50%',
          width: '60px',
          height: '60px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1
        }}>
          <svg width="24" height="24" fill="white" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z"/>
          </svg>
        </div>
      )}

      {/* Информация о внешнем видео */}
      {post.videoUrl && (
        <div style={{
          position: 'absolute',
          bottom: '10px',
          left: '10px',
          right: '10px',
          background: 'rgba(0,0,0,0.9)',
          color: 'white',
          padding: '12px',
          borderRadius: '8px',
          fontSize: '13px',
          textAlign: 'center',
          zIndex: 1
        }}>
          <div style={{ marginBottom: '8px', fontWeight: '500' }}>
            🎥 External Video
          </div>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.8)', marginBottom: '8px' }}>
            Click to open in new tab
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              window.open(post.videoUrl, '_blank');
            }}
            style={{
              background: 'linear-gradient(45deg, #ff0050, #ff4569)',
              border: 'none',
              color: 'white',
              padding: '8px 20px',
              borderRadius: '25px',
              fontSize: '12px',
              cursor: 'pointer',
              fontWeight: '600',
              boxShadow: '0 2px 8px rgba(255,0,80,0.3)',
              transition: 'all 0.2s ease'
            }}
            onMouseOver={(e) => {
              e.target.style.transform = 'scale(1.05)';
              e.target.style.boxShadow = '0 4px 12px rgba(255,0,80,0.4)';
            }}
            onMouseOut={(e) => {
              e.target.style.transform = 'scale(1)';
              e.target.style.boxShadow = '0 2px 8px rgba(255,0,80,0.3)';
            }}
          >
            Watch Video
          </button>
        </div>
      )}
    </div>
  );
};

export default VideoPreview; 