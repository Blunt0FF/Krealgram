import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './ShareModal.css';

const ShareModal = ({ isOpen, onClose, postId, post }) => {
  const [copySuccess, setCopySuccess] = useState(false);
  const navigate = useNavigate();

  if (!isOpen) return null;

  const postUrl = window.location.origin + `/post/${postId || post._id}`;

  const handleSendInMessages = () => {
    if (!post) {
      console.error('Нет данных поста для ShareModal');
      return;
    }

    const postToShare = {
      id: post._id || post.id,
      image: post.imageUrl || post.image,
      caption: post.caption || '',
      author: typeof post.author === 'string' ? post.author : post.author?.username || 'Unknown',
      createdAt: post.createdAt
    };

    // Закрываем модальное окно перед навигацией
    onClose();
    
    // Используем replace для предотвращения проблем с навигацией назад
    navigate('/messages', { 
      replace: true,
      state: { 
        sharedPost: postToShare,
        timestamp: Date.now() // Добавляем timestamp для гарантии обновления state
      }
    });
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(postUrl);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy: ', err);
      const textArea = document.createElement('textarea');
      textArea.value = postUrl;
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand('copy');
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      } catch (err) {
        console.error('Fallback: Oops, unable to copy', err);
      }
      document.body.removeChild(textArea);
    }
  };

  return (
    <div className="share-modal-overlay" onClick={onClose}>
      <div className="share-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="share-modal-header">
          <h3>Share post</h3>
          <button className="share-modal-close" onClick={onClose}>
            <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="share-modal-body">
          <div className="share-url-container">
            <input 
              type="text" 
              value={postUrl} 
              readOnly 
              className="share-url-input"
            />
            <button 
              className={`copy-button ${copySuccess ? 'copied' : ''}`}
              onClick={handleCopyLink}
            >
              {copySuccess ? 'Copied!' : 'Copy'}
            </button>
          </div>
          
          <div className="share-options">
            <button className="share-option-btn" onClick={handleSendInMessages}>
              <svg width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12.003 2.001a9.705 9.705 0 1 1 0 19.4 10.876 10.876 0 0 1-2.895-.384.798.798 0 0 0-.533.04l-1.984.876a.801.801 0 0 1-1.123-.708l-.054-1.78a.806.806 0 0 0-.27-.569 9.49 9.49 0 0 1-3.14-7.175 9.65 9.65 0 0 1 10-9.7Z"/>
              </svg>
              Send in message
            </button>
          </div>
          
          <p>Share this post with your friends or copy the link to share anywhere.</p>
        </div>
      </div>
    </div>
  );
};

export default ShareModal; 