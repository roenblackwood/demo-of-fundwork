"use client";

import { useState } from "react";
import { reportCapital } from "@/app/actions/payments";
import { AddressQr } from "@/components/qr-code";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NEVER_HOLDS_LINE, TEST_NETWORK_LINE, WALLET_CHECK_LATER } from "@/lib/copy";
import { useDemo } from "@/lib/demo-store";
import { refreshLiveStore } from "@/lib/live-store";
import { isLive } from "@/lib/mode";
import { chainTitle, SAMPLE_PAYMENT_LINE, SAMPLE_PROJECT_ADDRESS } from "@/lib/money";
import type { ProjectWallet } from "@/lib/types";

function CoverLine({ pledge, asset }: { pledge: number; asset: string }) {
  const number = pledge.toLocaleString("en-US");
  return (
    <p className="text-lg leading-relaxed">
      Send at least {number} {asset} to this address. A confirmed payment covers this pledge when the chain amount is at least that number.
    </p>
  );
}

export function SendCapital({ projectId, pledge }: { projectId: string; pledge: number }) {
  const demo = useDemo();
  const wallets = demo.projectWallets.filter((item) => item.projectId === projectId);
  if (!isLive()) return <SampleSend pledge={pledge} />;
  if (wallets.length === 0) return null;
  return <LiveSend projectId={projectId} pledge={pledge} wallets={wallets} />;
}

function SampleSend({ pledge }: { pledge: number }) {
  return (
    <section id="send" className="space-y-3">
      <h2 className="text-xl font-semibold">Send it</h2>
      <p className="text-base font-semibold">{SAMPLE_PAYMENT_LINE}</p>
      <p className="text-lg leading-relaxed">{NEVER_HOLDS_LINE}</p>
      <p className="text-lg leading-relaxed">{TEST_NETWORK_LINE}</p>
      <CoverLine pledge={pledge} asset="BTC" />
      <p className="break-all font-semibold">{SAMPLE_PROJECT_ADDRESS}</p>
      <AddressQr value={SAMPLE_PROJECT_ADDRESS} />
      <Input disabled value="" placeholder="Transaction id" aria-label="Transaction id" />
      <Button type="button" disabled className="h-auto min-h-14 w-full whitespace-normal py-3 text-center">
        I sent it. Here is the transaction id.
      </Button>
      <p className="text-base text-muted-foreground">{WALLET_CHECK_LATER}</p>
    </section>
  );
}

function LiveSend({
  projectId,
  pledge,
  wallets,
}: {
  projectId: string;
  pledge: number;
  wallets: ProjectWallet[];
}) {
  const [txId, setTxId] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (busy) return;
    setBusy(true);
    const result = await reportCapital(projectId, txId);
    setNote(result.reason);
    if (result.ok) {
      setTxId("");
      await refreshLiveStore();
    }
    setBusy(false);
  }

  return (
    <section id="send" className="space-y-4">
      <h2 className="text-xl font-semibold">Send it</h2>
      <p className="text-lg leading-relaxed">{NEVER_HOLDS_LINE}</p>
      <p className="text-lg leading-relaxed">{TEST_NETWORK_LINE}</p>
      {wallets.map((wallet) => (
        <div key={wallet.chain} className="space-y-2">
          <p className="font-semibold">{chainTitle(wallet.chain)}</p>
          <CoverLine pledge={pledge} asset={wallet.chain === "bitcoin-signet" ? "BTC" : "USDC"} />
          <p className="break-all font-semibold">{wallet.address}</p>
          <AddressQr value={wallet.address} />
        </div>
      ))}
      <label className="block space-y-2">
        <span className="font-semibold">Transaction id</span>
        <Input
          value={txId}
          onChange={(event) => setTxId(event.target.value)}
          autoComplete="off"
          spellCheck={false}
          placeholder="The transaction id from your wallet"
        />
      </label>
      <Button
        type="button"
        disabled={busy || txId.trim().length < 64}
        aria-busy={busy}
        className="h-auto min-h-14 w-full whitespace-normal py-3 text-center"
        onClick={() => void submit()}
      >
        I sent it. Here is the transaction id.
      </Button>
      {note ? <p className="text-lg">{note}</p> : null}
    </section>
  );
}
