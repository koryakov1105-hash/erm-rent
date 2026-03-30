import express, { Response } from 'express';
import { dbAll, dbGet, dbInsert, dbUpdate, dbDelete } from '../database/init';
import { appendAudit } from '../lib/auditLog';
import type { AuthRequest } from '../middleware/auth';

const router = express.Router();

const STATUSES = ['draft', 'submitted', 'approved', 'paid', 'rejected'] as const;

function uid(req: AuthRequest): number | null {
  return typeof req.userId === 'number' ? req.userId : null;
}

function userRole(userId: number | null): string {
  if (userId == null) return 'operator';
  const users = dbAll('users') as any[];
  const u = users.find((x) => x.id === userId);
  return u?.role || 'operator';
}

router.get('/', (_req, res) => {
  try {
    const list = dbAll('payment_requests');
    res.json(Array.isArray(list) ? list.sort((a: any, b: any) => (b.id || 0) - (a.id || 0)) : []);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to list payment requests' });
  }
});

router.post('/', (req: AuthRequest, res: Response) => {
  try {
    const { title, amount, due_date, property_id, comment, mandatory_payment_id } = req.body;
    if (!title || amount == null || !due_date) {
      return res.status(400).json({ error: 'title, amount, due_date обязательны' });
    }
    const row = dbInsert('payment_requests', {
      title: String(title).trim(),
      amount: parseFloat(String(amount)),
      due_date: String(due_date).split('T')[0],
      property_id: property_id != null && property_id !== '' ? parseInt(String(property_id), 10) : null,
      comment: comment != null ? String(comment) : null,
      mandatory_payment_id:
        mandatory_payment_id != null && mandatory_payment_id !== ''
          ? parseInt(String(mandatory_payment_id), 10)
          : null,
      status: 'draft',
      created_by_user_id: uid(req),
    });
    appendAudit({ action: 'create', entity_type: 'payment_request', entity_id: row.id, user_id: uid(req) });
    res.status(201).json(row);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to create payment request' });
  }
});

router.patch('/:id', (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const cur = dbGet('payment_requests', id) as any;
    if (!cur) return res.status(404).json({ error: 'Not found' });
    const role = userRole(uid(req));
    const updates: any = {};
    if (req.body.status !== undefined) {
      const next = String(req.body.status).trim();
      if (!STATUSES.includes(next as any)) {
        return res.status(400).json({ error: `status: ${STATUSES.join(', ')}` });
      }
      if ((next === 'approved' || next === 'rejected') && role !== 'admin' && role !== 'finance') {
        return res.status(403).json({ error: 'Только admin или finance могут утверждать заявки' });
      }
      updates.status = next;
    }
    if (req.body.title !== undefined) updates.title = String(req.body.title).trim();
    if (req.body.amount !== undefined) updates.amount = parseFloat(String(req.body.amount));
    if (req.body.due_date !== undefined) updates.due_date = String(req.body.due_date).split('T')[0];
    if (req.body.comment !== undefined) updates.comment = req.body.comment != null ? String(req.body.comment) : null;
    const row = dbUpdate('payment_requests', id, updates);
    appendAudit({
      action: 'update',
      entity_type: 'payment_request',
      entity_id: id,
      user_id: uid(req),
      payload: updates.status !== undefined ? { status: updates.status } : undefined,
    });
    res.json(row);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to update payment request' });
  }
});

router.delete('/:id', (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const cur = dbGet('payment_requests', id) as any;
    if (!cur) return res.status(404).json({ error: 'Not found' });
    const role = userRole(uid(req));
    if (cur.status !== 'draft' && role !== 'admin') {
      return res.status(403).json({ error: 'Удалить можно только черновик (или admin)' });
    }
    dbDelete('payment_requests', id);
    appendAudit({ action: 'delete', entity_type: 'payment_request', entity_id: id, user_id: uid(req) });
    res.status(204).send();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to delete' });
  }
});

export default router;
