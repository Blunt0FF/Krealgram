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
  const [isDragging, setIsDragging] = useState(false);
  const [isMultiTouch, setIsMultiTouch] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const [zoomScale, setZoomScale] = useState(1);
  const [zoomStartDistance, setZoomStartDistance] = useState(null);

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

  const handleTouchStart = (e) => {
    if (e.target.closest('.modal-nav-btn')) return;
    
    // Проверяем количество пальцев - если больше одного, это зум
    if (e.targetTouches.length > 1) {
      setIsMultiTouch(true);
      
      // Вычисляем начальное расстояние между пальцами для зума
      const touch1 = e.targetTouches[0];
      const touch2 = e.targetTouches[1];
      const distance = Math.hypot(
        touch1.pageX - touch2.pageX, 
        touch1.pageY - touch2.pageY
      );
      setZoomStartDistance(distance);
      return;
    }
    
    setIsMultiTouch(false);
    setTouchStartY(e.targetTouches[0].clientY);
    setIsDragging(true);
    contentRef.current.classList.add('is-dragging');
  };

  const handleTouchMove = (e) => {
    // Если мультитач (зум), обрабатываем зум
    if (e.targetTouches.length > 1 && zoomStartDistance !== null) {
      const touch1 = e.targetTouches[0];
      const touch2 = e.targetTouches[1];
      const currentDistance = Math.hypot(
        touch1.pageX - touch2.pageX, 
        touch1.pageY - touch2.pageY
      );
      
      // Вычисляем масштаб
      const scale = currentDistance / zoomStartDistance;
      const newZoomScale = Math.min(Math.max(1, zoomScale * scale), 3);
      
      setZoomScale(newZoomScale);
      imageRef.current.style.transform = `scale(${newZoomScale})`;
      
      // Обновляем начальное расстояние для следующего движения
      setZoomStartDistance(currentDistance);
      setIsMultiTouch(true);
      setIsZoomed(newZoomScale > 1);
      return;
    }
    
    // Если зум активен, не двигаем модалку
    if (isZoomed) return;
    
    if (!isDragging || touchStartY === null) return;
    const currentY = e.targetTouches[0].clientY;
    const deltaY = currentY - touchStartY;

    const backgroundOpacity = Math.max(1 - Math.abs(deltaY) / 1000, 0.5);
    if(overlayRef.current) {
      overlayRef.current.style.backgroundColor = `rgba(0, 0, 0, ${0.65 * backgroundOpacity})`;
    }
    if (contentRef.current) {
      contentRef.current.style.transform = `translateY(${deltaY}px)`;
    }
  };

  const handleTouchEnd = () => {
    // Если был мультитач, сбрасываем состояние
    if (isMultiTouch) {
      setIsMultiTouch(false);
      setIsDragging(false);
      setTouchStartY(null);
      setZoomStartDistance(null);
      
      // Если зум больше 1, оставляем как есть
      if (zoomScale > 1) return;
      
      // Иначе сбрасываем зум
      setZoomScale(1);
      setIsZoomed(false);
      if (imageRef.current) {
        imageRef.current.style.transform = 'scale(1)';
      }
      return;
    }
    
    // Если зум активен, не закрываем модалку
    if (isZoomed) return;
    
    if (!isDragging || touchStartY === null) return;

    const closeThreshold = 150;

    contentRef.current.classList.remove('is-dragging');

    if (Math.abs(touchDeltaY) > closeThreshold) {
      onClose();
    } else {
      if (overlayRef.current) {
        overlayRef.current.style.backgroundColor = '';
      }
      if (contentRef.current) {
        contentRef.current.style.transform = '';
      }
    }

    setIsDragging(false);
    setTouchStartY(null);
    setIsMultiTouch(false);
  };

  const resetZoom = () => {
    setZoomScale(1);
    setIsZoomed(false);
    if (imageRef.current) {
      imageRef.current.style.transform = 'scale(1)';
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      ref={overlayRef}
      className="image-modal-overlay" 
      onClick={() => {
        resetZoom();
        onClose();
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div 
        ref={contentRef}
        className="image-modal-content"
        onClick={(e) => {
          e.stopPropagation();
          resetZoom();
        }}
      >
        <button 
          className="image-modal-close" 
          onClick={() => {
            resetZoom();
            onClose();
          }}
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
            transition: isDragging || isZoomed ? 'none' : 'transform 0.3s ease-out'
          }}
        />
      </div>
    </div>
  );
};

export default ImageModal; 