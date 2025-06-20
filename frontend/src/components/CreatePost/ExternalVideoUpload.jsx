import React, { useState } from 'react';
import { API_URL } from '../../config';
import './ExternalVideoUpload.css';

const ExternalVideoUpload = ({ onVideoSelect, onClose }) => {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [platform, setPlatform] = useState('');

  const supportedPlatforms = [
    { name: 'TikTok', icon: '🎵', example: 'https://www.tiktok.com/@username/video/...' },
    { name: 'Instagram', icon: '📷', example: 'https://www.instagram.com/p/...' },
    { name: 'VK', icon: '🎬', example: 'https://vk.com/video...' },
    { name: 'YouTube', icon: '▶️', example: 'https://www.youtube.com/watch?v=...' }
  ];

  const validateUrl = async (inputUrl) => {
    try {
      const response = await fetch(`${API_URL}/api/video-downloader/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: inputUrl })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('URL validation error:', error);
      if (error.message.includes('CORS')) {
        return { valid: false, error: 'Ошибка CORS - проверьте, что backend запущен' };
      }
      return { valid: false, error: `Ошибка валидации URL: ${error.message}` };
    }
  };

  const downloadVideo = async (inputUrl) => {
    try {
      const response = await fetch(`${API_URL}/api/video-downloader/download`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: inputUrl })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Video download error:', error);
      if (error.message.includes('CORS')) {
        return { success: false, error: 'Ошибка CORS - проверьте, что backend запущен и обновлен' };
      }
      return { success: false, error: `Ошибка загрузки видео: ${error.message}` };
    }
  };

  const handleUrlChange = async (e) => {
    const inputUrl = e.target.value;
    setUrl(inputUrl);
    setError('');
    setPlatform('');

    if (inputUrl.length > 10) {
      const validation = await validateUrl(inputUrl);
      if (validation.valid) {
        setPlatform(validation.platform);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setError('');

    try {
      // Сначала валидируем URL
      const validation = await validateUrl(url);
      if (!validation.valid) {
        setError('Неподдерживаемая платформа или неверный URL');
        setLoading(false);
        return;
      }

      // Загружаем видео
      const result = await downloadVideo(url);
      
      if (result.success) {
        // Создаем объект видео для передачи в родительский компонент
        const videoData = {
          type: result.type, // 'uploaded' или 'external'
          platform: result.platform,
          originalUrl: result.originalUrl,
          videoUrl: result.cloudinaryUrl || result.embedUrl,
          publicId: result.publicId,
          duration: result.duration,
          isExternal: result.type === 'external'
        };

        onVideoSelect(videoData);
        onClose();
      } else {
        // Показываем более детальную ошибку
        let errorMessage = result.error || 'Не удалось загрузить видео';
        if (result.fallback) {
          errorMessage += `\n\n💡 Совет: ${result.fallback}`;
        }
        setError(errorMessage);
      }
    } catch (error) {
      console.error('Submit error:', error);
      setError('Произошла ошибка при обработке видео');
    } finally {
      setLoading(false);
    }
  };

  const getPlatformIcon = (platformName) => {
    const platformData = supportedPlatforms.find(p => 
      p.name.toLowerCase() === platformName.toLowerCase()
    );
    return platformData ? platformData.icon : '🎬';
  };

  return (
    <div className="external-video-upload">
      <div className="external-video-modal">
        <div className="modal-header">
          <h3>Загрузить видео с платформы</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="modal-content">
          <div className="supported-platforms">
            <h4>Поддерживаемые платформы:</h4>
            <div className="platforms-list">
              {supportedPlatforms.map((platform, index) => (
                <div key={index} className="platform-item">
                  <span className="platform-icon">{platform.icon}</span>
                  <div className="platform-info">
                    <span className="platform-name">{platform.name}</span>
                    <span className="platform-example">{platform.example}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="url-form">
            <div className="input-group">
              <input
                type="url"
                value={url}
                onChange={handleUrlChange}
                placeholder="Вставьте ссылку на видео (TikTok, Instagram, VK, YouTube)..."
                className="url-input"
                disabled={loading}
              />
              {platform && (
                <div className="detected-platform">
                  <span className="platform-icon">{getPlatformIcon(platform)}</span>
                  <span>✅ Обнаружено: {platform.toUpperCase()}</span>
                </div>
              )}
            </div>

            {error && (
              <div className="error-message">
                {error}
              </div>
            )}

            <div className="form-actions">
              <button
                type="button"
                onClick={onClose}
                className="cancel-btn"
                disabled={loading}
              >
                Отмена
              </button>
              <button
                type="submit"
                className="submit-btn"
                disabled={loading || !url.trim()}
              >
                {loading ? (
                  <>
                    <div className="loading-spinner"></div>
                    Загружаем...
                  </>
                ) : (
                  'Загрузить видео'
                )}
              </button>
            </div>
          </form>

          <div className="info-note">
            <p><strong>Примечание:</strong></p>
            <ul>
              <li>YouTube видео будут встроены как iframe</li>
              <li>TikTok, Instagram, VK видео будут загружены на сервер</li>
              <li>Загрузка может занять несколько секунд</li>
              <li>Убедитесь, что видео публично доступно</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExternalVideoUpload; 