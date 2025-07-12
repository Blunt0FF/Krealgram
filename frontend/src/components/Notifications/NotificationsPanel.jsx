import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './NotificationsPanel.css';
import { getAvatarUrl } from '../../utils/imageUtils';
import { getMediaThumbnail } from '../../utils/videoUtils';
import { API_URL } from '../../config';
import axios from 'axios';

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
      const response = await axios.post('/api/notifications/mark-read', {
        notificationId
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
        {post && (type === 'like' || type === 'comment') && (
          <Link to={linkTo} onClick={(e) => { e.stopPropagation(); if (!notification.read) markAsRead(notification._id); onClose(); navigate(linkTo); }}>
            {(() => {
              // Расширенный отладочный вывод
              const previewUrls = [
                post.thumbnailUrl,
                post.imageUrl,
                post.image,
                post.youtubeData?.thumbnailUrl
              ].filter(Boolean);

              const isValidUrl = (url) => {
                try {
                  new URL(url);
                  return true;
                } catch {
                  return false;
                }
              };

              const getValidPreviewUrl = async (urls) => {
                for (const url of urls) {
                  try {
                    if (isValidUrl(url)) {
                      const response = await fetch(url, { method: 'HEAD' });
                      if (response.ok) {
                        return url;
                      }
                    }
                  } catch (error) {
                    console.warn(`Preview URL check failed for: ${url}`, error);
                  }
                }
                return '/default-post-placeholder.png';
              };

              // Используем async/await для проверки URL
              const fetchPreviewUrl = async () => {
                const previewUrl = await getValidPreviewUrl(previewUrls);
                
                console.group('🖼️ Notification Preview Debug');
                console.log('Notification Object:', notification);
                console.log('Post Object:', post);
                console.log('Notification Type:', type);
                console.log('Preview URL Candidates:', previewUrls);
                console.log('Selected Preview URL:', previewUrl);
                console.groupEnd();

                return previewUrl;
              };

              // Используем хук для асинхронной загрузки превью
              const [previewUrl, setPreviewUrl] = useState('/default-post-placeholder.png');

              useEffect(() => {
                fetchPreviewUrl().then(setPreviewUrl);
              }, [post]);

              return (
                <img 
                  src={previewUrl} 
                  alt="Post Preview" 
                  className="notification-post-preview" 
                  style={{ width: '50px', height: '50px', objectFit: 'cover' }}
                  onError={(e) => { 
                    console.error('❌ Preview Error:', {
                      src: e.target.src,
                      fullPostObject: post,
                      previewUrls: previewUrls
                    });
                    e.target.src = '/default-post-placeholder.png'; 
                  }}
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

  const deleteNotification = async (notificationId) => {
    try {
      const response = await axios.delete('/api/notifications/delete', {
        data: { notificationId }
      });
      // ... existing code ...
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      const response = await axios.post('/api/notifications/mark-read', {
        notificationId
      });
      // ... existing code ...
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

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