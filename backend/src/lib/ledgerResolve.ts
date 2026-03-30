import { dbAll } from '../database/init';
import type { CfsActivity, PlGroup } from './ledgerDefaults';

export interface LedgerAccountRow {
  id: number;
  code: string;
  name: string;
  kind: 'income' | 'expense';
  cfs_activity: CfsActivity;
  pl_group: PlGroup;
  mapped_categories?: string[];
  created_at?: string;
  updated_at?: string;
}

let cacheAccounts: LedgerAccountRow[] | null = null;
let cacheById: Map<number, LedgerAccountRow> = new Map();

export function invalidateLedgerCache(): void {
  cacheAccounts = null;
  cacheById = new Map();
}

export function getLedgerAccounts(): LedgerAccountRow[] {
  if (cacheAccounts) return cacheAccounts;
  const raw = dbAll('ledger_accounts') as any[];
  cacheAccounts = (Array.isArray(raw) ? raw : []).map((a) => ({
    id: a.id,
    code: a.code,
    name: a.name,
    kind: a.kind,
    cfs_activity: a.cfs_activity || 'operating',
    pl_group: a.pl_group || 'operating_expense',
    mapped_categories: Array.isArray(a.mapped_categories) ? a.mapped_categories : [],
  }));
  cacheById = new Map(cacheAccounts.map((a) => [a.id, a]));
  return cacheAccounts;
}

export function resolveLedgerAccountId(tx: any): number | null {
  if (tx.ledger_account_id != null && tx.ledger_account_id !== '') {
    const id = parseInt(String(tx.ledger_account_id), 10);
    if (!isNaN(id)) return id;
  }
  const cat = String(tx.category || '').trim();
  if (!cat) return null;
  const accounts = getLedgerAccounts();
  for (const a of accounts) {
    if (a.mapped_categories?.includes(cat)) return a.id;
  }
  const fallback = accounts.find((a) => a.kind === tx.type && a.code === (tx.type === 'income' ? '4020' : '6190'));
  return fallback?.id ?? null;
}

export function getLedgerRowForTransaction(tx: any): LedgerAccountRow | null {
  const id = resolveLedgerAccountId(tx);
  if (id == null) return null;
  if (cacheById.has(id)) return cacheById.get(id)!;
  const accounts = getLedgerAccounts();
  return accounts.find((a) => a.id === id) || null;
}
