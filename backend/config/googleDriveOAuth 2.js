const { google } = require('googleapis');

class GoogleDriveOAuth {
  constructor() {
    this.auth = null;
    this.drive = null;
    this.folderId = null;
    this.isInitialized = false;
  }

  async initialize() {
    try {
      console.log('[GOOGLE_DRIVE] Инициализация OAuth...');
      
      this.auth = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        'http://localhost:3000/auth/google/callback'
      );

      // Устанавливаем токены
      if (process.env.GOOGLE_DRIVE_ACCESS_TOKEN) {
        this.auth.setCredentials({
          access_token: process.env.GOOGLE_DRIVE_ACCESS_TOKEN,
          refresh_token: process.env.GOOGLE_DRIVE_REFRESH_TOKEN
        });
      }

      this.drive = google.drive({ version: 'v3', auth: this.auth });
      this.folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
      
      // Проверяем подключение
      await this.drive.about.get({ fields: 'user' });
      
      this.isInitialized = true;
      console.log('[GOOGLE_DRIVE] ✅ OAuth инициализирован');
      return true;
    } catch (error) {
      console.error('[GOOGLE_DRIVE] ❌ Ошибка инициализации:', error.message);
      this.isInitialized = false;
      return false;
    }
  }

  async uploadFile(buffer, filename, mimetype) {
    if (!this.isInitialized) {
      throw new Error('Google Drive not initialized');
    }

    try {
      const { Readable } = require('stream');
      
      // Конвертируем buffer в stream
      const stream = new Readable();
      stream.push(buffer);
      stream.push(null);
      
      const response = await this.drive.files.create({
        requestBody: {
          name: filename,
          parents: this.folderId ? [this.folderId] : undefined
        },
        media: {
          mimeType: mimetype,
          body: stream
        }
      });

      // Делаем файл публичным
      await this.drive.permissions.create({
        fileId: response.data.id,
        requestBody: {
          role: 'reader',
          type: 'anyone'
        }
      });

      const fileUrl = `https://drive.google.com/uc?id=${response.data.id}`;
      
      console.log('[GOOGLE_DRIVE] ✅ Файл загружен:', filename, '→', fileUrl);
      
      return {
        fileId: response.data.id,
        publicUrl: `https://drive.google.com/file/d/${response.data.id}/view`,
        directUrl: fileUrl,
        secure_url: fileUrl
      };
    } catch (error) {
      console.error('[GOOGLE_DRIVE] ❌ Ошибка загрузки:', error.message);
      throw error;
    }
  }
}

module.exports = GoogleDriveOAuth; 