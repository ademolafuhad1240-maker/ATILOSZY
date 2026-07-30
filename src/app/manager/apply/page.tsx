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
    "Manager Application | SORVYRA STORE",
  description:
    "Apply for storefront-scoped SORVYRA manager access.",
};

export default async function ManagerApplicationPage({
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
      applicationMode
    />
  );
}
