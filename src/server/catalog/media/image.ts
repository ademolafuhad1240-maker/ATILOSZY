import "server-only";

import sharp from "sharp";

import {
  CatalogServiceError,
} from "../errors";
import type {
  PreparedCatalogImage,
} from "./types";

export const MAX_CATALOG_IMAGES =
  8;
export const MAX_CATALOG_IMAGE_INPUT_BYTES =
  8 * 1024 * 1024;
export const MAX_CATALOG_IMAGE_OUTPUT_BYTES =
  5 * 1024 * 1024;
export const MAX_CATALOG_IMAGE_PIXELS =
  25_000_000;
export const MAX_CATALOG_IMAGE_DIMENSION =
  2_400;
export const CATALOG_IMAGE_MIME_TYPES =
  [
    "image/jpeg",
    "image/png",
    "image/webp",
  ] as const;

const acceptedInputFormats =
  new Set([
    "jpeg",
    "png",
    "webp",
  ]);

export async function prepareCatalogImage(
  input: {
    bytes: Uint8Array;
    contentType: string;
  },
): Promise<PreparedCatalogImage> {
  if (
    !CATALOG_IMAGE_MIME_TYPES.includes(
      input.contentType as
        (typeof CATALOG_IMAGE_MIME_TYPES)[number],
    )
  ) {
    throw new CatalogServiceError(
      "VALIDATION",
      "Product photos must be JPEG, PNG or WebP images.",
    );
  }

  if (
    input.bytes.byteLength < 1 ||
    input.bytes.byteLength >
      MAX_CATALOG_IMAGE_INPUT_BYTES
  ) {
    throw new CatalogServiceError(
      "VALIDATION",
      "Each product photo must be no larger than 8 MB.",
    );
  }

  try {
    const source = sharp(
      input.bytes,
      {
        failOn: "error",
        limitInputPixels:
          MAX_CATALOG_IMAGE_PIXELS,
      },
    );
    const metadata =
      await source.metadata();

    if (
      !metadata.format ||
      !acceptedInputFormats.has(
        metadata.format,
      ) ||
      !metadata.width ||
      !metadata.height
    ) {
      throw new CatalogServiceError(
        "VALIDATION",
        "The selected file is not a supported product photo.",
      );
    }

    const result =
      await sharp(
        input.bytes,
        {
          failOn: "error",
          limitInputPixels:
            MAX_CATALOG_IMAGE_PIXELS,
        },
      )
        .rotate()
        .resize({
          width:
            MAX_CATALOG_IMAGE_DIMENSION,
          height:
            MAX_CATALOG_IMAGE_DIMENSION,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({
          quality: 86,
          effort: 4,
        })
        .toBuffer({
          resolveWithObject: true,
        });

    if (
      result.data.byteLength >
      MAX_CATALOG_IMAGE_OUTPUT_BYTES
    ) {
      throw new CatalogServiceError(
        "VALIDATION",
        "The optimized product photo is too large. Choose a smaller image.",
      );
    }

    return {
      bytes:
        new Uint8Array(
          result.data,
        ),
      mimeType: "image/webp",
      byteSize:
        result.data.byteLength,
      width: result.info.width,
      height: result.info.height,
    };
  } catch (error) {
    if (
      error instanceof
      CatalogServiceError
    ) {
      throw error;
    }

    throw new CatalogServiceError(
      "VALIDATION",
      "The selected file could not be verified as a safe product photo.",
    );
  }
}
