import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getRecentUsers, addRecentUser } from '../utils/recentUsers';
import { getAvatarUrl } from '../utils/imageUtils';
import { API_URL } from '../config';
import './SearchPage.css';

const SearchPage = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [recentUsers, setRecentUsers] = useState([]);

  const handleSearch = async (query) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      return;
    }
    
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/search/users?q=${encodeURIComponent(query)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.users || []);
      }
    } catch (e) {
      console.error('Search error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      handleSearch(searchQuery);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  useEffect(() => {
    // Прокручиваем в верх при переходе на страницу поиска
    window.scrollTo(0, 0);
    
    // Проверяем существование недавних пользователей
    const validateRecentUsers = async () => {
      const recent = getRecentUsers();
      if (recent.length === 0) {
        setRecentUsers([]);
        return;
      }
      
      try {
        const token = localStorage.getItem('token');
        const validUsers = [];
        
        for (const user of recent) {
          try {
            const res = await fetch(`${API_URL}/api/users/profile/${user.username}`, {
              headers: token ? { 'Authorization': `Bearer ${token}` } : {}
            });
            
            if (res.ok) {
              const data = await res.json();
              if (data.user) {
                validUsers.push(user);
              }
            }
          } catch (e) {
            // Пользователь не существует, пропускаем
            console.log(`User ${user.username} no longer exists`);
          }
        }
        
        // Обновляем localStorage только валидными пользователями
        if (validUsers.length !== recent.length) {
          localStorage.setItem('recentUsers', JSON.stringify(validUsers));
        }
        
        setRecentUsers(validUsers);
      } catch (error) {
        console.error('Error validating recent users:', error);
        setRecentUsers(recent); // Fallback к оригинальному списку
      }
    };
    
    validateRecentUsers();
  }, []);

  const handleUserClick = (user) => {
    addRecentUser(user);
    setRecentUsers(getRecentUsers());
  };

  return (
    <div className="search-page">
      <div className="search-container">
        <div className="search-header">
          <h2>Search</h2>
          <input
            type="text"
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
            autoFocus
          />
        </div>
        
        <div className="search-results">
          {loading && <div className="search-loading">Searching...</div>}
          
          {!loading && searchQuery.length >= 2 && searchResults.length === 0 && (
            <div className="search-no-results">No users found</div>
          )}
          
          {!loading && searchQuery.length >= 2 && searchResults.map(user => (
            <Link 
              key={user._id} 
              to={`/profile/${user.username}`} 
              className="search-result"
              onClick={() => handleUserClick(user)}
            >
              <img 
                src={getAvatarUrl(user.avatar)} 
                alt={user.username} 
                className="search-result-avatar"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = '/default-avatar.png';
                }}
              />
              <div className="search-result-info">
                <div className="search-result-username">{user.username}</div>
                <div className="search-result-bio">{user.bio || 'No bio'}</div>
              </div>
            </Link>
          ))}
          
          {searchQuery.length < 2 && recentUsers.length > 0 && (
            <div className="recent-section">
              <h3 className="recent-title">Recent</h3>
              {recentUsers.map(user => (
                <Link 
                  key={user._id} 
                  to={`/profile/${user.username}`} 
                  className="search-result"
                  onClick={() => handleUserClick(user)}
                >
                  <img 
                    src={getAvatarUrl(user.avatar)} 
                    alt={user.username} 
                    className="search-result-avatar"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = '/default-avatar.png';
                    }}
                  />
                  <div className="search-result-info">
                    <div className="search-result-username">{user.username}</div>
                    <div className="search-result-bio">{user.bio || 'No bio'}</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
          
          {searchQuery.length < 2 && recentUsers.length === 0 && (
            <div className="search-placeholder">
              <h3>Search users</h3>
              <p>Enter a username to search</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SearchPage; 
