import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { FEATURE_INFO, PLAN_LABEL, featuresForPlan, type PlanTier } from "@/lib/subscription";
import type { SubscriptionStatus } from "@/lib/subscription.functions";
import { cancelSubscription, getCurrentSubscription } from "@/lib/payments/billing.functions";

const USAGE_ROWS: { key: Exclude<keyof SubscriptionStatus["usage"], "plan">; label: string }[] = [
  { key: "careerRoadmaps", label: "Roadmaps" },
  { key: "projects", label: "Projects" },
  { key: "assessments", label: "Assessments" },
  { key: "learningLessons", label: "Learning lessons" },
];

const SUBSCRIPTION_STATUS_LABEL: Record<string, string> = {
  created: "Setting up",
  authenticated: "Authenticated",
  active: "Active",
  pending: "Payment issue",
  halted: "Payment issue",
  cancelled: "Cancelled",
  completed: "Completed",
  expired: "Expired",
};

/** Label for the `subscriptions` table's historical `plan_tier` column,
 * which can still legitimately read "premium" for a subscription that was
 * purchased before the Premium tier was folded into Pro — that's a
 * historical billing record, not a live plan choice, so it's kept and
 * labelled rather than hidden. This is deliberately separate from the
 * app-wide `PLAN_LABEL` (which only covers the two plans someone can be on
 * today) so a legacy row never needs an unsafe cast into that type. */
const BILLING_PLAN_LABEL: Record<"pro" | "premium", string> = {
  pro: "Pro",
  premium: "Premium (legacy)",
};

/** Billing status + cancel action, backed by the real Razorpay-mirrored
 * `subscriptions` table. Renders nothing when the user has never had a
 * paid subscription (e.g. still on Free, or plan was set by an admin). */
function BillingStatus({ plan }: { plan: PlanTier }) {
  const queryClient = useQueryClient();
  const { data: subscription, isLoading } = useQuery({
    queryKey: ["current-subscription"],
    queryFn: () => getCurrentSubscription(),
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelSubscription({ data: {} }),
    onSuccess: () => {
      toast.success("Your subscription will end after the current billing period.");
      queryClient.invalidateQueries({ queryKey: ["current-subscription"] });
    },
    onError: (error: Error) => toast.error(error.message || "Could not cancel your subscription."),
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <Loader2 className="size-4 animate-spin" />
        Loading billing status…
      </div>
    );
  }

  if (!subscription) return null;

  const isCancellable = ["created", "authenticated", "active", "pending"].includes(
    subscription.status,
  );

  return (
    <div className="border-border/60 space-y-2 border-t pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Billing</h3>
          <p className="text-muted-foreground text-xs">
            {BILLING_PLAN_LABEL[subscription.planTier]} subscription via Razorpay —{" "}
            {SUBSCRIPTION_STATUS_LABEL[subscription.status] ?? subscription.status}
            {subscription.cancelAtPeriodEnd &&
              subscription.status === "active" &&
              " (cancels at period end)"}
          </p>
        </div>
        {isCancellable && !subscription.cancelAtPeriodEnd && (
          <Button
            variant="outline"
            size="sm"
            disabled={cancelMutation.isPending}
            onClick={() => cancelMutation.mutate()}
          >
            {cancelMutation.isPending && <Loader2 className="size-3.5 animate-spin" />}
            Cancel subscription
          </Button>
        )}
      </div>
      {subscription.lastPaymentError && (
        <p className="text-destructive text-xs">
          Last payment issue: {subscription.lastPaymentError}
        </p>
      )}
      {subscription.currentPeriodEnd && subscription.status === "active" && (
        <p className="text-muted-foreground text-xs">
          {subscription.cancelAtPeriodEnd ? "Access ends" : "Next billing date"}:{" "}
          {new Date(subscription.currentPeriodEnd).toLocaleDateString(undefined, {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
      )}
      {plan !== subscription.planTier && subscription.status === "active" && (
        <p className="text-muted-foreground text-xs">
          Your account plan and subscription are briefly out of sync — this usually resolves within
          a minute as the payment confirmation finishes processing.
        </p>
      )}
    </div>
  );
}

/** Full subscription section for Settings — plan, real usage, included
 * features, and real billing status. */
export function SubscriptionPanel({ status }: { status: SubscriptionStatus }) {
  const included = featuresForPlan(status.plan);

  return (
    <section className="panel hover-lift space-y-5 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold">Your plan</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            {status.planSource === "manual_admin"
              ? "Manually assigned by an admin for testing — not an active paid subscription."
              : status.planSource === "razorpay_subscription"
                ? "Active paid subscription, billed via Razorpay."
                : "You're on the Free plan. Upgrade any time from the pricing page."}
          </p>
        </div>
        <Badge className="text-sm">{PLAN_LABEL[status.plan]}</Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {USAGE_ROWS.map(({ key, label }) => {
          const usage = status.usage[key];
          const pct = usage.limit ? Math.min(100, Math.round((usage.used / usage.limit) * 100)) : 0;
          return (
            <div key={key} className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{label}</span>
                <span className="text-muted-foreground">
                  {usage.limit === null ? "Unlimited" : `${usage.used} / ${usage.limit}`}
                </span>
              </div>
              {usage.limit !== null && <Progress value={pct} />}
            </div>
          );
        })}
      </div>

      <div>
        <h3 className="text-sm font-semibold">Included in {PLAN_LABEL[status.plan]}</h3>
        <ul className="mt-2 grid gap-1.5 text-sm sm:grid-cols-2">
          {/* Only features that exist are listed: an unbuilt capability must never
              appear as "included" for a paying customer either. */}
          {included
            .filter((f) => FEATURE_INFO[f].implemented)
            .map((f) => (
              <li key={f} className="text-muted-foreground flex items-center gap-2">
                <span className="bg-success/70 size-1.5 rounded-full" />
                {FEATURE_INFO[f].label}
              </li>
            ))}
        </ul>
      </div>

      <BillingStatus plan={status.plan} />

      {status.plan !== "pro" && (
        <div className="flex justify-end">
          <Button asChild>
            <Link to="/pricing">
              <Sparkles className="size-4" />
              Upgrade to Pro
            </Link>
          </Button>
        </div>
      )}
    </section>
  );
}

/** Compact widget for the Dashboard — plan + one or two usage bars, doesn't
 * dominate the page. */
export function SubscriptionMiniCard({ status }: { status: SubscriptionStatus }) {
  const capped = Object.values(status.usage).filter((u) => u.limit !== null);
  return (
    <div className="panel hover-lift space-y-3 p-5">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
          Plan
        </span>
        <Badge>{PLAN_LABEL[status.plan as PlanTier]}</Badge>
      </div>
      {capped.length > 0 ? (
        <div className="space-y-2">
          {USAGE_ROWS.filter((r) => status.usage[r.key].limit !== null).map(({ key, label }) => {
            const usage = status.usage[key];
            const pct = usage.limit
              ? Math.min(100, Math.round((usage.used / usage.limit) * 100))
              : 0;
            return (
              <div key={key}>
                <div className="flex justify-between text-xs">
                  <span>{label}</span>
                  <span className="text-muted-foreground">
                    {usage.used} / {usage.limit}
                  </span>
                </div>
                <Progress value={pct} className="mt-1 h-1.5" />
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-muted-foreground text-xs">Unlimited on your plan.</p>
      )}
      {status.plan !== "pro" && (
        <Button asChild size="sm" variant="outline" className="w-full">
          <Link to="/pricing">See plans</Link>
        </Button>
      )}
    </div>
  );
}
