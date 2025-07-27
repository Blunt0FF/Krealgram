import { useEffect, useRef, useState } from 'react';
import { processMediaUrl } from '../utils/urlUtils';

const useVideoPreloader = (videoUrl, priority = 'low') => {
  const [isPreloaded, setIsPreloaded] = useState(false);
  const [error, setError] = useState(null);
  const videoRef = useRef(null);

  useEffect(() => {
    if (!videoUrl) return;

    const resolvedUrl = processMediaUrl(videoUrl, 'video');
    
    // Извлекаем имя файла из URL
    const getFileName = (url) => {
      try {
        const urlObj = new URL(url);
        const pathname = urlObj.pathname;
        const fileName = pathname.split('/').pop();
        return fileName || 'unknown';
      } catch {
        // Если не удается распарсить URL, берем последнюю часть
        const parts = url.split('/');
        return parts[parts.length - 1] || 'unknown';
      }
    };

    // Создаем скрытый video элемент для предзагрузки
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.preload = 'auto'; // Загружаем само видео
    video.muted = true;
    video.playsInline = true;

    const handleCanPlayThrough = () => {
      setIsPreloaded(true);
      const fileName = getFileName(resolvedUrl);
      console.log(`🎬 Hook video preloaded: ${fileName}`);
    };

    const handleError = (e) => {
      console.error('Video preload error:', e);
      setError(e);
    };

    video.addEventListener('canplaythrough', handleCanPlayThrough);
    video.addEventListener('error', handleError);

    video.src = resolvedUrl;
    videoRef.current = video;

    return () => {
      if (videoRef.current) {
        videoRef.current.removeEventListener('canplaythrough', handleCanPlayThrough);
        videoRef.current.removeEventListener('error', handleError);
        videoRef.current.src = '';
        videoRef.current.load();
      }
    };
  }, [videoUrl, priority]);

  return { isPreloaded, error };
};

export default useVideoPreloader; 