import express, { Response } from 'express';
import { dbAll, dbGet, dbInsert, dbUpdate, dbDelete } from '../database/init';
import { appendAudit } from '../lib/auditLog';
import type { AuthRequest } from '../middleware/auth';

const router = express.Router();

function uid(req: AuthRequest): number | null {
  return typeof req.userId === 'number' ? req.userId : null;
}

/** Правила автоподстановки счёта учёта / объекта при импорте банка (по подстроке в назначении или контрагенте). */
router.get('/', (_req, res) => {
  try {
    const list = dbAll('bank_match_rules');
    res.json(Array.isArray(list) ? list : []);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to list rules' });
  }
});

router.post('/', (req: AuthRequest, res: Response) => {
  try {
    const { pattern, match_field, ledger_account_id, property_id, priority } = req.body;
    if (!pattern || !match_field) {
      return res.status(400).json({ error: 'pattern и match_field (description|counterparty) обязательны' });
    }
    if (!['description', 'counterparty'].includes(String(match_field))) {
      return res.status(400).json({ error: 'match_field: description | counterparty' });
    }
    const row = dbInsert('bank_match_rules', {
      pattern: String(pattern).trim(),
      match_field: String(match_field),
      ledger_account_id:
        ledger_account_id != null && ledger_account_id !== ''
          ? parseInt(String(ledger_account_id), 10)
          : null,
      property_id:
        property_id != null && property_id !== '' ? parseInt(String(property_id), 10) : null,
      priority: priority != null ? parseInt(String(priority), 10) : 0,
    });
    appendAudit({ action: 'create', entity_type: 'bank_match_rule', entity_id: row.id, user_id: uid(req) });
    res.status(201).json(row);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to create rule' });
  }
});

router.put('/:id', (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!dbGet('bank_match_rules', id)) return res.status(404).json({ error: 'Not found' });
    const { pattern, match_field, ledger_account_id, property_id, priority } = req.body;
    const updates: any = {};
    if (pattern !== undefined) updates.pattern = String(pattern).trim();
    if (match_field !== undefined) {
      if (!['description', 'counterparty'].includes(String(match_field))) {
        return res.status(400).json({ error: 'match_field: description | counterparty' });
      }
      updates.match_field = match_field;
    }
    if (ledger_account_id !== undefined) {
      updates.ledger_account_id =
        ledger_account_id != null && ledger_account_id !== ''
          ? parseInt(String(ledger_account_id), 10)
          : null;
    }
    if (property_id !== undefined) {
      updates.property_id =
        property_id != null && property_id !== '' ? parseInt(String(property_id), 10) : null;
    }
    if (priority !== undefined) updates.priority = parseInt(String(priority), 10);
    const row = dbUpdate('bank_match_rules', id, updates);
    appendAudit({ action: 'update', entity_type: 'bank_match_rule', entity_id: id, user_id: uid(req) });
    res.json(row);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to update rule' });
  }
});

router.delete('/:id', (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!dbDelete('bank_match_rules', id)) return res.status(404).json({ error: 'Not found' });
    appendAudit({ action: 'delete', entity_type: 'bank_match_rule', entity_id: id, user_id: uid(req) });
    res.status(204).send();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to delete' });
  }
});

export default router;
