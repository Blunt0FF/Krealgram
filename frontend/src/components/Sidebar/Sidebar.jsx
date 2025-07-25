import React, { useState, useEffect, useRef } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { getAvatarUrl, getAvatarThumbnailUrl } from '../../utils/imageUtils';
import './Sidebar.css';
import NotificationsPanel from '../Notifications/NotificationsPanel';

const Sidebar = ({ user, onLogout, unreadCount, setUnreadCount }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [showNotificationsPanel, setShowNotificationsPanel] = useState(false);
  const [isNotificationsPanelOpen, setIsNotificationsPanelOpen] = useState(false);

  // Закрываем панель при смене роута
  useEffect(() => {
    setShowNotificationsPanel(false);
  }, [location.pathname]);

  const handleToggleNotificationsPanel = () => {
    setShowNotificationsPanel(prev => !prev);
    setIsNotificationsPanelOpen(false);
  };

  const handleCloseNotificationsPanel = () => {
    setShowNotificationsPanel(false);
  };

  // Проверяем, должна ли кнопка нотификаций быть активной
  const isNotificationsActive = () => {
    return showNotificationsPanel;
  };

  // Если панель уведомлений открыта, никакие другие пункты не должны быть активными
  const isActive = (path) => {
    if (showNotificationsPanel) return false;
    return location.pathname === path;
  };

  const handleHomeClick = (e) => {
    e.preventDefault();
    if (location.pathname === '/feed' || location.pathname === '/') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      navigate('/feed');
    }
  };

  return (
    <nav className="sidebar">
      <div className="sidebar-logo">
        <NavLink to="/" onClick={handleHomeClick}>
          <img src="/logo.png" alt="Krealgram logo" />
        </NavLink>
      </div>
      <nav className="sidebar-nav">
        <Link 
          to="/feed" 
          className={`sidebar-link${isActive('/feed') ? ' active' : ''}`} 
          onClick={(e) => {
            handleHomeClick(e);
            handleCloseNotificationsPanel();
          }}
        >
          <img src="/home.svg" alt="Home" className="sidebar-icon" />
          <span>Home</span>
        </Link>
        <Link to="/search" className={`sidebar-link${isActive('/search') ? ' active' : ''}`} onClick={handleCloseNotificationsPanel}>
          <img src="/search.svg" alt="Search" className="sidebar-icon" />
          <span>Search</span>
        </Link>
        <Link to="/messages" className={`sidebar-link${isActive('/messages') ? ' active' : ''}`} onClick={handleCloseNotificationsPanel}> 
          <img src="/messenger.svg" alt="Messages" className="sidebar-icon" />
          <span>Messages</span>
        </Link>
        <button 
          className={`sidebar-link${isNotificationsActive() ? ' active' : ''}`} 
          onClick={handleToggleNotificationsPanel}
        >
          <img src="/notifications.svg" alt="Notifications" className="sidebar-icon" />
          <span>Notifications</span>
          {unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}
        </button>
        <Link to="/create-post" className={`sidebar-link${isActive('/create-post') ? ' active' : ''}`} onClick={handleCloseNotificationsPanel}>
          <img src="/create-post.svg" alt="Create Post" className="sidebar-icon" />
          <span>Create</span>
        </Link>
        <Link to={`/profile/${user?.username}`} className={`sidebar-link${isActive(`/profile/${user?.username}`) ? ' active' : ''}`} onClick={handleCloseNotificationsPanel}>
          <img 
            src={getAvatarThumbnailUrl(user?.avatar)} 
            alt="Profile" 
            className="sidebar-avatar"
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = '/default-avatar.png';
            }}
          />
          <span>Profile</span>
        </Link>
      </nav>
      <button onClick={onLogout} className="sidebar-logout">
        <svg className="sidebar-icon" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17 7L15.59 8.41 18.17 11H8V13H18.17L15.59 15.59L17 17L22 12L17 7ZM4 5H12V3H4C2.9 3 2 3.9 2 5V19C2 20.1 2.9 21 4 21H12V19H4V5Z"/>
        </svg>
        <span>Logout</span>
      </button>

      <NotificationsPanel 
        isOpen={showNotificationsPanel} 
        onClose={handleCloseNotificationsPanel}
        setUnreadCount={setUnreadCount} 
      />
    </nav>
  );
};

export default Sidebar; 