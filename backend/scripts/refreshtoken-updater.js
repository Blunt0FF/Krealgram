#!/usr/bin/env node

require('dotenv').config();
const { OAuth2Client } = require('google-auth-library');
const { google } = require('googleapis');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const http = require('http');
const { exec } = require('child_process');

const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.metadata.readonly',
  'profile',
  'email'
];

const CONFIG = {
  ENV_PATH: path.join(__dirname, '..', '.env'),
  RENDER_API_KEY: process.env.RENDER_API_KEY,
  RENDER_SERVICE_ID: process.env.RENDER_SERVICE_ID,
  CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET
};

function openUrl(url) {
  const command = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
  exec(`${command} "${url}"`);
}

// Проверка валидности токена (берем логику из работающего скрипта)
async function validateToken(oauth2Client) {
  try {
    const { credentials } = await oauth2Client.refreshAccessToken();
    console.log('✅ Access token успешно обновлен');
    return { valid: true, credentials };
  } catch (error) {
    if (error.message.includes('invalid_grant')) {
      console.log('❌ Refresh token недействителен');
      return { valid: false };
    }
    throw error;
  }
}

async function getNewTokensInteractive() {
  return new Promise((resolve, reject) => {
    const oauth2Client = new OAuth2Client(
      CONFIG.CLIENT_ID,
      CONFIG.CLIENT_SECRET,
      'http://localhost:3000/oauth2callback'
    );

    const server = http.createServer(async (req, res) => {
      try {
        const code = new URL(req.url, 'http://localhost:3000').searchParams.get('code');
        if (code) {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end('<h1>Авторизация успешна! Можете закрыть это окно.</h1>');
          server.close();

          const { tokens } = await oauth2Client.getToken(code);
          resolve(tokens);
        }
      } catch (error) {
        reject(error);
      }
    });

    server.listen(3000, async () => {
      const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
        prompt: 'consent'
      });
      console.log('🔗 Открываю браузер для авторизации...');
      openUrl(authUrl);
    });

    server.on('error', (error) => {
      reject(error);
    });
  });
}

async function updateEnvFile(updates) {
  let envContent = '';
  try {
    envContent = await fs.readFile(CONFIG.ENV_PATH, 'utf8');
  } catch {}

  const lines = envContent.split('\n').filter(Boolean);
  const existing = new Set(lines.map(line => line.split('=')[0]));

  Object.entries(updates).forEach(([key, value]) => {
    if (existing.has(key)) {
      const index = lines.findIndex(line => line.startsWith(`${key}=`));
      lines[index] = `${key}=${value}`;
    } else {
      lines.push(`${key}=${value}`);
    }
  });

  await fs.writeFile(CONFIG.ENV_PATH, lines.join('\n') + '\n', 'utf8');
  console.log('✅ Локальный .env обновлен');
}

async function updateRenderEnv(tokens) {
  try {
    await axios.put(
      `https://api.render.com/v1/services/${CONFIG.RENDER_SERVICE_ID}/env-vars`,
      [
        { key: 'GOOGLE_DRIVE_REFRESH_TOKEN', value: tokens.refresh_token },
        { key: 'GOOGLE_DRIVE_ACCESS_TOKEN', value: tokens.access_token }
      ],
      { headers: { 'Authorization': `Bearer ${CONFIG.RENDER_API_KEY}` } }
    );
    console.log('✅ Переменные окружения Render обновлены');
    return true;
  } catch (error) {
    console.error('❌ Ошибка обновления Render:', error.response?.data || error.message);
    return false;
  }
}

async function deployRender() {
  try {
    const response = await axios.post(
      `https://api.render.com/v1/services/${CONFIG.RENDER_SERVICE_ID}/deploys`,
      {},
      { headers: { 'Authorization': `Bearer ${CONFIG.RENDER_API_KEY}` } }
    );
    console.log('🚀 Новый деплой запущен:', response.data.id);
    return true;
  } catch (error) {
    console.error('❌ Ошибка деплоя:', error.response?.data || error.message);
    return false;
  }
}

async function main() {
  if (!CONFIG.RENDER_API_KEY || !CONFIG.RENDER_SERVICE_ID) {
    console.error('❌ Отсутствуют RENDER_API_KEY или RENDER_SERVICE_ID');
    return;
  }

  try {
    const oauth2Client = new OAuth2Client(CONFIG.CLIENT_ID, CONFIG.CLIENT_SECRET);
    let tokens;

    if (process.env.GOOGLE_DRIVE_REFRESH_TOKEN) {
      oauth2Client.setCredentials({
        refresh_token: process.env.GOOGLE_DRIVE_REFRESH_TOKEN
      });

      const { valid, credentials } = await validateToken(oauth2Client);
      if (valid) {
        tokens = credentials;
        console.log('✅ Текущий refresh token валиден');
      } else {
        console.log('⚠️ Получаем новые токены через OAuth...');
        tokens = await getNewTokensInteractive();
      }
    } else {
      console.log('⚠️ Refresh token отсутствует, получаем новые токены...');
      tokens = await getNewTokensInteractive();
    }

    await updateEnvFile({
      GOOGLE_DRIVE_REFRESH_TOKEN: tokens.refresh_token || process.env.GOOGLE_DRIVE_REFRESH_TOKEN,
      GOOGLE_DRIVE_ACCESS_TOKEN: tokens.access_token
    });

    if (await updateRenderEnv(tokens)) {
      await deployRender();
    }

    console.log('✅ Все операции успешно завершены');
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
  }
}

main();