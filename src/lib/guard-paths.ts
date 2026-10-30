/** Routes that need a signed-in person in live mode. Lists and project pages stay open. */
export function needsSession(pathname: string): boolean {
  if (pathname.startsWith("/you/")) return true;
  if (pathname === "/invest/start" || pathname.startsWith("/invest/start/")) return true;
  if (pathname === "/work/available" || pathname.startsWith("/work/available/")) return true;
  if (/^\/requests\/[^/]+\/apply\/?$/.test(pathname)) return true;
  if (/^\/requests\/[^/]+\/join\/?$/.test(pathname)) return true;
  if (/^\/requests\/[^/]+\/start\/?$/.test(pathname)) return true;
  if (/^\/projects\/[^/]+\/commit\/?$/.test(pathname)) return true;
  if (/^\/projects\/[^/]+\/log\/?$/.test(pathname)) return true;
  return false;
}

export function safeNext(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/sign-in")) {
    return "/you";
  }
  return value;
}
