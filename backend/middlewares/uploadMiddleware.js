const multer = require('multer');
const path = require('path');
const fs = require('fs');
const fsPromises = require('fs').promises;
const googleDrive = require('../config/googleDrive');
const UniversalThumbnailGenerator = require('../utils/universalThumbnailGenerator');
const thumbnailGenerator = new UniversalThumbnailGenerator();
const imageCompressor = require('../utils/imageCompressor').ImageCompressor;
const imageCompressorInstance = new imageCompressor();

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

// Специальная обработка для создания и загрузки превью
const createAndUploadThumbnail = async (fileBuffer, originalFilename, fileMimetype, context) => {
  // Не создаем превью для сообщений
  if (context === 'message') {
    return null;
  }

  try {
    let thumbnailUrl = null;
    let thumbnailBuffer = null;

    const tempInputPath = path.join(TEMP_INPUT_DIR, `temp-${Date.now()}-${originalFilename}`);
    
    // Сохраняем буфер во временный файл
    await fsPromises.writeFile(tempInputPath, fileBuffer);

    if (fileMimetype.startsWith('image/') && !fileMimetype.includes('gif')) {
      const optimized = await imageCompressorInstance.optimizeForWebFromBuffer(fileBuffer, originalFilename);
      if (optimized.thumbnail) {
        thumbnailBuffer = optimized.thumbnail.buffer;
        thumbnailUrl = await uploadThumbnailToDrive(
          thumbnailBuffer, 
          optimized.thumbnail.filename,
          'image/webp'
        );
      }
    } else if (fileMimetype.startsWith('video/')) {
      const thumbnail = await imageCompressorInstance.generateVideoThumbnailFromBuffer(fileBuffer);
      if (thumbnail) {
        thumbnailBuffer = thumbnail.buffer;
        thumbnailUrl = await uploadThumbnailToDrive(
          thumbnailBuffer, 
          thumbnail.filename,
          'image/jpeg'
        );
      }
    }

    // Удаляем временный файл
    await fsPromises.unlink(tempInputPath).catch(err => {
      if (err.code !== 'ENOENT') {
        console.error(`Failed to clean up temp file: ${tempInputPath}`, err);
      }
    });

    return thumbnailUrl;
  } catch (error) {
    console.error('[THUMBNAIL_UPLOAD] Ошибка создания превью:', error);
    return null;
  }
};

// Функция для загрузки превью в папку превью
const uploadThumbnailToDrive = async (thumbnailBuffer, filename, mimetype) => {
  try {
    console.log('[THUMBNAIL_UPLOAD] Загрузка превью:', {
      filename,
      mimetype,
      previewFolderId: process.env.GOOGLE_DRIVE_PREVIEWS_FOLDER_ID,
      bufferLength: thumbnailBuffer.length
    });

    const result = await googleDrive.uploadFile(
      thumbnailBuffer,
      filename,
      mimetype,
      process.env.GOOGLE_DRIVE_PREVIEWS_FOLDER_ID // Всегда используем папку превью
    );
    
    console.log('[THUMBNAIL_UPLOAD] Превью загружено:', {
      secureUrl: result.secure_url,
      fileId: result.fileId
    });
    return result.secure_url;
  } catch (error) {
    console.error('[THUMBNAIL_UPLOAD] Ошибка загрузки превью:', {
      error: error.message,
      stack: error.stack,
      previewFolderId: process.env.GOOGLE_DRIVE_PREVIEWS_FOLDER_ID
    });
    return null;
  }
};

// Модифицируем uploadProcessedToGoogleDrive
const uploadProcessedToGoogleDrive = async (fileBuffer, finalFilename, fileMimetype, context, folderId, username = null, originalRequest = null) => {
  try {
    console.log(`[UPLOAD_BUFFER] Загружаем файл ${finalFilename} (${context}) на Google Drive...`);
    
    // ВСЕГДА создаем и загружаем превью
    const thumbnailUrl = await createAndUploadThumbnail(
      fileBuffer, 
      finalFilename, 
      fileMimetype, 
      context
    );

    // Выбираем папку в зависимости от типа файла
    let targetFolderId = folderId;
    if (fileMimetype.startsWith('video/')) {
      targetFolderId = process.env.GOOGLE_DRIVE_VIDEOS_FOLDER_ID || folderId;
    }
    
    const result = await googleDrive.uploadFile(
      fileBuffer,
      finalFilename,
      fileMimetype,
      targetFolderId
    );
    
    const uploadResult = {
      secure_url: result.secure_url,
      public_id: result.fileId,
      resource_type: fileMimetype.startsWith('video/') ? 'video' : 'image',
      format: path.extname(finalFilename).substring(1),
      bytes: fileBuffer.length,
      url: result.secure_url,
      thumbnailUrl: thumbnailUrl // Добавляем URL превью
    };
    
    console.log(`[UPLOAD_BUFFER] ✅ Файл загружен в папку ${targetFolderId}:`, uploadResult.secure_url);
    return uploadResult;

  } catch (error) {
    console.error(`[UPLOAD_BUFFER] ❌ Ошибка загрузки (${context}) на Google Drive:`, error);
    throw error;
  }
};

