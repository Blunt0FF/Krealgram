import React, { useState, useEffect, useRef } from 'react';
import { getAvatarUrl } from '../../utils/imageUtils';
import { getMediaThumbnail } from '../../utils/videoUtils';
import videoManager from '../../utils/videoManager';
import ShareModal from '../Post/ShareModal';
import { API_URL } from '../../config';
import './VideoStoriesModal.css';

const VideoStoriesModal = ({ user, isOpen, onClose }) => {
  const [videos, setVideos] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [viewedVideos, setViewedVideos] = useState(new Set());
  
  // Лайки и комментарии
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [showComments, setShowComments] = useState(false);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  
  // Swipe functionality
  const [touchStart, setTouchStart] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const modalRef = useRef(null);
  
  // Share modal
  const [showShareModal, setShowShareModal] = useState(false);

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
      setShowComments(false);
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
      }
    } catch (error) {
      console.error('Error fetching user videos:', error);
    } finally {
      setLoading(false);
    }
  };

  const markVideoAsViewed = () => {
    if (currentVideo) {
      setViewedVideos(prev => new Set([...prev, currentVideo._id]));
    }
  };

  const handleNext = () => {
    markVideoAsViewed(); // Отмечаем текущее видео как просмотренное
    if (currentIndex < videos.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleClose = () => {
    markVideoAsViewed(); // Отмечаем текущее видео как просмотренное
    
    // Проверяем, все ли видео просмотрены
    const allViewed = videos.length > 0 && viewedVideos.size + 1 >= videos.length;
    onClose(allViewed);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowRight') handleNext();
    if (e.key === 'ArrowLeft') handlePrevious();
    if (e.key === 'Escape') handleClose();
  };

  // Функция лайка
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

  // Функция добавления комментария
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
        // Создаем комментарий с правильной структурой если API не вернул полную информацию
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
      handleClose();
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
        
        {/* Кнопка закрытия */}
        <button className="stories-close-btn" onClick={handleClose}>
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
              {(() => {
                console.log('🎬 Current video data:', {
                  currentVideo,
                  youtubeData: currentVideo?.youtubeData,
                  videoUrl: currentVideo?.videoUrl,
                  imageUrl: currentVideo?.imageUrl,
                  image: currentVideo?.image,
                  mediaType: currentVideo?.mediaType
                });
                return null;
              })()}
              {currentVideo?.youtubeData ? (
                <iframe
                  src={currentVideo.youtubeData.embedUrl}
                  className="stories-video"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  loading="eager"
                  style={{ 
                    display: 'block',
                    backgroundColor: '#000',
                    border: 'none'
                  }}
                  onLoad={() => console.log('Stories YouTube iframe loaded')}
                  onError={(e) => console.error('Stories YouTube iframe error:', e)}
                />
              ) : currentVideo?.videoUrl && currentVideo.videoUrl.includes('youtube') ? (
                <iframe
                  src={currentVideo.videoUrl.replace('watch?v=', 'embed/')}
                  className="stories-video"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  loading="eager"
                  style={{ 
                    display: 'block',
                    backgroundColor: '#000',
                    border: 'none'
                  }}
                  onLoad={() => console.log('Stories YouTube iframe loaded')}
                  onError={(e) => console.error('Stories YouTube iframe error:', e)}
                />
              ) : currentVideo?.mediaType === 'video' ? (
                <video
                  src={currentVideo.imageUrl || currentVideo.image || currentVideo.videoUrl}
                  className="stories-video"
                  controls={true}
                  muted={false}
                  playsInline={true}
                  webkit-playsinline="true"
                  x5-playsinline="true"
                  x5-video-player-type="h5"
                  x5-video-player-fullscreen="true"
                  x5-video-orientation="portraint"
                  preload="metadata"
                  style={{
                    display: 'block',
                    backgroundColor: '#000'
                  }}
                  onPlay={(e) => videoManager.setCurrentVideo(e.target)}
                  onPause={(e) => {
                    if (videoManager.getCurrentVideo() === e.target) {
                      videoManager.pauseCurrentVideo();
                    }
                  }}
                  onLoadStart={() => console.log('Stories video loading started')}
                  onCanPlay={() => console.log('Stories video can play')}
                  onError={(e) => {
                    console.error('Stories video error:', e);
                    console.error('Failed video src:', e.target.src);
                  }}
                >
                  Your browser does not support the video tag.
                </video>
              ) : currentVideo?.videoUrl || currentVideo?.imageUrl || currentVideo?.image ? (
                // Fallback для случаев когда mediaType не 'video', но есть видео данные
                <video
                  src={currentVideo.videoUrl || currentVideo.imageUrl || currentVideo.image}
                  className="stories-video"
                  controls={true}
                  muted={false}
                  playsInline={true}
                  webkit-playsinline="true"
                  x5-playsinline="true"
                  x5-video-player-type="h5"
                  x5-video-player-fullscreen="true"
                  x5-video-orientation="portraint"
                  preload="metadata"
                  style={{
                    display: 'block',
                    backgroundColor: '#000'
                  }}
                  onPlay={(e) => videoManager.setCurrentVideo(e.target)}
                  onPause={(e) => {
                    if (videoManager.getCurrentVideo() === e.target) {
                      videoManager.pauseCurrentVideo();
                    }
                  }}
                  onLoadStart={() => console.log('Stories fallback video loading started')}
                  onCanPlay={() => console.log('Stories fallback video can play')}
                  onError={(e) => {
                    console.error('Stories fallback video error:', e);
                    console.error('Failed fallback video src:', e.target.src);
                  }}
                >
                  Your browser does not support the video tag.
                </video>
              ) : (
                <div className="stories-no-video">
                  Video not available
                  <br />
                  <small>Debug: {JSON.stringify({
                    mediaType: currentVideo?.mediaType,
                    hasVideoUrl: !!currentVideo?.videoUrl,
                    hasImageUrl: !!currentVideo?.imageUrl,
                    hasImage: !!currentVideo?.image,
                    hasYoutubeData: !!currentVideo?.youtubeData
                  }, null, 2)}</small>
                </div>
              )}
            </div>

            {/* Instagram-style интерфейс внизу */}
            <div className="stories-bottom-interface">
              {/* Кнопки действий */}
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
                  
                  {/* Счетчик лайков рядом с иконкой */}
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

              {/* Описание */}
              {currentVideo?.caption && (
                <div className="stories-description">
                  {currentVideo.caption}
                </div>
              )}

              {/* Комментарии - показываем только по кнопке */}
              {comments.length > 0 && (
                <div className="stories-comments-list">
                  {/* Показываем комментарии только если showComments = true */}
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
                  
                  {/* Кнопка показать/скрыть комментарии */}
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

              {/* Поле добавления комментария */}
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
          </>
        )}
      </div>

      {/* Share Modal */}
      {showShareModal && currentVideo && (
        <ShareModal
          postId={currentVideo._id}
          post={currentVideo}
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
        />
      )}
    </div>
  );
};

export default VideoStoriesModal; 