import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Reveal } from "@/components/app/reveal";

const TITLE = "Sign in to Rolisha";
const DESCRIPTION =
  "Create your Rolisha account to get a skill gap analysis, readiness score and personalised six month career roadmap.";

const searchSchema = z.object({
  mode: z.enum(["login", "signup"]).optional(),
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

const credentialsSchema = z.object({
  email: z.string().trim().email("Enter a valid email address").max(255),
  password: z.string().min(8, "Password must be at least 8 characters").max(72),
});

function safePath(value: string | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  return value;
}

function AuthPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  const [mode, setMode] = useState<"login" | "signup">(search.mode ?? "login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const destination = safePath(search.redirect);

  useEffect(() => {
    if (!loading && user) navigate({ to: destination });
  }, [loading, user, destination, navigate]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = credentialsSchema.safeParse({ email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Check your details");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: {
            emailRedirectTo: `${window.location.origin}${destination}`,
            data: { full_name: fullName.trim().slice(0, 100) },
          },
        });
        if (error) throw error;
        // Supabase only returns a session immediately when email confirmation
        // is turned off for this project; when it's required, `session` is
        // null until the user clicks the confirmation link. Branch on the
        // real response so the message is never a guess.
        toast.success(
          data.session
            ? "Account created. Welcome to Rolisha."
            : "Please confirm your account. Check your inbox for the confirmation email.",
        );
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: parsed.data.email,
          password: parsed.data.password,
        });
        if (error) throw error;
        toast.success("Welcome back");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setBusy(true);
    try {
      // supabase-js redirects the whole page to Google, then Google redirects
      // back to `redirectTo` with the session already established. There is
      // no local success branch to navigate from here.
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}${destination}`,
        },
      });
      if (error) {
        toast.error("Google sign in failed. Please try again.");
        setBusy(false);
      }
      // On success the browser navigates away, so don't reset `busy` here.
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Google sign in failed. Please try again.",
      );
      setBusy(false);
    }
  }

  return (
    <div className="dark bg-background text-foreground relative min-h-screen">
      {/* Premium dark backdrop: brand-color halo glow + faint dot grid, both
          purely decorative (aria-hidden) and static — no motion here, so
          there's nothing for prefers-reduced-motion to need to disable. */}
      <div className="bg-halo bg-dot-grid pointer-events-none absolute inset-0" aria-hidden />

      <div className="relative grid min-h-screen place-items-center px-4 py-12">
        <Reveal className="w-full max-w-md">
          <div className="flex justify-center">
            <Logo />
          </div>

          <div className="panel shadow-glow mt-8 p-7 backdrop-blur-sm">
            <h1 className="font-display text-2xl font-semibold">
              {mode === "signup" ? "Create your account" : "Welcome back"}
            </h1>
            <p className="text-muted-foreground mt-2 text-sm">
              {mode === "signup"
                ? "Answer a few questions and get your skill gap, readiness score and six month roadmap."
                : "Sign in to continue your roadmap."}
            </p>

            <Button
              type="button"
              variant="secondary"
              className="border-border bg-surface-strong hover:bg-card hover:border-foreground/30 focus-visible:ring-ring mt-6 w-full border transition-colors"
              onClick={handleGoogle}
              disabled={busy}
            >
              <GoogleIcon className="size-4" />
              Continue with Google
            </Button>

            <div className="text-muted-foreground my-6 flex items-center gap-3 text-xs">
              <span className="bg-border h-px flex-1" />
              or use email
              <span className="bg-border h-px flex-1" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "signup" && (
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full name</Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    maxLength={100}
                    autoComplete="name"
                    placeholder="Alex Rivera"
                  />
                </div>
              )}
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
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  {mode === "login" && (
                    <Link
                      to="/forgot-password"
                      className="text-primary text-xs font-medium hover:underline"
                    >
                      Forgot password?
                    </Link>
                  )}
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={8}
                    maxLength={72}
                    autoComplete={mode === "signup" ? "new-password" : "current-password"}
                    placeholder="At least 8 characters"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    aria-pressed={showPassword}
                    className="text-muted-foreground hover:text-foreground absolute inset-y-0 right-0 flex w-10 items-center justify-center"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy && <Loader2 className="size-4 animate-spin" />}
                {mode === "signup" ? "Create account" : "Sign in"}
              </Button>
            </form>

            <p className="text-muted-foreground mt-6 text-center text-sm">
              {mode === "signup" ? "Already have an account?" : "New to Rolisha?"}{" "}
              <button
                type="button"
                className="text-primary font-medium hover:underline"
                onClick={() => setMode(mode === "signup" ? "login" : "signup")}
              >
                {mode === "signup" ? "Sign in" : "Create one"}
              </button>
            </p>
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

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.28 1.48-1.13 2.73-2.4 3.58v2.98h3.89c2.27-2.09 3.53-5.17 3.53-8.8z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.07 7.93-2.9l-3.89-2.98c-1.08.72-2.45 1.15-4.04 1.15-3.11 0-5.74-2.1-6.68-4.92H1.3v3.07C3.27 21.3 7.31 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.32 14.35A7.2 7.2 0 0 1 4.92 12c0-.82.14-1.61.4-2.35V6.58H1.3A11.98 11.98 0 0 0 0 12c0 1.93.46 3.76 1.3 5.42z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.76 0 3.34.6 4.58 1.79l3.44-3.44C17.94 1.19 15.24 0 12 0 7.31 0 3.27 2.7 1.3 6.58l4.02 3.07C6.26 6.84 8.89 4.75 12 4.75z"
      />
    </svg>
  );
}
