import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PLAN_LABEL, parseUpgradeError, type Feature, type PlanTier } from "@/lib/subscription";

interface UpgradePromptProps {
  feature: Feature;
  label: string;
  description: string;
  currentPlan: PlanTier;
  requiredPlan: PlanTier;
  implemented: boolean;
  onClose?: () => void;
  className?: string;
}

/**
 * Shown wherever a Pro-gated feature is locked. Honest by construction:
 * if the feature isn't actually built (implemented === false) it never says
 * "Available with <plan>" or "Coming soon" -- both would suggest something
 * usable, or imminent, behind a gate that has nothing behind it. It says
 * "Not available yet" instead. No feature is in that state today.
 */
export function UpgradePrompt({
  label,
  description,
  currentPlan,
  requiredPlan,
  implemented,
  onClose,
  className,
}: UpgradePromptProps) {
  return (
    <div className={`panel space-y-4 p-6 text-center ${className ?? ""}`}>
      <div className="mx-auto flex size-11 items-center justify-center rounded-full bg-primary-soft text-primary">
        <Lock className="size-5" />
      </div>
      <div>
        <h3 className="font-display text-lg font-semibold">{label}</h3>
        <p className="text-muted-foreground mt-1 text-sm">{description}</p>
      </div>
      <div className="flex items-center justify-center gap-2 text-sm">
        <Badge variant="outline">Current: {PLAN_LABEL[currentPlan]}</Badge>
        <Badge>
          {implemented ? `Available with ${PLAN_LABEL[requiredPlan]}` : "Not available yet"}
        </Badge>
      </div>
      <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
        <Button asChild>
          <Link to="/pricing">
            <Sparkles className="size-4" />
            {implemented ? `Upgrade to ${PLAN_LABEL[requiredPlan]}` : "See plans"}
          </Link>
        </Button>
        {onClose && (
          <Button variant="ghost" onClick={onClose}>
            Back
          </Button>
        )}
      </div>
    </div>
  );
}

/** Small inline badge for locked list items / section headers — doesn't
 * take over the page like the full UpgradePrompt. */
export function LockedBadge({
  requiredPlan,
  implemented,
}: {
  requiredPlan: PlanTier;
  implemented: boolean;
}) {
  return (
    <Badge variant="outline" className="gap-1 text-xs">
      <Lock className="size-3" />
      {implemented ? PLAN_LABEL[requiredPlan] : "Not available yet"}
    </Badge>
  );
}

/**
 * Shows the right error toast for a caught mutation error: a rich,
 * actionable "upgrade required" toast (with a link to /pricing) when the
 * error came from a server-side plan gate, or a plain fallback message for
 * everything else. Every mutation that can hit a real plan limit (starting
 * a project, completing a lesson, attempting an assessment, adding a
 * second career roadmap, ...) should route its `onError` through this
 * instead of a generic toast, so hitting a limit reads as "upgrade to do
 * more" rather than a confusing failure.
 */
export function showMutationError(error: unknown, fallbackMessage: string) {
  const message = error instanceof Error ? error.message : undefined;
  const info = parseUpgradeError(message);
  if (info) {
    toast.error(info.message, {
      action: {
        label: `Upgrade to ${PLAN_LABEL[info.requiredPlan]}`,
        onClick: () => {
          window.location.assign("/pricing");
        },
      },
    });
    return;
  }
  toast.error(fallbackMessage);
}
