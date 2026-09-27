import { useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useProCheckout } from "@/lib/payments/use-pro-checkout";

/**
 * Real checkout, gated to signed-in users. A signed-out visitor is sent to
 * sign up first (checkout needs an account to attach the subscription to) --
 * but their intent to buy Pro is preserved through the `redirect`/`checkout`
 * search params on `/auth`, so completing signup (or logging in, for an
 * existing Free user) lands them back on `/pricing?checkout=pro`, which
 * automatically resumes this same checkout flow (see the pricing route's
 * auto-checkout effect) instead of dropping them on the dashboard. A client
 * "payment succeeded" callback is never treated as final --
 * `verifyCheckoutSession` re-derives the signature server-side, and the
 * webhook remains the durable source of truth regardless of what happens in
 * this component.
 */
export function CheckoutButton({
  planTier,
  label,
  highlighted,
}: {
  planTier: "pro";
  label: string;
  highlighted?: boolean;
}) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { startCheckout, isProcessing } = useProCheckout();

  function handleClick() {
    if (!user) {
      navigate({
        to: "/auth",
        search: { mode: "signup", redirect: "/pricing", checkout: planTier },
      });
      return;
    }
    void startCheckout();
  }

  return (
    <Button
      className={
        highlighted
          ? "mt-8 w-full"
          : "border-border hover:bg-surface-strong hover:border-foreground/30 mt-8 w-full border transition-colors"
      }
      variant={highlighted ? "default" : "secondary"}
      disabled={loading || isProcessing}
      onClick={handleClick}
    >
      {isProcessing && <Loader2 className="size-4 animate-spin" />}
      {label}
    </Button>
  );
}
