import { redirect } from "next/navigation";
import { SwitchScreen } from "@/components/switch-screen";
import { isLive } from "@/lib/mode";

export default function Page() {
  if (isLive()) redirect("/you");
  return <SwitchScreen />;
}
