import React, { useState, useEffect } from 'react';
import { getAvatarUrl } from '../../utils/imageUtils';
import VideoStoriesModal from './VideoStoriesModal';
import { API_URL } from '../../config';
import './VideoStories.css';

const VideoStories = () => {
  const [videoUsers, setVideoUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchVideoUsers();
  }, []);

  const fetchVideoUsers = async () => {
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        console.error('VideoStories: No auth token found');
        setLoading(false);
        return;
      }
      
      console.log('VideoStories: Fetching video users...');
      const response = await fetch(`${API_URL}/api/posts/video-users`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('VideoStories: Response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('VideoStories: Response data:', data);
        setVideoUsers(data.users || []);
      } else {
        const errorText = await response.text().catch(() => 'No error text');
        console.error('VideoStories: Video users error:', response.status, errorText);
        try {
          const errorData = JSON.parse(errorText);
          console.error('VideoStories: Parsed error:', errorData);
        } catch (e) {
          console.error('VideoStories: Raw error text:', errorText);
        }
      }
    } catch (error) {
      console.error('VideoStories: Error fetching video users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUserClick = (user) => {
    setSelectedUser(user);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedUser(null);
  };

  if (loading) {
    return (
      <div className="video-stories-container">
        <div className="video-stories-header">
          <h3>Latest Videos</h3>
        </div>
        <div className="video-stories-loading">
          Loading...
        </div>
      </div>
    );
  }

  console.log('VideoStories: Rendering, videoUsers:', videoUsers);
  
  // Временно отключаем VideoStories если есть проблемы с API
  if (videoUsers.length === 0) {
    console.log('VideoStories: No video users found, hiding component');
    return null; // Не показываем ленту если нет видео
  }
  
  console.log('VideoStories: Showing component with', videoUsers.length, 'users');

  return (
    <>
      <div className="video-stories-container">
        <div className="video-stories-header">
          <h3>Latest Videos</h3>
        </div>
        <div className="video-stories-list">
          {videoUsers.map((user) => (
            <div 
              key={user._id} 
              className="video-story-item"
              onClick={() => handleUserClick(user)}
            >
              <div className="video-story-avatar-container">
                <img 
                  src={getAvatarUrl(user.avatar)} 
                  alt={user.username}
                  className="video-story-avatar"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = '/default-avatar.png';
                  }}
                />
                <div className="video-count-badge">
                  {user.videoCount}
                </div>
              </div>
              <span className="video-story-username">{user.username}</span>
            </div>
          ))}
        </div>
      </div>

      {isModalOpen && selectedUser && (
        <VideoStoriesModal 
          user={selectedUser}
          isOpen={isModalOpen}
          onClose={closeModal}
        />
      )}
    </>
  );
};

export default VideoStories; 