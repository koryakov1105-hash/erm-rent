import express, { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { dbAll, dbQuery, dbInsert } from '../database/init';
import { hashPassword, verifyPassword } from '../auth/hash';
import { signToken } from '../middleware/auth';

const JWT_SECRET = process.env.JWT_SECRET || 'erm-rent-secret-change-in-production';

const router = express.Router();

// POST /api/auth/register — регистрация (первый пользователь создаёт аккаунт)
router.post('/register', async (req: Request, res: Response) => {
  let step = '';
  try {
    const { email, password, name } = req.body;
    step = 'validate';
    if (!email || !password) {
      return res.status(400).json({ error: 'Укажите email и пароль' });
    }

    const emailNorm = String(email).trim().toLowerCase();
    if (emailNorm.length < 3) {
      return res.status(400).json({ error: 'Email слишком короткий' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Пароль должен быть не менее 6 символов' });
    }

    let existing;
    try {
      const existingUsers = dbQuery('users', (u: any) => u && u.email === emailNorm);
      existing = Array.isArray(existingUsers) ? existingUsers[0] : null;
    } catch (e) {
      console.error('dbQuery users failed in register:', e);
      return res.status(500).json({ error: 'Ошибка регистрации', detail: 'Ошибка чтения данных' });
    }
    if (existing) {
      return res.status(400).json({ error: 'Пользователь с таким email уже зарегистрирован' });
    }

    step = 'hashPassword';
    const passwordHash = hashPassword(String(password));

    step = 'dbInsert';
    let isFirst = false;
    let allUsers: any[] = [];
    try {
      allUsers = dbAll('users');
      isFirst = Array.isArray(allUsers) ? allUsers.length === 0 : true;
    } catch (e) {
      console.error('dbAll users failed:', e);
      return res.status(500).json({ error: 'Ошибка регистрации', detail: 'Ошибка чтения данных' });
    }
    
    let user;
    try {
      user = dbInsert('users', {
        email: emailNorm,
        password_hash: passwordHash,
        name: (name && String(name).trim()) || emailNorm,
        is_first: isFirst,
        created_at: new Date().toISOString()
      });
    } catch (e) {
      console.error('dbInsert users failed:', e);
      return res.status(500).json({ error: 'Ошибка регистрации', detail: 'Ошибка записи данных' });
    }

    if (!user || !user.id) {
      return res.status(500).json({ error: 'Ошибка регистрации', detail: 'Не удалось создать пользователя' });
    }

    step = 'signToken';
    let token;
    try {
      token = signToken(user.id);
    } catch (e) {
      console.error('signToken failed:', e);
      return res.status(500).json({ error: 'Ошибка регистрации', detail: 'Ошибка создания токена' });
    }
    res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        is_first: user.is_first
      }
    });
  } catch (error: any) {
    console.error('Error registering user at step:', step, error);
    const message = (error?.message || String(error) || 'Ошибка регистрации').toString();
    res.status(500).json({
      error: process.env.NODE_ENV === 'production' ? 'Ошибка регистрации' : `[${step}] ${message}`,
    });
  }
});

// POST /api/auth/login — вход
router.post('/login', async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const email = body.email;
    const password = body.password;

    if (!email || !password) {
      return res.status(400).json({ error: 'Укажите email и пароль' });
    }

    const emailNorm = String(email).trim().toLowerCase();
    let users: any[] = [];
    try {
      users = dbQuery('users', (u: any) => u && u.email === emailNorm);
    } catch (e) {
      console.error('dbQuery users failed:', e);
      return res.status(500).json({ error: 'Ошибка входа', detail: 'Ошибка чтения данных' });
    }
    const user = Array.isArray(users) ? users[0] : null;

    if (!user || typeof user.password_hash !== 'string') {
      return res.status(401).json({ error: 'Неверный email или пароль' });
    }

    let passwordValid = false;
    try {
      passwordValid = verifyPassword(String(password), user.password_hash);
    } catch (e) {
      console.error('verifyPassword failed:', e);
      return res.status(500).json({ error: 'Ошибка входа', detail: 'Ошибка проверки пароля' });
    }

    if (!passwordValid) {
      return res.status(401).json({ error: 'Неверный email или пароль' });
    }

    let token;
    try {
      token = signToken(user.id);
    } catch (e) {
      console.error('signToken failed:', e);
      return res.status(500).json({ error: 'Ошибка входа', detail: 'Ошибка создания токена' });
    }
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email ?? emailNorm,
        name: user.name ?? emailNorm,
        is_first: user.is_first
      }
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error('Error logging in:', message, stack || '');
    res.status(500).json({
      error: 'Ошибка входа',
      ...(process.env.NODE_ENV !== 'production' && message && { detail: message })
    });
  }
});

// GET /api/auth/me — текущий пользователь (требует заголовок Authorization)
router.get('/me', (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return res.status(401).json({ error: 'Требуется авторизация' });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number };
    const users = dbAll('users');
    const user = users.find((u: any) => u.id === decoded.userId);

    if (!user) {
      return res.status(401).json({ error: 'Пользователь не найден' });
    }

    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      is_first: user.is_first
    });
  } catch {
    return res.status(401).json({ error: 'Недействительный токен' });
  }
});

export default router;
