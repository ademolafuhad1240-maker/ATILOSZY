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

export {
  assertAuthDeliveryEnabled,
  createDisabledAuthDeliveryProvider,
  getAuthDeliveryProvider,
  isAuthDeliveryUnavailableError,
  AuthDeliveryUnavailableError,
} from "./delivery";

export {
  requestPasswordReset,
  resetCustomerPassword,
} from "./recovery";

export {
  resendRegistrationVerification,
} from "./resend";

export type {
  AuthDeliveryProvider,
  EmailVerificationDelivery,
  PasswordResetDelivery,
  PhoneVerificationDelivery,
} from "./delivery";

export type {
  GenericRecoveryResult,
  RecoveryClockOptions,
  RequestPasswordResetInput,
  ResendRegistrationVerificationInput,
  ResetCustomerPasswordInput,
  ResetPasswordResult,
} from "./recovery-types";
