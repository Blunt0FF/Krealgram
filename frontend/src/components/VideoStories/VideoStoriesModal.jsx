import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getAvatarUrl, getAvatarThumbnailUrl } from '../../utils/imageUtils';
import { getImageUrl, getVideoUrl } from '../../utils/imageUtils';
import { getMediaThumbnail } from '../../utils/videoUtils';
import videoManager from '../../utils/videoManager';
import ShareModal from '../Post/ShareModal';
import VideoStoriesPreloader from './VideoStoriesPreloader';
import { API_URL } from '../../config';
import './VideoStoriesModal.css';

// Функция для определения мобильного устройства
const isMobile = () => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
         (navigator.maxTouchPoints && navigator.maxTouchPoints > 2 && /MacIntel/.test(navigator.platform));
};

const VideoStoriesModal = ({ user, isOpen, onClose }) => {
  const [videos, setVideos] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [viewedVideos, setViewedVideos] = useState(new Set());
  const [videoLoading, setVideoLoading] = useState(true);

  // Функция для форматирования времени в историях
  const formatStoryTime = (dateString) => {
    if (!dateString) return 'now';
    
    const postDate = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now - postDate) / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInHours / 24);
    
    if (diffInDays === 0) {
      // В тот же день - показываем время
      return postDate.toLocaleTimeString('ru-RU', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } else {
      // На следующий день и далее - показываем дату
      return postDate.toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit'
      });
    }
  };
  
  // Лайки и комментарии
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [showComments, setShowComments] = useState(true);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  
  // Swipe functionality
  const [touchStart, setTouchStart] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const modalRef = useRef(null);
  
  // Share modal
  const [showShareModal, setShowShareModal] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);

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

  // Обновляем лайки и комментарии при смене видео
  useEffect(() => {
    if (currentVideo) {
      const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
      setIsLiked(currentVideo.likes?.includes(currentUser._id) || false);
      setLikesCount(currentVideo.likesCount || currentVideo.likes?.length || 0);
      setComments(currentVideo.comments || []);
      setShowComments(true);
      setVideoLoading(true);
    }
  }, [currentVideo]);

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
        // Сразу убираем loading, так как видео уже загружены
        setLoading(false);
      } else {
        console.error('Failed to fetch videos:', response.status, response.statusText);
        setLoading(false);
      }
    } catch (error) {
      console.error('Error fetching user videos:', error);
      setLoading(false);
    }
  };

  const markVideoAsViewed = () => {
    if (currentVideo) {
      setViewedVideos(prev => new Set([...prev, currentVideo._id]));
    }
  };

  const handleNext = () => {
    if (isNavigating || !videos.length) return; // Защита от множественных вызовов
    
    setIsNavigating(true);
    markVideoAsViewed();
    
    setCurrentIndex(prevIndex => {
      const newIndex = prevIndex + 1;
      if (newIndex < videos.length) {
        return newIndex;
      } else {
        // Достигнут конец, закрываем модалку
        setTimeout(() => handleClose(), 0);
        return prevIndex;
      }
    });
    
    // Сбрасываем флаг через небольшую задержку
    setTimeout(() => setIsNavigating(false), 150);
  };

  const handlePrevious = () => {
    if (isNavigating || !videos.length) return; // Защита от множественных вызовов
    
    setIsNavigating(true);
    
    setCurrentIndex(prevIndex => {
      const newIndex = prevIndex - 1;
      if (newIndex >= 0) {
        return newIndex;
      } else {
        return prevIndex; // Остаемся на первом видео
      }
    });
    
    // Сбрасываем флаг через небольшую задержку
    setTimeout(() => setIsNavigating(false), 150);
  };

  const handleClose = () => {
    markVideoAsViewed();
    const allViewed = videos.length > 0 && viewedVideos.size + 1 >= videos.length;
    onClose(allViewed);
  };

  const handleProgressSegmentClick = (index) => {
    if (index !== currentIndex) {
      // Добавляем небольшую задержку для визуальной обратной связи
      setTimeout(() => {
        setCurrentIndex(index);
        // Сбрасываем состояние видео при переходе
        setVideoLoading(true);
      }, 100);
    }
  };

  const handleKeyDown = (e) => {
    if (e.repeat || isNavigating) return; // Игнорируем повторные события при зажатой клавише
    
    if (e.key === 'ArrowRight') handleNext();
    if (e.key === 'ArrowLeft') handlePrevious();
    if (e.key === 'Escape') handleClose();
  };

  const handleLike = async () => {
    if (!currentVideo) return;
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/likes/${currentVideo._id}/toggle`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setIsLiked(data.liked);
        setLikesCount(data.likeCount);
      }
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim() || !currentVideo || isSubmittingComment) return;

    setIsSubmittingComment(true);
    try {
      const token = localStorage.getItem('token');
      const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
      
      const response = await fetch(`${API_URL}/api/comments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: newComment,
          postId: currentVideo._id
        })
      });

      if (response.ok) {
        const data = await response.json();
        const newCommentObj = data.comment || {
          _id: Date.now().toString(),
          text: newComment,
          user: currentUser,
          author: currentUser,
          createdAt: new Date().toISOString()
        };
        
        setComments(prev => [...prev, newCommentObj]);
        setNewComment('');
      } else {
        console.error('Failed to add comment:', response.status, response.statusText);
        const errorText = await response.text();
        console.error('Error details:', errorText);
      }
    } catch (error) {
      console.error('Error adding comment:', error);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleTouchStart = (e) => {
    // Проверяем, не находимся ли мы в области комментариев
    const target = e.target;
    const isCommentsArea = target.closest('.stories-comments-list') || 
                          target.closest('.stories-add-comment') ||
                          target.closest('.stories-comment-input');
    
    // Если касание в области комментариев, не начинаем свайп
    if (isCommentsArea) {
      return;
    }
    
    setTouchStart({
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY
    });
    setIsDragging(true);
  };

  const handleTouchMove = (e) => {
    if (!isDragging) return;
    
    // Дополнительная проверка - если касание в области комментариев, останавливаем свайп
    const target = e.target;
    const isCommentsArea = target.closest('.stories-comments-list') || 
                          target.closest('.stories-add-comment') ||
                          target.closest('.stories-comment-input');
    
    if (isCommentsArea) {
      setIsDragging(false);
      if (modalRef.current) {
        modalRef.current.style.transform = '';
        modalRef.current.style.opacity = '';
      }
      return;
    }
    
    const currentY = e.targetTouches[0].clientY;
    const deltaY = currentY - touchStart.y;
    
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
    
    if (Math.abs(deltaY) > 100) {
      handleClose();
    } else {
      if (modalRef.current) {
        modalRef.current.style.transform = '';
        modalRef.current.style.opacity = '';
      }
    }
    
    setIsDragging(false);
  };

  const renderVideo = () => {
    if (!currentVideo) return null;

    // Определяем источник видео - ПРАВИЛЬНАЯ ЛОГИКА ДЛЯ ВИДЕО
    let videoSrc = null;
    
    // Для YouTube видео используем embedUrl
    if (currentVideo?.youtubeData?.videoId) {
      return (
        <iframe
          key={currentVideo.youtubeData.videoId}
          src={`https://www.youtube.com/embed/${currentVideo.youtubeData.videoId}?autoplay=1`}
          className="stories-video"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          style={{
            width: '100%',
            height: '100%',
            border: 'none'
          }}
        />
      );
    }
    
    // Для обычных видео используем videoUrl или image, пропуская через getVideoUrl для проксирования
    videoSrc = getVideoUrl(currentVideo?.videoUrl || currentVideo?.image);
    

    
    if (videoSrc) {
      return (
        <video
          key={videoSrc}
          src={videoSrc}
          className="stories-video"
          controls={true}
          autoPlay={true}
          muted={false}
          playsInline={true}
          preload="auto" // Используем предзагруженное видео
          style={{
            display: 'block',
            backgroundColor: '#000',
            width: '100%',
            height: '100%',
            objectFit: 'contain'
          }}
          onPlay={(e) => {
            videoManager.setCurrentVideo(e.target);
          }}
          onCanPlay={() => {
            setVideoLoading(false);
            // Извлекаем имя файла для логирования
            const getFileName = (url) => {
              try {
                const urlObj = new URL(url);
                const pathname = urlObj.pathname;
                const fileName = pathname.split('/').pop();
                return fileName || 'unknown';
              } catch {
                const parts = url.split('/');
                return parts[parts.length - 1] || 'unknown';
              }
            };
            const fileName = getFileName(videoSrc);
            console.log(`🎬 VideoStoriesModal loaded: ${fileName} (story ${currentIndex + 1})`);
          }}
          onEnded={() => {
            // Автоматически переходим к следующему видео
            if (currentIndex < videos.length - 1) {
              handleNext();
            } else {
              handleClose();
            }
          }}
          onError={(e) => {
            console.error('Video error:', e.target.error);
            setVideoLoading(false);
          }}
          onPause={(e) => {
            if (videoManager.getCurrentVideo() === e.target) {
              videoManager.pauseCurrentVideo();
            }
          }}
        >
          Your browser does not support the video tag.
        </video>
      );
    }

    return null;
  };

  if (!isOpen) return null;

  return (
    <>
      <VideoStoriesPreloader videos={videos} currentIndex={currentIndex} />
      <div 
        className="video-stories-modal-overlay"
        onClick={handleClose}
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
          
          <button className="stories-close-btn" onClick={handleClose}>
            ✕
          </button>

          <div className="stories-progress-bar">
            {videos.map((_, index) => (
              <div 
                key={index} 
                className={`progress-segment ${index <= currentIndex ? 'active' : ''}`}
                onClick={() => handleProgressSegmentClick(index)}
                style={{ cursor: 'pointer' }}
              />
            ))}
          </div>

          <div className="stories-header">
            <a href={`/profile/${user.username}`} className="stories-avatar-link" tabIndex={-1} style={{display: 'flex', alignItems: 'center', textDecoration: 'none'}}>
              <img
                src={getAvatarThumbnailUrl(user.avatar)}
                alt={user.username}
                className="stories-avatar"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = '/default-avatar.png';
                }}
              />
              <span className="stories-username" style={{marginLeft: 8}}>{user.username}</span>
            </a>
            <span className="stories-time">{formatStoryTime(currentVideo?.createdAt)}</span>
          </div>

          {videos.length > 0 && (
            <>
              {currentIndex > 0 && (
                <button className="stories-nav-btn stories-prev-btn" onClick={handlePrevious}>
                  <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                    <path fillRule="evenodd" d="M11.354 1.646a.5.5 0 0 1 0 .708L5.707 8l5.647 5.646a.5.5 0 0 1-.708.708l-6-6a.5.5 0 0 1 0-.708l6-6a.5.5 0 0 1 .708 0z"/>
                  </svg>
                </button>
              )}
              {currentIndex < videos.length - 1 && (
                <button className="stories-nav-btn stories-next-btn" onClick={handleNext}>
                  <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                    <path fillRule="evenodd" d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708z"/>
                  </svg>
                </button>
              )}
              
              <div className="stories-video-container">
                {renderVideo()}
              </div>
            </>
          )}

          <div className="stories-bottom-interface">
            <div className="stories-actions">
              <div className="stories-actions-left">
                <button 
                  className={`stories-like-btn ${isLiked ? 'liked' : ''}`}
                  onClick={handleLike}
                >
                  <svg width="24" height="24" fill={isLiked ? "#ed4956" : "none"} stroke={isLiked ? "#ed4956" : "white"} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                </button>
                
                {likesCount > 0 && (
                  <span className="stories-likes-count">
                    {likesCount} {likesCount === 1 ? 'like' : 'likes'}
                  </span>
                )}
              </div>

              <button 
                className="stories-share-btn"
                onClick={() => setShowShareModal(true)}
              >
                <svg width="24" height="24" fill="none" stroke="white" viewBox="0 0 24 24">
                  <path d="m3 3 3 9-3 9 19-9Z" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>

            {currentVideo?.caption && (
              <div className="stories-description">
                {currentVideo.caption}
              </div>
            )}

            {comments.length > 0 && (
              <div className="stories-comments-list">
                {showComments && comments.map((comment, index) => {
                  const username = comment.author?.username || comment.user?.username || comment.username || 'Unknown User';
                  return (
                    <div key={comment._id || index} className="stories-comment">
                      <span 
                        className="comment-username clickable-username"
                        onClick={() => {
                          if (username !== 'Unknown User') {
                            window.location.href = `/profile/${username}`;
                          }
                        }}
                      >
                        {username}
                      </span>
                      <span className="stories-comment-text">{comment.text}</span>
                    </div>
                  );
                })}
                
                <button 
                  className="stories-view-comments"
                  onClick={() => setShowComments(!showComments)}
                >
                  {showComments 
                    ? 'Hide comments' 
                    : `Show comments (${comments.length})`
                  }
                </button>
              </div>
            )}

            <form className="stories-add-comment" onSubmit={handleAddComment}>
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment..."
                className="stories-comment-input"
                disabled={isSubmittingComment}
              />
              {newComment.trim() && (
                <button 
                  type="submit" 
                  className="stories-comment-submit"
                  disabled={isSubmittingComment}
                >
                  {isSubmittingComment ? '...' : 'Post'}
                </button>
              )}
            </form>
          </div>
        </div>
      </div>

      {showShareModal && currentVideo && (
        <ShareModal
          postId={currentVideo._id}
          post={currentVideo}
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
        />
      )}
    </>
  );
};

export default VideoStoriesModal; 