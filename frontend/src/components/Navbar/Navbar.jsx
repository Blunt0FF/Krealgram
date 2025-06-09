import React from 'react';
import { Link } from 'react-router-dom';
import './Navbar.css';

const Navbar = ({ isAuthenticated, user }) => {
  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/" className="navbar-logo">
          <img src="/logo.png" alt="Logo" />
        </Link>

        <div className="navbar-search">
          <input
            type="text"
            placeholder="Search users..."
            className="search-input"
          />
        </div>

        <div className="navbar-links">
          {isAuthenticated ? (
            <>
              <Link to="/create-post" className="nav-link">
                <i className="fas fa-plus"></i>
              </Link>
              <Link to={`/profile/${user?.username || ''}`} className="nav-link">
                <img
                  src={user?.avatar || '/default-avatar.png'}
                  alt="Profile"
                  className="nav-avatar"
                />
              </Link>
              <button className="nav-link logout-button">
                <i className="fas fa-sign-out-alt"></i>
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="nav-link">Login</Link>
              <Link to="/register" className="nav-link">Register</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar; 