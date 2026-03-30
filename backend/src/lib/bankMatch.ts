import { dbAll } from '../database/init';

export function applyBankMatchRules(
  description: string,
  counterparty: string | null
): { ledger_account_id: number | null; property_id: number | null } {
  const rules = dbAll('bank_match_rules') as any[];
  if (!Array.isArray(rules) || rules.length === 0) {
    return { ledger_account_id: null, property_id: null };
  }
  const sorted = [...rules].sort((a, b) => (Number(b.priority) || 0) - (Number(a.priority) || 0));
  const desc = String(description || '').toLowerCase();
  const cp = String(counterparty || '').toLowerCase();
  for (const r of sorted) {
    const p = String(r.pattern || '').toLowerCase();
    if (!p) continue;
    const field = r.match_field === 'counterparty' ? cp : desc;
    if (field.includes(p)) {
      return {
        ledger_account_id: r.ledger_account_id != null ? Number(r.ledger_account_id) : null,
        property_id: r.property_id != null ? Number(r.property_id) : null,
      };
    }
  }
  return { ledger_account_id: null, property_id: null };
}
