import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import heic2any from 'heic2any';
import ImageProcessor from '../../utils/imageProcessor';
import { API_URL } from '../../config';
import ExternalVideoUpload from '../ExternalVideoUpload/ExternalVideoUpload';
import './CreatePost.css';

// Функция для сжатия изображений
const compressImage = async (file) => {
  console.log('🔧 Starting compression for:', file.name, 'Size:', file.size, 'Type:', file.type);
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      try {
        console.log('🔧 Image loaded successfully, dimensions:', img.width, 'x', img.height);
        
        // Устанавливаем размеры canvas (оригинальный размер для достижения 3.4MB)
        const maxWidth = img.width; // Оригинальный размер
        const maxHeight = img.height; // Оригинальный размер
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

        console.log('🔧 Canvas dimensions:', width, 'x', height);

        // Рисуем изображение на canvas с правильной ориентацией
        ctx.drawImage(img, 0, 0, width, height);
        
        // Применяем легкое сглаживание для шумных изображений
        try {
          const imageData = ctx.getImageData(0, 0, width, height);
          const data = imageData.data;
          
          // Более мягкое сглаживание для изображений с каплями дождя
          for (let i = 0; i < data.length; i += 4) {
            // Очень легкое сглаживание RGB каналов (98% вместо 95%)
            data[i] = Math.min(255, data[i] * 0.98);     // R
            data[i + 1] = Math.min(255, data[i + 1] * 0.98); // G
            data[i + 2] = Math.min(255, data[i + 2] * 0.98); // B
            // Alpha остается без изменений
          }
          
          ctx.putImageData(imageData, 0, 0);
          console.log('🔧 Applied gentle noise reduction');
        } catch (smoothingError) {
          console.warn('🔧 Could not apply noise reduction:', smoothingError);
          // Продолжаем без сглаживания
        }
        
        // Конвертируем в blob с более высоким качеством для сложных изображений
        canvas.toBlob((blob) => {
          if (blob) {
            const compressedFile = new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now()
            });
            console.log('🔧 Compression result:', {
              originalSize: file.size,
              compressedSize: compressedFile.size,
              compressionRatio: (compressedFile.size / file.size * 100).toFixed(1) + '%'
            });
            resolve(compressedFile);
          } else {
            console.error('🔧 Failed to create blob from canvas');
            reject(new Error('Failed to compress image - blob creation failed'));
          }
        }, 'image/jpeg', 0.9); // Увеличиваем качество до 90% для сложных изображений
      } catch (error) {
        console.error('🔧 Error during image processing:', error);
        reject(new Error(`Image processing failed: ${error.message}`));
      }
    };
    
    img.onerror = (error) => {
      console.error('🔧 Failed to load image:', error);
      reject(new Error('Failed to load image for processing'));
    };
    
    // Добавляем обработку ошибок при установке src
    try {
      img.src = URL.createObjectURL(file);
    } catch (error) {
      console.error('🔧 Failed to create object URL:', error);
      reject(new Error('Failed to create image URL'));
    }
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

    console.log('📸 Original File Details:', {
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
        // Обработка HEIC файлов
        let processedFile = file;
        if (file.type === 'image/heic' || file.type === 'image/heif' || file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif')) {
          console.log('🔄 Converting HEIC file to JPEG...');
          try {
            const convertedBlob = await heic2any({
              blob: file,
              toType: 'image/jpeg',
              quality: 0.8
            });
            processedFile = new File([convertedBlob], file.name.replace(/\.(heic|heif)$/i, '.jpg'), {
              type: 'image/jpeg',
              lastModified: Date.now()
            });
            console.log('✅ HEIC conversion successful');
          } catch (heicError) {
            console.error('❌ HEIC conversion failed:', heicError);
            throw new Error('Failed to convert HEIC image. Please try a different image.');
          }
        }

        // Валидация файла перед обработкой
        if (processedFile.size > 50 * 1024 * 1024) { // 50MB
          throw new Error('File size too large. Maximum size is 50MB.');
        }

        // Проверяем поддерживаемые типы файлов
        const supportedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'];
        if (!supportedTypes.includes(processedFile.type.toLowerCase())) {
          throw new Error('Unsupported file type. Please use JPEG, PNG, WebP, GIF, or HEIC.');
        }

        // Для изображений сжимаем
        let compressed;
        try {
          compressed = await compressImage(processedFile);
          console.log('📸 Compressed File Details:', {
            name: compressed.name,
            type: compressed.type,
            size: compressed.size
          });
        } catch (compressionError) {
          console.warn('📸 Primary compression failed, trying fallback:', compressionError);
          
          // Fallback: простая конвертация без сложной обработки
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          const img = new Image();
          
          compressed = await new Promise((resolve, reject) => {
            img.onload = () => {
              canvas.width = img.width;
              canvas.height = img.height;
              ctx.drawImage(img, 0, 0);
              
              canvas.toBlob((blob) => {
                if (blob) {
                  const fallbackFile = new File([blob], processedFile.name, {
                    type: 'image/jpeg',
                    lastModified: Date.now()
                  });
                  console.log('📸 Fallback compression successful');
                  resolve(fallbackFile);
                } else {
                  reject(new Error('Fallback compression failed'));
                }
              }, 'image/jpeg', 0.8);
            };
            img.onerror = () => reject(new Error('Failed to load image for fallback'));
            img.src = URL.createObjectURL(processedFile);
          });
        }
        
        setCompressedFile(compressed);
        setOriginalFileName(file.name);
        
        // Создаем превью для изображения
        const imageUrl = URL.createObjectURL(compressed);
        setPreviewUrl(imageUrl);
      }
    } catch (error) {
      console.error('Error processing file:', error);
      setError(error.message || 'Error processing file. Please try again.');
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
        <h2>
          Create new post
        </h2>
        
        {/* External resources button */}
        <div className="upload-mode-switcher">
          <button 
            type="button"
            className="external-video-btn"
            onClick={() => setShowExternalVideoModal(true)}
          >
            <div className="platform-icons">
              🎥🎬📺
            </div>
            <span className="platform-text">TikTok/Instagram/YouTube</span>
          </button>
        </div>

        {/* File upload functionality */}
        <div className="file-upload-section">
          <label className="file-input-label">
            <div className="file-input-icon">📸 Choose Image/Video</div>
            <input 
              type="file" 
              accept=".jpg,.jpeg,.png,.gif,.mp4,.mov,.webm,image/*,video/*" 
              onChange={handleImageChange} 
              disabled={compressing}
            />
          </label>
        </div>

        {compressing && (
          <div className="compression-status">
            {mediaType === 'video' ? 'Processing video...' : 'Processing image...'}
          </div>
        )}

        {/* Preview of selected content */}
        {previewUrl && (
          <div className="video-preview-container">
            <div className="video-preview">
              {parsedVideoData ? (
                // For external videos show preview
                <div className="external-video-preview">
                  <div className="external-video-header">
                    <div className="external-video-title">
                      {parsedVideoData.platform === 'youtube' ? '📺' : 
                       parsedVideoData.platform === 'youtube-shorts' ? '📱' : '🎥'}
                      {' '}
                      {parsedVideoData.platform === 'youtube-shorts' ? 'YOUTUBE-SHORTS' : 
                       parsedVideoData.platform?.toUpperCase()} Video
                    </div>
                    {parsedVideoData.title && (
                      <div className="external-video-description">
                        {parsedVideoData.title}
                      </div>
                    )}
                    {parsedVideoData.description && (
                      <div className="external-video-subtitle">
                        {parsedVideoData.description}
                      </div>
                    )}
                  </div>
                  {previewUrl && (
                    <div 
                      className="external-video-thumbnail"
                      style={{ backgroundImage: `url(${previewUrl})` }}
                    >
                      <div className="external-video-play-button">
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
                />
              ) : (
                <img src={previewUrl} alt="Preview" />
              )}
            </div>
            <div className="remove-button-container">
              <button 
                type="button"
                className="remove-button"
                onClick={() => {
                  setPreviewUrl(null);
                  setCompressedFile(null);
                  setOriginalFileName('');
                  setParsedVideoData(null);
                  setVideoUrl('');
                  setMediaType('image');
                  setError('');
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
                className="create-post-textarea"
                placeholder="Add a caption..."
                value={caption}
                onChange={handleCaptionChange}
                disabled={loading}
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
              disabled={loading || (!compressedFile && !parsedVideoData)}
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