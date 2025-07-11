import React, { useState } from 'react';
import './ExternalVideoUpload.css';

const ExternalVideoUpload = ({ isOpen, onClose, onVideoDownloaded }) => {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [platform, setPlatform] = useState('');

  // Блокировка скролла при открытой модалке
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    // Очистка при размонтировании
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const supportedPlatforms = [
    'TikTok',
    'Instagram', 
    'YouTube'
  ];

  const detectPlatform = (url) => {
    if (url.includes('tiktok.com') || url.includes('vm.tiktok.com')) return 'tiktok';
    if (url.includes('instagram.com')) return 'instagram';
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
      setError('Unsupported platform. Supported: TikTok, Instagram, YouTube');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      
      // Определяем endpoint в зависимости от платформы
      let endpoint;
      let requestBody;
      
      if (detectedPlatform === 'youtube') {
        // YouTube - iframe embedding
        endpoint = 'https://krealgram-backend.onrender.com/api/posts/external-video';
        requestBody = {
          url: url.trim(),
          caption: '' // Пустое описание, пользователь сможет добавить позже
        };
      } else {
        // TikTok, Instagram, - реальное скачивание
        endpoint = 'https://krealgram-backend.onrender.com/api/posts/external-video/download';
        requestBody = {
          url: url.trim()
        };
      }
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();
      
      if (response.ok) {
        // Для скачанных видео возвращаем данные как есть
        // Для YouTube iframe - тоже возвращаем данные
        onVideoDownloaded(data);
        onClose();
      } else {
        setError(data.message || data.error || 'Failed to import video');
      }
    } catch (error) {
      console.error('Error importing video:', error);
      setError('Failed to import video');
    } finally {
      setIsLoading(false);
    }
  };

  // Закрытие по клику на фон
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="external-video-upload-overlay" onClick={handleOverlayClick}>
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



