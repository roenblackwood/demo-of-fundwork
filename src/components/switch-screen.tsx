"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { StepHeader } from "@/components/parts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDemo } from "@/lib/demo-store";
import { getUsers } from "@/lib/seed";
import { cn } from "cn";

export function SwitchScreen() {
  const router = useRouter();
  const demo = useDemo();
  const [naming, setNaming] = useState(false);
  const [draft, setDraft] = useState(demo.name === "You" ? "" : demo.name);

  if (!demo.ready) return <p className="text-lg">One moment.</p>;

  return (
    <div className="space-y-4">
      <StepHeader backHref="/you" title="Who are you looking at?" />
      <p className="text-lg leading-relaxed">
        You can stay as yourself, or look at an example person with records already on file.
      </p>
      <button
        type="button"
        onClick={() => {
          demo.useNewPerson();
          router.push("/you");
        }}
        className={cn(
          "min-h-14 w-full rounded-2xl border-2 px-4 py-3 text-left",
          demo.userId === "you" ? "border-primary bg-secondary" : "border-border bg-card",
        )}
      >
        <span className="block text-lg font-semibold">You</span>
        <span className="mt-1 block text-base font-normal text-muted-foreground">
          A new person on this phone.
        </span>
      </button>
      {getUsers().map((user) => (
        <button
          key={user.id}
          type="button"
          onClick={() => {
            demo.useSample(user.id);
            router.push("/you");
          }}
          className={cn(
            "min-h-14 w-full rounded-2xl border-2 px-4 py-3 text-left",
            demo.userId === user.id ? "border-primary bg-secondary" : "border-border bg-card",
          )}
        >
          <span className="block text-lg font-semibold">{user.name}</span>
          <span className="mt-1 block text-base font-normal text-muted-foreground">
            {user.verified ? "Verified ID. " : ""}
            {user.example}
          </span>
        </button>
      ))}
      {naming ? (
        <form
          className="space-y-3 rounded-2xl bg-card p-4 ring-1 ring-foreground/10"
          onSubmit={(event) => {
            event.preventDefault();
            demo.useNewPerson();
            if (draft.trim()) demo.setDisplayName(draft);
            router.push("/you");
          }}
        >
          <Label htmlFor="your-name">Your name</Label>
          <Input
            id="your-name"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            autoComplete="name"
          />
          <Button type="submit" size="lg" className="w-full">
            Use this name
          </Button>
        </form>
      ) : (
        <button
          type="button"
          className="min-h-11 font-semibold text-primary"
          onClick={() => setNaming(true)}
        >
          Use your own name
        </button>
      )}
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="w-full"
        onClick={() => {
          demo.reset();
          router.push("/");
        }}
      >
        Start this demo over
      </Button>
    </div>
  );
}
