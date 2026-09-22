import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { CheckCircle2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Reveal } from "@/components/app/reveal";
import { newPasswordSchema } from "@/lib/auth/password-reset";

const TITLE = "Set a new password — Rolisha";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [{ title: TITLE }, { name: "robots", content: "noindex" }],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = newPasswordSchema.safeParse({ password, confirmPassword });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Check your new password");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
      if (error) throw error;
      setDone(true);
      toast.success("Password updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update your password.");
    } finally {
      setBusy(false);
    }
  }

  const content = loading ? (
    <div className="flex items-center justify-center py-6">
      <Loader2 className="text-muted-foreground size-6 animate-spin" />
    </div>
  ) : done ? (
    <div className="text-center">
      <div className="bg-success-soft text-success mx-auto flex size-12 items-center justify-center rounded-full">
        <CheckCircle2 className="size-6" />
      </div>
      <h1 className="font-display mt-4 text-xl font-semibold">Password updated</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        Your password has been changed. You can now sign in with your new password.
      </p>
      <Button className="mt-6 w-full" onClick={() => navigate({ to: "/auth" })}>
        Continue to sign in
      </Button>
    </div>
  ) : session ? (
    <>
      <h1 className="font-display text-2xl font-semibold">Set a new password</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        Choose a new password for your account. It must be at least 8 characters.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="password">New password</Label>
          <Input
            id="password"
            type="password"
            required
            minLength={8}
            maxLength={72}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            autoFocus
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm new password</Label>
          <Input
            id="confirmPassword"
            type="password"
            required
            minLength={8}
            maxLength={72}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
          />
        </div>
        <Button type="submit" className="w-full" disabled={busy}>
          {busy && <Loader2 className="size-4 animate-spin" />}
          Update password
        </Button>
      </form>
    </>
  ) : (
    <div className="text-center">
      <h1 className="font-display text-xl font-semibold">This link has expired</h1>
      <p className="text-muted-foreground mt-2 text-sm text-pretty">
        Password reset links are only valid for a short time and can only be used once. Request a
        new one to continue.
      </p>
      <Button asChild className="mt-6 w-full">
        <Link to="/forgot-password">Request a new link</Link>
      </Button>
    </div>
  );

  return (
    <div className="dark bg-background text-foreground relative min-h-screen">
      <div className="bg-halo bg-dot-grid pointer-events-none absolute inset-0" aria-hidden />

      <div className="relative grid min-h-screen place-items-center px-4 py-12">
        <Reveal className="w-full max-w-md">
          <div className="flex justify-center">
            <Logo />
          </div>

          <div className="panel shadow-glow mt-8 p-7 backdrop-blur-sm">{content}</div>

          <p className="text-muted-foreground mt-6 text-center text-sm">
            <Link to="/" className="hover:text-foreground">
              Back to home
            </Link>
          </p>
        </Reveal>
      </div>
    </div>
  );
}
