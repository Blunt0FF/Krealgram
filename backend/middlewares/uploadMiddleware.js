const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const googleDrive = require('../config/googleDrive');
const { 
  optimizeForWeb, 
  generateVideoThumbnail, 
  generateGifThumbnail,  // Добавляем новую функцию
  TEMP_INPUT_DIR 
} = require('../utils/imageCompressor');

// Вспомогательная функция для загрузки ОБРАБОТАННОГО файла на Google Drive
const uploadProcessedToGoogleDrive = async (fileBuffer, finalFilename, fileMimetype, context, folderId) => {
  try {
    console.log(`[UPLOAD_BUFFER] Загружаем файл ${finalFilename} (${context}) на Google Drive...`);
    
    let thumbnailUrl = null;

    if (fileMimetype.startsWith('image/') && !fileMimetype.includes('gif')) {
      console.log(`[UPLOAD_BUFFER] Обрабатываем изображение для контекста: ${context}...`);
      try {
        const optimized = await optimizeForWeb(fileBuffer, finalFilename);
        
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
        finalFilename = optimized.original.info.filename;
        fileMimetype = `image/${optimized.original.info.outputFormat}`;
      } catch (compressionError) {
        console.error('[UPLOAD_BUFFER] ❌ Ошибка обработки изображения, используем оригинал:', compressionError.message);
      }
    } else if (fileMimetype.startsWith('video/')) {
        console.log('[UPLOAD_BUFFER] Обрабатываем видео для создания превью...');
        try {
            const thumbnail = await generateVideoThumbnail(fileBuffer);
            if (thumbnail) {
                console.log('[UPLOAD_BUFFER] Загружаем превью видео на Google Drive...');
                const thumbnailResult = await googleDrive.uploadFile(
                    thumbnail.buffer,
                    thumbnail.filename,
                    'image/jpeg',
                    process.env.GOOGLE_DRIVE_PREVIEWS_FOLDER_ID
                );
                thumbnailUrl = thumbnailResult.secure_url;
            }
        } catch (thumbError) {
            console.error('[UPLOAD_BUFFER] ❌ Не удалось создать превью для видео:', thumbError.message);
        }
    }

    const ext = path.extname(finalFilename);
    let driveFilename;

    if (context === 'avatar' && req.user && req.user.username) {
        // Очищаем имя пользователя для использования в имени файла
        const safeUsername = req.user.username.replace(/[^a-zA-Z0-9]/g, '_');
        driveFilename = `avatar_${safeUsername}${ext}`;
        console.log(`[UPLOAD_BUFFER] Сгенерировано имя файла для аватара: ${driveFilename}`);
    } else if (context === 'message') {
        // Для сообщений используем оригинальное имя файла
        driveFilename = finalFilename;
    } else {
        const timestamp = Date.now();
        const randomString = Math.random().toString(36).substring(2, 15);
        driveFilename = `${timestamp}_${randomString}${ext}`;
    }
    
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
      driveFilename,
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
      thumbnailUrl: thumbnailUrl
    };
    
    console.log(`[UPLOAD_BUFFER] ✅ Файл загружен в папку ${context}:`, uploadResult.secure_url);
    return uploadResult;

  } catch (error) {
    console.error(`[UPLOAD_BUFFER] ❌ Ошибка загрузки (${context}) на Google Drive:`, error);
    throw error;
  }
};

// Настройка multer для сохранения файлов на диск во временную папку
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, TEMP_INPUT_DIR); // Сохраняем во временную папку для обработки
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // Увеличим лимит до 100MB для больших фото с iPhone
  },
  fileFilter: (req, file, cb) => {
    // Расширяем список поддерживаемых типов для iPhone (HEIC, MOV)
    const allowedMimeTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif',
      'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'
    ];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type!'), false);
    }
  }
});

