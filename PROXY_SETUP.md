# 🔄 Проксирование Google Drive

## 📋 Обзор

Система проксирования Google Drive позволяет обходить ограничения Google Drive на публичный доступ к файлам. Вместо прямого обращения к Google Drive API, все запросы проходят через наш сервер.

## 🏗️ Архитектура

```
Клиент → /api/proxy-drive/:id → Сервер → Google Drive API → Сервер → Клиент
```

## 🔧 Настройка

### 1. Переменные окружения

Убедитесь, что в `.env` файле настроены:

```env
# Google Drive API
GOOGLE_DRIVE_CLIENT_ID=your_client_id
GOOGLE_DRIVE_CLIENT_SECRET=your_client_secret
GOOGLE_DRIVE_REFRESH_TOKEN=your_refresh_token

# Папки Google Drive
GOOGLE_DRIVE_POSTS_FOLDER_ID=folder_id_for_posts
GOOGLE_DRIVE_VIDEOS_FOLDER_ID=folder_id_for_videos
GOOGLE_DRIVE_AVATARS_FOLDER_ID=folder_id_for_avatars
GOOGLE_DRIVE_MESSAGES_FOLDER_ID=folder_id_for_messages
GOOGLE_DRIVE_PREVIEWS_FOLDER_ID=folder_id_for_previews
GOOGLE_DRIVE_GIFS_FOLDER_ID=folder_id_for_gifs
```

### 2. API Endpoints

#### GET `/api/proxy-drive/:id`
Проксирует файл с Google Drive по ID.

**Параметры:**
- `id` - ID файла Google Drive или закодированный URL
- `type` (query) - тип медиа (image, video, avatar, message)

**Примеры:**
```javascript
// Прямой ID файла
GET /api/proxy-drive/1a2B3c4D5EfG6H7I8J9K0L1M2N3O4P5Q6R7S8T9U0V1W2X3Y4Z5

// Закодированный URL
GET /api/proxy-drive/https%3A//example.com/image.jpg

// С типом
GET /api/proxy-drive/1a2B3c4D5EfG6H7I8J9K0L1M2N3O4P5Q6R7S8T9U0V1W2X3Y4Z5?type=video
```

#### HEAD `/api/proxy-drive/:id`
Получает метаданные файла без загрузки содержимого.

#### OPTIONS `/api/proxy-drive/:id`
CORS preflight запрос.

## 🔄 Fallback механизм

Если Google Drive API недоступен, система автоматически использует прямой доступ:

1. **Google Drive API** (основной)
2. **Прямой доступ** `https://drive.google.com/uc?export=download&id=FILE_ID` (fallback)

## 📱 Использование во фронтенде

### Обработка URL

```javascript
import { processMediaUrl } from './utils/urlUtils';

// Автоматическое проксирование Google Drive URL
const imageUrl = processMediaUrl('https://drive.google.com/uc?id=FILE_ID', 'image');
// Результат: https://your-api.com/api/proxy-drive/FILE_ID?type=image

// Проксирование внешних URL
const externalUrl = processMediaUrl('https://example.com/image.jpg', 'image');
// Результат: https://your-api.com/api/proxy-drive/https%3A//example.com/image.jpg?type=image
```

### Поддерживаемые форматы Google Drive URL

```javascript
// Все эти форматы автоматически обрабатываются:
'https://drive.google.com/uc?id=FILE_ID'
'https://drive.google.com/file/d/FILE_ID/view'
'https://drive.google.com/open?id=FILE_ID'
'https://drive.google.com/uc?export=download&id=FILE_ID'
```

## 🛠️ Отладка

### Тестирование прокси

```bash
# Запуск тестового скрипта
node test-proxy.js

# Ручное тестирование
curl -I "http://localhost:3000/api/proxy-drive/FILE_ID"
```

### Логи

Проксирование логирует все запросы с префиксом `[PROXY-DRIVE]`:

```
[PROXY-DRIVE] Запрос на проксирование файла FILE_ID
[PROXY-DRIVE_FULL_DEBUG] File metadata: { mimeType, fileName, fileSize }
[PROXY-DRIVE_FULL_DEBUG] Файл FILE_ID полностью отправлен на фронт
```

## 🔒 Безопасность

### Разрешенные домены

```javascript
const ALLOWED_DOMAINS = [
  'krealgram.com',
  'www.krealgram.com',
  'krealgram.vercel.app',
  'localhost',
  'krealgram-backend.onrender.com',
  '127.0.0.1'
];
```

### CORS настройки

```javascript
'Access-Control-Allow-Origin': '*'
'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS'
'Access-Control-Allow-Headers': 'Range, Content-Range, Accept-Ranges'
```

## 📊 Производительность

### Кэширование

- **Фронтенд**: Кэш URL в `URL_CACHE` Map
- **Браузер**: `Cache-Control: public, max-age=31536000` (1 год)

### Оптимизации

- **Range requests**: Поддержка частичной загрузки файлов
- **Streaming**: Потоковая передача больших файлов
- **Timeout**: 10 секунд для внешних запросов

## 🚨 Обработка ошибок

### Типичные ошибки

1. **File not found (404)**: Файл не существует или недоступен
2. **Google Drive not initialized (500)**: Проблемы с API ключами
3. **Timeout (500)**: Внешний сервер не отвечает

### Fallback стратегия

```javascript
try {
  // 1. Google Drive API
  const file = await drive.drive.files.get({ fileId, alt: 'media' });
} catch (error) {
  // 2. Прямой доступ к Google Drive
  const directUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
  const response = await axios.get(directUrl);
}
```

## 🔄 Миграция

### Обновление существующих URL

```javascript
// Старый формат
'https://drive.google.com/uc?id=FILE_ID'

// Новый формат (автоматически обрабатывается)
'https://your-api.com/api/proxy-drive/FILE_ID?type=image'
```

## 📝 Примечания

- Все Google Drive URL автоматически проксируются
- Внешние URL проксируются только если не с разрешенного домена
- Поддерживается Range requests для видео
- Автоматический fallback при недоступности Google Drive API 