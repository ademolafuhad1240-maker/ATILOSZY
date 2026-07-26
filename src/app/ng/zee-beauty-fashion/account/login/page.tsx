import {
  StorefrontLoginPage,
} from "../../../../../components/auth/pages";
import {
  getStorefrontAuthConfig,
} from "../../../../../lib/storefront-auth";

const storefront =
  getStorefrontAuthConfig("ZBF");

export default function LoginPage() {
  return (
    <StorefrontLoginPage
      storefront={storefront}
    />
  );
}
