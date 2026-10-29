import { redirect } from "next/navigation";
import { OnboardingScreen } from "@/components/onboarding-screen";
import { isLive } from "@/lib/mode";

export default function Page() {
  if (!isLive()) redirect("/");
  return <OnboardingScreen />;
}
