import React, { useState, useEffect, useRef } from 'react';
import { getAvatarUrl } from '../../utils/imageUtils';
import { getMediaThumbnail } from '../../utils/videoUtils';
import videoManager from '../../utils/videoManager';
import ShareModal from '../Post/ShareModal';
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
  const [showVideoPreview, setShowVideoPreview] = useState(isMobile());
  
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
      // Сбрасываем состояние превью для мобильных
      setShowVideoPreview(isMobile());
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
        console.log('📹 Fetched user videos:', data);
        console.log('📹 Videos array:', data.posts);
        if (data.posts && data.posts.length > 0) {
          console.log('📹 First video data:', data.posts[0]);
        }
        setVideos(data.posts || []);
      } else {
        console.error('Failed to fetch videos:', response.status, response.statusText);
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
    markVideoAsViewed();
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
    markVideoAsViewed();
    const allViewed = videos.length > 0 && viewedVideos.size + 1 >= videos.length;
    onClose(allViewed);
  };

  const handleKeyDown = (e) => {
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

  // Функция для отображения превью на мобильных устройствах
  const renderMobilePreview = () => {
    if (!currentVideo) return null;

    // Определяем URL для превью
    let previewUrl = null;
    
    if (currentVideo?.mobileThumbnailUrl) {
      previewUrl = currentVideo.mobileThumbnailUrl;
    } else if (currentVideo?.thumbnailUrl) {
      previewUrl = currentVideo.thumbnailUrl;
    } else if (currentVideo?.imageUrl) {
      previewUrl = currentVideo.imageUrl;
    } else if (currentVideo?.image) {
      previewUrl = currentVideo.image.startsWith('http') 
        ? currentVideo.image 
        : `${API_URL}/uploads/${currentVideo.image}`;
    }

    console.log('📱 Mobile preview URL:', previewUrl);

    if (!previewUrl) {
      return (
        <div className="stories-video-placeholder">
          <div className="placeholder-icon">🎬</div>
          <div className="placeholder-text">Загрузка видео...</div>
        </div>
      );
    }

    return (
      <div className="stories-mobile-preview" onClick={() => setShowVideoPreview(false)}>
        <img 
          src={previewUrl}
          alt="Video preview"
          className="stories-preview-image"
          onLoad={() => {
            console.log('✅ Preview image loaded successfully');
            setVideoLoading(false);
          }}
          onError={(e) => {
            console.error('❌ Preview image failed to load:', e.target.src);
            // Пробуем альтернативные варианты
            if (currentVideo?.imageUrl && e.target.src !== currentVideo.imageUrl) {
              e.target.src = currentVideo.imageUrl;
            } else if (currentVideo?.image && !e.target.src.includes(currentVideo.image)) {
              const altSrc = currentVideo.image.startsWith('http') 
                ? currentVideo.image 
                : `${API_URL}/uploads/${currentVideo.image}`;
              e.target.src = altSrc;
            } else {
              e.target.style.display = 'none';
              setVideoLoading(false);
            }
          }}
        />
        <div className="stories-play-button">
          <div className="play-icon">▶</div>
        </div>
        <div className="stories-preview-hint">Нажмите для воспроизведения</div>
      </div>
    );
  };

  const renderVideo = () => {
    if (!currentVideo) return null;

    console.log('🎬 Current video data:', {
      currentVideo,
      youtubeData: currentVideo?.youtubeData,
      videoUrl: currentVideo?.videoUrl,
      imageUrl: currentVideo?.imageUrl,
      image: currentVideo?.image,
      mediaType: currentVideo?.mediaType
    });

    // YouTube видео
    if (currentVideo?.youtubeData) {
      return (
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
      );
    }

    // Определяем источник видео - ИСПРАВЛЕННАЯ ЛОГИКА
    let videoSrc = null;
    
    // Приоритет: videoUrl > image (для загруженных видео) > imageUrl
    if (currentVideo?.videoUrl) {
      videoSrc = currentVideo.videoUrl;
    } else if (currentVideo?.image) {
      // Для загруженных видео файлов - они хранятся в поле image
      if (currentVideo.image.startsWith('http')) {
        videoSrc = currentVideo.image;
      } else {
        videoSrc = `${API_URL}/uploads/${currentVideo.image}`;
      }
    } else if (currentVideo?.imageUrl) {
      videoSrc = currentVideo.imageUrl;
    }
    
    console.log('🎥 Video source determined:', { 
      videoSrc, 
      originalImage: currentVideo?.image,
      videoUrl: currentVideo?.videoUrl,
      imageUrl: currentVideo?.imageUrl,
      mediaType: currentVideo?.mediaType 
    });
    
    if (videoSrc) {
      return (
        <video
          src={videoSrc}
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
          poster={currentVideo?.mobileThumbnailUrl || currentVideo?.thumbnailUrl || currentVideo?.imageUrl || '/video-placeholder.svg'}
          style={{
            display: 'block',
            backgroundColor: '#000'
          }}
          onPlay={(e) => videoManager.setCurrentVideo(e.target)}
          onLoadStart={() => console.log('Video loading started')}
          onLoadedData={() => console.log('Video data loaded')}
          onCanPlay={() => console.log('Video can play')}
          onError={(e) => {
            console.error('Video error:', e.target.error);
            console.log('Failed video src:', e.target.src);
            console.log('Error details:', {
              error: e.target.error,
              networkState: e.target.networkState,
              readyState: e.target.readyState,
              currentSrc: e.target.currentSrc
            });
            
            // Попробуем альтернативный путь
            if (!e.target.src.includes('http://localhost:5000')) {
              const altSrc = `http://localhost:5000/uploads/${currentVideo?.image}`;
              console.log('Trying alternative src:', altSrc);
              e.target.src = altSrc;
            }
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

    return (
      <div className="stories-no-video">
        <p>Video not available</p>
        <div style={{ fontSize: '12px', color: '#a8a8a8', marginTop: '10px' }}>
          Debug info: mediaType={currentVideo?.mediaType}, 
          hasImage={!!currentVideo?.image}, 
          hasImageUrl={!!currentVideo?.imageUrl}, 
          hasVideoUrl={!!currentVideo?.videoUrl},
          hasYoutubeData={!!currentVideo?.youtubeData},
          imageValue={currentVideo?.image}
        </div>
        
        {/* Дополнительная диагностическая информация */}
        <div style={{ fontSize: '10px', color: '#666', marginTop: '10px', textAlign: 'left' }}>
          <div>Image: {currentVideo?.image || 'null'}</div>
          <div>VideoUrl: {currentVideo?.videoUrl || 'null'}</div>
          <div>ImageUrl: {currentVideo?.imageUrl || 'null'}</div>
          <div>MediaType: {currentVideo?.mediaType || 'null'}</div>
          <div>YoutubeData: {currentVideo?.youtubeData ? 'exists' : 'null'}</div>
          <div>Caption: {currentVideo?.caption || 'null'}</div>
          <div>ID: {currentVideo?._id || 'null'}</div>
        </div>
        
        {/* Если есть image, попробуем показать как картинку для проверки */}
        {currentVideo?.image && (
          <div style={{ marginTop: '20px' }}>
            <p style={{ color: '#a8a8a8', fontSize: '12px' }}>Trying to display as image:</p>
            <img 
              src={currentVideo.image.startsWith('http') ? currentVideo.image : `${API_URL}/uploads/${currentVideo.image}`}
              alt="Debug preview"
              style={{ maxWidth: '200px', maxHeight: '200px', border: '1px solid #333' }}
              onError={(e) => {
                console.log('Image also failed to load:', e.target.src);
                e.target.style.display = 'none';
              }}
              onLoad={() => console.log('Image loaded successfully')}
            />
          </div>
        )}
      </div>
    );
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
        
        <button className="stories-close-btn" onClick={handleClose}>
          ✕
        </button>

        <div className="stories-progress-bar">
          {videos.map((_, index) => (
            <div 
              key={index} 
              className={`progress-segment ${index <= currentIndex ? 'active' : ''}`}
            />
          ))}
        </div>

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
            
            <div className="stories-video-container">
              {showVideoPreview ? renderMobilePreview() : renderVideo()}
            </div>

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
          </>
        )}
      </div>

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