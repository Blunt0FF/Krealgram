import React, { useState } from 'react';
import { getMediaThumbnail } from '../../utils/videoUtils';
import './EditPostModal.css';

const EditPostModal = ({ isOpen, onClose, post, onSave }) => {
  const [caption, setCaption] = useState(post?.caption || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (isSaving) return;
    
    setIsSaving(true);
    try {
      await onSave(caption.trim());
      onClose();
    } catch (error) {
      console.error('Error saving post:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setCaption(post?.caption || '');
    onClose();
  };

  if (!isOpen) return null;

  // Проверяем является ли пост видео
  const isVideo = post?.mediaType === 'video' || post?.videoUrl || post?.youtubeData;
  
  // Получаем превью изображение
  const previewSrc = isVideo ? getMediaThumbnail(post) : (post?.imageUrl || post?.image);

  return (
    <div className="edit-post-modal-overlay" onClick={handleCancel}>
      <div className="edit-post-modal" onClick={(e) => e.stopPropagation()}>
        <div className="edit-post-modal-header">
          <h3>Edit post</h3>
          <button className="edit-post-modal-close" onClick={handleCancel}>
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="edit-post-modal-body">
          <div className="edit-post-preview">
            <div className="edit-post-image-wrapper">
              <img 
                src={previewSrc} 
                alt="Post preview" 
                className="edit-post-image"
                onError={(e) => {
                  // Если изображение не загрузилось и это видео, показываем placeholder
                  if (isVideo && e.target.src !== '/video-placeholder.svg') {
                    e.target.src = '/video-placeholder.svg';
                  }
                }}
              />
              {isVideo && (
                <div className="edit-post-play-overlay">
                  <div className="edit-post-play-button">
                    <svg width="24" height="24" fill="white" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          <div className="edit-post-form">
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Write a description..."
              className="edit-post-textarea"
              maxLength={500}
              rows={6}
            />
            <div className="edit-post-char-count">
              {caption.length}/500
            </div>
          </div>
        </div>
        
        <div className="edit-post-modal-footer">
          <button 
            className="edit-post-btn edit-post-btn-cancel" 
            onClick={handleCancel}
            disabled={isSaving}
          >
            Cancel
          </button>
          <button 
            className="edit-post-btn edit-post-btn-save" 
            onClick={handleSave}
            disabled={isSaving || caption.trim() === post?.caption}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditPostModal; 