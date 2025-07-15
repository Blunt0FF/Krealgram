const multer = require('multer');
const path = require('path');
const fs = require('fs');
const googleDrive = require('../config/googleDrive');
const ImageCompressor = require('../utils/imageCompressor');
const imageCompressor = new ImageCompressor();

const TEMP_INPUT_DIR = path.resolve(process.cwd(), 'temp/input');
const TEMP_OUTPUT_DIR = path.resolve(process.cwd(), 'temp/output');

// Безопасное создание директории
const ensureTempDir = (dirPath) => {
  if (!dirPath) {
    console.error('[UPLOAD_MIDDLEWARE] Temporary directory is undefined');
    throw new Error('Temporary directory is not defined');
  }
  
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      console.log(`[UPLOAD_MIDDLEWARE] Created directory: ${dirPath}`);
    }
  } catch (error) {
    console.error(`[UPLOAD_MIDDLEWARE] Error creating directory ${dirPath}:`, error);
    throw error;
  }
};

// Создаем директории при загрузке модуля
ensureTempDir(TEMP_INPUT_DIR);
ensureTempDir(TEMP_OUTPUT_DIR);

// Специальная обработка для создания и загрузки превью
const createAndUploadThumbnail = async (fileBuffer, originalFilename, fileMimetype, context) => {
  try {
    let thumbnailUrl = null;
    let thumbnailBuffer = null;

    if (fileMimetype.startsWith('image/') && !fileMimetype.includes('gif')) {
      const optimized = await imageCompressor.optimizeForWebFromBuffer(fileBuffer, originalFilename);
      if (optimized.thumbnail) {
        thumbnailBuffer = optimized.thumbnail.buffer;
        thumbnailUrl = await uploadThumbnailToDrive(
          thumbnailBuffer, 
          optimized.thumbnail.filename, 
          'image/webp'
        );
      }
    } else if (fileMimetype.startsWith('video/')) {
      const thumbnail = await imageCompressor.generateVideoThumbnailFromBuffer(fileBuffer);
      if (thumbnail) {
        thumbnailBuffer = thumbnail.buffer;
        thumbnailUrl = await uploadThumbnailToDrive(
          thumbnailBuffer, 
          thumbnail.filename, 
          'image/jpeg'
        );
      }
    }

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

    // Остальная логика загрузки без изменений...
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
      format: path.extname(finalFilename).substring(1),
      bytes: fileBuffer.length,
      url: result.secure_url,
      thumbnailUrl: thumbnailUrl // Добавляем URL превью
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

    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const sanitizedFileName = file.originalname.replace(/[^a-zA-Z0-9.]/g, '_');
    const finalFileName = `${uniqueSuffix}-${sanitizedFileName}`;

    console.log('[MULTER_DEBUG] Generated filename:', finalFileName);
    cb(null, finalFileName);
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
  try {
    if (!req.file) {
      console.log('[UPLOAD_MIDDLEWARE] No file to upload');
      return next();
    }

    const originalFilename = req.file.originalname;
    console.log(`[UPLOAD_MIDDLEWARE] Uploading file to Google Drive: ${originalFilename}`);

    const fileBuffer = await fs.promises.readFile(req.file.path);

    const uploadResult = await uploadProcessedToGoogleDrive(
      fileBuffer, 
      req.file.originalname, 
      req.file.mimetype, 
      'post', 
      process.env.GOOGLE_DRIVE_POSTS_FOLDER_ID,
      req.user ? req.user.username : null,
      req.file
    );

    // Сохраняем результат загрузки в объекте запроса
    req.uploadResult = uploadResult;
    req.file.secure_url = uploadResult.secure_url;
    req.file.public_id = uploadResult.public_id;

    console.log('[UPLOAD_MIDDLEWARE] File uploaded successfully:', uploadResult.secure_url);

    // Удаляем временный файл
    await fs.promises.unlink(req.file.path).catch(err => {
      console.error('Error deleting temp file:', err);
    });

    next();
  } catch (error) {
    console.error('[UPLOAD_MIDDLEWARE] Upload to Google Drive error:', error);
    return res.status(500).json({ 
      message: 'File upload error', 
      error: error.message 
    });
  }
};

module.exports = {
  upload,
  uploadToGoogleDrive,
}; 