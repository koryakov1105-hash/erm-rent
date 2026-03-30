import { dbInsert } from '../database/init';

export function appendAudit(entry: {
  action: string;
  entity_type: string;
  entity_id?: number | null;
  user_id?: number | null;
  payload?: Record<string, unknown>;
}): void {
  try {
    dbInsert('audit_log', {
      action: entry.action,
      entity_type: entry.entity_type,
      entity_id: entry.entity_id ?? null,
      user_id: entry.user_id ?? null,
      payload: entry.payload ? JSON.stringify(entry.payload) : null,
    });
  } catch (e) {
    console.error('audit log failed:', e);
  }
}
