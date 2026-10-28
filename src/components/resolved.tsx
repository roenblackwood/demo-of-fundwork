import { Suspense } from "react";

export function Pending({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<p className="py-8 text-lg">One moment.</p>}>
      {children}
    </Suspense>
  );
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
