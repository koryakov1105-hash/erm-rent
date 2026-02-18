import fs from 'fs';
import path from 'path';
import os from 'os';

// Путь к БД: из env, иначе папка в temp (всегда доступна для записи)
function getDefaultDbPath(): string {
  if (process.env.DB_PATH) return process.env.DB_PATH;
  return path.join(os.tmpdir(), 'erm-rent-db');
}
const DB_PATH = getDefaultDbPath();
const DATA_FILE = path.join(DB_PATH, 'data.json');

interface DatabaseData {
  users: any[];
  properties: any[];
  units: any[];
  tenants: any[];
  leases: any[];
  mandatory_payments: any[];
  actual_mandatory_payments: any[];
  tenant_payments: any[];
  transactions: any[];
  property_documents: any[];
}

let data: DatabaseData = {
  users: [],
  properties: [],
  units: [],
  tenants: [],
  leases: [],
  mandatory_payments: [],
  actual_mandatory_payments: [],
  tenant_payments: [],
  transactions: [],
  property_documents: []
};

// Ensure database directory exists
if (!fs.existsSync(DB_PATH)) {
  fs.mkdirSync(DB_PATH, { recursive: true });
}

// Load data from file
function loadData(): void {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const fileData = fs.readFileSync(DATA_FILE, 'utf-8');
      data = JSON.parse(fileData);
    }
  } catch (error) {
    console.error('Error loading database:', error);
    data = {
      users: [],
      properties: [],
      units: [],
      tenants: [],
      leases: [],
      mandatory_payments: [],
      actual_mandatory_payments: [],
      tenant_payments: [],
      transactions: [],
      property_documents: []
    };
  }
  // Ensure every table is an array (avoid 500 when JSON has wrong shape)
  const tables: (keyof DatabaseData)[] = [
    'users', 'properties', 'units', 'tenants', 'leases',
    'mandatory_payments', 'actual_mandatory_payments', 'tenant_payments', 'transactions',
    'property_documents'
  ];
  for (const key of tables) {
    if (!Array.isArray((data as any)[key])) {
      (data as any)[key] = [];
    }
  }
}

// Save data to file
function saveData(): void {
  if (!fs.existsSync(DB_PATH)) {
    fs.mkdirSync(DB_PATH, { recursive: true });
  }
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// Initialize database
export function initializeDatabase(): void {
  loadData();
  console.log('✅ Database initialized (JSON storage)');
  console.log('   DB file:', DATA_FILE);
}

export function getDataFilePath(): string {
  return DATA_FILE;
}

// Get database instance (for compatibility)
export function getDatabase(): any {
  return data;
}

// Helper functions that mimic SQL operations
export function dbRun(sql: string, params: any[] = []): { lastID: number; changes: number } {
  // Simple implementation - for MVP we'll handle this differently
  return { lastID: 0, changes: 0 };
}

export function dbGet<T = any>(table: string, id: number): T | undefined {
  const raw = (data as any)[table];
  const tableData = Array.isArray(raw) ? raw : [];
  return tableData.find((item: any) => item.id === id) as T | undefined;
}

export function dbAll<T = any>(table: string): T[] {
  const raw = (data as any)[table];
  return (Array.isArray(raw) ? raw : []) as T[];
}

// Save changes
export function saveChanges(): void {
  saveData();
}

// Get next ID for a table
export function getNextId(table: string): number {
  const raw = (data as any)[table];
  const tableData = Array.isArray(raw) ? raw : [];
  if (tableData.length === 0) return 1;
  return Math.max(...tableData.map((item: any) => item.id || 0)) + 1;
}

// Add item to table
export function dbInsert(table: string, item: any): any {
  const raw = (data as any)[table];
  const tableData = Array.isArray(raw) ? raw : [];
  const newItem = {
    ...item,
    id: item.id || getNextId(table),
    created_at: item.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  const next = [...tableData, newItem];
  (data as any)[table] = next;
  saveData();
  return newItem;
}

// Update item in table
export function dbUpdate(table: string, id: number, updates: any): any {
  const raw = (data as any)[table];
  const tableData = Array.isArray(raw) ? [...raw] : [];
  const index = tableData.findIndex((item: any) => item.id === id);
  if (index === -1) return null;
  
  tableData[index] = {
    ...tableData[index],
    ...updates,
    id,
    updated_at: new Date().toISOString()
  };
  (data as any)[table] = tableData;
  saveData();
  return tableData[index];
}

// Delete item from table
export function dbDelete(table: string, id: number): boolean {
  const raw = (data as any)[table];
  const tableData = Array.isArray(raw) ? [...raw] : [];
  const index = tableData.findIndex((item: any) => item.id === id);
  if (index === -1) return false;
  
  tableData.splice(index, 1);
  (data as any)[table] = tableData;
  saveData();
  return true;
}

// Query helper - simple filter
export function dbQuery<T = any>(table: string, filter?: (item: any) => boolean): T[] {
  const raw = (data as any)[table];
  const tableData = Array.isArray(raw) ? raw : [];
  if (!filter) return tableData as T[];
  return tableData.filter(filter) as T[];
}
