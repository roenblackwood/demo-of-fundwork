import { Suspense } from "react";
import { PageBusy } from "@/components/busy";
import { InvestorBasics } from "@/components/investor-basics";

export default function Page() {
  return (
    <Suspense fallback={<PageBusy />}>
      <InvestorBasics />
    </Suspense>
  );
}
