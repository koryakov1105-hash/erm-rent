/**
 * Парсеры банковских выписок (XML и Excel).
 * Общий формат результата: дата, сумма (положительная = приход, отрицательная = расход), описание, контрагент.
 */

import * as XLSX from 'xlsx';
import { XMLParser } from 'fast-xml-parser';

export interface ParsedStatementRow {
  date: string;       // YYYY-MM-DD
  amount: number;     // positive = income, negative = expense
  description?: string;
  counterparty?: string;
}

const DATE_REGEX = /(\d{4})-(\d{2})-(\d{2})|(\d{2})\.(\d{2})\.(\d{4})|(\d{2})\/(\d{2})\/(\d{4})/;

function normalizeDate(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;
  // YYYY-MM-DD
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return s.slice(0, 10);
  // DD.MM.YYYY
  const dmy = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  // DD/MM/YYYY
  const dmy2 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (dmy2) return `${dmy2[3]}-${dmy2[2].padStart(2, '0')}-${dmy2[1].padStart(2, '0')}`;
  try {
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  } catch {
    // ignore
  }
  return null;
}

function normalizeAmount(value: unknown): number | null {
  if (value == null || value === '') return null;
  if (typeof value === 'number' && !isNaN(value)) return value;
  const s = String(value).trim().replace(/\s/g, '').replace(',', '.');
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

const EXCEL_DATE_COLUMNS = [
  'дата', 'date', 'Дата', 'Date', 'ДАТА', 'дата операции', 'Дата операции',
  'дата проводки', 'Дата проводки'
];
const EXCEL_AMOUNT_COLUMNS = [
  'сумма', 'amount', 'Сумма', 'Amount', 'СУММА', 'сумма операции', 'Сумма операции',
  'приход', 'расход', 'Приход', 'Расход'
];
const EXCEL_DESC_COLUMNS = [
  'назначение', 'описание', 'description', 'Назначение', 'Описание', 'Description',
  'назначение платежа', 'Назначение платежа', 'содержание операции', 'Содержание операции'
];
const EXCEL_COUNTERPARTY_COLUMNS = [
  'контрагент', 'counterparty', 'Контрагент', 'Counterparty', 'получатель', 'плательщик',
  'Получатель', 'Плательщик'
];

function findColumnKey(row: Record<string, unknown>, columnNames: string[]): string | null {
  const keys = Object.keys(row).map((k) => k.trim().toLowerCase());
  for (const name of columnNames) {
    const lower = name.toLowerCase();
    const found = Object.keys(row).find((k) => k.trim().toLowerCase() === lower);
    if (found) return found;
  }
  for (const name of columnNames) {
    const lower = name.toLowerCase();
    const found = keys.find((k) => k.includes(lower) || lower.includes(k));
    if (found) {
      return Object.keys(row).find((k) => k.trim().toLowerCase() === found) || null;
    }
  }
  return null;
}

export function parseExcel(buffer: Buffer): ParsedStatementRow[] {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return [];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '', raw: false });
  if (rows.length === 0) return [];

  const first = rows[0];
  const dateKey = findColumnKey(first, EXCEL_DATE_COLUMNS);
  const amountKey = findColumnKey(first, EXCEL_AMOUNT_COLUMNS);
  const descKey = findColumnKey(first, EXCEL_DESC_COLUMNS);
  const counterpartyKey = findColumnKey(first, EXCEL_COUNTERPARTY_COLUMNS);

  if (!dateKey || !amountKey) {
    throw new Error('В файле Excel не найдены колонки с датой и суммой. Ожидаются заголовки: Дата, Сумма (или аналоги).');
  }

  const result: ParsedStatementRow[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const dateStr = normalizeDate(row[dateKey]);
    if (!dateStr) continue;
    let amount = normalizeAmount(row[amountKey]);
    if (amount === null) continue;
    // Если в файле две колонки "приход" и "расход" — ищем обе
    if (amount === 0 && !row[amountKey]) {
      const creditKey = Object.keys(row).find((k) => /приход|credit|доход/i.test(k));
      const debitKey = Object.keys(row).find((k) => /расход|debit|списание/i.test(k));
      const credit = normalizeAmount(creditKey ? row[creditKey] : null);
      const debit = normalizeAmount(debitKey ? row[debitKey] : null);
      if (credit != null && credit !== 0) amount = credit;
      else if (debit != null && debit !== 0) amount = -Math.abs(debit);
      else continue;
    }
    const description = descKey != null && row[descKey] != null ? String(row[descKey]).trim() || undefined : undefined;
    const counterparty = counterpartyKey != null && row[counterpartyKey] != null ? String(row[counterpartyKey]).trim() || undefined : undefined;
    result.push({ date: dateStr, amount, description, counterparty });
  }
  return result;
}

