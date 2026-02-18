#!/usr/bin/env node
/**
 * Утилита для сброса пароля пользователя
 * ВНИМАНИЕ: Только для разработки! Не использовать в production!
 * 
 * Использование:
 *   npm run reset-password -- koryakovmv2019@yandex.ru новый_пароль
 *   или
 *   ts-node src/scripts/reset-password.ts koryakovmv2019@yandex.ru новый_пароль
 */

import { hashPassword } from '../auth/hash';
import { dbAll, dbQuery, dbUpdate } from '../database/init';

const email = process.argv[2];
const newPassword = process.argv[3];

if (!email || !newPassword) {
  console.error('Использование: npm run reset-password -- <email> <новый_пароль>');
  console.error('Пример: npm run reset-password -- koryakovmv2019@yandex.ru MyNewPassword123');
  process.exit(1);
}

if (newPassword.length < 6) {
  console.error('Ошибка: Пароль должен быть не менее 6 символов');
  process.exit(1);
}

try {
  const emailNorm = email.trim().toLowerCase();
  const users = dbQuery('users', (u: any) => u && u.email === emailNorm);
  
  if (users.length === 0) {
    console.error(`Ошибка: Пользователь с email ${emailNorm} не найден`);
    process.exit(1);
  }

  const user = users[0];
  const passwordHash = hashPassword(newPassword);
  
  dbUpdate('users', user.id, { password_hash: passwordHash });
  
  console.log(`✅ Пароль успешно изменён для пользователя: ${emailNorm}`);
  console.log(`   Новый пароль: ${newPassword}`);
  console.log(`   ID пользователя: ${user.id}`);
  console.log('');
  console.log('⚠️  ВНИМАНИЕ: Это только для разработки! В production используйте безопасный механизм восстановления пароля.');
} catch (error: any) {
  console.error('Ошибка при сбросе пароля:', error.message);
  process.exit(1);
}
