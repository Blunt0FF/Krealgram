import React, { useState } from 'react';
import { getMediaThumbnail, getStaticThumbnail } from '../../utils/videoUtils';

const VideoPreview = ({ post, onClick, onDoubleClick, className = '', style = {} }) => {
  const [imageError, setImageError] = useState(false);
  const [staticError, setStaticError] = useState(false);
  
  const gifUrl = getMediaThumbnail(post);
  const staticUrl = getStaticThumbnail(post);

  const handleImageError = () => {
    setImageError(true);
  };

  const handleStaticError = () => {
    setStaticError(true);
  };

  // Если обе картинки не загрузились, показываем placeholder
  if (imageError && staticError) {
    return (
      <div 
        className={`post-video-placeholder ${className}`}
        style={{ 
          width: '100%',
          height: '500px',
          backgroundColor: '#000',
          cursor: 'pointer',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          ...style
        }}
        onClick={onClick}
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
        height: '500px',
        cursor: 'pointer',
        position: 'relative',
        backgroundColor: '#000',
        ...style
      }}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      {/* Основное GIF превью */}
      {!imageError && (
        <img
          src={gifUrl}
          alt="Video preview"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            position: 'absolute',
            top: 0,
            left: 0
          }}
          onError={handleImageError}
        />
      )}
      
      {/* Fallback статичное превью */}
      {imageError && !staticError && (
        <img
          src={staticUrl}
          alt="Video preview"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            position: 'absolute',
            top: 0,
            left: 0
          }}
          onError={handleStaticError}
        />
      )}

      {/* Play кнопка */}
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