// Настройка multer для сохранения файлов на диск во временную папку
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    console.log('[MULTER_DEBUG] File received:', {
      originalname: file.originalname,
      mimetype: file.mimetype,
      fieldname: file.fieldname,
      tempInputDir: TEMP_INPUT_DIR
    });

    cb(null, TEMP_INPUT_DIR);
  },
  filename: (req, file, cb) => {
    console.log('[MULTER_DEBUG] Generating filename for:', file.originalname);

    if (!file || !file.originalname) {
      console.error('[MULTER_ERROR] Invalid file object');
      return cb(new Error('Invalid file upload'), null);
    }

    // Для аватаров используем специальный формат имени
    if (
      req.url.includes('/avatar') || 
      req.url.includes('/profile') || 
      req.body.avatar || 
      req.body.removeAvatar
    ) {
      const username = req.user?.username || 'unknown';
      const safeUsername = username.replace(/[^a-zA-Z0-9]/g, '_');
      const fileExtension = path.extname(file.originalname);
      const avatarFilename = `avatar_${safeUsername}${fileExtension}`;
      
      console.log('[MULTER_DEBUG] Generated avatar filename:', avatarFilename);
      return cb(null, avatarFilename);
    }

    // Для всех остальных файлов используем оригинальное имя
    console.log('[MULTER_DEBUG] Generated filename:', file.originalname);
    cb(null, file.originalname);
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
    const fileBuffer = await fsPromises.readFile(tempFilePath);
    const originalFilename = req.file.originalname;
    const fileMimetype = req.file.mimetype;

    let context = 'post';
    let folderId = process.env.GOOGLE_DRIVE_POSTS_FOLDER_ID;
    let username = null;

    // Определяем контекст загрузки
    if (
      req.url.includes('/avatar') || 
      req.url.includes('/profile') || 
      req.body.avatar || 
      req.body.removeAvatar
    ) {
      context = 'avatar';
      folderId = process.env.GOOGLE_DRIVE_AVATARS_FOLDER_ID;
      username = req.user ? req.user.username : null;
    } else if (
      req.url.includes('/messages') || 
      req.url.includes('/conversations') || 
      req.body.message
    ) {
      context = 'message';
      folderId = process.env.GOOGLE_DRIVE_MESSAGES_FOLDER_ID;
    }

    // Создаем имя файла
    const ext = path.extname(originalFilename);
    const safeUsername = username ? username.replace(/[^a-zA-Z0-9]/g, '_') : 'unknown';
    const driveFilename = context === 'avatar' 
      ? `avatar_${safeUsername}${ext}` 
      : originalFilename;

    // Загрузка файла
    const result = await googleDrive.uploadFile(
      fileBuffer, 
      driveFilename, 
      fileMimetype, 
      folderId
    );

    // Создаем превью только для постов
    const thumbnailUrl = await createAndUploadThumbnail(
      fileBuffer, 
      originalFilename, 
      fileMimetype, 
      context
    );

    req.uploadResult = {
      secure_url: result.secure_url,
      public_id: result.fileId,
      resource_type: fileMimetype.startsWith('video/') ? 'video' : 'image',
      format: ext.substring(1),
      bytes: fileBuffer.length,
      url: result.secure_url,
      thumbnailUrl: thumbnailUrl
    };

    // Удаляем временный файл
    await fsPromises.unlink(tempFilePath);

    next();
  } catch (error) {
    console.error('[UPLOAD_MIDDLEWARE] Ошибка загрузки:', error);
    next(error);
  }
};

module.exports = {
  upload,
  uploadToGoogleDrive,
}; 