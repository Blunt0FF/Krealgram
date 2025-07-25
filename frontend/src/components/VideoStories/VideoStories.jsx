import React, { useState, useEffect, useRef } from 'react';
import { getAvatarUrl, getAvatarThumbnailUrl } from '../../utils/imageUtils';
import { getVideoPreviewThumbnail } from '../../utils/videoUtils';
import videoManager from '../../utils/videoManager';
import VideoStoriesModal from './VideoStoriesModal';
import { API_URL } from '../../config';
import './VideoStories.css';
import axios from 'axios';

const VideoStories = () => {
  const [videoUsers, setVideoUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [viewedUsers, setViewedUsers] = useState(new Set());
  const [videos, setVideos] = useState([]);

  useEffect(() => {
    fetchVideoUsers();
    // Загружаем просмотренные видео из localStorage
    const saved = localStorage.getItem('viewedVideoStories');
    if (saved) {
      setViewedUsers(new Set(JSON.parse(saved)));
    }
  }, []);

  const fetchVideoUsers = async () => {
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        setLoading(false);
        return;
      }
      
      const response = await fetch(`${API_URL}/api/posts/video-users`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setVideoUsers(data.users || []);
      } else {
        const errorText = await response.text().catch(() => 'No error text');
      }
    } catch (error) {
      console.error('Error fetching video users:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserVideos = async () => {
    try {
      const response = await axios.get('/api/posts/user-videos', {
        params: { userId: selectedUser._id }
      });
      setVideos(response.data);
    } catch (error) {
      console.error('Error fetching user videos:', error);
    }
  };

  const handleUserClick = (user) => {
    setSelectedUser(user);
    setIsModalOpen(true);
  };

  const closeModal = (userWasViewed = false) => {
    if (userWasViewed && selectedUser) {
      // Отмечаем пользователя как просмотренного
      const newViewedUsers = new Set(viewedUsers);
      newViewedUsers.add(selectedUser._id);
      setViewedUsers(newViewedUsers);
      
      // Сохраняем в localStorage
      localStorage.setItem('viewedVideoStories', JSON.stringify([...newViewedUsers]));
    }
    
    setIsModalOpen(false);
    setSelectedUser(null);
  };



  // Временно отключаем VideoStories если есть проблемы с API
  if (videoUsers.length === 0) {
    return null; // Не показываем ленту если нет видео
  }

  return (
    <>
      <div className="video-stories-container">
        <div className="video-stories-header">
          <h3>Latest Videos</h3>
        </div>
        <div className="video-stories-list">
          {videoUsers.map((user) => {
            const isViewed = viewedUsers.has(user._id);
            return (
              <div 
                key={user._id} 
                className="video-story-item"
                onClick={() => handleUserClick(user)}
              >
                <div className="video-story-avatar-container">
                  <img 
                    src={getAvatarThumbnailUrl(user.avatar)} 
                    alt={user.username}
                    className={`video-story-avatar ${isViewed ? 'viewed' : ''}`}
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
            );
          })}
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