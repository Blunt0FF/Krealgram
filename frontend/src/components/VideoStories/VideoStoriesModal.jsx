import React, { useState, useEffect } from 'react';
import VideoPlayer from '../VideoPlayer/VideoPlayer';
import { getAvatarUrl } from '../../utils/imageUtils';
import { getMediaThumbnail } from '../../utils/videoUtils';
import { API_URL } from '../../config';
import './VideoStoriesModal.css';

const VideoStoriesModal = ({ user, isOpen, onClose }) => {
  const [videos, setVideos] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && user) {
      fetchUserVideos();
    }
  }, [isOpen, user]);

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

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  if (!isOpen) return null;

  return (
    <div 
      className="video-stories-modal-overlay"
      onClick={onClose}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <div className="video-stories-modal-content" onClick={(e) => e.stopPropagation()}>
        
        {/* Header */}
        <div className="video-stories-modal-header">
          <div className="modal-user-info">
            <img 
              src={getAvatarUrl(user.avatar)} 
              alt={user.username}
              className="modal-user-avatar"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = '/default-avatar.png';
              }}
            />
            <span className="modal-user-username">{user.username}</span>
            {videos.length > 0 && (
              <span className="modal-video-date">
                {formatDate(videos[currentIndex]?.createdAt)}
              </span>
            )}
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Progress bar */}
        {videos.length > 1 && (
          <div className="video-progress-container">
            {videos.map((_, index) => (
              <div 
                key={index}
                className={`progress-segment ${index <= currentIndex ? 'active' : ''}`}
              />
            ))}
          </div>
        )}

        {/* Video content */}
        <div className="video-stories-modal-body">
          {loading ? (
            <div className="modal-loading">Loading videos...</div>
          ) : videos.length === 0 ? (
            <div className="modal-no-videos">No videos found</div>
          ) : (
            <div className="video-container">
              {/* Navigation buttons */}
              {currentIndex > 0 && (
                <button 
                  className="nav-btn nav-prev" 
                  onClick={handlePrevious}
                >
                  ‹
                </button>
              )}
              {currentIndex < videos.length - 1 && (
                <button 
                  className="nav-btn nav-next" 
                  onClick={handleNext}
                >
                  ›
                </button>
              )}

              {/* Video display */}
              {videos[currentIndex]?.youtubeData ? (
                <iframe
                  width="100%"
                  height="400"
                  src={videos[currentIndex].youtubeData.embedUrl}
                  title="YouTube video player"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  style={{ borderRadius: '8px' }}
                />
              ) : videos[currentIndex]?.videoUrl && videos[currentIndex].videoUrl.includes('youtube') ? (
                <iframe
                  width="100%"
                  height="400"
                  src={videos[currentIndex].videoUrl.replace('watch?v=', 'embed/')}
                  title="YouTube video player"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  style={{ borderRadius: '8px' }}
                />
              ) : videos[currentIndex]?.mediaType === 'video' ? (
                <VideoPlayer 
                  src={videos[currentIndex].imageUrl || videos[currentIndex].image}
                  poster={getMediaThumbnail(videos[currentIndex])}
                  className="modal-video-player"
                  autoplay={false}
                  controls={true}
                />
              ) : (
                <div className="modal-no-video">
                  <p>Video not available</p>
                  <p style={{ fontSize: '12px', color: '#a8a8a8', marginTop: '10px' }}>
                    This video format is not supported or the link is no longer valid
                  </p>
                </div>
              )}

              {/* Video info */}
              {videos[currentIndex]?.caption && (
                <div className="video-caption">
                  {videos[currentIndex].caption}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer with counter */}
        {videos.length > 0 && (
          <div className="video-stories-modal-footer">
            <span className="video-counter">
              {currentIndex + 1} / {videos.length}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoStoriesModal; 