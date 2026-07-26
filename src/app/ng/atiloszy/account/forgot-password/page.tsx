import {
  StorefrontForgotPasswordPage,
} from "../../../../../components/auth/pages";
import {
  getStorefrontAuthConfig,
} from "../../../../../lib/storefront-auth";

const storefront =
  getStorefrontAuthConfig("ATI");

export default function ForgotPasswordPage() {
  return (
    <StorefrontForgotPasswordPage
      storefront={storefront}
    />
  );
}
