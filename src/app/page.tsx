import { Suspense } from "react";
import { HomeScreen } from "@/components/map/home-screen";

export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <HomeScreen />
    </Suspense>
  );
}
