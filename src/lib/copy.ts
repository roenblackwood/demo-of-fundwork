import { isLive } from "@/lib/mode";

/** Plain-language lines for the capital and pay model. Not a chatbot. */
export const CAPITAL_LINE =
  "Funded with Bitcoin capital. Workers paid in a stable unit.";

export const COMMIT_LINE =
  "You deploy Bitcoin capital. Workers receive a stable unit.";

/** Keep this until a product decision says how units pay. */
export const UNITS_PAYOUT_LINE =
  "How units pay out is not set yet. Do not commit expecting a payout.";

export function savedLabel(): string {
  return isLive() ? "Saved" : "Saved on this phone";
}

export function moneyNote(): string {
  return isLive() ? "Test version. No money moves yet." : "This is a demo. No money moves.";
}
