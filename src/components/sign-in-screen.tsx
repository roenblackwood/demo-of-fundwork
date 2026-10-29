"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ActionBar, StepHeader } from "@/components/parts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { safeNext } from "@/lib/guard-paths";
import { browserSupabase } from "@/lib/supabase/browser";

const LINK_ERROR = "Could not send the link. Check the email and try again.";

export function SignInScreen() {
  const [email, setEmail] = useState("");
  const [next, setNext] = useState("/you");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const dest = safeNext(params.get("next"));
    // The return path is only in the browser URL.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNext(dest);
    if (params.get("error")) setError(LINK_ERROR);
    const supabase = browserSupabase();
    void supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: profile } = await supabase.from("profiles").select("id").eq("id", data.user.id).maybeSingle();
      const href = profile ? dest : `/onboarding?next=${encodeURIComponent(dest)}`;
      router.replace(href);
    });
  }, [router]);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = email.trim();
    if (!trimmed.includes("@") || !trimmed.includes(".")) {
      setError(LINK_ERROR);
      return;
    }
    setSaving(true);
    setError("");
    const { error: sendError } = await browserSupabase().auth.signInWithOtp({
      email: trimmed,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    setSaving(false);
    if (sendError) {
      setError(LINK_ERROR);
      return;
    }
    setSent(true);
  }

  return (
    <form className="space-y-6" onSubmit={send}>
      <StepHeader backHref="/" title="Sign in" hint="We email you a link. No password." />
      {sent ? (
        <p className="text-lg leading-relaxed">Check your email for the link.</p>
      ) : (
        <>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          {error ? <p className="text-lg">{error}</p> : null}
          <ActionBar>
            <Button type="submit" size="lg" className="w-full" disabled={saving} aria-busy={saving}>
              Send me a link
            </Button>
          </ActionBar>
        </>
      )}
    </form>
  );
}
