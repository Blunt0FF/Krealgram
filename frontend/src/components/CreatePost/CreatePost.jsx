import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { compressPostImage } from '../../utils/imageUtils';
import { API_URL } from '../../config';
import ExternalVideoUpload from './ExternalVideoUpload';
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
  const [showExternalUpload, setShowExternalUpload] = useState(false);
  const [externalVideoData, setExternalVideoData] = useState(null);

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
        setError('Unsupported URL. Only YouTube videos are supported');
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

  // Обработчик выбора внешнего видео
  const handleExternalVideoSelect = (videoData) => {
    setExternalVideoData(videoData);
    setMediaType('video');
    setIsUrlMode(true);
    setCompressedFile(null); // Очищаем файл
    
    // Устанавливаем превью и URL
    if (videoData.type === 'external') {
      // YouTube видео
      setVideoUrl(videoData.originalUrl);
      setParsedVideoData({
        platform: videoData.platform,
        embedUrl: videoData.videoUrl,
        originalUrl: videoData.originalUrl
      });
      // Для YouTube устанавливаем превью
      if (videoData.platform === 'youtube') {
        const videoId = extractYouTubeId(videoData.originalUrl);
        if (videoId) {
          setPreviewUrl(`https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`);
        }
      }
    } else {
      // Загруженное видео
      setVideoUrl(videoData.videoUrl);
      setParsedVideoData({
        platform: videoData.platform,
        videoUrl: videoData.videoUrl,
        originalUrl: videoData.originalUrl,
        publicId: videoData.publicId
      });
      // Для загруженных видео можем показать сам файл как превью
      setPreviewUrl(videoData.videoUrl);
    }
    
    setError('');
  };

  // Функция для извлечения YouTube ID
  const extractYouTubeId = (url) => {
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
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
    
    // Проверяем валидность данных для URL режима
    if (isUrlMode && !parsedVideoInfo && !externalVideoData) {
      setError('Unsupported URL or no video data available');
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
        
        // Если есть данные внешнего видео, используем их
        const videoDataToSend = externalVideoData || parsedVideoInfo;
        
        requestData = JSON.stringify({
          caption,
          videoUrl,
          videoData: videoDataToSend,
          externalVideo: externalVideoData // Дополнительные данные для внешних видео
        });
        console.log('Sending video URL post:', {
          videoUrl,
          videoData: videoDataToSend,
          externalVideo: externalVideoData,
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
        setExternalVideoData(null);
        setIsUrlMode(false);
        
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
        
        {/* Переключатель между файлом и внешними видео */}
        <div className="upload-mode-switcher">
          <button 
            type="button"
            className={`mode-btn ${!isUrlMode ? 'active' : ''}`}
            onClick={() => {
              setIsUrlMode(false);
              setVideoUrl('');
              setParsedVideoData(null);
              setExternalVideoData(null);
            }}
          >
            📁 Choose Image/Video
          </button>
          <button 
            type="button"
            className={`mode-btn external-video-btn ${isUrlMode ? 'active' : ''}`}
            onClick={() => setShowExternalUpload(true)}
          >
            <span className="platform-icons">🔗▶️🎵📷🎬</span>
            <span className="platform-text">TikTok • Instagram • VK • YouTube</span>
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
            // Показываем превью выбранного внешнего видео
            (parsedVideoData || externalVideoData) && (
              <div className="selected-video-info">
                <div className="platform-badge">
                  {externalVideoData?.platform?.toUpperCase() || parsedVideoData?.platform?.toUpperCase()}
                </div>
                <div className="video-url-display">
                  {videoUrl}
                </div>
              </div>
            )
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
            disabled={loading || compressing || (!compressedFile && !parsedVideoData && !externalVideoData)}
          >
            {loading ? 'Publishing...' : compressing ? 'Processing...' : 'Share'}
          </button>
        </form>
      </div>
      
      {/* Модалка для загрузки внешних видео */}
      {showExternalUpload && (
        <ExternalVideoUpload
          onVideoSelect={handleExternalVideoSelect}
          onClose={() => setShowExternalUpload(false)}
        />
      )}
    </div>
  );
};

export default CreatePost; 