function withCurrency(currency: string, text: string): string {
  const spaced = /[A-Za-z]$/.test(currency) && !currency.endsWith("$");
  return spaced ? `${currency} ${text}` : `${currency}${text}`;
}

export function money(amount: number, currency = "J$"): string {
  return withCurrency(currency, Math.round(amount).toLocaleString("en-US"));
}

export function moneyShort(amount: number, currency = "J$"): string {
  const abs = Math.abs(amount);
  if (abs >= 1_000_000) {
    const millions = Math.round((amount / 1_000_000) * 10) / 10;
    const text = Number.isInteger(millions)
      ? millions.toFixed(0)
      : millions.toFixed(1);
    return withCurrency(currency, `${text} million`);
  }
  return money(amount, currency);
}

export function capitalStart(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

export function firstName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "You";
  return trimmed.split(/\s+/)[0] ?? "You";
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  const first = parts[0]?.[0] ?? "";
  if (parts.length === 1) return first.toUpperCase();
  const last = parts[parts.length - 1]?.[0] ?? "";
  return `${first}${last}`.toUpperCase();
}

/** "Marcia Bennett" becomes "Marcia B." */
export function nameWithInitial(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Someone";
  if (parts.length === 1) return parts[0] ?? "Someone";
  const last = parts[parts.length - 1]?.[0] ?? "";
  return `${parts[0]} ${last.toUpperCase()}.`;
}

export function postedDate(iso: string): string {
  const value = iso.length === 10 ? `${iso}T00:00:00Z` : iso;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function placeLine(town: string, parish: string): string {
  return `${town}, ${parish}`;
}
