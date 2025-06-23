import React, { useState } from 'react';
import './ExternalVideoUpload.css';

const ExternalVideoUpload = ({ isOpen, onClose, onVideoDownloaded }) => {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [platform, setPlatform] = useState('');

  const supportedPlatforms = [
    'TikTok',
    'Instagram', 
    'VK',
    'YouTube'
  ];

  const detectPlatform = (url) => {
    if (url.includes('tiktok.com') || url.includes('vm.tiktok.com')) return 'tiktok';
    if (url.includes('instagram.com')) return 'instagram';
    if (url.includes('vk.com/video') || url.includes('vkvideo.ru')) return 'vk';
    if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
    return null;
  };

  const handleUrlChange = (e) => {
    const inputUrl = e.target.value;
    setUrl(inputUrl);
    setError('');
    
    if (inputUrl.length > 10) {
      const detectedPlatform = detectPlatform(inputUrl);
      setPlatform(detectedPlatform || '');
    } else {
      setPlatform('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!url.trim()) {
      setError('Please enter a video URL');
      return;
    }

    const detectedPlatform = detectPlatform(url);
    if (!detectedPlatform) {
      setError('Unsupported platform. Supported: TikTok, Instagram, VK, YouTube');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('https://krealgram-backend.onrender.com/api/posts/external-video/download', {
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
      
      if (response.ok) {
        onVideoDownloaded(data);
        onClose();
      } else {
        setError(data.error || 'Failed to import video');
      }
    } catch (error) {
      console.error('Error importing video:', error);
      setError('Failed to import video');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="external-video-upload-overlay">
      <div className="external-video-upload-modal">
        <div className="external-video-upload-header">
          <h3>Import video from external platform</h3>
          <button 
            className="close-btn" 
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </div>

        <div className="supported-platforms">
          <h4>Supported platforms:</h4>
          <div className="platforms-list">
            {supportedPlatforms.map((platform, index) => (
              <div key={index} className="platform-item">
                {platform}
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
              className="submit-btn"
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



