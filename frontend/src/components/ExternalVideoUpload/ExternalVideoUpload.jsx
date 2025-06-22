import React, { useState } from 'react';
import { API_URL } from '../../config';
import './ExternalVideoUpload.css';

const ExternalVideoUpload = ({ onVideoUploaded, onClose }) => {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [platform, setPlatform] = useState('');

  const supportedPlatforms = [
    { name: 'TikTok', domain: 'tiktok.com', icon: '🎵' },
    { name: 'Instagram', domain: 'instagram.com', icon: '📷' },
    { name: 'VK', domain: 'vk.com', icon: '🔵' },
    { name: 'YouTube', domain: 'youtube.com', icon: '📺' },
    { name: 'Twitter/X', domain: 'twitter.com', icon: '🐦' }
  ];

  const detectPlatform = (inputUrl) => {
    if (inputUrl.includes('tiktok.com')) return 'TikTok';
    if (inputUrl.includes('instagram.com')) return 'Instagram';
    if (inputUrl.includes('vk.com') || inputUrl.includes('vk.ru')) return 'VK';
    if (inputUrl.includes('youtube.com') || inputUrl.includes('youtu.be')) return 'YouTube';
    if (inputUrl.includes('twitter.com') || inputUrl.includes('x.com')) return 'Twitter/X';
    return '';
  };

  const handleUrlChange = (e) => {
    const inputUrl = e.target.value;
    setUrl(inputUrl);
    setPlatform(detectPlatform(inputUrl));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!url.trim()) {
      setError('Please enter a video URL');
      return;
    }

    const detectedPlatform = detectPlatform(url);
    if (!detectedPlatform) {
      setError('Unsupported platform. Supported: TikTok, Instagram, VK, YouTube, Twitter/X');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${API_URL}/api/posts/external-video/download`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          url: url.trim()
        })
      });

      const data = await response.json();

      if (data.success) {
        console.log('✅ Видео успешно загружено:', data);
        onVideoUploaded(data.post);
        onClose();
      } else {
        setError(data.message || 'Ошибка загрузки видео');
      }
    } catch (error) {
      console.error('❌ Ошибка загрузки видео:', error);
      setError('Ошибка соединения с сервером');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="external-video-upload-overlay">
      <div className="external-video-upload-modal">
        <div className="external-video-upload-header">
          <h3>Import video from external platform</h3>
          <button 
            className="close-btn" 
            onClick={onClose}
            disabled={isLoading}
          >
            ×
          </button>
        </div>

        <div className="supported-platforms">
          <h4>Supported platforms:</h4>
          <div className="platforms-list">
            {supportedPlatforms.map((p) => (
              <div key={p.name} className="platform-item">
                <span className="platform-icon">{p.icon}</span>
                <span className="platform-name">{p.name}</span>
              </div>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="external-video-upload-form">
          <div className="form-group">
            <label htmlFor="video-url">
              Video URL:
            </label>
            <input
              id="video-url"
              type="url"
              value={url}
              onChange={handleUrlChange}
              placeholder="Paste video link here..."
              disabled={isLoading}
              required
            />
            {platform && (
              <div className="detected-platform">
                Detected platform: <strong>{platform}</strong>
              </div>
            )}
          </div>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <div className="form-actions">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="cancel-btn"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !url.trim()}
              className="upload-btn"
            >
              {isLoading ? (
                <>
                  <div className="loading-spinner"></div>
                  Importing...
                </>
              ) : (
                'Import Video'
              )}
            </button>
          </div>
        </form>

        {isLoading && (
          <div className="loading-info">
            <p>⏳ Importing video from {platform}...</p>
            <p>This may take a few minutes depending on video size.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExternalVideoUpload; 