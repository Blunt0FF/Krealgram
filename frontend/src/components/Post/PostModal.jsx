import React, { useState, useEffect, useRef, useMemo, useLayoutEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ShareModal from './ShareModal';
import EditPostModal from './EditPostModal';
import LikesModal from './LikesModal';

import { getImageUrl, getAvatarUrl } from '../../utils/imageUtils';
import { getMediaThumbnail } from '../../utils/videoUtils';
import videoManager from '../../utils/videoManager';
import { lockBodyScroll, unlockBodyScroll } from '../../utils/scrollUtils';
import { API_URL } from '../../config';
import './PostModal.css';

const MAX_CAPTION_LENGTH_EDIT = 500; // Максимальная длина описания при редактировании

// Функция для проверки и извлечения YouTube ID
const extractYouTubeId = (url) => {
  if (!url) return null;
  
  // Улучшенная проверка YouTube URL
  let videoId = null;
  
  // Стандартный YouTube URL
  if (url.includes('youtube.com/watch?v=')) {
    const match = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
    videoId = match ? match[1] : null;
  }
  // Короткий YouTube URL
  else if (url.includes('youtu.be/')) {
    const match = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
    videoId = match ? match[1] : null;
  }
  // Embed URL
  else if (url.includes('youtube.com/embed/')) {
    const match = url.match(/embed\/([a-zA-Z0-9_-]{11})/);
    videoId = match ? match[1] : null;
  }
  
  return videoId;
};

// Функция для создания данных YouTube
const createYouTubeData = (url) => {
  const videoId = extractYouTubeId(url);
  if (!videoId) return null;
  
  return {
    type: 'video',
    youtubeId: videoId,
    embedUrl: `https://www.youtube.com/embed/${videoId}`,
    thumbnailUrl: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
    originalUrl: url
  };
};

const PostModal = ({
  post: initialPost,
  isOpen,
  onClose,
  currentUser,
  onPostUpdate,
  onDeletePost,
  onPrevious,
  onNext,
  canGoPrevious,
  canGoNext
}) => {
  const [postData, setPostData] = useState(initialPost);
  const [newComment, setNewComment] = useState('');
  const [comments, setComments] = useState(initialPost?.comments || []);
  const [isLikedByCurrentUser, setIsLikedByCurrentUser] = useState(() => {
    if (!currentUser) return false;
    return initialPost?.likes?.includes(currentUser._id) || initialPost?.isLikedByCurrentUser || false;
  });
  const [likesCount, setLikesCount] = useState(initialPost?.likes?.length || initialPost?.likesCount || 0);
  const [isLoadingLike, setIsLoadingLike] = useState(false);
  const [commentsToShow, setCommentsToShow] = useState(4);
  const [showLikesTooltip, setShowLikesTooltip] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [isCaptionExpanded, setIsCaptionExpanded] = useState(false);
  const [iframeError, setIframeError] = useState(false);
  
  const [touchStartY, setTouchStartY] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const modalContentRef = useRef(null);
  const overlayRef = useRef(null);
  
  const commentsContainerRef = useRef(null);
  const commentsEndRef = useRef(null);
  const [topCommentId, setTopCommentId] = useState(null);
  const [justSubmittedComment, setJustSubmittedComment] = useState(false);

  const commentInputRef = useRef(null);

  const token = localStorage.getItem('token');

  useEffect(() => {
    if (!initialPost) return;
    
    setPostData(initialPost);
    setComments(initialPost?.comments || []);
    setCommentsToShow(4);
    setIsCaptionExpanded(false);
    setIframeError(false); // Сбрасываем ошибку iframe при смене поста

    if (currentUser && initialPost) {
      const userLiked = initialPost.likes?.includes(currentUser._id) || 
                       initialPost.isLikedByCurrentUser || 
                       false;
      setIsLikedByCurrentUser(userLiked);
      setLikesCount(initialPost.likes?.length || initialPost.likesCount || 0);
    }
  }, [initialPost, currentUser]);

  useEffect(() => {
    const handleKeyPress = (e) => {
      if (!isOpen) return;

      // Если открыт модал редактирования, отключаем навигацию по стрелкам
      if (showEditModal) {
        const activeElement = document.activeElement;
        const isInputOrTextArea = activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA';
        const isInsideEditModal = activeElement.closest('.edit-post-modal-content'); // Предполагаемый класс контента EditPostModal

        if (isInputOrTextArea && isInsideEditModal && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
          e.preventDefault(); // Предотвращаем переключение поста
          e.stopPropagation(); // Останавливаем всплытие события
          return;
        }
      }

      if (commentInputRef.current && document.activeElement === commentInputRef.current) {
        if (e.key === 'Escape') {
          onClose();
        }
        return;
      }

      if (e.key === 'Escape') {
        onClose();
      }
      if (e.key === 'ArrowLeft' && onPrevious && !showEditModal) {
        onPrevious();
      }
      if (e.key === 'ArrowRight' && onNext && !showEditModal) {
        onNext();
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [isOpen, onClose, onPrevious, onNext, showEditModal]);

  useEffect(() => {
    if (isOpen || showEditModal) {
      lockBodyScroll();
      
      // Останавливаем все видео в ленте при открытии модалки
      videoManager.pauseAllFeedVideos();
    } else {
      unlockBodyScroll();
      // Очищаем transform при закрытии модалки
      if (modalContentRef.current) {
        modalContentRef.current.style.transform = '';
      }
      if (overlayRef.current) {
        overlayRef.current.style.backgroundColor = '';
      }
    }
    
    return () => {
      unlockBodyScroll();
      // Очищаем transform при размонтировании
      if (modalContentRef.current) {
        modalContentRef.current.style.transform = '';
      }
      if (overlayRef.current) {
        overlayRef.current.style.backgroundColor = '';
      }
    };
  }, [isOpen, showEditModal]);

  useLayoutEffect(() => {
    if (topCommentId && commentsContainerRef.current) {
        const topElement = commentsContainerRef.current.querySelector(`#comment-${topCommentId}`);
        if (topElement) {
            const container = commentsContainerRef.current;
            const offset = topElement.offsetTop - container.offsetTop;
            container.scrollTop = offset;
        }
        setTopCommentId(null);
    } else if (justSubmittedComment && commentsEndRef.current) {
        commentsEndRef.current.scrollIntoView({ behavior: 'smooth' });
        setJustSubmittedComment(false);
    }
  }, [comments, topCommentId, justSubmittedComment]);

  const handleTouchStart = (e) => {
    if (e.target.closest('.post-modal-sidebar') || e.target.closest('.modal-nav-btn')) return;
    setTouchStartY(e.targetTouches[0].clientY);
    setIsDragging(true);
    modalContentRef.current.classList.add('is-dragging');
  };

  const handleTouchMove = (e) => {
    if (!isDragging || touchStartY === null) return;
    const currentY = e.targetTouches[0].clientY;
    const deltaY = currentY - touchStartY;

    const backgroundOpacity = Math.max(1 - Math.abs(deltaY) / 1000, 0.5);
    if(overlayRef.current) {
      overlayRef.current.style.backgroundColor = `rgba(0, 0, 0, ${0.65 * backgroundOpacity})`;
    }
    if (modalContentRef.current) {
      modalContentRef.current.style.transform = `translateY(${deltaY}px)`;
    }
  };

  const handleTouchEnd = (e) => {
    if (!isDragging || touchStartY === null) return;

    const currentY = e.changedTouches[0].clientY;
    const deltaY = currentY - touchStartY;
    const closeThreshold = 150;

    modalContentRef.current.classList.remove('is-dragging');

    if (Math.abs(deltaY) > closeThreshold) {
      onClose();
    } else {
      if (overlayRef.current) {
        overlayRef.current.style.backgroundColor = '';
      }
      if (modalContentRef.current) {
        modalContentRef.current.style.transform = '';
      }
    }

    setIsDragging(false);
    setTouchStartY(null);
  };

  if (!isOpen || !postData) return null;

  const { _id: postId, author, caption } = postData;
  
  // Fallback для author если не определен
  const postAuthor = author || postData.user || postData.author;

  // Логика для "more/less" кнопки
  const needsMoreButton = useMemo(() => {
    if (!caption) return false;
    return caption.length > 50 || caption.includes('\n') || caption.includes('<br');
  }, [caption]);

  const formatDateTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    const day = date.getDate();
    const month = monthNames[date.getMonth()];
    const year = date.getFullYear();
    const currentYear = now.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    
    if (year === currentYear) {
      return `${month} ${day} at ${hours}:${minutes}`;
    } else {
      return `${month} ${day}, ${year} at ${hours}:${minutes}`;
    }
  };

  const toggleLike = async () => {
    if (!token || !currentUser || !postData) return;
    setIsLoadingLike(true);
    const wasLiked = isLikedByCurrentUser;
    const previousCount = likesCount;
    
    // Оптимистичное обновление
    setIsLikedByCurrentUser(!wasLiked);
    setLikesCount(prev => wasLiked ? prev - 1 : prev + 1);
    
    try {
      const response = await fetch(`${API_URL}/api/likes/${postData._id}/toggle`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      if (!response.ok || data.liked === undefined) {
        console.error('Like error:', data.message);
        setIsLikedByCurrentUser(wasLiked);
        setLikesCount(previousCount);
      } else {
        setIsLikedByCurrentUser(data.liked);
        setLikesCount(data.likeCount);
        
        if (onPostUpdate) {
          onPostUpdate(postData._id, {
            likes: data.likes || [],
            likesCount: data.likeCount,
            isLikedByCurrentUser: data.liked,
            isLiked: data.liked
          });
        }
      }
    } catch (err) {
      console.error('Network error:', err);
      setIsLikedByCurrentUser(wasLiked);
      setLikesCount(previousCount);
    } finally {
      setIsLoadingLike(false);
    }
  };

  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    if (!newComment.trim() || !currentUser || !postData) return;

    const optimisticComment = {
      _id: `temp-${Date.now()}`,
      text: newComment,
      user: { _id: currentUser._id, username: currentUser.username, avatar: currentUser.avatar },
      createdAt: new Date().toISOString()
    };

    const newComments = [...comments, optimisticComment];
    setComments(newComments);
    setPostData(prev => ({
      ...prev,
      commentsCount: (prev.commentsCount || 0) + 1
    }));
    setNewComment('');

    try {
      const response = await fetch(`${API_URL}/api/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ text: optimisticComment.text, postId: postId }),
      });

      const data = await response.json();

      if (response.ok && data.comment) {
        const actualNewComment = {
          ...data.comment,
          createdAt: data.comment.createdAt || new Date().toISOString()
        };
        setComments(prev => prev.map(c =>
          c._id === optimisticComment._id ? actualNewComment : c
        ));

        if (onPostUpdate) {
          onPostUpdate(postId, {
            commentsCount: newComments.length,
            comments: [...comments.filter(c => c._id !== optimisticComment._id), actualNewComment]
          });
        }
      } else {
        setComments(prev => prev.filter(c => c._id !== optimisticComment._id));
        setPostData(prev => ({
          ...prev,
          commentsCount: Math.max(0, (prev.commentsCount || 0) - 1)
        }));
        console.error('Error adding comment:', data.message);
      }
    } catch (error) {
      setComments(prev => prev.filter(c => c._id !== optimisticComment._id));
      setPostData(prev => ({
        ...prev,
        commentsCount: Math.max(0, (prev.commentsCount || 0) - 1)
      }));
      console.error('Network error when adding comment:', error);
    } finally {
      setJustSubmittedComment(true);
    }
  };

  const loadMoreComments = () => {
    const sortedComments = [...(comments || [])].sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
    const displayedComments = sortedComments.slice(Math.max(sortedComments.length - commentsToShow, 0));
    
    if (displayedComments.length > 0) {
      setTopCommentId(displayedComments[0]._id);
    }
    
    setCommentsToShow(prev => Math.min(prev + 10, comments.length));
  };

  const handleDeleteComment = async (commentId) => {
    try {
      const response = await fetch(`${API_URL}/api/comments/${commentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        setComments(prev => prev.filter(comment => comment._id !== commentId));
        setPostData(prev => ({
          ...prev,
          commentsCount: Math.max(0, (prev.commentsCount || 0) - 1)
        }));

        if (onPostUpdate) {
          onPostUpdate(postId, {
            commentsCount: Math.max(0, (postData.commentsCount || 0) - 1),
            comments: comments.filter(c => c._id !== commentId)
          });
        }
      }
    } catch (error) {
      console.error('Error deleting comment:', error);
    }
  };

  const requestDeletePost = () => {
    if (window.confirm('Are you sure you want to delete this post?')) {
      onDeletePost(postId);
      onClose();
    }
  };

  const requestEditPost = () => {
    setShowEditModal(true);
    setShowOptionsMenu(false);
  };

  const handleSaveEdit = async (newCaption) => {
    try {
      const response = await fetch(`${API_URL}/api/posts/${postId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ caption: newCaption })
      });

      if (response.ok) {
        const updatedPost = await response.json();
        setPostData(prev => ({ ...prev, caption: updatedPost.post.caption }));
        if (onPostUpdate) {
          onPostUpdate(postId, { caption: updatedPost.post.caption });
        }
      }
    } catch (error) {
      console.error('Error updating post:', error);
    } finally {
      setShowEditModal(false);
    }
  };

  const handleTooltipToggle = () => setShowLikesTooltip(!showLikesTooltip);
  const handleTooltipClose = () => setShowLikesTooltip(false);

  const handleSharePost = () => {
    setShowShareModal(true);
  };

  const handleCloseShareModal = () => {
    setShowShareModal(false);
  };

  const handleCaptionUsernameClick = () => {
    onClose();
  };

  const handleCommentUsernameClick = (username) => {
    onClose();
  };

  if (!isOpen) {
    return null;
  }
  
  return (
    <div
      ref={overlayRef}
      className="post-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <button className="modal-close-btn" onClick={onClose} onTouchStart={(e) => e.stopPropagation()}>
        ✕
      </button>
      <div
        ref={modalContentRef}
        className="post-modal-content"
      >
        <div className="post-modal-image">
          {/* Кнопки навигации */}
          {canGoPrevious && (
            <button className="modal-nav-btn modal-prev-btn" onClick={onPrevious} onTouchStart={(e) => e.stopPropagation()}>
              ‹
            </button>
          )}
          {canGoNext && (
            <button className="modal-nav-btn modal-next-btn" onClick={onNext} onTouchStart={(e) => e.stopPropagation()}>
              ›
            </button>
          )}
          
          {/* Проверяем YouTube видео во всех возможных полях */}
          {(() => {
            // Проверяем все возможные поля на наличие YouTube URL
            const checkYouTubeUrl = (url) => {
              if (!url) return null;
              const youtubeId = extractYouTubeId(url);
              if (youtubeId) {
                const embedUrl = `https://www.youtube.com/embed/${youtubeId}?enablejsapi=1&origin=${window.location.origin}&rel=0&showinfo=0&modestbranding=1&iv_load_policy=3&disablekb=1`;
                return embedUrl;
              }
              return null;
            };

            // Проверяем все возможные поля на YouTube URL
            let youtubeEmbedUrl = null;
            let originalYouTubeUrl = null;
            

            
            // Сначала проверяем прямые YouTube поля
            if (postData.videoUrl && (postData.videoUrl.includes('youtube') || postData.videoUrl.includes('youtu.be'))) {
              youtubeEmbedUrl = checkYouTubeUrl(postData.videoUrl);
              originalYouTubeUrl = postData.videoUrl;
            } else if (postData.youtubeUrl) {
              youtubeEmbedUrl = checkYouTubeUrl(postData.youtubeUrl);
              originalYouTubeUrl = postData.youtubeUrl;
            } else if (postData.youtubeData && postData.youtubeData.embedUrl) {
              youtubeEmbedUrl = postData.youtubeData.embedUrl;
              originalYouTubeUrl = postData.videoUrl || postData.youtubeUrl;
            } else {
              // Проверяем другие поля, НО исключаем thumbnail URL
              const urlsToCheck = [postData.video, postData.image, postData.imageUrl];
              for (const url of urlsToCheck) {
                if (url && (url.includes('youtube') || url.includes('youtu.be')) && !url.includes('img.youtube.com')) {
                  youtubeEmbedUrl = checkYouTubeUrl(url);
                  originalYouTubeUrl = url;
                  break;
                }
                // Если это thumbnail, пытаемся извлечь ID и создать правильный URL
                else if (url && url.includes('img.youtube.com/vi/')) {
                  const match = url.match(/\/vi\/([^\/]+)\//);
                  if (match && match[1]) {
                    const videoId = match[1];
                    const realYouTubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
                    youtubeEmbedUrl = checkYouTubeUrl(realYouTubeUrl);
                    originalYouTubeUrl = realYouTubeUrl;
                    break;
                  }
                }
              }
            }
            


            if (youtubeEmbedUrl) {
              const originalUrl = originalYouTubeUrl;
              const youtubeId = extractYouTubeId(originalUrl);
              const thumbnailUrl = `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`;
              

              
              // УБИРАЕМ FALLBACK НА СКРИНШОТ - ВСЕГДА ПОКАЗЫВАЕМ IFRAME
              
              // Формируем ширину на основе пропорций YouTube (16:9)
              const containerHeight = window.innerWidth <= 768 ? '60vh' : '100%';
              const aspectRatio = 16/9;
              
              return (
                <div style={{ 
                  position: 'relative', 
                  width: '100%', 
                  height: '100%', 
                  display: 'flex', 
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: '#000'
                }}>
                  <iframe
                    width="100%"
                    height="100%"
                    src={youtubeEmbedUrl}
                    title="YouTube video player"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    loading="eager"
                    style={{ 
                      borderRadius: '0', 
                      border: 'none',
                      minWidth: window.innerWidth <= 768 ? '100%' : '900px',
                      aspectRatio: '16/9',
                      display: 'block',
                      backgroundColor: '#000'
                    }}
                    onLoad={() => {
                      console.log('YouTube iframe loaded');
                    }}
                    onError={(e) => {
                      console.error('YouTube iframe error:', e);
                    }}
                  />
                  {/* Кнопка для открытия в YouTube */}
                  <div 
                    style={{
                      position: 'absolute',
                      bottom: '10px',
                      right: '10px',
                      background: 'rgba(0,0,0,0.8)',
                      color: 'white',
                      padding: '6px 10px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      cursor: 'pointer',
                      zIndex: 10,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                    onClick={() => window.open(originalUrl, '_blank')}
                  >
                    <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                    </svg>
                    YouTube
                  </div>
                </div>
              );
            }

            // Проверяем TikTok и другие внешние платформы
            if (postData.videoData || postData.youtubeData || (postData.videoUrl && !postData.videoUrl.includes('youtube') && !postData.videoUrl.includes('youtu.be'))) {
              const videoData = postData.videoData || postData.youtubeData;
              const platform = videoData?.platform;
              
              if (platform === 'tiktok') {
                // Для TikTok показываем заглушку с кнопкой, так как TikTok embed часто не работает
                return (
                  <div 
                    className="modal-video-placeholder"
                    style={{ 
                      width: '100%',
                      height: 'auto',
                      maxHeight: '900px',
                      minHeight: '400px',
                      background: 'linear-gradient(135deg, #FF0050, #FF4081)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative',
                      color: 'white',
                      textAlign: 'center',
                      padding: '40px 20px'
                    }}
                  >
                    <div style={{ fontSize: '80px', marginBottom: '20px' }}>🎵</div>
                    <div style={{ fontSize: '24px', fontWeight: '600', marginBottom: '10px' }}>
                      TikTok Video
                    </div>
                    <div style={{ fontSize: '16px', opacity: '0.9', marginBottom: '30px', maxWidth: '300px' }}>
                      Click to watch on TikTok
                    </div>
                    <button
                      onClick={() => window.open(postData.videoUrl || videoData?.originalUrl, '_blank')}
                      style={{
                        background: 'rgba(255,255,255,0.9)',
                        color: '#FF0050',
                        border: 'none',
                        padding: '12px 30px',
                        borderRadius: '25px',
                        fontSize: '16px',
                        cursor: 'pointer',
                        fontWeight: '600',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                        transition: 'transform 0.2s ease'
                      }}
                      onMouseEnter={(e) => e.target.style.transform = 'scale(1.05)'}
                      onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
                    >
                      🎵 Open TikTok
                    </button>
                  </div>
                );
              }
              
              // Для других внешних платформ (Instagram, VK и т.д.)
              if (platform && postData.videoUrl) {
                return (
                  <div 
                    className="modal-video-placeholder"
                    style={{ 
                      width: '100%',
                      height: 'auto',
                      maxHeight: '900px',
                      minHeight: '300px',
                      background: `url(${getMediaThumbnail(postData)}) center/contain no-repeat`,
                      backgroundColor: '#000',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative'
                    }}
                  >
                    <div style={{
                      background: 'rgba(0,0,0,0.7)',
                      borderRadius: '50%',
                      width: '80px',
                      height: '80px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <svg width="32" height="32" fill="white" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z"/>
                      </svg>
                    </div>
                    <div style={{
                      position: 'absolute',
                      bottom: '20px',
                      left: '20px',
                      right: '20px',
                      background: 'rgba(0,0,0,0.9)',
                      color: 'white',
                      padding: '16px',
                      borderRadius: '12px',
                      fontSize: '15px',
                      textAlign: 'center'
                    }}>
                      <div style={{ marginBottom: '10px', fontWeight: '600' }}>
                        {platform === 'instagram' ? '📱 Instagram' : 
                         platform === 'vk' ? '🎬 VK Video' : 
                         '🎥 External Video'}
                      </div>
                      <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.8)', marginBottom: '12px' }}>
                        Click to open in new tab
                      </div>
                      <button
                        onClick={() => window.open(postData.videoUrl, '_blank')}
                        style={{
                          background: '#0095f6',
                          color: 'white',
                          border: 'none',
                          padding: '8px 20px',
                          borderRadius: '8px',
                          fontSize: '14px',
                          cursor: 'pointer',
                          fontWeight: '600'
                        }}
                      >
                        Open Video
                      </button>
                    </div>
                  </div>
                );
              }
            }

            // Для загруженных видео (Cloudinary) - НЕ YouTube
            if ((postData.mediaType === 'video' || 
                (postData.imageUrl && (postData.imageUrl.includes('.mp4') || postData.imageUrl.includes('video/'))) ||
                (postData.image && (postData.image.includes('.mp4') || postData.image.includes('video/')))) && 
                (!postData.videoUrl || (!postData.videoUrl.includes('youtube') && !postData.videoUrl.includes('youtu.be')))) {

              const isDesktop = window.innerWidth >= 901;

              return (
                <video 
                  src={getImageUrl(postData.imageUrl || (postData.image?.startsWith('http') ? postData.image : `${API_URL}/uploads/${postData.image}`))}
                  className="post-modal-video"
                  controls={true}
                  muted={false}
                  playsInline={true}
                  preload="metadata"
                  webkit-playsinline="true"
                  x5-playsinline="true"
                  x5-video-player-type="h5"
                  x5-video-player-fullscreen="true"
                  x5-video-orientation="portraint"
                  {...(!isDesktop && { poster: postData.mobileThumbnailUrl || postData.thumbnailUrl || postData.imageUrl || '/video-placeholder.svg' })}
                  style={{ 
                    width: isDesktop ? '100%' : '100%', 
                    height: 'auto', 
                    maxHeight: isDesktop ? 'calc(100vh - 120px)' : '900px', 
                    backgroundColor: '#000', 
                    objectFit: 'contain',
                    display: 'block'
                  }}
                  onPlay={(e) => videoManager.setCurrentVideo(e.target)}
                  onPause={(e) => {
                    if (videoManager.getCurrentVideo() === e.target) {
                      videoManager.pauseCurrentVideo();
                    }
                  }}
                  onLoadStart={() => console.log('Video loading started')}
                  onCanPlay={() => console.log('Video can play')}
                  onError={(e) => console.error('Video error:', e)}
                >
                  Your browser does not support the video tag.
                </video>
              );
            }



            // Для обычных изображений
            return (
              <img 
                src={getImageUrl(postData.imageUrl || (postData.image?.startsWith('http') ? postData.image : `${API_URL}/uploads/${postData.image}`))}
                alt="Post" 
                className="post-modal-image"
                onError={(e) => { 
                  e.target.style.display = 'none'; 
                }}
              />
            );
          })()}
        </div>

        <div className="post-modal-sidebar">
          {/* Исправленный блок post-header */}
          <div className="post-header">
            <div className="author-details-wrapper"> {/* Новый контейнер для аватара и имени */}
              <Link to={`/profile/${postAuthor?.username}`} onClick={handleCaptionUsernameClick}>
                <img
                  src={getAvatarUrl(postAuthor?.avatar)}
                  alt={postAuthor?.username}
                  className="author-avatar"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = '/default-avatar.png';
                  }}
                />
              </Link>
              <Link to={`/profile/${postAuthor?.username}`} onClick={handleCaptionUsernameClick} className="author-username">
                {postAuthor?.username}
              </Link>
            </div>

            {currentUser && postAuthor && currentUser._id === postAuthor._id && (
              <div className="post-options">
                <button
                  className="options-button"
                  onClick={() => setShowOptionsMenu(!showOptionsMenu)}
                >
                  <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M3 9.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z" />
                  </svg>
                </button>
                {showOptionsMenu && (
                  <div className="options-menu">
                    <button onClick={requestEditPost} className="option-item">
                      <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M15.502 1.94a.5.5 0 0 1 0 .706L14.459 3.69l-2-2L13.502.646a.5.5 0 0 1 .707 0l1.293 1.293zm-1.75 2.456-2-2L4.939 9.21a.5.5 0 0 0-.121.196l-.805 2.414a.25.25 0 0 0 .316.316l2.414-.805a.5.5 0 0 0 .196-.12l6.813-6.814z" />
                        <path fillRule="evenodd" d="M1 13.5A1.5 1.5 0 0 0 2.5 15h11a1.5 1.5 0 0 0 1.5-1.5v-6a.5.5 0 0 0-1 0v6a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5v-11a.5.5 0 0 1 .5-.5H9a.5.5 0 0 0 0-1H2.5A1.5 1.5 0 0 0 1 2.5v11z" />
                      </svg>
                      Edit
                    </button>
                    <button onClick={requestDeletePost} className="option-item delete">
                      <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M6.5 1h3a.5.5 0 0 1 .5.5v1H6v-1a.5.5 0 0 1 .5-.5ZM11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3A1.5 1.5 0 0 0 5 1.5v1H2.506a.58.58 0 0 0-.01 0H1.5a.5.5 0 0 0 0 1h.538l.853 10.66A2 2 0 0 0 4.885 16h6.23a2 2 0 0 0 1.994-1.84l.853-10.66h.538a.5.5 0 0 0 0-1h-.995a.59.59 0 0 0-.01 0H11Zm1.958 1-.846 10.58a1 1 0 0 1-.997.92h-6.23a1 1 0 0 1-.997-.92L3.042 3.5h9.916Zm-7.487 1a.5.5 0 0 1 .528.47l.5 8.5a.5.5 0 0 1-.998.06L5 5.03a.5.5 0 0 1 .47-.53Zm5.058 0a.5.5 0 0 1 .47.53l-.5 8.5a.5.5 0 1 1-.998-.06l.5-8.5a.5.5 0 0 1 .528-.47ZM8 4.5a.5.5 0 0 1 .5.5v8.5a.5.5 0 0 1-1 0V5a.5.5 0 0 1 .5-.5Z" />
                      </svg>
                      Delete
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Описание поста выше кнопок */}
          {caption && (
            <div className="post-caption">
              
              <div className="caption-content">
                
                <span className={`caption-text ${needsMoreButton && !isCaptionExpanded ? 'collapsed' : ''}`}>
                  {caption}
                </span>
                {needsMoreButton && (
                  <button
                    className="caption-toggle"
                    onClick={() => setIsCaptionExpanded(!isCaptionExpanded)}
                  >
                    {isCaptionExpanded ? 'Show less' : 'Show more'}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Дата поста (теперь всегда отображается) */}
          <div className="post-time">
            {postData.createdAt && formatDateTime(postData.createdAt)}
          </div>

          {/* Кнопки действий как в ленте */}
          <div className="post-actions">
            <div className="post-actions-left">
              <button
                onClick={toggleLike}
                className={`action-button ${isLikedByCurrentUser ? 'liked' : ''}`}
                disabled={isLoadingLike}
                title={isLikedByCurrentUser ? 'Unlike' : 'Like'}
              >
                <svg width="24" height="24" fill={isLikedByCurrentUser ? "#ed4956" : "none"} stroke={isLikedByCurrentUser ? "#ed4956" : "currentColor"} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </button>
              {likesCount > 0 && (
                <span
                  className="likes-count-inline clickable"
                  onClick={likesCount > 0 ? handleTooltipToggle : undefined}
                  style={{ cursor: likesCount > 0 ? 'pointer' : 'default' }}
                >
                  {likesCount} {likesCount === 1 ? 'like' : 'likes'}
                </span>
              )}
            </div>

            <div className="post-actions-right">
              <button className="action-button" onClick={handleSharePost}>
                <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="m3 3 3 9-3 9 19-9Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
          </div>

          <div className="post-info">
          </div>

          <div className="comments-and-form-wrapper">
            <div className="post-content">
              <div className="comments-section" ref={commentsContainerRef}>
                <div className="comments-header">
                  Comments: {postData.commentsCount || comments.length}
                </div>
                
                {(() => {
                  if (!comments) return null;
                  
                  const sortedComments = [...comments].filter(comment => comment).sort((a, b) => {
                    const dateA = new Date(a.createdAt || a.updatedAt || 0);
                    const dateB = new Date(b.createdAt || b.updatedAt || 0);
                    return dateA - dateB;
                  });

                  const displayedComments = sortedComments.slice(Math.max(sortedComments.length - commentsToShow, 0));
                  
                  return (
                    <>
                      {(sortedComments.length > commentsToShow) && (
                          <button onClick={loadMoreComments} className="show-more-comments">
                              View previous comments
                          </button>
                      )}
                      {displayedComments.map(comment => (
                        <div key={comment._id} id={`comment-${comment._id}`} className="comment">
                          <div className="comment-avatar-container">
                            {comment.user ? (
                              <Link to={`/profile/${comment.user.username}`} onClick={() => handleCommentUsernameClick(comment.user.username)}>
                                <img
                                  src={getAvatarUrl(comment.user.avatar)}
                                  alt={comment.user.username}
                                  className="comment-avatar"
                                  onError={(e) => {
                                    e.target.onerror = null;
                                    e.target.src = '/default-avatar.png';
                                  }}
                                />
                              </Link>
                            ) : (
                              <img
                                src="/default-avatar.png"
                                alt="Deleted User"
                                className="comment-avatar"
                              />
                            )}
                          </div>
                          <div className="comment-body">
                            {comment.user ? (
                              <Link to={`/profile/${comment.user.username}`} onClick={() => handleCommentUsernameClick(comment.user.username)} className="comment-author">
                                {comment.user.username}
                              </Link>
                            ) : (
                              <span className="comment-author deleted-user">
                                DELETED USER
                              </span>
                            )}
                            <span className="comment-text">{comment.text}</span>
                          </div>
                          {(currentUser && ((comment.user && comment.user._id === currentUser._id) || author?._id === currentUser._id)) && (
                            <button
                              className="delete-comment-btn"
                              onClick={() => handleDeleteComment(comment._id)}
                              title="Delete comment"
                            >
                              ×
                            </button>
                          )}
                        </div>
                      ))}
                      {comments && comments.length === 0 && (
                          <p style={{ textAlign: 'center', color: '#8e8e8e', padding: '20px 0' }}>No comments yet.</p>
                      )}
                      <div ref={commentsEndRef} />
                    </>
                  );
                })()}
              </div>
            </div>

            <form onSubmit={handleCommentSubmit} className="comment-form comment-form-modal-bottom">
              <input
                type="text"
                ref={commentInputRef}
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment..."
                className="comment-input"
              />
              <button type="submit" className="comment-submit" disabled={!newComment.trim()}>
                Post
              </button>
            </form>
          </div>
        </div>
      </div>
      {showLikesTooltip && postId && likesCount > 0 && (
        <LikesModal
          postId={postId}
          isOpen={showLikesTooltip}
          onClose={handleTooltipClose}
        />
      )}

      {showShareModal && postData && (
        <ShareModal
          postId={postData._id}
          post={postData}
          isOpen={showShareModal}
          onClose={handleCloseShareModal}
        />
      )}

      {showEditModal && postData && (
        <EditPostModal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          post={postData}
          onSave={handleSaveEdit}
          maxCaptionLength={MAX_CAPTION_LENGTH_EDIT} // Передаем максимальную длину
        />
      )}
    </div>
  );
};

export default PostModal;