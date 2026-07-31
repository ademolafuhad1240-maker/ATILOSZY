import "server-only";

import {
  CatalogServiceError,
} from "../errors";
import type {
  CatalogMediaProvider,
} from "./types";

export const disabledCatalogMediaProvider:
  CatalogMediaProvider = {
    name: "disabled",
    async upload() {
      throw new CatalogServiceError(
        "MEDIA_UNAVAILABLE",
        "Product photo uploads are not enabled yet.",
      );
    },
  };
