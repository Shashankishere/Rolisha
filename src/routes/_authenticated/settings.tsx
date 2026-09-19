import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Loader2 } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { RouteErrorFallback } from "@/components/app/route-error-fallback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubscriptionPanel } from "@/components/app/subscription-panel";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { currencySymbol, formatSalary, WORK_MODE_LABEL, type WorkMode } from "@/lib/domain";
import { deleteAccount, updateProfile } from "@/lib/settings.functions";
import { getWorkspace } from "@/lib/me.functions";
import { getSubscriptionStatus } from "@/lib/subscription.functions";
import { hasPasswordAuth, newPasswordSchema } from "@/lib/auth/password-reset";

const workspaceQuery = queryOptions({ queryKey: ["workspace"], queryFn: () => getWorkspace() });
const subscriptionQuery = queryOptions({
  queryKey: ["subscription-status"],
  queryFn: () => getSubscriptionStatus(),
});

export const Route = createFileRoute("/_authenticated/settings")({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(workspaceQuery),
      context.queryClient.ensureQueryData(subscriptionQuery),
    ]),
  head: () => ({
    meta: [{ title: "Settings — Rolisha" }, { name: "robots", content: "noindex" }],
  }),
  errorComponent: ({ error, reset }) => (
    <RouteErrorFallback
      error={error}
      reset={reset}
      routeId="settings"
      title="Settings unavailable"
      description="Please refresh to try again."
    />
  ),
  component: SettingsPage,
});

