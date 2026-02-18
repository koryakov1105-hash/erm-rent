// Категории для доходов (выпадающий список при выборе «Доход»)
export const INCOME_CATEGORIES = [
  'Арендная плата',
  'Предоплата',
  'Залог',
  'Компенсация',
  'Прочие доходы',
] as const;

// Категории для расходов (выпадающий список при выборе «Расход»)
export const EXPENSE_CATEGORIES = [
  'Коммунальные услуги',
  'Налоги',
  'Обслуживание и ремонт',
  'Страхование',
  'Управление',
  'Прочие расходы',
] as const;

/** Подкатегории при выборе «Коммунальные услуги» */
export const UTILITY_SUBCATEGORIES = [
  'Тепло',
  'Водоснабжение и водоотведение',
  'Вывоз мусора',
  'Электроснабжение',
  'Газоснабжение',
  'Обслуживание (УК, ТСЖ)',
  'Прочие коммунальные',
] as const;

export type IncomeCategory = typeof INCOME_CATEGORIES[number];
export type ExpenseCategory = typeof EXPENSE_CATEGORIES[number];
export type UtilitySubcategory = typeof UTILITY_SUBCATEGORIES[number];