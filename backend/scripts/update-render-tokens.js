#!/usr/bin/env node

require('dotenv').config();
const axios = require('axios');
const { OAuth2Client } = require('google-auth-library');

const RENDER_API_KEY = process.env.RENDER_API_KEY;
const RENDER_SERVICE_ID = process.env.RENDER_SERVICE_ID;

async function updateRenderTokens() {
  if (!RENDER_API_KEY || !RENDER_SERVICE_ID) {
    console.error('❌ RENDER_API_KEY или RENDER_SERVICE_ID не установлены');
    return;
  }

  console.log('🔧 Обновляем токены Google Drive в Render...');

  try {
    // Создаем OAuth2 клиент
    const oauth2Client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );

    // Получаем новый refresh token
    console.log('🔄 Получаем новый refresh token...');
    
    // Используем текущий refresh token для получения нового
    oauth2Client.setCredentials({
      refresh_token: process.env.GOOGLE_DRIVE_REFRESH_TOKEN
    });

    // Пытаемся обновить access token
    const { credentials } = await oauth2Client.refreshAccessToken();
    
    const newRefreshToken = credentials.refresh_token || process.env.GOOGLE_DRIVE_REFRESH_TOKEN;
    const newAccessToken = credentials.access_token;

    console.log('✅ Новые токены получены');

    // Обновляем токены в Render
    const updateResponse = await axios.put(
      `https://api.render.com/v1/services/${RENDER_SERVICE_ID}/env-vars`,
      [
        {
          key: 'GOOGLE_DRIVE_REFRESH_TOKEN',
          value: newRefreshToken
        },
        {
          key: 'GOOGLE_DRIVE_ACCESS_TOKEN',
          value: newAccessToken
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

    // Запускаем новый деплой
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

  } catch (error) {
    console.error('❌ Ошибка:', error.response?.data || error.message);
    
    if (error.message.includes('invalid_grant')) {
      console.log('💡 Нужно получить новый refresh token вручную');
      console.log('💡 Запустите: node get-new-token.js');
    }
  }
}

updateRenderTokens(); 