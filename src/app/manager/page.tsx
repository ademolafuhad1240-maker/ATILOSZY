import type {
  Metadata,
} from "next";

import ManagerPortal from "@/components/governance/manager-portal";
import {
  storefrontCodeFromSearch,
  type GovernanceSearchParams,
} from "@/lib/governance-portal";
import {
  getAllStorefrontAuthConfigs,
} from "@/lib/storefront-auth";

export const metadata: Metadata = {
  title:
    "Store Manager Portal | SORVYRA STORE",
  description:
    "Protected multi-brand storefront manager operations.",
};

export default async function ManagerPage({
  searchParams,
}: {
  searchParams:
    Promise<GovernanceSearchParams>;
}) {
  const resolved =
    await searchParams;

  return (
    <ManagerPortal
      storefronts={
        getAllStorefrontAuthConfigs()
      }
      initialStorefrontCode={
        storefrontCodeFromSearch(
          resolved,
        )
      }
    />
  );
}
