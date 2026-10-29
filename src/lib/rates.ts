/**
 * Rough demo rates, in local units per US dollar.
 * Update these before real use.
 * Keys are the currency strings in the seed, not a second code list.
 * J$ is JMD, KSh is KES, GH₵ is GHS, Tk is BDT, Rp is IDR, COL$ is COP,
 * E£ is EGP, Bds$ is BBD, TT$ is TTD, MX$ is MXN, lei is RON.
 */
export const RATES_AS_OF = "2026-10-28";

export const USD_RATES: Record<string, number> = {
  "J$": 157,
  KSh: 129,
  "GH₵": 12.5,
  Tk: 120,
  Rp: 16000,
  "COL$": 4000,
  JOD: 0.709,
  MDL: 17.5,
  "E£": 48,
  "Bds$": 2,
  "TT$": 6.8,
  "MX$": 19,
  BRL: 5.5,
  NGN: 1500,
  LBP: 89500,
  lei: 4.5,
  UAH: 41,
  INR: 87,
  NPR: 139,
  PHP: 57,
  VND: 25500,
};

function roundSig(value: number, figs: number): number {
  if (!Number.isFinite(value) || value === 0) return 0;
  const sign = Math.sign(value);
  const abs = Math.abs(value);
  const power = Math.floor(Math.log10(abs));
  const magnitude = 10 ** (power - (figs - 1));
  const rounded = Math.round(abs / magnitude) * magnitude;
  const digits = Math.max(0, figs - 1 - power);
  return sign * Number(rounded.toFixed(digits));
}

/** "about US$31,000". Empty when the currency has no demo rate. */
export function aboutUsd(amount: number, currency: string): string {
  const rate = USD_RATES[currency];
  if (!rate || !Number.isFinite(amount)) return "";
  const usd = roundSig(amount / rate, 2);
  const text = usd.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return `about US$${text}`;
}
