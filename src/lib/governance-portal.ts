import {
  getAllStorefrontAuthConfigs,
  type StorefrontAuthCode,
} from "./storefront-auth";

export type GovernanceSearchParams =
  Record<
    string,
    | string
    | string[]
    | undefined
  >;

function firstValue(
  value:
    | string
    | string[]
    | undefined,
): string | undefined {
  return Array.isArray(value)
    ? value[0]
    : value;
}

export function storefrontCodeFromSearch(
  searchParams:
    GovernanceSearchParams,
): StorefrontAuthCode {
  const requested =
    firstValue(
      searchParams.storefrontCode,
    )
      ?.trim()
      .toUpperCase();
  const matched =
    getAllStorefrontAuthConfigs()
      .find(
        (storefront) =>
          storefront.code ===
          requested,
      );

  return matched?.code ?? "ATI";
}

export function loginDestinationFromSearch(
  searchParams:
    GovernanceSearchParams,
):
  | "portal"
  | "apply"
  | "admin" {
  const destination =
    firstValue(
      searchParams.destination,
    )
      ?.trim()
      .toLowerCase();

  if (
    destination === "apply" ||
    destination === "admin"
  ) {
    return destination;
  }

  return "portal";
}
