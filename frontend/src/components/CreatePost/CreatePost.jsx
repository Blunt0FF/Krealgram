import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { compressPostImage } from '../../utils/imageUtils';
import { API_URL } from '../../config';
import './CreatePost.css';

const CreatePost = () => {
  const navigate = useNavigate();
  const [previewUrl, setPreviewUrl] = useState(null);
  const [caption, setCaption] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [compressedFile, setCompressedFile] = useState(null);
  const [originalFileName, setOriginalFileName] = useState('');
  const [compressing, setCompressing] = useState(false);
  const [mediaType, setMediaType] = useState('image');
  const [videoUrl, setVideoUrl] = useState('');
  const [isUrlMode, setIsUrlMode] = useState(false);
  const [parsedVideoData, setParsedVideoData] = useState(null);

  useEffect(() => {
    // Прокручиваем в верх при переходе на страницу создания поста
    window.scrollTo(0, 0);
  }, []);

  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      const fileType = file.type.startsWith('video/') ? 'video' : 'image';
      setMediaType(fileType);
      setPreviewUrl(URL.createObjectURL(file));
      setOriginalFileName(file.name);
      setError('');
      
      // Сжатие применяем только для изображений
      if (fileType === 'image') {
        setCompressing(true);
        setCompressedFile(null);
        
        try {
          const compressedBlob = await compressPostImage(file);
          setCompressedFile(compressedBlob);
        } catch (err) {
          setError('Ошибка сжатия изображения');
        } finally {
          setCompressing(false);
        }
      } else {
        // Для видео используем оригинальный файл без сжатия
        setCompressedFile(file);
        setCompressing(false);
      }
    }
  };

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

    // TikTok
    const tiktokRegex = /(?:https?:\/\/)?(?:www\.|vm\.|m\.)?tiktok\.com\/(?:@[\w\.-]+\/video\/(\d+)|v\/(\d+)|[\w\.-]+|t\/[\w\.-]+)/;
    const tiktokMatch = url.match(tiktokRegex);
    if (tiktokMatch || url.includes('tiktok.com') || url.includes('vm.tiktok.com')) {
      return {
        platform: 'tiktok',
        videoId: tiktokMatch?.[1] || tiktokMatch?.[2] || 'unknown',
        originalUrl: url,
        note: 'TikTok video will be displayed as external link'
      };
    }

    // VK Video
    const vkRegex = /(?:https?:\/\/)?(?:www\.|m\.)?(?:vk\.com\/(?:video|clip)(-?\d+_\d+)|vkvideo\.ru\/video(-?\d+_\d+))/;
    const vkMatch = url.match(vkRegex);
    if (vkMatch || url.includes('vk.com/video') || url.includes('vk.com/clip') || url.includes('vkvideo.ru')) {
      return {
        platform: 'vk',
        videoId: vkMatch?.[1] || vkMatch?.[2] || 'unknown',
        originalUrl: url
      };
    }

    // Instagram
    const instagramRegex = /(?:https?:\/\/)?(?:www\.)?instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/;
    const instagramMatch = url.match(instagramRegex);
    if (instagramMatch || url.includes('instagram.com')) {
      return {
        platform: 'instagram',
        videoId: instagramMatch?.[1] || 'unknown',
        originalUrl: url
      };
    }

    return null;
  };

  // Обработчик изменения URL
  const handleUrlChange = (e) => {
    const url = e.target.value;
    setVideoUrl(url);
    
    if (url.trim()) {
      const parsed = parseVideoUrl(url.trim());
      if (parsed) {
        setParsedVideoData(parsed);
        setMediaType('video');
        setError('');
        
        // Для YouTube можем показать превью
        if (parsed.platform === 'youtube') {
          setPreviewUrl(parsed.thumbnailUrl);
        }
      } else {
        setParsedVideoData(null);
        setError('Unsupported URL. Supported: YouTube, TikTok, VK (vk.com, vkvideo.ru), Instagram');
      }
    } else {
      setParsedVideoData(null);
      setPreviewUrl(null);
      setError('');
    }
  };

  const handleCaptionChange = (e) => {
    setCaption(e.target.value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (isUrlMode && !videoUrl.trim()) {
      setError('Enter video URL');
      return;
    }
    
    if (!isUrlMode && !compressedFile) {
      setError('Select a file to upload');
      return;
    }

    const parsedVideoInfo = isUrlMode ? parseVideoUrl(videoUrl) : null;
    
    if (isUrlMode && !parsedVideoInfo) {
      setError('Unsupported URL. Supported: YouTube, TikTok, VK, Instagram');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      let requestData;
      let headers = {
        'Authorization': `Bearer ${token}`
      };

      if (isUrlMode) {
        // Для URL используем JSON
        headers['Content-Type'] = 'application/json';
        requestData = JSON.stringify({
          caption,
          videoUrl,
          videoData: parsedVideoInfo
        });
        console.log('Sending video URL post:', {
          videoUrl,
          videoData: parsedVideoInfo,
          caption
        });
      } else {
        // Для файлов используем FormData
        requestData = new FormData();
        requestData.append('image', compressedFile, originalFileName);
        requestData.append('caption', caption);
      }

      const response = await fetch(`${API_URL}/api/posts`, {
        method: 'POST',
        headers,
        body: requestData
      });

      const data = await response.json();

      if (response.ok) {
        setCaption('');
        setPreviewUrl(null);
        setVideoUrl('');
        setParsedVideoData(null);
        setCompressedFile(null);
        setOriginalFileName('');
        
        // Обновляем ленту или перенаправляем
        navigate('/');
      } else {
        setError(data.message || 'Error creating post');
      }
    } catch (error) {
      setError('An error occurred while creating the post');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="create-post-container">
      <div className="create-post-box">
        <h2>Create new post</h2>
        
        {/* Переключатель между файлом и URL */}
        <div className="upload-mode-switcher">
          <button 
            type="button"
            className={`mode-btn ${!isUrlMode ? 'active' : ''}`}
            onClick={() => {
              setIsUrlMode(false);
              setVideoUrl('');
              setParsedVideoData(null);
              if (!compressedFile) setPreviewUrl(null);
            }}
          >
            📁 Upload File
          </button>
          <button 
            type="button"
            className={`mode-btn ${isUrlMode ? 'active' : ''}`}
            onClick={() => {
              setIsUrlMode(true);
              setCompressedFile(null);
              if (!parsedVideoData) setPreviewUrl(null);
            }}
          >
            🔗 From URL
          </button>
        </div>

        <form className="create-post-form" onSubmit={handleSubmit}>
          {!isUrlMode ? (
            // Загрузка файла
            <label className="file-input-label">
              Choose Image/Video
              <input 
                type="file" 
                accept="image/*,video/mp4,video/mov,video/webm" 
                onChange={handleImageChange} 
                disabled={compressing} 
              />
            </label>
          ) : (
            // Ввод URL
            <div className="url-input-container">
              <input
                type="text"
                value={videoUrl}
                onChange={handleUrlChange}
                placeholder="Paste video link (YouTube, TikTok, VK, Instagram)"
                className="url-input"
                disabled={loading}
              />
              {parsedVideoData && (
                <div className="parsed-video-info">
                  <span className="platform-badge">{parsedVideoData.platform.toUpperCase()}</span>
                </div>
              )}
            </div>
          )}
          {compressing && (
            <div className="compression-status">
              {mediaType === 'video' ? 'Processing video...' : 'Compressing image...'}
            </div>
          )}
          {previewUrl && (
            <div className="image-preview">
              {mediaType === 'video' ? (
                <video 
                  src={previewUrl} 
                  controls 
                  style={{ maxWidth: '100%', maxHeight: '400px' }}
                />
              ) : (
                <img src={previewUrl} alt="Preview" />
              )}
            </div>
          )}

          <div className="form-group">
            <textarea
              placeholder="Add a caption..."
              value={caption}
              onChange={handleCaptionChange}
              disabled={loading || compressing}
              maxLength={500}
            />
            <div className={`char-count ${caption.length > 450 ? 'danger' : caption.length > 400 ? 'warning' : ''}`}>
              {caption.length}/500
            </div>
          </div>
          {error && <div className="create-post-error">{error}</div>}
          <button 
            type="submit" 
            className="create-post-button" 
            disabled={loading || compressing || (!compressedFile && !parsedVideoData)}
          >
            {loading ? 'Publishing...' : compressing ? 'Processing...' : 'Share'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CreatePost; 