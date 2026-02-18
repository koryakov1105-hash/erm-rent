/**
 * Утилита для сброса пароля пользователя
 * ВНИМАНИЕ: Только для разработки! Не использовать в production!
 * 
 * Использование:
 *   node reset-password.js koryakovmv2019@yandex.ru новый_пароль
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Функция хэширования пароля (из auth/hash.ts)
function hashPassword(password) {
  const SALT_LEN = 16;
  const ITERATIONS = 100000;
  const KEY_LEN = 64;
  const DIGEST = 'sha512';
  
  const salt = crypto.randomBytes(SALT_LEN).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LEN, DIGEST).toString('hex');
  return `${salt}:${hash}`;
}

// Получение пути к БД
function getDefaultDbPath() {
  if (process.env.DB_PATH) return process.env.DB_PATH;
  return path.join(os.tmpdir(), 'erm-rent-db');
}

const DB_PATH = getDefaultDbPath();
const DATA_FILE = path.join(DB_PATH, 'data.json');

const email = process.argv[2];
const newPassword = process.argv[3];

if (!email || !newPassword) {
  console.error('Использование: node reset-password.js <email> <новый_пароль>');
  console.error('Пример: node reset-password.js koryakovmv2019@yandex.ru MyNewPassword123');
  process.exit(1);
}

if (newPassword.length < 6) {
  console.error('Ошибка: Пароль должен быть не менее 6 символов');
  process.exit(1);
}

try {
  // Загрузка данных
  if (!fs.existsSync(DATA_FILE)) {
    console.error(`Ошибка: Файл базы данных не найден: ${DATA_FILE}`);
    process.exit(1);
  }

  const fileData = fs.readFileSync(DATA_FILE, 'utf-8');
  const data = JSON.parse(fileData);
  
  if (!Array.isArray(data.users)) {
    console.error('Ошибка: Неверный формат базы данных');
    process.exit(1);
  }

  const emailNorm = email.trim().toLowerCase();
  const userIndex = data.users.findIndex(u => u && u.email === emailNorm);
  
  if (userIndex === -1) {
    console.error(`Ошибка: Пользователь с email ${emailNorm} не найден`);
    console.error(`Найденные пользователи:`, data.users.map(u => u.email).join(', '));
    process.exit(1);
  }

  const user = data.users[userIndex];
  const passwordHash = hashPassword(newPassword);
  
  // Обновление пароля
  data.users[userIndex] = {
    ...user,
    password_hash: passwordHash,
    updated_at: new Date().toISOString()
  };
  
  // Сохранение данных
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  
  console.log(`✅ Пароль успешно изменён для пользователя: ${emailNorm}`);
  console.log(`   Новый пароль: ${newPassword}`);
  console.log(`   ID пользователя: ${user.id}`);
  console.log(`   Файл БД: ${DATA_FILE}`);
  console.log('');
  console.log('⚠️  ВНИМАНИЕ: Это только для разработки! В production используйте безопасный механизм восстановления пароля.');
} catch (error) {
  console.error('Ошибка при сбросе пароля:', error.message);
  console.error(error.stack);
  process.exit(1);
}
