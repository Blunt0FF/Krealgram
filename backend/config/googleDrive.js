const { google } = require('googleapis');
const { Readable } = require('stream');

class GoogleDriveManager {
  constructor() {
    this.auth = null;
    this.drive = null;
    this.folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    this.isInitialized = false;
  }

  async initialize() {
    try {
      console.log('[GOOGLE_DRIVE] 🔄 Starting initialization...');
      
      // Проверяем наличие OAuth2 credentials
      const refreshToken = process.env.GOOGLE_REFRESH_TOKEN || process.env.GOOGLE_DRIVE_REFRESH_TOKEN;
      
      if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && refreshToken) {
        console.log('[GOOGLE_DRIVE] Using OAuth2 credentials...');
        console.log('[GOOGLE_DRIVE] Client ID found:', !!process.env.GOOGLE_CLIENT_ID);
        console.log('[GOOGLE_DRIVE] Client Secret found:', !!process.env.GOOGLE_CLIENT_SECRET);
        console.log('[GOOGLE_DRIVE] Refresh Token found:', !!refreshToken);
        
        // Используем TokenManager для автоматического обновления токенов
        const tokenManager = require('../utils/tokenManager');
        await tokenManager.initialize();
        
        this.auth = tokenManager.getOAuth2Client();
        
      } else if (process.env.GOOGLE_DRIVE_CREDENTIALS) {
        console.log('[GOOGLE_DRIVE] Using Service Account credentials...');
        
        let rawCreds = process.env.GOOGLE_DRIVE_CREDENTIALS;
        console.log('[GOOGLE_DRIVE] Raw credentials length:', rawCreds.length);
        
        // Специальная обработка для исправления приватного ключа
        console.log('[GOOGLE_DRIVE] Fixing private key formatting...');
        
        // Исправляем JSON с приватным ключом
        rawCreds = rawCreds.replace(/\\n/g, '\n');
        rawCreds = rawCreds.replace(/-----BEGIN PRIVATE KEY-----\\/g, '-----BEGIN PRIVATE KEY-----\n');
        rawCreds = rawCreds.replace(/-----END PRIVATE KEY-----\\/g, '\n-----END PRIVATE KEY-----');
        rawCreds = rawCreds.replace(/\\\n/g, '\n');
        rawCreds = rawCreds.replace(/\\$/g, '');

        let credentials;
        try {
          credentials = JSON.parse(rawCreds);
          console.log('[GOOGLE_DRIVE] ✅ Service Account credentials parsed');
          console.log('[GOOGLE_DRIVE] Project ID:', credentials.project_id);
          console.log('[GOOGLE_DRIVE] Client email:', credentials.client_email);
        } catch (parseError) {
          console.error('[GOOGLE_DRIVE] ❌ Failed to parse Service Account credentials:', parseError.message);
          throw parseError;
        }
        
        this.auth = new google.auth.GoogleAuth({
          credentials,
          scopes: ['https://www.googleapis.com/auth/drive.file']
        });
        
      } else {
        console.log('[GOOGLE_DRIVE] ❌ No Google Drive credentials found');
        console.log('[GOOGLE_DRIVE] Expected OAuth2: GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET + (GOOGLE_REFRESH_TOKEN or GOOGLE_DRIVE_REFRESH_TOKEN or GOOGLE_DRIVE_ACCESS_TOKEN)');
        console.log('[GOOGLE_DRIVE] Or Service Account: GOOGLE_DRIVE_CREDENTIALS');
        console.log('[GOOGLE_DRIVE] Available env vars:');
        console.log('[GOOGLE_DRIVE] - GOOGLE_CLIENT_ID:', !!process.env.GOOGLE_CLIENT_ID);
        console.log('[GOOGLE_DRIVE] - GOOGLE_CLIENT_SECRET:', !!process.env.GOOGLE_CLIENT_SECRET);
        console.log('[GOOGLE_DRIVE] - GOOGLE_REFRESH_TOKEN:', !!process.env.GOOGLE_REFRESH_TOKEN);
        console.log('[GOOGLE_DRIVE] - GOOGLE_DRIVE_REFRESH_TOKEN:', !!process.env.GOOGLE_DRIVE_REFRESH_TOKEN);
        console.log('[GOOGLE_DRIVE] - GOOGLE_DRIVE_ACCESS_TOKEN:', !!process.env.GOOGLE_DRIVE_ACCESS_TOKEN);
        console.log('[GOOGLE_DRIVE] - GOOGLE_DRIVE_CREDENTIALS:', !!process.env.GOOGLE_DRIVE_CREDENTIALS);
        return false;
      }

      console.log('[GOOGLE_DRIVE] 🔄 Creating drive client...');
      this.drive = google.drive({ version: 'v3', auth: this.auth });
      
      // Test connection
      console.log('[GOOGLE_DRIVE] 🔄 Testing connection...');
      const aboutResponse = await this.drive.about.get({ fields: 'user' });
      console.log('[GOOGLE_DRIVE] ✅ Connected as:', aboutResponse.data.user.emailAddress);
      
      this.isInitialized = true;
      console.log('[GOOGLE_DRIVE] ✅ Storage ready');
      return true;
    } catch (error) {
      console.error('[GOOGLE_DRIVE] ❌ Initialization failed:', error.message);
      if (error.stack) {
        console.error('[GOOGLE_DRIVE] Stack trace:', error.stack);
      }
      this.isInitialized = false;
      return false;
    }
  }

  // Теперь uploadFile принимает folderId как 4-й аргумент
  async uploadFile(buffer, filename, mimetype, folderId) {
    if (!this.isInitialized) {
      throw new Error('Google Drive not initialized');
    }

    try {
      // Конвертируем Buffer в stream для Google Drive API
      const stream = Readable.from(buffer);
      
      const response = await this.drive.files.create({
        requestBody: {
          name: filename,
          parents: folderId ? [folderId] : (this.folderId ? [this.folderId] : undefined)
        },
        media: {
          mimeType: mimetype,
          body: stream
        }
      });

      // Make file publicly readable
      await this.drive.permissions.create({
        fileId: response.data.id,
        requestBody: {
          role: 'reader',
          type: 'anyone'
        }
      });

      const fileUrl = `https://drive.google.com/uc?id=${response.data.id}`;
      
      console.log('[GOOGLE_DRIVE] File uploaded:', filename, '→', fileUrl);
      
      return {
        fileId: response.data.id,
        publicUrl: `https://drive.google.com/file/d/${response.data.id}/view`,
        directUrl: fileUrl,
        secure_url: fileUrl // For compatibility with Cloudinary format
      };
    } catch (error) {
      console.error('[GOOGLE_DRIVE] Upload failed:', error.message);
      throw error;
    }
  }

  async deleteFile(fileId) {
    if (!this.isInitialized) {
      return false;
    }

    try {
      await this.drive.files.delete({ fileId });
      console.log('[GOOGLE_DRIVE] File deleted:', fileId);
      return true;
    } catch (error) {
      console.error('[GOOGLE_DRIVE] Delete failed:', error.message);
      return false;
    }
  }

  async linkFiles(mainFileId, previewFileId) {
    try {
      await this.drive.files.update({
        fileId: mainFileId,
        resource: {
          properties: {
            previewFileId: previewFileId
          }
        }
      });
      await this.drive.files.update({
        fileId: previewFileId,
        resource: {
          properties: {
            mainFileId: mainFileId
          }
        }
      });
      console.log(`✅ Файлы ${mainFileId} и ${previewFileId} связаны`);
    } catch (error) {
      console.error('❌ Ошибка связывания файлов:', error);
    }
  }

  async deleteLinkedFiles(fileId) {
    try {
      // Получаем метаданные файла
      const fileMetadata = await this.drive.files.get({
        fileId: fileId,
        fields: 'properties'
      });

      const previewFileId = fileMetadata.data.properties?.previewFileId;

      // Удаляем основной файл
      await this.drive.files.delete({ fileId: fileId });

      // Если есть превью, удаляем и его
      if (previewFileId) {
        await this.drive.files.delete({ fileId: previewFileId });
        console.log(`✅ Удалены связанные файлы: ${fileId} и ${previewFileId}`);
      }
    } catch (error) {
      console.error('❌ Ошибка удаления связанных файлов:', error);
    }
  }

  // Проверка статуса обработки видео в Google Drive
  async checkVideoProcessingStatus(fileId) {
    if (!this.isInitialized) {
      throw new Error('Google Drive not initialized');
    }

    try {
      console.log(`[GOOGLE_DRIVE] Проверяем статус обработки видео: ${fileId}`);
      
      // Получаем метаданные файла
      const fileMetadata = await this.drive.files.get({
        fileId: fileId,
        fields: 'id,name,mimeType,size,thumbnailLink,videoMediaMetadata,processingStatus'
      });

      const metadata = fileMetadata.data;
      console.log(`[GOOGLE_DRIVE] Метаданные файла:`, {
        name: metadata.name,
        mimeType: metadata.mimeType,
        size: metadata.size,
        hasThumbnail: !!metadata.thumbnailLink,
        videoMetadata: metadata.videoMediaMetadata,
        processingStatus: metadata.processingStatus
      });

      // Проверяем статус обработки
      if (metadata.processingStatus) {
        console.log(`[GOOGLE_DRIVE] Статус обработки: ${metadata.processingStatus}`);
        return {
          isProcessing: metadata.processingStatus === 'PROCESSING',
          isReady: metadata.processingStatus === 'DONE',
          hasThumbnail: !!metadata.thumbnailLink,
          metadata: metadata
        };
      }

      // Если нет статуса обработки, проверяем наличие thumbnail
      const isReady = !!metadata.thumbnailLink || (metadata.size && metadata.size > 0);
      
      console.log(`[GOOGLE_DRIVE] Видео готово: ${isReady}`);
      
      return {
        isProcessing: false,
        isReady: isReady,
        hasThumbnail: !!metadata.thumbnailLink,
        metadata: metadata
      };

    } catch (error) {
      console.error(`[GOOGLE_DRIVE] Ошибка проверки статуса видео:`, error.message);
      return {
        isProcessing: false,
        isReady: false,
        hasThumbnail: false,
        error: error.message
      };
    }
  }

  // Ожидание готовности видео с таймаутом
  async waitForVideoProcessing(fileId, timeoutMs = 30000, checkIntervalMs = 2000) {
    console.log(`[GOOGLE_DRIVE] Ожидаем готовности видео: ${fileId} (таймаут: ${timeoutMs}ms)`);
    
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      const status = await this.checkVideoProcessingStatus(fileId);
      
      if (status.isReady) {
        console.log(`[GOOGLE_DRIVE] ✅ Видео готово: ${fileId}`);
        return status;
      }
      
      if (status.error) {
        console.log(`[GOOGLE_DRIVE] ❌ Ошибка при проверке: ${status.error}`);
        return status;
      }
      
      console.log(`[GOOGLE_DRIVE] ⏳ Видео еще обрабатывается, ждем...`);
      await new Promise(resolve => setTimeout(resolve, checkIntervalMs));
    }
    
    console.log(`[GOOGLE_DRIVE] ⏰ Таймаут ожидания готовности видео: ${fileId}`);
    return {
      isProcessing: true,
      isReady: false,
      hasThumbnail: false,
      timeout: true
    };
  }
}

module.exports = new GoogleDriveManager(); 