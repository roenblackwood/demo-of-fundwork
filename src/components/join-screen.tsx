"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageBusy } from "@/components/busy";
import { ActionBar, StepHeader } from "@/components/parts";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useDemo } from "@/lib/demo-store";
import { money, placeLine } from "@/lib/format";
import { leftToPledge } from "@/lib/pledges";
import { currencyOf, requestPlace } from "@/lib/seed";

function readAmount(text: string): number | null {
  const digits = text.replace(/[^\d]/g, "");
  if (!digits) return null;
  const value = Number(digits);
  return Number.isFinite(value) && value >= 1 ? value : null;
}

function formatAmountInput(text: string): string {
  const digits = text.replace(/[^\d]/g, "");
  if (!digits) return "";
  return Number(digits).toLocaleString("en-US");
}

export function JoinScreen({ id }: { id: string }) {
  const demo = useDemo();
  const router = useRouter();
  const request = demo.requests.find((item) => item.id === id);
  const learnHref = `/learn/investor?next=${encodeURIComponent(`/requests/${id}/join`)}`;
  const [text, setText] = useState("");
  const [notice, setNotice] = useState("");
  const [showName, setShowName] = useState(false);

  useEffect(() => {
    if (!demo.ready || demo.role !== "investor" || demo.investorBasicsDone) return;
    router.replace(learnHref);
  }, [demo.ready, demo.role, demo.investorBasicsDone, learnHref, router]);

  if (!demo.ready) return <PageBusy />;
  if (demo.role === "investor" && !demo.investorBasicsDone) return <PageBusy />;
  if (!request) {
    return (
      <div className="space-y-4">
        <StepHeader backHref="/invest" />
        <p className="text-lg">This request is not on this phone.</p>
      </div>
    );
  }

  const where = requestPlace(request);
  const place = where ? placeLine(where.town, where.parish) : "This place";
  const currency = currencyOf(request.countryId);
  const left = leftToPledge(request.budget, demo.pledges, request.id);
  const amount = readAmount(text);
  const tooMuch = amount !== null && amount > left;
  const open = (request.status === "open" || request.status === "team-ready") && !request.projectId && left >= 1;
  const mine = demo.pledges.find(
    (item) => item.requestId === request.id && item.userId === demo.userId && item.status === "pledged",
  );

  async function join() {
    if (!request || !amount || demo.saving || amount > left) return;
    setNotice("");
    const result = await demo.pledgeToRequest({ requestId: request.id, amount, showName });
    if (result === "ok") {
      router.push(`/requests/${request.id}`);
      return;
    }
    if (result === "left" || result === "full") {
      setNotice(`${money(leftToPledge(request.budget, demo.pledges, request.id), currency)} is left.`);
      return;
    }
    if (result === "basics") {
      router.replace(learnHref);
      return;
    }
    if (result === "own") setNotice("You already pledged to this request.");
    else if (result === "closed") setNotice("This request is closed.");
    else setNotice("This page is for investors.");
  }

  return (
    <div className="space-y-6">
      <StepHeader backHref={`/requests/${request.id}`} title="Join this request" hint={place} />
      {demo.role !== "investor" ? (
        <p className="text-lg">This page is for investors.</p>
      ) : mine ? (
        <p className="text-lg">You already pledged to this request.</p>
      ) : !open ? (
        <p className="text-lg">Nothing is left to pledge.</p>
      ) : (
        <>
          <p className="text-lg">
            {money(left, currency)} is left.
          </p>
          <div className="space-y-2">
            <Label htmlFor="pledge-amount">Amount</Label>
            <Input
              id="pledge-amount"
              inputMode="numeric"
              value={text}
              onChange={(event) => {
                setText(formatAmountInput(event.target.value));
                setNotice("");
              }}
            />
            {tooMuch ? <p className="text-lg">{money(left, currency)} is left.</p> : null}
            {notice ? <p className="text-lg">{notice}</p> : null}
          </div>
          <label className="flex min-h-11 items-center gap-3 text-lg">
            <input
              type="checkbox"
              checked={showName}
              onChange={(event) => setShowName(event.target.checked)}
            />
            Show my name on projects I back
          </label>
          <ActionBar>
            <Button
              size="lg"
              className="w-full"
              disabled={!amount || tooMuch || demo.saving}
              aria-busy={demo.saving}
              onClick={() => void join()}
            >
              Join this request
            </Button>
          </ActionBar>
        </>
      )}
      <Link href={`/requests/${request.id}`} className="inline-flex min-h-11 items-center font-semibold text-primary">
        Back to the request
      </Link>
    </div>
  );
}
