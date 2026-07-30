import type {
  Metadata,
} from "next";

import AdminPortal from "@/components/governance/admin-portal";
import {
  storefrontCodeFromSearch,
  type GovernanceSearchParams,
} from "@/lib/governance-portal";
import {
  getAllStorefrontAuthConfigs,
} from "@/lib/storefront-auth";

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

  return (
    <AdminPortal
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
