export type StorefrontCheckoutCode =
  | "ATI"
  | "ZBF"
  | "DEN"
  | "ZCH";

export interface StorefrontCheckoutConfig {
  code: StorefrontCheckoutCode;
  name: string;
  shortName: string;
  countryCode: "NG" | "QA";
  countryName: string;
  currencyCode: "NGN" | "QAR";
  shopHref: string;
  cartHref: string;
  checkoutHref: string;
  accountHref: string;
  loginHref: string;
  ordersHref: string;
  pickupEnabled: boolean;
  deliveryEnabled: boolean;
  installationEnabled: boolean;
  deliveryLabel: string;
}

const configurations:
  Record<
    StorefrontCheckoutCode,
    StorefrontCheckoutConfig
  > = {
    ATI: {
      code: "ATI",
      name:
        "ATILOSZY Varieties Store",
      shortName: "ATILOSZY",
      countryCode: "NG",
      countryName: "Nigeria",
      currencyCode: "NGN",
      shopHref:
        "/ng/atiloszy/shop",
      cartHref:
        "/ng/atiloszy/cart",
      checkoutHref:
        "/ng/atiloszy/checkout",
      accountHref:
        "/ng/atiloszy/account",
      loginHref:
        "/ng/atiloszy/account/login",
      ordersHref:
        "/ng/atiloszy/account/orders",
      pickupEnabled: true,
      deliveryEnabled: true,
      installationEnabled: false,
      deliveryLabel:
        "Delivery in Nigeria",
    },

    ZBF: {
      code: "ZBF",
      name:
        "ZEE Beauty & Fashion World",
      shortName:
        "ZEE Beauty & Fashion",
      countryCode: "NG",
      countryName: "Nigeria",
      currencyCode: "NGN",
      shopHref:
        "/ng/zee-beauty-fashion/shop",
      cartHref:
        "/ng/zee-beauty-fashion/cart",
      checkoutHref:
        "/ng/zee-beauty-fashion/checkout",
      accountHref:
        "/ng/zee-beauty-fashion/account",
      loginHref:
        "/ng/zee-beauty-fashion/account/login",
      ordersHref:
        "/ng/zee-beauty-fashion/account/orders",
      pickupEnabled: true,
      deliveryEnabled: true,
      installationEnabled: false,
      deliveryLabel:
        "Delivery in Nigeria",
    },

    DEN: {
      code: "DEN",
      name:
        "DENALD Solar | CCTV | Computer",
      shortName: "DENALD",
      countryCode: "NG",
      countryName: "Nigeria",
      currencyCode: "NGN",
      shopHref:
        "/ng/denald/shop",
      cartHref:
        "/ng/denald/cart",
      checkoutHref:
        "/ng/denald/checkout",
      accountHref:
        "/ng/denald/account",
      loginHref:
        "/ng/denald/account/login",
      ordersHref:
        "/ng/denald/account/orders",
      pickupEnabled: true,
      deliveryEnabled: true,
      installationEnabled: true,
      deliveryLabel:
        "Product delivery in Nigeria",
    },

    ZCH: {
      code: "ZCH",
      name:
        "Zee COMFORT HUB",
      shortName:
        "Zee COMFORT HUB",
      countryCode: "QA",
      countryName: "Qatar",
      currencyCode: "QAR",
      shopHref:
        "/qa/zee-comfort-hub/shop",
      cartHref:
        "/qa/zee-comfort-hub/cart",
      checkoutHref:
        "/qa/zee-comfort-hub/checkout",
      accountHref:
        "/qa/zee-comfort-hub/account",
      loginHref:
        "/qa/zee-comfort-hub/account/login",
      ordersHref:
        "/qa/zee-comfort-hub/account/orders",
      pickupEnabled: true,
      deliveryEnabled: true,
      installationEnabled: false,
      deliveryLabel:
        "Delivery throughout Qatar",
    },
  };

const configurationIndex:
  Readonly<
    Record<
      string,
      StorefrontCheckoutConfig
    >
  > = configurations;

export function getStorefrontCheckoutConfig(
  code: StorefrontCheckoutCode,
): StorefrontCheckoutConfig {
  return configurations[code];
}

export function findStorefrontCheckoutConfig(
  code: string,
): StorefrontCheckoutConfig | null {
  return (
    configurationIndex[
      code
    ] ??
    null
  );
}
