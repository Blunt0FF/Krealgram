import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getAvatarUrl } from '../utils/imageUtils';
import './MobileNotificationsPage.css'; // Стили для этой страницы

const API_URL = 'http://localhost:3000';

// Утилита для форматирования времени (та же, что и в NotificationsPanel)
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

// Компонент элемента уведомления (тот же, что и в NotificationsPanel)
const NotificationItem = ({ notification, onItemClick, onDelete }) => {
  const { sender, type, post, createdAt } = notification;
  const navigate = useNavigate();
  
  // Проверка на null или undefined sender
  if (!sender) {
    return (
      <div className="notification-item-link-mobile">
        <div className="notification-item-mobile">
          <div className="notification-content-wrapper-mobile">
            <div className="notification-text-mobile">Notification from deleted user</div>
            <div className="notification-time-mobile">{timeAgo(createdAt)}</div>
          </div>
        </div>
      </div>
    );
  }

  let content = null;
  let linkTo = '#';

  const handleItemClickInternal = () => {
    if (onItemClick) onItemClick(linkTo); // Передаем linkTo для возможного редиректа
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
          <Link to={`/profile/${sender.username}`} className="notification-sender" onClick={(e) => { e.stopPropagation(); navigate(`/profile/${sender.username}`); }}>
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
          <Link to={`/profile/${sender.username}`} className="notification-sender" onClick={(e) => { e.stopPropagation(); navigate(`/profile/${sender.username}`); }}>
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
          <Link to={`/profile/${sender.username}`} className="notification-sender" onClick={(e) => { e.stopPropagation(); navigate(`/profile/${sender.username}`); }}>
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
      className={`notification-item-link-mobile ${!post || (type !=='like' && type !=='comment') ? 'no-post-image' : ''}`} 
      onClick={handleItemClickInternal}
    >
      <div className={`notification-item-mobile ${!notification.read ? 'unread' : ''}`}>
        <Link to={`/profile/${sender.username}`} className="notification-avatar-link-mobile" onClick={(e) => { e.stopPropagation(); navigate(`/profile/${sender.username}`); }}>
          <img 
            src={getAvatarUrl(sender.avatar)} 
            alt={sender.username} 
            className="notification-avatar-mobile"
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = '/default-avatar.png';
            }}
          />
        </Link>
        <div className="notification-content-wrapper-mobile">
          <div className="notification-text-mobile">{content}</div>
          <div className="notification-time-mobile">{timeAgo(createdAt)}</div>
        </div>
        {post && (post.image || post.imageUrl) && (type === 'like' || type === 'comment') && (
            <Link to={linkTo} onClick={(e) => { e.stopPropagation(); navigate(linkTo); }}>
              <img 
                src={post.imageUrl || (post.image?.startsWith('http') ? post.image : `${API_URL}/uploads/${post.image}`)} 
                alt="Post thumbnail" 
                className="notification-post-image-mobile" 
              />
            </Link>
        )}
        <button className="notification-delete-btn" onClick={handleDelete}>×</button>
      </div>
    </div>
  );
};

const MobileNotificationsPage = ({ setUnreadCountGlobal }) => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  // const markAllAsRead = useCallback(async (token) => {
  //   try {
  //     await fetch(`${API_URL}/api/notifications/mark-all-read`, {
  //       method: 'POST',
  //       headers: { 'Authorization': `Bearer ${token}` }
  //     });
  //     if (typeof setUnreadCountGlobal === 'function') {
  //       setUnreadCountGlobal(0);
  //     }
  //     setNotifications(prev => prev.map(n => ({ ...n, read: true }))); 
  //   } catch (e) {
  //     console.error('Error in markAllAsRead (MobilePage):', e);
  //   }
  // }, [setUnreadCountGlobal]);

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Authorization required.');
        setLoading(false);
        navigate('/login'); // Перенаправляем на логин, если нет токена
        return;
      }

      const res = await fetch(`${API_URL}/api/notifications?page=1&limit=20`, { // Загружаем больше для страницы
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) {
        let errorMessage = `Server error (${res.status})`;
        try {
          const errorJson = await res.json();
          errorMessage = errorJson.message || errorMessage;
        } catch (jsonError) { /* уже обработано или не JSON */ }
        throw new Error(errorMessage);
      }
      
      const data = await res.json();
      setNotifications(data.notifications || []);
      
      // if (data.unreadCount > 0 || (data.notifications && data.notifications.some(n => !n.read))) {
      //   markAllAsRead(token);
      // }

    } catch (err) {
      setError(err.message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, 
  [ navigate]);
  // markAllAsRead

  const handleNotificationClick = (path) => {
    navigate(path);
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
        setNotifications(originalNotifications);
        throw new Error('Failed to delete notification');
      }
    } catch (err) {
      setNotifications(originalNotifications);
      console.error(err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    document.body.classList.add('mobile-notifications-page-active'); // Класс для body
    return () => {
      document.body.classList.remove('mobile-notifications-page-active'); // Убираем класс
    };
  }, [fetchNotifications]);

  return (
    <div className="mobile-notifications-page">
      <div className="mobile-notifications-header">
        <button onClick={() => navigate(-1)} className="back-button">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>
        <h3>Notifications</h3>
      </div>
      <div className="mobile-notifications-body">
        {loading && <div className="notifications-loading-mobile">Loading...</div>}
        {error && <div className="notifications-error-mobile">{error}</div>}
        {!loading && !error && notifications.length === 0 && (
          <div className="notifications-placeholder-mobile">
             <div className="placeholder-icon-mobile">
              <svg width="60" height="60" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5v6z"></path>
              </svg>
            </div>
            You have no notifications yet.
          </div>
        )}
        {!loading && !error && notifications.length > 0 && (
           <div className="notification-group-mobile">
             {notifications.map(notification => (
                <NotificationItem key={notification._id} notification={notification} onItemClick={handleNotificationClick} onDelete={handleDeleteNotification}/>
            ))}
           </div>
        )}
      </div>
    </div>
  );
};

export default MobileNotificationsPage; 