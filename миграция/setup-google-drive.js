const { google } = require('googleapis');
const fs = require('fs');
require('dotenv').config();

async function setupGoogleDrive() {
  try {
    console.log('🔧 Настраиваем Google Drive...');
    
    // Используем OAuth2 для получения токена
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      'http://localhost:3000/auth/google/callback'
    );

    // Устанавливаем токен доступа
    const { tokens } = await oauth2Client.getToken(process.env.GOOGLE_AUTH_CODE);
    oauth2Client.setCredentials(tokens);

    console.log('✅ OAuth2 настроен');
    console.log('Токены:', tokens);

    // Создаем Drive API
    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    // Создаем папку для Krealgram
    console.log('📁 Создаем папку Krealgram...');
    const folderResponse = await drive.files.create({
      requestBody: {
        name: 'Krealgram Media',
        mimeType: 'application/vnd.google-apps.folder'
      }
    });

    const folderId = folderResponse.data.id;
    console.log('✅ Папка создана:', folderId);

    // Делаем папку публичной
    await drive.permissions.create({
      fileId: folderId,
      requestBody: {
        role: 'reader',
        type: 'anyone'
      }
    });

    console.log('✅ Папка сделана публичной');

    // Обновляем .env файл
    const envContent = fs.readFileSync('.env', 'utf8');
    const newEnvContent = envContent + `\n# Google Drive\nGOOGLE_DRIVE_FOLDER_ID=${folderId}\nGOOGLE_DRIVE_ACCESS_TOKEN=${tokens.access_token}\nGOOGLE_DRIVE_REFRESH_TOKEN=${tokens.refresh_token}\n`;
    
    fs.writeFileSync('.env', newEnvContent);
    console.log('✅ .env файл обновлен');

    console.log('\n🎉 Google Drive настроен успешно!');
    console.log(`📁 Folder ID: ${folderId}`);
    console.log(`🔑 Access Token: ${tokens.access_token}`);

  } catch (error) {
    console.error('❌ Ошибка настройки Google Drive:', error.message);
    if (error.response) {
      console.error('Детали ошибки:', error.response.data);
    }
  }
}

setupGoogleDrive(); 