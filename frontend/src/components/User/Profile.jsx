import React, { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import LikesModal from '../Post/LikesModal';
import ShareModal from '../Post/ShareModal';
import EditPostModal from '../Post/EditPostModal';
import { getImageUrl, getAvatarUrl } from '../../utils/imageUtils';
import { API_URL } from '../../config';
import './Profile.css';
import '../Feed/PostModal.css';

// ВОССТАНАВЛИВАЕМ ЛОКАЛЬНЫЙ КОМПОНЕНТ PostModal
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
  const [isLikedByCurrentUser, setIsLikedByCurrentUser] = useState(false);
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
    
    let isLiked = false;
    if (currentUser && initialPost) {
      if (typeof initialPost.isLikedByCurrentUser === 'boolean') {
        isLiked = initialPost.isLikedByCurrentUser;
      } else if (Array.isArray(initialPost.likes)) {
        isLiked = initialPost.likes.some(like => 
          like.user === currentUser._id || 
          like.user?._id === currentUser._id || 
          like === currentUser._id
        );
      }
    }
    setIsLikedByCurrentUser(isLiked);
  }, [initialPost, currentUser]);

  useEffect(() => {
    const handleKeyPress = (e) => {
      if (!isOpen || showEditModal) return;
      if (e.key === 'ArrowLeft' && onPrevious) {
        onPrevious();
      } else if (e.key === 'ArrowRight' && onNext) {
        onNext();
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [isOpen, onPrevious, onNext, onClose, showEditModal]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.body.classList.add('modal-open');
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
  const likesCount = postData.likesCount !== undefined ? postData.likesCount : 
                    (Array.isArray(postData.likes) ? postData.likes.length : 0);

  const toggleLike = async () => {
    if (!token || !currentUser || !postData) return;
    setIsLoadingLike(true);
    const originalLikedStatus = isLikedByCurrentUser;
    const originalLikesCount = likesCount;

    setPostData(prev => ({
      ...prev,
      likesCount: originalLikedStatus ? prev.likesCount - 1 : prev.likesCount + 1,
      likes: originalLikedStatus 
        ? (prev.likes || []).filter(id => id !== currentUser._id)
        : [...(prev.likes || []), currentUser._id]
    }));
    setIsLikedByCurrentUser(!originalLikedStatus);

    try {
      const response = await fetch(`${API_URL}/api/likes/${postId}/toggle`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Like error');
      
      setPostData(prev => ({ ...prev, likesCount: data.likeCount }));
      setIsLikedByCurrentUser(data.liked);

      if (onPostUpdate) {
        onPostUpdate(postId, { 
          likesCount: data.likeCount, 
          likes: data.likes, 
          isLiked: data.liked,
          isLikedByCurrentUser: data.liked
        });
      }
    } catch (error) {
      setPostData(prev => ({ ...prev, likesCount: originalLikesCount }));
      setIsLikedByCurrentUser(originalLikedStatus);
      console.error('Failed to process like:', error.message);
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
    setPostData(prev => ({ ...prev, commentsCount: (prev.commentsCount || 0) + 1 }));
    setNewComment('');
    
    try {
      const response = await fetch(`${API_URL}/api/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ text: optimisticComment.text, postId: postId }),
      });
      
      const data = await response.json();
      
      if (response.ok && data.comment) {
        const actualNewComment = { ...data.comment, createdAt: data.comment.createdAt || new Date().toISOString() };
        setComments(prev => prev.map(c => c._id === optimisticComment._id ? actualNewComment : c));
        
        if (onPostUpdate) {
          onPostUpdate(postId, { commentsCount: newComments.length, comments: [...comments.filter(c => c._id !== optimisticComment._id), actualNewComment] });
        }
      } else {
        setComments(prev => prev.filter(c => c._id !== optimisticComment._id));
        setPostData(prev => ({ ...prev, commentsCount: Math.max(0, (prev.commentsCount || 0) - 1) }));
        console.error('Error adding comment:', data.message);
      }
    } catch (error) {
      setComments(prev => prev.filter(c => c._id !== optimisticComment._id));
      setPostData(prev => ({ ...prev, commentsCount: Math.max(0, (prev.commentsCount || 0) - 1) }));
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
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        setComments(prev => prev.filter(comment => comment._id !== commentId));
        setPostData(prev => ({ ...prev, commentsCount: Math.max(0, (prev.commentsCount || 0) - 1) }));

        if (onPostUpdate) {
          onPostUpdate(postId, { commentsCount: Math.max(0, (postData.commentsCount || 0) - 1), comments: comments.filter(c => c._id !== commentId) });
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
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
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
  const handleSharePost = () => setShowShareModal(true);
  const handleCloseShareModal = () => setShowShareModal(false);
  const handleCaptionUsernameClick = () => onClose();
  const handleCommentUsernameClick = (username) => onClose();

  return (
    <div className="post-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="post-modal-content">
        <button className="modal-close-btn" onClick={onClose}>✕</button>
        

        
        <div className="post-modal-image">
          {onPrevious && currentIndex && currentIndex.total > 0 && currentIndex.current > 1 && !showEditModal && (
            <button className="modal-nav-btn modal-prev-btn" onClick={onPrevious}>
              ←
            </button>
          )}
          
          {onNext && currentIndex && currentIndex.total > 0 && currentIndex.current < currentIndex.total && !showEditModal && (
            <button className="modal-nav-btn modal-next-btn" onClick={onNext}>
              →
            </button>
          )}
          
          {postData.imageUrl ? <img src={postData.imageUrl} alt={postData.caption || 'Post'} /> : <div className="image-placeholder">Image not available</div>}
        </div>
        <div className="post-modal-sidebar">
          <div className="post-header">
            <Link to={`/profile/${author?.username}`} onClick={handleCaptionUsernameClick}>
              <img src={getAvatarUrl(author?.avatar)} alt={author?.username} className="author-avatar" onError={(e) => { e.target.onerror = null; e.target.src = '/default-avatar.png'; }} />
            </Link>
            <Link to={`/profile/${author?.username}`} onClick={handleCaptionUsernameClick} className="author-username">{author?.username}</Link>
            {currentUser && author && currentUser._id === author._id && (
              <div className="post-options">
                <button className="options-button" onClick={() => setShowOptionsMenu(!showOptionsMenu)}>
                  <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M3 9.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z"/></svg>
                </button>
                {showOptionsMenu && (
                  <div className="options-menu">
                    <button onClick={requestEditPost} className="option-item">
                      <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M15.502 1.94a.5.5 0 0 1 0 .706L14.459 3.69l-2-2L13.502.646a.5.5 0 0 1 .707 0l1.293 1.293zm-1.75 2.456-2-2L4.939 9.21a.5.5 0 0 0-.121.196l-.805 2.414a.25.25 0 0 0 .316.316l2.414-.805a.5.5 0 0 0 .196-.12l6.813-6.814z"/><path fillRule="evenodd" d="M1 13.5A1.5 1.5 0 0 0 2.5 15h11a1.5 1.5 0 0 0 1.5-1.5v-6a.5.5 0 0 0-1 0v6a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5v-11a.5.5 0 0 1 .5-.5H9a.5.5 0 0 0 0-1H2.5A1.5 1.5 0 0 0 1 2.5v11z"/></svg>
                      Edit
                    </button>
                    <button onClick={requestDeletePost} className="option-item delete">
                      <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M6.5 1h3a.5.5 0 0 1 .5.5v1H6v-1a.5.5 0 0 1 .5-.5ZM11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3A1.5 1.5 0 0 0 5 1.5v1H2.506a.58.58 0 0 0-.01 0H1.5a.5.5 0 0 0 0 1h.538l.853 10.66A2 2 0 0 0 4.885 16h6.23a2 2 0 0 0 1.994-1.84l.853-10.66h.538a.5.5 0 0 0 0-1h-.995a.59.59 0 0 0-.01 0H11Zm1.958 1-.846 10.58a1 1 0 0 1-.997.92h-6.23a1 1 0 0 1-.997-.92L3.042 3.5h9.916Zm-7.487 1a.5.5 0 0 1 .528.47l.5 8.5a.5.5 0 0 1-.998.06L5 5.03a.5.5 0 0 1 .47-.53Zm5.058 0a.5.5 0 0 1 .47.53l-.5 8.5a.5.5 0 1 1-.998-.06l.5-8.5a.5.5 0 0 1 .528-.47ZM8 4.5a.5.5 0 0 1 .5.5v8.5a.5.5 0 0 1-1 0V5a.5.5 0 0 1 .5-.5Z"/></svg>
                      Delete
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          
          <div className="post-time">
            {new Date(postData.createdAt).toLocaleString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              hour12: false
            })}
          </div>

          <div className="post-content">
            {caption && (
              <div className="post-caption">
                <Link to={`/profile/${author?.username}`} onClick={handleCaptionUsernameClick}>
                  <img src={getAvatarUrl(author?.avatar)} alt={author?.username} className="author-avatar" onError={(e) => { e.target.onerror = null; e.target.src = '/default-avatar.png'; }} />
                </Link>
                <div className="caption-content">
                  <Link to={`/profile/${author?.username}`} onClick={handleCaptionUsernameClick} className="author-username">{author?.username}</Link>
                  <span className={`caption-text ${!isCaptionExpanded && caption.length > 100 ? 'collapsed' : ''}`}>{caption}</span>
                  {caption.length > 100 && <button className="caption-toggle" onClick={() => setIsCaptionExpanded(!isCaptionExpanded)}>{isCaptionExpanded ? 'Show less' : 'Show more'}</button>}
                </div>
              </div>
            )}

            <div className="post-actions">
              <div className="post-actions-left">
                <button onClick={toggleLike} className={`action-button ${isLikedByCurrentUser ? 'liked' : ''}`} disabled={isLoadingLike} title={isLikedByCurrentUser ? 'Unlike' : 'Like'}>
                  <svg width="24" height="24" fill={isLikedByCurrentUser ? "#ed4956" : "none"} stroke={isLikedByCurrentUser ? "#ed4956" : "currentColor"} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                </button>
                {likesCount > 0 && <span className="likes-count-inline clickable" onClick={likesCount > 0 ? handleTooltipToggle : undefined} style={{ cursor: likesCount > 0 ? 'pointer' : 'default' }}>{likesCount} {likesCount === 1 ? 'like' : 'likes'}</span>}
              </div>
              <div className="post-actions-right">
                <button className="action-button" onClick={handleSharePost}>
                  <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.5 12h15M13.5 18l6-6-6-6" /></svg>
                </button>
              </div>
            </div>

            <div className="comments-header">
              Comments: {comments.length}
            </div>

            <div className="comments-section" ref={commentsContainerRef}>
              {(() => {
                const sortedComments = [...(comments || [])].sort((a, b) => new Date(a.createdAt || a.updatedAt || 0) - new Date(b.createdAt || b.updatedAt || 0));
                const displayedComments = sortedComments.slice(Math.max(sortedComments.length - commentsToShow, 0));
                
                return (
                  <>
                    {sortedComments.length > commentsToShow && (
                        <button onClick={loadMoreComments} className="show-more-comments">
                            View previous comments
                        </button>
                    )}
                    {displayedComments.map(comment => (
                      <div key={comment._id} id={`comment-${comment._id}`} className="comment">
                        <Link to={`/profile/${comment.user.username}`} onClick={() => handleCommentUsernameClick(comment.user.username)}>
                          <img src={getAvatarUrl(comment.user.avatar)} alt={comment.user.username} className="comment-avatar" onError={(e) => { e.target.onerror = null; e.target.src = '/default-avatar.png'; }} />
                        </Link>
                        <div className="comment-body">
                          <Link to={`/profile/${comment.user.username}`} onClick={() => handleCommentUsernameClick(comment.user.username)} className="comment-author">{comment.user.username}</Link>
                          <span className="comment-text">{comment.text}</span>
                        </div>
                        {(currentUser && (comment.user?._id === currentUser._id || author?._id === currentUser._id)) && <button className="delete-comment-btn" onClick={() => handleDeleteComment(comment._id)} title="Delete comment">×</button>}
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
            <input type="text" ref={commentInputRef} value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="Add a comment..." className="comment-input" />
            <button type="submit" className="comment-submit" disabled={!newComment.trim()}>Post</button>
          </form>
        </div>
      </div>
      {showLikesTooltip && postId && likesCount > 0 && <LikesModal postId={postId} isOpen={showLikesTooltip} onClose={handleTooltipClose} />}
      {showShareModal && postData && <ShareModal postId={postData._id} post={postData} isOpen={showShareModal} onClose={handleCloseShareModal} />}
      {showEditModal && postData && <EditPostModal isOpen={showEditModal} onClose={() => setShowEditModal(false)} post={postData} onSave={handleSaveEdit} />}
    </div>
  );
};

// Компонент мобильной навигации
const MobileBottomNav = ({ user }) => {
  return (
    <div className="mobile-bottom-nav">
      <Link to="/feed" className="nav-item">
        <svg className="nav-icon" viewBox="0 0 24 24" fill="currentColor">
          <path d="M9.005 16.545a2.997 2.997 0 0 1 2.997-2.997A2.997 2.997 0 0 1 15 16.545V22h7V12.5L12 2 2 12.5V22h7.005v-5.455z"/>
        </svg>
      </Link>
      <Link to="/search" className="nav-item">
        <svg className="nav-icon" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 10.5A8.5 8.5 0 1 1 10.5 2a8.5 8.5 0 0 1 8.5 8.5Z" stroke="currentColor" strokeWidth="2" fill="none"/>
          <path d="m21 21-4.3-4.3" stroke="currentColor" strokeWidth="2"/>
        </svg>
      </Link>
      <Link to="/create-post" className="nav-item">
        <svg className="nav-icon" viewBox="0 0 24 24" fill="currentColor">
          <path d="M2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10S2 17.523 2 12Z" stroke="currentColor" strokeWidth="2" fill="none"/>
          <path d="M12 8v8M8 12h8" stroke="currentColor" strokeWidth="2"/>
        </svg>
      </Link>
      <Link to="/messages" className="nav-item">
        <svg className="nav-icon" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12.003 2.001a9.705 9.705 0 1 1 0 19.4 10.876 10.876 0 0 1-2.895-.384.798.798 0 0 0-.533.04l-1.984.876a.801.801 0 0 1-1.123-.708l-.054-1.78a.806.806 0 0 0-.27-.569 9.49 9.49 0 0 1-3.14-7.175 9.65 9.65 0 0 1 10-9.7Z" fillRule="evenodd"/>
        </svg>
      </Link>
      <Link to="/notifications_mobile" className="nav-item">
        <svg className="nav-icon" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12.003 2.001a9.705 9.705 0 1 1 0 19.4 10.876 10.876 0 0 1-2.895-.384.798.798 0 0 0-.533.04l-1.984.876a.801.801 0 0 1-1.123-.708l-.054-1.78a.806.806 0 0 0-.27-.569 9.49 9.49 0 0 1-3.14-7.175 9.65 9.65 0 0 1 10-9.7Z" fillRule="evenodd"/>
        </svg>
      </Link>
      <Link to={`/profile/${user?.username}`} className="nav-item">
        <img 
          src={getAvatarUrl(user?.avatar)} 
          alt="Profile" 
          className="nav-avatar"
          onError={(e) => {
            e.target.onerror = null;
            e.target.src = '/default-avatar.png';
          }}
        />
      </Link>
    </div>
  );
};

// Компонент для превью поста с асинхронной загрузкой изображения
const PostThumbnail = ({ post, onClick }) => {
  const [image, setImage] = useState(post.imageUrl || null);
  const [imageLoaded, setImageLoaded] = useState(!!post.imageUrl);

  useEffect(() => {
    if (post._id && !imageLoaded && !post.imageUrl) {
      const token = localStorage.getItem('token');
      fetch(`${API_URL}/api/posts/${post._id}/image`, {
         headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      })
        .then(res => res.json())
        .then(data => {
          if (data.imageUrl) {
            setImage(data.imageUrl);
            setImageLoaded(true);
          }
        })
        .catch(err => console.error('Error loading thumbnail:', err));
    } else if (post.imageUrl && !image) {
        setImage(post.imageUrl);
        setImageLoaded(true);
    }
  }, [post._id, post.imageUrl, imageLoaded, image]);

  return (
    <div className="post-thumbnail" onClick={onClick}>
      {image ? (
        <img src={image} alt={post.caption || 'Post'} loading="lazy" />
      ) : (
        <div className="thumbnail-placeholder">
          <div className="loading-spinner"></div>
        </div>
      )}
      <div className="post-overlay">
        <div className="post-stats">
          <span className="stat-item">
            <svg width="18" height="18" fill="white" viewBox="0 0 24 24">
              <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
            {post.likesCount || 0}
          </span>
          <span className="stat-item">
            <svg width="18" height="18" fill="white" viewBox="0 0 24 24">
              <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            {post.commentsCount || 0}
          </span>
        </div>
      </div>
    </div>
  );
};

// Компонент модального окна для подписчиков/подписок
const FollowersModal = ({ isOpen, onClose, title, users, loading }) => {
  if (!isOpen) return null;

  return (
    <div className="followers-modal-overlay" onClick={onClose}>
      <div className="followers-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="followers-modal-header">
          <h3>{title}</h3>
          <button className="followers-modal-close" onClick={onClose}>
            <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="followers-modal-body">
          {loading ? (
            <div className="followers-loading">Loading...</div>
          ) : users.length === 0 ? (
            <div className="followers-empty">No {title.toLowerCase()} yet</div>
          ) : (
            users.map(user => (
              <div key={user._id} className="follower-item">
                <Link to={`/profile/${user.username}`} onClick={onClose}>
                  <img 
                    src={getAvatarUrl(user.avatar)} 
                    alt={user.username}
                    className="follower-avatar"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = '/default-avatar.png';
                    }}
                  />
                  <span className="follower-username">{user.username}</span>
                </Link>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

const Profile = ({ user: currentUserProp }) => {
  const { username } = useParams();
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [isOwner, setIsOwner] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [followersLoading, setFollowersLoading] = useState(false);
  const [followingLoading, setFollowingLoading] = useState(false);
  const [followInfo, setFollowInfo] = useState({
    isFollowing: false,
    followersCount: 0,
    followingCount: 0
  });
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [isFollowersModalOpen, setIsFollowersModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalUsers, setModalUsers] = useState([]);
  const [showAvatarModal, setShowAvatarModal] = useState(false);

  const handlePostClick = (post) => {
    const postWithLikeStatus = {
      ...post,
      isLikedByCurrentUser: post.isLikedByCurrentUser
    };
    setSelectedPost(postWithLikeStatus);
    setIsModalOpen(true);
  };

  const goToPreviousPost = () => {
    if (!selectedPost || posts.length === 0) return;
    const currentIndex = posts.findIndex(p => p._id === selectedPost._id);
    if (currentIndex > 0) {
      setSelectedPost(posts[currentIndex - 1]);
    }
  };

  const goToNextPost = () => {
    if (!selectedPost || posts.length === 0) return;
    const currentIndex = posts.findIndex(p => p._id === selectedPost._id);
    if (currentIndex < posts.length - 1) {
      setSelectedPost(posts[currentIndex + 1]);
    }
  };

  const getCurrentPostIndex = () => {
    if (!selectedPost || posts.length === 0) return { current: 1, total: posts.length };
    const currentIndex = posts.findIndex(p => p._id === selectedPost._id);
    return { current: currentIndex + 1, total: posts.length };
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedPost(null);
  };

  // Управление классом modal-open для body
  useEffect(() => {
    if (isModalOpen) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
    
    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [isModalOpen]);

  const handlePostUpdate = (postId, updates) => {
    setPosts(prevPosts => prevPosts.map(p => 
      p._id === postId ? { ...p, ...updates } : p
    ));
    // Всегда обновляем selectedPost для синхронизации состояния
    if (selectedPost && selectedPost._id === postId) {
        setSelectedPost(prevSelectedPost => ({ ...prevSelectedPost, ...updates }));
    }
  };

  const handleDeletePost = async (postIdToDelete) => {
    if (!currentUserProp || !isOwner) return;

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/api/posts/${postIdToDelete}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (response.ok) {
            setPosts(prevPosts => prevPosts.filter(p => p._id !== postIdToDelete));
            closeModal();
            if (profile && profile.user) {
                 setProfile(prev => ({
                    ...prev,
                    user: {
                        ...prev.user,
                        postsCount: prev.user.postsCount !== undefined ? Math.max(0, prev.user.postsCount - 1) : (prev.posts?.filter(p => p._id !== postIdToDelete).length || 0)
                    }
                }));
            }
            console.log('Post deleted successfully');
        } else {
            console.error('Error deleting post:', data.message);
        }
    } catch (error) {
        console.error('Error deleting post:', error);
        console.error('Network error when deleting post:', error);
    }
  };

  const openFollowersModal = async () => {
    if (!profile || !profile.user) return;
    
    setFollowersLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/users/${profile.user._id}/followers`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      
      if (response.ok) {
        const data = await response.json();
        setModalTitle('Followers');
        setModalUsers(data.followers || []);
        setIsFollowersModalOpen(true);
      }
    } catch (error) {
      console.error('Error loading followers:', error);
    } finally {
      setFollowersLoading(false);
    }
  };

  const openFollowingModal = async () => {
    if (!profile || !profile.user) return;
    
    setFollowingLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/users/${profile.user._id}/following`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      
      if (response.ok) {
        const data = await response.json();
        setModalTitle('Following');
        setModalUsers(data.following || []);
        setIsFollowersModalOpen(true);
      }
    } catch (error) {
      console.error('Error loading following:', error);
    } finally {
      setFollowingLoading(false);
    }
  };

  const toggleFollow = async () => {
    if (!currentUserProp || isOwner) return;

    const wasFollowing = followInfo.isFollowing;
    
    setFollowInfo(prev => ({
      ...prev,
      isFollowing: !wasFollowing,
      followersCount: wasFollowing ? (prev.followersCount || 0) - 1 : (prev.followersCount || 0) + 1
    }));

    try {
      const token = localStorage.getItem('token');
      const method = wasFollowing ? 'DELETE' : 'POST';
      
      const response = await fetch(`${API_URL}/api/users/${profile.user._id}/follow`, {
        method: method,
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        // Если API возвращает обновленные счетчики, используем их
        setFollowInfo({
          isFollowing: data.isFollowing,
          followersCount: data.followersCount,
          followingCount: data.followingCount || followInfo.followingCount
        });
      } else {
        // Откатываем изменения при ошибке
        setFollowInfo(prev => ({
          ...prev,
          isFollowing: wasFollowing,
          followersCount: wasFollowing ? (prev.followersCount || 0) + 1 : (prev.followersCount || 0) - 1
        }));
      }
    } catch (error) {
      console.error('Error toggling follow:', error);
      // Откатываем изменения при ошибке
      setFollowInfo(prev => ({
        ...prev,
        isFollowing: wasFollowing,
        followersCount: wasFollowing ? (prev.followersCount || 0) + 1 : (prev.followersCount || 0) - 1
      }));
    }
  };

  useEffect(() => {
    setLoadingProfile(true);
    setProfile(null);
    setPosts([]);
    setSelectedPost(null);
    setIsModalOpen(false);
    setFollowInfo({ isFollowing: false, followersCount: 0, followingCount: 0 });
    setIsOwner(false);
    
    const token = localStorage.getItem('token');
    
    fetch(`${API_URL}/api/users/profile/${username}`, {
      headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    })
    .then(res => {
      if (!res.ok) {
        if (res.status === 404) {
            console.error('User not found');
        }
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      return res.json();
    })
    .then(data => {
      if (data.user) {
        setProfile(data);
        
        const processedPosts = (data.user.posts || []).map(p => {
          // Проверяем, лайкнул ли текущий пользователь этот пост
          const isLikedByCurrentUser = currentUserProp && p.likes ? 
            p.likes.some(like => 
              like.user === currentUserProp._id || 
              like.user?._id === currentUserProp._id || 
              like === currentUserProp._id
            ) : false;
          
          // Обрабатываем лайки поста
          
          return {
            ...p,
            likesCount: p.likes?.length || 0,
            commentsCount: p.comments?.length || 0,
            imageUrl: getImageUrl(p.imageUrl || p.image),
            isLikedByCurrentUser: isLikedByCurrentUser
          };
        });
        setPosts(processedPosts);
        
        setFollowInfo({
          isFollowing: data.user.isFollowedByCurrentUser || false,
          followersCount: data.user.followersCount || 0,
          followingCount: data.user.followingCount || 0
        });
        
        // Проверяем владельца профиля - используем как currentUser, так и localStorage
        const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
        const userId = currentUserProp?._id || storedUser?._id;
        if (userId) {
          setIsOwner(userId === data.user._id);
        }
      } else {
        console.error("User data not found in response:", data);
        setProfile(null);
      }
      setLoadingProfile(false);
    })
    .catch(err => {
        console.error('Error fetching profile:', err);
        setLoadingProfile(false);
        setProfile(null);
    });
  }, [username, currentUserProp]);

  if (loadingProfile) {
    return <div className="profile-loading">Loading profile...</div>;
  }

  if (!profile || !profile.user) {
          return <div className="profile-container"><div className="no-posts"><h3>Profile not found.</h3></div></div>;
  }

  return (
    <>
      <div className="profile-container">
        <div className="profile-header">
          <div className="profile-avatar">
            <img 
              src={getAvatarUrl(profile.user.avatar)} 
              alt={profile.user.username} 
              loading="lazy" 
              onClick={() => {
                if (profile.user.avatar && profile.user.avatar !== '/default-avatar.png') {
                  setShowAvatarModal(true);
                }
              }}
              style={{ cursor: profile.user.avatar && profile.user.avatar !== '/default-avatar.png' ? 'pointer' : 'default' }}
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = '/default-avatar.png';
              }}
            />
          </div>
          
          <div className="profile-info">
            <div className="profile-header-row">
              <h1 className="profile-username">{profile.user.username}</h1>
              <div className="profile-actions">
                {isOwner ? (
                  <>
                    <Link to="/edit-profile" className="edit-profile-btn">
                      Edit profile
                    </Link>
                    <button 
                      className="logout-btn mobile-only" 
                      onClick={() => {
                        localStorage.removeItem('token');
                        localStorage.removeItem('user');
                        window.location.href = '/login';
                      }}
                    >
                      Log out
                    </button>
                  </>
                ) : currentUserProp ? (
                  <>
                    <button 
                      className={`follow-btn ${followInfo.isFollowing ? 'following' : ''}`} 
                      onClick={toggleFollow}
                    >
                      {followInfo.isFollowing ? 'Unfollow' : 'Follow'}
                    </button>
                    <Link to={`/messages?recipient=${profile.user._id}`} className="message-btn">Message</Link>
                  </>
                ) : null}
              </div>
            </div>
            
            <div className="profile-stats">
              <div className="stat-item">
                <span className="stat-number">{profile.user.postsCount !== undefined ? profile.user.postsCount : posts.length}</span>
                <span className="stat-label">posts</span>
              </div>
              <div className="stat-item clickable" onClick={openFollowersModal}>
                <span className="stat-number">{followInfo.followersCount}</span>
                <span className="stat-label">followers</span>
              </div>
              <div className="stat-item clickable" onClick={openFollowingModal}>
                <span className="stat-number">{followInfo.followingCount}</span>
                <span className="stat-label">following</span>
              </div>
            </div>
            
            {profile.user.bio && (
              <div className="profile-bio">
                <p>{profile.user.bio}</p>
              </div>
            )}
            
            {profile.user.website && (
              <div className="profile-website">
                <a href={profile.user.website} target="_blank" rel="noopener noreferrer">
                  {profile.user.website}
                </a>
              </div>
            )}
          </div>
        </div>
        
        <div className="profile-content">
          <div className={`posts-grid ${posts.length === 0 ? 'no-posts-container' : ''}`}>
            {posts.length === 0 ? (
              <div className="no-posts">
                <div className="no-posts-icon">📷</div>
                <h3>No posts yet</h3>
              </div>
            ) : (
              posts.map((post) => (
                <PostThumbnail 
                  key={post._id} 
                  post={post} 
                  onClick={() => handlePostClick(post)}
                />
              ))
            )}
          </div>
        </div>

        {selectedPost && (
          <PostModal
            isOpen={!!selectedPost}
            onClose={closeModal}
            post={selectedPost}
            currentUser={currentUserProp}
            onPostUpdate={handlePostUpdate}
            onDeletePost={handleDeletePost}
            onPrevious={goToPreviousPost}
            onNext={goToNextPost}
            currentIndex={getCurrentPostIndex()}
          />
        )}

        <FollowersModal
          isOpen={isFollowersModalOpen}
          onClose={() => setIsFollowersModalOpen(false)}
          title={modalTitle}
          users={modalUsers}
          loading={modalTitle === 'Followers' ? followersLoading : followingLoading}
        />

        {/* Avatar Modal */}
        {showAvatarModal && (
          <div className="avatar-modal-overlay" onClick={() => setShowAvatarModal(false)}>
            <div className="avatar-modal-content" onClick={(e) => e.stopPropagation()}>
              <button className="avatar-modal-close" onClick={() => setShowAvatarModal(false)}>
                ×
              </button>
              <img 
                src={getAvatarUrl(profile.user.avatar)} 
                alt={profile.user.username}
                className="avatar-modal-image"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = '/default-avatar.png';
                }}
              />
            </div>
          </div>
        )}
      </div>
      
      <MobileBottomNav user={currentUserProp} />
    </>
  );
};

export default Profile;