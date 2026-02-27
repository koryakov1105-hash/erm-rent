import express, { Request, Response } from 'express';
import { dbAll, dbGet, dbInsert, dbUpdate, dbDelete } from '../database/init';

const router = express.Router();

// GET /api/bank-accounts - список банковских счетов
router.get('/', async (req: Request, res: Response) => {
  try {
    const accounts = dbAll('bank_accounts');
    res.setHeader('Cache-Control', 'no-store');
    res.json(accounts);
  } catch (error) {
    console.error('Error fetching bank accounts:', error);
    res.status(500).json({ error: 'Failed to fetch bank accounts' });
  }
});

// GET /api/bank-accounts/:id - получить счёт по ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const account = dbGet('bank_accounts', parseInt(id));
    if (!account) {
      return res.status(404).json({ error: 'Bank account not found' });
    }
    res.json(account);
  } catch (error) {
    console.error('Error fetching bank account:', error);
    res.status(500).json({ error: 'Failed to fetch bank account' });
  }
});

// POST /api/bank-accounts - создать банковский счёт
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, account_number, comment } = req.body;
    if (!name || !account_number) {
      return res.status(400).json({ error: 'name and account_number are required' });
    }
    const account = dbInsert('bank_accounts', {
      name: String(name).trim(),
      account_number: String(account_number).trim(),
      comment: comment != null ? String(comment).trim() || null : null
    });
    res.status(201).json(account);
  } catch (error) {
    console.error('Error creating bank account:', error);
    res.status(500).json({ error: 'Failed to create bank account' });
  }
});

// PUT /api/bank-accounts/:id - обновить банковский счёт
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, account_number, comment } = req.body;
    const existing = dbGet('bank_accounts', parseInt(id));
    if (!existing) {
      return res.status(404).json({ error: 'Bank account not found' });
    }
    const updates: any = {};
    if (name !== undefined) updates.name = String(name).trim();
    if (account_number !== undefined) updates.account_number = String(account_number).trim();
    if (comment !== undefined) updates.comment = comment != null ? String(comment).trim() || null : null;
    const account = dbUpdate('bank_accounts', parseInt(id), updates);
    res.json(account);
  } catch (error) {
    console.error('Error updating bank account:', error);
    res.status(500).json({ error: 'Failed to update bank account' });
  }
});

// DELETE /api/bank-accounts/:id - удалить банковский счёт
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deleted = dbDelete('bank_accounts', parseInt(id));
    if (!deleted) {
      return res.status(404).json({ error: 'Bank account not found' });
    }
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting bank account:', error);
    res.status(500).json({ error: 'Failed to delete bank account' });
  }
});

export default router;
