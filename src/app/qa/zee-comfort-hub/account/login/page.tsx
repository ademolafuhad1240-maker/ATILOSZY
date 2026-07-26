import {
  StorefrontLoginPage,
} from "../../../../../components/auth/pages";
import {
  getStorefrontAuthConfig,
} from "../../../../../lib/storefront-auth";

const storefront =
  getStorefrontAuthConfig("ZCH");

export default function LoginPage() {
  return (
    <StorefrontLoginPage
      storefront={storefront}
    />
  );
}
