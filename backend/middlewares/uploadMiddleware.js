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
const sharp = require('sharp'); // Добавляем sharp для обработки HEIC/HEIF

// Вспомогательная функция для загрузки ОБРАБОТАННОГО файла на Google Drive
const uploadProcessedToGoogleDrive = async (fileBuffer, finalFilename, fileMimetype, context, folderId, username = null, originalRequest = null) => {
  try {
    console.log(`[UPLOAD_BUFFER] Загружаем файл ${finalFilename} (${context}) на Google Drive...`);
    
    let thumbnailUrl = null;

    // Специальная обработка для GIF - сохраняем оригинальный файл
    if (fileMimetype.includes('gif')) {
      console.log('[UPLOAD_BUFFER] Обнаружен GIF, сохраняем оригинальный файл без изменений');
      return await googleDrive.uploadFile(
        fileBuffer,
        finalFilename,
        fileMimetype,
        folderId
      );
    } else if (fileMimetype.startsWith('image/') && !fileMimetype.includes('gif')) {
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
        finalFilename = originalRequest ? originalRequest.originalname : finalFilename;
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

    if (context === 'avatar' && username) {
        // Очищаем имя пользователя для использования в имени файла
        const safeUsername = username.replace(/[^a-zA-Z0-9]/g, '_');
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
    
    let uploadFolderId;
    switch (context) {
        case 'avatar':
            uploadFolderId = process.env.GOOGLE_DRIVE_AVATARS_FOLDER_ID;
            break;
        case 'message':
            uploadFolderId = process.env.GOOGLE_DRIVE_MESSAGES_FOLDER_ID;
            break;
        case 'preview':
            uploadFolderId = process.env.GOOGLE_DRIVE_PREVIEWS_FOLDER_ID;
            break;
        case 'post':
        default:
            if (fileMimetype === 'image/gif') {
                uploadFolderId = process.env.GOOGLE_DRIVE_GIFS_FOLDER_ID;
            } else if (fileMimetype.startsWith('video/')) {
                uploadFolderId = process.env.GOOGLE_DRIVE_VIDEOS_FOLDER_ID;
            } else {
                uploadFolderId = process.env.GOOGLE_DRIVE_POSTS_FOLDER_ID;
            }
            break;
    }
    
    const result = await googleDrive.uploadFile(
      fileBuffer,
      driveFilename,
      fileMimetype,
      uploadFolderId
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
  const MAX_GIF_SIZE = 1 * 1024 * 1024;     // 1 МБ
  const MAX_IMAGE_SIZE = 10 * 1024 * 1024;  // 10 МБ

  try {
    let context = 'post';
    if (req.file.fieldname === 'avatar') context = 'avatar';
    else if (req.file.fieldname === 'message') context = 'message';

    let fileBuffer, finalFilename, fileMimetype, thumbnailUrl = null;
    let folderId = process.env.GOOGLE_DRIVE_POSTS_FOLDER_ID; // Устанавливаем дефолтную папку
    
    // Специальная обработка HEIC/HEIF
    const heicMimeTypes = [
      'image/heic', 
      'image/heif', 
      'image/x-heic', 
      'image/x-heif'
    ];

    if (heicMimeTypes.includes(req.file.mimetype)) {
      console.log(`[UPLOAD_MIDDLEWARE] Обнаружен HEIC/HEIF файл, конвертируем в JPEG`);
      const pipeline = sharp(tempFilePath)
        .toFormat('jpeg', { quality: 80 });
      
      const info = await pipeline.toFile(`${tempFilePath}.jpg`);
      
      fileBuffer = await fs.readFile(`${tempFilePath}.jpg`);
      finalFilename = `${path.basename(req.file.originalname, path.extname(req.file.originalname))}.jpg`;
      fileMimetype = 'image/jpeg';
      
      // Удаляем временный конвертированный файл
      await fs.unlink(`${tempFilePath}.jpg`).catch(console.error);
    } else if (req.file.mimetype === 'image/gif') {
      const fileStats = await fs.stat(tempFilePath);
      
      console.log(`[UPLOAD_MIDDLEWARE] GIF размером ${fileStats.size} байт`);

      // Для GIF всегда сохраняем оригинальный файл
      fileBuffer = await fs.readFile(tempFilePath);
      finalFilename = req.file.originalname; // Сохраняем оригинальное имя файла
      fileMimetype = req.file.mimetype; // Сохраняем оригинальный MIME-тип
      
      // Определяем папку в зависимости от контекста
      if (context === 'avatar') {
        folderId = process.env.GOOGLE_DRIVE_AVATARS_FOLDER_ID;
      } else if (context === 'post') {
        folderId = process.env.GOOGLE_DRIVE_GIFS_FOLDER_ID;
      }
    } else if (req.file.mimetype.startsWith('image/') && req.file.mimetype !== 'image/gif') {
      const fileStats = await fs.stat(tempFilePath);
      
      if (fileStats.size <= MAX_IMAGE_SIZE) {
        console.log(`[UPLOAD_MIDDLEWARE] Изображение размером ${fileStats.size} байт (< 10 МБ), применяем стандартное сжатие`);
        const optimized = await optimizeForWeb(tempFilePath, req.file.originalname);
        
        if (context === 'post' && optimized.thumbnail) {
          const thumbResult = await uploadProcessedToGoogleDrive(
            optimized.thumbnail.buffer, 
            optimized.thumbnail.filename, 
            'image/webp', 
            'preview', 
            process.env.GOOGLE_DRIVE_PREVIEWS_FOLDER_ID, 
            req.user ? req.user.username : null,
            req.file
          );
          thumbnailUrl = thumbResult.secure_url;
        }
        
        fileBuffer = optimized.original.buffer;
        finalFilename = req.file.originalname; // Сохраняем оригинальное имя файла
        fileMimetype = `image/${optimized.original.info.format}`;
      } else {
        console.log(`[UPLOAD_MIDDLEWARE] Изображение размером ${fileStats.size} байт (> 10 МБ), применяем принудительное сжатие`);
        const optimized = await optimizeForWeb(tempFilePath, req.file.originalname);
        
        if (context === 'post' && optimized.thumbnail) {
          const thumbResult = await uploadProcessedToGoogleDrive(
            optimized.thumbnail.buffer, 
            optimized.thumbnail.filename, 
            'image/webp', 
            'preview', 
            process.env.GOOGLE_DRIVE_PREVIEWS_FOLDER_ID, 
            req.user ? req.user.username : null,
            req.file
          );
          thumbnailUrl = thumbResult.secure_url;
        }
        
        fileBuffer = optimized.original.buffer;
        finalFilename = req.file.originalname; // Сохраняем оригинальное имя файла
        fileMimetype = `image/${optimized.original.info.format}`;
      }
    } else if (req.file.mimetype.startsWith('video/')) {
      fileBuffer = await fs.readFile(tempFilePath);
      finalFilename = req.file.originalname; // Сохраняем оригинальное имя файла
      fileMimetype = req.file.mimetype;
      folderId = process.env.GOOGLE_DRIVE_VIDEOS_FOLDER_ID;
    } else {
      fileBuffer = await fs.readFile(tempFilePath);
      finalFilename = req.file.originalname; // Сохраняем оригинальное имя файла
      fileMimetype = req.file.mimetype;
    }

    const result = await uploadProcessedToGoogleDrive(
      fileBuffer, 
      finalFilename, 
      fileMimetype, 
      context, 
      folderId, 
      req.user ? req.user.username : null,
      req.file
    );
    
    req.uploadResult = result;

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