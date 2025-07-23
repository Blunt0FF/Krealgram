import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getImageUrl, getAvatarUrl } from '../../utils/mediaUrlResolver';
import './SharedPost.css';

const SharedPost = ({ post, onPostClick }) => {
  const [imageUrl, setImageUrl] = useState(null);
  const [thumbnailUrl, setThumbnailUrl] = useState(null);
  const [isVideo, setIsVideo] = useState(false);

  useEffect(() => {
    if (!post) return;

    // Определяем тип медиа с поддержкой YouTube
    const mediaType = post.mediaType || 
                     (post.videoUrl ? 'video' : 
                     (post.youtubeData ? 'youtube' : 'image'));
    setIsVideo(mediaType === 'video' || mediaType === 'youtube');

    // Обработка изображений с приоритетом гиф превью для видео
    let finalImageUrl = null;
    let finalThumbnailUrl = null;

    // Для видео постов приоритет гиф превью
    if (mediaType === 'video' || mediaType === 'youtube') {
      const videoImageSources = [
        post.gifPreview, // Приоритет гиф превью для видео
        post.thumbnailUrl,
        post.imageUrl,
        post.image,
        '/video-placeholder.png'
      ].filter(Boolean);
      
      finalImageUrl = getImageUrl(videoImageSources[0]);
      finalThumbnailUrl = getImageUrl(videoImageSources[1] || videoImageSources[0]);
    } else {
      // Для обычных изображений
      const imageSources = [
        post.imageUrl,
        post.image,
        post.thumbnailUrl,
        post.gifPreview,
        '/default-post-placeholder.png'
      ].filter(Boolean);

      finalImageUrl = getImageUrl(imageSources[0]);
      finalThumbnailUrl = getImageUrl(imageSources[1] || imageSources[0]);
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
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = '/default-avatar.png';
            }}
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
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = '/default-post-placeholder.png';
            }}
          />
          {(isVideo || post.mediaType === 'video' || post.mediaType === 'youtube' || post.videoUrl || post.youtubeData) && (
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