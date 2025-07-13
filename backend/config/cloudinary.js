const googleDriveManager = require('./googleDrive');

module.exports = {
  uploadFile: async (buffer, filename, mimetype) => {
    try {
      return await googleDriveManager.uploadFile(buffer, filename, mimetype);
    } catch (error) {
      console.error('[UPLOAD_ERROR] Failed to upload file to Google Drive:', error);
      throw error;
    }
  },
  
  // Заглушка для совместимости со старым кодом
  v2: {
    uploader: {
      upload: async (buffer, options) => {
        const result = await googleDriveManager.uploadFile(
          buffer, 
          options.filename || 'uploaded-file', 
          options.mimetype || 'application/octet-stream'
        );
        return {
          secure_url: result.directUrl,
          public_id: result.fileId,
          ...result
        };
      }
    }
  }
}; 