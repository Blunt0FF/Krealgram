# Исправление проблем с мобильными устройствами

## Проблема
- С iPhone: "Error processing file. Please try again."
- С компьютера: все работает нормально
- CORS ошибки для запросов без Origin заголовка

## Исправления

### 1. CORS конфигурация
- ✅ Разрешен доступ для запросов без Origin (мобильные приложения)
- ✅ Добавлена поддержка HEAD запросов
- ✅ Расширены заголовки для User-Agent

### 2. Убрана защита от памяти
- ✅ Удален мониторинг памяти
- ✅ Убраны проверки критического уровня памяти
- ✅ Увеличены лимиты файлов до 50MB

### 3. Улучшена диагностика
- ✅ Добавлено логирование для мобильных устройств
- ✅ Тестовый endpoint `/api/posts/test-upload`
- ✅ Подробные ошибки загрузки файлов

### 4. Поддерживаемые типы файлов
```javascript
const allowedMimeTypes = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 
  'image/heic', 'image/heif', // iPhone
  'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'
];
```

## Тестирование

### Тестовый endpoint
```bash
curl -X POST http://localhost:3000/api/posts/test-upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "image=@test.jpg"
```

### Проверка CORS
```bash
curl -H "Origin: https://krealgram.com" \
  -H "Access-Control-Request-Method: POST" \
  -X OPTIONS http://localhost:3000/api/posts
```

## Логи для отладки

### Ключевые теги логов
- `[CORS_DEBUG]` - CORS запросы
- `[MOBILE_FILE_DEBUG]` - информация о файлах с мобильных
- `[MOBILE_UPLOAD_ERROR]` - ошибки загрузки с мобильных
- `[POST_CREATION_ERROR]` - ошибки создания постов

### Пример логов
```
[CORS_DEBUG] POST /api/posts - Origin: No origin
[MOBILE_FILE_DEBUG] { originalname: 'IMG_0521.jpeg', mimetype: 'image/jpeg', size: 4600806 }
```

## Результат
- ✅ Мобильные устройства работают
- ✅ Нет блокировки по памяти
- ✅ Подробная диагностика ошибок
- ✅ Поддержка всех типов файлов iPhone 