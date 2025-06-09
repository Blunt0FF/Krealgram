import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './NotificationsPanel.css';
import { getAvatarUrl } from '../../utils/imageUtils';
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
  const navigate = useNavigate();

  const handleItemClickInternal = () => {
    onClose();
    if (notification.post) {
      navigate(`/post/${notification.post._id}`);
    } else if (notification.type === 'follow' && notification.sender) {
      navigate(`/profile/${notification.sender.username}`);
    }
  };

  const handleDeleteClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onDelete(notification._id);
  };

  return (
    <div className={`notification-item ${!notification.read ? 'unread' : ''}`} onClick={handleItemClickInternal}>
      <Link 
        to={`/profile/${notification.sender.username}`} 
        className="notification-avatar-link"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={notification.sender.avatar || '/default-avatar.png'}
          alt={notification.sender.username}
          className="notification-avatar"
        />
      </Link>
      <div className="notification-content-wrapper">
        <div className="notification-text">
          <Link 
            to={`/profile/${notification.sender.username}`} 
            className="notification-sender"
            onClick={(e) => e.stopPropagation()}
          >
            {notification.sender.username}
          </Link>
          {notification.type === 'like' && ' liked your post.'}
          {notification.type === 'comment' && ' commented on your post.'}
          {notification.type === 'follow' && ' started following you.'}
          <span className="notification-time">{timeAgo(new Date(notification.createdAt))}</span>
        </div>
      </div>
      {notification.post && notification.post.image && (
        <img
          src={notification.post.image}
          alt="Post"
          className="notification-post-image"
        />
      )}
      <button className="notification-delete-btn" onClick={handleDeleteClick}>×</button>
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

  // const markAllAsRead = async () => {
  //   try {
  //     const token = localStorage.getItem('token');
  //     const response = await fetch(`${API_URL}/api/notifications/mark-all-read`, {
  //       method: 'POST',
  //       headers: { Authorization: `Bearer ${token}` },
  //     });
  //     if (response.ok) {
  //       setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  //       setUnreadCount(0);
  //     }
  //   } catch (err) {
  //     console.error('Error marking notifications as read:', err);
  //   }
  // };

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
          {/* <button onClick={markAllAsRead} className="mark-all-read-btn">Mark all as read</button> */}
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