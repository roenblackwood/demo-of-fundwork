import { countryRule } from "@/lib/country-rules";

export type InvestRule = "open" | "interest-only" | "blocked";
export type WorkRule = "open" | "blocked";

export type ResidenceSource = {
  title: string;
  url: string;
};

export type ResidenceRule = {
  code: string;
  invest: InvestRule;
  work: WorkRule;
  note: string;
  sources: ResidenceSource[];
  checkedOn: string;
};

type ResidenceFile = {
  comment: string;
  countries: ResidenceRule[];
};

// Invest is open only for countries a lawyer has cleared. None are cleared.
// A lawyer must review the blocked list before it is treated as final.
// Identity checks through a licensed provider are the real residence control. Not built.
// Per-state rules for the United States are not built.
let listed: ResidenceRule[] | null = null;
let byCode = new Map<string, ResidenceRule>();
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

export function residenceReady(): boolean {
  return listed !== null;
}

export function subscribeResidence(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The rules file loads with the screen that needs it, not with the home map. */
export function loadResidenceRules(): Promise<void> {
  if (listed) return Promise.resolve();
  loading ??= import("../../data/residence-rules.json").then((mod) => {
    const file = (mod.default ?? mod) as ResidenceFile;
    listed = file.countries;
    byCode = new Map(listed.map((row) => [row.code, row]));
    choices = null;
    for (const listener of listeners) listener();
  });
  return loading;
}

const DEFAULTS: Pick<ResidenceRule, "invest" | "work" | "note" | "sources" | "checkedOn"> = {
  invest: "interest-only",
  work: "blocked",
  note: "",
  sources: [],
  checkedOn: "",
};

/** ISO country code to the market id in data/countries.json. */
export const RESIDENCE_MARKET: Record<string, string> = {
  JM: "jamaica",
  DO: "dominican-republic",
  BB: "barbados",
  SV: "el-salvador",
  CO: "colombia",
  MX: "mexico",
  KE: "kenya",
  GH: "ghana",
  RW: "rwanda",
  IN: "india",
  ID: "indonesia",
  PH: "philippines",
  BR: "brazil",
  NG: "nigeria",
  VN: "vietnam",
  PK: "pakistan",
  JO: "jordan",
};

const OCCUPIED = [
  { code: "UA-CR", name: "Crimea" },
  { code: "UA-DT", name: "Donetsk" },
  { code: "UA-LH", name: "Luhansk" },
] as const;

const CODES = [
  "AF", "AL", "DZ", "AD", "AO", "AG", "AR", "AM", "AU", "AT", "AZ", "BS", "BH", "BD", "BB", "BY", "BE", "BZ", "BJ", "BT",
  "BO", "BA", "BW", "BR", "BN", "BG", "BF", "BI", "CV", "KH", "CM", "CA", "CF", "TD", "CL", "CN", "CO", "KM", "CG", "CR",
  "CI", "HR", "CU", "CY", "CZ", "CD", "DK", "DJ", "DM", "DO", "EC", "EG", "SV", "GQ", "ER", "EE", "SZ", "ET", "FJ", "FI",
  "FR", "GA", "GM", "GE", "DE", "GH", "GR", "GD", "GT", "GN", "GW", "GY", "HT", "HN", "HU", "IS", "IN", "ID", "IR", "IQ",
  "IE", "IL", "IT", "JM", "JP", "JO", "KZ", "KE", "KI", "KP", "KR", "KW", "KG", "LA", "LV", "LB", "LS", "LR", "LY", "LI",
  "LT", "LU", "MG", "MW", "MY", "MV", "ML", "MT", "MH", "MR", "MU", "MX", "FM", "MD", "MC", "MN", "ME", "MA", "MZ", "MM",
  "NA", "NR", "NP", "NL", "NZ", "NI", "NE", "NG", "MK", "NO", "OM", "PK", "PW", "PA", "PG", "PY", "PE", "PH", "PL", "PT",
  "QA", "RO", "RU", "RW", "KN", "LC", "VC", "WS", "SM", "ST", "SA", "SN", "RS", "SC", "SL", "SG", "SK", "SI", "SB", "SO",
  "ZA", "SS", "ES", "LK", "SD", "SR", "SE", "CH", "SY", "TW", "TJ", "TZ", "TH", "TL", "TG", "TO", "TT", "TN", "TR", "TM",
  "TV", "UG", "UA", "AE", "GB", "US", "UY", "UZ", "VU", "VA", "VE", "VN", "YE", "ZM", "ZW",
];

export function residenceRules(): ResidenceRule[] {
  return listed ?? [];
}

export function residenceFor(code: string | null | undefined): ResidenceRule {
  if (!code) {
    return { code: "", ...DEFAULTS };
  }
  return byCode.get(code) ?? { code, ...DEFAULTS };
}

export type InvestStanding = "open" | "interest" | "blocked" | "legacy";

/** A missing residence keeps the current demo commit path. A stated residence follows the file. */
export function investStanding(code: string | null | undefined): InvestStanding {
  if (!code) return "legacy";
  const rule = residenceFor(code);
  if (rule.invest === "open") return "open";
  if (rule.invest === "blocked") return "blocked";
  return "interest";
}

export function canCommitMoney(code: string | null | undefined): boolean {
  const standing = investStanding(code);
  return standing === "legacy" || standing === "open";
}

export function cleanResidence(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const code = value.trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(code)) return code;
  if (code === "UA-CR" || code === "UA-DT" || code === "UA-LH") return code;
  return null;
}

export function residenceName(code: string): string {
  const occupied = OCCUPIED.find((item) => item.code === code);
  if (occupied) return occupied.name;
  try {
    const names = new Intl.DisplayNames(["en"], { type: "region" });
    const name = names.of(code);
    return name && name !== code ? name : code;
  } catch {
    return code;
  }
}

export function flagFor(code: string): string {
  if (!/^[A-Z]{2}$/.test(code)) return "●";
  const base = 127397;
  return String.fromCodePoint(base + code.charCodeAt(0), base + code.charCodeAt(1));
}

export type CountryChoice = {
  code: string;
  name: string;
  flag: string;
};

let choices: CountryChoice[] | null = null;

function allChoices(): CountryChoice[] {
  if (choices) return choices;
  const seen = new Set<string>();
  const rows: CountryChoice[] = [];
  function add(code: string) {
    if (seen.has(code)) return;
    seen.add(code);
    rows.push({ code, name: residenceName(code), flag: flagFor(code) });
  }
  for (const code of CODES) add(code);
  for (const item of OCCUPIED) add(item.code);
  for (const row of listed ?? []) add(row.code);
  rows.sort((a, b) => a.name.localeCompare(b.name));
  if (listed) choices = rows;
  return rows;
}

export function searchCountries(query: string): CountryChoice[] {
  const text = query.trim().toLowerCase();
  if (!text) return [];
  return allChoices()
    .filter((item) => item.name.toLowerCase().includes(text) || item.code.toLowerCase().includes(text))
    .slice(0, 12);
}

export function marketIdForResidence(code: string): string | null {
  return RESIDENCE_MARKET[code] ?? null;
}

export function marketAllowsWork(code: string): boolean {
  const market = marketIdForResidence(code);
  if (!market) return false;
  const rule = countryRule(market);
  return rule?.status === "open" || rule?.status === "limited";
}
