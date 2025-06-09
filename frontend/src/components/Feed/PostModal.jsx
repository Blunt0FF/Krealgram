import React, { useState, useEffect, useRef, useMemo, useLayoutEffect } from 'react';
import { Link } from 'react-router-dom';
import ShareModal from '../Post/ShareModal';
import EditPostModal from '../Post/EditPostModal';
import LikesModal from '../Post/LikesModal';
import { getAvatarUrl } from '../../utils/imageUtils';
import './PostModal.css';

const API_URL = 'http://localhost:3000';
const MAX_CAPTION_LENGTH_DISPLAY = 100; // Максимальная длина описания для показа до кнопки "more"
const MAX_CAPTION_LENGTH_EDIT = 500; // Максимальная длина описания при редактировании

// Функция для проверки и извлечения YouTube ID
const extractYouTubeId = (url) => {
  const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[7].length === 11) ? match[7] : null;
};

// Функция для создания данных YouTube
const createYouTubeData = (url) => {
  const videoId = extractYouTubeId(url);
  if (!videoId) return null;
  
  return {
    type: 'video',
    youtubeId: videoId,
    embedUrl: `https://www.youtube.com/embed/${videoId}`,
    thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
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
  currentIndex
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
  
  const commentsContainerRef = useRef(null);
  const commentsEndRef = useRef(null);
  const [topCommentId, setTopCommentId] = useState(null);
  const [justSubmittedComment, setJustSubmittedComment] = useState(false);

  const commentInputRef = useRef(null);

  const token = localStorage.getItem('token');

  useEffect(() => {
    setPostData(initialPost);
    setComments(initialPost?.comments || []);
    setCommentsToShow(4);
    setIsCaptionExpanded(false);

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
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.body.classList.add('modal-open');
    } else {
      document.body.style.overflow = 'auto';
      document.body.classList.remove('modal-open');
    }
    return () => {
      document.body.style.overflow = 'auto';
      document.body.classList.remove('modal-open');
    };
  }, [isOpen]);

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

  if (!isOpen || !postData) return null;

  const { _id: postId, author, caption } = postData;

  // Логика для "more/less" кнопки
  const needsMoreButton = useMemo(() => {
    // Проверяем длину текста, чтобы определить, нужна ли кнопка "more"
    return caption && caption.length > MAX_CAPTION_LENGTH_DISPLAY;
  }, [caption]);

  const displayedCaption = useMemo(() => {
    if (!caption) return '';
    if (needsMoreButton && !isCaptionExpanded) {
      return caption.substring(0, MAX_CAPTION_LENGTH_DISPLAY) + '...';
    }
    return caption;
  }, [caption, needsMoreButton, isCaptionExpanded]);

  const formatDateTime = (dateString) => {
    const date = new Date(dateString);
    const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const day = date.getDate();
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${day} ${month} ${year} г ${hours}:${minutes}`;
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

  return (
    <div className="post-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="post-modal-content">
        <button className="modal-close-btn" onClick={onClose}>
          ✕
        </button>

        <div className="post-modal-image">
          {postData.youtubeData ? (
            <iframe
              width="100%"
              height="100%"
              src={postData.youtubeData.embedUrl}
              title="YouTube video player"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              style={{ minHeight: '500px' }}
            />
          ) : postData.imageUrl ? (
            <img src={postData.imageUrl} alt={postData.caption || 'Post'} />
          ) : postData.image ? (
            <img src={postData.image.startsWith('http') ? postData.image : `${API_URL}/uploads/${postData.image}`} alt={postData.caption || 'Post'} />
          ) : (
            <div className="image-placeholder">Image not available</div>
          )}

          {/* Навигационные кнопки */}
          {onPrevious && !postData.youtubeData && (
            <button className="modal-nav-btn modal-prev-btn" onClick={onPrevious}>
              ‹
            </button>
          )}
          {onNext && !postData.youtubeData && (
            <button className="modal-nav-btn modal-next-btn" onClick={onNext}>
              ›
            </button>
          )}
        </div>

        <div className="post-modal-sidebar">
          {/* Исправленный блок post-header */}
          <div className="post-header">
            <div className="author-details-wrapper"> {/* Новый контейнер для аватара и имени */}
              <Link to={`/profile/${author?.username}`} onClick={handleCaptionUsernameClick}>
                <img
                  src={getAvatarUrl(author?.avatar)}
                  alt={author?.username}
                  className="author-avatar"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = '/default-avatar.png';
                  }}
                />
              </Link>
              <Link to={`/profile/${author?.username}`} onClick={handleCaptionUsernameClick} className="author-username">
                {author?.username}
              </Link>
            </div>

            {currentUser && author && currentUser._id === author._id && (
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
                  {displayedCaption}
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
                <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.5 12h15M13.5 18l6-6-6-6"></path></svg>
              </button>
            </div>
          </div>

          <div className="post-info">
          </div>

          <div className="post-content">
            <div className="comments-section" ref={commentsContainerRef}>
              <div className="comments-header">
                Comments: {postData.commentsCount || comments.length}
              </div>
              
              {(() => {
                const sortedComments = [...(comments || [])].sort((a, b) =>
                  new Date(a.createdAt || a.updatedAt || 0) - new Date(b.createdAt || b.updatedAt || 0)
                );

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
                        <div className="comment-body">
                          <Link to={`/profile/${comment.user.username}`} onClick={() => handleCommentUsernameClick(comment.user.username)} className="comment-author">
                            {comment.user.username}
                          </Link>
                          <span className="comment-text">{comment.text}</span>
                        </div>
                        {(currentUser && (comment.user?._id === currentUser._id || author?._id === currentUser._id)) && (
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
            <button type="submit" className="comment-submit" disabled={!newComment.trim()}>Post</button>
          </form>
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