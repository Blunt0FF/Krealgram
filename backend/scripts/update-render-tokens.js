#!/usr/bin/env node

require('dotenv').config();
const axios = require('axios');
const { OAuth2Client } = require('google-auth-library');
const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');

const RENDER_API_KEY = process.env.RENDER_API_KEY;
const RENDER_SERVICE_ID = process.env.RENDER_SERVICE_ID;

async function updateEnvFile(key, value) {
  try {
    const envPath = path.join(__dirname, '..', '.env');
    let envContent = '';
    try { envContent = await fs.readFile(envPath, 'utf8'); } catch {}
    const lines = envContent.split('\n').filter(Boolean);
    let updated = false;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith(`${key}=`)) { lines[i] = `${key}=${value}`; updated = true; break; }
    }
    if (!updated) lines.push(`${key}=${value}`);
    await fs.writeFile(envPath, lines.join('\n'), 'utf8');
    console.log(`✅ Обновлена переменная ${key} в локальном .env`);
  } catch (err) { console.error('❌ Ошибка обновления .env:', err.message); }
}

async function runGetNewTokenInteractive() {
  return new Promise((resolve, reject) => {
    console.log('🔄 Запускаем интерактивный скрипт получения нового токена...');
    const child = spawn('node', ['scripts/get-new-token.js'], { cwd: path.join(__dirname, '..'), stdio: 'inherit' });
    child.on('close', (code) => { if (code === 0) resolve(); else reject(new Error(`get-new-token exited with ${code}`)); });
    child.on('error', reject);
  });
}

async function updateRenderTokensAPI(refreshToken, accessToken) {
  const updateResponse = await axios.put(
    `https://api.render.com/v1/services/${RENDER_SERVICE_ID}/env-vars`,
    [
      { key: 'GOOGLE_DRIVE_REFRESH_TOKEN', value: refreshToken },
      { key: 'GOOGLE_DRIVE_ACCESS_TOKEN', value: accessToken }
    ],
    { headers: { 'Authorization': `Bearer ${RENDER_API_KEY}`, 'Content-Type': 'application/json' } }
  );
  console.log('✅ Токены обновлены в Render', updateResponse.status);
}

async function deployToRender() {
  const deployResponse = await axios.post(
    `https://api.render.com/v1/services/${RENDER_SERVICE_ID}/deploys`,
    {},
    { headers: { 'Authorization': `Bearer ${RENDER_API_KEY}`, 'Content-Type': 'application/json' } }
  );
  console.log('🚀 Новый деплой запущен', deployResponse.data.id);
}

async function updateRenderTokens() {
  if (!RENDER_API_KEY || !RENDER_SERVICE_ID) {
    console.error('❌ RENDER_API_KEY или RENDER_SERVICE_ID не установлены');
    return;
  }

  console.log('🔧 Обновляем токены Google Drive в Render...');

  try {
    const oauth2Client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );

    oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_DRIVE_REFRESH_TOKEN });

    let credentials;
    try {
      ({ credentials } = await oauth2Client.refreshAccessToken());
    } catch (err) {
      if (String(err.message).includes('invalid_grant')) {
        console.log('⚠️ invalid_grant. Получаем новый refresh токен интерактивно...');
        await runGetNewTokenInteractive();
        // После интерактивного скрипта пользователь видит токены в консоли и кидает в .env вручную.
        require('dotenv').config();
        oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_DRIVE_REFRESH_TOKEN });
        ({ credentials } = await oauth2Client.refreshAccessToken());
      } else {
        throw err;
      }
    }

    const newRefreshToken = credentials.refresh_token || process.env.GOOGLE_DRIVE_REFRESH_TOKEN;
    const newAccessToken = credentials.access_token;

    await updateEnvFile('GOOGLE_DRIVE_REFRESH_TOKEN', newRefreshToken);
    await updateEnvFile('GOOGLE_DRIVE_ACCESS_TOKEN', newAccessToken);

    await updateRenderTokensAPI(newRefreshToken, newAccessToken);
    await deployToRender();

    console.log('✅ Готово');
  } catch (error) {
    console.error('❌ Ошибка:', error.response?.data || error.message);
  }
}

updateRenderTokens(); 