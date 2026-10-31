import dynamic from "next/dynamic";

const WalletScreen = dynamic(() => import("@/components/wallet-screen").then((mod) => mod.WalletScreen));

export default function Page() {
  return <WalletScreen />;
}
