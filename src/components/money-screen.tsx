"use client";

import { useState } from "react";
import Link from "next/link";
import { reportPayout, saveProjectWallet } from "@/app/actions/payments";
import { PageBusy } from "@/components/busy";
import { StepHeader, sectionTitle } from "@/components/parts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  NEVER_HOLDS_LINE,
  SAMPLE_PAYMENT_LINE,
  SIGNING_WARNING,
  SINGLE_WALLET_REFUSED,
  TEST_NETWORK_LINE,
  WALLET_CHECK_LATER,
  moneyNote,
} from "@/lib/copy";
import { useDemo } from "@/lib/demo-store";
import { refreshLiveStore } from "@/lib/live-store";
import { isLive } from "@/lib/mode";
import {
  chainTitle,
  explorerUrl,
  formatChainAmount,
  paymentBalances,
  samplePayments,
} from "@/lib/money";
import { needsMultisig } from "@/lib/rates";
import { currencyOf } from "@/lib/seed";
import type { ChainId, Payment, PaymentStatus, ProjectWallet } from "@/lib/types";

function statusText(status: PaymentStatus, reason: string | null): string {
  if (status === "confirmed") return "Confirmed";
  if (status === "pending") return "Waiting for more blocks";
  return reason ?? "Does not match";
}

function kindText(kind: Payment["kind"]): string {
  return kind === "capital-in" ? "Capital in" : "Pay out";
}

