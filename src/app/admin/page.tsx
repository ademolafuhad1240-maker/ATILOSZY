import type {
  Metadata,
} from "next";
import {
  redirect,
} from "next/navigation";

import AdminPortal from "@/components/governance/admin-portal";
import {
  type GovernanceSearchParams,
} from "@/lib/governance-portal";

export const metadata: Metadata = {
  title:
    "SORVYRA Owner Portal",
  description:
    "Protected manager approval and storefront governance.",
};

export default async function AdminPage({
  searchParams,
}: {
  searchParams:
    Promise<GovernanceSearchParams>;
}) {
  const resolved =
    await searchParams;

  if (
    resolved.storefrontCode !==
    undefined
  ) {
    redirect("/admin");
  }

  return <AdminPortal />;
}
