import { createFileRoute, Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { useState } from "react";
import { MarketingPage, PageHero } from "@/components/site/marketing-page";
import { CheckoutButton } from "@/components/site/checkout-button";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatPrice, REGION_PRICING, type RegionCode, type RegionPricing } from "@/lib/pricing";

const TITLE = "Pricing — Rolisha";
const DESCRIPTION =
  "Start free with one career roadmap and a full skill gap analysis. Upgrade for unlimited roadmaps, assessments, advanced matching and the application tracker.";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
    ],
  }),
  component: PricingPage,
});

function buildPlans(region: RegionPricing, checkoutAvailable: boolean) {
  return [
    {
      tier: "free" as const,
      name: "Free",
      price: formatPrice(0, region),
      cadence: "forever",
      description: "Understand your gap and get your first roadmap.",
      features: [
        "Basic career roadmap",
        "Basic skill gap analysis",
        "Limited learning (5 lessons)",
        "Basic assessments (3)",
        "Limited projects (2)",
        "Basic job discovery",
        "Basic dashboard & progress tracking",
      ],
      cta: "Get started",
      highlighted: false,
    },
    {
      tier: "pro" as const,
      name: "Pro",
      price: formatPrice(region.pro, region),
      cadence: "per month",
      description: "For people actively preparing to apply.",
      features: [
        "Everything in Free, plus:",
        "Full roadmap",
        "Unlimited learning",
        "Advanced skill gap analysis",
        "All assessments",
        "Unlimited projects",
        "Advanced job matching",
        "Advanced career analytics",
        "Multiple career roadmaps",
        "AI resume analysis",
        "Resume optimization",
        "Interview preparation",
        "Personalized interview questions",
        "Mock interviews",
        "Career switch analysis",
        "AI career recommendations",
      ],
      cta: checkoutAvailable ? "Upgrade to Pro" : "Join the waitlist",
      highlighted: true,
    },
  ];
}

/** Feature matrix for the comparison table below the plan cards. Every row
 * is a feature that is built and gated today -- a capability that does not
 * exist is never listed, labelled or otherwise. Rolisha has exactly two
 * user-facing plans (Free and Pro); there used to be a third "Premium"
 * column above Pro, and every feature it gated is now a Pro feature. */
const COMPARISON_ROWS: {
  label: string;
  free: boolean;
  pro: boolean;
}[] = [
  { label: "Basic career roadmap", free: true, pro: true },
  { label: "Full roadmap", free: false, pro: true },
  { label: "Basic skill gap analysis", free: true, pro: true },
  { label: "Advanced skill gap analysis", free: false, pro: true },
  { label: "Learning lessons", free: true, pro: true },
  { label: "Unlimited learning", free: false, pro: true },
  { label: "Assessments", free: true, pro: true },
  { label: "Full assessment library", free: false, pro: true },
  { label: "Projects", free: true, pro: true },
  { label: "Unlimited projects", free: false, pro: true },
  { label: "Basic job discovery", free: true, pro: true },
  { label: "Advanced job matching", free: false, pro: true },
  { label: "Multiple career roadmaps", free: false, pro: true },
  { label: "Advanced career analytics", free: false, pro: true },
  { label: "AI resume analysis", free: false, pro: true },
  { label: "Resume optimization", free: false, pro: true },
  { label: "Interview preparation", free: false, pro: true },
  { label: "Personalized interview questions", free: false, pro: true },
  { label: "Mock interviews", free: false, pro: true },
  { label: "Career switch analysis", free: false, pro: true },
  { label: "AI career recommendations", free: false, pro: true },
];

