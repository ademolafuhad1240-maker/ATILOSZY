import {
  AuthDeliveryProviderError,
} from "./errors";

const STOREFRONT_ROUTE_PATTERN =
  /^\/[a-z0-9-]+(?:\/[a-z0-9-]+)*$/;

export function normalizeAppOrigin(
  rawOrigin: string,
): string {
  let origin: URL;

  try {
    origin = new URL(rawOrigin);
  } catch {
    throw new AuthDeliveryProviderError(
      "configuration",
      "CONFIGURATION",
    );
  }

  if (
    !["http:", "https:"].includes(
      origin.protocol,
    ) ||
    origin.username !== "" ||
    origin.password !== "" ||
    origin.pathname !== "/" ||
    origin.search !== "" ||
    origin.hash !== ""
  ) {
    throw new AuthDeliveryProviderError(
      "configuration",
      "CONFIGURATION",
    );
  }

  return origin.origin;
}

export function buildStorefrontAuthUrl(
  input: {
    appOrigin: string;
    storefrontRoute: string;
    page:
      | "reset-password"
      | "verify";
    parameter:
      | "challengeId"
      | "token";
    value: string;
  },
): string {
  if (
    !STOREFRONT_ROUTE_PATTERN.test(
      input.storefrontRoute,
    )
  ) {
    throw new AuthDeliveryProviderError(
      "configuration",
      "CONFIGURATION",
    );
  }

  const url = new URL(
    `${input.storefrontRoute}/account/${input.page}`,
    normalizeAppOrigin(
      input.appOrigin,
    ),
  );

  url.searchParams.set(
    input.parameter,
    input.value,
  );

  return url.toString();
}
