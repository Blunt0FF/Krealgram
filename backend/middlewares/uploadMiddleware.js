const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const googleDrive = require('../config/googleDrive');
const { ImageCompressor } = require('../utils/imageCompressor');
const imageCompressor = new ImageCompressor();

const TEMP_INPUT_DIR = path.resolve(process.cwd(), 'temp/input');
const TEMP_OUTPUT_DIR = path.resolve(process.cwd(), 'temp/output');

// Создаем директории при загрузке модуля
const ensureTempDir = async (dirPath) => {
  try {
    await fs.mkdir(dirPath, { recursive: true });
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

  let compressedFilePath = req.file.path;

  try {
    const tempFilePath = req.file.path;
    const originalFilename = req.file.originalname;
    const fileMimetype = req.file.mimetype;
    
    // Определяем контекст загрузки
    let context = 'post';
    let folderId = process.env.GOOGLE_DRIVE_POSTS_FOLDER_ID;
    let username = null;

    // Сжимаем изображения перед загрузкой
    if (fileMimetype.startsWith('image/')) {
      console.log('[IMAGE_COMPRESSION] Сжимаем изображение потоковым методом');
      compressedFilePath = await imageCompressor.compressImage(tempFilePath, originalFilename);
    }

    // Создаем превью для изображений
    let thumbnailUrl = null;
    if (fileMimetype.startsWith('image/')) {
      try {
        const thumbnailBuffer = await imageCompressor.createThumbnail(compressedFilePath);
        const thumbnailResult = await googleDrive.uploadFile(
          thumbnailBuffer, 
          `thumb_${originalFilename}`, 
          'image/webp', 
          process.env.GOOGLE_DRIVE_PREVIEWS_FOLDER_ID
        );
        thumbnailUrl = thumbnailResult.secure_url; // Берем только URL
      } catch (thumbnailError) {
        console.error('[THUMBNAIL_ERROR] Не удалось создать превью:', thumbnailError);
      }
    }

    // Читаем файл
    const fileBuffer = await fs.readFile(compressedFilePath);

    // Очищаем временные файлы
    await imageCompressor.cleanupTempFiles(compressedFilePath);

    // Загрузка файла на Google Drive
    const result = await googleDrive.uploadFile(
      fileBuffer, 
      originalFilename, 
      fileMimetype, 
      folderId
    );

    req.uploadResult = {
      secure_url: result.secure_url,
      public_id: result.fileId,
      resource_type: fileMimetype.startsWith('video/') ? 'video' : 'image',
      format: path.extname(originalFilename).substring(1),
      bytes: fileBuffer.length,
      url: result.secure_url,
      thumbnailUrl: thumbnailUrl
    };
    
    console.log(`[UPLOAD_RESULT] Размер загруженного файла: ${fileBuffer.length} байт (${(fileBuffer.length / (1024 * 1024)).toFixed(2)} MB)`);

    next();
  } catch (error) {
    console.error('[UPLOAD_MIDDLEWARE] Ошибка загрузки:', error);
    
    // Очистка временных файлов в случае ошибки
    try {
      await imageCompressor.cleanupTempFiles(compressedFilePath);
    } catch (cleanupError) {
      console.error('[UPLOAD_MIDDLEWARE] Ошибка очистки временных файлов:', cleanupError);
    }

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