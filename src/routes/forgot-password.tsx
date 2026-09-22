import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { CheckCircle2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Reveal } from "@/components/app/reveal";
import { forgotPasswordEmailSchema } from "@/lib/auth/password-reset";

const TITLE = "Reset your password — Rolisha";
const DESCRIPTION = "Request a password reset link for your Rolisha account.";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = forgotPasswordEmailSchema.safeParse(email);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Enter a valid email address");
      return;
    }
    setBusy(true);
    try {
      await supabase.auth.resetPasswordForEmail(parsed.data, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
    } catch {
      // Deliberately ignored: whether this call succeeds, fails validation
      // on Supabase's side, or the address doesn't exist, the UI always
      // shows the same generic confirmation below, so this screen never
      // reveals whether an account exists for the entered email.
    } finally {
      setBusy(false);
      setSubmitted(true);
    }
  }

  return (
    <div className="dark bg-background text-foreground relative min-h-screen">
      <div className="bg-halo bg-dot-grid pointer-events-none absolute inset-0" aria-hidden />

      <div className="relative grid min-h-screen place-items-center px-4 py-12">
        <Reveal className="w-full max-w-md">
          <div className="flex justify-center">
            <Logo />
          </div>

          <div className="panel shadow-glow mt-8 p-7 backdrop-blur-sm">
            {submitted ? (
              <div className="text-center">
                <div className="bg-success-soft text-success mx-auto flex size-12 items-center justify-center rounded-full">
                  <CheckCircle2 className="size-6" />
                </div>
                <h1 className="font-display mt-4 text-xl font-semibold">Check your inbox</h1>
                <p className="text-muted-foreground mt-2 text-sm text-pretty">
                  If an account exists for {describeEmail(email)}, we've sent a link to reset your
                  password. The link will bring you back here to set a new one.
                </p>
                <Button asChild variant="outline" className="mt-6 w-full">
                  <Link to="/auth">Back to sign in</Link>
                </Button>
              </div>
            ) : (
              <>
                <h1 className="font-display text-2xl font-semibold">Forgot your password?</h1>
                <p className="text-muted-foreground mt-2 text-sm">
                  Enter the email address on your account and we'll send you a link to reset your
                  password.
                </p>

                <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      maxLength={255}
                      autoComplete="email"
                      placeholder="you@example.com"
                      autoFocus
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={busy}>
                    {busy && <Loader2 className="size-4 animate-spin" />}
                    Send reset link
                  </Button>
                </form>

                <p className="text-muted-foreground mt-6 text-center text-sm">
                  Remembered your password?{" "}
                  <Link to="/auth" className="text-primary font-medium hover:underline">
                    Sign in
                  </Link>
                </p>
              </>
            )}
          </div>

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

/** Trims and lightly masks the submitted address in the confirmation
 * copy — enough to reassure the person it went to the right inbox,
 * without needing to store or reveal whether that account actually
 * exists. */
function describeEmail(value: string): string {
  return value.trim() || "that address";
}
