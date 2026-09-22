import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { loadRazorpayCheckout } from "@/lib/payments/razorpay-checkout";
import { createCheckoutSession, verifyCheckoutSession } from "@/lib/payments/checkout.functions";

/**
 * Real checkout, gated to signed-in users. Signed-out visitors are sent to
 * sign up first (checkout needs an account to attach the subscription
 * to). A client "payment succeeded" callback is never treated as final —
 * `verifyCheckoutSession` re-derives the signature server-side, and the
 * webhook remains the durable source of truth regardless of what happens
 * in this component.
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
  const queryClient = useQueryClient();
  const [isProcessing, setIsProcessing] = useState(false);

  async function handleClick() {
    if (!user) {
      navigate({ to: "/auth", search: { mode: "signup" } });
      return;
    }

    setIsProcessing(true);
    try {
      await loadRazorpayCheckout();
      const session = await createCheckoutSession({ data: { planTier } });

      if (!window.Razorpay) throw new Error("Could not load the payment widget.");

      const checkout = new window.Razorpay({
        key: session.razorpayKeyId,
        subscription_id: session.razorpaySubscriptionId,
        name: "Rolisha",
        description: "Pro subscription",
        prefill: { email: user.email ?? undefined },
        handler: (response) => {
          void (async () => {
            try {
              const result = await verifyCheckoutSession({
                data: {
                  razorpayPaymentId: response.razorpay_payment_id,
                  razorpaySubscriptionId: response.razorpay_subscription_id,
                  razorpaySignature: response.razorpay_signature,
                },
              });
              if (result.verified) {
                toast.success("Payment verified — your plan is now active.");
                await queryClient.invalidateQueries({ queryKey: ["subscription-status"] });
                navigate({ to: "/dashboard" });
              } else {
                toast.error(
                  "We couldn't verify that payment. If money was deducted, it will be reconciled automatically shortly, or contact support.",
                );
              }
            } finally {
              setIsProcessing(false);
            }
          })();
        },
        modal: { ondismiss: () => setIsProcessing(false) },
      });
      checkout.on("payment.failed", (resp) => {
        toast.error(resp.error?.description ?? "Payment failed. Please try again.");
        setIsProcessing(false);
      });
      checkout.open();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not start checkout.");
      setIsProcessing(false);
    }
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
