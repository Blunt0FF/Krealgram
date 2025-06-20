import React, { useState } from 'react';
import './ExternalVideoUpload.css';

const ExternalVideoUpload = ({ isOpen, onClose, onVideoSelect }) => {
  const [videoUrl, setVideoUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Функция для парсинга различных видео URL
  const parseVideoUrl = (url) => {
    // YouTube
    const youtubeRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const youtubeMatch = url.match(youtubeRegex);
    if (youtubeMatch) {
      const videoId = youtubeMatch[1];
      return {
        platform: 'youtube',
        videoId,
        embedUrl: `https://www.youtube.com/embed/${videoId}`,
        thumbnailUrl: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
        originalUrl: url
      };
    }

    // TikTok - улучшенная обработка
    const tiktokRegex = /(?:(?:https?:\/\/)?(?:www\.)?tiktok\.com\/@[^\/]+\/video\/(\d+)|(?:https?:\/\/)?vm\.tiktok\.com\/([A-Za-z0-9]+)|(?:https?:\/\/)?(?:www\.)?tiktok\.com\/t\/([A-Za-z0-9]+))/;
    const tiktokMatch = url.match(tiktokRegex);
    if (tiktokMatch) {
      const videoId = tiktokMatch[1] || tiktokMatch[2] || tiktokMatch[3];
      
      // Для коротких ссылок используем оригинальную ссылку как embedUrl
      let embedUrl;
      if (tiktokMatch[1]) {
        // Полная ссылка
        embedUrl = `https://www.tiktok.com/embed/v2/${videoId}`;
      } else {
        // Короткие ссылки - используем оригинальную
        embedUrl = url.startsWith('http') ? url : `https://${url}`;
      }
      
      return {
        platform: 'tiktok',
        videoId: videoId,
        originalUrl: url,
        embedUrl: embedUrl,
        thumbnailUrl: `https://via.placeholder.com/300x400/FF0050/FFFFFF?text=🎵+TikTok+Video`,
        note: 'TikTok video content'
      };
    }

    // Instagram
    const instagramRegex = /(?:instagram\.com\/(?:p|reel)\/([A-Za-z0-9_-]+))/;
    const instagramMatch = url.match(instagramRegex);
    if (instagramMatch) {
      return {
        platform: 'instagram',
        videoId: instagramMatch[1],
        originalUrl: url,
        thumbnailUrl: null
      };
    }

    // VK
    const vkRegex = /(?:vk\.com\/video(-?\d+_\d+))/;
    const vkMatch = url.match(vkRegex);
    if (vkMatch) {
      return {
        platform: 'vk',
        videoId: vkMatch[1],
        originalUrl: url,
        thumbnailUrl: null
      };
    }

    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!videoUrl.trim()) {
      setError('Please enter a video URL');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const parsedVideo = parseVideoUrl(videoUrl.trim());
      
      if (!parsedVideo) {
        setError('Unsupported URL. Supported platforms: YouTube, TikTok, Instagram, VK');
        return;
      }

      // Вызываем callback с данными видео
      onVideoSelect(parsedVideo);
      
      // Очищаем форму
      setVideoUrl('');
      
    } catch (error) {
      console.error('Error parsing video URL:', error);
      setError('Error processing video URL');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setVideoUrl('');
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="external-video-overlay">
      <div className="external-video-modal">
        <div className="modal-header">
          <h3>Add video from external platform</h3>
          <button className="close-btn" onClick={handleClose}>×</button>
        </div>
        
        <div className="modal-body">
          <div className="supported-platforms">
            <div className="platform-info">
              <span className="platform-icon">📺</span>
              <span>YouTube</span>
            </div>
            <div className="platform-info">
              <span className="platform-icon">🎵</span>
              <span>TikTok</span>
            </div>
            <div className="platform-info">
              <span className="platform-icon">📱</span>
              <span>Instagram</span>
            </div>
            <div className="platform-info">
              <span className="platform-icon">🎬</span>
              <span>VK</span>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="input-group">
              <input
                type="text"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="Paste video link here..."
                className="video-url-input"
                disabled={loading}
              />
            </div>
            
            {error && <div className="error-message">{error}</div>}
            
            <div className="modal-actions">
              <button 
                type="button" 
                className="cancel-btn" 
                onClick={handleClose}
                disabled={loading}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="add-btn"
                disabled={loading || !videoUrl.trim()}
              >
                {loading ? 'Processing...' : 'Add Video'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ExternalVideoUpload; 