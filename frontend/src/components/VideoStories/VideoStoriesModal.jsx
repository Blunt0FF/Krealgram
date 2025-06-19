import React, { useState, useEffect, useRef } from 'react';
import { getAvatarUrl } from '../../utils/imageUtils';
import { getMediaThumbnail } from '../../utils/videoUtils';
import videoManager from '../../utils/videoManager';
import { API_URL } from '../../config';
import './VideoStoriesModal.css';

const VideoStoriesModal = ({ user, isOpen, onClose }) => {
  const [videos, setVideos] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  
  // Swipe functionality
  const [touchStart, setTouchStart] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const modalRef = useRef(null);

  const currentVideo = videos[currentIndex];

  useEffect(() => {
    if (isOpen && user) {
      fetchUserVideos();
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, user]);

  useEffect(() => {
    if (isOpen) {
      videoManager.pauseAllFeedVideos();
    }
  }, [isOpen]);

  const fetchUserVideos = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/posts/user/${user._id}/videos`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setVideos(data.posts || []);
      }
    } catch (error) {
      console.error('Error fetching user videos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    if (currentIndex < videos.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowRight') handleNext();
    if (e.key === 'ArrowLeft') handlePrevious();
    if (e.key === 'Escape') onClose();
  };

  // Touch handlers for swipe
  const handleTouchStart = (e) => {
    setTouchStart({
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY
    });
    setIsDragging(true);
  };

  const handleTouchMove = (e) => {
    if (!isDragging) return;
    
    const currentY = e.targetTouches[0].clientY;
    const deltaY = currentY - touchStart.y;
    
    // Only handle vertical swipes for closing
    if (Math.abs(deltaY) > 50) {
      if (modalRef.current) {
        const opacity = Math.max(0.3, 1 - Math.abs(deltaY) / 300);
        modalRef.current.style.transform = `translateY(${deltaY}px)`;
        modalRef.current.style.opacity = opacity;
      }
    }
  };

  const handleTouchEnd = (e) => {
    if (!isDragging) return;
    
    const deltaY = e.changedTouches[0].clientY - touchStart.y;
    
    // Close if swiped down/up more than 100px
    if (Math.abs(deltaY) > 100) {
      onClose();
    } else {
      // Reset position
      if (modalRef.current) {
        modalRef.current.style.transform = '';
        modalRef.current.style.opacity = '';
      }
    }
    
    setIsDragging(false);
  };

  if (!isOpen) return null;

  return (
    <div 
      className="video-stories-modal-overlay"
      onClick={onClose}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <div 
        ref={modalRef}
        className="video-stories-modal-content" 
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        
        {/* Кнопка закрытия */}
        <button className="stories-close-btn" onClick={onClose}>
          ✕
        </button>

        {/* Progress bar */}
        <div className="stories-progress-bar">
          {videos.map((_, index) => (
            <div 
              key={index} 
              className={`progress-segment ${index <= currentIndex ? 'active' : ''}`}
            />
          ))}
        </div>

        {/* Header с пользователем */}
        <div className="stories-header">
          <img
            src={getAvatarUrl(user.avatar)}
            alt={user.username}
            className="stories-avatar"
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = '/default-avatar.png';
            }}
          />
          <span className="stories-username">{user.username}</span>
          <span className="stories-time">now</span>
        </div>

        {loading ? (
          <div className="stories-loading">Loading...</div>
        ) : videos.length === 0 ? (
          <div className="stories-no-videos">No videos found</div>
        ) : (
          <>
            {/* Стрелки навигации */}
            {currentIndex > 0 && (
              <button className="stories-nav-btn stories-prev-btn" onClick={handlePrevious}>
                ‹
              </button>
            )}
            {currentIndex < videos.length - 1 && (
              <button className="stories-nav-btn stories-next-btn" onClick={handleNext}>
                ›
              </button>
            )}
            
            {/* Основное видео */}
            <div className="stories-video-container">
              {currentVideo?.youtubeData ? (
                <iframe
                  src={currentVideo.youtubeData.embedUrl}
                  className="stories-video"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : currentVideo?.videoUrl && currentVideo.videoUrl.includes('youtube') ? (
                <iframe
                  src={currentVideo.videoUrl.replace('watch?v=', 'embed/')}
                  className="stories-video"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : currentVideo?.mediaType === 'video' ? (
                <video
                  src={currentVideo.imageUrl || currentVideo.image}
                  className="stories-video"
                  controls={true}
                  muted={false}
                  playsInline
                  preload="metadata"
                  onPlay={(e) => videoManager.setCurrentVideo(e.target)}
                  onPause={(e) => {
                    if (videoManager.getCurrentVideo() === e.target) {
                      videoManager.pauseCurrentVideo();
                    }
                  }}
                >
                  Your browser does not support the video tag.
                </video>
              ) : (
                <div className="stories-no-video">Video not available</div>
              )}
            </div>

            {/* Caption внизу */}
            {currentVideo?.caption && (
              <div className="stories-caption">
                {currentVideo.caption}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default VideoStoriesModal; 