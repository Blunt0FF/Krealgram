# Исправления модалки подписчиков/подписок

## Проблемы и решения

### 1. Блокировка скрола фона при открытой модалке ✅

**Проблема:** При открытии модалки подписчиков/подписок фон продолжал прокручиваться.

**Решение:** Добавлен `useEffect` в компонент `FollowersModal` для блокировки скрола:
```javascript
React.useEffect(() => {
  if (isOpen) {
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = 'hidden';
    document.body.style.paddingRight = `${scrollbarWidth}px`;
  } else {
    document.body.style.overflow = '';
    document.body.style.paddingRight = '0';
  }

  return () => {
    document.body.style.overflow = '';
    document.body.style.paddingRight = '0';
  };
}, [isOpen]);
```

### 2. Отображение DELETED USER ✅

**Проблема:** Удаленные пользователи не отображались корректно в списке подписчиков/подписок.

**Решение:** 
- Добавлена проверка на существование `user.username`
- Для удаленных пользователей отображается "DELETED USER" с серым аватаром
- Добавлены специальные CSS классы для стилизации удаленных пользователей

```javascript
{user.username ? (
  <Link to={`/profile/${user.username}`} onClick={onClose} className="follower-link">
    // ... обычный пользователь
  </Link>
) : (
  <div className="follower-link deleted-user">
    <img src="/default-avatar.png" alt="Deleted user" className="follower-avatar deleted-avatar" />
    <span className="follower-username deleted-username">DELETED USER</span>
  </div>
)}
```

### 3. Логика удаления подписчиков ✅

**Проблема:** Отсутствовала возможность удаления подписчиков владельцем профиля.

**Решения:**

#### Backend (новый API эндпоинт):
- Добавлен маршрут: `DELETE /api/users/:userId/followers/:followerId`
- Создан контроллер `removeFollower` в `userController.js`
- Проверка прав доступа (только владелец профиля может удалять подписчиков)
- Транзакционное удаление из обеих коллекций (followers/following)
- Удаление связанных уведомлений

#### Frontend:
- Добавлена кнопка удаления (крестик) для каждого подписчика
- Кнопка появляется только при наведении и только для владельца профиля
- Функция `removeFollower` для вызова API
- Обновление локального состояния после успешного удаления

### 4. CSS стили ✅

Добавлены новые стили в `Profile.css`:

```css
/* Структура элементов */
.follower-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.follower-link {
  display: flex;
  align-items: center;
  gap: 12px;
  text-decoration: none;
  color: #262626;
  padding: 8px 0;
  flex: 1;
}

/* Удаленные пользователи */
.follower-link.deleted-user {
  cursor: default;
  opacity: 0.6;
}

.follower-username.deleted-username {
  color: #8e8e8e;
  font-style: italic;
  font-weight: 400;
}

.follower-avatar.deleted-avatar {
  opacity: 0.6;
  filter: grayscale(100%);
}

/* Кнопка удаления */
.remove-follower-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  border-radius: 50%;
  transition: all 0.2s;
  color: #8e8e8e;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  opacity: 0;
  transform: scale(0.8);
}

.follower-item:hover .remove-follower-btn {
  opacity: 1;
  transform: scale(1);
}

.remove-follower-btn:hover {
  background-color: rgba(237, 73, 86, 0.1);
  color: #ed4956;
}
```

### 5. Мобильная адаптация ✅

- Кнопки удаления всегда видны на мобильных устройствах
- Уменьшенные размеры элементов для лучшего отображения на малых экранах
- Адаптивные отступы и размеры шрифтов

## Функциональность

### Что работает:
✅ Блокировка скрола фона при открытой модалке  
✅ Отображение "DELETED USER" для удаленных аккаунтов  
✅ Удаление подписчиков владельцем профиля (только в модалке "Followers")  
✅ Анимированные кнопки удаления  
✅ Обновление счетчиков в реальном времени  
✅ Мобильная адаптация  
✅ Правильная обработка ошибок API  

### Ограничения:
- Удаление доступно только для подписчиков (Followers), не для подписок (Following)
- Кнопка удаления отображается только владельцу профиля
- Удаленные пользователи не кликабельны

## Технические детали

### API эндпоинт:
```
DELETE /api/users/:userId/followers/:followerId
```

### Параметры:
- `userId` - ID владельца профиля
- `followerId` - ID подписчика для удаления

### Авторизация:
- Требуется Bearer token
- Проверка, что текущий пользователь является владельцем профиля

### Ответ:
```json
{
  "message": "Подписчик успешно удален.",
  "followersCount": 42,
  "followingCount": 15
}
```

Все изменения протестированы и готовы к использованию. 