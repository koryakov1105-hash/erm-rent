import express, { Request, Response } from 'express';
import { dbAll, dbGet, dbInsert, dbUpdate, dbDelete, dbQuery } from '../database/init';

const router = express.Router();

// GET /api/units - список всех юнитов
router.get('/', async (req: Request, res: Response) => {
  try {
    const { property_id } = req.query;
    
    let units = dbAll('units');
    
    if (property_id) {
      units = dbQuery('units', (u: any) => u.property_id === parseInt(property_id as string));
    }
    
    const properties = dbAll('properties');
    const leases = dbAll('leases');
    const tenants = dbAll('tenants');
    
    const unitsWithDetails = units.map((unit: any) => {
      const property = properties.find((p: any) => p.id === unit.property_id);
      const lease = leases.find((l: any) => l.id === unit.current_lease_id);
      const tenant = lease ? tenants.find((t: any) => t.id === lease.tenant_id) : null;
      
      return {
        ...unit,
        property_name: property?.name || null,
        tenant_name: tenant?.name || null
      };
    });
    
    res.setHeader('Cache-Control', 'no-store');
    res.json(unitsWithDetails.sort((a: any, b: any) => {
      if (a.property_id !== b.property_id) {
        return a.property_id - b.property_id;
      }
      return (a.unit_number || '').localeCompare(b.unit_number || '');
    }));
  } catch (error) {
    console.error('Error fetching units:', error);
    res.status(500).json({ error: 'Failed to fetch units' });
  }
});

// GET /api/units/:id - получить юнит по ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const unit = dbGet('units', parseInt(id));
    
    if (!unit) {
      return res.status(404).json({ error: 'Unit not found' });
    }

    const properties = dbAll('properties');
    const leases = dbAll('leases');
    const tenants = dbAll('tenants');
    
    const property = properties.find((p: any) => p.id === unit.property_id);
    const lease = leases.find((l: any) => l.id === unit.current_lease_id);
    const tenant = lease ? tenants.find((t: any) => t.id === lease.tenant_id) : null;

    res.json({
      ...unit,
      property_name: property?.name || null,
      tenant_name: tenant?.name || null,
      tenant_id: tenant?.id || null
    });
  } catch (error) {
    console.error('Error fetching unit:', error);
    res.status(500).json({ error: 'Failed to fetch unit' });
  }
});

// POST /api/units - создать юнит
router.post('/', async (req: Request, res: Response) => {
  try {
    const { property_id, unit_number, area, price_per_sqm, status, category } = req.body;

    if (!property_id || !unit_number || area === undefined || area === null || price_per_sqm === undefined || price_per_sqm === null) {
      return res.status(400).json({ 
        error: 'property_id, unit_number, area, and price_per_sqm are required' 
      });
    }

    const areaNum = parseFloat(area);
    const priceNum = parseFloat(price_per_sqm);
    if (isNaN(areaNum) || isNaN(priceNum) || areaNum < 0 || priceNum < 0) {
      return res.status(400).json({ error: 'area and price_per_sqm must be valid non-negative numbers' });
    }

    const monthly_rent = areaNum * priceNum;

    const unit = dbInsert('units', {
      property_id: parseInt(property_id),
      unit_number: String(unit_number).trim(),
      area: areaNum,
      price_per_sqm: priceNum,
      monthly_rent,
      status: status || 'vacant',
      category: category != null && String(category).trim() !== '' ? String(category).trim() : null,
      current_tenant_id: null,
      current_tenant_name: null,
      current_lease_id: null
    });

    res.status(201).json(unit);
  } catch (error) {
    console.error('Error creating unit:', error);
    res.status(500).json({ error: 'Failed to create unit' });
  }
});

