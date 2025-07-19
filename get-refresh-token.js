const { google } = require('googleapis');
const http = require('http');
const url = require('url');
const open = require('open');

// Загружаем из .env
require('dotenv').config();

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = 'http://localhost:3000/auth/google/callback';

const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);

// Scopes для Google Drive
const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

// URL для авторизации
const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: SCOPES,
  prompt: 'consent'
});

console.log('🔗 Откройте эту ссылку в браузере:');
console.log(authUrl);

// Создаем сервер для получения callback
const server = http.createServer(async (req, res) => {
  const reqUrl = url.parse(req.url, true);
  
  if (reqUrl.pathname === '/auth/google/callback') {
    const code = reqUrl.query.code;
    
    if (code) {
      try {
        const { tokens } = await oauth2Client.getToken(code);
        
        console.log('✅ Успешно получен refresh token:');
        console.log('GOOGLE_CLIENT_ID=' + CLIENT_ID);
        console.log('GOOGLE_CLIENT_SECRET=' + CLIENT_SECRET);
        console.log('GOOGLE_REFRESH_TOKEN=' + tokens.refresh_token);
        
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
          <h1>✅ Успешно!</h1>
          <p>Токены получены. Проверьте консоль.</p>
          <p>Можете закрыть это окно.</p>
        `);
        
        server.close();
      } catch (error) {
        console.error('❌ Ошибка получения токенов:', error);
        res.writeHead(500, { 'Content-Type': 'text/html' });
        res.end('<h1>❌ Ошибка</h1>');
      }
    } else {
      res.writeHead(400, { 'Content-Type': 'text/html' });
      res.end('<h1>❌ Код авторизации не найден</h1>');
    }
  }
});

server.listen(3000, () => {
  console.log('🚀 Сервер запущен на http://localhost:3000');
  console.log('📋 Скопируйте CLIENT_ID и CLIENT_SECRET в начало файла');
  
  // Автоматически открываем браузер
  setTimeout(() => {
    open(authUrl);
  }, 1000);
}); 