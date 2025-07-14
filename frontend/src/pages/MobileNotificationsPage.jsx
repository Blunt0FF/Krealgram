import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getAvatarUrl } from '../utils/imageUtils';
import { API_URL } from '../config';
import './MobileNotificationsPage.css'; // Стили для этой страницы
import { getImageUrl } from '../utils/imageUtils';

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

// Обновленная логика получения превью
const getPostPreviewUrl = (post) => {
  // Для видео постов используем статичное превью
  if (post.mediaType === 'video' || post.videoUrl) {
    // Используем thumbnailUrl если есть
    if (post.thumbnailUrl) return post.thumbnailUrl;
    if (post.mobileThumbnailUrl) return post.mobileThumbnailUrl;

    // Создаем статичное превью для Cloudinary видео
    const videoUrl = post.imageUrl || post.image;
    return videoUrl.replace(
      '/video/upload/',
      `/video/upload/w_50,h_50,c_fill,f_jpg,so_0,q_auto/`
    );
  }

  // Для обычных изображений
  const urls = [
    post.thumbnailUrl,
    post.imageUrl,
    post.image,
    post.youtubeData?.thumbnailUrl,
    post.preview,
    post.gifPreview,
    '/default-post-placeholder.png'
  ].filter(Boolean);

  return getImageUrl(urls[0], { isThumbnail: true });
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
          <Link to={`/profile/${sender.username}`} className="notification-sender" onClick={(e) => { e.stopPropagation(); if (!notification.read) markAsRead(notification._id); navigate(`/profile/${sender.username}`); }}>
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
          <Link to={`/profile/${sender.username}`} className="notification-sender" onClick={(e) => { e.stopPropagation(); if (!notification.read) markAsRead(notification._id); navigate(`/profile/${sender.username}`); }}>
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
          <Link to={`/profile/${sender.username}`} className="notification-sender" onClick={(e) => { e.stopPropagation(); if (!notification.read) markAsRead(notification._id); navigate(`/profile/${sender.username}`); }}>
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
        <Link to={`/profile/${sender.username}`} className="notification-avatar-link-mobile" onClick={(e) => { e.stopPropagation(); if (!notification.read) markAsRead(notification._id); navigate(`/profile/${sender.username}`); }}>
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
  <Link to={linkTo} onClick={(e) => { e.stopPropagation(); if (!notification.read) markAsRead(notification._id); navigate(linkTo); }}>
    <img 
      src={getPostPreviewUrl(post)} 
      alt="Post thumbnail" 
      className="notification-post-image-mobile"
      onError={(e) => {
        e.target.onerror = null;
        e.target.src = '/video-placeholder.svg';
      }}
    />
  </Link>
)}
        <button className="notification-delete-btn" onClick={handleDelete}>×</button>
      </div>
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
       <Link to="/notifications_mobile" className="nav-item">
        <svg className="nav-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"></path>
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

const MobileNotificationsPage = ({ setUnreadCountGlobal }) => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  const markAllAsRead = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    const unreadNotifications = notifications.filter(n => !n.read);
    if (unreadNotifications.length === 0) return;

    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    if (typeof setUnreadCountGlobal === 'function') {
      setUnreadCountGlobal(0);
    }

    try {
      await fetch(`${API_URL}/api/notifications/mark-all-read`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
    } catch (e) {
      console.error('Error in markAllAsRead (MobilePage):', e);
      setNotifications(prev => prev.map(n => unreadNotifications.find(un => un._id === n._id) ? { ...n, read: false } : n));
    }
  }, [notifications, setUnreadCountGlobal]);

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
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }

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
        <button 
            onClick={markAllAsRead} 
            className="mark-all-read-btn-mobile"
            disabled={notifications.every(n => n.read)}
        >
            Mark all as read
        </button>
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
      <MobileBottomNav user={user} />
    </div>
  );
};

export default MobileNotificationsPage; 