import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import LikesModal from './LikesModal';
import ShareModal from './ShareModal';
import EditPostModal from './EditPostModal';

import { getImageUrl, getAvatarUrl } from '../../utils/imageUtils';
import { getMediaThumbnail, getStaticThumbnail } from '../../utils/videoUtils';
import videoManager from '../../utils/videoManager';
import VideoPreview from './VideoPreview';
import { API_URL } from '../../config';
import './Post.css';

const Post = ({ post, currentUser, onPostUpdate, onImageClick }) => {
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
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: commentText, postId: post._id })
        });
        const data = await response.json();
        if (response.ok && data.comment) {
            const newComment = { ...data.comment, isNew: true };
            // Просто добавляем новый комментарий в конец списка
            setComments(prev => [...prev, newComment]);

            if (onPostUpdate) {
                // Обновляем счетчик и массив комментариев в родительском компоненте
                onPostUpdate(post._id, { 
                    commentsCount: (post.commentsCount || comments.length) + 1,
                    comments: [...comments, newComment] 
                });
            }
            setCommentText('');
        } else {
            throw new Error(data.message || 'Error posting comment');
        }
    } catch (err) {
        console.error('Error adding comment:', err);
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
  const getImageSrc = () => getImageUrl(post.imageUrl || post.image);
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
              <iframe
                width="100%"
                height="500"
                src={post.youtubeData.embedUrl}
                title="YouTube video player"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                style={{ borderRadius: '0', cursor: 'pointer' }}
                onClick={() => onImageClick(post)}
              />
            );
          } else if (post.videoUrl && (post.videoUrl.includes('youtube') || post.videoUrl.includes('youtu.be'))) {
            // Улучшенная обработка YouTube URL
            const createYouTubeEmbedUrl = (url) => {
              const youtubeRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
              const match = url.match(youtubeRegex);
              if (match && match[1]) {
                const embedUrl = `https://www.youtube.com/embed/${match[1]}?enablejsapi=1&origin=${window.location.origin}&rel=0&showinfo=0&modestbranding=1`;
                return embedUrl;
              }
              // Fallback для старой логики
              if (url.includes('youtu.be/')) {
                const videoId = url.split('youtu.be/')[1]?.split('?')[0];
                return `https://www.youtube.com/embed/${videoId}?enablejsapi=1&origin=${window.location.origin}&rel=0&showinfo=0&modestbranding=1`;
              }
              const videoId = url.split('v=')[1]?.split('&')[0];
              return `https://www.youtube.com/embed/${videoId}?enablejsapi=1&origin=${window.location.origin}&rel=0&showinfo=0&modestbranding=1`;
            };
            
            const extractYouTubeId = (url) => {
              const youtubeRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
              const match = url.match(youtubeRegex);
              return match ? match[1] : null;
            };
            
            const youtubeId = extractYouTubeId(post.videoUrl);
            const thumbnailUrl = `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`;
            
            return (
              <div style={{ position: 'relative', width: '100%', height: '500px', cursor: 'pointer' }} onClick={() => onImageClick(post)}>
                <iframe
                  width="100%"
                  height="500"
                  src={createYouTubeEmbedUrl(post.videoUrl)}
                  title="YouTube video player"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  style={{ borderRadius: '0', pointerEvents: 'none' }}
                  onError={(e) => {
                    console.error('YouTube iframe failed to load in feed');
                    // Показываем fallback с превью
                    e.target.style.display = 'none';
                    const fallback = e.target.nextElementSibling;
                    if (fallback) fallback.style.display = 'flex';
                  }}
                />
                <div 
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    background: `url(${thumbnailUrl}) center/cover no-repeat`,
                    backgroundColor: '#000',
                    display: 'none',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer'
                  }}
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
              </div>
            );
          } else if (post.mediaType === 'video' || 
                     (post.imageUrl && (post.imageUrl.includes('.mp4') || post.imageUrl.includes('video/'))) ||
                     (post.image && (post.image.includes('.mp4') || post.image.includes('video/')))) {
             
             // На мобильных используем VideoPreview для превью
             if (window.innerWidth <= 768) {
               return (
                 <VideoPreview 
                   post={post}
                   onClick={post.videoUrl || post.youtubeData ? () => onImageClick(post) : undefined}
                   onDoubleClick={handleLike}
                 />
               );
             }
             
             // На десктопе обычное видео
             return (
               <video 
                 src={getImageSrc()}
                 className="post-video"
                 controls={true}
                 muted={false}
                 playsInline
                 preload="metadata"
                 style={{ 
                   width: '100%', 
                   height: 'auto', 
                   maxHeight: '900px', 
                   cursor: 'default',
                   objectFit: 'contain'
                 }}
                 onDoubleClick={handleLike}
                 onPlay={(e) => videoManager.setCurrentVideo(e.target)}
                 onPause={(e) => {
                   if (videoManager.getCurrentVideo() === e.target) {
                     videoManager.pauseCurrentVideo();
                   }
                 }}
               >
                 Your browser does not support the video tag.
               </video>
             );
           } else {
             return (
               <img 
                 src={getImageSrc()}
                 alt="Post" 
                 className="post-image"
                 style={{ cursor: 'pointer' }}
                 onDoubleClick={handleLike}
                 onClick={() => onImageClick(post)}
                 onError={(e) => { e.target.style.display = 'none'; }}
               />
             );
           }
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