// Middleware для загрузки файлов на Google Drive, работающий с файлами
const uploadToGoogleDrive = async (req, res, next) => {
  if (!req.file) {
    return next();
  }

  const tempFilePath = req.file.path;

  try {
    let context = 'post';
    if (req.file.fieldname === 'avatar') context = 'avatar';
    else if (req.file.fieldname === 'media') context = 'message';

    let fileBuffer, finalFilename, fileMimetype, thumbnailUrl = null;
    
    // Определяем тип файла по mimetype
    const isImage = req.file.mimetype.startsWith('image/');
    const isVideo = req.file.mimetype.startsWith('video/');

    if (isImage && !req.file.mimetype.includes('gif')) {
      const optimized = await optimizeForWeb(tempFilePath, req.file.originalname);
      if (context === 'post' && optimized.thumbnail) {
        const thumbResult = await uploadProcessedToGoogleDrive(
          optimized.thumbnail.buffer, optimized.thumbnail.filename, 'image/webp', 
          'preview', process.env.GOOGLE_DRIVE_PREVIEWS_FOLDER_ID
        );
        thumbnailUrl = thumbResult.secure_url;
      }
      fileBuffer = optimized.original.buffer;
      finalFilename = optimized.original.info.filename;
      fileMimetype = `image/${optimized.original.info.format}`;
    } else if (isVideo) {
      let thumbnailData = null;
      let gifThumbnailData = null;

      try {
        thumbnailData = await generateVideoThumbnail(tempFilePath);
      } catch (thumbnailError) {
        console.error('[UPLOAD_MIDDLEWARE] Ошибка создания превью для видео:', thumbnailError);
      }

      if (thumbnailData && thumbnailData.buffer) {
        try {
          const thumbResult = await uploadProcessedToGoogleDrive(
            thumbnailData.buffer, 
            thumbnailData.filename, 
            'image/jpeg', 
            'video_preview', 
            process.env.GOOGLE_DRIVE_VIDEO_PREVIEWS_FOLDER_ID
          );
          thumbnailUrl = thumbResult.secure_url;
        } catch (uploadError) {
          console.error('[UPLOAD_MIDDLEWARE] Ошибка загрузки превью видео:', uploadError);
        }
      }

      // Создаем GIF-превью с расширенными настройками
      try {
        gifThumbnailData = await generateGifThumbnail(tempFilePath, {
          maxDuration: 10,  // Максимальная длительность 10 секунд
          maxFps: 10,       // Максимальный FPS
          maxScale: 480     // Максимальное разрешение
        });

        if (gifThumbnailData) {
          const gifBuffer = await fs.readFile(gifThumbnailData);
          const gifThumbResult = await uploadProcessedToGoogleDrive(
            gifBuffer, 
            path.basename(gifThumbnailData), 
            'image/gif', 
            'gif_preview', 
            process.env.GOOGLE_DRIVE_GIF_PREVIEWS_FOLDER_ID
          );
          
          // Сохраняем URL GIF-превью
          req.gifPreviewUrl = gifThumbResult.secure_url;
        }
      } catch (gifError) {
        console.error('Ошибка создания GIF превью:', gifError);
        // Не прерываем загрузку, если не удалось создать GIF
        req.gifPreviewUrl = null;
      }

      fileBuffer = await fs.readFile(tempFilePath);
      finalFilename = req.file.filename;
      fileMimetype = req.file.mimetype;
    } else { // для GIF и других файлов
      fileBuffer = await fs.readFile(tempFilePath);
      finalFilename = req.file.filename;
      fileMimetype = req.file.mimetype;
    }

    const ext = path.extname(finalFilename);
    let driveFilename;

    if (context === 'avatar' && req.user && req.user.username) {
        const safeUsername = req.user.username.replace(/[^a-zA-Z0-9]/g, '_');
        driveFilename = `avatar_${safeUsername}${ext}`;
    } else if (context === 'message') {
        // Для сообщений используем оригинальное имя файла
        driveFilename = finalFilename;
        console.log(`[UPLOAD_MIDDLEWARE] Файл сообщения: 
        Оригинальное имя: ${req.file.originalname}
        Финальное имя: ${finalFilename}
        Mime-тип: ${fileMimetype}`);
    } else {
        const timestamp = Date.now();
        const randomString = Math.random().toString(36).substring(2, 15);
        driveFilename = `${timestamp}_${randomString}${ext}`;
    }
    
    let folderId;
    switch (context) {
        case 'avatar': folderId = process.env.GOOGLE_DRIVE_AVATARS_FOLDER_ID; break;
        case 'message': folderId = process.env.GOOGLE_DRIVE_MESSAGES_FOLDER_ID; break;
        default: folderId = process.env.GOOGLE_DRIVE_POSTS_FOLDER_ID; break;
    }
    
    const result = await uploadProcessedToGoogleDrive(fileBuffer, driveFilename, fileMimetype, context, folderId);
    
    req.uploadResult = {
      secure_url: result.secure_url,
      public_id: result.fileId,
      resource_type: fileMimetype.startsWith('video/') ? 'video' : 'image',
      format: ext.substring(1),
      bytes: fileBuffer.length,
      url: result.secure_url,
      thumbnailUrl: thumbnailUrl,
      gifPreviewUrl: req.gifPreviewUrl || null // Добавляем URL GIF-превью
    };

    next();
  } catch (error) {
    console.error('[UPLOAD_MIDDLEWARE] ❌ Ошибка:', error);
    next(error);
  } finally {
    // Гарантированная очистка временного файла
    await fs.unlink(tempFilePath).catch(err => console.error(`Failed to cleanup temp file: ${tempFilePath}`, err));
  }
};

module.exports = {
  upload,
  uploadToGoogleDrive,
}; 