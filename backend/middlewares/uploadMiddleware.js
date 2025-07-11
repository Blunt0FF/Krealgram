const multer = require('multer');
const path = require('path');
const googleDrive = require('../config/googleDrive');
const imageCompressor = require('../utils/imageCompressor');

// Вспомогательная функция для загрузки буфера на Google Drive
const uploadBufferToGoogleDrive = async (buffer, originalname, mimetype, context = 'post') => {
  try {
    console.log(`[UPLOAD_BUFFER] Загружаем файл ${originalname} (${context}) на Google Drive...`);
    
    let fileBuffer = buffer;
    let filename = originalname;
    let fileMimetype = mimetype;
    let thumbnailUrl = null;
    let compressionInfo = null;

    if (fileMimetype.startsWith('image/') && !fileMimetype.includes('gif')) {
      console.log(`[UPLOAD_BUFFER] Обрабатываем изображение для контекста: ${context}...`);
      try {
        const optimized = await imageCompressor.optimizeForWeb(buffer, originalname);
        
        // Для аватарок превью не нужно, сам аватар и есть превью.
        // Для постов — создаем и загружаем.
        if (context === 'post' && optimized.thumbnail) {
          console.log('[UPLOAD_BUFFER] Загружаем превью поста на Google Drive...');
          const thumbnailResult = await googleDrive.uploadFile(
            optimized.thumbnail.buffer,
            optimized.thumbnail.filename,
            'image/webp',
            process.env.GOOGLE_DRIVE_PREVIEWS_FOLDER_ID
          );
          thumbnailUrl = thumbnailResult.secure_url;
        }

        fileBuffer = optimized.original.buffer;
        filename = optimized.original.info.filename;
        fileMimetype = `image/${optimized.original.info.outputFormat}`;
        compressionInfo = optimized.original.info;
      } catch (compressionError) {
        console.error('[UPLOAD_BUFFER] ❌ Ошибка обработки изображения, используем оригинал:', compressionError.message);
      }
    }

    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const ext = path.extname(filename);
    const finalFilename = `${timestamp}_${randomString}${ext}`;
    
    let folderId;
    switch (context) {
        case 'avatar':
            folderId = process.env.GOOGLE_DRIVE_AVATARS_FOLDER_ID;
            break;
        case 'message':
            folderId = process.env.GOOGLE_DRIVE_MESSAGES_FOLDER_ID;
            break;
        case 'post':
        default:
            if (fileMimetype === 'image/gif') {
                folderId = process.env.GOOGLE_DRIVE_GIFS_FOLDER_ID;
            } else if (fileMimetype.startsWith('video/')) {
                folderId = process.env.GOOGLE_DRIVE_VIDEOS_FOLDER_ID;
            } else {
                folderId = process.env.GOOGLE_DRIVE_POSTS_FOLDER_ID;
            }
            break;
    }
    
    const result = await googleDrive.uploadFile(
      fileBuffer,
      finalFilename,
      fileMimetype,
      folderId
    );
    
    const uploadResult = {
      secure_url: result.secure_url,
      public_id: result.fileId,
      resource_type: fileMimetype.startsWith('video/') ? 'video' : 'image',
      format: ext.substring(1),
      bytes: fileBuffer.length,
      url: result.secure_url,
      thumbnailUrl: thumbnailUrl,
      compressed: compressionInfo
    };
    
    console.log(`[UPLOAD_BUFFER] ✅ Файл загружен в папку ${context}:`, uploadResult.secure_url);
    return uploadResult;

  } catch (error) {
    console.error(`[UPLOAD_BUFFER] ❌ Ошибка загрузки (${context}) на Google Drive:`, error);
    throw error;
  }
};


// Настройка multer для временного хранения файлов в памяти
const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
  fileFilter: (req, file, cb) => {
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

    let context = 'post'; // По умолчанию 'post'
    if (req.file.fieldname === 'avatar') {
        context = 'avatar';
    } else if (req.file.fieldname === 'media') {
        context = 'message';
    }

    req.uploadResult = await uploadBufferToGoogleDrive(req.file.buffer, req.file.originalname, req.file.mimetype, context);
    next();
  } catch (error) {
    console.error('[UPLOAD_MIDDLEWARE] ❌ Ошибка:', error);
    next(error);
  }
};

module.exports = {
  upload,
  uploadToGoogleDrive,
  uploadBufferToGoogleDrive
}; 