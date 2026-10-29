import type { ChainId, Payment, PaymentAsset } from "@/lib/types";

export {
  NEVER_HOLDS_LINE,
  SAMPLE_PAYMENT_LINE,
  TEST_NETWORK_LINE,
  WALLET_CHECK_LATER,
} from "@/lib/copy";

export function chainOfTx(txId: string): ChainId | null {
  const trimmed = txId.trim();
  if (/^0x[a-fA-F0-9]{64}$/.test(trimmed)) return "base-sepolia";
  if (/^[a-fA-F0-9]{64}$/.test(trimmed)) return "bitcoin-signet";
  return null;
}

export function assetFor(chain: ChainId): PaymentAsset {
  return chain === "bitcoin-signet" ? "BTC" : "USDC";
}

export function chainTitle(chain: ChainId): string {
  return chain === "bitcoin-signet" ? "Bitcoin signet" : "Base Sepolia";
}

export function normalizeTxId(txId: string): string | null {
  const chain = chainOfTx(txId);
  if (!chain) return null;
  return txId.trim().toLowerCase();
}

export function normalizeAddress(chain: ChainId, address: string): string | null {
  const trimmed = address.trim();
  if (chain === "base-sepolia") {
    return /^0x[a-fA-F0-9]{40}$/.test(trimmed) ? trimmed.toLowerCase() : null;
  }
  if (/^tb1[qpzry9x8gf2tvdw0s3jn54khce6mua7l]{8,87}$/i.test(trimmed)) return trimmed.toLowerCase();
  if (/^[mn2][1-9A-HJ-NP-Za-km-z]{25,34}$/.test(trimmed)) return trimmed;
  return null;
}

export function sameAddress(left: string, right: string): boolean {
  if (left === right) return true;
  const bechOrHex = (value: string) => value.startsWith("tb1") || value.startsWith("0x") || value.startsWith("TB1");
  return bechOrHex(left) && bechOrHex(right) && left.toLowerCase() === right.toLowerCase();
}

export function explorerUrl(chain: ChainId, txId: string): string | null {
  if (chain === "bitcoin-signet" && /^[a-fA-F0-9]{64}$/.test(txId)) {
    return `https://mempool.space/signet/tx/${txId}`;
  }
  if (chain === "base-sepolia" && /^0x[a-fA-F0-9]{64}$/.test(txId)) {
    return `https://sepolia.basescan.org/tx/${txId}`;
  }
  return null;
}

export function formatChainAmount(amount: number, asset: PaymentAsset): string {
  const digits = asset === "BTC" ? 8 : 6;
  const text = amount.toLocaleString("en-US", { maximumFractionDigits: digits });
  return `${text} ${asset}`;
}

export function paymentBalances(rows: Payment[]): { asset: PaymentAsset; inbound: number; outbound: number; balance: number }[] {
  const assets: PaymentAsset[] = ["BTC", "USDC"];
  return assets.flatMap((asset) => {
    const mine = rows.filter((row) => row.asset === asset);
    if (mine.length === 0) return [];
    const confirmed = mine.filter((row) => row.status === "confirmed");
    const inbound = confirmed
      .filter((row) => row.kind === "capital-in")
      .reduce((sum, row) => sum + row.amount, 0);
    const outbound = confirmed
      .filter((row) => row.kind === "pay-out")
      .reduce((sum, row) => sum + row.amount, 0);
    return [{ asset, inbound, outbound, balance: inbound - outbound }];
  });
}

const SAMPLE_TIME = "2026-10-29T12:00:00.000Z";

/** Demo rows only. They are not chain transactions. */
export function samplePayments(projectId: string): Payment[] {
  return [
    {
      id: "sample-capital-in",
      projectId,
      kind: "capital-in",
      chain: "bitcoin-signet",
      txId: "sample-capital-in",
      fromAddress: "tb1qsamplefrom",
      toAddress: "tb1qsampleproject",
      asset: "BTC",
      amount: 0.005,
      confirmations: 3,
      status: "confirmed",
      commitmentId: null,
      contributionId: null,
      reason: null,
      checkedAt: SAMPLE_TIME,
      createdAt: SAMPLE_TIME,
    },
    {
      id: "sample-pay-out",
      projectId,
      kind: "pay-out",
      chain: "base-sepolia",
      txId: "sample-pay-out",
      fromAddress: "0xsamplefrom",
      toAddress: "0xsampleworker",
      asset: "USDC",
      amount: 40,
      confirmations: 5,
      status: "confirmed",
      commitmentId: null,
      contributionId: null,
      reason: null,
      checkedAt: SAMPLE_TIME,
      createdAt: SAMPLE_TIME,
    },
    {
      id: "sample-pending",
      projectId,
      kind: "capital-in",
      chain: "base-sepolia",
      txId: "sample-pending",
      fromAddress: "0xsamplefrom",
      toAddress: "0xsampleproject",
      asset: "USDC",
      amount: 25,
      confirmations: 1,
      status: "pending",
      commitmentId: null,
      contributionId: null,
      reason: null,
      checkedAt: SAMPLE_TIME,
      createdAt: SAMPLE_TIME,
    },
  ];
}

export const SAMPLE_PROJECT_ADDRESS = "tb1qfundworksampleaddress000000000000000000";
