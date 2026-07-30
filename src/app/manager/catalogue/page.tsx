import type {
  Metadata,
} from "next";

import CatalogueManager from "@/components/catalog-management/catalogue-manager";
import {
  storefrontCodeFromSearch,
  type GovernanceSearchParams,
} from "@/lib/governance-portal";
import {
  getAllStorefrontAuthConfigs,
} from "@/lib/storefront-auth";

export const metadata: Metadata = {
  title:
    "Catalogue Manager | SORVYRA STORE",
  description:
    "Storefront-scoped product, pricing and inventory management.",
};

export default async function ManagerCataloguePage({
  searchParams,
}: {
  searchParams:
    Promise<GovernanceSearchParams>;
}) {
  const resolved =
    await searchParams;

  return (
    <CatalogueManager
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
