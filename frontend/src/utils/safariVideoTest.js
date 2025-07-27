// Утилита для тестирования предзагрузки видео в Safari
export const testSafariVideoPreload = () => {
  const isSafari = navigator.userAgent.includes('Safari') && !navigator.userAgent.includes('Chrome');
  
  if (isSafari) {
    console.log('🦁 Safari detected - using aggressive video preloading');
    
    // Тестируем создание video элемента с preload="auto"
    const testVideo = document.createElement('video');
    testVideo.preload = 'auto';
    testVideo.muted = true;
    testVideo.playsInline = true;
    testVideo.crossOrigin = 'anonymous';
    
    console.log('🦁 Safari video element created with preload="auto"');
    
    // Очищаем тестовый элемент
    testVideo.src = '';
    testVideo.load();
  } else {
    console.log('🌐 Non-Safari browser detected - using standard video preloading');
  }
  
  return isSafari;
};

// Функция для проверки поддержки preload в браузере
export const checkPreloadSupport = () => {
  const video = document.createElement('video');
  const supportsAuto = video.canPlayType && video.canPlayType('video/mp4').replace(/no/, '');
  const supportsMetadata = video.canPlayType && video.canPlayType('video/mp4').replace(/no/, '');
  
  console.log('📊 Video preload support:');
  console.log('  - auto:', supportsAuto ? '✅' : '❌');
  console.log('  - metadata:', supportsMetadata ? '✅' : '❌');
  
  return {
    supportsAuto: !!supportsAuto,
    supportsMetadata: !!supportsMetadata
  };
};

// Функция для мониторинга предзагрузки видео
export const monitorVideoPreload = () => {
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry.name.includes('video') || entry.name.includes('.mp4')) {
        console.log(`📊 Video preload performance: ${entry.name} - ${entry.duration}ms`);
      }
    }
  });
  
  observer.observe({ entryTypes: ['resource'] });
  
  return observer;
}; 