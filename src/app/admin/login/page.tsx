import type {
  Metadata,
} from "next";
import {
  redirect,
} from "next/navigation";

import PortalLogin from "@/components/governance/portal-login";
import {
  type GovernanceSearchParams,
} from "@/lib/governance-portal";

export const metadata: Metadata = {
  title:
    "SORVYRA Owner Sign In",
  description:
    "Secure sign in for SORVYRA platform governance.",
};

export default async function AdminLoginPage({
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
    redirect("/admin/login");
  }

  return (
    <PortalLogin
      mode="admin"
      destination="admin"
    />
  );
}
