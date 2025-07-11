const { google } = require('googleapis');

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
      if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REFRESH_TOKEN) {
        console.log('[GOOGLE_DRIVE] Using OAuth2 credentials...');
        
        // Создаем OAuth2 клиент
        const oauth2Client = new google.auth.OAuth2(
          process.env.GOOGLE_CLIENT_ID,
          process.env.GOOGLE_CLIENT_SECRET,
          'http://localhost' // redirect URI (не используется для refresh token)
        );

        // Устанавливаем refresh token
        oauth2Client.setCredentials({
          refresh_token: process.env.GOOGLE_REFRESH_TOKEN
        });

        this.auth = oauth2Client;
        
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
        console.log('[GOOGLE_DRIVE] Expected: GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET + GOOGLE_REFRESH_TOKEN');
        console.log('[GOOGLE_DRIVE] Or: GOOGLE_DRIVE_CREDENTIALS (Service Account JSON)');
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
      const response = await this.drive.files.create({
        requestBody: {
          name: filename,
          parents: folderId ? [folderId] : (this.folderId ? [this.folderId] : undefined)
        },
        media: {
          mimeType: mimetype,
          body: buffer
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
}

module.exports = new GoogleDriveManager(); 