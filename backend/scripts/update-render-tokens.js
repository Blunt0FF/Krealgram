#!/usr/bin/env node

const axios = require('axios');
require('dotenv').config();

/**
 * Скрипт для автоматического обновления токенов на Render
 * Требует RENDER_API_KEY в переменных окружения
 */

async function updateRenderTokens() {
  try {
    const RENDER_API_KEY = process.env.RENDER_API_KEY;
    const SERVICE_ID = process.env.RENDER_SERVICE_ID;
    
    if (!RENDER_API_KEY) {
      console.log('❌ RENDER_API_KEY не найден в переменных окружения');
      console.log('📝 Добавьте RENDER_API_KEY в .env файл');
      return false;
    }
    
    if (!SERVICE_ID) {
      console.log('❌ RENDER_SERVICE_ID не найден в переменных окружения');
      console.log('📝 Добавьте RENDER_SERVICE_ID в .env файл');
      return false;
    }

    // Получаем текущие токены из .env
    const accessToken = process.env.GOOGLE_DRIVE_ACCESS_TOKEN;
    const refreshToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN;
    
    if (!accessToken || !refreshToken) {
      console.log('❌ Токены не найдены в .env файле');
      return false;
    }

    console.log('🔄 Обновление токенов на Render...');
    
    // Обновляем переменные окружения на Render
    const response = await axios.patch(
      `https://api.render.com/v1/services/${SERVICE_ID}/env-vars`,
      {
        envVars: [
          {
            key: 'GOOGLE_DRIVE_ACCESS_TOKEN',
            value: accessToken
          },
          {
            key: 'GOOGLE_DRIVE_REFRESH_TOKEN', 
            value: refreshToken
          }
        ]
      },
      {
        headers: {
          'Authorization': `Bearer ${RENDER_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.status === 200) {
      console.log('✅ Токены успешно обновлены на Render!');
      console.log('🔄 Перезапуск сервиса...');
      
      // Перезапускаем сервис
      await axios.post(
        `https://api.render.com/v1/services/${SERVICE_ID}/deploys`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${RENDER_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log('✅ Сервис перезапущен!');
      return true;
    }
    
  } catch (error) {
    console.error('❌ Ошибка обновления токенов на Render:', error.message);
    if (error.response) {
      console.error('📄 Ответ сервера:', error.response.data);
    }
    return false;
  }
}

// Запуск скрипта
if (require.main === module) {
  updateRenderTokens().then(success => {
    if (success) {
      console.log('🎉 Все готово!');
    } else {
      console.log('💥 Что-то пошло не так');
      process.exit(1);
    }
  });
}

module.exports = { updateRenderTokens }; 