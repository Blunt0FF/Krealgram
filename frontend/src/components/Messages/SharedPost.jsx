import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getImageUrl, getAvatarUrl } from '../../utils/imageUtils';
import { getMediaThumbnail } from '../../utils/videoUtils';
import './SharedPost.css';

const SharedPost = ({ post, onPostClick }) => {
  const [imageUrl, setImageUrl] = useState(null);
  const [thumbnailUrl, setThumbnailUrl] = useState(null);
  const [isVideo, setIsVideo] = useState(false);

  useEffect(() => {
    if (!post) return;

    // Определяем тип медиа
    const mediaType = post.mediaType || (post.videoUrl ? 'video' : 'image');
    setIsVideo(mediaType === 'video');

    // Обработка изображений
    let finalImageUrl = null;
    let finalThumbnailUrl = null;

    if (post.videoUrl) {
      // Для видео используем превью или thumbnail
      finalImageUrl = getImageUrl(post.thumbnailUrl || post.gifPreview);
      finalThumbnailUrl = getImageUrl(post.thumbnailUrl);
    } else if (post.image) {
      // Для изображений используем основное изображение
      finalImageUrl = getImageUrl(post.image);
      finalThumbnailUrl = getImageUrl(post.thumbnailUrl);
    }

    setImageUrl(finalImageUrl);
    setThumbnailUrl(finalThumbnailUrl);
  }, [post]);

  if (!post) return null;

  const handlePostClick = () => {
    if (onPostClick) {
      onPostClick(post);
    }
  };

  const handleImageClick = () => {
    if (onPostClick) {
      onPostClick(post);
    }
  };

  return (
    <div className="shared-post" onClick={handlePostClick}>
      <div className="shared-post-header">
        <Link to={`/profile/${post.author.username}`}>
          <img 
            src={getAvatarUrl(post.author.avatar)} 
            alt={`${post.author.username}'s avatar`} 
            className="shared-post-avatar" 
          />
        </Link>
        <div className="shared-post-info">
          <Link to={`/profile/${post.author.username}`} className="shared-post-username">
            {post.author.username}
          </Link>
        </div>
      </div>

      {imageUrl && (
        <div 
          className={`shared-post-media ${isVideo ? 'video-preview' : 'image-preview'}`} 
          onClick={handleImageClick}
        >
          <img 
            src={imageUrl} 
            alt={`${post.author.username}'s post`} 
            className="shared-post-image" 
            loading="lazy"
          />
          {isVideo && (
            <div className="video-overlay">
              <span className="play-icon">▶</span>
            </div>
          )}
        </div>
      )}

      {post.caption && (
        <div className="shared-post-caption-container">
          <p className="shared-post-caption">{post.caption}</p>
        </div>
      )}

      {post.likesCount > 0 && (
        <div className="shared-post-likes">
          {post.likesCount} {post.likesCount === 1 ? 'like' : 'likes'}
        </div>
      )}
    </div>
  );
};

export default SharedPost; 