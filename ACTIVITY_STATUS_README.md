# User Activity Status Feature

## Описание

Добавлен функционал отображения времени последней активности пользователей в сообщениях. 

## Функции

### Отображение статуса
- **Если пользователь онлайн**: "Active now"
- **Если меньше 1 часа**: "Active 23 minutes ago"
- **Если меньше 12 часов**: "Active 5 hours ago"
- **Если больше 12 часов**: "was online 18 June at 20:21"

### Где отображается
1. **В заголовке чата** - под именем пользователя
2. **В списке диалогов** - зеленая точка для онлайн пользователей

## Технические детали

### Backend изменения:
1. `models/userModel.js` - поля `lastActive` и `isOnline`
2. `controllers/authController.js` - добавлен роут `/logout`
3. `middlewares/authMiddleware.js` - обновление статуса при каждом запросе
4. `index.js` - WebSocket обработка подключений/отключений

### Frontend изменения:
1. `utils/timeUtils.js` - функция `formatLastSeen()`
2. `components/Messages/Messages.jsx` - отображение статуса
3. `components/Messages/Messages.css` - стили для индикаторов
4. `App.jsx` - обновленная функция logout

## Использование

```javascript
import { formatLastSeen } from '../utils/timeUtils';

// Пример использования
const status = formatLastSeen(user.lastActive, user.isOnline);
console.log(status); // "Active now" или "was online 18 June at 20:21"
```

## Автоматическое обновление

- Статус обновляется каждую минуту
- WebSocket подключения отслеживают онлайн/оффлайн статус
- API logout устанавливает статус оффлайн при выходе 