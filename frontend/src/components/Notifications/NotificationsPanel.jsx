import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './NotificationsPanel.css';
import { getAvatarUrl } from '../../utils/imageUtils';
import { getMediaThumbnail } from '../../utils/videoUtils';
import { API_URL } from '../../config';

const timeAgo = (date) => {
  const seconds = Math.floor((new Date() - new Date(date)) / 1000);
  let interval = seconds / 31536000;
  if (interval > 1) return Math.floor(interval) + 'y ago';
  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + 'mo ago';
  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + 'd ago';
  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + 'h ago';
  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + 'm ago';
  if (seconds < 10) return 'now';
  return Math.floor(seconds) + 's ago';
};

const NotificationItem = ({ notification, onClose, onDelete }) => {
  const { sender, type, post, createdAt } = notification;
  const navigate = useNavigate();

  if (!sender || !sender.username) {
    return (
      <div className="notification-item-link">
        <div className="notification-item">
          <div className="notification-content-wrapper">
            <div className="notification-text">Notification from deleted user</div>
            <div className="notification-time">{timeAgo(createdAt)}</div>
          </div>
          <button className="notification-delete-btn" onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDelete(notification._id);
          }}>×</button>
        </div>
      </div>
    );
  }

  let content = null;
  let linkTo = '#';

  const markAsRead = async (notificationId) => {
    if (notification.read) return; // Уже прочитано
    
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_URL}/api/notifications/${notificationId}/mark-read`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const handleItemClickInternal = () => {
    // Помечаем как прочитанное при переходе
    if (!notification.read) {
      markAsRead(notification._id);
    }
    onClose();
    navigate(linkTo);
  };

  const handleDelete = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onDelete(notification._id);
  };

  switch (type) {
    case 'like':
      content = (
        <>
          <Link to={`/profile/${sender.username}`} className="notification-sender" onClick={(e) => { e.stopPropagation(); if (!notification.read) markAsRead(notification._id); onClose(); navigate(`/profile/${sender.username}`); }}>
            {sender.username}
          </Link>
          {` liked your post.`}
        </>
      );
      if (post) linkTo = `/post/${post._id}`;
      break;
    case 'comment':
      content = (
        <>
          <Link to={`/profile/${sender.username}`} className="notification-sender" onClick={(e) => { e.stopPropagation(); if (!notification.read) markAsRead(notification._id); onClose(); navigate(`/profile/${sender.username}`); }}>
            {sender.username}
          </Link>
          {` commented on your post${notification.comment?.text ? ": \"" + notification.comment.text.substring(0,30) + (notification.comment.text.length > 30 ? "...\"" : '"') : '.'}`}
        </>
      );
      if (post) linkTo = `/post/${post._id}`;
      break;
    case 'follow':
      content = (
        <>
          <Link to={`/profile/${sender.username}`} className="notification-sender" onClick={(e) => { e.stopPropagation(); if (!notification.read) markAsRead(notification._id); onClose(); navigate(`/profile/${sender.username}`); }}>
            {sender.username}
          </Link>
          {` started following you.`}
        </>
      );
      linkTo = `/profile/${sender.username}`;
      break;
    default:
      content = 'New notification.';
  }

  return (
    <div 
      className={`notification-item-link ${!post || (type !=='like' && type !=='comment') ? 'no-post-image' : ''}`} 
      onClick={handleItemClickInternal}
    >
      <div className={`notification-item ${!notification.read ? 'unread' : ''}`}>
        <Link to={`/profile/${sender.username}`} className="notification-avatar-link" onClick={(e) => { e.stopPropagation(); if (!notification.read) markAsRead(notification._id); onClose(); navigate(`/profile/${sender.username}`); }}>
          <img 
            src={getAvatarUrl(sender.avatar)} 
            alt={sender.username} 
            className="notification-avatar"
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = '/default-avatar.png';
            }}
          />
        </Link>
        <div className="notification-content-wrapper">
          <div className="notification-text">
            {content}
            <span className="notification-time">{timeAgo(createdAt)}</span>
          </div>
        </div>
        {post && (post.image || post.imageUrl || post.videoUrl || post.mediaType === 'video') && (type === 'like' || type === 'comment') && (
          <Link to={linkTo} onClick={(e) => { e.stopPropagation(); if (!notification.read) markAsRead(notification._id); onClose(); navigate(linkTo); }}>
            {(() => {
              // Проверяем, является ли пост видео
              const isVideo = post.mediaType === 'video' || 
                             post.videoUrl || 
                             (post.imageUrl && (post.imageUrl.includes('.mp4') || post.imageUrl.includes('video/'))) ||
                             (post.image && (post.image.includes('.mp4') || post.image.includes('video/')));
              
              if (isVideo) {
                const thumbnailUrl = getMediaThumbnail(post, { width: 64 });
                
                return (
                  <div style={{ position: 'relative' }}>
                    <img 
                      src={thumbnailUrl}
                      alt="Video thumbnail" 
                      className="notification-post-image" 
                      onError={(e) => {
                        // Fallback для YouTube видео
                        if (post.videoUrl && (post.videoUrl.includes('youtube') || post.videoUrl.includes('youtu.be'))) {
                          const extractYouTubeId = (url) => {
                            const youtubeRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
                            const match = url.match(youtubeRegex);
                            return match ? match[1] : null;
                          };
                          const youtubeId = extractYouTubeId(post.videoUrl);
                          if (youtubeId) {
                            e.target.src = `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`;
                          }
                        }
                      }}
                    />
                    <div style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      background: 'rgba(0,0,0,0.7)',
                      borderRadius: '50%',
                      width: '24px',
                      height: '24px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <svg width="12" height="12" fill="white" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z"/>
                      </svg>
                    </div>
                  </div>
                );
              }
              
              // Обычные изображения
              return (
                <img 
                  src={post.imageUrl || (post.image?.startsWith('http') ? post.image : `${API_URL}/uploads/${post.image}`)} 
                  alt="Post thumbnail" 
                  className="notification-post-image" 
                />
              );
            })()}
          </Link>
        )}
        <button className="notification-delete-btn" onClick={handleDelete}>×</button>
      </div>
    </div>
  );
};

const NotificationsPanel = ({ isOpen, onClose, setUnreadCount }) => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const panelRef = useRef(null);

  const fetchNotifications = async (currentPage) => {
    if (!hasMore && currentPage > 1) return;
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/notifications?page=${currentPage}&limit=15`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch notifications');
      const data = await response.json();
      
      setNotifications(prev => currentPage === 1 ? data.notifications : [...prev, ...data.notifications]);
      setHasMore(data.notifications.length > 0 && data.totalPages > currentPage);
      setUnreadCount(data.unreadCount || 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteNotification = async (notificationId) => {
    // Optimistic update
    const originalNotifications = [...notifications];
    setNotifications(prev => prev.filter(n => n._id !== notificationId));

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/notifications/${notificationId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        // Revert on failure
        setNotifications(originalNotifications);
        throw new Error('Failed to delete notification');
      }
      // Success, state is already updated
    } catch (err) {
      setNotifications(originalNotifications);
      console.error(err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setPage(1); // Reset page count on open
      setHasMore(true); // Allow fetching again
      fetchNotifications(1);
    }
  }, [isOpen]);

  const handleScroll = () => {
    if (panelRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = panelRef.current;
      if (scrollHeight - scrollTop - clientHeight < 100 && hasMore && !loading) {
        setPage(prevPage => prevPage + 1);
      }
    }
  };

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [isOpen]);

  const markAllAsRead = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/notifications/mark-all-read`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        setUnreadCount(0);
      }
    } catch (err) {
      console.error('Error marking notifications as read:', err);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        onClose();
      }
    };
    
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      <div className={`notifications-panel ${isOpen ? 'open' : ''}`} ref={panelRef}>
        <div className="notifications-panel-header">
          <h3>Notifications</h3>
          <button onClick={markAllAsRead} className="mark-all-read-btn">Mark all as read</button>
        </div>
        <div className="notifications-panel-body" onScroll={handleScroll}>
          {loading && notifications.length === 0 ? (
            <p className="notifications-loading">Loading...</p>
          ) : error ? (
            <p className="notifications-error">{error}</p>
          ) : notifications.length > 0 ? (
            notifications.map((notification) => (
              <NotificationItem 
                key={notification._id} 
                notification={notification} 
                onClose={onClose} 
                onDelete={handleDeleteNotification}
              />
            ))
          ) : (
            <div className="notifications-empty">
              <span className="notifications-empty-icon">🤷‍♂️</span>
              <p className="notifications-empty-text">No notifications yet.</p>
            </div>
          )}
          {loading && notifications.length > 0 && <p className="notifications-loading">Loading more...</p>}
        </div>
      </div>
      <div className={`notifications-panel-overlay ${isOpen ? 'visible' : ''}`} onClick={onClose}></div>
    </>
  );
};

export default NotificationsPanel; 