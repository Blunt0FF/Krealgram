import React, { useEffect, useState } from 'react';
import './ImageModal.css';

const ImageModal = ({ 
  src, 
  alt, 
  isOpen, 
  onClose,
  mediaType = 'image'
}) => {
  const [mediaSrc, setMediaSrc] = useState(src);

  useEffect(() => {
    setMediaSrc(src);
  }, [src]);

  const handleImageError = () => {
    console.error('Image load error:', src);
    setMediaSrc('/default-post-placeholder.png');
  };

  const isVideo = mediaType === 'video' || (src && src.includes('video'));

  if (!isOpen) return null;

  return (
    <div className="image-modal-overlay" onClick={onClose}>
      <div 
        className="image-modal-content" 
        onClick={(e) => e.stopPropagation()}
      >
        <button 
          className="image-modal-close" 
          onClick={onClose}
          type="button"
        >
          ✕
        </button>
        {isVideo ? (
          <video 
            src={mediaSrc} 
            controls
            className="image-modal-video"
            autoPlay
            style={{
              maxWidth: '90vw',
              maxHeight: '90vh',
              objectFit: 'contain'
            }}
          />
        ) : (
          <img 
            src={mediaSrc} 
            alt={alt} 
            className="image-modal-img"
            onError={handleImageError}
          />
        )}
      </div>
    </div>
  );
};

export default ImageModal; 