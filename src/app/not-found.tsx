import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "cn";

export default function NotFound() {
  return (
    <div>
      <h1 className="font-display text-3xl leading-tight">
        We could not find that page.
      </h1>
      <p className="mt-3 text-lg">Start again from the map.</p>
      <Link href="/" className={cn(buttonVariants({ size: "lg" }), "mt-6 w-full")}>
        Go to the start
      </Link>
    </div>
  );
}
