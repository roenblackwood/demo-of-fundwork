"use client";

import { useState } from "react";
import { addWallet, finishWalletCheck, startWalletCheck } from "@/app/actions/wallets";
import { PageBusy } from "@/components/busy";
import { StepHeader, sectionTitle } from "@/components/parts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NEVER_HOLDS_LINE, SIGNING_WARNING, TEST_NETWORK_LINE, WALLET_CHECK_LATER } from "@/lib/copy";
import { useDemo } from "@/lib/demo-store";
import { refreshLiveStore } from "@/lib/live-store";
import { isLive } from "@/lib/mode";
import { chainTitle } from "@/lib/money";
import type { ChainId } from "@/lib/types";

export function WalletScreen() {
  const demo = useDemo();
  if (!demo.ready) return <PageBusy />;
  return (
    <div className="space-y-6">
      <StepHeader backHref="/you" title="Your wallet" />
      <p className="text-lg leading-relaxed">{SIGNING_WARNING}</p>
      <p className="text-lg leading-relaxed">{NEVER_HOLDS_LINE}</p>
      <p className="text-lg leading-relaxed">{TEST_NETWORK_LINE}</p>
      <p className="text-lg leading-relaxed">Sign the check message in your own wallet. Fundwork does not sign it.</p>
      {isLive() ? <LiveWallets /> : <DemoWallets />}
    </div>
  );
}

function DemoWallets() {
  return (
    <section className="space-y-3">
      <h2 className={sectionTitle}>Add a wallet</h2>
      <Input disabled placeholder="Address" aria-label="Address" />
      <Button type="button" disabled>Save this address</Button>
      <Button type="button" disabled>Check this wallet</Button>
      <p className="text-base text-muted-foreground">{WALLET_CHECK_LATER}</p>
    </section>
  );
}

function LiveWallets() {
  const demo = useDemo();
  const [chain, setChain] = useState<ChainId>("bitcoin-signet");
  const [address, setAddress] = useState("");
  const [label, setLabel] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [challenge, setChallenge] = useState<{ walletId: string; message: string } | null>(null);
  const [signature, setSignature] = useState("");

  async function save() {
    if (busy) return;
    setBusy(true);
    const result = await addWallet({ chain, address, label });
    setNote(result.reason);
    if (result.ok) {
      setAddress("");
      setLabel("");
      await refreshLiveStore();
    }
    setBusy(false);
  }

  async function begin(walletId: string) {
    if (busy) return;
    setBusy(true);
    const result = await startWalletCheck(walletId);
    setNote(result.reason);
    if (result.message) setChallenge({ walletId, message: result.message });
    setBusy(false);
  }

  async function finish(walletId: string) {
    if (busy) return;
    setBusy(true);
    const result = await finishWalletCheck(walletId, signature);
    setNote(result.reason);
    if (result.ok) {
      setSignature("");
      setChallenge(null);
      await refreshLiveStore();
    }
    setBusy(false);
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h2 className={sectionTitle}>Your addresses</h2>
        {demo.wallets.length === 0 ? <p className="text-lg">No wallet yet.</p> : null}
        {demo.wallets.map((wallet) => (
          <article key={wallet.id} className="space-y-2 rounded-2xl bg-card p-4 ring-1 ring-foreground/10">
            <p className="font-semibold">{chainTitle(wallet.chain)}</p>
            <p className="break-all">{wallet.address}</p>
            {wallet.verifiedAt ? (
              <p className="font-semibold">Wallet checked</p>
            ) : (
              <Button type="button" variant="outline" disabled={busy} onClick={() => void begin(wallet.id)}>
                Get a check message
              </Button>
            )}
            {challenge?.walletId === wallet.id ? (
              <div className="space-y-2">
                <p>Sign this in your own wallet. It expires in 10 minutes.</p>
                <textarea
                  readOnly
                  value={challenge.message}
                  className="min-h-28 w-full rounded-xl border bg-card p-3 text-base"
                />
                <Input
                  value={signature}
                  onChange={(event) => setSignature(event.target.value)}
                  placeholder="Paste the signature"
                  aria-label="Signature"
                  autoComplete="off"
                  spellCheck={false}
                />
                <Button type="button" disabled={busy || signature.trim().length < 8} onClick={() => void finish(wallet.id)}>
                  Check this wallet
                </Button>
              </div>
            ) : null}
          </article>
        ))}
      </section>
      <section className="space-y-3">
        <h2 className={sectionTitle}>Add a wallet</h2>
        <div className="flex flex-col gap-2">
          {(["bitcoin-signet", "base-sepolia"] as const).map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={chain === item}
              onClick={() => setChain(item)}
              className="min-h-12 rounded-2xl border-2 px-4 text-left text-lg font-semibold"
            >
              {chainTitle(item)}
            </button>
          ))}
        </div>
        <Input
          value={address}
          onChange={(event) => setAddress(event.target.value)}
          placeholder="Address"
          aria-label="Address"
          autoComplete="off"
          spellCheck={false}
        />
        <Input
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          placeholder="Label, optional"
          aria-label="Label"
          maxLength={40}
        />
        <Button type="button" disabled={busy || address.trim().length < 14} onClick={() => void save()}>
          Save this address
        </Button>
      </section>
      {note ? <p className="text-lg">{note}</p> : null}
    </div>
  );
}
