const { google } = require('googleapis');
require('dotenv').config();

async function refreshGoogleDriveToken() {
  try {
    console.log('🔄 Обновление Google Drive токена...');
    
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      'urn:ietf:wg:oauth:2.0:oob'
    );

    // Устанавливаем текущий refresh token
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN || process.env.GOOGLE_DRIVE_REFRESH_TOKEN;
    
    if (!refreshToken) {
      throw new Error('Refresh token не найден в переменных окружения');
    }

    oauth2Client.setCredentials({
      refresh_token: refreshToken
    });

    console.log('📡 Запрос нового access token...');
    
    // Запрашиваем новый access token
    const { credentials } = await oauth2Client.refreshAccessToken();
    
    console.log('✅ Новые токены получены:');
    console.log('Access Token:', credentials.access_token);
    console.log('Refresh Token:', credentials.refresh_token || 'Не изменился');
    
    if (credentials.expiry_date) {
      const expiryDate = new Date(credentials.expiry_date);
      console.log('Expiry Date:', expiryDate.toLocaleString());
    }
    
    // Обновляем переменные окружения
    if (credentials.access_token) {
      console.log('\n📝 Обновите переменные окружения:');
      console.log('GOOGLE_DRIVE_ACCESS_TOKEN=' + credentials.access_token);
      if (credentials.refresh_token) {
        console.log('GOOGLE_REFRESH_TOKEN=' + credentials.refresh_token);
      }
    }
    
    // Тестируем подключение к Drive
    console.log('\n🧪 Тестирование подключения к Google Drive...');
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    const aboutResponse = await drive.about.get({ fields: 'user' });
    console.log('✅ Подключение успешно! Пользователь:', aboutResponse.data.user.emailAddress);
    
    // Сохраняем новый токен в файл
    if (credentials.refresh_token) {
      const fs = require('fs').promises;
      const tokenPath = require('path').join(__dirname, '..', 'temp', 'google_refresh_token.txt');
      await fs.mkdir(require('path').dirname(tokenPath), { recursive: true });
      await fs.writeFile(tokenPath, credentials.refresh_token, 'utf8');
      console.log('💾 Новый refresh token сохранен в файл:', tokenPath);
    }
    
  } catch (error) {
    console.error('❌ Ошибка обновления токена:', error.message);
    
    if (error.message.includes('invalid_grant')) {
      console.log('\n💡 Токен истек. Необходимо получить новый refresh token:');
      console.log('1. Запустите: npm run get-new-token');
      console.log('2. Или перейдите в Google Cloud Console');
      console.log('3. Создайте новый OAuth 2.0 Client ID');
      console.log('4. Получите новый refresh token через OAuth flow');
    }
  }
}

// Запускаем если скрипт вызван напрямую
if (require.main === module) {
  refreshGoogleDriveToken();
}

module.exports = refreshGoogleDriveToken; 