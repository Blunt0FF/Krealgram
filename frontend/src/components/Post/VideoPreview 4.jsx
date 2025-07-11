import React, { useState, useRef } from 'react';
import { getVideoPreviewThumbnail, getStaticThumbnail } from '../../utils/videoUtils';
import { getVideoUrl } from '../../utils/imageUtils';

const VideoPreview = ({ post, onClick, onDoubleClick, className = '', style = {} }) => {
  const [imageError, setImageError] = useState(false);
  const [staticError, setStaticError] = useState(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const videoRef = useRef(null);
  const clickTimeoutRef = useRef(null);
  
  const gifUrl = getVideoPreviewThumbnail(post);
  const staticUrl = getStaticThumbnail(post);

  const handleImageError = () => {
    setImageError(true);
  };

  const handleStaticError = () => {
    setStaticError(true);
  };

  const handleVideoClick = (e) => {
    e.preventDefault();
    
    // Для YouTube видео ВСЕГДА открываем модалку
    if (post.videoUrl && (post.videoUrl.includes('youtube') || post.videoUrl.includes('youtu.be'))) {
      onClick && onClick();
      return;
    }

    // Для загруженных видео - только воспроизведение
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

  // Если обе картинки не загрузились, показываем placeholder
  if (imageError && staticError) {
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
      {imageError && !staticError && !showVideo && (
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
    </div>
  );
};

export default VideoPreview; 