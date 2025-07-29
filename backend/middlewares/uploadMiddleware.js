const multer = require('multer');
const path = require('path');
const fs = require('fs');
const fsPromises = require('fs').promises;
const { imageCompressor } = require('../utils/imageCompressor');
const googleDrive = require('../config/googleDrive');

const TEMP_INPUT_DIR = path.resolve(process.cwd(), 'temp/input');
const TEMP_OUTPUT_DIR = path.resolve(process.cwd(), 'temp/output');

// Создаем директории при загрузке модуля
const ensureTempDir = async (dirPath) => {
  try {
    await fsPromises.mkdir(dirPath, { recursive: true });
    console.log(`[UPLOAD_MIDDLEWARE] Created directory: ${dirPath}`);
  } catch (error) {
    console.error(`[UPLOAD_MIDDLEWARE] Error creating directory ${dirPath}:`, error);
  }
};

ensureTempDir(TEMP_INPUT_DIR);
ensureTempDir(TEMP_OUTPUT_DIR);

const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      await ensureTempDir(TEMP_INPUT_DIR);
      cb(null, TEMP_INPUT_DIR);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
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

  try {
    const tempFilePath = req.file.path;
    const originalFilename = req.file.originalname;
    const fileMimetype = req.file.mimetype;
    
    // Определяем контекст загрузки по URL
    let context = 'post';
    let folderId = process.env.GOOGLE_DRIVE_POSTS_FOLDER_ID;
    let username = null;

    // Проверяем URL для определения контекста
    const url = req.originalUrl || req.url;
    if (url && (url.includes('/profile/avatar') || url.includes('/users/profile/avatar') || (url.includes('/profile') && req.file && req.file.fieldname === 'avatar'))) {
      context = 'avatar';
      folderId = process.env.GOOGLE_DRIVE_AVATARS_FOLDER_ID;
      username = req.user?.username;
      console.log('[UPLOAD_CONTEXT] Определен контекст: аватар');
    } else if (url && url.includes('/conversations/') && url.includes('/messages')) {
      context = 'message';
      folderId = process.env.GOOGLE_DRIVE_MESSAGES_FOLDER_ID;
      console.log('[UPLOAD_CONTEXT] Определен контекст: сообщение');
    } else {
      console.log('[UPLOAD_CONTEXT] Определен контекст: пост');
    }

    console.log(`[UPLOAD_CONTEXT] URL: ${url}, Контекст: ${context}, Папка: ${folderId}`);

    // Сжимаем изображения перед загрузкой
    if (fileMimetype.startsWith('image/')) {
      console.log('[IMAGE_COMPRESSION] Сжимаем изображение потоковым методом');
      console.log(`[IMAGE_COMPRESSION] Исходный файл: ${originalFilename} (${req.file.size} байт)`);
      
      try {
        const compressedResult = await imageCompressor.compressImage(tempFilePath, originalFilename);
        
        console.log(`[IMAGE_COMPRESSION] ✅ Сжатие применено: ${compressedResult.buffer.length} байт`);
        
        // Создаем превью для изображений (только для постов и аватарок, НЕ для сообщений)
        let thumbnailUrl = null;
        if (context !== 'message') {
          try {
            const thumbnailBuffer = await imageCompressor.createThumbnail(tempFilePath);
            
            // Для аватарок превью идет в ту же папку с username
            let thumbnailFolderId = process.env.GOOGLE_DRIVE_PREVIEWS_FOLDER_ID;
            let thumbnailFilename = `thumb_${originalFilename}`;
            
            if (context === 'avatar' && username) {
              thumbnailFolderId = process.env.GOOGLE_DRIVE_AVATARS_FOLDER_ID;
              thumbnailFilename = `thumb_${username}${path.extname(originalFilename)}`;
              
              // Сначала удаляем старый thumbnail для аватарок
              try {
                await googleDrive.deleteAvatarThumbnail(username);
                console.log(`[UPLOAD_MIDDLEWARE] Старый thumbnail удален для ${username}`);
              } catch (deleteError) {
                console.log(`[UPLOAD_MIDDLEWARE] Старый thumbnail не найден для ${username}:`, deleteError.message);
              }
            }
            
            const thumbnailResult = await googleDrive.uploadFile(
              thumbnailBuffer, 
              thumbnailFilename, 
              'image/webp', 
              thumbnailFolderId
            );
            thumbnailUrl = thumbnailResult.secure_url;
          } catch (thumbnailError) {
            console.error('[THUMBNAIL_ERROR] Не удалось создать превью:', thumbnailError);
          }
        }

        // Загрузка сжатого файла на Google Drive
        let uploadFilename = originalFilename;
        if (context === 'avatar' && username) {
          uploadFilename = `avatar_${username}${path.extname(originalFilename)}`;
        }
        
        const result = await googleDrive.uploadFile(
          compressedResult.buffer, 
          uploadFilename, 
          fileMimetype, 
          folderId
        );

        req.uploadResult = {
          secure_url: result.secure_url,
          public_id: result.fileId,
          resource_type: fileMimetype.startsWith('video/') ? 'video' : 'image',
          format: path.extname(originalFilename).substring(1),
          bytes: compressedResult.buffer.length,
          url: result.secure_url,
          thumbnailUrl: thumbnailUrl
        };
        
        console.log(`[UPLOAD_RESULT] Размер загруженного файла: ${compressedResult.buffer.length} байт (${(compressedResult.buffer.length / (1024 * 1024)).toFixed(2)} MB)`);

        next();
        return;
      } catch (compressionError) {
        console.error('[IMAGE_COMPRESSION] Ошибка сжатия:', compressionError);
        // Продолжаем с оригинальным файлом
      }
    }

        // Для видео и изображений без сжатия
    if (fileMimetype.startsWith('video/')) {
      // Читаем файл
      const fileBuffer = await fsPromises.readFile(tempFilePath);

      // Для видео определяем правильную папку
      let videoFolderId = folderId;
      if (context === 'post') {
        videoFolderId = process.env.GOOGLE_DRIVE_VIDEOS_FOLDER_ID || process.env.GOOGLE_DRIVE_POSTS_FOLDER_ID;
      }

      // Загрузка файла на Google Drive
      let uploadFilename = originalFilename;
      if (context === 'avatar' && username) {
        uploadFilename = `avatar_${username}${path.extname(originalFilename)}`;
      }
      
      const result = await googleDrive.uploadFile(
        fileBuffer, 
        uploadFilename, 
        fileMimetype, 
        videoFolderId
      );

              // Создаем GIF превью для видео (только для постов)
        let thumbnailUrl = null;
        if (context === 'post') {
          try {
            const { generateGifThumbnail } = require('../services/videoDownloader');
            const gifResult = await generateGifThumbnail(tempFilePath);
            
            if (gifResult && gifResult.buffer) {
              const thumbnailResult = await googleDrive.uploadFile(
                gifResult.buffer, 
                `gif-preview-${originalFilename.replace(/\.[^/.]+$/, '.gif')}`, 
                'image/gif', 
                process.env.GOOGLE_DRIVE_GIFS_FOLDER_ID
              );
              thumbnailUrl = thumbnailResult.secure_url;
              
              // Удаляем временный GIF файл
              if (gifResult.path && fs.existsSync(gifResult.path)) {
                await fsPromises.unlink(gifResult.path);
              }
            }
          } catch (thumbnailError) {
            console.error('[VIDEO_THUMBNAIL_ERROR] Не удалось создать GIF превью:', thumbnailError);
          }
        }

      req.uploadResult = {
        secure_url: result.secure_url,
        public_id: result.fileId,
        resource_type: 'video',
        format: path.extname(originalFilename).substring(1),
        bytes: fileBuffer.length,
        url: result.secure_url,
        thumbnailUrl: thumbnailUrl
      };
      
      console.log(`[UPLOAD_RESULT] Размер загруженного файла: ${fileBuffer.length} байт (${(fileBuffer.length / (1024 * 1024)).toFixed(2)} MB)`);

      next();
    }
  } catch (error) {
    console.error('[UPLOAD_MIDDLEWARE] Ошибка загрузки:', error);

    const errorMessage = error.message || 'Unknown upload error';
    const userFriendlyError = new Error(`File upload failed: ${errorMessage}`);
    userFriendlyError.status = 400;
    next(userFriendlyError);
  }
};

module.exports = {
  upload,
  uploadToGoogleDrive,
}; 