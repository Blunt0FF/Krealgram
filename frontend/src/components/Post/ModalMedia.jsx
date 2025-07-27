import React, { useState, useEffect, useRef, useMemo, memo } from 'react';
import { Link } from 'react-router-dom';
import ShareModal from './ShareModal';
import EditPostModal from './EditPostModal';
import LikesModal from './LikesModal';
import { getImageUrl, getAvatarUrl, getVideoUrl, getAvatarThumbnailUrl } from '../../utils/imageUtils';
import { getMediaThumbnail, extractYouTubeId, createYouTubeEmbedUrl } from '../../utils/videoUtils';
import videoManager from '../../utils/videoManager';
import { lockBodyScroll, unlockBodyScroll } from '../../utils/scrollUtils';
import { API_URL } from '../../config';
import './PostModal.css';

const MAX_CAPTION_LENGTH_EDIT = 500;

const ModalMedia = memo(({ postData, onLoad, onError }) => {
  if (!postData) return null;

  // Расширенная функция извлечения YouTube ID
  const extractYouTubeId = (url) => {
    if (!url) return null;
    
    // Стандартный YouTube URL
    const standardMatch = url.match(/[?&]v=([^&]+)/);
    if (standardMatch) return standardMatch[1];
    
    // Короткий YouTube URL
    const shortMatch = url.match(/youtu\.be\/([^?&]+)/);
    if (shortMatch) return shortMatch[1];
    
    // Из миниатюры
    const thumbnailMatch = url.match(/\/vi\/([^/]+)/);
    if (thumbnailMatch) return thumbnailMatch[1];
    
    return null;
  };

  // Список источников для поиска YouTube-ссылки
  const urlsToCheck = [
    postData.videoUrl,
    postData.youtubeUrl,
    postData.youtubeData?.originalUrl,
    postData.video,
    postData.image,
    postData.imageUrl
  ];

  // Пытаемся найти YouTube ID
  const videoId = urlsToCheck.reduce((foundId, url) => {
    return foundId || extractYouTubeId(url);
  }, null) || 
  (postData.image?.includes('img.youtube.com/vi/') && 
    postData.image.match(/\/vi\/([^/]+)/)?.[1]);

  // Если ID найден, восстанавливаем полную ссылку
  let youtubeEmbedUrl = null;
  let originalYouTubeUrl = null;

  if (videoId) {
    originalYouTubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
    youtubeEmbedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=0&enablejsapi=1`;
  }

  // Fallback к youtubeData, если основной метод не сработал
  if (!youtubeEmbedUrl && postData.youtubeData) {
    originalYouTubeUrl = postData.youtubeData.originalUrl;
    youtubeEmbedUrl = postData.youtubeData.embedUrl;
  }

  if (youtubeEmbedUrl) {
    return (
      <iframe
        key={youtubeEmbedUrl}
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
          width: '100%',
          maxWidth: '100%',
          height: '100%',
          maxHeight: '100%',
          aspectRatio: '16/9',
          display: 'block',
          backgroundColor: '#000'
        }}
        onLoad={onLoad}
        onError={onError}
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
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    return (
      <video
        src={getVideoUrl(postData.image || postData.imageUrl)}
        className="post-modal-video"
        controls
        autoPlay={true}
        playsInline
        webkit-playsinline="true"
        x5-playsinline="true"
        x5-video-player-type="h5"
        x5-video-player-fullscreen="true"
        x5-video-orientation="portrait"
        muted={isMobile ? true : false} // На мобильных сначала без звука для быстрой загрузки
        preload={isMobile ? "metadata" : "auto"} // На мобильных загружаем только метаданные
        poster={isMobile ? posterUrl : (!isDesktop ? posterUrl : undefined)}
        style={{
          width: '100%',
          height: 'auto',
          maxHeight: isDesktop ? 'calc(100vh - 120px)' : '900px',
          backgroundColor: '#000',
          objectFit: 'contain',
          display: 'block'
        }}
        onLoad={onLoad}
        onLoadedData={(e) => {
          // Извлекаем имя файла для логирования
          const getFileName = (url) => {
            try {
              const urlObj = new URL(url);
              const pathname = urlObj.pathname;
              const fileName = pathname.split('/').pop();
              return fileName || 'unknown';
            } catch {
              const parts = url.split('/');
              return parts[parts.length - 1] || 'unknown';
            }
          };
          const fileName = getFileName(e.target.src);
          console.log(`🎬 ModalMedia loaded: ${fileName}`);
          onLoad();
        }}
        onError={onError}
        onPlay={(e) => {
          videoManager.setCurrentVideo(e.target);
          // На мобильных включаем звук после начала воспроизведения
          if (isMobile && e.target.muted) {
            e.target.muted = false;
          }
        }}
        onPause={(e) => {
          if (videoManager.getCurrentVideo() === e.target) {
            videoManager.pauseCurrentVideo();
          }
        }}
        onCanPlay={() => {
          // На мобильных начинаем воспроизведение как только видео готово
          if (isMobile) {
            const video = document.querySelector('.post-modal-video');
            if (video && video.paused) {
              video.play().catch(err => console.log('Auto-play failed:', err));
            }
          }
        }}

      />
    );
  }

  return (
    <img
      src={getImageUrl(postData.image || postData.imageUrl)}
      alt="Post"
      className="post-modal-image"
      onLoad={onLoad}
      onError={(e) => {
        e.target.style.display = 'none';
        onError && onError();
      }}
    />
  );
});

export default ModalMedia;