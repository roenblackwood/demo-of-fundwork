import { Suspense } from "react";
import { PageBusy } from "@/components/busy";

export function Pending({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PageBusy />}>{children}</Suspense>;
}

export async function Resolved<T>({
  params,
  children,
}: {
  params: Promise<T>;
  children: (value: T) => React.ReactNode;
}) {
  const value = await params;
  return children(value);
}
