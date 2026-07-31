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
  uploadManagedCatalogImage,
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
  CatalogMediaCapabilities,
  CatalogPriceInput,
  CatalogVariantOptionInput,
  CreatedCatalogProduct,
  CreateManagedCatalogProductInput,
  CreateCatalogProductInput,
  ManagedCatalogProductFields,
  ManagedCatalogImageSelectionInput,
  ManagerCatalogCategory,
  ManagerCatalogImage,
  ManagerCatalogProduct,
  ManagerCatalogStockMovement,
  ManagerCatalogView,
  PublicCatalogOption,
  PublicCatalogImage,
  PublicCatalogPrice,
  PublicCatalogProduct,
  PublicCatalogVariant,
  UpdateManagedCatalogProductInput,
  UploadedManagedCatalogImage,
} from "@/server/catalog/types";
