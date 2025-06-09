import React, { useState } from 'react';
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
            <img 
              src={post?.imageUrl || post?.image} 
              alt="Post preview" 
              className="edit-post-image"
            />
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