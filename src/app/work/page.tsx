import { Suspense } from "react";
import { PageBusy } from "@/components/busy";
import { FeedScreen } from "@/components/feed-screen";

export default function Page() {
  return (
    <Suspense fallback={<PageBusy />}>
      <FeedScreen mode="worker" />
    </Suspense>
  );
}
