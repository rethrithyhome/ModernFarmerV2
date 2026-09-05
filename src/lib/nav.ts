export type Section =
  | "dashboard"
  | "materials"
  | "recipes"
  | "lots"
  | "labels"
  | "plan"
  | "qc"
  | "customers"
  | "finished"
  | "reports"
  | "settings";

export type View = { section: Section; lotId?: string };

export type Go = (section: Section, opts?: { lotId?: string }) => void;

export type NavGroup = "production" | "sales" | null;

/** `label` is what the rail and mobile menu can fit; `full` is the page name. */
export type NavItem = { section: Section; label: string; full: string; group: NavGroup };

export const NAV: NavItem[] = [
  { section: "dashboard", label: "សង្ខេប", full: "ផ្ទាំងសង្ខេបផលិតកម្ម", group: null },
  { section: "materials", label: "ស្តុក", full: "ស្តុកវត្ថុធាតុដើម", group: "production" },
  { section: "recipes", label: "រូបមន្ត", full: "រូបមន្តផលិតកម្ម", group: "production" },
  { section: "lots", label: "Lot", full: "Lot ផលិតកម្ម", group: "production" },
  { section: "labels", label: "ស្លាក QR", full: "ស្លាក QR សម្រាប់ Lot", group: "production" },
  { section: "plan", label: "គម្រោង", full: "គម្រោងផលិតកម្មប្រចាំខែ", group: "production" },
  { section: "qc", label: "គុណភាព", full: "ត្រួតពិនិត្យគុណភាព", group: "production" },
  { section: "customers", label: "អតិថិជន", full: "អតិថិជន និងការកត់ត្រា", group: "sales" },
  { section: "finished", label: "ផលិតផល", full: "ផលិតផលសម្រេច", group: "sales" },
  { section: "reports", label: "របាយ", full: "របាយការណ៍ និងថវិកា", group: null },
  { section: "settings", label: "ការកំណត់", full: "ទិន្នន័យ និងការកំណត់", group: null },
];

export const GROUP_LABEL: Record<Exclude<NavGroup, null>, string> = {
  production: "ផលិតកម្ម",
  sales: "លក់",
};

/**
 * Sections each role can see, when cloud sync (and therefore login) is configured.
 * Backend RLS is the real enforcement (see supabase/schema.sql) — this only keeps the nav
 * from offering pages an account can't write to. `admin` always sees everything.
 */
export const ROLE_SECTIONS: Record<"stock" | "sale", Section[]> = {
  stock: ["dashboard", "materials", "recipes", "lots", "labels", "plan", "qc", "finished"],
  sale: ["dashboard", "customers", "finished"],
};

export const navForRole = (role: "admin" | "stock" | "sale" | null): NavItem[] => {
  if (!role || role === "admin") return NAV;
  const allowed = new Set(ROLE_SECTIONS[role]);
  return NAV.filter((item) => allowed.has(item.section));
};

/** Groups `items` in NAV's own order, dropping empty groups — used to render the rail and the mobile sheet identically. */
export function groupNav(items: NavItem[]): { group: NavGroup; items: NavItem[] }[] {
  const order: NavGroup[] = [null, "production", "sales"];
  return order
    .map((group) => ({ group, items: items.filter((item) => item.group === group) }))
    .filter((bucket) => bucket.items.length > 0);
}

/**
 * Bottom tab bar on phones: dashboard + up to 3 more, always in NAV order. When a role's
 * whole nav already fits in 4 tabs, everything gets a direct tab and no "more" sheet is
 * needed at all; otherwise the 4th slot is a "more" button that opens the full grouped list.
 */
export function mobilePrimary(items: NavItem[]): { pinned: NavItem[]; needsMore: boolean } {
  if (items.length <= 4) return { pinned: items, needsMore: false };
  return { pinned: items.slice(0, 3), needsMore: true };
}

export const PAGE_TITLES: Record<Section, { title: string; sub: string }> = {
  dashboard: {
    title: "ផ្ទាំងសង្ខេបផលិតកម្ម",
    sub: "ទិន្នផល តម្លៃដើម គុណភាព និងស្តុកសព្វថ្ងៃ នៃកន្លែងផលិតជីកំប៉ុស្តិ៍",
  },
  materials: {
    title: "ស្តុកវត្ថុធាតុដើម",
    sub: "ទិញចូល ប្រើចេញ និងកម្រិតត្រូវបញ្ជាទិញឡើងវិញ សម្រាប់ជីធម្មជាតិ",
  },
  recipes: {
    title: "រូបមន្តផលិតកម្ម",
    sub: "សមាមាត្រវត្ថុធាតុដើម C:N ស្តង់ដារគុណភាព និងតម្លៃដើមក្នុងមួយ Lot",
  },
  labels: {
    title: "ស្លាក QR សម្រាប់ Lot",
    sub: "បោះពុម្ពស្លាកសម្រាប់ជារបៀងផ្កាម — QR ផ្ទុកលេខLot · ស្កេនដោយទូរស័ព្ទ ដើម្បីបើកទំព័រLot នោះ",
  },
  plan: {
    title: "គម្រោងផលិតកម្មប្រចាំខែ",
    sub: "កំណត់គោលដៅជីសម្រេច (គ.ក) ប្រចាំខែ រួចប្រៀបធៀបនឹង Lot ដែលកំពុងផលិត",
  },
  customers: {
    title: "អតិថិជន និងការកត់ត្រា",
    sub: "ប្រវត្តិទិញជី តម្លៃសរុប ការបង់ប្រាក់ និងសល់ជំពាក់ របស់អតិថិជនម្នាក់ៗ",
  },
  lots: {
    title: "Lot ផលិតកម្ម",
    sub: "បើក Lot ថ្មី តាមដានសីតុណ្ហភាព សំណើម ការកូរបុក និងបញ្ចប់ទិន្នផល",
  },
  qc: {
    title: "ត្រួតពិនិត្យគុណភាព",
    sub: "លទ្ធផលវិភាគ pH OC N P K ធៀបស្តង់ដាររូបមន្ត មុនចេញលក់",
  },
  finished: {
    title: "ផលិតផលសម្រេច",
    sub: "ស្តុកជីក្នុងថង់ ការបញ្ចេញលក់ និងតម្លៃលក់",
  },
  reports: {
    title: "របាយការណ៍ និងថវិកា",
    sub: "ទិន្នន័យខែ សន្ទស្សន៍ថ្លៃដើម ការប្រើវត្ថុធាតុដើម និងសង្ខេបហិរញ្ញវត្ថុ",
  },
  settings: {
    title: "ទិន្នន័យ និងការកំណត់",
    sub: "ទាញយក/បញ្ចូលឯកសារ JSON សម្រាប់ផ្ទេររវាងកុំព្យូទ័រ និងទូរស័ព្ទ",
  },
};
