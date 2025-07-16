import React, { useEffect, useState } from 'react';
import './ImageModal.css';

const ImageModal = ({ 
  src, 
  alt, 
  isOpen, 
  onClose
}) => {
  const [imageSrc, setImageSrc] = useState(src);

  useEffect(() => {
    setImageSrc(src);
  }, [src]);

  const handleImageError = () => {
    console.error('Image load error:', src);
    setImageSrc('/default-post-placeholder.png');
  };

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
        <img 
          src={imageSrc} 
          alt={alt} 
          className="image-modal-img"
          onError={handleImageError}
        />
      </div>
    </div>
  );
};

export default ImageModal; 