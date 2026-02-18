import express, { Request, Response } from 'express';
import { dbAll, dbGet, dbInsert, dbUpdate, dbQuery } from '../database/init';

const router = express.Router();

// GET /api/actual-mandatory-payments - список фактических обязательных платежей
router.get('/', async (req: Request, res: Response) => {
  try {
    const { month, year, unit_id, property_id } = req.query;
    
    let payments = dbAll('actual_mandatory_payments');
    
    if (month && year) {
      payments = dbQuery('actual_mandatory_payments', (amp: any) => 
        amp.month === parseInt(month as string) && amp.year === parseInt(year as string)
      );
    }
    
    if (unit_id) {
      payments = payments.filter((amp: any) => amp.unit_id === parseInt(unit_id as string));
    }
    
    if (property_id) {
      payments = payments.filter((amp: any) => amp.property_id === parseInt(property_id as string));
    }
    
    res.json(payments);
  } catch (error) {
    console.error('Error fetching actual mandatory payments:', error);
    res.status(500).json({ error: 'Failed to fetch actual mandatory payments' });
  }
});

// POST /api/actual-mandatory-payments - создать/обновить фактический платеж
router.post('/', async (req: Request, res: Response) => {
  try {
    const { mandatory_payment_id, unit_id, property_id, payment_type, planned_amount, actual_amount, payment_date, month, year, is_paid } = req.body;

    if (!mandatory_payment_id || !month || !year) {
      return res.status(400).json({ 
        error: 'mandatory_payment_id, month, and year are required' 
      });
    }

    // Проверяем, существует ли уже запись для этого месяца
    const existing = dbQuery('actual_mandatory_payments', (amp: any) => 
      amp.mandatory_payment_id === parseInt(mandatory_payment_id) &&
      amp.month === parseInt(month) &&
      amp.year === parseInt(year)
    )[0];

    if (existing) {
      // Обновляем существующую запись
      const updates: any = {};
      if (actual_amount !== undefined) updates.actual_amount = parseFloat(actual_amount);
      if (payment_date !== undefined) updates.payment_date = payment_date;
      if (is_paid !== undefined) {
        updates.is_paid = is_paid ? 1 : 0;
        updates.status = is_paid ? 'paid' : 'planned';
      }
      
      const updated = dbUpdate('actual_mandatory_payments', existing.id, updates);
      return res.json(updated);
    }

    // Создаем новую запись
    const payment = dbInsert('actual_mandatory_payments', {
      mandatory_payment_id: parseInt(mandatory_payment_id),
      unit_id: unit_id ? parseInt(unit_id) : null,
      property_id: property_id ? parseInt(property_id) : null,
      payment_type: payment_type || 'other',
      planned_amount: parseFloat(planned_amount),
      actual_amount: actual_amount ? parseFloat(actual_amount) : null,
      payment_date: payment_date || null,
      month: parseInt(month),
      year: parseInt(year),
      status: is_paid ? 'paid' : 'planned',
      is_paid: is_paid ? 1 : 0
    });

    res.status(201).json(payment);
  } catch (error) {
    console.error('Error creating actual mandatory payment:', error);
    res.status(500).json({ error: 'Failed to create actual mandatory payment' });
  }
});

// PUT /api/actual-mandatory-payments/:id - обновить фактический платеж
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { actual_amount, payment_date, is_paid } = req.body;

    const updates: any = {};
    if (actual_amount !== undefined) updates.actual_amount = parseFloat(actual_amount);
    if (payment_date !== undefined) updates.payment_date = payment_date;
    if (is_paid !== undefined) {
      updates.is_paid = is_paid ? 1 : 0;
      updates.status = is_paid ? 'paid' : 'planned';
    }

    const payment = dbUpdate('actual_mandatory_payments', parseInt(id), updates);
    
    if (!payment) {
      return res.status(404).json({ error: 'Actual mandatory payment not found' });
    }

    res.json(payment);
  } catch (error) {
    console.error('Error updating actual mandatory payment:', error);
    res.status(500).json({ error: 'Failed to update actual mandatory payment' });
  }
});

// POST /api/actual-mandatory-payments/:id/mark-paid - отметить как оплаченный
router.post('/:id/mark-paid', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { actual_amount, payment_date } = req.body;

    const payment = dbUpdate('actual_mandatory_payments', parseInt(id), {
      is_paid: 1,
      status: 'paid',
      actual_amount: actual_amount ? parseFloat(actual_amount) : undefined,
      payment_date: payment_date || new Date().toISOString().split('T')[0]
    });
    
    if (!payment) {
      return res.status(404).json({ error: 'Actual mandatory payment not found' });
    }

    res.json(payment);
  } catch (error) {
    console.error('Error marking payment as paid:', error);
    res.status(500).json({ error: 'Failed to mark payment as paid' });
  }
});

export default router;
