import express, { Request, Response } from 'express';
import { dbAll, dbGet, dbInsert, dbUpdate, dbDelete, dbQuery } from '../database/init';

const router = express.Router();

// GET /api/tenants - список всех арендаторов
router.get('/', async (req: Request, res: Response) => {
  try {
    const tenants = dbAll('tenants');
    
    // Добавляем информацию о текущих договорах
    const leases = dbAll('leases');
    const units = dbAll('units');
    
    const tenantsWithInfo = tenants.map((tenant: any) => {
      const activeLeases = leases.filter((l: any) => 
        l.tenant_id === tenant.id && l.status === 'active'
      );
      
      return {
        ...tenant,
        active_leases_count: activeLeases.length,
        active_units: activeLeases.map((l: any) => {
          const unit = units.find((u: any) => u.id === l.unit_id);
          return unit ? unit.unit_number : null;
        }).filter(Boolean)
      };
    });
    
    res.json(tenantsWithInfo.sort((a: any, b: any) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    ));
  } catch (error) {
    console.error('Error fetching tenants:', error);
    res.status(500).json({ error: 'Failed to fetch tenants' });
  }
});

// GET /api/tenants/:id - получить арендатора по ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenant = dbGet('tenants', parseInt(id));
    
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    // Получаем историю договоров
    const leases = dbQuery('leases', (l: any) => l.tenant_id === parseInt(id));
    const units = dbAll('units');
    const properties = dbAll('properties');
    
    const leasesWithDetails = leases.map((lease: any) => {
      const unit = units.find((u: any) => u.id === lease.unit_id);
      const property = unit ? properties.find((p: any) => p.id === unit.property_id) : null;
      
      return {
        ...lease,
        unit_number: unit?.unit_number || null,
        property_name: property?.name || null
      };
    });

    res.json({
      ...tenant,
      leases: leasesWithDetails
    });
  } catch (error) {
    console.error('Error fetching tenant:', error);
    res.status(500).json({ error: 'Failed to fetch tenant' });
  }
});

// POST /api/tenants - создать арендатора
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, contact_person, phone, email, tax_id } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const tenant = dbInsert('tenants', {
      name,
      contact_person: contact_person || null,
      phone: phone || null,
      email: email || null,
      tax_id: tax_id || null
    });

    res.status(201).json(tenant);
  } catch (error) {
    console.error('Error creating tenant:', error);
    res.status(500).json({ error: 'Failed to create tenant' });
  }
});

// PUT /api/tenants/:id - обновить арендатора
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, contact_person, phone, email, tax_id } = req.body;

    const tenant = dbUpdate('tenants', parseInt(id), {
      name,
      contact_person: contact_person || null,
      phone: phone || null,
      email: email || null,
      tax_id: tax_id || null
    });

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    res.json(tenant);
  } catch (error) {
    console.error('Error updating tenant:', error);
    res.status(500).json({ error: 'Failed to update tenant' });
  }
});

// DELETE /api/tenants/:id - удалить арендатора
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Проверяем, есть ли активные договоры
    const leases = dbQuery('leases', (l: any) => 
      l.tenant_id === parseInt(id) && l.status === 'active'
    );
    
    if (leases.length > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete tenant with active leases' 
      });
    }
    
    const deleted = dbDelete('tenants', parseInt(id));
    if (!deleted) {
      return res.status(404).json({ error: 'Tenant not found' });
    }
    
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting tenant:', error);
    res.status(500).json({ error: 'Failed to delete tenant' });
  }
});

export default router;
