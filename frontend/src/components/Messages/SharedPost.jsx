import React from 'react';
import { Link } from 'react-router-dom';
import { getAvatarUrl } from '../../utils/imageUtils';
import { getMediaThumbnail } from '../../utils/videoUtils';
import './SharedPost.css';

const SharedPost = ({ post, onPostClick }) => {
  if (!post) {
    return <div className="shared-post-container missing">Post not available</div>;
  }

  const handlePostClick = (e) => {
    e.stopPropagation(); // Предотвращаем срабатывание других кликов
    onPostClick(post);
  };

  // Проверяем является ли пост видео
  const isVideo = post.mediaType === 'video' || post.videoUrl || post.youtubeData ||
                  // Дополнительная проверка по URL для внешних видео
                  (post.imageUrl && (
                    post.imageUrl.includes('cloudinary.com/') && post.imageUrl.includes('/video/')
                  )) ||
                  (post.image && (
                    post.image.includes('cloudinary.com/') && post.image.includes('/video/')
                  ));

  // Получаем превью для видео или обычное изображение
  const imageUrl = isVideo ? getMediaThumbnail(post) : (post.imageUrl || post.image);

  return (
    <div className="shared-post-container" onClick={handlePostClick}>
      <div className="shared-post-header">
        <img 
          src={getAvatarUrl(post.author?.avatar)} 
          alt={post.author?.username} 
          className="shared-post-author-avatar"
          onError={(e) => {
            e.target.onerror = null;
            e.target.src = '/default-avatar.png';
          }}
        />
        <span className="shared-post-author-username">{post.author?.username}</span>
      </div>
      <div className="shared-post-image-wrapper">
        <img 
          src={imageUrl || '/video-placeholder.svg'} 
          alt="Shared post" 
          className="shared-post-image"
          onError={(e) => {
            // Если изображение не загрузилось, показываем placeholder
            if (e.target.src !== '/video-placeholder.svg') {
              e.target.src = '/video-placeholder.svg';
            }
          }}
        />
        {isVideo && (
          <div className="shared-post-play-overlay">
            <div className="shared-post-play-button">
              <svg width="20" height="20" fill="white" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z"/>
              </svg>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SharedPost; 