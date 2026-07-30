import type {
  Metadata,
} from "next";

import PortalLogin from "@/components/governance/portal-login";
import {
  storefrontCodeFromSearch,
  type GovernanceSearchParams,
} from "@/lib/governance-portal";
import {
  getAllStorefrontAuthConfigs,
} from "@/lib/storefront-auth";

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

  return (
    <PortalLogin
      mode="admin"
      storefronts={
        getAllStorefrontAuthConfigs()
      }
      initialStorefrontCode={
        storefrontCodeFromSearch(
          resolved,
        )
      }
      destination="admin"
    />
  );
}
