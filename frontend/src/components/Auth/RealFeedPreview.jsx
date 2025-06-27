import React from 'react';
import './RealFeedPreview.css';

const RealFeedPreview = () => {
  return (
    <div className="real-feed-preview">
      <div className="real-phone-frame">
        <div className="real-phone-screen">
          {/* Status Bar */}
          <div className="real-status-bar">
            <div className="real-time">9:41</div>
            <div className="real-status-icons">
              <div className="real-signal">📶</div>
              <div className="real-wifi">📶</div>
              <div className="real-battery">100%</div>
            </div>
          </div>

          {/* Header */}
          <div className="real-header">
            <div className="real-logo">Krealgram</div>
            <div className="real-header-icons">
              <div className="real-heart">❤️</div>
              <div className="real-messenger">💬</div>
            </div>
          </div>

          {/* Latest Videos */}
          <div className="real-latest-videos">
            <div className="real-section-title">Latest Videos</div>
            <div className="real-videos-list">
              <div className="real-video-item">
                <div className="real-video-avatar">
                  <img src="/default-avatar.png" alt="kreal" />
                  <div className="real-video-count">10</div>
                </div>
                <div className="real-video-name">kreal</div>
              </div>
              <div className="real-video-item">
                <div className="real-video-avatar">
                  <img src="/default-avatar.png" alt="9STAR9B" />
                  <div className="real-video-count">2</div>
                </div>
                <div className="real-video-name">9STAR9B...</div>
              </div>
              <div className="real-video-item">
                <div className="real-video-avatar">
                  <img src="/default-avatar.png" alt="Rich" />
                  <div className="real-video-count">2</div>
                </div>
                <div className="real-video-name">Rich</div>
              </div>
            </div>
          </div>

          {/* Main Feed Content */}
          <div className="real-feed-content">
            {/* Post Header */}
            <div className="real-post-header">
              <div className="real-post-avatar">
                <img src="/default-avatar.png" alt="Rich" />
              </div>
              <div className="real-post-info">
                <div className="real-post-username">Rich</div>
                <div className="real-post-time">2h ago</div>
              </div>
              <div className="real-post-menu">⋯</div>
            </div>

            {/* Post Text */}
            <div className="real-post-text">
              Beautiful forest path 🌲
            </div>

            {/* Post Image */}
            <div className="real-post-image">
              <img src="/video-placeholder.png" alt="Forest path" />
              <div className="real-play-overlay">
                <div className="real-play-button">▶</div>
              </div>
            </div>

            {/* Post Actions */}
            <div className="real-post-actions">
              <div className="real-action-icons">
                <div className="real-like">❤️</div>
                <div className="real-comment">💬</div>
                <div className="real-share">📤</div>
              </div>
              <div className="real-bookmark">🔖</div>
            </div>

            {/* Post Stats */}
            <div className="real-post-stats">
              <div className="real-likes">42 likes</div>
              <div className="real-view-comments">View all 8 comments</div>
            </div>
          </div>

          {/* Bottom Navigation */}
          <div className="real-bottom-nav">
            <div className="real-nav-item active">
              <div className="real-nav-icon">🏠</div>
              <div className="real-nav-label">Home</div>
            </div>
            <div className="real-nav-item">
              <div className="real-nav-icon">🔍</div>
              <div className="real-nav-label">Search</div>
            </div>
            <div className="real-nav-item">
              <div className="real-nav-icon">➕</div>
              <div className="real-nav-label">Create</div>
            </div>
            <div className="real-nav-item">
              <div className="real-nav-icon">💬</div>
              <div className="real-nav-label">Messages</div>
            </div>
            <div className="real-nav-item">
              <div className="real-nav-icon">🔔</div>
              <div className="real-nav-label">Notifications</div>
              <div className="real-notification-badge">9</div>
            </div>
            <div className="real-nav-item">
              <div className="real-nav-icon">👤</div>
              <div className="real-nav-label">Profile</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RealFeedPreview; 