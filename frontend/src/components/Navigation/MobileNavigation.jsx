import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { getAvatarUrl } from '../../utils/imageUtils';
import './MobileNavigation.css';

const MobileNavigation = ({ user, onLogout, unreadCount }) => {
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path) => {
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
    <div className="mobile-navigation">
      <div className="mobile-nav-container">
        <Link 
          to="/feed" 
          className={`mobile-nav-item ${isActive('/feed') ? 'active' : ''}`}
          onClick={handleHomeClick}
        >
          <svg className="mobile-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9,22 9,12 15,12 15,22"/>
          </svg>
          <span>Home</span>
        </Link>

        <Link 
          to="/search" 
          className={`mobile-nav-item ${isActive('/search') ? 'active' : ''}`}
        >
          <img src="/search.svg" alt="Search" className="mobile-nav-icon" />
          <span>Search</span>
        </Link>

        <Link 
          to="/create-post" 
          className={`mobile-nav-item ${isActive('/create-post') ? 'active' : ''}`}
        >
          <img src="/create-post.svg" alt="Create Post" className="mobile-nav-icon" />
          <span>Create</span>
        </Link>

        <Link
          to="/messages"
          className={`mobile-nav-item ${isActive('/messages') ? 'active' : ''}`}
        >
          <img src="/messenger.svg" alt="Messages" className="mobile-nav-icon" />
          <span>Messages</span>
        </Link>

        <Link 
          to="/notifications_mobile"
          className={`mobile-nav-item ${isActive('/notifications_mobile') ? 'active' : ''}`}
        >
          <img src="/notifications.svg" alt="Notifications" className="mobile-nav-icon" />
          {unreadCount > 0 && <span className="notification-badge-mobile">{unreadCount}</span>}
          <span>Notifications</span>
        </Link>

        <Link 
          to={`/profile/${user?.username}`} 
          className={`mobile-nav-item ${isActive(`/profile/${user?.username}`) ? 'active' : ''}`}
        >
          <div className="mobile-nav-avatar">
            <img 
              src={getAvatarUrl(user?.avatar)} 
              alt={user?.username}
              className="nav-avatar-img"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = '/default-avatar.png';
              }}
            />
          </div>
          <span>Profile</span>
        </Link>
      </div>
    </div>
  );
};

export default MobileNavigation;