/** Счета учёта по умолчанию + привязка к старым категориям из UI ([constants/categories.ts](frontend)). */

export type CfsActivity = 'operating' | 'investing' | 'financing';
export type PlGroup = 'revenue' | 'direct_cost' | 'operating_expense' | 'other';

export interface LedgerAccountTemplate {
  code: string;
  name: string;
  kind: 'income' | 'expense';
  cfs_activity: CfsActivity;
  pl_group: PlGroup;
  /** Точное совпадение с полем transaction.category */
  mapped_categories: string[];
}

export const DEFAULT_LEDGER_TEMPLATES: LedgerAccountTemplate[] = [
  {
    code: '4010',
    name: 'Выручка от аренды',
    kind: 'income',
    cfs_activity: 'operating',
    pl_group: 'revenue',
    mapped_categories: ['Арендная плата'],
  },
  {
    code: '4020',
    name: 'Предоплата и прочие поступления',
    kind: 'income',
    cfs_activity: 'operating',
    pl_group: 'revenue',
    mapped_categories: ['Предоплата', 'Залог', 'Компенсация', 'Прочие доходы'],
  },
  {
    code: '6110',
    name: 'Коммунальные услуги',
    kind: 'expense',
    cfs_activity: 'operating',
    pl_group: 'direct_cost',
    mapped_categories: ['Коммунальные услуги'],
  },
  {
    code: '6120',
    name: 'Налоги и сборы',
    kind: 'expense',
    cfs_activity: 'operating',
    pl_group: 'operating_expense',
    mapped_categories: ['Налоги'],
  },
  {
    code: '6130',
    name: 'Обслуживание и ремонт',
    kind: 'expense',
    cfs_activity: 'operating',
    pl_group: 'direct_cost',
    mapped_categories: ['Обслуживание и ремонт'],
  },
  {
    code: '6140',
    name: 'Страхование',
    kind: 'expense',
    cfs_activity: 'operating',
    pl_group: 'operating_expense',
    mapped_categories: ['Страхование'],
  },
  {
    code: '6150',
    name: 'Управление и администрирование',
    kind: 'expense',
    cfs_activity: 'operating',
    pl_group: 'operating_expense',
    mapped_categories: ['Управление'],
  },
  {
    code: '6190',
    name: 'Прочие расходы',
    kind: 'expense',
    cfs_activity: 'operating',
    pl_group: 'operating_expense',
    mapped_categories: ['Прочие расходы'],
  },
];
