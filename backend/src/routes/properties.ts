import express, { Request, Response } from 'express';
import { dbAll, dbGet, dbInsert, dbUpdate, dbDelete, dbQuery } from '../database/init';

const router = express.Router();

// GET /api/properties - список всех объектов
router.get('/', async (req: Request, res: Response) => {
  try {
    const properties = dbAll('properties');
    const units = dbAll('units');
    
    const propertiesWithStats = properties.map((property: any) => {
      const propertyUnits = units.filter((u: any) => u.property_id === property.id);
      const occupiedUnits = propertyUnits.filter((u: any) => u.status === 'rented');
      const monthlyRevenue = occupiedUnits.reduce((sum: number, u: any) => sum + (u.monthly_rent || 0), 0);
      
      return {
        ...property,
        units_count: propertyUnits.length,
        occupied_units: occupiedUnits.length,
        monthly_revenue: monthlyRevenue
      };
    });
    
    res.json(propertiesWithStats.sort((a: any, b: any) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    ));
  } catch (error) {
    console.error('Error fetching properties:', error);
    res.status(500).json({ error: 'Failed to fetch properties' });
  }
});

// GET /api/properties/:id - получить объект по ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const property = dbGet('properties', parseInt(id));
    
    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }

    const units = dbQuery('units', (u: any) => u.property_id === parseInt(id));
    const occupiedUnits = units.filter((u: any) => u.status === 'rented');
    const monthlyRevenue = occupiedUnits.reduce((sum: number, u: any) => sum + (u.monthly_rent || 0), 0);

    res.json({
      ...property,
      units_count: units.length,
      occupied_units: occupiedUnits.length,
      monthly_revenue: monthlyRevenue
    });
  } catch (error) {
    console.error('Error fetching property:', error);
    res.status(500).json({ error: 'Failed to fetch property' });
  }
});

// POST /api/properties - создать объект
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, address, total_area } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const totalAreaNum = (total_area != null && total_area !== '') ? parseFloat(total_area) : null;
    const property = dbInsert('properties', {
      name: String(name).trim(),
      address: address != null && String(address).trim() !== '' ? String(address).trim() : null,
      total_area: totalAreaNum != null && !isNaN(totalAreaNum) ? totalAreaNum : null
    });

    res.status(201).json(property);
  } catch (error) {
    console.error('Error creating property:', error);
    res.status(500).json({ error: 'Failed to create property' });
  }
});

// PUT /api/properties/:id - обновить объект
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, address, total_area } = req.body;

    const updates: Record<string, any> = {};
    if (name !== undefined) updates.name = name;
    if (address !== undefined) updates.address = address === '' ? null : address;
    if (total_area !== undefined) updates.total_area = total_area === '' || total_area == null ? null : parseFloat(total_area);

    const property = dbUpdate('properties', parseInt(id), updates);

    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }

    res.json(property);
  } catch (error) {
    console.error('Error updating property:', error);
    res.status(500).json({ error: 'Failed to update property' });
  }
});

// DELETE /api/properties/:id - удалить объект
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const deleted = dbDelete('properties', parseInt(id));
    if (!deleted) {
      return res.status(404).json({ error: 'Property not found' });
    }
    
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting property:', error);
    res.status(500).json({ error: 'Failed to delete property' });
  }
});

// GET /api/properties/:id/documents - список документов и планировок объекта
router.get('/:id/documents', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const propertyId = parseInt(id);
    const property = dbGet('properties', propertyId);
    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }
    const docs = dbQuery('property_documents', (d: any) => d.property_id === propertyId);
    const list = docs.map((d: any) => ({
      id: d.id,
      property_id: d.property_id,
      name: d.name,
      type: d.type,
      file_name: d.file_name,
      mime_type: d.mime_type,
      size: d.size,
      created_at: d.created_at,
      updated_at: d.updated_at
    }));
    res.json(list);
  } catch (error) {
    console.error('Error fetching property documents:', error);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

// POST /api/properties/:id/documents - загрузить документ/планировку
router.post('/:id/documents', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const propertyId = parseInt(id);
    const property = dbGet('properties', propertyId);
    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }
    const { name, type, file_name, mime_type, content } = req.body;
    if (!name || !type || !file_name || !content) {
      return res.status(400).json({ error: 'name, type, file_name and content are required' });
    }
    if (!['plan', 'document'].includes(type)) {
      return res.status(400).json({ error: 'type must be "plan" or "document"' });
    }
    const size = typeof content === 'string' ? Buffer.byteLength(Buffer.from(content, 'base64')) : 0;
    const doc = dbInsert('property_documents', {
      property_id: propertyId,
      name: name.trim(),
      type,
      file_name: file_name.trim(),
      mime_type: mime_type || null,
      size,
      content
    });
    res.status(201).json({
      id: doc.id,
      property_id: doc.property_id,
      name: doc.name,
      type: doc.type,
      file_name: doc.file_name,
      mime_type: doc.mime_type,
      size: doc.size,
      created_at: doc.created_at,
      updated_at: doc.updated_at
    });
  } catch (error) {
    console.error('Error uploading property document:', error);
    res.status(500).json({ error: 'Failed to upload document' });
  }
});

// GET /api/properties/:id/documents/:docId - скачать документ (вернуть content)
router.get('/:id/documents/:docId', async (req: Request, res: Response) => {
  try {
    const { id, docId } = req.params;
    const propertyId = parseInt(id);
    const docIdNum = parseInt(docId);
    const property = dbGet('properties', propertyId);
    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }
    const doc = dbGet('property_documents', docIdNum);
    if (!doc || (doc as any).property_id !== propertyId) {
      return res.status(404).json({ error: 'Document not found' });
    }
    const d = doc as any;
    res.json({
      id: d.id,
      name: d.name,
      type: d.type,
      file_name: d.file_name,
      mime_type: d.mime_type,
      size: d.size,
      content: d.content,
      created_at: d.created_at
    });
  } catch (error) {
    console.error('Error fetching document:', error);
    res.status(500).json({ error: 'Failed to fetch document' });
  }
});

// DELETE /api/properties/:id/documents/:docId
router.delete('/:id/documents/:docId', async (req: Request, res: Response) => {
  try {
    const { id, docId } = req.params;
    const propertyId = parseInt(id);
    const docIdNum = parseInt(docId);
    const property = dbGet('properties', propertyId);
    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }
    const doc = dbGet('property_documents', docIdNum);
    if (!doc || (doc as any).property_id !== propertyId) {
      return res.status(404).json({ error: 'Document not found' });
    }
    dbDelete('property_documents', docIdNum);
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

// GET /api/properties/:id/units - получить юниты объекта
router.get('/:id/units', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const units = dbQuery('units', (u: any) => u.property_id === parseInt(id));
    const leases = dbAll('leases');
    const tenants = dbAll('tenants');
    
    const unitsWithTenants = units.map((unit: any) => {
      const lease = leases.find((l: any) => l.id === unit.current_lease_id);
      const tenant = lease ? tenants.find((t: any) => t.id === lease.tenant_id) : null;
      
      return {
        ...unit,
        tenant_name: tenant?.name || null
      };
    });
    
    res.json(unitsWithTenants.sort((a: any, b: any) => 
      (a.unit_number || '').localeCompare(b.unit_number || '')
    ));
  } catch (error) {
    console.error('Error fetching units:', error);
    res.status(500).json({ error: 'Failed to fetch units' });
  }
});

export default router;
