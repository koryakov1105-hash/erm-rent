# Запуск онлайн и ссылка для первых пользователей

Чтобы выложить приложение в интернет и скинуть ссылку тестерам, нужно разместить **бэкенд** и **фронтенд** на бесплатных хостингах и связать их.

---

## Вариант 1: Render (бэкенд + фронтенд в одном месте)

[Render](https://render.com) даёт бесплатный тариф для Web Service (бэкенд) и Static Site (фронтенд).

### Шаг 1: Репозиторий на GitHub

1. Создайте репозиторий на [GitHub](https://github.com).
2. Загрузите проект (или подключите папку через `git remote add origin ...` и сделайте `git push -u origin main`).

### Шаг 2: Бэкенд на Render

1. Зайдите на [dashboard.render.com](https://dashboard.render.com), войдите через GitHub.
2. **New → Web Service**.
3. Подключите репозиторий с проектом.
4. Настройки:
   - **Name:** `erm-rent-api` (или любое).
   - **Root Directory:** `backend`.
   - **Runtime:** Node.
   - **Build Command:** `npm install --include=dev && npm run build`
   - **Start Command:** `npm start`
   - **Plan:** Free.
5. В **Environment** добавьте при необходимости:
   - `NODE_ENV` = `production`
   - `JWT_SECRET` = придумайте длинный секретный ключ (для продакшена).
6. Нажмите **Create Web Service**. Дождитесь деплоя.
7. Скопируйте **URL сервиса**, например: `https://erm-rent-api.onrender.com` — это адрес вашего API.

**Важно:** на бесплатном тарифе сервис «засыпает» после 15 минут без запросов. Первый запрос после этого может открываться 30–60 секунд — предупредите тестеров.

### Шаг 3: Фронтенд на Render (Static Site)

1. В Render: **New → Static Site**.
2. Тот же репозиторий.
3. Настройки:
   - **Name:** `erm-rent-app`
   - **Root Directory:** `frontend`
   - **Build Command:** `npm install --include=dev && npm run build`
   - **Publish Directory:** `dist`
4. В **Environment** добавьте переменную:
   - **Key:** `VITE_API_URL`
   - **Value:** `https://ВАШ-БЭКЕНД-URL.onrender.com/api`  
     (подставьте ваш URL из шага 2, в конце обязательно `/api`).
5. **Create Static Site**. Дождитесь сборки.
6. Скопируйте **URL сайта**, например: `https://erm-rent-app.onrender.com` — **эту ссылку и нужно скидывать первым пользователям.**

Пользователи открывают ссылку, регистрируются и тестируют систему.

---

## Вариант 2: Бэкенд на Render, фронтенд на Vercel

Если удобнее разнести сервисы.

### Бэкенд

Как в **Варианте 1, шаги 1–2**. Запомните URL API, например `https://erm-rent-api.onrender.com`.

### Фронтенд на Vercel

1. Зайдите на [vercel.com](https://vercel.com), войдите через GitHub.
2. **Add New → Project**, выберите репозиторий.
3. **Root Directory:** укажите `frontend` (или оставьте корень и в Build Settings задайте папку).
4. **Framework Preset:** Vite.
5. **Build Command:** `npm run build`
6. **Output Directory:** `dist`
7. В **Environment Variables** добавьте:
   - **Name:** `VITE_API_URL`
   - **Value:** `https://ВАШ-БЭКЕНД-URL.onrender.com/api`
8. Deploy. Vercel выдаст URL вида `https://ваш-проект.vercel.app` — **эту ссылку даёте тестерам.**

---

## Что сказать первым пользователям

Можно отправить короткое сообщение:

> **Тест ERP Rent (управление недвижимостью)**  
> Ссылка: https://ваш-сайт.onrender.com (или .vercel.app)  
> 1. Откройте ссылку.  
> 2. Нажмите «Регистрация», введите email и пароль (от 6 символов).  
> 3. После входа можно создавать объекты, юниты, арендаторов, договоры и вносить платежи в разделе «Финансы».  
> Если сайт долго грузится при первом открытии — подождите 30–60 секунд (сервер просыпается).

---

## Про данные на бесплатном тарифе

- На Render (free) у Web Service **нет постоянного диска**: при перезапуске или редплое данные из JSON могут обнулиться. Для короткого теста первых пользователей этого обычно хватает.
- Для постоянной работы позже можно подключить базу (например PostgreSQL на Render) и доработать бэкенд под неё.

---

## Краткий чек-лист

- [ ] Код в GitHub.
- [ ] Render: Web Service (backend), скопирован URL API.
- [ ] Render Static Site или Vercel: фронтенд с переменной `VITE_API_URL` = `https://...onrender.com/api`.
- [ ] Открыта ссылка на фронтенд, проверены регистрация и вход.
- [ ] Ссылка отправлена тестерам.
