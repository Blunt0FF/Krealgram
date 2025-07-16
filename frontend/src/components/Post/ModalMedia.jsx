import React, { useState, useEffect, useRef, useMemo, memo } from 'react';
import { Link } from 'react-router-dom';
import ShareModal from './ShareModal';
import EditPostModal from './EditPostModal';
import LikesModal from './LikesModal';
import { getImageUrl, getAvatarUrl, getVideoUrl } from '../../utils/imageUtils';
import { getMediaThumbnail, extractYouTubeId } from '../../utils/videoUtils';
import videoManager from '../../utils/videoManager';
import { lockBodyScroll, unlockBodyScroll } from '../../utils/scrollUtils';
import { API_URL } from '../../config';
import './PostModal.css';

const MAX_CAPTION_LENGTH_EDIT = 500;

const ModalMedia = memo(({ postData }) => {
  if (!postData) return null;

  const checkYouTubeUrl = (url) => {
    if (!url) return null;
    const youtubeRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = url.match(youtubeRegex);
    
    if (match && match[1]) {
      const videoId = match[1];
      return `https://www.youtube.com/embed/${videoId}?enablejsapi=1&origin=${window.location.origin}&rel=0&showinfo=0&modestbranding=1&iv_load_policy=3&disablekb=1`;
    }
    
    // Резервный вариант для старых URL
    if (url.includes('youtu.be/')) {
      const videoId = url.split('youtu.be/')[1]?.split('?')[0];
      return `https://www.youtube.com/embed/${videoId}?enablejsapi=1&origin=${window.location.origin}&rel=0&showinfo=0&modestbranding=1&iv_load_policy=3&disablekb=1`;
    }
    
    const videoId = url.split('v=')[1]?.split('&')[0];
    return `https://www.youtube.com/embed/${videoId}?enablejsapi=1&origin=${window.location.origin}&rel=0&showinfo=0&modestbranding=1&iv_load_policy=3&disablekb=1`;
  };

  let youtubeEmbedUrl = null;
  let originalYouTubeUrl = null;

  const urlsToCheck = [
    postData.videoUrl,
    postData.youtubeUrl,
    postData.youtubeData?.embedUrl,
    postData.youtubeData?.originalUrl,
    postData.video,
    postData.image,
    postData.imageUrl
  ];

  for (let url of urlsToCheck) {
    if (url && (url.includes('youtube') || url.includes('youtu.be'))) {
      youtubeEmbedUrl = checkYouTubeUrl(url);
      originalYouTubeUrl = url;
      break;
    }
  }

  // Если YouTube-видео не нашлось, но есть youtubeData
  if (!youtubeEmbedUrl && postData.youtubeData) {
    youtubeEmbedUrl = checkYouTubeUrl(postData.youtubeData.originalUrl);
  }

  if (youtubeEmbedUrl) {
    return (
      <iframe
        width="100%"
        height="100%"
        src={youtubeEmbedUrl}
        title="YouTube video player"
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        loading="eager"
        style={{
          border: 'none',
          minWidth: window.innerWidth <= 768 ? '100%' : '900px',
          aspectRatio: '16/9',
          display: 'block',
          backgroundColor: '#000'
        }}
      />
    );
  }

  if (
    postData.mediaType === 'video' ||
    postData.imageUrl?.includes('.mp4') ||
    postData.image?.includes('.mp4')
  ) {
    const posterUrl = getMediaThumbnail(postData);
    const isDesktop = window.innerWidth >= 901;

    return (
      <video
        src={getVideoUrl(postData.imageUrl || `${API_URL}/uploads/${postData.image}`)}
        className="post-modal-video"
        controls
        playsInline
        muted={false}
        preload="metadata"
        poster={!isDesktop ? posterUrl : undefined}
        style={{
          width: '100%',
          height: 'auto',
          maxHeight: isDesktop ? 'calc(100vh - 120px)' : '900px',
          backgroundColor: '#000',
          objectFit: 'contain',
          display: 'block'
        }}
        onPlay={(e) => videoManager.setCurrentVideo(e.target)}
        onPause={(e) => {
          if (videoManager.getCurrentVideo() === e.target) {
            videoManager.pauseCurrentVideo();
          }
        }}
      />
    );
  }

  return (
    <img
      src={getImageUrl(postData.imageUrl || `${API_URL}/uploads/${postData.image}`)}
      alt="Post"
      className="post-modal-image"
      onError={(e) => {
        e.target.style.display = 'none';
      }}
    />
  );
});

export default ModalMedia;