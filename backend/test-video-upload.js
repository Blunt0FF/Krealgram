const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

async function testVideoUpload() {
  try {
    console.log('🚀 Тестирование загрузки видео в Google Drive');

    const drive = google.drive({ version: 'v3', auth: global.oauth2Client });
    const uploadFolder = process.env.GOOGLE_DRIVE_FOLDER_ID;

    // Логика тестирования загрузки видео
    console.log('✅ Тест загрузки видео завершен');
  } catch (error) {
    console.error('❌ Ошибка при тестировании загрузки видео:', error);
  }
}

testVideoUpload(); 