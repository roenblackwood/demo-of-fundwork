import { redirect } from "next/navigation";
import { SignInScreen } from "@/components/sign-in-screen";
import { isLive } from "@/lib/mode";

export default function Page() {
  if (!isLive()) redirect("/");
  return <SignInScreen />;
}
