import "server-only";

import type {
  CatalogMediaCapabilities,
} from "../types";
import {
  CatalogServiceError,
} from "../errors";
import {
  CATALOG_IMAGE_MIME_TYPES,
  MAX_CATALOG_IMAGES,
  MAX_CATALOG_IMAGE_INPUT_BYTES,
} from "./image";
import {
  createCloudinaryCatalogMediaProvider,
} from "./cloudinary";
import {
  disabledCatalogMediaProvider,
} from "./disabled";
import type {
  CatalogMediaEnvironment,
  CatalogMediaFetch,
  CatalogMediaProvider,
  CatalogMediaProviderName,
} from "./types";

function configuredProviderName(
  environment:
    CatalogMediaEnvironment,
): CatalogMediaProviderName {
  const value =
    environment
      .CATALOG_MEDIA_PROVIDER
      ?.trim()
      .toLowerCase() ??
    "disabled";

  if (
    value === "disabled" ||
    value === "cloudinary"
  ) {
    return value;
  }

  throw new CatalogServiceError(
    "MEDIA_UNAVAILABLE",
    "Product photo storage is not configured correctly.",
  );
}

function configuredTimeout(
  environment:
    CatalogMediaEnvironment,
): number | undefined {
  const raw =
    environment
      .CATALOG_MEDIA_UPLOAD_TIMEOUT_MS;

  if (
    raw === undefined ||
    raw.trim() === ""
  ) {
    return undefined;
  }

  const value =
    Number.parseInt(
      raw,
      10,
    );

  if (
    !/^\d+$/u.test(raw) ||
    !Number.isSafeInteger(
      value,
    )
  ) {
    throw new CatalogServiceError(
      "MEDIA_UNAVAILABLE",
      "Product photo storage is not configured correctly.",
    );
  }

  return value;
}

export function resolveCatalogMediaProvider(
  environment:
    CatalogMediaEnvironment =
      process.env,
  fetchImplementation:
    CatalogMediaFetch = fetch,
): CatalogMediaProvider {
  const provider =
    configuredProviderName(
      environment,
    );

  if (provider === "disabled") {
    return disabledCatalogMediaProvider;
  }

  const cloudName =
    environment
      .CLOUDINARY_CLOUD_NAME ??
    "";
  const apiKey =
    environment
      .CLOUDINARY_API_KEY ?? "";
  const apiSecret =
    environment
      .CLOUDINARY_API_SECRET ??
    "";

  return createCloudinaryCatalogMediaProvider(
    {
      cloudName,
      apiKey,
      apiSecret,
      timeoutMs:
        configuredTimeout(
          environment,
        ),
    },
    fetchImplementation,
  );
}

export function getCatalogMediaCapabilities(
  environment:
    CatalogMediaEnvironment =
      process.env,
): CatalogMediaCapabilities {
  let provider:
    CatalogMediaProviderName =
      "disabled";
  let uploadEnabled = false;

  try {
    const resolved =
      resolveCatalogMediaProvider(
        environment,
      );
    provider = resolved.name;
    uploadEnabled =
      resolved.name !==
      "disabled";
  } catch {
    const configured =
      environment
        .CATALOG_MEDIA_PROVIDER
        ?.trim()
        .toLowerCase();
    provider =
      configured ===
      "cloudinary"
        ? "cloudinary"
        : "disabled";
  }

  return {
    provider,
    uploadEnabled,
    maxImages:
      MAX_CATALOG_IMAGES,
    maxInputBytes:
      MAX_CATALOG_IMAGE_INPUT_BYTES,
    acceptedMimeTypes: [
      ...CATALOG_IMAGE_MIME_TYPES,
    ],
  };
}
