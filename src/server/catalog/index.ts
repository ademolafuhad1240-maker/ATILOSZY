export {
  CatalogServiceError,
  type CatalogErrorCode,
} from "@/server/catalog/errors";

export {
  adjustVariantStock,
} from "@/server/catalog/inventory";

export {
  adjustManagedCatalogStock,
  createManagedCatalogProduct,
  getManagerCatalog,
  updateManagedCatalogProduct,
} from "@/server/catalog/management";

export {
  getPublicStorefrontCatalogue,
  getPublicStorefrontProduct,
} from "@/server/catalog/read";

export {
  createCatalogProduct,
} from "@/server/catalog/write";

export type {
  AdjustedInventory,
  AdjustManagedCatalogStockInput,
  AdjustVariantStockInput,
  CatalogImageInput,
  CatalogPriceInput,
  CatalogVariantOptionInput,
  CreatedCatalogProduct,
  CreateManagedCatalogProductInput,
  CreateCatalogProductInput,
  ManagedCatalogProductFields,
  ManagerCatalogCategory,
  ManagerCatalogProduct,
  ManagerCatalogStockMovement,
  ManagerCatalogView,
  PublicCatalogOption,
  PublicCatalogPrice,
  PublicCatalogProduct,
  PublicCatalogVariant,
  UpdateManagedCatalogProductInput,
} from "@/server/catalog/types";