function SettingsPage() {
  const { data: workspace } = useSuspenseQuery(workspaceQuery);
  const { data: subscription } = useSuspenseQuery(subscriptionQuery);
  const { profile } = workspace;
  const queryClient = useQueryClient();

  const [fullName, setFullName] = useState(profile.fullName ?? "");
  const [targetRole, setTargetRole] = useState(profile.targetRole ?? "");
  const [hoursPerWeek, setHoursPerWeek] = useState(profile.hoursPerWeek);
  const [salaryTarget, setSalaryTarget] = useState(profile.salaryTarget?.toString() ?? "");
  const [country, setCountry] = useState(profile.country ?? "");
  const [city, setCity] = useState(profile.city ?? "");
  const [workMode, setWorkMode] = useState<WorkMode>(profile.workMode);

  const saveMutation = useMutation({
    mutationFn: () =>
      updateProfile({
        data: {
          fullName: fullName.trim(),
          targetRole: targetRole.trim(),
          hoursPerWeek,
          salaryTarget: salaryTarget.trim() ? Number(salaryTarget) : null,
          country: country.trim(),
          city: city.trim(),
          workMode,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspace"] });
      toast.success("Settings saved.");
    },
    onError: (error: Error) => toast.error(error.message || "Could not save settings."),
  });

  return (
    <AppShell title="Settings" description="Manage your account and career preferences.">
      <div className="space-y-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveMutation.mutate();
          }}
          className="space-y-5"
        >
          <section className="panel hover-lift space-y-4 p-6">
            <h2 className="font-display text-lg font-semibold">Account</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full name</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  maxLength={100}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" value={profile.email ?? ""} disabled readOnly />
                <p className="text-muted-foreground text-xs">
                  Email changes go through Supabase's confirmation flow and aren't editable here
                  yet.
                </p>
              </div>
            </div>
          </section>

          <section className="panel hover-lift space-y-4 p-6">
            <div className="space-y-1">
              <h2 className="font-display text-lg font-semibold">Career preferences</h2>
              <p className="text-muted-foreground text-sm">
                These feed your roadmap and job matching. Changing them here doesn't rebuild your
                roadmap automatically; use "Regenerate" on the Roadmap page if you want it
                recalculated.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="targetRole">Target role</Label>
                <Input
                  id="targetRole"
                  value={targetRole}
                  maxLength={120}
                  onChange={(e) => setTargetRole(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hours">Hours available per week</Label>
                <Input
                  id="hours"
                  type="number"
                  min={1}
                  max={40}
                  value={hoursPerWeek}
                  onChange={(e) => setHoursPerWeek(Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="salaryTarget">Target salary (per year)</Label>
                {/*
                  Natural typing: this input's `value` is bound straight to
                  the raw text the user typed (`salaryTarget` state) and is
                  NEVER reformatted -- so typing "5", "50", "500" ... never
                  gets rewritten mid-keystroke into "₹5", "₹50", "₹5,00,000"
                  the way the old Jobs Explorer salary filter used to (see
                  salary-input.ts's doc comment for that regression). The
                  live ₹/LPA preview below is a SEPARATE read-only element,
                  not fed back into the input, so it can update on every
                  keystroke without disturbing what's being typed or the
                  cursor position.
                */}
                <div className="relative">
                  <span
                    aria-hidden="true"
                    className="text-muted-foreground pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm"
                  >
                    {currencySymbol(profile.salaryCurrency)}
                  </span>
                  <Input
                    id="salaryTarget"
                    type="number"
                    min={0}
                    placeholder="Optional"
                    value={salaryTarget}
                    onChange={(e) => setSalaryTarget(e.target.value)}
                    className="pl-7"
                  />
                </div>
                {salaryTarget.trim() && !Number.isNaN(Number(salaryTarget)) && (
                  <p className="text-muted-foreground text-xs">
                    {profile.salaryCurrency === "INR"
                      ? formatSalary(Number(salaryTarget), profile.salaryCurrency)
                      : `${formatSalary(Number(salaryTarget), profile.salaryCurrency)} per year`}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="workmode">Work preference</Label>
                <select
                  id="workmode"
                  className="border-input bg-transparent dark:bg-white/[0.04] text-foreground h-9 w-full rounded-md border px-3 text-sm shadow-sm"
                  value={workMode}
                  onChange={(e) => setWorkMode(e.target.value as WorkMode)}
                >
                  {Object.entries(WORK_MODE_LABEL).map(([value, label]) => (
                    <option
                      className="bg-popover text-popover-foreground"
                      key={value}
                      value={value}
                    >
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <Input
                  id="country"
                  value={country}
                  maxLength={80}
                  onChange={(e) => setCountry(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={city}
                  maxLength={80}
                  onChange={(e) => setCity(e.target.value)}
                />
              </div>
            </div>
          </section>

          <div className="flex justify-end">
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="size-4 animate-spin" />}
              Save changes
            </Button>
          </div>
        </form>

        <ChangePasswordSection email={profile.email} />

        <SubscriptionPanel status={subscription} />

        <DangerZone email={profile.email} />
      </div>
    </AppShell>
  );
}

/**
 * Security > Password. Only rendered as an active form for a user who
 * actually has an email/password identity (see `hasPasswordAuth`) --
 * someone who signed up exclusively through Google sees an explanatory
 * note instead of a form that assumes a password already exists. Confirms
 * the current password by re-authenticating with it (Supabase Auth has no
 * separate "verify current password" call) before calling the one
 * supported password-update path, `supabase.auth.updateUser({ password })`
 * -- the same call `reset-password.tsx` already uses. The password itself
 * never touches the server (Supabase Auth handles it client-side over
 * HTTPS) and is never logged.
 */
function ChangePasswordSection({ email }: { email: string | null }) {
  const { user } = useAuth();
  const canChangePassword = Boolean(user && hasPasswordAuth(user));

  const [open, setOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);

  function reset() {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!email) {
      toast.error("Your account has no email on file, so your password can't be verified.");
      return;
    }
    if (!currentPassword) {
      toast.error("Enter your current password.");
      return;
    }
    const parsed = newPasswordSchema.safeParse({ password: newPassword, confirmPassword });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Check your new password.");
      return;
    }

    setBusy(true);
    try {
      // Verify the current password by re-authenticating with it -- this
      // never signs the user out or drops their existing session; it just
      // confirms the credential and refreshes the same session's tokens,
      // exactly like typing your password again on the sign-in form would.
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      });
      if (verifyError) {
        toast.error("Current password is incorrect.");
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: parsed.data.password,
      });
      if (updateError) throw updateError;

      toast.success("Password updated.");
      reset();
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update your password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel hover-lift space-y-4 p-6">
      <div className="space-y-1">
        <h2 className="font-display text-lg font-semibold">Security</h2>
        <p className="text-muted-foreground text-sm">Password</p>
      </div>

      {!canChangePassword ? (
        <p className="text-muted-foreground text-sm">
          You signed in with Google, so there's no Rolisha password to change here. Manage your
          password through your Google Account instead.
        </p>
      ) : !open ? (
        <div>
          <p className="text-muted-foreground mb-3 text-sm">Change your account password.</p>
          <Button type="button" variant="outline" onClick={() => setOpen(true)}>
            Change Password
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="max-w-sm space-y-4">
          <div className="space-y-2">
            <Label htmlFor="currentPassword">Current password</Label>
            <Input
              id="currentPassword"
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="newPassword">New password</Label>
            <Input
              id="newPassword"
              type="password"
              required
              minLength={8}
              maxLength={72}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmNewPassword">Confirm new password</Label>
            <Input
              id="confirmNewPassword"
              type="password"
              required
              minLength={8}
              maxLength={72}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              Update password
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => {
                reset();
                setOpen(false);
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}

function DangerZone({ email }: { email: string | null }) {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const deleteMutation = useMutation({
    mutationFn: () => deleteAccount({ data: { confirmEmail: confirmText.trim() } }),
    onSuccess: async () => {
      toast.success("Your account has been deleted.");
      await signOut();
      navigate({ to: "/" });
    },
    onError: (error: Error) => toast.error(error.message || "Could not delete your account."),
  });

  return (
    <section className="border-destructive/40 bg-destructive/5 rounded-2xl border p-6">
      <div className="flex items-start gap-3">
        <AlertTriangle className="text-destructive mt-0.5 size-5 shrink-0" />
        <div>
          <h2 className="font-display text-lg font-semibold">Danger zone</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Deleting your account permanently removes your profile, roadmap, saved jobs, and all
            other data. This can't be undone.
          </p>
        </div>
      </div>

      {!confirming ? (
        <Button variant="destructive" className="mt-4" onClick={() => setConfirming(true)}>
          Delete my account
        </Button>
      ) : (
        <div className="mt-4 space-y-3">
          <Label htmlFor="confirmEmail">
            Type <span className="font-semibold">{email}</span> to confirm
          </Label>
          <Input
            id="confirmEmail"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={email ?? ""}
          />
          <div className="flex gap-2">
            <Button
              variant="destructive"
              disabled={
                confirmText.trim().toLowerCase() !== email?.toLowerCase() ||
                deleteMutation.isPending
              }
              onClick={() => deleteMutation.mutate()}
            >
              {deleteMutation.isPending && <Loader2 className="size-4 animate-spin" />}
              Permanently delete
            </Button>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
