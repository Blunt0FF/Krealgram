#!/usr/bin/env node

const { google } = require('googleapis');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

/**
 * Скрипт для проверки и обновления Google Drive токена на Render
 * Запускается автоматически каждые 30 минут
 */

async function checkAndRefreshToken() {
  console.log('🔄 Проверка Google Drive токена на Render...');
  
  try {
    // Создаем OAuth2 клиент
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      'http://localhost'
    );

    // Устанавливаем текущий refresh token
    oauth2Client.setCredentials({
      refresh_token: process.env.GOOGLE_DRIVE_REFRESH_TOKEN
    });

    // Проверяем валидность токена
    console.log('📡 Проверка валидности токена...');
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    
    try {
      await drive.about.get({ fields: 'user' });
      console.log('✅ Токен валиден, обновление не требуется');
      return true;
    } catch (error) {
      if (error.message.includes('invalid_grant')) {
        console.log('❌ Токен истек, обновляем...');
        
        // Обновляем токен
        const { credentials } = await oauth2Client.refreshAccessToken();
        
        if (credentials.access_token) {
          console.log('✅ Новый access token получен');
          
          if (credentials.refresh_token) {
            console.log('✅ Новый refresh token получен');
            
            // Сохраняем новый токен в файл
            const tokenData = {
              refresh_token: credentials.refresh_token,
              access_token: credentials.access_token,
              updated_at: new Date().toISOString()
            };
            
            await fs.writeFile(
              path.join(__dirname, '../token-backup.json'),
              JSON.stringify(tokenData, null, 2)
            );
            
            console.log('💾 Токен сохранен в файл token-backup.json');
            
            // Обновляем переменные окружения
            process.env.GOOGLE_DRIVE_ACCESS_TOKEN = credentials.access_token;
            process.env.GOOGLE_DRIVE_REFRESH_TOKEN = credentials.refresh_token;
            
            console.log('✅ Токен успешно обновлен и сохранен');
            return true;
          }
        }
      }
      
      console.error('❌ Ошибка обновления токена:', error.message);
      return false;
    }
    
  } catch (error) {
    console.error('❌ Критическая ошибка:', error.message);
    return false;
  }
}

// Функция для отправки уведомления в лог
function logNotification(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}

// Основная функция
async function main() {
  logNotification('🚀 Запуск проверки токена на Render');
  
  const success = await checkAndRefreshToken();
  
  if (success) {
    logNotification('✅ Проверка токена завершена успешно');
  } else {
    logNotification('❌ Проверка токена завершена с ошибками');
    process.exit(1);
  }
}

// Запускаем скрипт
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Неожиданная ошибка:', error);
    process.exit(1);
  });
}

module.exports = { checkAndRefreshToken }; 