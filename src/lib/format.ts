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

export function firstName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "You";
  return trimmed.split(/\s+/)[0] ?? "You";
}

export function placeLine(town: string, parish: string): string {
  return `${town}, ${parish}`;
}
