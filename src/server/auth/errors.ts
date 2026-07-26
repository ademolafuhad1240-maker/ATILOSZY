export type AuthErrorCode =
  | "VALIDATION_ERROR"
  | "STOREFRONT_UNAVAILABLE"
  | "ACCOUNT_CONFLICT"
  | "INVALID_CREDENTIALS"
  | "ACCOUNT_LOCKED"
  | "ACCOUNT_UNAVAILABLE"
  | "VERIFICATION_REQUIRED"
  | "VERIFICATION_INVALID"
  | "SESSION_INVALID";

export class AuthServiceError extends Error {
  readonly code: AuthErrorCode;

  constructor(
    code: AuthErrorCode,
    message: string,
  ) {
    super(message);

    this.name = "AuthServiceError";
    this.code = code;
  }
}

export function isPrismaErrorCode(
  error: unknown,
  expectedCode: string,
): boolean {
  if (
    typeof error !== "object" ||
    error === null ||
    !("code" in error)
  ) {
    return false;
  }

  return (
    (error as { code?: unknown }).code === expectedCode
  );
}