function PricingPage() {
  // India is the default region — a deliberate product decision (this is
  // Rolisha's primary, only fully-live-checkout market), not a guess. It
  // is never silently overridden by a browser-locale detection effect: a
  // prior version of this page did that (via `guessRegion()` in a
  // `useEffect`), which is exactly why a visitor whose browser reports a
  // non-`en-IN` locale (e.g. `en-US`, extremely common even for Indian
  // users) would see the page flip from INR to USD right after mount. The
  // region shown is now only ever what this state holds — set once here,
  // changed only by the visitor's own selection below.
  const [regionCode, setRegionCode] = useState<RegionCode>("IN");

  const region = REGION_PRICING[regionCode];
  // Real checkout (via Razorpay) is only wired up for India/INR today —
  // that's the market Razorpay serves natively. Other regions keep the
  // honest waitlist flow rather than claiming card checkout that doesn't
  // exist yet for them.
  const checkoutAvailable = regionCode === "IN";
  const plans = buildPlans(region, checkoutAvailable);

  return (
    <MarketingPage>
      <PageHero
        eyebrow="Pricing"
        title="Start free. Upgrade when you are applying."
        subtitle={
          checkoutAvailable
            ? "Pro is billed monthly in INR via Razorpay, with UPI, cards, and netbanking supported."
            : "Card checkout for your region isn't live yet — join the waitlist and we'll email you when it is."
        }
      />

      <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
        <div className="mb-8 flex items-center justify-center gap-3">
          <label htmlFor="pricing-region" className="text-muted-foreground text-sm">
            Show pricing for
          </label>
          <Select value={regionCode} onValueChange={(v) => setRegionCode(v as RegionCode)}>
            <SelectTrigger id="pricing-region" className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(REGION_PRICING) as RegionCode[]).map((code) => (
                <SelectItem key={code} value={code}>
                  {REGION_PRICING[code].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="mx-auto grid max-w-3xl gap-6 lg:grid-cols-2">
          {plans.map((plan) => (
            <article
              key={plan.name}
              className={
                plan.highlighted
                  ? "panel border-primary/40 shadow-glow relative flex h-full flex-col p-7"
                  : "panel flex h-full flex-col p-7"
              }
            >
              {plan.highlighted && <Badge className="absolute -top-3 left-7">Most popular</Badge>}
              <h2 className="font-display text-xl font-semibold">{plan.name}</h2>
              <p className="text-muted-foreground mt-1 text-sm">{plan.description}</p>
              <p className="mt-6">
                <span className="font-display text-4xl font-semibold">{plan.price}</span>{" "}
                <span className="text-muted-foreground text-sm">{plan.cadence}</span>
              </p>
              <ul className="mt-6 flex-1 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-2.5 text-sm">
                    <Check className="text-success mt-0.5 size-4 shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>
              {plan.tier !== "free" && checkoutAvailable ? (
                <CheckoutButton
                  planTier={plan.tier}
                  label={plan.cta}
                  highlighted={plan.highlighted}
                />
              ) : (
                <Button
                  asChild
                  variant={plan.highlighted ? "default" : "secondary"}
                  className={
                    plan.highlighted
                      ? "mt-8 w-full"
                      : "border-border bg-surface-strong hover:bg-card hover:border-foreground/30 mt-8 w-full border transition-colors"
                  }
                >
                  <Link to="/auth" search={{ mode: "signup" }}>
                    {plan.cta}
                  </Link>
                </Button>
              )}
            </article>
          ))}
        </div>
        <p className="text-muted-foreground mt-8 text-center text-sm">
          {checkoutAvailable
            ? "Payments are handled securely by Razorpay. Cancel anytime — you keep access until the end of your current billing period."
            : "Plans are stored on your account today so nothing changes for you when billing switches on for your region. Prices are set per region — not a live currency conversion."}
        </p>

        <div className="mt-14">
          <h2 className="font-display text-center text-xl font-semibold">Compare plans</h2>
          <div className="panel mt-6 overflow-x-auto p-0">
            <table className="w-full text-sm">
              <caption className="sr-only">Feature comparison across plans</caption>
              <thead>
                <tr className="border-border/70 border-b text-left text-xs text-muted-foreground">
                  <th className="px-5 py-3 font-medium">Feature</th>
                  <th className="px-5 py-3 text-center font-medium">Free</th>
                  <th className="px-5 py-3 text-center font-medium">Pro</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_ROWS.map((row) => (
                  <tr
                    key={row.label}
                    className="border-border/70 motion-safe:transition-colors motion-safe:hover:bg-muted/40 border-t"
                  >
                    <td className="px-5 py-3">{row.label}</td>
                    <td className="px-5 py-3 text-center">
                      {row.free ? (
                        <Check className="text-success mx-auto size-4" />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-center">
                      {row.pro ? (
                        <Check className="text-success mx-auto size-4" />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </MarketingPage>
  );
}
