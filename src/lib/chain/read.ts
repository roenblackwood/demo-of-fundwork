import "server-only";

import { Verifier } from "bip322-js";
import { readBase, verifyBaseMessage } from "@/lib/chain/base";
import { readBitcoin, type ChainLook } from "@/lib/chain/bitcoin";
import type { ChainId } from "@/lib/types";

// Mainnet, Lightning, a background watcher, and local cash-out partners are not built.
// Identity checks, when they come, use a licensed provider and store only a checked flag and a date, never documents.

export type { ChainLook };

export async function readChain(chain: ChainId, txId: string, candidates: string[]): Promise<ChainLook> {
  if (chain === "bitcoin-signet") return readBitcoin(txId, candidates);
  return readBase(txId, candidates);
}

export function verifyBitcoinMessage(address: string, message: string, signature: string): boolean {
  try {
    return Verifier.verifySignature(address, message, signature.trim());
  } catch {
    return false;
  }
}

export async function verifyWalletSignature(
  chain: ChainId,
  address: string,
  message: string,
  signature: string,
): Promise<boolean> {
  if (chain === "bitcoin-signet") return verifyBitcoinMessage(address, message, signature);
  return verifyBaseMessage(address, message, signature);
}
