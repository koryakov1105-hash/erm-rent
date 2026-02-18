import express, { Request, Response } from 'express';
import { dbAll, dbGet, dbInsert, dbUpdate, dbDelete, dbQuery } from '../database/init';

const router = express.Router();

// GET /api/leases - список всех договоров
router.get('/', async (req: Request, res: Response) => {
  try {
    const { status } = req.query;
    
    let leases = dbAll('leases');
    
    if (status) {
      leases = dbQuery('leases', (l: any) => l.status === status);
    }
    
    const units = dbAll('units');
    const tenants = dbAll('tenants');
    const properties = dbAll('properties');
    
    const leasesWithDetails = leases.map((lease: any) => {
      const unit = units.find((u: any) => u.id === lease.unit_id);
      const tenant = tenants.find((t: any) => t.id === lease.tenant_id);
      const property = unit ? properties.find((p: any) => p.id === unit.property_id) : null;
      
      return {
        ...lease,
        unit_number: unit?.unit_number || null,
        property_name: property?.name || null,
        tenant_name: tenant?.name || null,
        tenant_email: tenant?.email || null,
        tenant_phone: tenant?.phone || null,
      };
    });
    
    res.json(leasesWithDetails.sort((a: any, b: any) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    ));
  } catch (error) {
    console.error('Error fetching leases:', error);
    res.status(500).json({ error: 'Failed to fetch leases' });
  }
});

// GET /api/leases/:id - получить договор по ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const lease = dbGet('leases', parseInt(id));
    
    if (!lease) {
      return res.status(404).json({ error: 'Lease not found' });
    }

    const unit = dbGet('units', lease.unit_id);
    const tenant = dbGet('tenants', lease.tenant_id);
    const property = unit ? dbGet('properties', unit.property_id) : null;

    res.json({
      ...lease,
      unit: unit || null,
      tenant: tenant || null,
      property: property || null
    });
  } catch (error) {
    console.error('Error fetching lease:', error);
    res.status(500).json({ error: 'Failed to fetch lease' });
  }
});

// POST /api/leases - создать договор
router.post('/', async (req: Request, res: Response) => {
  try {
    const { unit_id, tenant_id, start_date, end_date, monthly_rent, deposit } = req.body;

    if (!unit_id || !tenant_id || !start_date || !monthly_rent) {
      return res.status(400).json({ 
        error: 'unit_id, tenant_id, start_date, and monthly_rent are required' 
      });
    }

    // Проверяем, что юнит свободен
    const unit = dbGet('units', parseInt(unit_id));
    if (!unit) {
      return res.status(404).json({ error: 'Unit not found' });
    }
    
    if (unit.status === 'rented') {
      return res.status(400).json({ error: 'Unit is already rented' });
    }

    const lease = dbInsert('leases', {
      unit_id: parseInt(unit_id),
      tenant_id: parseInt(tenant_id),
      start_date,
      end_date: end_date || null,
      monthly_rent: parseFloat(monthly_rent),
      deposit: deposit ? parseFloat(deposit) : null,
      status: 'active'
    });

    // Обновляем юнит
    const tenant = dbGet('tenants', parseInt(tenant_id));
    dbUpdate('units', parseInt(unit_id), {
      status: 'rented',
      current_tenant_id: parseInt(tenant_id),
      current_tenant_name: tenant?.name || null,
      current_lease_id: lease.id,
      monthly_rent: parseFloat(monthly_rent)
    });

    res.status(201).json(lease);
  } catch (error) {
    console.error('Error creating lease:', error);
    res.status(500).json({ error: 'Failed to create lease' });
  }
});

// PUT /api/leases/:id - обновить договор
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { start_date, end_date, monthly_rent, deposit, status } = req.body;

    const currentLease = dbGet('leases', parseInt(id));
    if (!currentLease) {
      return res.status(404).json({ error: 'Lease not found' });
    }

    const updates: any = {};
    if (start_date !== undefined) updates.start_date = start_date;
    if (end_date !== undefined) updates.end_date = end_date;
    if (monthly_rent !== undefined) updates.monthly_rent = parseFloat(monthly_rent);
    if (deposit !== undefined) updates.deposit = deposit ? parseFloat(deposit) : null;
    if (status !== undefined) updates.status = status;

    const lease = dbUpdate('leases', parseInt(id), updates);

    // Если договор завершен или расторгнут, освобождаем юнит
    if (status === 'completed' || status === 'terminated') {
      dbUpdate('units', currentLease.unit_id, {
        status: 'vacant',
        current_tenant_id: null,
        current_tenant_name: null,
        current_lease_id: null
      });
    }

    // Если изменилась арендная плата, обновляем юнит
    if (monthly_rent !== undefined) {
      dbUpdate('units', currentLease.unit_id, {
        monthly_rent: parseFloat(monthly_rent)
      });
    }

    res.json(lease);
  } catch (error) {
    console.error('Error updating lease:', error);
    res.status(500).json({ error: 'Failed to update lease' });
  }
});

// DELETE /api/leases/:id - удалить договор
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const lease = dbGet('leases', parseInt(id));
    if (!lease) {
      return res.status(404).json({ error: 'Lease not found' });
    }

    // Освобождаем юнит
    dbUpdate('units', lease.unit_id, {
      status: 'vacant',
      current_tenant_id: null,
      current_tenant_name: null,
      current_lease_id: null
    });

    dbDelete('leases', parseInt(id));
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting lease:', error);
    res.status(500).json({ error: 'Failed to delete lease' });
  }
});

export default router;