export function MoneyScreen({ id }: { id: string }) {
  const demo = useDemo();
  if (!demo.ready) return <PageBusy />;
  const project = demo.projects.find((item) => item.id === id);
  if (!project) {
    return (
      <div className="space-y-4">
        <StepHeader backHref="/invest" />
        <p className="text-lg">This project is not on this phone.</p>
      </div>
    );
  }

  const live = isLive();
  const rows = live ? demo.payments.filter((item) => item.projectId === project.id) : samplePayments(project.id);
  const organizing = project.organizerId === demo.userId;
  const pending = rows.some((item) => item.status === "pending");
  const large = needsMultisig(project.goalJmd, currencyOf(project.countryId));
  const stored = demo.projectWallets.filter((item) => item.projectId === project.id);

  return (
    <div className="space-y-6">
      <StepHeader backHref={`/projects/${project.id}`} title="The money" hint={project.name} />
      <p className="text-lg leading-relaxed">{SIGNING_WARNING}</p>
      {organizing && large ? <SingleKeyBlock /> : null}
      {stored.map((wallet) => (
        <MultisigLine key={wallet.chain} wallet={wallet} />
      ))}
      <p className="text-lg leading-relaxed">{NEVER_HOLDS_LINE}</p>
      <p className="text-lg leading-relaxed">{TEST_NETWORK_LINE}</p>
      {!live ? <p className="text-lg font-semibold">{SAMPLE_PAYMENT_LINE}</p> : null}
      {!live ? <p className="text-base text-muted-foreground">{moneyNote()}</p> : null}
      {live && !demo.userId ? <p className="text-lg">Sign in to see the payments.</p> : null}

      <section className="space-y-3">
        <h2 className={sectionTitle}>Balance</h2>
        <p className="text-base text-muted-foreground">The balance counts confirmed payments. In minus out, per coin.</p>
        {paymentBalances(rows).length === 0 ? <p className="text-lg">No payments yet.</p> : null}
        {paymentBalances(rows).map((row) => (
          <div key={row.asset} className="space-y-1 rounded-2xl bg-card p-4 ring-1 ring-foreground/10">
            <p className="text-lg font-semibold">{row.asset}</p>
            <p>Capital in {formatChainAmount(row.inbound, row.asset)}</p>
            <p>Pay out {formatChainAmount(row.outbound, row.asset)}</p>
            <p className="font-semibold">Balance {formatChainAmount(row.balance, row.asset)}</p>
          </div>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className={sectionTitle}>Transactions</h2>
        {rows.length === 0 ? <p className="text-lg">No transactions yet.</p> : null}
        {rows.map((row) => {
          const href = explorerUrl(row.chain, row.txId);
          return (
            <article key={row.id} className="space-y-2 rounded-2xl bg-card p-4 ring-1 ring-foreground/10">
              {!live ? <p className="text-base font-semibold">{SAMPLE_PAYMENT_LINE}</p> : null}
              <p className="text-lg font-semibold">
                {kindText(row.kind)} · {formatChainAmount(row.amount, row.asset)}
              </p>
              <p>{chainTitle(row.chain)}</p>
              <p>{statusText(row.status, row.reason)}</p>
              {href ? (
                <a href={href} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center font-semibold text-primary">
                  See it on the explorer
                </a>
              ) : null}
            </article>
          );
        })}
      </section>

      {live && organizing ? <OrganizerTools projectId={project.id} pending={pending} large={large} /> : null}
      {!live ? <DemoTools /> : null}
      <Link href={`/projects/${project.id}`} className="inline-flex min-h-11 items-center font-semibold text-primary">
        Back to the project
      </Link>
    </div>
  );
}

function MultisigLine({ wallet }: { wallet: ProjectWallet }) {
  if (wallet.walletType !== "multisig") return null;
  const threshold = wallet.threshold ?? 0;
  const owners = wallet.ownerCount ?? 0;
  if (threshold < 1 || owners < 1) return null;
  const names = (wallet.keyholderNames ?? []).filter(Boolean);
  return (
    <div className="space-y-1">
      <p className="text-lg">
        Needs {threshold} of {owners} keys to move money.
      </p>
      {names.length > 0 ? <p className="text-lg">Keyholders: {names.join(", ")}.</p> : null}
    </div>
  );
}

function SingleKeyBlock() {
  const [note, setNote] = useState("");

  function refuse() {
    setNote(SINGLE_WALLET_REFUSED);
  }

  return (
    <section className="space-y-3">
      <h2 className={sectionTitle}>Project wallet</h2>
      <p className="text-lg">{SINGLE_WALLET_REFUSED}</p>
      <Button type="button" variant="outline" onClick={refuse}>
        Use one key
      </Button>
      {note ? <p className="text-lg">{note}</p> : null}
    </section>
  );
}

function DemoTools() {
  return (
    <section className="space-y-3">
      <h2 className={sectionTitle}>Checks</h2>
      <Button type="button" disabled>Check again</Button>
      <Input disabled placeholder="Transaction id" aria-label="Transaction id" />
      <Button type="button" disabled>Record a payment</Button>
      <p className="text-base text-muted-foreground">{WALLET_CHECK_LATER}</p>
    </section>
  );
}

function OrganizerTools({
  projectId,
  pending,
  large,
}: {
  projectId: string;
  pending: boolean;
  large: boolean;
}) {
  const demo = useDemo();
  const [txId, setTxId] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [multiChain, setMultiChain] = useState<ChainId>("base-sepolia");
  const [multiAddress, setMultiAddress] = useState("");
  const [descriptor, setDescriptor] = useState("");
  const [holderNames, setHolderNames] = useState("");
  const wallets = demo.wallets.filter((item) => item.verifiedAt);
  const projectWallets = demo.projectWallets.filter((item) => item.projectId === projectId);

  async function setWallet(
    chain: ChainId,
    address: string,
    walletType: "single" | "multisig",
    extra?: { descriptor?: string; keyholderNames?: string[] },
  ) {
    if (busy) return;
    setBusy(true);
    const result = await saveProjectWallet({
      projectId,
      chain,
      address,
      walletType,
      descriptor: extra?.descriptor,
      keyholderNames: extra?.keyholderNames,
    });
    setNote(result.reason);
    if (result.ok) await refreshLiveStore();
    setBusy(false);
  }

  async function record() {
    if (busy) return;
    setBusy(true);
    const result = await reportPayout(projectId, txId);
    setNote(result.reason);
    if (result.ok) {
      setTxId("");
      await refreshLiveStore();
    }
    setBusy(false);
  }

  async function checkAgain() {
    if (busy) return;
    setBusy(true);
    const response = await fetch("/api/payments/check", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ projectId }),
    });
    const body = (await response.json().catch(() => null)) as { reason?: string } | null;
    setNote(body?.reason ?? "The test network did not answer. Try again.");
    await refreshLiveStore();
    setBusy(false);
  }

  return (
    <section className="space-y-4">
      <h2 className={sectionTitle}>Project address</h2>
      <p className="text-lg">You do not accept capital by hand. The chain check does.</p>
      {large ? (
        <div className="space-y-3">
          <p className="text-lg">Paste a wallet that takes more than one key.</p>
          <div className="flex flex-col gap-2">
            {(["base-sepolia", "bitcoin-signet"] as const).map((item) => (
              <button
                key={item}
                type="button"
                aria-pressed={multiChain === item}
                onClick={() => setMultiChain(item)}
                className="min-h-12 rounded-2xl border-2 px-4 text-left text-lg font-semibold"
              >
                {chainTitle(item)}
              </button>
            ))}
          </div>
          <Input
            value={multiAddress}
            onChange={(event) => setMultiAddress(event.target.value)}
            placeholder="Address"
            aria-label="Project address"
            autoComplete="off"
            spellCheck={false}
          />
          {multiChain === "bitcoin-signet" ? (
            <>
              <textarea
                value={descriptor}
                onChange={(event) => setDescriptor(event.target.value)}
                placeholder="Descriptor"
                aria-label="Descriptor"
                className="min-h-28 w-full rounded-xl border bg-card p-3 text-base"
              />
              <Input
                value={holderNames}
                onChange={(event) => setHolderNames(event.target.value)}
                placeholder="First names, separated by commas"
                aria-label="Keyholder first names"
              />
            </>
          ) : (
            <p className="text-base text-muted-foreground">On Base, paste the Safe address. Fundwork reads the owners.</p>
          )}
          <Button
            type="button"
            disabled={busy || multiAddress.trim().length < 14}
            onClick={() =>
              void setWallet(multiChain, multiAddress, "multisig", {
                descriptor,
                keyholderNames: holderNames.split(","),
              })
            }
          >
            Save this wallet
          </Button>
        </div>
      ) : (
        <>
          {wallets.length === 0 ? <p className="text-lg">Check one of your wallets first.</p> : null}
          {wallets.map((wallet) => {
            const used = projectWallets.some((item) => item.chain === wallet.chain && item.address === wallet.address);
            return (
              <div key={wallet.id} className="space-y-2">
                <p className="font-semibold">{chainTitle(wallet.chain)}</p>
                <p className="break-all">{wallet.address}</p>
                {used ? <p>This is the project address.</p> : (
                  <Button type="button" disabled={busy} onClick={() => void setWallet(wallet.chain, wallet.address, "single")}>
                    Use this for the project
                  </Button>
                )}
              </div>
            );
          })}
        </>
      )}
      <h2 className={sectionTitle}>Record a payment</h2>
      <p className="text-lg leading-relaxed">Paste the transaction id of a payment you already sent to someone on the team.</p>
      <Input
        value={txId}
        onChange={(event) => setTxId(event.target.value)}
        autoComplete="off"
        spellCheck={false}
        placeholder="Transaction id"
        aria-label="Transaction id"
      />
      <Button type="button" disabled={busy || txId.trim().length < 64} aria-busy={busy} onClick={() => void record()}>
        Record a payment
      </Button>
      {pending ? (
        <Button type="button" variant="outline" disabled={busy} aria-busy={busy} onClick={() => void checkAgain()}>
          Check again
        </Button>
      ) : null}
      {note ? <p className="text-lg">{note}</p> : null}
    </section>
  );
}
