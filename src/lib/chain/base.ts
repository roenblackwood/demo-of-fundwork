import "server-only";

import { decodeEventLog, formatUnits, parseAbiItem, type Hex } from "viem";
import { baseSepolia } from "viem/chains";
import { createPublicClient, http } from "viem";
import { sameAddress } from "@/lib/money";
import type { ChainLook } from "@/lib/chain/bitcoin";

// Read-only. This client does not sign and does not send.
// Mainnet is not built.

/** Circle native USDC on Base Sepolia.
 * Source: Circle docs, "USDC Contract Addresses", testnet table.
 * https://developers.circle.com/stablecoins/usdc-contract-addresses
 */
export const BASE_SEPOLIA_USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

const transferEvent = parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 value)");

const client = createPublicClient({
  chain: baseSepolia,
  transport: http("https://sepolia.base.org"),
});

type Transfer = { from: string; to: string; value: bigint; candidate: string | null };

/** Sum USDC Transfer logs to the candidate addresses. Confirmed after a successful receipt plus 5 more blocks. */
export async function readBase(txId: string, candidates: string[]): Promise<ChainLook> {
  const empty: ChainLook = {
    found: false,
    failed: false,
    ambiguous: false,
    fromAddress: "",
    toAddress: "",
    amount: "0",
    confirmations: 0,
  };
  const hash = txId as Hex;
  let receipt: Awaited<ReturnType<typeof client.getTransactionReceipt>>;
  try {
    receipt = await client.getTransactionReceipt({ hash });
  } catch (error) {
    const name = error && typeof error === "object" && "name" in error ? String(error.name) : "";
    if (name.includes("NotFound")) return empty;
    throw error;
  }

  const transfers: Transfer[] = [];
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== BASE_SEPOLIA_USDC.toLowerCase()) continue;
    try {
      const decoded = decodeEventLog({ abi: [transferEvent], data: log.data, topics: log.topics });
      const from = String(decoded.args.from);
      const to = String(decoded.args.to);
      const hit = candidates.find((candidate) => sameAddress(candidate, to)) ?? null;
      transfers.push({ from, to, value: decoded.args.value, candidate: hit });
    } catch {
      // Not a USDC Transfer log.
    }
  }

  const head = await client.getBlockNumber();
  const depth = receipt.blockNumber === null ? 0 : Number(head - receipt.blockNumber);
  const confirmations = receipt.status === "success" ? Math.max(0, depth) : 0;
  const failed = receipt.status !== "success";

  const grouped = new Map<string, { from: string; value: bigint }>();
  for (const transfer of transfers) {
    if (!transfer.candidate || transfer.value <= BigInt(0)) continue;
    const current = grouped.get(transfer.candidate) ?? { from: transfer.from, value: BigInt(0) };
    current.value += transfer.value;
    grouped.set(transfer.candidate, current);
  }
  const paid = [...grouped.entries()].filter((entry) => entry[1].value > BigInt(0));

  if (paid.length === 0) {
    const first = transfers[0];
    return {
      found: true,
      failed,
      ambiguous: false,
      fromAddress: first?.from ?? receipt.from,
      toAddress: first?.to.toLowerCase() ?? "0x0000000000000000000000000000000000000000",
      amount: first ? formatUnits(first.value, 6) : "0",
      confirmations,
    };
  }
  if (paid.length > 1) {
    return {
      found: true,
      failed,
      ambiguous: true,
      fromAddress: paid[0][1].from,
      toAddress: paid[0][0],
      amount: formatUnits(paid[0][1].value, 6),
      confirmations,
    };
  }
  return {
    found: true,
    failed,
    ambiguous: false,
    fromAddress: paid[0][1].from,
    toAddress: paid[0][0],
    amount: formatUnits(paid[0][1].value, 6),
    confirmations,
  };
}

export async function verifyBaseMessage(address: string, message: string, signature: string): Promise<boolean> {
  const signed = signature.startsWith("0x") ? signature : `0x${signature}`;
  if (!/^0x[a-fA-F0-9]+$/.test(signed)) return false;
  try {
    return await client.verifyMessage({
      address: address as Hex,
      message,
      signature: signed as Hex,
    });
  } catch {
    return false;
  }
}
