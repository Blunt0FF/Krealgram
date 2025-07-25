const { google } = require('googleapis');
const fs = require('fs').promises;
const path = require('path');

class TokenAutoRefresher {
  constructor() {
    this.isRunning = false;
    this.checkInterval = null;
    this.lastCheck = null;
    this.oauth2Client = null;
  }

  /**
   * Инициализация OAuth2 клиента
   */
  initialize() {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      'http://localhost'
    );

    // Устанавливаем текущий refresh token
    this.oauth2Client.setCredentials({
      refresh_token: process.env.GOOGLE_DRIVE_REFRESH_TOKEN
    });

    console.log('[TOKEN_REFRESHER] ✅ Инициализирован');
  }

  /**
   * Проверяет валидность текущего токена
   */
  async checkTokenValidity() {
    try {
      const drive = google.drive({ version: 'v3', auth: this.oauth2Client });
      await drive.about.get({ fields: 'user' });
      console.log('[TOKEN_REFRESHER] ✅ Токен валиден');
      return true;
    } catch (error) {
      console.log('[TOKEN_REFRESHER] ❌ Токен невалиден:', error.message);
      return false;
    }
  }

  /**
   * Обновляет токен
   */
  async refreshToken() {
    try {
      console.log('[TOKEN_REFRESHER] 🔄 Обновление токена...');
      
      const { credentials } = await this.oauth2Client.refreshAccessToken();
      
      if (credentials.access_token) {
        console.log('[TOKEN_REFRESHER] ✅ Новый access token получен');
        
        // Обновляем переменные окружения
        process.env.GOOGLE_DRIVE_ACCESS_TOKEN = credentials.access_token;
        
        if (credentials.refresh_token) {
          process.env.GOOGLE_DRIVE_REFRESH_TOKEN = credentials.refresh_token;
          console.log('[TOKEN_REFRESHER] ✅ Новый refresh token получен');
          
          // Сохраняем в файл для Render
          await this.saveTokenToFile(credentials.refresh_token);
        }
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('[TOKEN_REFRESHER] ❌ Ошибка обновления токена:', error.message);
      return false;
    }
  }

  /**
   * Сохраняет токен в файл для Render
   */
  async saveTokenToFile(refreshToken) {
    try {
      const tokenData = {
        refresh_token: refreshToken,
        updated_at: new Date().toISOString()
      };
      
      await fs.writeFile(
        path.join(__dirname, '../token-backup.json'),
        JSON.stringify(tokenData, null, 2)
      );
      
      console.log('[TOKEN_REFRESHER] 💾 Токен сохранен в файл');
    } catch (error) {
      console.error('[TOKEN_REFRESHER] ❌ Ошибка сохранения токена:', error.message);
    }
  }

  /**
   * Загружает токен из файла
   */
  async loadTokenFromFile() {
    try {
      const tokenPath = path.join(__dirname, '../token-backup.json');
      const tokenData = await fs.readFile(tokenPath, 'utf8');
      const { refresh_token } = JSON.parse(tokenData);
      
      if (refresh_token) {
        process.env.GOOGLE_DRIVE_REFRESH_TOKEN = refresh_token;
        this.oauth2Client.setCredentials({ refresh_token });
        console.log('[TOKEN_REFRESHER] 📂 Токен загружен из файла');
        return true;
      }
      
      return false;
    } catch (error) {
      console.log('[TOKEN_REFRESHER] 📂 Файл с токеном не найден');
      return false;
    }
  }

  /**
   * Запускает автоматическую проверку токена
   */
  startAutoRefresh(intervalMinutes = 60) {
    if (this.isRunning) {
      console.log('[TOKEN_REFRESHER] ⚠️ Автообновление уже запущено');
      return;
    }

    this.isRunning = true;
    const intervalMs = intervalMinutes * 60 * 1000;

    console.log(`[TOKEN_REFRESHER] 🚀 Запуск автообновления каждые ${intervalMinutes} минут`);

    // Первая проверка через 10 минут после запуска
    setTimeout(async () => {
      await this.performTokenCheck();
    }, 10 * 60 * 1000);

    // Периодическая проверка
    this.checkInterval = setInterval(async () => {
      await this.performTokenCheck();
    }, intervalMs);
  }

  /**
   * Выполняет проверку и обновление токена
   */
  async performTokenCheck() {
    try {
      console.log('[TOKEN_REFRESHER] 🔍 Проверка токена...');
      
      // Проверяем что Google Drive инициализирован
      const googleDrive = require('../config/googleDrive');
      if (!googleDrive.isInitialized) {
        console.log('[TOKEN_REFRESHER] ⚠️ Google Drive не инициализирован, пропускаем проверку');
        return;
      }
      
      const isValid = await this.checkTokenValidity();
      
      if (!isValid) {
        console.log('[TOKEN_REFRESHER] 🔄 Токен невалиден, обновляем...');
        const success = await this.refreshToken();
        
        if (success) {
          console.log('[TOKEN_REFRESHER] ✅ Токен успешно обновлен');
        } else {
          console.log('[TOKEN_REFRESHER] ❌ Не удалось обновить токен');
        }
      }
      
      this.lastCheck = new Date();
    } catch (error) {
      console.error('[TOKEN_REFRESHER] ❌ Ошибка проверки токена:', error.message);
    }
  }

  /**
   * Останавливает автоматическую проверку
   */
  stopAutoRefresh() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.isRunning = false;
    console.log('[TOKEN_REFRESHER] 🛑 Автообновление остановлено');
  }

  /**
   * Получает статус автообновления
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      lastCheck: this.lastCheck,
      checkInterval: this.checkInterval ? 'active' : 'inactive'
    };
  }

  /**
   * Возвращает OAuth2 клиент
   */
  getOAuth2Client() {
    return this.oauth2Client;
  }
}

module.exports = new TokenAutoRefresher(); 