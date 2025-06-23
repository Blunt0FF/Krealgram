import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { compressPostImage } from '../../utils/imageUtils';
import { API_URL } from '../../config';
import ExternalVideoUpload from '../ExternalVideoUpload/ExternalVideoUpload';
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
  const [parsedVideoData, setParsedVideoData] = useState(null);
  const [showExternalVideoModal, setShowExternalVideoModal] = useState(false);

  useEffect(() => {
    // Scroll to top when navigating to create post page
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
      
      // Clear external video data when uploading file
      setParsedVideoData(null);
      setVideoUrl('');
      
      // Apply compression only for images
      if (fileType === 'image') {
        setCompressing(true);
        setCompressedFile(null);
        
        try {
          const compressedBlob = await compressPostImage(file);
          setCompressedFile(compressedBlob);
        } catch (err) {
          setError('Image compression error');
        } finally {
          setCompressing(false);
        }
              } else {
        // For video use original file without compression
        setCompressedFile(file);
        setCompressing(false);
      }
    }
  };

  const handleCaptionChange = (e) => {
    setCaption(e.target.value);
  };

  const handleExternalVideoSelect = (videoData) => {
    console.log('🎬 External video selected:', videoData);
    
    // Clear file data when selecting external video
    setCompressedFile(null);
    setOriginalFileName('');
    
    // Set video data
    setParsedVideoData(videoData);
    setVideoUrl(videoData.originalUrl || videoData.videoUrl);
    setMediaType('video');
    
    // Set preview
    if (videoData.thumbnailUrl) {
      setPreviewUrl(videoData.thumbnailUrl);
    } else if (videoData.platform === 'youtube' && videoData.videoId) {
      setPreviewUrl(`https://img.youtube.com/vi/${videoData.videoId}/maxresdefault.jpg`);
    } else if (videoData.platform === 'tiktok') {
      // For TikTok create simple preview with logo
      setPreviewUrl(`https://via.placeholder.com/300x400/000000/FFFFFF?text=🎵+TikTok+Video`);
    } else {
      // For other platforms
      setPreviewUrl(`https://via.placeholder.com/300x300/000000/FFFFFF?text=${videoData.platform?.toUpperCase()}+Video`);
    }
    
    setError('');
    setShowExternalVideoModal(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Check that either file or external video is selected
    if (!compressedFile && !parsedVideoData) {
      setError('Please select a file or external video first');
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

      if (parsedVideoData && videoUrl) {
        // For external videos use JSON
        headers['Content-Type'] = 'application/json';
        requestData = JSON.stringify({
          caption,
          videoUrl,
          videoData: parsedVideoData,
          mediaType: 'video'
        });
        console.log('🚀 Sending external video post:', {
          videoUrl,
          videoData: parsedVideoData,
          caption,
          platform: parsedVideoData?.platform,
          embedUrl: parsedVideoData?.embedUrl,
          originalUrl: parsedVideoData?.originalUrl
        });
      } else {
        // For files use FormData
        requestData = new FormData();
        requestData.append('image', compressedFile, originalFileName);
        requestData.append('caption', caption);
        console.log('📁 Sending file post:', {
          fileName: originalFileName,
          mediaType,
          caption
        });
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
        
        // Update feed or redirect
        navigate('/');
      } else {
        setError(data.message || 'Error creating post');
      }
    } catch (error) {
      console.error('❌ Error creating post:', error);
      setError('An error occurred while creating the post');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="create-post-container">
      <div className="create-post-box">
        <h2>Create new post</h2>
        
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
              🎵📱🔵📺🐦
            </div>
            <span className="platform-text">TikTok/Instagram/VK/YouTube/Twitter</span>
          </button>
        </div>

        {/* File upload functionality */}
        <div className="file-upload-section">
          <label className="file-input-label">
            Choose Image/Video
            <input 
              type="file" 
              accept="image/*,video/mp4,video/mov,video/webm" 
              onChange={handleImageChange} 
              disabled={compressing} 
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
            {mediaType === 'video' ? 'Processing video...' : 'Compressing image...'}
          </div>
        )}

        {/* Preview of selected content */}
        {previewUrl && (
          <div className="video-preview-container">
            <div className="video-preview">
              {parsedVideoData ? (
                // For external videos show card
                <div style={{
                  width: '100%',
                  maxWidth: '400px',
                  height: '300px',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  borderRadius: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  textAlign: 'center',
                  padding: '20px',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
                }}>
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>
                    {parsedVideoData.platform === 'tiktok' ? '🎵' :
                     parsedVideoData.platform === 'youtube' ? '📺' :
                     parsedVideoData.platform === 'instagram' ? '📱' :
                     parsedVideoData.platform === 'vk' ? '🎬' : '🎥'}
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>
                    {parsedVideoData.platform?.toUpperCase()} Video
                  </div>
                  <div style={{ fontSize: '14px', opacity: '0.8', wordBreak: 'break-all', maxWidth: '100%' }}>
                    {parsedVideoData.originalUrl?.substring(0, 50)}...
                  </div>
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
                marginTop: '12px',
                cursor: 'pointer'
              }}
            >
              Remove {parsedVideoData ? 'Video' : mediaType === 'video' ? 'Video' : 'Image'}
            </button>
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
      </div>

      {/* External video upload modal */}
      <ExternalVideoUpload
        isOpen={showExternalVideoModal}
        onVideoDownloaded={(data) => {
          console.log('✅ Video processed:', data);
          
          if (data.success && data.post) {
            // Video was successfully downloaded and post created
            console.log('🎉 Video downloaded successfully, redirecting to feed...');
            navigate('/'); // Redirect to feed to see the new post
          } else if (data.isExternalLink) {
            // Fallback for external links (if any)
            const videoData = {
              platform: data.platform,
              videoId: null,
              originalUrl: data.originalUrl,
              embedUrl: null,
              thumbnailUrl: data.thumbnailUrl,
              note: data.note || `External ${data.platform} video content`
            };
            handleExternalVideoSelect(videoData);
          }
        }}
        onClose={() => setShowExternalVideoModal(false)}
      />
    </div>
  );
};

export default CreatePost; 