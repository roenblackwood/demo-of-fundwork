import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { safeNext } from "@/lib/guard-paths";
import { isLive } from "@/lib/mode";
import { serverSupabase } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (!isLive()) return NextResponse.redirect(new URL("/", url.origin));

  const next = safeNext(url.searchParams.get("next"));
  const supabase = await serverSupabase();
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  let failed = true;

  if (code) {
    const exchanged = await supabase.auth.exchangeCodeForSession(code);
    failed = Boolean(exchanged.error);
  } else if (tokenHash && (type === "email" || type === "magiclink")) {
    const verified = await supabase.auth.verifyOtp({
      type: type as EmailOtpType,
      token_hash: tokenHash,
    });
    failed = Boolean(verified.error);
  }

  if (failed) return NextResponse.redirect(new URL("/sign-in?error=link", url.origin));

  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.redirect(new URL("/sign-in?error=link", url.origin));

  const { data: profile } = await supabase.from("profiles").select("id").eq("id", data.user.id).maybeSingle();
  if (!profile) {
    return NextResponse.redirect(new URL(`/get-started?resume=1&next=${encodeURIComponent(next)}`, url.origin));
  }
  return NextResponse.redirect(new URL(next, url.origin));
}
