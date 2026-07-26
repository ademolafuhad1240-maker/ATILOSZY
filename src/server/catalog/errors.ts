export type CatalogErrorCode =
  | "VALIDATION"
  | "NOT_FOUND"
  | "CONFLICT"
  | "CURRENCY_MISMATCH"
  | "INSUFFICIENT_STOCK";

export class CatalogServiceError extends Error {
  readonly code: CatalogErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(
    code: CatalogErrorCode,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);

    this.name = "CatalogServiceError";
    this.code = code;
    this.details = details;
  }
}
