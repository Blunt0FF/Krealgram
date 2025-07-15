import React, { useEffect, useState, useRef } from 'react';
import './ImageModal.css';

const ImageModal = ({ 
  src, 
  alt, 
  isOpen, 
  onClose, 
  disableSwipe = false  // Новый проп для блокировки свайпа
}) => {
  const [touchStartY, setTouchStartY] = useState(null);
  const [touchDeltaY, setTouchDeltaY] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [isMultiTouch, setIsMultiTouch] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const overlayRef = useRef(null);
  const contentRef = useRef(null);
  const imageRef = useRef(null);

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

  const handleImageZoom = (e) => {
    if (e.touches.length === 2) {
      if (!isZoomed) {
        setIsZoomed(true);
        imageRef.current.style.transform = 'scale(2)';
      } else {
        setIsZoomed(false);
        imageRef.current.style.transform = 'scale(1)';
      }
    }
  };

  const handleTouchStart = (e) => {
    if (disableSwipe) return;

    // Проверяем количество пальцев - если больше одного, это зум
    if (e.targetTouches.length > 1) {
      setIsMultiTouch(true);
      handleImageZoom(e);
      return;
    }
    
    // Проверяем, не находимся ли мы в режиме зума
    if (isZoomed) {
      setIsMultiTouch(true);
      return;
    }
    
    setIsMultiTouch(false);
    setTouchStartY(e.targetTouches[0].clientY);
    setIsSwiping(true);
    setTouchDeltaY(0);
  };

  const handleTouchMove = (e) => {
    // Если мультитач (зум), не обрабатываем свайп
    if (isMultiTouch || e.targetTouches.length > 1) {
      setIsMultiTouch(true);
      return;
    }
    
    // Проверяем, не находимся ли мы в режиме зума
    if (isZoomed) {
      setIsMultiTouch(true);
      return;
    }
    
    if (disableSwipe || touchStartY === null || !isSwiping) return;
    
    const deltaY = e.targetTouches[0].clientY - touchStartY;
    setTouchDeltaY(deltaY);
    
    // Изменяем прозрачность фона при свайпе
    if (overlayRef.current) {
      const opacity = Math.max(0.3, 0.9 - Math.abs(deltaY) / 300);
      overlayRef.current.style.backgroundColor = `rgba(0, 0, 0, ${opacity})`;
    }
    
    if (contentRef.current) {
      contentRef.current.style.transform = `translateY(${deltaY}px)`;
    }
  };

  const handleTouchEnd = () => {
    // Если был мультитач, не закрываем модал
    if (isMultiTouch) {
      setIsMultiTouch(false);
      setIsSwiping(false);
      setTouchStartY(null);
      setTouchDeltaY(0);
      return;
    }
    
    // Проверяем, не находимся ли мы в режиме зума
    if (isZoomed) {
      setIsMultiTouch(false);
      setIsSwiping(false);
      setTouchStartY(null);
      setTouchDeltaY(0);
      return;
    }
    
    if (disableSwipe || touchStartY === null) return;
    
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
    setIsMultiTouch(false);
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
      >
        <button 
          className="image-modal-close" 
          onClick={onClose}
          type="button"
        >
          ✕
        </button>
        <img 
          ref={imageRef}
          src={src} 
          alt={alt} 
          className="image-modal-img" 
          style={{
            transition: isSwiping || isZoomed ? 'none' : 'transform 0.3s ease-out'
          }}
        />
      </div>
    </div>
  );
};

export default ImageModal; 