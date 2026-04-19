export const DEPARTMENT_KEYS = [
  'agf',
  'meals',
  'breakfast',
  'vlees',
  'deli_cheese',
  'dairy',
  'frozen',
  'wine',
  'coffee_cooking',
  'beer',
  'soft_drinks',
  'non_food',
  'chips_snacks',
  'toilet_paper',
  'mixed',
] as const

export type DepartmentKey = (typeof DEPARTMENT_KEYS)[number]

export const DEPARTMENT_LABELS: Record<DepartmentKey, { nl: string; en: string }> = {
  agf: { nl: 'AGF', en: 'AGF' },
  meals: { nl: 'Maaltijden', en: 'Meals' },
  breakfast: { nl: 'Ontbijt', en: 'Breakfast' },
  vlees: { nl: 'Vlees', en: 'Meat' },
  deli_cheese: { nl: 'Vleeswaren & Kaas', en: 'Deli & Cheese' },
  dairy: { nl: 'Zuivel', en: 'Dairy' },
  frozen: { nl: 'Diepvries', en: 'Frozen Foods' },
  wine: { nl: 'Wijn', en: 'Wine' },
  coffee_cooking: { nl: 'Koffie & Koken', en: 'Coffee & Cooking' },
  beer: { nl: 'Bier', en: 'Beer' },
  soft_drinks: { nl: 'Frisdrank', en: 'Soft Drinks' },
  non_food: { nl: 'Non-food', en: 'Non-food' },
  chips_snacks: { nl: 'Chips & Snacks', en: 'Chips & Snacks' },
  toilet_paper: { nl: 'Toiletpapier', en: 'Toilet Paper' },
  mixed: { nl: 'Mix', en: 'Mixed' },
}

export function getDepartmentLabel(key: string, lang: 'nl' | 'en'): string {
  const entry = DEPARTMENT_LABELS[key as DepartmentKey]
  return entry ? entry[lang] : key
}
