"use server";

import { checkCapital, checkPayout } from "@/lib/chain/record";
import { chainOfTx, normalizeTxId } from "@/lib/money";
import { isLive } from "@/lib/mode";
import { serverSupabase } from "@/lib/supabase/server";

const later = "Wallet checks run in the live version.";

async function callerId(): Promise<string | null> {
  if (!isLive()) return null;
  const supabase = await serverSupabase();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user.id;
}

export async function reportCapital(projectId: string, txId: string): Promise<{ ok: boolean; reason: string }> {
  if (!isLive()) return { ok: false, reason: later };
  const userId = await callerId();
  if (!userId) return { ok: false, reason: "Sign in first." };
  const chain = chainOfTx(txId);
  const id = normalizeTxId(txId);
  if (!chain || !id) return { ok: false, reason: "That does not look like a test network transaction id." };

  const supabase = await serverSupabase();
  const wallet = await supabase
    .from("project_wallets")
    .select("address")
    .eq("project_id", projectId)
    .eq("chain", chain)
    .maybeSingle();
  const address = typeof wallet.data?.address === "string" ? wallet.data.address : "";
  if (!address) return { ok: false, reason: "This project has no wallet on that test network." };

  const commitment = await supabase
    .from("commitments")
    .select("id")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .eq("status", "pledged")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const commitmentId = typeof commitment.data?.id === "string" ? commitment.data.id : "";
  if (!commitmentId) return { ok: false, reason: "You do not have a pledge waiting on this project." };

  try {
    return await checkCapital({ projectId, txId: id, chain, projectAddress: address, commitmentId });
  } catch {
    return { ok: false, reason: "The test network did not answer. Try again." };
  }
}

export async function reportPayout(projectId: string, txId: string): Promise<{ ok: boolean; reason: string }> {
  if (!isLive()) return { ok: false, reason: later };
  const userId = await callerId();
  if (!userId) return { ok: false, reason: "Sign in first." };
  const chain = chainOfTx(txId);
  const id = normalizeTxId(txId);
  if (!chain || !id) return { ok: false, reason: "That does not look like a test network transaction id." };

  const supabase = await serverSupabase();
  const project = await supabase.from("projects").select("organizer_id").eq("id", projectId).maybeSingle();
  if (project.data?.organizer_id !== userId) return { ok: false, reason: "Only the organizer can record a payment." };

  try {
    return await checkPayout({ projectId, txId: id, chain });
  } catch {
    return { ok: false, reason: "The test network did not answer. Try again." };
  }
}

export async function saveProjectWallet(projectId: string, chain: "bitcoin-signet" | "base-sepolia", address: string): Promise<{ ok: boolean; reason: string }> {
  if (!isLive()) return { ok: false, reason: later };
  const userId = await callerId();
  if (!userId) return { ok: false, reason: "Sign in first." };
  const supabase = await serverSupabase();
  const { error } = await supabase.rpc("set_project_wallet", {
    p_project_id: projectId,
    p_chain: chain,
    p_address: address,
  });
  if (error) return { ok: false, reason: "Use one of your checked wallets. Only the organizer can set this." };
  return { ok: true, reason: "This is the project address." };
}