/**
 * Поддерживаемые форматы XML:
 * 1) Универсальный: корень содержит массив элементов (operation, transaction, row, document и т.д.)
 *    с полями date/дата, amount/сумма, description/назначение, counterparty/контрагент.
 * 2) 1C-подобный: Document/Operations/Operation с полями Date, Amount, Purpose, Counterparty и т.п.
 */
export function parseXml(buffer: Buffer): ParsedStatementRow[] {
  const xmlStr = buffer.toString('utf8');
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    parseTagValue: true,
    trimValues: true
  });
  const parsed = parser.parse(xmlStr);
  if (!parsed || typeof parsed !== 'object') throw new Error('Не удалось разобрать XML.');

  const result: ParsedStatementRow[] = [];
  const root = parsed as Record<string, unknown>;

  // Найти массив операций: operations, Operations, documents, data, statement, выписка и т.д.
  let operations: unknown[] = [];
  const possibleListKeys = [
    'operations', 'Operations', 'operation', 'Operation',
    'documents', 'Documents', 'transactions', 'Transactions',
    'data', 'Data', 'rows', 'Rows', 'statement', 'Statement',
    'выписка', 'Выписка', 'операции', 'Операции'
  ];
  for (const key of possibleListKeys) {
    const val = root[key];
    if (Array.isArray(val)) {
      operations = val;
      break;
    }
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      const inner = val as Record<string, unknown>;
      const innerList = inner.operation ?? inner.Operation ?? inner.item ?? inner.row ?? inner.document;
      if (Array.isArray(innerList)) {
        operations = innerList;
        break;
      }
      operations = [val];
      break;
    }
  }

  if (operations.length === 0) {
    const doc = root.Document ?? root.document;
    if (doc && typeof doc === 'object') {
      const docObj = doc as Record<string, unknown>;
      const ops = docObj.Operations ?? docObj.operations;
      if (Array.isArray(ops)) operations = ops;
      else if (ops && typeof ops === 'object') operations = [ops];
    }
  }

  const dateKeys = ['date', 'Date', 'дата', 'Дата', 'DocDate', 'OperationDate'];
  const amountKeys = ['amount', 'Amount', 'сумма', 'Сумма', 'Sum', 'Summa', 'Credit', 'Debit', 'Приход', 'Расход'];
  const descKeys = ['description', 'Description', 'назначение', 'Назначение', 'Purpose', 'PurposePayment', 'Содержание'];
  const counterpartyKeys = ['counterparty', 'Counterparty', 'контрагент', 'Контрагент', 'Payer', 'Receiver', 'Плательщик', 'Получатель'];

  for (const op of operations) {
    if (!op || typeof op !== 'object') continue;
    const row = op as Record<string, unknown>;
    const flat = flattenObject(row);
    const dateStr = findValue(flat, dateKeys, normalizeDate);
    if (!dateStr) continue;
    let amount = findValue(flat, amountKeys, normalizeAmount);
    if (amount === null) {
      const credit = findValue(flat, ['Credit', 'Приход', 'credit'], normalizeAmount);
      const debit = findValue(flat, ['Debit', 'Расход', 'debit'], normalizeAmount);
      if (credit != null && credit !== 0) amount = credit;
      else if (debit != null && debit !== 0) amount = -Math.abs(debit);
      else continue;
    }
    const description = findValue(flat, descKeys, (v) => (v != null && String(v).trim() ? String(v).trim() : undefined));
    const counterparty = findValue(flat, counterpartyKeys, (v) => (v != null && String(v).trim() ? String(v).trim() : undefined));
    result.push({ date: dateStr, amount, description: description ?? undefined, counterparty: counterparty ?? undefined });
  }

  return result;
}

function flattenObject(obj: Record<string, unknown>, prefix = ''): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v != null && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date)) {
      Object.assign(out, flattenObject(v as Record<string, unknown>, key));
    } else {
      out[key] = v;
    }
  }
  return out;
}

function findValue<T>(
  flat: Record<string, unknown>,
  keys: string[],
  normalize: (v: unknown) => T | null
): T | null {
  for (const key of keys) {
    const lower = key.toLowerCase();
    for (const [k, v] of Object.entries(flat)) {
      if (k.toLowerCase() === lower || k.toLowerCase().endsWith('.' + lower)) {
        const n = normalize(v);
        if (n != null) return n;
      }
    }
  }
  return null;
}

export type StatementFormat = 'xml' | 'xlsx';

export function parseStatement(buffer: Buffer, format: StatementFormat): ParsedStatementRow[] {
  if (format === 'xml') return parseXml(buffer);
  if (format === 'xlsx') return parseExcel(buffer);
  throw new Error(`Unsupported format: ${format}`);
}

export function getFormatFromFilename(filename: string): StatementFormat | null {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.xml')) return 'xml';
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) return 'xlsx';
  return null;
}
