const { google } = require('googleapis');
require('dotenv').config();

async function getNewToken() {
  try {
    console.log('🔄 Получение нового Google Drive токена...');
    
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      'http://localhost:3000/auth/google/callback'
    );

    // Генерируем URL для авторизации
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/drive.file'],
      prompt: 'consent'
    });

    console.log('\n📋 Выполните следующие шаги:');
    console.log('1. Откройте этот URL в браузере:');
    console.log(authUrl);
    console.log('\n2. Авторизуйтесь в Google');
    console.log('3. Скопируйте код авторизации из URL (параметр "code=")');
    console.log('\n4. Запустите: node simple-token.js <код>');
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
  }
}

async function exchangeCode(code) {
  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      'http://localhost:3000/auth/google/callback'
    );

    console.log('📡 Обмен кода на токены...');
    
    const { tokens } = await oauth2Client.getToken(code);
    
    console.log('\n✅ Новые токены получены!');
    console.log('\n📝 Обновите переменные окружения:');
    console.log('GOOGLE_DRIVE_ACCESS_TOKEN=' + tokens.access_token);
    if (tokens.refresh_token) {
      console.log('GOOGLE_DRIVE_REFRESH_TOKEN=' + tokens.refresh_token);
    }
    
    if (tokens.expiry_date) {
      const expiryDate = new Date(tokens.expiry_date);
      console.log('⏰ Access Token истекает:', expiryDate.toLocaleString());
    }
    
    // Тестируем подключение
    console.log('\n🧪 Тестирование подключения...');
    oauth2Client.setCredentials(tokens);
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    const aboutResponse = await drive.about.get({ fields: 'user' });
    console.log('✅ Подключение успешно! Пользователь:', aboutResponse.data.user.emailAddress);
    
  } catch (error) {
    console.error('❌ Ошибка получения токена:', error.message);
  }
}

const code = process.argv[2];

if (code) {
  exchangeCode(code);
} else {
  getNewToken();
} 