const multer = require('multer');
const path = require('path');
const googleDrive = require('../config/googleDrive');
const imageCompressor = require('../utils/imageCompressor');

// Настройка multer для временного хранения файлов в памяти
const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
  fileFilter: (req, file, cb) => {
    // Проверяем тип файла
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Поддерживаются только изображения и видео файлы!'), false);
    }
  }
});

// Middleware для загрузки файлов на Google Drive
const uploadToGoogleDrive = async (req, res, next) => {
  try {
    if (!req.file) {
      return next();
    }

    console.log('[UPLOAD] Загружаем файл на Google Drive...');
    
    let fileBuffer = req.file.buffer;
    let filename = req.file.originalname;
    let mimetype = req.file.mimetype;
    let thumbnailUrl = null;
    
    // Сжимаем изображения и создаем превью (не для видео)
    if (req.file.mimetype.startsWith('image/')) {
      console.log('[UPLOAD] Обрабатываем изображение и создаем превью...');
      
      try {
        const optimized = await imageCompressor.optimizeForWeb(req.file.buffer, req.file.originalname);
        
        // Загружаем превью
        if (optimized.thumbnail) {
          console.log('[UPLOAD] Загружаем превью на Google Drive...');
          const thumbnailResult = await googleDrive.uploadFile(
            optimized.thumbnail.buffer,
            optimized.thumbnail.filename,
            'image/webp',
            process.env.GOOGLE_DRIVE_PREVIEWS_FOLDER_ID
          );
          thumbnailUrl = thumbnailResult.secure_url;
          console.log('[UPLOAD] ✅ Превью загружено:', thumbnailUrl);
        }

        // Используем обработанное основное изображение
        fileBuffer = optimized.original.buffer;
        filename = optimized.original.info.filename;
        mimetype = `image/${optimized.original.info.outputFormat}`;
        
        req.compressionInfo = optimized.original.info;
        
      } catch (compressionError) {
        console.error('[UPLOAD] ❌ Ошибка обработки изображения, используем оригинал:', compressionError.message);
      }
    }
    
    // Генерируем уникальное имя файла для основного изображения
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const ext = path.extname(filename);
    const finalFilename = `${timestamp}_${randomString}${ext}`;

    let folderId = null;
    if (req.file.mimetype.startsWith('image/')) {
      if (req.file.mimetype === 'image/gif') {
        if (req.isPreviewGif) {
          folderId = process.env.GOOGLE_DRIVE_PREVIEWS_FOLDER_ID;
        } else {
          folderId = process.env.GOOGLE_DRIVE_GIFS_FOLDER_ID;
        }
      } else {
        folderId = process.env.GOOGLE_DRIVE_POSTS_FOLDER_ID;
      }
    } else if (req.file.mimetype.startsWith('video/')) {
      folderId = process.env.GOOGLE_DRIVE_VIDEOS_FOLDER_ID;
    } else if (req.file.mimetype.startsWith('application/')) {
      folderId = process.env.GOOGLE_DRIVE_MESSAGES_FOLDER_ID;
    }
    // Загружаем файл на Google Drive
    const result = await googleDrive.uploadFile(
      fileBuffer,
      finalFilename,
      mimetype,
      folderId
    );

    // Сохраняем результат в req для дальнейшего использования
    req.uploadResult = {
      secure_url: result.secure_url,
      public_id: result.fileId,
      resource_type: req.file.mimetype.startsWith('video/') ? 'video' : 'image',
      format: ext.substring(1),
      bytes: fileBuffer.length,
      url: result.secure_url,
      thumbnailUrl: thumbnailUrl, // Добавляем URL превью
      compressed: req.compressionInfo || null
    };

    console.log('[UPLOAD] ✅ Файл загружен на Google Drive:', result.secure_url);
    next();
  } catch (error) {
    console.error('[UPLOAD] ❌ Ошибка загрузки на Google Drive:', error);
    next(error);
  }
};

module.exports = {
  upload,
  uploadToGoogleDrive
}; 