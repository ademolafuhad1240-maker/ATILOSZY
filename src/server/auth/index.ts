export {
  AuthServiceError,
  isPrismaErrorCode,
} from "./errors";

export {
  assertTokenSecret,
  createOpaqueToken,
  createPhoneChallenge,
  hashOpaqueToken,
  hashPassword,
  normalizeEmail,
  normalizePersonName,
  normalizePhone,
  normalizeStorefrontCode,
  passwordNeedsRehash,
  validatePassword,
  verifyPassword,
  verifyPhoneCodeHash,
} from "./crypto";

export {
  registerCustomer,
} from "./registration";

export {
  verifyCustomerEmail,
  verifyCustomerPhone,
} from "./verification";

export {
  loginCustomer,
  revokeAllUserSessions,
  revokeSession,
  validateSession,
} from "./session";

export type {
  LoginCustomerInput,
  LoginResult,
  RegisterCustomerInput,
  RegistrationResult,
  ValidatedSession,
  VerificationResult,
} from "./types";
