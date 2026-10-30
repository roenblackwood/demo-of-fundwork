"use server";

import { readSafe } from "@/lib/chain/base";
import { bitcoinMultisigAddress } from "@/lib/chain/descriptor";
import { checkCapital, checkPayout } from "@/lib/chain/record";
import { SINGLE_WALLET_REFUSED } from "@/lib/copy";
import { chainOfTx, normalizeAddress, normalizeTxId } from "@/lib/money";
import { isLive } from "@/lib/mode";
import { usdAmount } from "@/lib/rates";
import { currencyOf } from "@/lib/seed";
import { adminSupabase } from "@/lib/supabase/admin";
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

function firstWord(name: string): string {
  return name.trim().split(/\s+/)[0] ?? "";
}

export async function saveProjectWallet(input: {
  projectId: string;
  chain: "bitcoin-signet" | "base-sepolia";
  address: string;
  walletType: "single" | "multisig";
  descriptor?: string;
  keyholderNames?: string[];
}): Promise<{ ok: boolean; reason: string }> {
  if (!isLive()) return { ok: false, reason: later };
  const userId = await callerId();
  if (!userId) return { ok: false, reason: "Sign in first." };
  const admin = adminSupabase();
  if (!admin) return { ok: false, reason: later };
  const address = normalizeAddress(input.chain, input.address);
  if (!address) return { ok: false, reason: "That address does not match this test network." };

  const supabase = await serverSupabase();
  const project = await supabase
    .from("projects")
    .select("organizer_id, goal, country_id, mentor_name")
    .eq("id", input.projectId)
    .maybeSingle();
  if (project.data?.organizer_id !== userId) {
    return { ok: false, reason: "Only the organizer can set the project wallet." };
  }
  const goal = Number(project.data?.goal);
  const countryId = typeof project.data?.country_id === "string" ? project.data.country_id : "";
  const usd = usdAmount(goal, currencyOf(countryId));
  if (usd !== null) {
    const priced = await admin.rpc("set_goal_usd", { p_project_id: input.projectId, p_goal_usd: usd });
    if (priced.error) return { ok: false, reason: "We could not price this project." };
  }
  if (input.walletType === "single" && usd !== null && usd > 5000) {
    return { ok: false, reason: SINGLE_WALLET_REFUSED };
  }

  let threshold = 1;
  let ownerCount = 1;
  let names: string[] = [];
  let descriptor: string | null = null;
  let ownerAddresses: string[] = [];

  if (input.walletType === "multisig" && input.chain === "base-sepolia") {
    const safe = await readSafe(address);
    if (!safe) return { ok: false, reason: "That address is not a Safe on this test network." };
    if (safe.threshold < 2) return { ok: false, reason: "This wallet needs at least 2 keys." };
    const wallets = await admin
      .from("wallets")
      .select("user_id, address")
      .eq("chain", "base-sepolia")
      .not("verified_at", "is", null);
    const known = (wallets.data ?? []).flatMap((row) => {
      if (typeof row.user_id !== "string" || typeof row.address !== "string") return [];
      return [{ userId: row.user_id, address: row.address.toLowerCase() }];
    });
    const ids = [...new Set(known.map((row) => row.userId))];
    const profiles = ids.length
      ? await admin.from("profiles").select("id, name").in("id", ids)
      : { data: [] };
    const commitments = await admin.from("commitments").select("user_id").eq("project_id", input.projectId);
    const leadIds = new Set(
      (commitments.data ?? []).flatMap((row) => (typeof row.user_id === "string" ? [row.user_id] : [])),
    );
    const mentor = typeof project.data?.mentor_name === "string" ? project.data.mentor_name.trim().toLowerCase() : "";
    let outside = false;
    for (const owner of safe.owners) {
      const wallet = known.find((row) => row.address === owner);
      const profile = (profiles.data ?? []).find((row) => row.id === wallet?.userId);
      const full = typeof profile?.name === "string" ? profile.name.trim() : "";
      const first = firstWord(full);
      if (first) names.push(first);
      if (!wallet || wallet.userId === userId) continue;
      const isMentor = Boolean(mentor) && full.toLowerCase() === mentor;
      if (isMentor || leadIds.has(wallet.userId)) outside = true;
    }
    if (!outside) {
      return { ok: false, reason: "Add a mentor or a lead investor who is not the organizer." };
    }
    if (names.length === 0) return { ok: false, reason: "Name the keyholders." };
    threshold = safe.threshold;
    ownerCount = safe.owners.length;
    ownerAddresses = safe.owners;
  } else if (input.walletType === "multisig") {
    const parsed = bitcoinMultisigAddress(input.descriptor ?? "");
    if (!parsed.ok) return { ok: false, reason: parsed.reason };
    if (parsed.address !== address) {
      return { ok: false, reason: "That address does not match this descriptor." };
    }
    names = (input.keyholderNames ?? []).map(firstWord).filter((name) => name.length > 0 && name.length <= 40);
    if (names.length !== parsed.owners) return { ok: false, reason: "Name each keyholder." };
    threshold = parsed.threshold;
    ownerCount = parsed.owners;
    descriptor = (input.descriptor ?? "").trim();
  }

  const { error } = await supabase.rpc("set_project_wallet", {
    p_project_id: input.projectId,
    p_chain: input.chain,
    p_address: address,
    p_wallet_type: input.walletType,
    p_threshold: threshold,
    p_owner_count: ownerCount,
    p_keyholder_names: names,
    p_descriptor: descriptor,
    p_owner_addresses: ownerAddresses,
  });
  if (error) {
    const message = error.message ?? "";
    if (message.includes("US$5,000")) return { ok: false, reason: SINGLE_WALLET_REFUSED };
    if (message.includes("mentor") || message.includes("lead investor")) {
      return { ok: false, reason: "Add a mentor or a lead investor who is not the organizer." };
    }
    if (message.includes("2-of-3")) return { ok: false, reason: "Use a 2-of-3 wallet, or one that asks for more keys." };
    if (input.walletType === "single") {
      return { ok: false, reason: "Use one of your checked wallets. Only the organizer can set this." };
    }
    return { ok: false, reason: "That wallet could not be saved." };
  }
  return { ok: true, reason: "This is the project address." };
}
