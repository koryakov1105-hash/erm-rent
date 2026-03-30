import express, { Request, Response } from 'express';
import { dbAll, dbGet, dbInsert, dbUpdate, dbDelete, dbQuery } from '../database/init';
import { getLedgerRowForTransaction } from '../lib/ledgerResolve';
import { appendAudit } from '../lib/auditLog';
import type { AuthRequest } from '../middleware/auth';

const router = express.Router();

function uid(req: AuthRequest): number | null {
  return typeof req.userId === 'number' ? req.userId : null;
}

router.get('/', (_req, res) => {
  try {
    const list = dbAll('budgets');
    res.json(Array.isArray(list) ? list : []);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to list budgets' });
  }
});

router.get('/:id/vs-actual', (req, res) => {
  try {
    const budgetId = parseInt(req.params.id, 10);
    const b = dbGet('budgets', budgetId) as any;
    if (!b) return res.status(404).json({ error: 'Not found' });
    const lines = dbQuery('budget_lines', (l: any) => l.budget_id === budgetId);
    const txs = dbAll('transactions') as any[];
    const start = b.period_start;
    const end = b.period_end;
    const filtered = txs.filter((t) => {
      if (!t || t.is_planned !== 0 || !t.date) return false;
      const d = String(t.date).split('T')[0];
      return d >= start && d <= end;
    });

    const actualByKey: Record<string, number> = {};
    for (const t of filtered) {
      const row = getLedgerRowForTransaction(t);
      const la = row?.id ?? 'unassigned';
      const pid = t.property_id ?? 'all';
      const key = `${la}:${pid}`;
      const amt = Number(t.amount) || 0;
      if (t.type === 'income') actualByKey[key] = (actualByKey[key] || 0) + amt;
      else actualByKey[key] = (actualByKey[key] || 0) - amt;
    }

    const comparison = lines.map((line: any) => {
      const la = line.ledger_account_id;
      const pid = line.property_id ?? 'all';
      const key = `${la}:${pid}`;
      const budget = Number(line.amount_plan) || 0;
      const actual = actualByKey[key] ?? 0;
      return {
        ...line,
        amount_actual: actual,
        variance: actual - budget,
        variance_pct: budget !== 0 ? Math.round(((actual - budget) / budget) * 1000) / 10 : null,
      };
    });

    res.setHeader('Cache-Control', 'no-store');
    res.json({
      budget: b,
      lines: comparison,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to compare budget' });
  }
});

router.get('/:id', (req, res) => {
  try {
    const b = dbGet('budgets', parseInt(req.params.id, 10));
    if (!b) return res.status(404).json({ error: 'Not found' });
    const lines = dbQuery('budget_lines', (l: any) => l.budget_id === (b as any).id);
    res.json({ ...b, lines });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to get budget' });
  }
});

router.post('/', (req: AuthRequest, res: Response) => {
  try {
    const { name, period_start, period_end } = req.body;
    if (!name || !period_start || !period_end) {
      return res.status(400).json({ error: 'name, period_start, period_end обязательны' });
    }
    const row = dbInsert('budgets', {
      name: String(name).trim(),
      period_start: String(period_start).split('T')[0],
      period_end: String(period_end).split('T')[0],
    });
    appendAudit({ action: 'create', entity_type: 'budget', entity_id: row.id, user_id: uid(req) });
    res.status(201).json(row);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to create budget' });
  }
});

router.put('/:id/lines', (req: AuthRequest, res: Response) => {
  try {
    const budgetId = parseInt(req.params.id, 10);
    const b = dbGet('budgets', budgetId);
    if (!b) return res.status(404).json({ error: 'Budget not found' });
    const { lines } = req.body;
    if (!Array.isArray(lines)) {
      return res.status(400).json({ error: 'lines должен быть массивом' });
    }
    const existing = dbQuery('budget_lines', (l: any) => l.budget_id === budgetId);
    for (const l of existing) dbDelete('budget_lines', l.id);
    const created: any[] = [];
    for (const line of lines) {
      const la = line.ledger_account_id != null ? parseInt(String(line.ledger_account_id), 10) : null;
      const pid = line.property_id != null && line.property_id !== '' ? parseInt(String(line.property_id), 10) : null;
      const amount = parseFloat(String(line.amount_plan ?? 0));
      const row = dbInsert('budget_lines', {
        budget_id: budgetId,
        ledger_account_id: la,
        property_id: pid,
        amount_plan: amount,
      });
      created.push(row);
    }
    appendAudit({ action: 'update', entity_type: 'budget_lines', entity_id: budgetId, user_id: uid(req) });
    res.json({ budget_id: budgetId, lines: dbQuery('budget_lines', (l: any) => l.budget_id === budgetId) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to save budget lines' });
  }
});

router.delete('/:id', (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const lines = dbQuery('budget_lines', (l: any) => l.budget_id === id);
    for (const l of lines) dbDelete('budget_lines', l.id);
    if (!dbDelete('budgets', id)) return res.status(404).json({ error: 'Not found' });
    appendAudit({ action: 'delete', entity_type: 'budget', entity_id: id, user_id: uid(req) });
    res.status(204).send();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to delete budget' });
  }
});

export default router;
