import "server-only";

import { adminSupabase } from "@/lib/supabase/admin";
import { readChain, type ChainLook } from "@/lib/chain/read";
import { assetFor } from "@/lib/money";
import type { ChainId, PaymentKind } from "@/lib/types";

// A background watcher can call recheckPending later. There is no job yet.
// Mainnet, Lightning, multisig or escrow, and local cash-out partners are not built.

type Recorded = { status?: string; reason?: string | null };

function recorded(value: unknown): Recorded | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Recorded;
  if (row.status !== "pending" && row.status !== "confirmed" && row.status !== "mismatch") return null;
  return row;
}

export async function recordLook(input: {
  projectId: string;
  kind: PaymentKind;
  chain: ChainId;
  txId: string;
  commitmentId: string | null;
  contributionId: string | null;
  look: ChainLook;
}): Promise<{ ok: boolean; reason: string }> {
  const admin = adminSupabase();
  if (!admin) return { ok: false, reason: "Wallet checks run in the live version." };
  const { data, error } = await admin.rpc("record_observed_payment", {
    p_project_id: input.projectId,
    p_kind: input.kind,
    p_chain: input.chain,
    p_tx_id: input.txId,
    p_from_address: input.look.fromAddress,
    p_to_address: input.look.toAddress,
    p_asset: assetFor(input.chain),
    p_amount: input.look.amount,
    p_confirmations: input.look.confirmations,
    p_commitment_id: input.commitmentId,
    p_contribution_id: input.contributionId,
    p_failed: input.look.failed,
    p_ambiguous: input.look.ambiguous,
  });
  if (error) return { ok: false, reason: "We could not record that check." };
  const row = recorded(data);
  if (!row) return { ok: false, reason: "We could not record that check." };
  if (row.status === "confirmed" && input.kind === "capital-in") {
    return { ok: true, reason: "Confirmed. This pledge is accepted." };
  }
  if (row.status === "confirmed") return { ok: true, reason: "Confirmed." };
  if (row.status === "pending") return { ok: true, reason: "We see it. It needs more blocks before it counts." };
  return { ok: false, reason: row.reason ?? "This payment does not match." };
}

async function memberWallets(projectId: string, chain: ChainId): Promise<{ userId: string; address: string }[]> {
  const admin = adminSupabase();
  if (!admin) return [];
  const members = await admin.from("project_members").select("worker_id").eq("project_id", projectId);
  const ids = (members.data ?? []).flatMap((row) => (typeof row.worker_id === "string" ? [row.worker_id] : []));
  if (ids.length === 0) return [];
  const wallets = await admin
    .from("wallets")
    .select("user_id, address")
    .eq("chain", chain)
    .not("verified_at", "is", null)
    .in("user_id", ids);
  return (wallets.data ?? []).flatMap((row) => {
    if (typeof row.user_id !== "string" || typeof row.address !== "string") return [];
    return [{ userId: row.user_id, address: row.address }];
  });
}

export async function checkCapital(input: {
  projectId: string;
  txId: string;
  chain: ChainId;
  projectAddress: string;
  commitmentId: string;
}): Promise<{ ok: boolean; reason: string }> {
  const look = await readChain(input.chain, input.txId, [input.projectAddress]);
  if (!look.found) return { ok: false, reason: "We could not find that transaction on the test network." };
  return recordLook({
    projectId: input.projectId,
    kind: "capital-in",
    chain: input.chain,
    txId: input.txId,
    commitmentId: input.commitmentId,
    contributionId: null,
    look,
  });
}

export async function checkPayout(input: {
  projectId: string;
  txId: string;
  chain: ChainId;
}): Promise<{ ok: boolean; reason: string }> {
  const wallets = await memberWallets(input.projectId, input.chain);
  const look = await readChain(input.chain, input.txId, wallets.map((wallet) => wallet.address));
  if (!look.found) return { ok: false, reason: "We could not find that transaction on the test network." };
  const paid = wallets.find((wallet) => wallet.address === look.toAddress);
  let contributionId: string | null = null;
  const admin = adminSupabase();
  if (paid && admin) {
    const contribution = await admin
      .from("contributions")
      .select("id")
      .eq("project_id", input.projectId)
      .eq("user_id", paid.userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    contributionId = typeof contribution.data?.id === "string" ? contribution.data.id : null;
  }
  return recordLook({
    projectId: input.projectId,
    kind: "pay-out",
    chain: input.chain,
    txId: input.txId,
    commitmentId: null,
    contributionId,
    look,
  });
}

export async function recheckPending(projectId: string): Promise<{ ok: boolean; reason: string; checked: number }> {
  const admin = adminSupabase();
  if (!admin) return { ok: false, reason: "Wallet checks run in the live version.", checked: 0 };
  const pending = await admin
    .from("payments")
    .select("kind, chain, tx_id, commitment_id, to_address")
    .eq("project_id", projectId)
    .eq("status", "pending");
  const rows = pending.data ?? [];
  if (pending.error) return { ok: false, reason: "We could not read the pending payments.", checked: 0 };
  let checked = 0;
  for (const row of rows) {
    const chain = row.chain === "bitcoin-signet" || row.chain === "base-sepolia" ? row.chain : null;
    const txId = typeof row.tx_id === "string" ? row.tx_id : "";
    if (!chain || !txId) continue;
    if (row.kind === "capital-in") {
      const wallet = await admin
        .from("project_wallets")
        .select("address")
        .eq("project_id", projectId)
        .eq("chain", chain)
        .maybeSingle();
      const address = typeof wallet.data?.address === "string" ? wallet.data.address : "";
      const commitmentId = typeof row.commitment_id === "string" ? row.commitment_id : "";
      if (!address || !commitmentId) continue;
      await checkCapital({ projectId, txId, chain, projectAddress: address, commitmentId });
      checked += 1;
    } else if (row.kind === "pay-out") {
      await checkPayout({ projectId, txId, chain });
      checked += 1;
    }
  }
  return { ok: true, reason: checked === 0 ? "Nothing is waiting." : "Checked again.", checked };
}
