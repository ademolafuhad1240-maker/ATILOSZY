import "server-only";

export type CatalogMediaProviderName =
  | "disabled"
  | "cloudinary";

export interface PreparedCatalogImage {
  bytes: Uint8Array;
  mimeType: "image/webp";
  byteSize: number;
  width: number;
  height: number;
}

export interface CatalogMediaUploadRequest
  extends PreparedCatalogImage {
  storefrontCode: string;
}

export interface StoredCatalogMediaAsset {
  provider: "cloudinary";
  storageKey: string;
  url: string;
  mimeType: string;
  byteSize: number;
  width: number;
  height: number;
}

export interface CatalogMediaProvider {
  readonly name:
    CatalogMediaProviderName;
  upload(
    request:
      CatalogMediaUploadRequest,
  ): Promise<StoredCatalogMediaAsset>;
}

export type CatalogMediaEnvironment =
  Readonly<
    Record<
      string,
      string | undefined
    >
  >;

export type CatalogMediaFetch =
  typeof fetch;
