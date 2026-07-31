import "server-only";

import {
  randomUUID,
} from "node:crypto";

import {
  CatalogServiceError,
} from "../errors";
import type {
  CatalogMediaFetch,
  CatalogMediaProvider,
  StoredCatalogMediaAsset,
} from "./types";

const DEFAULT_TIMEOUT_MS =
  15_000;
const MIN_TIMEOUT_MS = 1_000;
const MAX_TIMEOUT_MS = 60_000;
const MAX_RESPONSE_BYTES =
  64 * 1024;

interface CloudinaryConfiguration {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  timeoutMs?: number;
}

function safeTimeout(
  value: number | undefined,
): number {
  if (value === undefined) {
    return DEFAULT_TIMEOUT_MS;
  }

  if (
    !Number.isSafeInteger(value) ||
    value < MIN_TIMEOUT_MS ||
    value > MAX_TIMEOUT_MS
  ) {
    throw new CatalogServiceError(
      "MEDIA_UNAVAILABLE",
      "Product photo storage is not configured correctly.",
    );
  }

  return value;
}

function requiredConfigurationValue(
  value: string,
): string {
  const normalized =
    value.trim();

  if (!normalized) {
    throw new CatalogServiceError(
      "MEDIA_UNAVAILABLE",
      "Product photo storage is not configured correctly.",
    );
  }

  return normalized;
}

function parseCloudinaryResponse(
  value: unknown,
  expectedPublicId: string,
): StoredCatalogMediaAsset {
  if (
    typeof value !== "object" ||
    value === null
  ) {
    throw new CatalogServiceError(
      "MEDIA_REJECTED",
      "Product photo storage returned an invalid response.",
    );
  }

  const response =
    value as Record<
      string,
      unknown
    >;
  const url = response.secure_url;
  const publicId =
    response.public_id;
  const format = response.format;
  const resourceType =
    response.resource_type;
  const byteSize = response.bytes;
  const width = response.width;
  const height = response.height;

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(
      typeof url === "string"
        ? url
        : "",
    );
  } catch {
    throw new CatalogServiceError(
      "MEDIA_REJECTED",
      "Product photo storage returned an invalid response.",
    );
  }

  if (
    parsedUrl.protocol !==
      "https:" ||
    parsedUrl.username !== "" ||
    parsedUrl.password !== "" ||
    parsedUrl.hostname !==
      "res.cloudinary.com" ||
    publicId !==
      expectedPublicId ||
    format !== "webp" ||
    resourceType !== "image" ||
    typeof byteSize !==
      "number" ||
    !Number.isSafeInteger(
      byteSize,
    ) ||
    byteSize < 1 ||
    typeof width !== "number" ||
    !Number.isSafeInteger(width) ||
    width < 1 ||
    typeof height !==
      "number" ||
    !Number.isSafeInteger(
      height,
    ) ||
    height < 1
  ) {
    throw new CatalogServiceError(
      "MEDIA_REJECTED",
      "Product photo storage returned an invalid response.",
    );
  }

  return {
    provider: "cloudinary",
    storageKey: publicId,
    url: parsedUrl.toString(),
    mimeType: "image/webp",
    byteSize,
    width,
    height,
  };
}

async function readJsonResponse(
  response: Response,
): Promise<unknown> {
  const text =
    await response.text();

  if (
    text.length >
    MAX_RESPONSE_BYTES
  ) {
    throw new CatalogServiceError(
      "MEDIA_REJECTED",
      "Product photo storage returned an invalid response.",
    );
  }

  try {
    return JSON.parse(text) as
      unknown;
  } catch {
    throw new CatalogServiceError(
      "MEDIA_REJECTED",
      "Product photo storage returned an invalid response.",
    );
  }
}

export function createCloudinaryCatalogMediaProvider(
  configuration:
    CloudinaryConfiguration,
  fetchImplementation:
    CatalogMediaFetch = fetch,
): CatalogMediaProvider {
  const cloudName =
    requiredConfigurationValue(
      configuration.cloudName,
    );
  const apiKey =
    requiredConfigurationValue(
      configuration.apiKey,
    );
  const apiSecret =
    requiredConfigurationValue(
      configuration.apiSecret,
    );
  const timeoutMs = safeTimeout(
    configuration.timeoutMs,
  );

  if (
    !/^[A-Za-z0-9_-]+$/u.test(
      cloudName,
    )
  ) {
    throw new CatalogServiceError(
      "MEDIA_UNAVAILABLE",
      "Product photo storage is not configured correctly.",
    );
  }

  return {
    name: "cloudinary",
    async upload(
      request,
    ): Promise<StoredCatalogMediaAsset> {
      const publicId =
        `sorvyra-store/${request.storefrontCode.toLowerCase()}/${randomUUID()}`;
      const uploadBytes =
        new Uint8Array(
          request.bytes
            .byteLength,
        );
      uploadBytes.set(
        request.bytes,
      );
      const form = new FormData();
      form.append(
        "file",
        new Blob(
          [
            uploadBytes.buffer,
          ],
          {
            type:
              request.mimeType,
          },
        ),
        "product.webp",
      );
      form.append(
        "public_id",
        publicId,
      );
      form.append(
        "overwrite",
        "false",
      );
      form.append(
        "allowed_formats",
        "webp",
      );

      const controller =
        new AbortController();
      const timeout =
        setTimeout(
          () =>
            controller.abort(),
          timeoutMs,
        );

      try {
        const response =
          await fetchImplementation(
            `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`,
            {
              method: "POST",
              headers: {
                Authorization:
                  `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString("base64")}`,
              },
              body: form,
              signal:
                controller.signal,
            },
          );

        if (!response.ok) {
          throw new CatalogServiceError(
            "MEDIA_REJECTED",
            "Product photo storage rejected the upload.",
          );
        }

        return parseCloudinaryResponse(
          await readJsonResponse(
            response,
          ),
          publicId,
        );
      } catch (error) {
        if (
          error instanceof
          CatalogServiceError
        ) {
          throw error;
        }

        throw new CatalogServiceError(
          "MEDIA_UNAVAILABLE",
          "Product photo storage is temporarily unavailable. Please try again.",
        );
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}
