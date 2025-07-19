import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import heic2any from 'heic2any';
import ImageProcessor from '../../utils/imageProcessor';
import { API_URL } from '../../config';
import ExternalVideoUpload from '../ExternalVideoUpload/ExternalVideoUpload';
import './CreatePost.css';

// Функция для сжатия изображений
const compressImage = async (file) => {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      // Устанавливаем размеры canvas
      const maxWidth = 1920;
      const maxHeight = 1080;
      let { width, height } = img;
      
      if (width > height) {
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = (width * maxHeight) / height;
          height = maxHeight;
        }
      }
      
      canvas.width = width;
      canvas.height = height;
      
      // Рисуем изображение на canvas
      ctx.drawImage(img, 0, 0, width, height);
      
      // Конвертируем в blob
      canvas.toBlob((blob) => {
        if (blob) {
          const compressedFile = new File([blob], file.name, {
            type: 'image/jpeg',
            lastModified: Date.now()
          });
          resolve(compressedFile);
        } else {
          reject(new Error('Failed to compress image'));
        }
      }, 'image/jpeg', 0.8);
    };
    
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
};

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
  const [parsedVideoData, setParsedVideoData] = useState(null);
  const [showExternalVideoModal, setShowExternalVideoModal] = useState(false);

  const fileInputRef = useRef(null);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const handleImageChange = useCallback(async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    console.log('📸 File Details:', {
      name: file.name,
      type: file.type,
      size: file.size
    });

    setCompressing(true);
    setError('');

    try {
      // Определяем тип медиа
      const isVideo = file.type.startsWith('video/');
      setMediaType(isVideo ? 'video' : 'image');

      if (isVideo) {
        // Для видео создаем превью
        const videoUrl = URL.createObjectURL(file);
        setPreviewUrl(videoUrl);
        setCompressedFile(file);
        setOriginalFileName(file.name);
      } else {
        // Для изображений сжимаем
        const compressed = await compressImage(file);
        setCompressedFile(compressed);
        setOriginalFileName(file.name);
        
        // Создаем превью для изображения
        const imageUrl = URL.createObjectURL(compressed);
        setPreviewUrl(imageUrl);
      }
    } catch (error) {
      console.error('Error processing file:', error);
      setError('Error processing file. Please try again.');
    } finally {
      setCompressing(false);
    }
  }, []);

  const handleCaptionChange = useCallback((e) => {
    setCaption(e.target.value);
  }, []);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    
    console.log('🚀 Post Creation Debug:', {
      compressedFile: compressedFile ? {
        name: compressedFile.name,
        type: compressedFile.type,
        size: compressedFile.size
      } : null,
      parsedVideoData,
      caption
    });
    
    if (!compressedFile && !parsedVideoData) {
      setError('Please select a file or external video first');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      
      formData.append('caption', caption);

      if (parsedVideoData) {
        console.log('🎬 External Video Data:', parsedVideoData);
        formData.append('videoUrl', parsedVideoData.videoUrl || parsedVideoData.originalUrl);
        formData.append('videoData', JSON.stringify(parsedVideoData.videoData || parsedVideoData));
      } else if (compressedFile) {
        console.log('📸 File Details:', {
          name: compressedFile.name,
          type: compressedFile.type,
          size: compressedFile.size
        });
        formData.append('image', compressedFile, compressedFile.name);
      }

      console.log('📤 FormData contents:');
      for (let [key, value] of formData.entries()) {
        console.log(`${key}:`, value);
      }

      const response = await fetch(`${API_URL}/api/posts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      console.log('📥 Response status:', response.status);

      let responseData;
      try {
        responseData = await response.json();
      } catch (jsonError) {
        console.error('❌ JSON Parsing Error:', jsonError);
        // Не пытаемся читать response.text() повторно
        throw new Error('Invalid server response - not JSON');
      }

      if (!response.ok) {
        console.error('❌ Server Error:', responseData);
        throw new Error(responseData.message || 'Error creating post');
      }

      // Сбрасываем состояние после успешной загрузки
      setPreviewUrl(null);
      setCompressedFile(null);
      setOriginalFileName('');
      setCaption('');
      setMediaType('image');
      setParsedVideoData(null);

      navigate('/');
    } catch (error) {
      console.error('❌ Post creation error:', error);
      setError(error.message || 'Failed to create post');
    } finally {
      setLoading(false);
    }
  }, [compressedFile, parsedVideoData, caption, originalFileName, navigate]);

  const handleExternalVideoSelect = useCallback(async (videoData) => {
    console.log('🎬 External video selected:', videoData);
    
    // Не создаем пост автоматически
    setCompressedFile(null);
    setOriginalFileName('');
    
    // Set video data
    setParsedVideoData(videoData);
    setVideoUrl(videoData.originalUrl || videoData.videoUrl);
    setMediaType('video');
    
    // Улучшенная логика превью для разных платформ
    if (videoData.platform === 'youtube' && videoData.videoId) {
      const thumbnailUrl = `https://img.youtube.com/vi/${videoData.videoId}/maxresdefault.jpg`;
      setPreviewUrl(thumbnailUrl);
    } else if (videoData.thumbnailUrl) {
      // Для TikTok/Instagram/YouTube Shorts используем проксированный GIF
      if (videoData.platform === 'tiktok' || videoData.platform === 'instagram' || videoData.platform === 'youtube-shorts') {
        // Извлекаем ID файла из Google Drive URL
        const fileId = videoData.thumbnailUrl.match(/id=([^&]+)/)?.[1];
        if (fileId) {
          const proxyUrl = `${API_URL}/api/proxy-drive/${fileId}?type=image`;
          setPreviewUrl(proxyUrl);
        } else {
          setPreviewUrl(videoData.thumbnailUrl);
        }
      } else {
        setPreviewUrl(videoData.thumbnailUrl);
      }
    } else {
      setPreviewUrl(`https://via.placeholder.com/300x300/000000/FFFFFF?text=${videoData.platform?.toUpperCase()}+Video`);
    }
    
    setError('');
    setShowExternalVideoModal(false);
  }, []);

  return (
      <div className="create-post-box">
        <h2 style={{
          textAlign: 'center',
          color: '#333',
          fontWeight: '700',
          fontSize: '24px',
          marginBottom: '20px'
        }}>
          Create new post
        </h2>
        
        {/* External resources button */}
        <div className="upload-mode-switcher">
          <button 
            type="button"
            className="external-video-btn"
            onClick={() => setShowExternalVideoModal(true)}
            style={{
              background: 'linear-gradient(45deg, #ff6b6b, #4ecdc4, #45b7d1, #9c27b0)',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              padding: '12px 24px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer',
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'transform 0.2s ease',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
            }}
          >
            <div className="platform-icons" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '18px' }}>
              🎥🎬📺
            </div>
            <span className="platform-text">TikTok/Instagram/YouTube</span>
          </button>
        </div>

        {/* File upload functionality */}
        <div className="file-upload-section">
          <label className="file-input-label" style={{
            display: 'block',
            width: '100%',
            padding: '20px',
            textAlign: 'center',
            border: '2px dashed #ddd',
            borderRadius: '12px',
            cursor: 'pointer',
            marginBottom: '20px',
            position: 'relative'
          }}>
            <div style={{ marginBottom: '10px', fontSize: '18px' }}>📸 Choose Image/Video</div>
            <input 
              type="file" 
              accept=".jpg,.jpeg,.png,.gif,.mp4,.mov,.webm,image/*,video/*" 
              onChange={handleImageChange} 
              disabled={compressing}
              style={{ 
                opacity: 0,
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                cursor: 'pointer'
              }}
            />
          </label>
        </div>

        {compressing && (
          <div className="compression-status" style={{
            textAlign: 'center',
            padding: '12px',
            background: '#f0f0f0',
            borderRadius: '8px',
            margin: '12px 0'
          }}>
            {mediaType === 'video' ? 'Processing video...' : 'Processing image...'}
          </div>
        )}

        {/* Preview of selected content */}
        {previewUrl && (
          <div className="video-preview-container">
            <div className="video-preview">
              {parsedVideoData ? (
                // For external videos show preview
                <div style={{
                  width: '100%',
                  maxWidth: '400px',
                  margin: '0 auto',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
                }}>
                  <div style={{
                    padding: '20px',
                    textAlign: 'center',
                    color: 'white'
                  }}>
                    <div style={{
                      fontSize: '24px',
                      marginBottom: '12px'
                    }}>
                      {parsedVideoData.platform === 'youtube' ? '📺' : 
                       parsedVideoData.platform === 'youtube-shorts' ? '📱' : '🎥'}
                      {' '}
                      {parsedVideoData.platform === 'youtube-shorts' ? 'YOUTUBE-SHORTS' : 
                       parsedVideoData.platform?.toUpperCase()} Video
                    </div>
                    {parsedVideoData.title && (
                      <div style={{
                        fontSize: '16px',
                        marginBottom: '12px',
                        opacity: 0.9
                      }}>
                        {parsedVideoData.title}
                      </div>
                    )}
                    {parsedVideoData.description && (
                      <div style={{
                        fontSize: '14px',
                        opacity: 0.7
                      }}>
                        {parsedVideoData.description}
                      </div>
                    )}
                  </div>
                  {previewUrl && (
                    <div style={{
                      width: '100%',
                      height: '200px',
                      backgroundImage: `url(${previewUrl})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      backgroundRepeat: 'no-repeat',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative'
                    }}>
                      <div style={{
                        background: 'rgba(0,0,0,0.7)',
                        borderRadius: '50%',
                        width: '60px',
                        height: '60px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        position: 'absolute',
                        zIndex: 10
                      }}>
                        <svg width="24" height="24" fill="white" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z"/>
                        </svg>
                      </div>
                    </div>
                  )}
                </div>
              ) : mediaType === 'video' ? (
                <video 
                  src={previewUrl} 
                  controls 
                  style={{ maxWidth: '100%', maxHeight: '400px', borderRadius: '12px' }}
                />
              ) : (
                <img src={previewUrl} alt="Preview" style={{ maxWidth: '100%', maxHeight: '400px', borderRadius: '12px' }} />
              )}
            </div>
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              marginTop: '12px'
            }}>
              <button 
                type="button"
                onClick={() => {
                  setPreviewUrl(null);
                  setCompressedFile(null);
                  setOriginalFileName('');
                  setParsedVideoData(null);
                  setVideoUrl('');
                  setMediaType('image');
                  setError('');
                }}
                style={{
                  background: '#ff4757',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px 16px',
                  cursor: 'pointer',
                  marginBottom: '15px'
                }}
              >
                Remove {parsedVideoData ? 'Video' : mediaType === 'video' ? 'Video' : 'Image'}
              </button>
            </div>
          </div>
        )}

        {/* Caption form - always visible */}
        <form className="create-post-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <textarea
                placeholder="Add a caption..."
                value={caption}
                onChange={handleCaptionChange}
                disabled={loading}
                maxLength={500}
                style={{
                  width: '100%',
                  minHeight: '100px',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid #ddd',
                  fontSize: '14px',
                  resize: 'vertical'
                }}
              />
              <div className={`char-count ${caption.length > 450 ? 'danger' : caption.length > 400 ? 'warning' : ''}`}>
                {caption.length}/500
              </div>
            </div>
            {error && <div className="create-post-error">{error}</div>}
            <button 
              type="submit" 
              className="create-post-button" 
              disabled={loading || (!compressedFile && !parsedVideoData)}
              style={{
                background: '#0095f6',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                padding: '12px 24px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer',
                width: '100%'
              }}
            >
              {loading ? 'Publishing...' : 'Share'}
            </button>
          </form>

      {/* External video upload modal */}
      <ExternalVideoUpload
        isOpen={showExternalVideoModal}
        onVideoDownloaded={(data) => {
          console.log('✅ Video processed:', data);
          
          if (data.success) {
            if (data.isExternalLink) {
              // YouTube iframe или внешние ссылки - позволяем добавить описание
              console.log('📺 External video prepared, allowing user to add caption...');
              const videoData = {
                platform: data.platform,
                videoId: data.videoData?.videoId || null,
                originalUrl: data.originalUrl,
                embedUrl: data.videoData?.embedUrl || null,
                thumbnailUrl: data.thumbnailUrl,
                note: data.note,
                isExternalLink: true,
                videoData: data.videoData
              };
              handleExternalVideoSelect(videoData);
            } else if (data.videoData || data.videoUrl) {
              // TikTok/Instagram/VK - видео скачано, позволяем добавить описание
              console.log('📹 Video downloaded, allowing user to add caption...');
              const videoData = {
                platform: data.platform,
                videoId: null,
                originalUrl: data.originalUrl,
                embedUrl: null,
                thumbnailUrl: data.thumbnailUrl,
                note: data.note || `Downloaded ${data.platform} video`,
                isDownloaded: true,
                videoUrl: data.videoUrl,
                videoData: data.videoData
              };
              handleExternalVideoSelect(videoData);
            }
          } else {
            console.error('❌ Video processing failed:', data.message);
          }
        }}
        onClose={() => setShowExternalVideoModal(false)}
      />
    </div>
  );
};

export default CreatePost; 