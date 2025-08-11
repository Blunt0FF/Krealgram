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
  
  // Проверяем размер файла (4 МБ)
  const maxSize = 4 * 1024 * 1024; // 4 МБ
  if (file.size <= maxSize) {
    console.log('🔧 File size is within limits, no compression needed');
    return file;
  }
  
  // Проверяем, является ли файл HEIC/HEIF
  const isHeic = file.type === 'image/heic' || file.type === 'image/heif' || 
                 file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif');
  
  if (isHeic) {
    console.log('🔧 HEIC/HEIF file detected, converting to JPEG');
    try {
      // Конвертируем HEIC в JPEG
      const convertedBlob = await heic2any({
        blob: file,
        toType: 'image/jpeg',
        quality: 0.8
      });
      
      const convertedFile = new File([convertedBlob], file.name.replace(/\.(heic|heif)$/i, '.jpg'), {
        type: 'image/jpeg',
        lastModified: Date.now()
      });
      
      console.log('🔧 HEIC converted to JPEG:', {
        originalSize: file.size,
        convertedSize: convertedFile.size
      });
      
      return convertedFile;
    } catch (conversionError) {
      console.warn('⚠️ HEIC conversion failed, using original file:', conversionError);
      return file;
    }
  }
  
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      // Проверяем, что изображение загрузилось корректно
      if (img.width === 0 || img.height === 0) {
        console.warn('⚠️ Image has zero dimensions, using original file');
        resolve(file);
        return;
      }
      
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
      
      // Конвертируем в blob
      canvas.toBlob((blob) => {
        if (blob && blob.size > 0) {
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
          console.warn('⚠️ Blob creation failed, using original file');
          resolve(file);
        }
      }, 'image/jpeg', 0.8); // Качество 80% для достижения 3.4MB
    };
    
    img.onerror = (error) => {
      console.warn('⚠️ Image loading failed, using original file:', error);
      resolve(file);
    };
    
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
        // Для изображений сжимаем
        try {
          const compressed = await compressImage(file);
          console.log('📸 Compressed File Details:', {
            name: compressed.name,
            type: compressed.type,
            size: compressed.size
          });
          setCompressedFile(compressed);
          setOriginalFileName(file.name);
          
          // Создаем превью для изображения
          const imageUrl = URL.createObjectURL(compressed);
          setPreviewUrl(imageUrl);
        } catch (compressionError) {
          console.warn('⚠️ Compression failed, using original file:', compressionError.message);
          // В случае ошибки сжатия используем оригинальный файл
          setCompressedFile(file);
          setOriginalFileName(file.name);
          
          // Создаем превью для изображения
          const imageUrl = URL.createObjectURL(file);
          setPreviewUrl(imageUrl);
        }
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

  const handleRemoveContent = useCallback(async () => {
    try {
      console.log('🗑️ Remove clicked, parsedVideoData:', parsedVideoData);
      
      // Если это внешнее видео с загруженными файлами, удаляем их из Google Drive
      if (parsedVideoData && parsedVideoData.videoData) {
        console.log('🎬 Video data found:', parsedVideoData.videoData);
        
        const fileIds = [];
        
        // ID основного видео
        if (parsedVideoData.videoData.googleDriveFileId) {
          fileIds.push(parsedVideoData.videoData.googleDriveFileId);
          console.log('📹 Main video file ID:', parsedVideoData.videoData.googleDriveFileId);
        }
        
        // ID превью gif (thumbnailFileId если есть)
        if (parsedVideoData.videoData.thumbnailFileId) {
          fileIds.push(parsedVideoData.videoData.thumbnailFileId);
          console.log('🖼️ Thumbnail file ID:', parsedVideoData.videoData.thumbnailFileId);
        } else if (parsedVideoData.videoData.gifPreview) {
          const thumbnailFileId = parsedVideoData.videoData.gifPreview.match(/id=([^&]+)/)?.[1];
          if (thumbnailFileId) {
            fileIds.push(thumbnailFileId);
            console.log('🖼️ Thumbnail file ID (extracted):', thumbnailFileId);
          }
        }
        
        // Если есть файлы для удаления, вызываем API
        if (fileIds.length > 0) {
          console.log('🚀 Deleting files from Google Drive:', fileIds);
          
          const token = localStorage.getItem('token');
          const response = await fetch(`${API_URL}/api/posts/external-video/cancel`, {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ fileIds })
          });
          
          const responseData = await response.json();
          console.log('📡 API Response:', responseData);
          
          if (!response.ok) {
            console.warn('⚠️ Failed to delete some files from Google Drive:', responseData);
          }
        } else {
          console.log('ℹ️ No files to delete from Google Drive');
        }
      } else {
        console.log('ℹ️ No video data found, just clearing state');
      }
    } catch (error) {
      console.error('❌ Error deleting files from Google Drive:', error);
    } finally {
      // Очищаем состояние независимо от результата удаления
      setPreviewUrl(null);
      setCompressedFile(null);
      setOriginalFileName('');
      setParsedVideoData(null);
      setVideoUrl('');
      setMediaType('image');
      setError('');
    }
  }, [parsedVideoData]);

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
                onClick={handleRemoveContent}
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
          console.log('🔍 Full data structure:', JSON.stringify(data, null, 2));
          
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
              console.log('📺 YouTube videoData created:', videoData);
              handleExternalVideoSelect(videoData);
            } else if (data.videoData || data.videoUrl) {
              // TikTok/Instagram/VK - видео скачано, позволяем добавить описание
              console.log('📹 Video downloaded, allowing user to add caption...');
              console.log('🔍 data.videoData structure:', data.videoData);
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
              console.log('📹 Downloaded videoData created:', videoData);
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