import type {
  Metadata,
} from "next";

import PortalLogin from "@/components/governance/portal-login";
import {
  loginDestinationFromSearch,
  storefrontCodeFromSearch,
  type GovernanceSearchParams,
} from "@/lib/governance-portal";
import {
  getAllStorefrontAuthConfigs,
} from "@/lib/storefront-auth";

export const metadata: Metadata = {
  title:
    "Manager Sign In | SORVYRA STORE",
  description:
    "Secure sign in for approved storefront managers.",
};

export default async function ManagerLoginPage({
  searchParams,
}: {
  searchParams:
    Promise<GovernanceSearchParams>;
}) {
  const resolved =
    await searchParams;

  return (
    <PortalLogin
      mode="manager"
      storefronts={
        getAllStorefrontAuthConfigs()
      }
      initialStorefrontCode={
        storefrontCodeFromSearch(
          resolved,
        )
      }
      destination={
        loginDestinationFromSearch(
          resolved,
        )
      }
    />
  );
}
