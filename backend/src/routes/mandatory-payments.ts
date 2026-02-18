import express, { Request, Response } from 'express';
import { dbAll, dbGet, dbInsert, dbUpdate, dbDelete, dbQuery } from '../database/init';

const router = express.Router();

// GET /api/mandatory-payments - список плановых обязательных платежей
router.get('/', async (req: Request, res: Response) => {
  try {
    const { unit_id, property_id } = req.query;
    
    let payments = dbAll('mandatory_payments');
    
    if (unit_id) {
      payments = dbQuery('mandatory_payments', (mp: any) => mp.unit_id === parseInt(unit_id as string));
    } else if (property_id) {
      payments = dbQuery('mandatory_payments', (mp: any) => mp.property_id === parseInt(property_id as string));
    }
    
    const units = dbAll('units');
    const properties = dbAll('properties');
    
    const paymentsWithDetails = payments.map((payment: any) => {
      const unit = payment.unit_id ? units.find((u: any) => u.id === payment.unit_id) : null;
      const property = payment.property_id ? properties.find((p: any) => p.id === payment.property_id) : null;
      
      return {
        ...payment,
        unit_number: unit?.unit_number || null,
        property_name: property?.name || null
      };
    });
    
    res.json(paymentsWithDetails);
  } catch (error) {
    console.error('Error fetching mandatory payments:', error);
    res.status(500).json({ error: 'Failed to fetch mandatory payments' });
  }
});

// GET /api/mandatory-payments/:id - получить платеж по ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const payment = dbGet('mandatory_payments', parseInt(id));
    
    if (!payment) {
      return res.status(404).json({ error: 'Mandatory payment not found' });
    }

    res.json(payment);
  } catch (error) {
    console.error('Error fetching mandatory payment:', error);
    res.status(500).json({ error: 'Failed to fetch mandatory payment' });
  }
});

// POST /api/mandatory-payments - создать плановый обязательный платеж
router.post('/', async (req: Request, res: Response) => {
  try {
    const { unit_id, property_id, payment_type, amount, frequency, start_date, end_date, is_cost } = req.body;

    if (!payment_type || !amount || !start_date) {
      return res.status(400).json({ 
        error: 'payment_type, amount, and start_date are required' 
      });
    }

    if (!unit_id && !property_id) {
      return res.status(400).json({ 
        error: 'Either unit_id or property_id must be provided' 
      });
    }

    const payment = dbInsert('mandatory_payments', {
      unit_id: unit_id ? parseInt(unit_id) : null,
      property_id: property_id ? parseInt(property_id) : null,
      payment_type,
      amount: parseFloat(amount),
      frequency: frequency || 'monthly',
      start_date,
      end_date: end_date || null,
      is_cost: is_cost !== undefined ? (is_cost ? 1 : 0) : 1
    });

    res.status(201).json(payment);
  } catch (error) {
    console.error('Error creating mandatory payment:', error);
    res.status(500).json({ error: 'Failed to create mandatory payment' });
  }
});

// PUT /api/mandatory-payments/:id - обновить плановый платеж
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { payment_type, amount, frequency, start_date, end_date, is_cost } = req.body;

    const updates: any = {};
    if (payment_type !== undefined) updates.payment_type = payment_type;
    if (amount !== undefined) updates.amount = parseFloat(amount);
    if (frequency !== undefined) updates.frequency = frequency;
    if (start_date !== undefined) updates.start_date = start_date;
    if (end_date !== undefined) updates.end_date = end_date;
    if (is_cost !== undefined) updates.is_cost = is_cost ? 1 : 0;

    const payment = dbUpdate('mandatory_payments', parseInt(id), updates);
    
    if (!payment) {
      return res.status(404).json({ error: 'Mandatory payment not found' });
    }

    res.json(payment);
  } catch (error) {
    console.error('Error updating mandatory payment:', error);
    res.status(500).json({ error: 'Failed to update mandatory payment' });
  }
});

// DELETE /api/mandatory-payments/:id - удалить плановый платеж
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deleted = dbDelete('mandatory_payments', parseInt(id));
    if (!deleted) {
      return res.status(404).json({ error: 'Mandatory payment not found' });
    }
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting mandatory payment:', error);
    res.status(500).json({ error: 'Failed to delete mandatory payment' });
  }
});

// GET /api/mandatory-payments/:id/actual - получить фактические платежи для планового
router.get('/:id/actual', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const actualPayments = dbQuery('actual_mandatory_payments', (amp: any) => 
      amp.mandatory_payment_id === parseInt(id)
    );
    
    res.json(actualPayments);
  } catch (error) {
    console.error('Error fetching actual payments:', error);
    res.status(500).json({ error: 'Failed to fetch actual payments' });
  }
});

export default router;
