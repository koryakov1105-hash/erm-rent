# Релиз ERP квадрат

Пошаговая инструкция по техническому выпуску программы в production.

---

## 1. Подготовка окружения

### Переменные окружения

Перед сборкой и запуском задайте переменные (в `.env` в папке backend или в системе):

| Переменная | Описание | Пример |
|------------|----------|--------|
| `NODE_ENV` | Режим работы | `production` |
| `PORT` | Порт сервера | `3002` (или любой свободный) |
| `JWT_SECRET` | Секрет для JWT (обязательно в production) | Длинная случайная строка |
| `DB_PATH` | Папка с файлом БД (по желанию) | `/var/data/erm-rent` |
| `HOST` | Хост сервера (для listen) | `0.0.0.0` (доступ снаружи) |

**Важно:** в production обязательно задайте `JWT_SECRET` (не используйте значение по умолчанию).

Пример `.env` в папке `backend`:

```env
NODE_ENV=production
PORT=3002
JWT_SECRET=ваш_длинный_секретный_ключ_минимум_32_символа
DB_PATH=./data
HOST=0.0.0.0
```

---

## 2. Варианты релиза

### Вариант A: Один сервер (фронт + API на одном порту)

Фронтенд собирается и отдаётся бэкендом. Пользователи заходят на один адрес (например `https://your-server:3002`).

#### Шаги

1. **Сборка и подготовка статики** (из корня проекта):

   ```bash
   npm run release
   ```

   Эта команда собирает бэкенд и фронтенд, затем копирует `frontend/dist` в `backend/public`. Либо по шагам:

   ```bash
   npm run build
   npm run copy-frontend
   ```

2. **Запуск** (обязательно задайте `NODE_ENV=production` и `JWT_SECRET`):

   ```bash
   NODE_ENV=production JWT_SECRET=ваш_секрет node backend/dist/index.js
   ```

   Или из корня:

   ```bash
   cd backend && NODE_ENV=production JWT_SECRET=ваш_секрет npm run start
   ```

3. Откройте в браузере: `http://localhost:3002` (или ваш хост и порт). Откроется интерфейс ERP квадрат; API доступен по тому же адресу с префиксом `/api`.

Подробнее про раздачу статики бэкендом — в разделе 4.

---

### Вариант B: Фронт и API на разных серверах

Фронтенд размещается на статическом хостинге (Vercel, Netlify, nginx, CDN), API — отдельно (VPS, Render, Railway и т.п.).

#### Шаги

1. **Сборка фронтенда с URL API:**

   ```bash
   cd frontend
   VITE_API_URL=https://your-api.example.com/api npm run build
   ```

   Вместо `https://your-api.example.com/api` подставьте полный URL вашего API до пути `/api`.

2. Содержимое папки `frontend/dist` загрузите на хостинг (или настройте деплой из этой папки).

3. Бэкенд запустите на своём сервере:

   ```bash
   cd backend
   NODE_ENV=production PORT=3002 JWT_SECRET=... node dist/index.js
   ```

4. На API-сервере настройте CORS, если домен фронта отличается от домена API (в коде уже `cors()` без ограничений — для строгого production можно сузить `origin`).

---

## 3. Сборка по шагам (из корня проекта)

```bash
# Установка зависимостей (если ещё не ставили)
npm install

# Сборка бэкенда (TypeScript → backend/dist)
npm run build:backend

# Сборка фронтенда (React → frontend/dist)
npm run build:frontend
```

Одна команда:

```bash
npm run build
```

Порядок важен: сначала backend, потом frontend (для варианта A можно настроить копирование `frontend/dist` в `backend/public` после сборки).

---

## 4. Раздача фронта с бэкенда (вариант A)

Бэкенд при `NODE_ENV=production` и наличии папки `backend/public` отдаёт из неё статику и для любых не-API путей возвращает `index.html` (SPA). Чтобы собрать и скопировать фронт одной командой:

```bash
npm run release
```

Скрипт `scripts/copy-frontend.js` копирует `frontend/dist` в `backend/public`. В `backend/src/index.ts` настроены `express.static(publicDir)` и fallback на `index.html`.

---

## 5. Проверка после релиза

- Открыть в браузере главную страницу.
- Войти / зарегистрироваться.
- Проверить основные разделы: объекты, юниты, арендаторы, договоры, финансы.
- Проверить, что API отвечает: `GET /api/health` возвращает `{ "status": "ok" }`.

---

## 6. Где хранятся данные

- По умолчанию БД — один JSON-файл в папке из `DB_PATH` (или в системной temp).
- В production задайте `DB_PATH` на постоянный каталог с бэкапами.
- Резервное копирование: копируйте файл `data.json` из этой папки.

---

## Краткая шпаргалка (один сервер)

```bash
# 1. Переменные (в backend/.env или export)
export NODE_ENV=production
export JWT_SECRET=ваш_секрет_32_символа_и_больше
export PORT=3002
export HOST=0.0.0.0

# 2. Сборка и копирование фронта в backend/public
npm run release

# 3. Запуск
cd backend && npm run start
# Или из корня: npm run start
```

После этого приложение доступно по адресу `http://<ваш-хост>:3002`.
