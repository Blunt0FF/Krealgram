const { google } = require('googleapis');
const drive = require('../config/googleDrive');

class GoogleDriveFileManager {
  /**
   * Удаляет файл из Google Drive по его ID
   * @param {string} fileId - ID файла в Google Drive
   * @returns {Promise<boolean>} - Успешность удаления
   */
  static async deleteFile(fileId) {
    if (!fileId) return false;

    try {
      await drive.drive.files.delete({
        fileId: fileId
      });
      console.log(`[GOOGLE_DRIVE] Файл ${fileId} успешно удален`);
      return true;
    } catch (error) {
      console.error(`[GOOGLE_DRIVE] Ошибка удаления файла ${fileId}:`, error.message);
      return false;
    }
  }

  /**
   * Удаляет несколько файлов из Google Drive
   * @param {string[]} fileIds - Массив ID файлов для удаления
   * @returns {Promise<{success: string[], failed: string[]}>} - Результаты удаления
   */
  static async deleteFiles(fileIds) {
    if (!fileIds || fileIds.length === 0) return { success: [], failed: [] };

    const results = {
      success: [],
      failed: []
    };

    for (const fileId of fileIds) {
      const deleted = await this.deleteFile(fileId);
      if (deleted) {
        results.success.push(fileId);
      } else {
        results.failed.push(fileId);
      }
    }

    return results;
  }
}

module.exports = GoogleDriveFileManager; 