import raw from "../../data/countries.json";

export type CountryStatus = "open" | "limited" | "not-checked" | "blocked";

export type RuleSource = {
  title: string;
  url: string;
};

export type CountryRule = {
  id: string;
  name: string;
  regionId: string;
  status: CountryStatus;
  cryptoNote: string;
  investNote: string;
  sources: RuleSource[];
  checkedOn: string;
};

const COUNTRIES = raw as CountryRule[];

const byId = new Map(COUNTRIES.map((country) => [country.id, country]));

export function countryRules(): CountryRule[] {
  return COUNTRIES;
}

export function countryRule(id: string): CountryRule | undefined {
  return byId.get(id);
}

export function isListableCountry(id: string): boolean {
  const rule = byId.get(id);
  return Boolean(rule && rule.status !== "blocked");
}

export function chipLabel(status: CountryStatus): "Limited rules" | "Rules not checked yet" | null {
  if (status === "limited") return "Limited rules";
  if (status === "not-checked") return "Rules not checked yet";
  return null;
}

export function statusLabel(status: CountryStatus): "Open" | "Limited" | "Not checked" | "Blocked" {
  if (status === "open") return "Open";
  if (status === "limited") return "Limited";
  if (status === "not-checked") return "Not checked";
  return "Blocked";
}

// Later: flag a country when checkedOn is more than 90 days old.
// Later: record per-country sector limits on foreign ownership.
