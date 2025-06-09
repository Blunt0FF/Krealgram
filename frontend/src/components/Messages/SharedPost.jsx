import React from 'react';
import { Link } from 'react-router-dom';
import { getAvatarUrl } from '../../utils/imageUtils';
import './SharedPost.css';

const SharedPost = ({ post, onPostClick }) => {
  if (!post) {
    return <div className="shared-post-container missing">Post not available</div>;
  }

  const handlePostClick = (e) => {
    e.stopPropagation(); // Предотвращаем срабатывание других кликов
    onPostClick(post);
  };

  return (
    <div className="shared-post-container" onClick={handlePostClick}>
      <div className="shared-post-header">
        <img 
          src={getAvatarUrl(post.author?.avatar)} 
          alt={post.author?.username} 
          className="shared-post-author-avatar"
        />
        <span className="shared-post-author-username">{post.author?.username}</span>
      </div>
      <div className="shared-post-image-wrapper">
        <img 
          src={post.imageUrl || post.image} 
          alt="Shared post" 
          className="shared-post-image"
        />
      </div>
    </div>
  );
};

export default SharedPost; 