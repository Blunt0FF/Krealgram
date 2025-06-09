import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAvatarUrl } from '../../utils/imageUtils';
import { API_URL } from '../../config';
import './LikesModal.css';

const LikesModal = ({ isOpen, onClose, postId }) => {
  const [likes, setLikes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const fetchLikes = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${API_URL}/api/posts/${postId}/likes`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setLikes(data.likes || []);
      } else {
        setError('Failed to load likes list');
      }
    } catch (err) {
      console.error('Error loading likes:', err);
      setError('An error occurred while loading');
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    if (isOpen && postId) {
      fetchLikes();
    }
  }, [isOpen, postId, fetchLikes]);

  const handleUserClick = (username) => {
    onClose();
    navigate(`/profile/${username}`);
  };

  if (!isOpen) return null;

  return (
    <div className="tooltip-backdrop" onClick={onClose}>
      <div className="likes-tooltip" onClick={(e) => e.stopPropagation()}>
        <div className="likes-tooltip-header">
          <h3>Likes</h3>
          <button className="tooltip-close-btn" onClick={onClose}>
            ×
          </button>
        </div>
        
        <div className="likes-tooltip-content">
          {loading && (
            <div className="likes-tooltip-loading">
              Loading...
            </div>
          )}
          
          {error && (
            <div className="likes-tooltip-error">
              {error}
            </div>
          )}
          
          {!loading && !error && (
            <ul className="likes-tooltip-users">
              {likes.length === 0 ? (
                <li className="likes-tooltip-empty">
                  No likes yet
                </li>
              ) : (
                likes.map((like) => (
                  <li 
                    key={like._id || like.user._id} 
                    className="likes-tooltip-user"
                    onClick={() => handleUserClick(like.user.username)}
                  >
                    <img 
                      src={getAvatarUrl(like.user.avatar)} 
                      alt={like.user.username}
                      className="likes-tooltip-avatar"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = '/default-avatar.png';
                      }}
                    />
                    <span className="likes-tooltip-username">
                      {like.user.username}
                    </span>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default LikesModal; 
