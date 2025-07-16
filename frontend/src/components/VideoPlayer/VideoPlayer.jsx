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

  const renderVideoContent = () => {
    if (videoData.platform === 'youtube' && videoData.embedUrl) {
      return (
        <iframe
          src={videoData.embedUrl}
          title="YouTube Video"
          width="100%"
          height="100%"
          frameBorder="0"
          allowFullScreen
        />
      );
    }
    
    return (
      <video 
        src={videoUrl} 
        controls 
        style={{ width: '100%', height: '100%' }}
      />
    );
  };

  return (
    <div className={`video-player-wrapper ${className}`} style={style} onClick={onClick} onDoubleClick={onDoubleClick}>
      {renderVideoContent()}
    </div>
  );
};

export default VideoPlayer; 