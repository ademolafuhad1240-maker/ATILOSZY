import "server-only";

export type GovernanceErrorCode =
  | "VALIDATION"
  | "STOREFRONT_UNAVAILABLE"
  | "ACCOUNT_UNAVAILABLE"
  | "APPLICATION_ALREADY_PENDING"
  | "MANAGER_ACCESS_EXISTS"
  | "APPLICATION_NOT_FOUND"
  | "APPLICATION_NOT_PENDING"
  | "APPLICATION_SELF_REVIEW_FORBIDDEN"
  | "PLATFORM_ACCESS_REQUIRED"
  | "MANAGER_ACCESS_REQUIRED"
  | "STAFF_TARGET_NOT_FOUND"
  | "STAFF_TARGET_PROTECTED"
  | "INVALID_STAFF_ACTION"
  | "INVALID_MANAGER_ACTION"
  | "GOVERNANCE_CONFLICT";

export class GovernanceServiceError extends Error {
  readonly code: GovernanceErrorCode;

  constructor(
    code: GovernanceErrorCode,
    message: string,
  ) {
    super(message);
    this.name =
      "GovernanceServiceError";
    this.code = code;
  }
}

export function isPrismaErrorCode(
  error: unknown,
  expectedCode: string,
): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === expectedCode
  );
}
