export interface StorefrontCatalogConfig {
  code: "ATI" | "ZBF" | "DEN" | "ZCH";
  key: string;
  name: string;
  shortName: string;
  baseHref: string;
  shopHref: string;
  cartHref: string;
  loginHref: string;
  accountHref: string;
}

const storefrontCatalogConfigs:
  Record<
    StorefrontCatalogConfig["code"],
    StorefrontCatalogConfig
  > = {
    ATI: {
      code: "ATI",
      key: "atiloszy",
      name:
        "ATILOSZY Varieties Store",
      shortName: "ATILOSZY",
      baseHref: "/ng/atiloszy",
      shopHref:
        "/ng/atiloszy/shop",
      cartHref:
        "/ng/atiloszy/cart",
      loginHref:
        "/ng/atiloszy/account/login",
      accountHref:
        "/ng/atiloszy/account",
    },
    ZBF: {
      code: "ZBF",
      key:
        "zee-beauty-fashion",
      name:
        "ZEE Beauty & Fashion World",
      shortName:
        "ZEE Beauty & Fashion",
      baseHref:
        "/ng/zee-beauty-fashion",
      shopHref:
        "/ng/zee-beauty-fashion/shop",
      cartHref:
        "/ng/zee-beauty-fashion/cart",
      loginHref:
        "/ng/zee-beauty-fashion/account/login",
      accountHref:
        "/ng/zee-beauty-fashion/account",
    },
    DEN: {
      code: "DEN",
      key: "denald",
      name:
        "DENALD Solar | CCTV | Computer",
      shortName: "DENALD",
      baseHref: "/ng/denald",
      shopHref:
        "/ng/denald/shop",
      cartHref:
        "/ng/denald/cart",
      loginHref:
        "/ng/denald/account/login",
      accountHref:
        "/ng/denald/account",
    },
    ZCH: {
      code: "ZCH",
      key:
        "zee-comfort-hub",
      name:
        "Zee COMFORT HUB",
      shortName:
        "Zee COMFORT HUB",
      baseHref:
        "/qa/zee-comfort-hub",
      shopHref:
        "/qa/zee-comfort-hub/shop",
      cartHref:
        "/qa/zee-comfort-hub/cart",
      loginHref:
        "/qa/zee-comfort-hub/account/login",
      accountHref:
        "/qa/zee-comfort-hub/account",
    },
  };

export function getStorefrontCatalogConfig(
  code: StorefrontCatalogConfig["code"],
): StorefrontCatalogConfig {
  return storefrontCatalogConfigs[
    code
  ];
}
