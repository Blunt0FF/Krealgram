import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { getAvatarUrl, getAvatarThumbnailUrl } from '../../utils/imageUtils';
import { API_URL } from '../../config';
import './Search.css';

const Search = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const searchUsers = async () => {
      if (!searchQuery.trim()) {
        setSearchResults([]);
        return;
      }

      try {
        setLoading(true);
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/api/search/users?q=${encodeURIComponent(searchQuery)}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
          const data = await response.json();
          setSearchResults(data.users || []);
        } else {
          console.error('Error searching users:', await response.text());
          setSearchResults([]);
        }
      } catch (error) {
        console.error('Error searching users:', error);
        setSearchResults([]);
      } finally {
        setLoading(false);
      }
    };

    const debounceTimeout = setTimeout(searchUsers, 300);
    return () => clearTimeout(debounceTimeout);
  }, [searchQuery]);

  return (
    <div className="search-container">
      <div className="search-input-container">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search users..."
          className="search-input"
        />
      </div>

      <div className="search-results">
        {loading && <div className="loading">Searching...</div>}

        {searchQuery.trim() && searchResults.map(user => (
          <Link 
            key={user._id} 
            to={`/profile/${user.username}`}
            className="user-result"
          >
            <img 
              src={getAvatarThumbnailUrl(user.avatar)}
              alt={user.username}
              className="user-avatar"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = '/default-avatar.png';
              }}
            />
            <div className="user-info">
              <span className="user-username">{user.username}</span>
              {user.bio && <span className="user-bio">{user.bio}</span>}
            </div>
          </Link>
        ))}

        {searchQuery.trim() && !loading && searchResults.length === 0 && (
          <div className="no-results">No users found</div>
        )}
      </div>
    </div>
  );
};

export default Search; 