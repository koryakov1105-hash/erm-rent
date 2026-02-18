# Как выложить проект на GitHub

Пошаговая инструкция для публикации репозитория **ERM Kvadrat** на GitHub.

---

## 1. Подготовка (уже сделано в проекте)

- В корне есть **`.gitignore`**: в репозиторий не попадут `node_modules/`, `dist/`, `.env`, базы данных, служебные папки.
- Файл **`backend/.env`** не коммитится — секреты остаются только у вас.
- Для других разработчиков добавлен **`backend/.env.example`** — список переменных без значений.

Перед первым коммитом убедитесь, что в корне проекта **нет** папки `.git` (если репозиторий ещё не инициализирован).

---

## 2. Создать репозиторий на GitHub

1. Зайдите на [github.com](https://github.com) и войдите в аккаунт.
2. Нажмите **«+»** → **«New repository»**.
3. Заполните:
   - **Repository name:** например `erm-kvadrat` или `ERM-Kvadrat`.
   - **Description:** по желанию, например «ERP для управления коммерческой недвижимостью».
   - **Public** или **Private** — на ваш выбор.
   - **НЕ** ставьте галочки «Add a README», «Add .gitignore», «Choose a license» — у вас уже есть свой код и .gitignore.
4. Нажмите **«Create repository»**.

На следующей странице GitHub покажет команды для подключения существующей папки — они понадобятся в шаге 4.

---

## 3. Инициализировать Git в папке проекта

Откройте терминал в корне проекта (папка, где лежат `backend`, `frontend`, `LAUNCH.md`, `.gitignore`):

```bash
cd "c:\Users\zolo1\ERM Kvadrat"
git init
```

Проверьте, что не попали лишние файлы:

```bash
git status
```

Должны быть только исходники (backend, frontend, скрипты, .md), без `node_modules`, без `.env`, без `dist` и т.п. Если что-то лишнее видно — добавьте это в `.gitignore` и снова `git status`.

---

## 4. Первый коммит и привязка к GitHub

Подставьте вместо `ВАШ_ЛОГИН` и `erm-kvadrat` свои значения (логин GitHub и имя репозитория).

```bash
git add .
git commit -m "Initial commit: ERP Rent (Квадрат)"
git branch -M main
git remote add origin https://github.com/ВАШ_ЛОГИН/erm-kvadrat.git
git push -u origin main
```

Если GitHub предложил использовать SSH:

```bash
git remote add origin git@github.com:ВАШ_ЛОГИН/erm-kvadrat.git
git push -u origin main
```

При первом `git push` может потребоваться авторизация (логин/пароль или токен, либо SSH-ключ).

---

## 5. Дальнейшая работа

- Вносите изменения в коде, затем:
  ```bash
  git add .
  git commit -m "Краткое описание изменений"
  git push
  ```
- Деплой по инструкции [DEPLOY.md](DEPLOY.md): подключите этот репозиторий к Render/Vercel — сервисы будут собирать проект из GitHub.

---

## Краткая шпаргалка

| Действие              | Команды |
|-----------------------|--------|
| Первый раз выложить   | `git init` → `git add .` → `git commit -m "..."` → `git remote add origin URL` → `git push -u origin main` |
| Обновить репозиторий  | `git add .` → `git commit -m "..."` → `git push` |
| Узнать адрес репо     | `git remote -v` |

Если репозиторий уже был создан ранее (`git init` уже выполнялся), достаточно выполнить шаг 4 без повторного `git init`: проверьте `git status`, при необходимости обновите `.gitignore`, затем `git add .`, `git commit`, `git remote add origin ...`, `git push -u origin main`.
