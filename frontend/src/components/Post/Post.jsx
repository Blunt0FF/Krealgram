import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import LikesModal from './LikesModal';
import ShareModal from './ShareModal';
import EditPostModal from './EditPostModal';
import axios from 'axios';
// import { showToast } from '../../utils/toastUtils';

import { getImageUrl, getAvatarUrl, getVideoUrl } from '../../utils/imageUtils';
import { getMediaThumbnail, getStaticThumbnail, extractYouTubeId } from '../../utils/videoUtils';
import videoManager from '../../utils/videoManager';
import VideoPreview from './VideoPreview';
import { API_URL } from '../../config';
import './Post.css';

const Post = ({ post, currentUser, onPostUpdate, onImageClick }) => {
  // --- DEBUG LOG ---
  // Удаляем отладочный лог
  // console.log('[POST_DEBUG] Rendering Post component with data:', {
  //   postId: post?._id,
  //   mediaType: post?.mediaType,
  //   image: post?.image,
  //   videoUrl: post?.videoUrl,
  //   thumbnailUrl: post?.thumbnailUrl,
  //   author: post?.author?.username
  // });
  // --- END DEBUG LOG ---

  const [isLiked, setIsLiked] = useState(() => {
    if (!currentUser) return false;
    return post.likes?.includes(currentUser._id) || post.isLikedByCurrentUser || false;
  });
  const [likesCount, setLikesCount] = useState(post.likes?.length || post.likesCount || 0);
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState(post.comments || []);
  const [isShowingAllComments, setIsShowingAllComments] = useState(false);
  const [isLoadingComments, setIsLoadingComments] = useState(false);

  const postAuthor = post.author || post.user || {};
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const optionsMenuRef = useRef(null);
  const commentsRef = useRef(null);

  const [isLikesModalVisible, setIsLikesModalVisible] = useState(false);
  const [isShareModalVisible, setIsShareModalVisible] = useState(false);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [isCaptionExpanded, setIsCaptionExpanded] = useState(false);
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const [isLoadingLike, setIsLoadingLike] = useState(false);

  useEffect(() => {
    // Scroll lock for modals
    if (isEditModalVisible || isLikesModalVisible || isShareModalVisible) {
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      document.body.style.overflow = 'hidden';
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    } else {
      document.body.style.overflow = '';
      document.body.style.paddingRight = '0';
    }

    return () => {
      document.body.style.overflow = '';
      document.body.style.paddingRight = '0';
    };
  }, [isEditModalVisible, isLikesModalVisible, isShareModalVisible]);

  useEffect(() => {
    if (post) {
      const userLiked = post.likes?.includes(currentUser?._id) || post.isLikedByCurrentUser || false;
      setIsLiked(userLiked);
      setLikesCount(post.likes?.length || post.likesCount || 0);
      setComments(post.comments || []);
      // Сбрасываем показ всех комментариев при смене поста
      setIsShowingAllComments(false);
    }
  }, [post, currentUser]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (optionsMenuRef.current && !optionsMenuRef.current.contains(event.target)) {
        setShowOptionsMenu(false);
      }
    };
    if (showOptionsMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showOptionsMenu]);

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

  const handleLike = async () => {
    if (!token || !currentUser) return;
    setIsLoadingLike(true);
    const wasLiked = isLiked;
    const previousCount = likesCount;
    // Оптимистичное обновление
    setIsLiked(!wasLiked);
    setLikesCount(prev => wasLiked ? prev - 1 : prev + 1);
    try {
      const response = await fetch(`${API_URL}/api/likes/${post._id}/toggle`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();
      if (!response.ok || data.liked === undefined) {
        setIsLiked(wasLiked);
        setLikesCount(previousCount);
      } else {
        setIsLiked(data.liked);
        setLikesCount(data.likeCount);
        if (onPostUpdate) {
          onPostUpdate(post._id, {
            likes: data.likes || [],
            likesCount: data.likeCount,
            isLikedByCurrentUser: data.liked,
            isLiked: data.liked
          });
        }
      }
    } catch (err) {
      setIsLiked(wasLiked);
      setLikesCount(previousCount);
    } finally {
      setIsLoadingLike(false);
    }
  };

  const handleComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim() || !token) return;

    try {
      const response = await fetch(`${API_URL}/api/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ text: commentText, postId: post._id }),
      });
      const data = await response.json();
      if (response.ok && data.comment) {
        const newComment = { ...data.comment, isNew: true };
        setComments(prev => [...prev, newComment]);

        if (onPostUpdate) {
          onPostUpdate(post._id, { 
            commentsCount: (post.commentsCount || comments.length) + 1,
            comments: [...comments, newComment] 
          });
        }
        setCommentText('');
      } else {
        throw new Error(data.message || 'Error posting comment');
      }
    } catch (error) {
      console.error('Error adding comment:', error);
      // showToast('Ошибка при добавлении комментария', 'error');
    }
  };
  
  const handleViewAllComments = async () => {
      if (isShowingAllComments) return;
      setIsLoadingComments(true);
      try {
          const response = await fetch(`${API_URL}/api/comments/${post._id}`);
          if (!response.ok) throw new Error('Failed to fetch comments');
          const data = await response.json();
          setComments(data.comments || []);
          setIsShowingAllComments(true);
      } catch (error) {
          console.error("Error fetching all comments:", error);
      } finally {
          setIsLoadingComments(false);
      }
  };

  const toggleOptionsMenu = () => setShowOptionsMenu(prev => !prev);
  const handleEditPost = () => { setShowOptionsMenu(false); setIsEditModalVisible(true); };
  const handleSaveEdit = async (newCaption) => {
    if (newCaption === post.caption) return;
    
    const response = await fetch(`${API_URL}/api/posts/${post._id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ caption: newCaption })
    });
    
    const data = await response.json();
    if (data.post && onPostUpdate) {
      onPostUpdate(post._id, { caption: newCaption });
    }
  };
  const handleDeletePost = async () => {
    setShowOptionsMenu(false);
    try {
      const response = await fetch(`${API_URL}/api/posts/${post._id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (response.ok) {
        window.location.reload();
      } else {
        const errorData = await response.json();
        console.error(`Ошибка удаления поста: ${errorData.message || 'Неизвестная ошибка'}`);
      }
    } catch (err) {
      console.error('Ошибка удаления поста:', err);
    }
    setShowOptionsMenu(false);
  };
  const handleSharePost = () => setIsShareModalVisible(true);
  const getImageSrc = () => getImageUrl(post.image);
  const openLikesModal = () => { if (likesCount > 0) setIsLikesModalVisible(true); };
  const handleDeleteComment = async (commentId) => {
      try {
          const response = await fetch(`${API_URL}/api/comments/${commentId}`, {
              method: 'DELETE',
              headers: { 'Authorization': `Bearer ${token}` },
          });
          if (response.ok) {
              const updatedComments = comments.filter(comment => comment._id !== commentId);
              setComments(updatedComments);
              if (onPostUpdate) {
                  onPostUpdate(post._id, {
                      commentsCount: Math.max(0, (post.commentsCount || 0) - 1),
                      comments: updatedComments
                  });
              }
          } else {
              const errorData = await response.json();
              console.error('Error deleting comment:', errorData);
          }
      } catch (error) {
          console.error('Error deleting comment:', error);
      }
  };

  const displayedComments = isShowingAllComments 
    ? [...comments].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    : [...comments].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)).slice(-3);

  const handleDelete = async () => {
    try {
      const response = await axios.delete('/api/posts/delete', {
        data: { postId: post._id }
      });
      // ... existing code ...
    } catch (error) {
      console.error('Error deleting post:', error);
      // showToast('Ошибка при удалении поста', 'error');
    }
  };

  const handleUpdate = async (caption) => {
    try {
      const response = await axios.put('/api/posts/update', {
        postId: post._id,
        caption
      });
      // ... existing code ...
    } catch (error) {
      console.error('Error updating post:', error);
      // showToast('Ошибка при обновлении поста', 'error');
    }
  };

  const getPostThumbnail = () => {
    if (post.videoData && post.videoData.platform === 'youtube' && post.videoData.videoId) {
      return `https://img.youtube.com/vi/${post.videoData.videoId}/default.jpg`;
    }
    return post.thumbnailUrl || post.imageUrl;
  };

  return (
    <div className="post">
      <div className="post-header">
        <div className="post-user">
          <Link to={`/profile/${postAuthor.username}`} className="user-link">
            <img 
              src={getAvatarUrl(postAuthor.avatar)} 
              alt={postAuthor.username} 
              className="post-avatar"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = '/default-avatar.png';
              }}
            />
            <span className="post-username">{postAuthor.username}</span>
          </Link>
        </div>
        {currentUser && post.author && currentUser._id === post.author._id && (
          <div className="post-options-container" ref={optionsMenuRef}>
            <button className="post-more" onClick={toggleOptionsMenu}>⋯</button>
            {showOptionsMenu && (
              <div className="options-menu-dropdown">
                <button onClick={handleEditPost}>Edit</button>
                <button onClick={handleDeletePost}>Delete</button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="post-image-container">
        {(() => {
          if (post.youtubeData && post.youtubeData.embedUrl) {
            return (
              <div 
                style={{ 
                  position: 'relative', 
                  width: '100%', 
                  height: '500px', 
                  cursor: 'pointer',
                  backgroundImage: `url(${post.youtubeData.thumbnailUrl})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#000'
                }}
                onClick={() => onImageClick(post)}
              >
                <img 
                  src={post.youtubeData.thumbnailUrl}
                  alt=""
                  style={{ display: 'none' }}
                  onError={(e) => {
                    if (e.target.src.includes('maxresdefault')) {
                      const fallbackUrl = e.target.src.replace('maxresdefault', 'hqdefault');
                      e.target.parentElement.style.backgroundImage = `url(${fallbackUrl})`;
                    }
                  }}
                />
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
              </div>
            );
          } else if (post.videoUrl && (post.videoUrl.includes('youtube') || post.videoUrl.includes('youtu.be'))) {
            // Показываем превью вместо iframe
            const videoId = extractYouTubeId(post.videoUrl);
            const thumbnailUrl = videoId ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` : null;
            
            return (
              <div 
                style={{ 
                  position: 'relative', 
                  width: '100%', 
                  height: '500px', 
                  cursor: 'pointer',
                  backgroundImage: thumbnailUrl ? `url(${thumbnailUrl})` : 'none',
                  backgroundColor: thumbnailUrl ? 'transparent' : '#000',
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                onClick={() => onImageClick(post)}
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
              </div>
            );
          } else if (post.videoUrl && (post.videoUrl.includes('youtube') || post.videoUrl.includes('youtu.be')) && window.innerWidth <= 768) {
            // YouTube на мобильных - показываем превью
            const videoId = extractYouTubeId(post.videoUrl);
            const thumbnailUrl = videoId ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` : null;
            
            return (
              <div 
                style={{ 
                  position: 'relative', 
                  width: '100%', 
                  height: '300px', 
                  cursor: 'pointer',
                  backgroundImage: thumbnailUrl ? `url(${thumbnailUrl})` : 'none',
                  backgroundColor: thumbnailUrl ? 'transparent' : '#000',
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                onClick={() => onImageClick(post)}
              >
                <div style={{
                  background: 'rgba(0,0,0,0.7)',
                  borderRadius: '50%',
                  width: '60px',
                  height: '60px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <svg width="24" height="24" fill="white" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                </div>
              </div>
            );
          } else if (post.mediaType === 'video' || 
                     (post.image && (post.image.includes('.mp4') || post.image.includes('video/'))) ||
                     (post.image && (post.image.includes('.mp4') || post.image.includes('video/')))) {
             
             // Везде используем VideoPreview для видео (как в профиле)
             return (
               <VideoPreview 
                 post={post}
                 onClick={() => onImageClick(post)}
                 onDoubleClick={handleLike}
               />
             );
           } else if (post.image) {
            return (
              <img
                src={getImageUrl(post.image)}
                alt={post.caption || 'Post image'}
                className="post-image"
                onClick={() => onImageClick(post)}
                onLoad={(e) => {
                  const { naturalWidth, naturalHeight } = e.target;
                  if (naturalWidth < 400 || naturalHeight < 300) {
                    e.target.style.objectFit = 'contain';
                  }
                }}
                onError={(e) => {
                  e.target.src = '/video-placeholder.png'; // Fallback
                }}
              />
            );
          }
          return null;
        })()}
      </div>
      
      <div className="post-info">
        <div className="post-caption">
          <span
            className={`caption-text ${
              !isCaptionExpanded && post.caption.length > 100 ? 'collapsed' : ''
            }`}
          >
            {post.caption}
          </span>
          {post.caption && post.caption.length > 100 && (
            <button
              className="caption-toggle"
              onClick={() => setIsCaptionExpanded(!isCaptionExpanded)}
            >
              {isCaptionExpanded ? 'less' : 'more'}
            </button>
          )}
        </div>
        
        {post.createdAt && (
          <div className="post-date-container">
            <div 
              className="post-date"
              style={{ cursor: 'pointer' }}
              onClick={() => onImageClick(post)}
            >
              {formatDateTime(post.createdAt)}
            </div>
          </div>
        )}
      </div>
      
      <div className="post-actions">
        <div className="post-actions-left">
          <button 
            className={`action-button ${isLiked ? 'liked' : ''}`}
            onClick={handleLike}
          >
            <svg width="24" height="24" fill={isLiked ? "#ed4956" : "none"} stroke={isLiked ? "#ed4956" : "currentColor"} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </button>
          {likesCount > 0 && (
            <span className="likes-count-inline clickable" onClick={openLikesModal}>
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
      
      <div className="post-divider"></div>
      
      <div className="post-comments-section">
        <div className="comments-header">Comments: {post.commentsCount || comments.length}</div>
        {!isShowingAllComments && post.commentsCount > displayedComments.length && (
          <div
            className="view-all-comments-link"
            onClick={handleViewAllComments}
          >
            {isLoadingComments
              ? 'Loading...'
              : `View previous ${post.commentsCount - displayedComments.length} comments`}
          </div>
        )}
        {isShowingAllComments && post.commentsCount > 3 && (
          <div
            className="view-all-comments-link"
            onClick={() => setIsShowingAllComments(false)}
          >
            Hide comments
          </div>
        )}
        
        <div className="post-comments" ref={commentsRef}>
          {displayedComments.length > 0 ? (
            displayedComments.map((comment) => (
              <div key={comment._id} className={`comment ${comment.isNew ? 'new-comment' : ''}`}>
                {comment.user ? (
                  <Link to={`/profile/${comment.user.username}`}>
                    <img src={getAvatarUrl(comment.user.avatar)} alt={comment.user.username} className="comment-avatar" onError={(e) => { e.target.src = '/default-avatar.png'; }} />
                  </Link>
                ) : (
                  <img src="/default-avatar.png" alt="Deleted User" className="comment-avatar" />
                )}
                <div className="comment-content">
                  {comment.user ? (
                    <Link to={`/profile/${comment.user.username}`} className="comment-username-link">
                      {comment.user.username}
                    </Link>
                  ) : (
                    <span className="comment-username-link deleted-user">
                      DELETED USER
                    </span>
                  )}
                  <span className="comment-text">{comment.text}</span>
                </div>
                {currentUser && (comment.user?._id === currentUser._id || post.author?._id === currentUser._id) && (
                  <button className="delete-comment-btn" onClick={() => handleDeleteComment(comment._id)} title="Delete comment">×</button>
                )}
              </div>
            ))
          ) : (
            <p className="no-comments">No comments yet.</p>
          )}
        </div>
      </div>
        
      <form onSubmit={handleComment} className="comment-form">
        <input
          type="text"
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          placeholder="Add a comment..."
          className="comment-input"
          maxLength="280"
        />
        <button type="submit" className="comment-submit" disabled={!commentText.trim()}>
          Post
        </button>
      </form>

      {isLikesModalVisible && post._id && (
        <LikesModal
          postId={post._id}
          isOpen={isLikesModalVisible}
          onClose={() => setIsLikesModalVisible(false)}
        />
      )}

      {isShareModalVisible && post._id && (
        <ShareModal
          postId={post._id}
          post={post}
          isOpen={isShareModalVisible}
          onClose={() => setIsShareModalVisible(false)}
        />
      )}
      
      {isEditModalVisible && (
        <EditPostModal
          isOpen={isEditModalVisible}
          onClose={() => setIsEditModalVisible(false)}
          post={post}
          onSave={handleSaveEdit}
        />
      )}
    </div>
  );
};

export default Post;