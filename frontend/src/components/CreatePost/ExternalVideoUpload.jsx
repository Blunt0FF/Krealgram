import React, { useState } from 'react';
import { API_URL } from '../../config';
import './ExternalVideoUpload.css';

const ExternalVideoUpload = ({ isOpen, onClose, onVideoSelect }) => {
  const [videoUrl, setVideoUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);

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

    // TikTok - улучшенная обработка всех форматов ссылок
    const tiktokRegex = /(?:(?:https?:\/\/)?(?:www\.)?tiktok\.com\/@[^\/]+\/video\/(\d+)|(?:https?:\/\/)?vm\.tiktok\.com\/([A-Za-z0-9]+)|(?:https?:\/\/)?(?:www\.)?tiktok\.com\/t\/([A-Za-z0-9]+)|(?:https?:\/\/)?(?:vt\.)?tiktok\.com\/([A-Za-z0-9]+))/;
    const tiktokMatch = url.match(tiktokRegex);
    if (tiktokMatch) {
      const videoId = tiktokMatch[1] || tiktokMatch[2] || tiktokMatch[3] || tiktokMatch[4];
      return {
        platform: 'tiktok',
        videoId: videoId,
        originalUrl: url,
        needsDownload: true, // Указываем что нужно скачать
        thumbnailUrl: `https://via.placeholder.com/300x400/FF0050/FFFFFF?text=🎵+TikTok+Video`,
        note: 'TikTok video will be downloaded and uploaded'
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
        needsDownload: true, // Указываем что нужно скачать
        thumbnailUrl: `https://via.placeholder.com/300x400/E4405F/FFFFFF?text=📱+Instagram+Video`,
        note: 'Instagram video will be downloaded and uploaded'
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

  // Функция для загрузки видео через бэкенд
  const downloadAndUploadVideo = async (parsedVideo) => {
    try {
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${API_URL}/api/external-video/download`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url: parsedVideo.originalUrl,
          platform: parsedVideo.platform
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to download video');
      }

      const result = await response.json();
      
      return {
        ...parsedVideo,
        videoUrl: result.videoUrl, // URL загруженного видео на Cloudinary
        thumbnailUrl: result.thumbnailUrl || parsedVideo.thumbnailUrl,
        cloudinaryPublicId: result.publicId,
        isDownloaded: true
      };
    } catch (error) {
      console.error('Error downloading video:', error);
      throw error;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!videoUrl.trim()) {
      setError('Please enter a video URL');
      return;
    }

    setLoading(true);
    setError('');
    setUploadProgress(0);

    try {
      const parsedVideo = parseVideoUrl(videoUrl.trim());
      
      if (!parsedVideo) {
        setError('Unsupported URL. Supported platforms: YouTube, TikTok, Instagram, VK');
        return;
      }

      let finalVideoData = parsedVideo;

      // Если нужно скачать видео (TikTok, Instagram)
      if (parsedVideo.needsDownload) {
        setUploadProgress(25);
        
        try {
          finalVideoData = await downloadAndUploadVideo(parsedVideo);
          setUploadProgress(100);
        } catch (downloadError) {
          console.error('Download error:', downloadError);
          setError(`Failed to download ${parsedVideo.platform} video: ${downloadError.message}`);
          return;
        }
      }

      // Вызываем callback с данными видео
      onVideoSelect(finalVideoData);
      
      // Очищаем форму
      setVideoUrl('');
      setUploadProgress(0);
      
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
    setUploadProgress(0);
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
              <small>Downloaded & uploaded</small>
            </div>
            <div className="platform-info">
              <span className="platform-icon">📱</span>
              <span>Instagram</span>
              <small>Downloaded & uploaded</small>
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
            
            {loading && uploadProgress > 0 && (
              <div className="upload-progress">
                <div className="progress-bar">
                  <div 
                    className="progress-fill" 
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
                <span className="progress-text">
                  {uploadProgress < 100 ? 'Downloading video...' : 'Upload complete!'}
                </span>
              </div>
            )}
            
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