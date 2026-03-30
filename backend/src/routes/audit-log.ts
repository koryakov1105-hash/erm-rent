import express, { Response } from 'express';
import { dbAll } from '../database/init';
import type { AuthRequest } from '../middleware/auth';

const router = express.Router();

router.get('/', (req: AuthRequest, res: Response) => {
  try {
    const users = dbAll('users') as any[];
    const me = users.find((u) => u.id === req.userId);
    if (!me || me.role !== 'admin') {
      return res.status(403).json({ error: 'Доступ только для роли admin' });
    }
    const raw = dbAll('audit_log') as any[];
    const list = Array.isArray(raw) ? raw : [];
    const sorted = [...list].sort((a, b) => (b.id || 0) - (a.id || 0));
    res.json(sorted.slice(0, 500));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to read audit log' });
  }
});

export default router;
