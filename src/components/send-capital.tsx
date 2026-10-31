"use client";

import { useState } from "react";
import { reportCapital } from "@/app/actions/payments";
import { AddressQr } from "@/components/qr-code";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { openSlice, phasesFor } from "@/lib/capital";
import { NEVER_HOLDS_LINE, TEST_NETWORK_LINE, WALLET_CHECK_LATER } from "@/lib/copy";
import { useDemo } from "@/lib/demo-store";
import { refreshLiveStore } from "@/lib/live-store";
import { investStanding } from "@/lib/residence";
import { isLive } from "@/lib/mode";
import { chainTitle, SAMPLE_PAYMENT_LINE, SAMPLE_PROJECT_ADDRESS } from "@/lib/money";
import type { ProjectWallet } from "@/lib/types";

function CoverLine({ phase, amount, asset }: { phase: string; amount: number; asset: string }) {
  const number = amount.toLocaleString("en-US");
  return (
    <p className="text-lg leading-relaxed">
      This phase is {phase}. Send at least {number} {asset}. A larger payment stays on this phase.
    </p>
  );
}

export function SendCapital({ projectId, pledge }: { projectId: string; pledge: number }) {
  const demo = useDemo();
  const project = demo.projects.find((item) => item.id === projectId);
  const commitment =
    demo.commitments.find((item) => item.projectId === projectId && item.userId === demo.userId && item.amountJmd === pledge) ??
    demo.addedCommitments.find((item) => item.projectId === projectId && item.userId === demo.userId && item.status === "pledged");
  const phases = project ? phasesFor(project) : ["Start"];
  const slice = openSlice({
    amount: pledge,
    phases,
    openPhase: project?.openPhase,
    shares: project?.phaseShares,
    tranches: commitment?.tranches,
  });
  const note = project?.phaseNote ?? "";
  const wallets = demo.projectWallets.filter((item) => item.projectId === projectId);
  if (investStanding(demo.profile.residence) === "interest") {
    return <InterestSend projectId={projectId} amount={pledge} />;
  }
  if (!isLive()) return <SampleSend phase={slice.phase} amount={slice.amount} note={note} />;
  if (wallets.length === 0) return null;
  return <LiveSend projectId={projectId} phase={slice.phase} amount={slice.amount} note={note} wallets={wallets} />;
}

function InterestSend({ projectId, amount }: { projectId: string; amount: number }) {
  const demo = useDemo();
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  async function register() {
    if (busy || saved) return;
    setBusy(true);
    const ok = await demo.registerInterest({
      projectId,
      requestId: null,
      amount: amount >= 1 ? amount : null,
      kind: "send",
    });
    setBusy(false);
    if (ok) setSaved(true);
  }

  return (
    <section id="send" className="space-y-3">
      <h2 className="text-xl font-semibold">Register interest</h2>
      <p className="text-lg leading-relaxed">This is not a commitment. No money moves.</p>
      {saved ? (
        <p className="text-lg">Your interest is saved.</p>
      ) : (
        <Button type="button" size="lg" className="w-full" disabled={busy} aria-busy={busy} onClick={() => void register()}>
          Register interest
        </Button>
      )}
    </section>
  );
}

function SampleSend({ phase, amount, note }: { phase: string; amount: number; note: string }) {
  return (
    <section id="send" className="space-y-3">
      <h2 className="text-xl font-semibold">Send it</h2>
      <p className="text-base font-semibold">{SAMPLE_PAYMENT_LINE}</p>
      <p className="text-lg leading-relaxed">{NEVER_HOLDS_LINE}</p>
      <p className="text-lg leading-relaxed">{TEST_NETWORK_LINE}</p>
      {note ? <p className="text-lg">What changed: {note}</p> : null}
      <CoverLine phase={phase} amount={amount} asset="BTC" />
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
  phase,
  amount,
  note,
  wallets,
}: {
  projectId: string;
  phase: string;
  amount: number;
  note: string;
  wallets: ProjectWallet[];
}) {
  const [txId, setTxId] = useState("");
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (busy) return;
    setBusy(true);
    const reported = await reportCapital(projectId, txId);
    setResult(reported.reason);
    if (reported.ok) {
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
      {note ? <p className="text-lg">What changed: {note}</p> : null}
      {wallets.map((wallet) => (
        <div key={wallet.chain} className="space-y-2">
          <p className="font-semibold">{chainTitle(wallet.chain)}</p>
          <CoverLine phase={phase} amount={amount} asset={wallet.chain === "bitcoin-signet" ? "BTC" : "USDC"} />
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
      {result ? <p className="text-lg">{result}</p> : null}
    </section>
  );
}
