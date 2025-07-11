import React, { useEffect, useState, useRef } from 'react';
import './ImageModal.css';

const ImageModal = ({ src, alt, isOpen, onClose }) => {
  const [touchStartY, setTouchStartY] = useState(null);
  const [touchDeltaY, setTouchDeltaY] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const overlayRef = useRef(null);
  const contentRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      // Сохраняем текущую позицию скролла
      const scrollY = window.scrollY;
      
      // Блокируем скролл без съезжания
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.left = '0';
      document.body.style.right = '0';
      document.body.style.overflow = 'hidden';
      
      // Возвращаем позицию при закрытии
      return () => {
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.left = '';
        document.body.style.right = '';
        document.body.style.overflow = '';
        window.scrollTo(0, scrollY);
      };
    }
  }, [isOpen]);

  const handleTouchStart = (e) => {
    setTouchStartY(e.targetTouches[0].clientY);
    setIsSwiping(true);
    setTouchDeltaY(0);
  };

  const handleTouchMove = (e) => {
    if (touchStartY === null || !isSwiping) return;
    
    const deltaY = e.targetTouches[0].clientY - touchStartY;
    setTouchDeltaY(deltaY);
    
    // Изменяем прозрачность фона при свайпе
    if (overlayRef.current) {
      const opacity = Math.max(0.3, 0.9 - Math.abs(deltaY) / 300);
      overlayRef.current.style.backgroundColor = `rgba(0, 0, 0, ${opacity})`;
    }
  };

  const handleTouchEnd = () => {
    if (touchStartY === null) return;
    
    const closeThreshold = 100;
    
    if (Math.abs(touchDeltaY) > closeThreshold) {
      onClose();
    } else {
      // Возвращаем в исходное положение
      if (overlayRef.current) {
        overlayRef.current.style.backgroundColor = '';
      }
      if (contentRef.current) {
        contentRef.current.style.transform = '';
      }
    }
    
    setTouchDeltaY(0);
    setTouchStartY(null);
    setIsSwiping(false);
  };

  if (!isOpen) return null;

  return (
    <div 
      ref={overlayRef}
      className="image-modal-overlay" 
      onClick={onClose}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div 
        ref={contentRef}
        className="image-modal-content" 
        onClick={(e) => e.stopPropagation()}
        style={{
          transform: touchDeltaY !== 0 ? `translateY(${touchDeltaY}px)` : '',
          transition: isSwiping ? 'none' : 'transform 0.3s ease-out'
        }}
      >
        <button 
          className="image-modal-close" 
          onClick={onClose}
          type="button"
        >
          ✕
        </button>
        <img src={src} alt={alt} className="image-modal-img" />
      </div>
    </div>
  );
};

export default ImageModal; 