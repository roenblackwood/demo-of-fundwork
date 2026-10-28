import { CommittedScreen } from "@/components/commit-screen";
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
        {({ id }) => <CommittedScreen id={id} />}
      </Resolved>
    </Pending>
  );
}
