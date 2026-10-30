import { isLive } from "@/lib/mode";

/** Plain-language lines for the capital and pay model. Not a chatbot. */
export const CAPITAL_LINE =
  "Funded with Bitcoin capital. Workers paid in a stable unit.";

export const COMMIT_LINE =
  "You deploy Bitcoin capital. Workers receive a stable unit.";

/** Keep this until a product decision says how units pay. */
export const UNITS_PAYOUT_LINE =
  "How units pay out is not set yet. Do not commit expecting a payout.";

export const NEVER_HOLDS_LINE =
  "Fundwork never holds your money. You send it yourself, and we check it on the chain.";

export const TEST_NETWORK_LINE = "Test network. These coins have no value.";

export const WALLET_CHECK_LATER = "Wallet checks run in the live version.";

export const SIGNING_WARNING =
  "Fundwork will never ask you to sign a transaction, approve a token, or share your recovery words. If a page asks, close it.";

export const SINGLE_WALLET_REFUSED =
  "This project is above US$5,000. It needs a wallet that takes more than one key.";

export const SAMPLE_PAYMENT_LINE = "Sample. Not on a chain.";

export function savedLabel(): string {
  return isLive() ? "Saved" : "Saved on this phone";
}

export function moneyNote(): string {
  return isLive() ? NEVER_HOLDS_LINE : "This is a demo. No money moves.";
}
