import React from 'react';
import './VideoPlayer.css';

const VideoPlayer = ({ 
  src, 
  poster, 
  autoplay = false, 
  controls = true, 
  muted = false, 
  loop = false,
  className = '',
  style = {},
  onClick,
  onDoubleClick
}) => {
  if (!src) return null;

  return (
    <div className={`video-player-wrapper ${className}`} style={style} onClick={onClick} onDoubleClick={onDoubleClick}>
      <video
        src={src}
        poster={poster}
        autoPlay={autoplay}
        controls={controls}
        muted={muted}
        loop={loop}
        playsInline
        preload="metadata"
        className="video-element"
      >
        Your browser does not support the video tag.
      </video>
    </div>
  );
};

export default VideoPlayer; 