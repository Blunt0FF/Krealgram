const { google } = require('googleapis');
const fs = require('fs').promises;
const path = require('path');

class TokenManager {
  constructor() {
    this.oauth2Client = null;
    this.envPath = path.join(__dirname, '..', '.env');
  }

  async initialize() {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      'http://localhost:3000/auth/google/callback'
    );

    // Устанавливаем текущие токены
    this.oauth2Client.setCredentials({
      access_token: process.env.GOOGLE_DRIVE_ACCESS_TOKEN,
      refresh_token: process.env.GOOGLE_DRIVE_REFRESH_TOKEN
    });

    // Настраиваем автоматическое обновление токенов
    this.oauth2Client.on('tokens', async (tokens) => {
      console.log('[TOKEN_MANAGER] 🔄 Получены новые токены');
      await this.updateEnvFile(tokens);
    });
  }

  async updateEnvFile(tokens) {
    try {
      let envContent = await fs.readFile(this.envPath, 'utf8');
      
      if (tokens.access_token) {
        envContent = envContent.replace(
          /GOOGLE_DRIVE_ACCESS_TOKEN=.*/g,
          `GOOGLE_DRIVE_ACCESS_TOKEN=${tokens.access_token}`
        );
      }
      
      if (tokens.refresh_token) {
        envContent = envContent.replace(
          /GOOGLE_DRIVE_REFRESH_TOKEN=.*/g,
          `GOOGLE_DRIVE_REFRESH_TOKEN=${tokens.refresh_token}`
        );
      }

      await fs.writeFile(this.envPath, envContent);
      console.log('[TOKEN_MANAGER] ✅ .env файл обновлен');
      
      // Обновляем переменные окружения
      if (tokens.access_token) {
        process.env.GOOGLE_DRIVE_ACCESS_TOKEN = tokens.access_token;
      }
      if (tokens.refresh_token) {
        process.env.GOOGLE_DRIVE_REFRESH_TOKEN = tokens.refresh_token;
      }
    } catch (error) {
      console.error('[TOKEN_MANAGER] ❌ Ошибка обновления .env файла:', error.message);
    }
  }

  async refreshTokens() {
    try {
      console.log('[TOKEN_MANAGER] 🔄 Обновление токенов...');
      const { credentials } = await this.oauth2Client.refreshAccessToken();
      await this.updateEnvFile(credentials);
      return credentials;
    } catch (error) {
      console.error('[TOKEN_MANAGER] ❌ Ошибка обновления токенов:', error.message);
      throw error;
    }
  }

  getOAuth2Client() {
    return this.oauth2Client;
  }
}

module.exports = new TokenManager(); 