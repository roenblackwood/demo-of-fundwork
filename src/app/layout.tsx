import type { Metadata, Viewport } from "next";
import { Fraunces, Nunito } from "next/font/google";
import { DemoProvider } from "@/lib/demo-store";
import { Shell } from "@/components/shell";
import "./globals.css";

const nunito = Nunito({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "600", "700", "800"],
  variable: "--font-nunito",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin", "latin-ext"],
  weight: ["500", "600", "700"],
  variable: "--font-fraunces",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Fundwork",
  description:
    "Fund a project with Bitcoin capital, or join the work and get paid in a stable unit. Jamaica is the deep demo.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f4f1e8",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${nunito.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <DemoProvider>
          <Shell>{children}</Shell>
        </DemoProvider>
      </body>
    </html>
  );
}
