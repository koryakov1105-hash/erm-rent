import express, { Request, Response } from 'express';
import { dbAll, dbGet, dbInsert, dbUpdate, dbDelete, dbQuery } from '../database/init';

const router = express.Router();

// GET /api/transactions - список транзакций
router.get('/', async (req: Request, res: Response) => {
  try {
    const { type, is_planned, unit_id, property_id, start_date, end_date } = req.query;
    
    let transactions = dbAll('transactions');
    
    if (type) {
      transactions = transactions.filter((t: any) => t.type === type);
    }
    
    if (is_planned !== undefined) {
      const planned = is_planned === 'true' || is_planned === '1';
      transactions = transactions.filter((t: any) => t.is_planned === (planned ? 1 : 0));
    }
    
    if (unit_id) {
      transactions = transactions.filter((t: any) => t.unit_id === parseInt(unit_id as string));
    }
    
    if (property_id) {
      transactions = transactions.filter((t: any) => t.property_id === parseInt(property_id as string));
    }
    
    if (start_date || end_date) {
      transactions = transactions.filter((t: any) => {
        if (!t.date) return false;
        const date = new Date(t.date);
        if (isNaN(date.getTime())) return false;
        if (start_date && date < new Date(start_date as string)) return false;
        if (end_date && date > new Date(end_date as string)) return false;
        return true;
      });
    }
    
    const units = dbAll('units');
    const properties = dbAll('properties');
    const leases = dbAll('leases');
    
    const transactionsWithDetails = transactions.map((transaction: any) => {
      const unit = transaction.unit_id ? units.find((u: any) => u.id === transaction.unit_id) : null;
      const property = transaction.property_id ? properties.find((p: any) => p.id === transaction.property_id) : null;
      const lease = transaction.lease_id ? leases.find((l: any) => l.id === transaction.lease_id) : null;
      
      const s = String(transaction.status || '').trim();
      const paymentStatus = s === 'invoiced' ? 'invoiced' : s === 'deferred' ? 'deferred' : 'paid';
      return {
        ...transaction,
        unit_number: unit?.unit_number || null,
        property_name: property?.name || null,
        lease_id: lease?.id || null,
        status: paymentStatus,
        scheduled_pay_date: transaction.scheduled_pay_date || null
      };
    });
    
    res.setHeader('Cache-Control', 'no-store');
    res.json(transactionsWithDetails.sort((a: any, b: any) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    ));
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// GET /api/transactions/calendar - платёжный календарь (план приходов/расходов + отложенные)
router.get('/calendar', async (req: Request, res: Response) => {
  try {
    const { start_date, end_date } = req.query;
    const units = dbAll('units') || [];
    const properties = dbAll('properties') || [];
    const all = dbAll('transactions') || [];
    const planned = all.filter((t: any) => t && t.is_planned === 1);
    const deferred = all.filter((t: any) => t && String(t.status || '').trim() === 'deferred');
    const byDate: Record<string, any[]> = {};
    
    const add = (dateStr: string | null | undefined, item: any, calendarType: string) => {
      if (!dateStr || typeof dateStr !== 'string') return;
      const d = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr.trim();
      if (!d || d.length < 10) return; // Проверка формата даты YYYY-MM-DD
      if (start_date && d < (start_date as string)) return;
      if (end_date && d > (end_date as string)) return;
      if (!byDate[d]) byDate[d] = [];
      const unit = item && item.unit_id ? units.find((u: any) => u && u.id === item.unit_id) : null;
      const property = item && item.property_id ? properties.find((p: any) => p && p.id === item.property_id) : null;
      byDate[d].push({
        ...item,
        calendar_type: calendarType,
        display_date: d,
        unit_number: unit?.unit_number || null,
        property_name: property?.name || null,
        category: item.category || null,
        category_detail: item.category_detail || null,
        description: item.description || null,
        amount: item.amount || 0,
        type: item.type || 'expense'
      });
    };
    
    planned.forEach((t: any) => {
      if (t && t.date) {
        add(t.date, t, t.type === 'income' ? 'planned_income' : 'planned_expense');
      }
    });
    
    deferred.forEach((t: any) => {
      if (t && t.scheduled_pay_date) {
        add(t.scheduled_pay_date, t, 'deferred');
      } else if (t && t.date) {
        // Если у отложенной транзакции нет scheduled_pay_date, используем date
        add(t.date, t, 'deferred');
      }
    });
    
    res.setHeader('Cache-Control', 'no-store');
    res.json({ by_date: byDate, dates: Object.keys(byDate).sort() });
  } catch (error) {
    console.error('Error fetching calendar:', error);
    res.status(500).json({ error: 'Failed to fetch calendar' });
  }
});

// GET /api/transactions/planned - плановые транзакции
router.get('/planned', async (req: Request, res: Response) => {
  try {
    const transactions = dbQuery('transactions', (t: any) => t.is_planned === 1);
    res.json(transactions);
  } catch (error) {
    console.error('Error fetching planned transactions:', error);
    res.status(500).json({ error: 'Failed to fetch planned transactions' });
  }
});

// GET /api/transactions/actual - фактические транзакции
router.get('/actual', async (req: Request, res: Response) => {
  try {
    const transactions = dbQuery('transactions', (t: any) => t.is_planned === 0);
    res.json(transactions);
  } catch (error) {
    console.error('Error fetching actual transactions:', error);
    res.status(500).json({ error: 'Failed to fetch actual transactions' });
  }
});

// POST /api/transactions - создать транзакцию
router.post('/', async (req: Request, res: Response) => {
  try {
    const { unit_id, property_id, lease_id, type, category, category_detail, amount, date, description, is_planned, is_tenant_payment, related_payment_id, payer, status, scheduled_pay_date } = req.body;

    if (!type || !amount || !date) {
      return res.status(400).json({ 
        error: 'type, amount, and date are required' 
      });
    }

    const s = String(status || '').trim();
    const paymentStatus = s === 'invoiced' ? 'invoiced' : s === 'deferred' ? 'deferred' : 'paid';
    if (paymentStatus === 'deferred' && !scheduled_pay_date) {
      return res.status(400).json({ error: 'Для отложенного платежа укажите дату «когда оплатить» (scheduled_pay_date)' });
    }
    const transaction = dbInsert('transactions', {
      unit_id: unit_id ? parseInt(unit_id) : null,
      property_id: property_id ? parseInt(property_id) : null,
      lease_id: lease_id ? parseInt(lease_id) : null,
      type,
      category: category || null,
      category_detail: category_detail != null && String(category_detail).trim() !== '' ? String(category_detail).trim() : null,
      amount: parseFloat(amount),
      date,
      description: description || null,
      is_planned: is_planned ? 1 : 0,
      is_tenant_payment: is_tenant_payment ? 1 : 0,
      related_payment_id: related_payment_id ? parseInt(related_payment_id) : null,
      payer: payer ? String(payer).trim() || null : null,
      status: paymentStatus,
      scheduled_pay_date: scheduled_pay_date && paymentStatus === 'deferred' ? (String(scheduled_pay_date).split('T')[0] || null) : null
    });

    res.status(201).json(transaction);
  } catch (error) {
    console.error('Error creating transaction:', error);
    res.status(500).json({ error: 'Failed to create transaction' });
  }
});

// PUT /api/transactions/:id - обновить транзакцию
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { type, category, category_detail, amount, date, description, is_planned, is_tenant_payment, payer, unit_id, property_id, status, scheduled_pay_date } = req.body;

    const updates: any = {};
    if (type !== undefined) updates.type = type;
    if (category !== undefined) updates.category = category;
    if (category_detail !== undefined) updates.category_detail = category_detail != null && String(category_detail).trim() !== '' ? String(category_detail).trim() : null;
    if (amount !== undefined) updates.amount = parseFloat(amount);
    if (date !== undefined) updates.date = date;
    if (description !== undefined) updates.description = description;
    if (is_planned !== undefined) updates.is_planned = is_planned ? 1 : 0;
    if (is_tenant_payment !== undefined) updates.is_tenant_payment = is_tenant_payment ? 1 : 0;
    if (payer !== undefined) updates.payer = payer ? String(payer).trim() || null : null;
    if (unit_id !== undefined) updates.unit_id = unit_id ? parseInt(unit_id) : null;
    if (property_id !== undefined) updates.property_id = property_id ? parseInt(property_id) : null;
    if (status !== undefined && status !== null) {
      const s = String(status).trim();
      updates.status = s === 'invoiced' ? 'invoiced' : s === 'deferred' ? 'deferred' : 'paid';
      if (updates.status !== 'deferred') updates.scheduled_pay_date = null;
    }
    if (scheduled_pay_date !== undefined) {
      const newStatus = updates.status !== undefined ? updates.status : (dbGet('transactions', parseInt(id)) as any)?.status;
      if (String(newStatus || '').trim() === 'deferred') {
        updates.scheduled_pay_date = scheduled_pay_date ? String(scheduled_pay_date).split('T')[0] : null;
      }
    }

    const transaction = dbUpdate('transactions', parseInt(id), updates);
    
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    res.json(transaction);
  } catch (error) {
    console.error('Error updating transaction:', error);
    res.status(500).json({ error: 'Failed to update transaction' });
  }
});

// DELETE /api/transactions/:id - удалить транзакцию
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deleted = dbDelete('transactions', parseInt(id));
    if (!deleted) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting transaction:', error);
    res.status(500).json({ error: 'Failed to delete transaction' });
  }
});

export default router;
