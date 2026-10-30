import { AcceptScreen } from "@/components/accept-screen";
import { Pending, Resolved } from "@/components/resolved";
import { projectParams } from "@/lib/params";

export function generateStaticParams() {
  return projectParams();
}

export default function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Pending>
      <Resolved params={params}>
        {({ id }) => <AcceptScreen id={id} />}
      </Resolved>
    </Pending>
  );
}
