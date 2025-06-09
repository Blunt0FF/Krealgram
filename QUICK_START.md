# 🚀 Быстрый запуск Instagram Clone

## Backend (порт 3000)
```bash
cd backend-2
npm install
npm start
```

## Frontend (порт 4000)
```bash
cd frontend
npm install  
npm start
```

### Или используйте скрипты:

**Backend:**
```bash
cd backend-2 && chmod +x start.sh && ./start.sh
```

**Frontend:**
```bash
cd frontend && ./start.sh
```

## 🌐 Доступ
- Frontend: http://localhost:4000
- Backend API: http://localhost:3000

## ✅ Исправленные проблемы:
- ❌ Ошибка "Objects are not valid as a React child" в сообщениях - исправлено
- ❌ Дата поста без стилей - исправлено, теперь под описанием
- ❌ Черные рамки в модальных окнах - исправлено
- ❌ Проблемы с пересылкой сообщений - исправлено

## 📝 Переменные окружения:
Создайте файл `.env` в backend-2:
```
JWT_SECRET=your_secret_key
MONGO_URI=mongodb://localhost:27017/instagram_clone
PORT=3000
``` 