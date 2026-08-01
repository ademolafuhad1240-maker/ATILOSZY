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
  loginPlatformAdministrator,
  revokeAllUserSessions,
  revokeCustomerAccountSessions,
  revokeSession,
  revokeSessionToken,
  validatePlatformSession,
  validateSession,
} from "./session";

export type {
  LoginCustomerInput,
  LoginResult,
  PlatformAdministratorLoginInput,
  PlatformAdministratorLoginResult,
  RegisterCustomerInput,
  RegistrationResult,
  ValidatedPlatformSession,
  ValidatedSession,
  VerificationResult,
} from "./types";

export {
  assertAuthDeliveryEnabled,
  AuthDeliveryProviderError,
  createDisabledAuthDeliveryProvider,
  createResendEmailSender,
  createResendOnlyAuthDeliveryProvider,
  createResendTwilioAuthDeliveryProvider,
  createTwilioSmsSender,
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
  AuthDeliveryFetch,
  EmailVerificationDelivery,
  PasswordResetDelivery,
  PhoneVerificationDelivery,
  ResendEmailSender,
  ResendEmailSenderOptions,
  ResendOnlyAuthDeliveryProviderOptions,
  ResendTwilioAuthDeliveryProviderOptions,
  TwilioSmsSender,
  TwilioSmsSenderOptions,
} from "./delivery";

export type {
  GenericRecoveryResult,
  RecoveryClockOptions,
  RequestPasswordResetInput,
  ResendRegistrationVerificationInput,
  ResetCustomerPasswordInput,
  ResetPasswordResult,
} from "./recovery-types";
