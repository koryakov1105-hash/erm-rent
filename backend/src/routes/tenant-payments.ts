import express, { Request, Response } from 'express';
import { dbAll, dbGet, dbInsert, dbUpdate, dbQuery } from '../database/init';

const router = express.Router();

// GET /api/tenant-payments - список платежей от арендаторов
router.get('/', async (req: Request, res: Response) => {
  try {
    const { month, year, lease_id, unit_id, tenant_id } = req.query;
    
    let payments = dbAll('tenant_payments');
    
    if (month && year) {
      payments = dbQuery('tenant_payments', (tp: any) => 
        tp.month === parseInt(month as string) && tp.year === parseInt(year as string)
      );
    }
    
    if (lease_id) {
      payments = payments.filter((tp: any) => tp.lease_id === parseInt(lease_id as string));
    }
    
    if (unit_id) {
      payments = payments.filter((tp: any) => tp.unit_id === parseInt(unit_id as string));
    }
    
    if (tenant_id) {
      payments = payments.filter((tp: any) => tp.tenant_id === parseInt(tenant_id as string));
    }
    
    const leases = dbAll('leases');
    const units = dbAll('units');
    const tenants = dbAll('tenants');
    
    const paymentsWithDetails = payments.map((payment: any) => {
      const lease = leases.find((l: any) => l.id === payment.lease_id);
      const unit = units.find((u: any) => u.id === payment.unit_id);
      const tenant = tenants.find((t: any) => t.id === payment.tenant_id);
      
      return {
        ...payment,
        unit_number: unit?.unit_number || null,
        tenant_name: tenant?.name || null
      };
    });
    
    res.json(paymentsWithDetails);
  } catch (error) {
    console.error('Error fetching tenant payments:', error);
    res.status(500).json({ error: 'Failed to fetch tenant payments' });
  }
});

// POST /api/tenant-payments - создать/обновить платеж от арендатора
router.post('/', async (req: Request, res: Response) => {
  try {
    const { lease_id, unit_id, tenant_id, planned_amount, actual_amount, payment_date, month, year, payment_method, description, is_paid } = req.body;

    if (!lease_id || !unit_id || !tenant_id || !month || !year) {
      return res.status(400).json({ 
        error: 'lease_id, unit_id, tenant_id, month, and year are required' 
      });
    }

    // Проверяем, существует ли уже запись для этого месяца
    const existing = dbQuery('tenant_payments', (tp: any) => 
      tp.lease_id === parseInt(lease_id) &&
      tp.month === parseInt(month) &&
      tp.year === parseInt(year)
    )[0];

    if (existing) {
      // Обновляем существующую запись
      const updates: any = {};
      if (actual_amount !== undefined) updates.actual_amount = parseFloat(actual_amount);
      if (payment_date !== undefined) updates.payment_date = payment_date;
      if (payment_method !== undefined) updates.payment_method = payment_method;
      if (description !== undefined) updates.description = description;
      if (is_paid !== undefined) {
        updates.is_paid = is_paid ? 1 : 0;
        updates.status = is_paid ? 'received' : 'expected';
      }
      
      const updated = dbUpdate('tenant_payments', existing.id, updates);
      return res.json(updated);
    }

    // Создаем новую запись
    const lease = dbGet('leases', parseInt(lease_id));
    const payment = dbInsert('tenant_payments', {
      lease_id: parseInt(lease_id),
      unit_id: parseInt(unit_id),
      tenant_id: parseInt(tenant_id),
      planned_amount: planned_amount ? parseFloat(planned_amount) : (lease?.monthly_rent || 0),
      actual_amount: actual_amount ? parseFloat(actual_amount) : null,
      payment_date: payment_date || null,
      month: parseInt(month),
      year: parseInt(year),
      status: is_paid ? 'received' : 'expected',
      is_paid: is_paid ? 1 : 0,
      payment_method: payment_method || null,
      description: description || null
    });

    res.status(201).json(payment);
  } catch (error) {
    console.error('Error creating tenant payment:', error);
    res.status(500).json({ error: 'Failed to create tenant payment' });
  }
});

// PUT /api/tenant-payments/:id - обновить платеж от арендатора
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { actual_amount, payment_date, payment_method, description, is_paid } = req.body;

    const updates: any = {};
    if (actual_amount !== undefined) updates.actual_amount = parseFloat(actual_amount);
    if (payment_date !== undefined) updates.payment_date = payment_date;
    if (payment_method !== undefined) updates.payment_method = payment_method;
    if (description !== undefined) updates.description = description;
    if (is_paid !== undefined) {
      updates.is_paid = is_paid ? 1 : 0;
      updates.status = is_paid ? 'received' : 'expected';
    }

    const payment = dbUpdate('tenant_payments', parseInt(id), updates);
    
    if (!payment) {
      return res.status(404).json({ error: 'Tenant payment not found' });
    }

    res.json(payment);
  } catch (error) {
    console.error('Error updating tenant payment:', error);
    res.status(500).json({ error: 'Failed to update tenant payment' });
  }
});

// POST /api/tenant-payments/:id/mark-paid - отметить как полученный
router.post('/:id/mark-paid', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { actual_amount, payment_date, payment_method, description } = req.body;

    const payment = dbUpdate('tenant_payments', parseInt(id), {
      is_paid: 1,
      status: 'received',
      actual_amount: actual_amount ? parseFloat(actual_amount) : undefined,
      payment_date: payment_date || new Date().toISOString().split('T')[0],
      payment_method: payment_method || undefined,
      description: description || undefined
    });
    
    if (!payment) {
      return res.status(404).json({ error: 'Tenant payment not found' });
    }

    res.json(payment);
  } catch (error) {
    console.error('Error marking payment as paid:', error);
    res.status(500).json({ error: 'Failed to mark payment as paid' });
  }
});

// POST /api/tenant-payments/generate-monthly - сгенерировать плановые платежи на месяц
router.post('/generate-monthly', async (req: Request, res: Response) => {
  try {
    const { month, year } = req.body;

    if (!month || !year) {
      return res.status(400).json({ error: 'month and year are required' });
    }

    // Получаем все активные договоры
    const activeLeases = dbQuery('leases', (l: any) => l.status === 'active');
    const generated: any[] = [];

    for (const lease of activeLeases) {
      // Проверяем, существует ли уже запись для этого месяца
      const existing = dbQuery('tenant_payments', (tp: any) => 
        tp.lease_id === lease.id &&
        tp.month === parseInt(month) &&
        tp.year === parseInt(year)
      )[0];

      if (!existing) {
        const unit = dbGet('units', lease.unit_id);
        const tenant = dbGet('tenants', lease.tenant_id);
        
        const payment = dbInsert('tenant_payments', {
          lease_id: lease.id,
          unit_id: lease.unit_id,
          tenant_id: lease.tenant_id,
          planned_amount: lease.monthly_rent,
          actual_amount: null,
          payment_date: null,
          month: parseInt(month),
          year: parseInt(year),
          status: 'expected',
          is_paid: 0,
          payment_method: null,
          description: null
        });
        
        generated.push(payment);
      }
    }

    res.json({ 
      message: `Generated ${generated.length} planned payments for ${month}/${year}`,
      generated 
    });
  } catch (error) {
    console.error('Error generating monthly payments:', error);
    res.status(500).json({ error: 'Failed to generate monthly payments' });
  }
});

export default router;
