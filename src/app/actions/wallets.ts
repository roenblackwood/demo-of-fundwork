"use server";

import { randomBytes } from "node:crypto";
import { normalizeAddress } from "@/lib/money";
import { verifyWalletSignature } from "@/lib/chain/read";
import { isLive } from "@/lib/mode";
import { adminSupabase } from "@/lib/supabase/admin";
import { serverSupabase } from "@/lib/supabase/server";
import type { ChainId } from "@/lib/types";

const later = "Wallet checks run in the live version.";

async function callerId(): Promise<string | null> {
  if (!isLive()) return null;
  const supabase = await serverSupabase();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user.id;
}

export async function addWallet(input: {
  chain: ChainId;
  address: string;
  label: string;
}): Promise<{ ok: boolean; reason: string; id: string | null }> {
  if (!isLive()) return { ok: false, reason: later, id: null };
  const id = await callerId();
  if (!id) return { ok: false, reason: "Sign in first.", id: null };
  if (input.chain !== "bitcoin-signet" && input.chain !== "base-sepolia") {
    return { ok: false, reason: "Test networks only.", id: null };
  }
  const address = normalizeAddress(input.chain, input.address);
  if (!address) return { ok: false, reason: "That address does not match this test network.", id: null };
  const supabase = await serverSupabase();
  const { data, error } = await supabase
    .from("wallets")
    .insert({
      user_id: id,
      chain: input.chain,
      address,
      label: input.label.trim().slice(0, 40),
    })
    .select("id")
    .single();
  if (error || !data?.id) {
    return { ok: false, reason: "That address is already on Fundwork, or it could not be saved.", id: null };
  }
  return { ok: true, reason: "Saved. Check it next.", id: String(data.id) };
}

export async function startWalletCheck(walletId: string): Promise<{ ok: boolean; reason: string; message: string | null }> {
  if (!isLive()) return { ok: false, reason: later, message: null };
  const userId = await callerId();
  const admin = adminSupabase();
  if (!userId) return { ok: false, reason: "Sign in first.", message: null };
  if (!admin) return { ok: false, reason: "Wallet checks run in the live version.", message: null };
  const supabase = await serverSupabase();
  const wallet = await supabase
    .from("wallets")
    .select("id, chain, verified_at")
    .eq("id", walletId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!wallet.data?.id) return { ok: false, reason: "That wallet is not yours.", message: null };
  if (wallet.data.verified_at) return { ok: true, reason: "Wallet checked", message: null };

  const time = new Date().toISOString();
  const message = `Fundwork wallet check ${randomBytes(16).toString("hex")} for ${userId} at ${time}`;
  const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  await admin
    .from("wallet_checks")
    .update({ used_at: new Date().toISOString() })
    .eq("wallet_id", walletId)
    .is("used_at", null);
  const inserted = await admin.from("wallet_checks").insert({
    user_id: userId,
    wallet_id: walletId,
    message,
    expires_at: expires,
  });
  if (inserted.error) return { ok: false, reason: "We could not start that check.", message: null };
  return { ok: true, reason: "Sign this in your own wallet. It expires in 10 minutes.", message };
}

export async function finishWalletCheck(
  walletId: string,
  signature: string,
): Promise<{ ok: boolean; reason: string }> {
  if (!isLive()) return { ok: false, reason: later };
  const userId = await callerId();
  const admin = adminSupabase();
  if (!userId) return { ok: false, reason: "Sign in first." };
  if (!admin) return { ok: false, reason: "Wallet checks run in the live version." };
  const pasted = signature.trim();
  if (!pasted || pasted.length > 20000) return { ok: false, reason: "Paste the signature from your wallet." };

  const supabase = await serverSupabase();
  const wallet = await supabase
    .from("wallets")
    .select("id, chain, address, verified_at")
    .eq("id", walletId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!wallet.data?.id || (wallet.data.chain !== "bitcoin-signet" && wallet.data.chain !== "base-sepolia")) {
    return { ok: false, reason: "That wallet is not yours." };
  }
  if (wallet.data.verified_at) return { ok: true, reason: "Wallet checked" };

  const challenge = await admin
    .from("wallet_checks")
    .select("id, message, expires_at")
    .eq("wallet_id", walletId)
    .eq("user_id", userId)
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const message = typeof challenge.data?.message === "string" ? challenge.data.message : "";
  if (!challenge.data?.id || !message) return { ok: false, reason: "That check expired. Start a new one." };

  const valid = await verifyWalletSignature(wallet.data.chain, wallet.data.address, message, pasted);
  if (!valid) return { ok: false, reason: "That signature did not match this wallet." };

  const used = await admin
    .from("wallet_checks")
    .update({ used_at: new Date().toISOString() })
    .eq("id", challenge.data.id)
    .is("used_at", null)
    .select("id");
  if ((used.data ?? []).length === 0) return { ok: false, reason: "That check was already used." };

  const marked = await admin.rpc("mark_wallet_checked", {
    p_wallet_id: walletId,
    p_owner_id: userId,
  });
  if (marked.error || !marked.data) return { ok: false, reason: "We could not mark that wallet as checked." };
  return { ok: true, reason: "Wallet checked" };
}