// PUT /api/units/:id - обновить юнит
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { unit_number, area, price_per_sqm, status, category, property_id } = req.body;

    const currentUnit = dbGet('units', parseInt(id));
    if (!currentUnit) {
      return res.status(404).json({ error: 'Unit not found' });
    }

    // Если изменились площадь или цена за м², пересчитываем месячную арендную плату
    const newArea = area !== undefined ? parseFloat(area) : currentUnit.area;
    const newPrice = price_per_sqm !== undefined ? parseFloat(price_per_sqm) : currentUnit.price_per_sqm;
    const monthly_rent = newArea * newPrice;

    const updates: any = {
      monthly_rent,
      ...(unit_number !== undefined && { unit_number }),
      ...(area !== undefined && { area: parseFloat(area) }),
      ...(price_per_sqm !== undefined && { price_per_sqm: parseFloat(price_per_sqm) }),
      ...(status !== undefined && { status }),
      ...(category !== undefined && { category: category != null && String(category).trim() !== '' ? String(category).trim() : null }),
      ...(property_id !== undefined && { property_id: property_id ? parseInt(property_id) : null }),
    };

    const unit = dbUpdate('units', parseInt(id), updates);
    res.json(unit);
  } catch (error) {
    console.error('Error updating unit:', error);
    res.status(500).json({ error: 'Failed to update unit' });
  }
});

// DELETE /api/units/:id - удалить юнит
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deleted = dbDelete('units', parseInt(id));
    if (!deleted) {
      return res.status(404).json({ error: 'Unit not found' });
    }
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting unit:', error);
    res.status(500).json({ error: 'Failed to delete unit' });
  }
});

// GET /api/units/:id/profitability - расчет доходности юнита
router.get('/:id/profitability', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { month, year } = req.query;

    const unit = dbGet('units', parseInt(id));
    if (!unit) {
      return res.status(404).json({ error: 'Unit not found' });
    }

    // Плановые показатели
    const plannedMonthlyRent = unit.monthly_rent || 0;
    
    // Получаем плановые обязательные платежи (себестоимость)
    const mandatoryPayments = dbQuery('mandatory_payments', (mp: any) => 
      mp.unit_id === parseInt(id) && mp.is_cost === 1 && mp.frequency === 'monthly'
    );
    
    const plannedMandatoryPaymentsTotal = mandatoryPayments.reduce(
      (sum: number, mp: any) => sum + (mp.amount || 0), 
      0
    );
    
    const plannedNetProfit = plannedMonthlyRent - plannedMandatoryPaymentsTotal;
    const plannedProfitability = plannedMonthlyRent > 0 
      ? (plannedNetProfit / plannedMonthlyRent) * 100 
      : 0;

    // Фактические показатели (если указан месяц и год)
    let actualMonthlyRent = null;
    let actualMandatoryPaymentsTotal = null;
    let actualNetProfit = null;
    let actualProfitability = null;

    if (month && year) {
      // Фактическая арендная плата за месяц
      const tenantPayments = dbQuery('tenant_payments', (tp: any) => 
        tp.unit_id === parseInt(id) && 
        tp.month === parseInt(month as string) && 
        tp.year === parseInt(year as string) && 
        tp.is_paid === 1
      );
      
      actualMonthlyRent = tenantPayments.reduce(
        (sum: number, tp: any) => sum + (tp.actual_amount || 0), 
        0
      );

      // Фактические обязательные платежи за месяц
      const actualPayments = dbQuery('actual_mandatory_payments', (amp: any) => 
        amp.unit_id === parseInt(id) && 
        amp.month === parseInt(month as string) && 
        amp.year === parseInt(year as string) && 
        amp.is_paid === 1
      );
      
      actualMandatoryPaymentsTotal = actualPayments.reduce(
        (sum: number, amp: any) => sum + (amp.actual_amount || 0), 
        0
      );
      
      actualNetProfit = actualMonthlyRent - actualMandatoryPaymentsTotal;
      actualProfitability = actualMonthlyRent > 0 
        ? (actualNetProfit / actualMonthlyRent) * 100 
        : 0;
    }

    res.json({
      unit_id: id,
      planned: {
        monthly_rent: plannedMonthlyRent,
        mandatory_payments: plannedMandatoryPaymentsTotal,
        net_profit: plannedNetProfit,
        profitability: Math.round(plannedProfitability * 100) / 100
      },
      actual: actualMonthlyRent !== null && actualProfitability !== null ? {
        monthly_rent: actualMonthlyRent,
        mandatory_payments: actualMandatoryPaymentsTotal,
        net_profit: actualNetProfit,
        profitability: Math.round(actualProfitability * 100) / 100
      } : null
    });
  } catch (error) {
    console.error('Error calculating profitability:', error);
    res.status(500).json({ error: 'Failed to calculate profitability' });
  }
});

export default router;
