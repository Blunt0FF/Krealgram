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

    console.log(`[GOOGLE_DRIVE_FILE_MANAGER] Начало удаления файлов: ${fileIds.join(', ')}`);

    for (const fileId of fileIds) {
      try {
        await drive.drive.files.delete({ fileId });
        results.success.push(fileId);
        console.log(`[GOOGLE_DRIVE_FILE_MANAGER] ✅ Файл ${fileId} успешно удален`);
      } catch (error) {
        console.error(`[GOOGLE_DRIVE_FILE_MANAGER] ❌ Ошибка удаления файла ${fileId}:`, error.message);
        results.failed.push(fileId);
      }
    }

    console.log('[GOOGLE_DRIVE_FILE_MANAGER] Результаты удаления:', {
      успешно_удалено: results.success.length,
      не_удалось_удалить: results.failed.length
    });

    return results;
  }
}

module.exports = GoogleDriveFileManager; 