const { cloudinary } = require('../config/cloudinary');

// Функция для получения правильного URL медиа файла
const getMediaUrl = (imagePath, type = 'image') => {
  if (!imagePath) return null;
  
  // Если уже полный URL, возвращаем как есть
  if (imagePath.startsWith('http')) {
    return imagePath;
  }
  
  // Проверяем используется ли Cloudinary
  if (process.env.USE_CLOUDINARY === 'true' && cloudinary) {
    // Для Cloudinary извлекаем public_id из пути
    let publicId = imagePath;
    
    // Убираем расширение файла если есть
    publicId = publicId.replace(/\.[^/.]+$/, '');
    
    // Убираем префикс uploads/ если есть
    publicId = publicId.replace(/^uploads\//, '');
    
    // Для видео используем video resource type
    if (type === 'video') {
      return cloudinary.url(publicId, {
        resource_type: 'video',
        fetch_format: 'auto',
        quality: 'auto',
        flags: 'progressive',
        transformation: [
          { quality: 'auto:good', format: 'auto' }
        ]
      });
    }
    
    // Для изображений (включая GIF с анимацией)
    return cloudinary.url(publicId, {
      fetch_format: 'auto',
      quality: '100', // Максимальное качество
      flags: 'progressive,animated,immutable_cache,lossy', // Добавляем lossy для лучшего сжатия без потери FPS
      transformation: [
        { 
          quality: '100',
          format: 'auto' // Автоматический выбор лучшего формата
        }
      ]
    });
  }
  
  // Для локальной разработки используем статические файлы
  return `/uploads/${imagePath}`;
};

// Функция для получения URL превью видео
const getVideoThumbnailUrl = (imagePath) => {
  if (!imagePath) return null;
  
  // Если уже полный URL, возвращаем как есть
  if (imagePath.startsWith('http')) {
    return imagePath;
  }
  
  // Проверяем используется ли Cloudinary
  if (process.env.USE_CLOUDINARY === 'true' && cloudinary) {
    // Для Cloudinary извлекаем public_id из пути
    let publicId = imagePath;
    
    // Убираем расширение файла если есть
    publicId = publicId.replace(/\.[^/.]+$/, '');
    
    // Убираем префикс uploads/ если есть
    publicId = publicId.replace(/^uploads\//, '');
    
    // Пробуем несколько вариантов создания превью
    // Вариант 1: Если это видео файл, создаем превью
    try {
      return cloudinary.url(publicId, {
        resource_type: 'video',
        format: 'jpg',
        transformation: [
          { width: 600, height: 600, crop: 'fill', gravity: 'center', quality: 'auto' }
        ],
        flags: 'progressive'
      });
    } catch (error) {
      console.log('Failed to create video thumbnail, trying as image:', error);
      
      // Вариант 2: Если не получилось как видео, пробуем как изображение
      try {
        return cloudinary.url(publicId, {
          resource_type: 'image',
          format: 'jpg',
          transformation: [
            { width: 600, height: 600, crop: 'fill', gravity: 'center', quality: 'auto' }
          ],
          flags: 'progressive'
        });
      } catch (imageError) {
        console.log('Failed to create image thumbnail:', imageError);
        
        // Вариант 3: Возвращаем оригинальный файл
        return cloudinary.url(publicId, {
          resource_type: 'auto',
          fetch_format: 'auto',
          quality: 'auto'
        });
      }
    }
  }
  
  // Для локальной разработки используем статические файлы
  return `/uploads/${imagePath}`;
};

// Функция для получения мобильного превью (меньший размер, быстрая загрузка)
const getMobileThumbnailUrl = (imagePath) => {
  if (!imagePath) return null;
  
  // Если уже полный URL, возвращаем как есть
  if (imagePath.startsWith('http')) {
    return imagePath;
  }
  
  // Проверяем используется ли Cloudinary
  if (process.env.USE_CLOUDINARY === 'true' && cloudinary) {
    // Для Cloudinary извлекаем public_id из пути
    let publicId = imagePath;
    
    // Убираем расширение файла если есть
    publicId = publicId.replace(/\.[^/.]+$/, '');
    
    // Убираем префикс uploads/ если есть
    publicId = publicId.replace(/^uploads\//, '');
    
    // Создаем маленькое превью для мобильных
    return cloudinary.url(publicId, {
      resource_type: 'auto',
      format: 'webp',
      transformation: [
        { 
          width: 300, 
          height: 300, 
          crop: 'fill', 
          gravity: 'center',
          quality: 'auto:low',
          dpr: 'auto'
        }
      ],
      flags: 'progressive'
    });
  }
  
  // Для локальной разработки используем статические файлы
  return `/uploads/${imagePath}`;
};

// Функция для создания надежного превью с fallback вариантами
const getReliableThumbnailUrl = (imagePath) => {
  if (!imagePath) return null;
  
  // Если уже полный URL, возвращаем как есть
  if (imagePath.startsWith('http')) {
    return imagePath;
  }
  
  // Проверяем используется ли Cloudinary
  if (process.env.USE_CLOUDINARY === 'true' && cloudinary) {
    // Для Cloudinary извлекаем public_id из пути
    let publicId = imagePath;
    
    // Убираем расширение файла если есть
    publicId = publicId.replace(/\.[^/.]+$/, '');
    
    // Убираем префикс uploads/ если есть
    publicId = publicId.replace(/^uploads\//, '');
    
    console.log('🔍 Creating reliable thumbnail for:', publicId);
    
    // Создаем массив вариантов URL для попытки
    const thumbnailVariants = [
      // Вариант 1: Видео превью
      () => cloudinary.url(publicId, {
        resource_type: 'video',
        format: 'jpg',
        transformation: [
          { width: 400, height: 400, crop: 'fill', gravity: 'center', quality: 'auto' }
        ],
        flags: 'progressive'
      }),
      
      // Вариант 2: Изображение
      () => cloudinary.url(publicId, {
        resource_type: 'image',
        format: 'jpg',
        transformation: [
          { width: 400, height: 400, crop: 'fill', gravity: 'center', quality: 'auto' }
        ],
        flags: 'progressive'
      }),
      
      // Вариант 3: Авто определение типа
      () => cloudinary.url(publicId, {
        resource_type: 'auto',
        format: 'jpg',
        transformation: [
          { width: 400, height: 400, crop: 'fill', gravity: 'center', quality: 'auto' }
        ],
        flags: 'progressive'
      }),
      
      // Вариант 4: Оригинальный файл без трансформации
      () => cloudinary.url(publicId, {
        resource_type: 'auto',
        format: 'auto',
        quality: 'auto'
      }),
      
      // Вариант 5: Raw файл
      () => cloudinary.url(publicId, {
        resource_type: 'raw'
      })
    ];
    
    // Возвращаем первый вариант (в реальности можно добавить проверку доступности)
    try {
      const thumbnailUrl = thumbnailVariants[0]();
      console.log('✅ Generated thumbnail URL:', thumbnailUrl);
      return thumbnailUrl;
    } catch (error) {
      console.log('❌ Failed to generate thumbnail, trying fallback:', error);
      return thumbnailVariants[3](); // Возвращаем оригинальный файл
    }
  }
  
  // Для локальной разработки используем статические файлы
  return `/uploads/${imagePath}`;
};

module.exports = {
  getMediaUrl,
  getVideoThumbnailUrl,
  getMobileThumbnailUrl,
  getReliableThumbnailUrl
}; 

