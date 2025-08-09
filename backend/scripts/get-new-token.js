const { google } = require('googleapis');
const readline = require('readline');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

/**
 * Обновляет переменную в .env файле
 */
async function updateEnvFile(key, value) {
  try {
    const envPath = path.join(__dirname, '..', '.env');
    
    // Читаем текущий .env файл
    let envContent = '';
    try {
      envContent = await fs.readFile(envPath, 'utf8');
    } catch (error) {
      console.log('📝 Создаем новый .env файл...');
    }
    
    // Разбиваем на строки
    const lines = envContent.split('\n');
    let updated = false;
    
    // Ищем и обновляем переменную
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith(`${key}=`)) {
        lines[i] = `${key}=${value}`;
        updated = true;
        break;
      }
    }
    
    // Если переменная не найдена, добавляем её
    if (!updated) {
      lines.push(`${key}=${value}`);
    }
    
    // Записываем обратно в файл
    await fs.writeFile(envPath, lines.join('\n'), 'utf8');
    console.log(`✅ Обновлена переменная ${key} в локальном .env файле`);
    
  } catch (error) {
    console.error(`❌ Ошибка обновления .env файла:`, error.message);
  }
}

async function getNewToken() {
  try {
    console.log('🔄 Получение нового Google Drive токена...');
    
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      'urn:ietf:wg:oauth:2.0:oob' // Используем универсальный redirect URI
    );

    // Генерируем URL для авторизации
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/drive',
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/drive.metadata.readonly'
      ],
      prompt: 'consent' // Принудительно запрашиваем refresh token
    });

    console.log('\n📋 Выполните следующие шаги:');
    console.log('1. Откройте этот URL в браузере:');
    console.log(authUrl);
    console.log('\n2. Авторизуйтесь в Google');
    console.log('3. Скопируйте код авторизации из URL');
    
    const code = await question('\nВведите код авторизации: ');
    
    console.log('📡 Обмен кода на токены...');
    
    const { tokens } = await oauth2Client.getToken(code);
    
    console.log('\n✅ Новые токены получены!');
    
    // Автоматически обновляем .env файл
    console.log('📝 Обновляем локальный .env файл...');
    await updateEnvFile('GOOGLE_DRIVE_REFRESH_TOKEN', tokens.refresh_token);
    await updateEnvFile('GOOGLE_DRIVE_ACCESS_TOKEN', tokens.access_token);
    
    console.log('\n📝 Обновленные переменные окружения:');
    console.log('GOOGLE_DRIVE_REFRESH_TOKEN=' + tokens.refresh_token);
    console.log('GOOGLE_DRIVE_ACCESS_TOKEN=' + tokens.access_token);
    
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
    
    console.log('✅ Все операции завершены успешно!');
    
  } catch (error) {
    console.error('❌ Ошибка получения токена:', error.message);
    throw error;
  } finally {
    rl.close();
  }
}

// Запускаем если скрипт вызван напрямую
if (require.main === module) {
  getNewToken();
}

module.exports = getNewToken; 