import express, { Response } from 'express';
import { dbAll, dbGet, dbInsert, dbUpdate, dbDelete } from '../database/init';
import { invalidateLedgerCache } from '../lib/ledgerResolve';
import { appendAudit } from '../lib/auditLog';
import type { AuthRequest } from '../middleware/auth';

const router = express.Router();

function getUserId(req: AuthRequest): number | null {
  return typeof req.userId === 'number' ? req.userId : null;
}

router.get('/', (_req, res: Response) => {
  try {
    const list = dbAll('ledger_accounts');
    res.json(Array.isArray(list) ? list : []);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to list ledger accounts' });
  }
});

router.get('/:id', (req, res: Response) => {
  try {
    const row = dbGet('ledger_accounts', parseInt(req.params.id, 10));
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to get ledger account' });
  }
});

router.post('/', (req: AuthRequest, res: Response) => {
  try {
    const { code, name, kind, cfs_activity, pl_group, mapped_categories } = req.body;
    if (!code || !name || !kind) {
      return res.status(400).json({ error: 'code, name, kind обязательны' });
    }
    if (kind !== 'income' && kind !== 'expense') {
      return res.status(400).json({ error: 'kind: income | expense' });
    }
    const row = dbInsert('ledger_accounts', {
      code: String(code).trim(),
      name: String(name).trim(),
      kind,
      cfs_activity: cfs_activity || 'operating',
      pl_group: pl_group || (kind === 'income' ? 'revenue' : 'operating_expense'),
      mapped_categories: Array.isArray(mapped_categories) ? mapped_categories : [],
    });
    invalidateLedgerCache();
    appendAudit({
      action: 'create',
      entity_type: 'ledger_account',
      entity_id: row.id,
      user_id: getUserId(req),
    });
    res.status(201).json(row);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to create ledger account' });
  }
});

router.put('/:id', (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const cur = dbGet('ledger_accounts', id);
    if (!cur) return res.status(404).json({ error: 'Not found' });
    const { code, name, kind, cfs_activity, pl_group, mapped_categories } = req.body;
    const updates: any = {};
    if (code !== undefined) updates.code = String(code).trim();
    if (name !== undefined) updates.name = String(name).trim();
    if (kind !== undefined) {
      if (kind !== 'income' && kind !== 'expense') {
        return res.status(400).json({ error: 'kind: income | expense' });
      }
      updates.kind = kind;
    }
    if (cfs_activity !== undefined) updates.cfs_activity = cfs_activity;
    if (pl_group !== undefined) updates.pl_group = pl_group;
    if (mapped_categories !== undefined) {
      updates.mapped_categories = Array.isArray(mapped_categories) ? mapped_categories : [];
    }
    const row = dbUpdate('ledger_accounts', id, updates);
    invalidateLedgerCache();
    appendAudit({ action: 'update', entity_type: 'ledger_account', entity_id: id, user_id: getUserId(req) });
    res.json(row);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to update ledger account' });
  }
});

router.delete('/:id', (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const txs = dbAll('transactions') as any[];
    if (Array.isArray(txs) && txs.some((t) => t.ledger_account_id === id)) {
      return res.status(400).json({ error: 'Счёт используется в транзакциях' });
    }
    if (!dbDelete('ledger_accounts', id)) return res.status(404).json({ error: 'Not found' });
    invalidateLedgerCache();
    appendAudit({ action: 'delete', entity_type: 'ledger_account', entity_id: id, user_id: getUserId(req) });
    res.status(204).send();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to delete ledger account' });
  }
});

export default router;
