import { useCallback, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { loadRazorpayCheckout } from "@/lib/payments/razorpay-checkout";
import { createCheckoutSession, verifyCheckoutSession } from "@/lib/payments/checkout.functions";

/**
 * Shared client-side Pro-checkout flow: load the Razorpay script, create a
 * subscription, open Razorpay Checkout, and verify the result. Used both by
 * `CheckoutButton` (a signed-in user clicking "Upgrade to Pro" directly) and
 * by the pricing page's post-signup/login auto-checkout (a signed-out
 * visitor who clicked Upgrade, authenticated, and is being sent straight
 * back into the checkout they originally asked for). Keeping this in one
 * place means both call sites verify the same way and invalidate the same
 * `subscription-status` query on success.
 */
export function useProCheckout() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isProcessing, setIsProcessing] = useState(false);

  const startCheckout = useCallback(async () => {
    setIsProcessing(true);
    try {
      await loadRazorpayCheckout();
      const session = await createCheckoutSession({ data: { planTier: "pro" } });

      if (!window.Razorpay) throw new Error("Could not load the payment widget.");

      const checkout = new window.Razorpay({
        key: session.razorpayKeyId,
        subscription_id: session.razorpaySubscriptionId,
        name: "Rolisha",
        description: "Pro subscription",
        prefill: { email: user?.email ?? undefined },
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
  }, [user, navigate, queryClient]);

  return { startCheckout, isProcessing };
}
