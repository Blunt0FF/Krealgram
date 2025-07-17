import React, { useState, useEffect, useRef, useMemo, memo } from 'react';
import { Link } from 'react-router-dom';
import ShareModal from './ShareModal';
import EditPostModal from './EditPostModal';
import LikesModal from './LikesModal';
import { getImageUrl, getAvatarUrl, getVideoUrl } from '../../utils/imageUtils';
import { getMediaThumbnail, extractYouTubeId, createYouTubeEmbedUrl } from '../../utils/videoUtils';
import videoManager from '../../utils/videoManager';
import { lockBodyScroll, unlockBodyScroll } from '../../utils/scrollUtils';
import { API_URL } from '../../config';
import './PostModal.css';

const MAX_CAPTION_LENGTH_EDIT = 500;

const ModalMedia = memo(({ postData }) => {
  if (!postData) return null;

  // Используем существующие утилиты для определения YouTube-видео
  const urlsToCheck = [
    postData.videoUrl,
    postData.youtubeUrl,
    postData.youtubeData?.originalUrl,
    postData.video,
    postData.image,
    postData.imageUrl
  ];

  let youtubeEmbedUrl = null;
  let originalYouTubeUrl = null;

  for (let url of urlsToCheck) {
    if (url && (url.includes('youtube') || url.includes('youtu.be'))) {
      const videoId = extractYouTubeId(url);
      if (videoId) {
        youtubeEmbedUrl = createYouTubeEmbedUrl(url);
        originalYouTubeUrl = url;
        break;
      }
    }
  }

  // Если YouTube-видео не нашлось, но есть youtubeData
  if (!youtubeEmbedUrl && postData.youtubeData) {
    const videoId = extractYouTubeId(postData.youtubeData.originalUrl);
    if (videoId) {
      youtubeEmbedUrl = createYouTubeEmbedUrl(postData.youtubeData.originalUrl);
      originalYouTubeUrl = postData.youtubeData.originalUrl;
    }
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

  // Остальная логика без изменений
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