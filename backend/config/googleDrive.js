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
      if (!process.env.GOOGLE_DRIVE_CREDENTIALS) {
        console.log('[GOOGLE_DRIVE] Credentials not found, using fallback storage');
        return false;
      }

      const credentials = JSON.parse(process.env.GOOGLE_DRIVE_CREDENTIALS);
      
      this.auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/drive.file']
      });

      this.drive = google.drive({ version: 'v3', auth: this.auth });
      
      // Test connection
      await this.drive.about.get({ fields: 'user' });
      
      this.isInitialized = true;
      console.log('[GOOGLE_DRIVE] ✅ Storage ready');
      return true;
    } catch (error) {
      console.error('[GOOGLE_DRIVE] ❌ Initialization failed:', error.message);
      this.isInitialized = false;
      return false;
    }
  }

  async uploadFile(buffer, filename, mimetype) {
    if (!this.isInitialized) {
      throw new Error('Google Drive not initialized');
    }

    try {
      const response = await this.drive.files.create({
        requestBody: {
          name: filename,
          parents: this.folderId ? [this.folderId] : undefined
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