#!/usr/bin/env node

require('dotenv').config();
const axios = require('axios');
const { OAuth2Client } = require('google-auth-library');
const { google } = require('googleapis');
const fs = require('fs').promises;
const path = require('path');
const readline = require('readline');

const RENDER_API_KEY = process.env.RENDER_API_KEY;
const RENDER_SERVICE_ID = process.env.RENDER_SERVICE_ID;

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

/**
 * Получает новый токен через OAuth flow
 */
async function getNewToken() {
  try {
    console.log('🔄 Получение нового Google Drive токена...');
    
    const oauth2Client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      'urn:ietf:wg:oauth:2.0:oob'
    );

    // Генерируем URL для авторизации
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/drive',
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/drive.metadata.readonly'
      ],
      prompt: 'consent'
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
    
    console.log('✅ Новый токен получен успешно!');
    
    return tokens;
    
  } catch (error) {
    console.error('❌ Ошибка получения токена:', error.message);
    throw error;
  }
}

/**
 * Получает токен из переменных окружения
 */
async function getTokens() {
  try {
    const refreshToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN;
    if (!refreshToken) {
      throw new Error('Refresh token не найден в переменных окружения');
    }
    
    console.log('📂 Токен загружен из переменных окружения');
    return { refreshToken };
  } catch (error) {
    throw new Error('Не удалось получить refresh token');
  }
}

/**
 * Обновляет токены в Render
 */
async function updateRenderTokens(refreshToken, accessToken) {
  console.log('🌐 Обновляем токены в Render...');
  const updateResponse = await axios.put(
    `https://api.render.com/v1/services/${RENDER_SERVICE_ID}/env-vars`,
    [
      {
        key: 'GOOGLE_DRIVE_REFRESH_TOKEN',
        value: refreshToken
      },
      {
        key: 'GOOGLE_DRIVE_ACCESS_TOKEN',
        value: accessToken
      }
    ],
    {
      headers: {
        'Authorization': `Bearer ${RENDER_API_KEY}`,
        'Content-Type': 'application/json'
      }
    }
  );

  console.log('✅ Токены обновлены в Render');
  console.log('📋 Ответ API:', updateResponse.status);
}

/**
 * Запускает новый деплой на Render
 */
async function deployToRender() {
  console.log('🚀 Запускаем новый деплой на Render...');
  const deployResponse = await axios.post(
    `https://api.render.com/v1/services/${RENDER_SERVICE_ID}/deploys`,
    {},
    {
      headers: {
        'Authorization': `Bearer ${RENDER_API_KEY}`,
        'Content-Type': 'application/json'
      }
    }
  );

  console.log('🚀 Новый деплой запущен');
  console.log('📋 Deploy ID:', deployResponse.data.id);
}

async function updateRenderTokens() {
  if (!RENDER_API_KEY || !RENDER_SERVICE_ID) {
    console.error('❌ RENDER_API_KEY или RENDER_SERVICE_ID не установлены');
    return;
  }

  console.log('🔧 Обновляем токены Google Drive в Render и локально...');

  try {
    // Получаем токены
    const { refreshToken } = await getTokens();
    
    // Создаем OAuth2 клиент
    const oauth2Client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );

    // Пытаемся обновить токен
    console.log('🔄 Проверяем и обновляем токен...');
    
    oauth2Client.setCredentials({
      refresh_token: refreshToken
    });

    try {
      // Пытаемся обновить access token
      const { credentials } = await oauth2Client.refreshAccessToken();
      
      const newRefreshToken = credentials.refresh_token || refreshToken;
      const newAccessToken = credentials.access_token;

      console.log('✅ Токены успешно обновлены');

      // Обновляем локальный .env файл
      console.log('📝 Обновляем локальный .env файл...');
      await updateEnvFile('GOOGLE_DRIVE_REFRESH_TOKEN', newRefreshToken);
      await updateEnvFile('GOOGLE_DRIVE_ACCESS_TOKEN', newAccessToken);

      // Обновляем токены в Render
      await updateRenderTokens(newRefreshToken, newAccessToken);

      // Запускаем новый деплой
      await deployToRender();
      
      console.log('✅ Все операции завершены успешно!');

    } catch (error) {
      if (error.message.includes('invalid_grant')) {
        console.log('❌ Токен истек, получаем новый...');
        
        // Получаем новый токен интерактивно
        const newTokens = await getNewToken();
        
        // Перезагружаем переменные окружения
        require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
        
        // Обновляем токены в Render
        await updateRenderTokens(newTokens.refresh_token, newTokens.access_token);

        // Запускаем новый деплой
        await deployToRender();
        
        console.log('✅ Все операции завершены успешно!');
        
      } else {
        throw error;
      }
    }

  } catch (error) {
    console.error('❌ Ошибка:', error.response?.data || error.message);
  } finally {
    rl.close();
  }
}

updateRenderTokens(); 