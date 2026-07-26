export {
  CatalogServiceError,
  type CatalogErrorCode,
} from "@/server/catalog/errors";

export {
  adjustVariantStock,
} from "@/server/catalog/inventory";

export {
  getPublicStorefrontCatalogue,
  getPublicStorefrontProduct,
} from "@/server/catalog/read";

export {
  createCatalogProduct,
} from "@/server/catalog/write";

export type {
  AdjustedInventory,
  AdjustVariantStockInput,
  CatalogImageInput,
  CatalogPriceInput,
  CatalogVariantOptionInput,
  CreatedCatalogProduct,
  CreateCatalogProductInput,
  PublicCatalogOption,
  PublicCatalogPrice,
  PublicCatalogProduct,
  PublicCatalogVariant,
} from "@/server/catalog/types";
