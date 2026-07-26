export type StorefrontAuthCode =
  | "ATI"
  | "ZBF"
  | "DEN"
  | "ZCH";

export interface StorefrontAuthConfig {
  code: StorefrontAuthCode;
  name: string;
  shortName: string;
  countryName: string;
  currencyCode: "NGN" | "QAR";
  baseHref: string;
  accountHref: string;
  loginHref: string;
  registerHref: string;
  verifyHref: string;
  accent: string;
  accentStrong: string;
  surface: string;
  deep: string;
  description: string;
}

const storefronts = {
  ATI: {
    code: "ATI",
    name: "ATILOSZY Varieties Store",
    shortName: "ATILOSZY",
    countryName: "Nigeria",
    currencyCode: "NGN",
    baseHref: "/ng/atiloszy",
    accountHref: "/ng/atiloszy/account",
    loginHref: "/ng/atiloszy/account/login",
    registerHref:
      "/ng/atiloszy/account/register",
    verifyHref:
      "/ng/atiloszy/account/verify",
    accent: "#b8a16a",
    accentStrong: "#8c7138",
    surface: "#f5efe3",
    deep: "#0c1923",
    description:
      "Manage your ATILOSZY orders, pickup reservations and delivery updates.",
  },
  ZBF: {
    code: "ZBF",
    name: "ZEE Beauty & Fashion World",
    shortName: "ZEE Beauty",
    countryName: "Nigeria",
    currencyCode: "NGN",
    baseHref: "/ng/zee-beauty-fashion",
    accountHref:
      "/ng/zee-beauty-fashion/account",
    loginHref:
      "/ng/zee-beauty-fashion/account/login",
    registerHref:
      "/ng/zee-beauty-fashion/account/register",
    verifyHref:
      "/ng/zee-beauty-fashion/account/verify",
    accent: "#b04b72",
    accentStrong: "#7e294d",
    surface: "#faedf2",
    deep: "#28101a",
    description:
      "Manage your beauty, fashion and household purchases securely.",
  },
  DEN: {
    code: "DEN",
    name: "DENALD Solar | CCTV | Computer",
    shortName: "DENALD",
    countryName: "Nigeria",
    currencyCode: "NGN",
    baseHref: "/ng/denald",
    accountHref: "/ng/denald/account",
    loginHref: "/ng/denald/account/login",
    registerHref:
      "/ng/denald/account/register",
    verifyHref:
      "/ng/denald/account/verify",
    accent: "#15929c",
    accentStrong: "#08656d",
    surface: "#eaf6f6",
    deep: "#071c23",
    description:
      "Manage product purchases, technical requests and installation updates.",
  },
  ZCH: {
    code: "ZCH",
    name: "Zee COMFORT HUB",
    shortName: "COMFORT HUB",
    countryName: "Qatar",
    currencyCode: "QAR",
    baseHref: "/qa/zee-comfort-hub",
    accountHref:
      "/qa/zee-comfort-hub/account",
    loginHref:
      "/qa/zee-comfort-hub/account/login",
    registerHref:
      "/qa/zee-comfort-hub/account/register",
    verifyHref:
      "/qa/zee-comfort-hub/account/verify",
    accent: "#a23c60",
    accentStrong: "#74243f",
    surface: "#faebf0",
    deep: "#2a111b",
    description:
      "Manage your comfort-wear orders, pickup and Qatar-wide delivery.",
  },
} satisfies Record<
  StorefrontAuthCode,
  StorefrontAuthConfig
>;

export function getStorefrontAuthConfig(
  code: StorefrontAuthCode,
): StorefrontAuthConfig {
  return storefronts[code];
}

export function getAllStorefrontAuthConfigs(): StorefrontAuthConfig[] {
  return [
    storefronts.ATI,
    storefronts.ZBF,
    storefronts.DEN,
    storefronts.ZCH,
  ];
}
