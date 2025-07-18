const { google } = require('googleapis');
require('dotenv').config();

async function refreshGoogleDriveToken() {
  try {
    console.log('🔄 Обновление Google Drive токена...');
    
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      'http://localhost'
    );

    // Устанавливаем текущий refresh token
    oauth2Client.setCredentials({
      refresh_token: process.env.GOOGLE_DRIVE_REFRESH_TOKEN
    });

    console.log('📡 Запрос нового access token...');
    
    // Запрашиваем новый access token
    const { credentials } = await oauth2Client.refreshAccessToken();
    
    console.log('✅ Новые токены получены:');
    console.log('Access Token:', credentials.access_token);
    console.log('Refresh Token:', credentials.refresh_token || 'Не изменился');
    console.log('Expiry Date:', credentials.expiry_date);
    
    // Обновляем переменные окружения
    if (credentials.access_token) {
      console.log('\n📝 Обновите переменные окружения:');
      console.log('GOOGLE_DRIVE_ACCESS_TOKEN=' + credentials.access_token);
      if (credentials.refresh_token) {
        console.log('GOOGLE_DRIVE_REFRESH_TOKEN=' + credentials.refresh_token);
      }
    }
    
    // Тестируем подключение к Drive
    console.log('\n🧪 Тестирование подключения к Google Drive...');
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    const aboutResponse = await drive.about.get({ fields: 'user' });
    console.log('✅ Подключение успешно! Пользователь:', aboutResponse.data.user.emailAddress);
    
  } catch (error) {
    console.error('❌ Ошибка обновления токена:', error.message);
    
    if (error.message.includes('invalid_grant')) {
      console.log('\n💡 Токен истек. Необходимо получить новый refresh token:');
      console.log('1. Перейдите в Google Cloud Console');
      console.log('2. Создайте новый OAuth 2.0 Client ID');
      console.log('3. Получите новый refresh token через OAuth flow');
    }
  }
}

refreshGoogleDriveToken(); 