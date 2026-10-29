import "server-only";

import { sameAddress } from "@/lib/money";

// Read-only. Fundwork does not hold a key and does not sign.
// Mainnet and Lightning are not built.

const TX_URL = "https://mempool.space/signet/api/tx/";
const TIP_URL = "https://mempool.space/signet/api/blocks/tip/height";

export type ChainLook = {
  found: boolean;
  failed: boolean;
  ambiguous: boolean;
  fromAddress: string;
  toAddress: string;
  amount: string;
  confirmations: number;
};

function record(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

const zero = BigInt(0);
const satsPerBtc = BigInt(100000000);

function satsOf(value: unknown): bigint {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) return BigInt(Math.round(value));
  if (typeof value === "string" && /^\d+$/.test(value)) return BigInt(value);
  return zero;
}

function btcString(sats: bigint): string {
  const whole = sats / satsPerBtc;
  const frac = (sats % satsPerBtc).toString().padStart(8, "0").replace(/0+$/, "");
  return frac ? `${whole.toString()}.${frac}` : whole.toString();
}

async function readBody(url: string): Promise<{ status: number; text: string }> {
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(20000) });
  return { status: response.status, text: await response.text() };
}

/** Count outputs that pay one of the candidate addresses. Confirmations are the chain count. Confirmed at 3. */
export async function readBitcoin(txId: string, candidates: string[]): Promise<ChainLook> {
  const empty: ChainLook = {
    found: false,
    failed: false,
    ambiguous: false,
    fromAddress: "",
    toAddress: "",
    amount: "0",
    confirmations: 0,
  };
  const tx = await readBody(`${TX_URL}${encodeURIComponent(txId)}`);
  if (tx.status === 404) return empty;
  if (tx.status !== 200) throw new Error("The signet reader did not answer.");
  const body = record(JSON.parse(tx.text) as unknown);
  if (!body) return empty;

  const outputs = Array.isArray(body.vout) ? body.vout : [];
  const totals = new Map<string, bigint>();
  let firstAddress = "";
  let firstAmount = zero;
  for (const output of outputs) {
    const row = record(output);
    if (!row) continue;
    const address = typeof row.scriptpubkey_address === "string" ? row.scriptpubkey_address : "";
    const sats = satsOf(row.value);
    if (!address) continue;
    if (!firstAddress) {
      firstAddress = address;
      firstAmount = sats;
    }
    const hit = candidates.find((candidate) => sameAddress(candidate, address));
    if (!hit) continue;
    totals.set(hit, (totals.get(hit) ?? zero) + sats);
  }

  const paid = [...totals.entries()].filter((entry) => entry[1] > zero);
  const inputs = Array.isArray(body.vin) ? body.vin : [];
  const firstIn = record(record(inputs[0])?.prevout);
  const fromAddress = typeof firstIn?.scriptpubkey_address === "string" ? firstIn.scriptpubkey_address : "";

  const statusResponse = await readBody(`${TX_URL}${encodeURIComponent(txId)}/status`);
  let confirmations = 0;
  if (statusResponse.status === 200) {
    const status = record(JSON.parse(statusResponse.text) as unknown);
    const height = status && typeof status.block_height === "number" ? status.block_height : null;
    if (status?.confirmed === true && height !== null) {
      const tip = await readBody(TIP_URL);
      const tipHeight = tip.status === 200 ? Number(tip.text) : NaN;
      if (Number.isFinite(tipHeight)) confirmations = Math.max(0, tipHeight - height + 1);
    }
  }

  if (paid.length === 0) {
    return {
      found: true,
      failed: false,
      ambiguous: false,
      fromAddress,
      toAddress: firstAddress || "unknown",
      amount: btcString(firstAmount),
      confirmations,
    };
  }
  if (paid.length > 1) {
    return {
      found: true,
      failed: false,
      ambiguous: true,
      fromAddress,
      toAddress: paid[0][0],
      amount: btcString(paid[0][1]),
      confirmations,
    };
  }
  return {
    found: true,
    failed: false,
    ambiguous: false,
    fromAddress,
    toAddress: paid[0][0],
    amount: btcString(paid[0][1]),
    confirmations,
  };
}
