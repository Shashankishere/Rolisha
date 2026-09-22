import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { FileText, Loader2 } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { RouteErrorFallback } from "@/components/app/route-error-fallback";
import { Reveal } from "@/components/app/reveal";
import { EmptyState } from "@/components/app/empty-state";
import { UpgradePrompt, showMutationError } from "@/components/app/upgrade-prompt";
import { AiStatusNotice } from "@/components/app/premium/ai-status-notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ResumeUpload } from "@/components/app/premium/resume-upload";
import { getSubscriptionStatus } from "@/lib/subscription.functions";
import { FEATURE_INFO } from "@/lib/subscription";
import { optimizeResume } from "@/lib/premium/resume-optimization.functions";
import type { ResumeOptimizationRow } from "@/lib/premium/resume-optimization.server";

export const Route = createFileRoute("/_authenticated/premium/resume-optimization")({
  head: () => ({
    meta: [{ title: "Resume Optimization — Rolisha" }, { name: "robots", content: "noindex" }],
  }),
  errorComponent: ({ error, reset }) => (
    <RouteErrorFallback
      error={error}
      reset={reset}
      routeId="premium-resume-optimization"
      title="Resume optimization unavailable"
      description="Please refresh to try again."
    />
  ),
  component: Page,
});

function Page() {
  const { data: subscription, isLoading } = useQuery({
    queryKey: ["subscription-status"],
    queryFn: () => getSubscriptionStatus(),
  });

  if (isLoading) {
    return (
      <AppShell title="Resume optimization" breadcrumb={[{ label: "AI Tools", to: "/premium" }]}>
        <div className="flex items-center justify-center py-16">
          <Loader2 className="text-muted-foreground size-6 animate-spin" />
        </div>
      </AppShell>
    );
  }

  if (subscription && !subscription.features.resume_optimization) {
    return (
      <AppShell title="Resume optimization" breadcrumb={[{ label: "AI Tools", to: "/premium" }]}>
        <UpgradePrompt
          feature="resume_optimization"
          label={FEATURE_INFO.resume_optimization.label}
          description={FEATURE_INFO.resume_optimization.description}
          currentPlan={subscription.plan}
          requiredPlan="pro"
          implemented
        />
      </AppShell>
    );
  }

  return <Workspace />;
}

function Workspace() {
  const [targetRole, setTargetRole] = useState("");
  const [resumeText, setResumeText] = useState("");
  const [result, setResult] = useState<ResumeOptimizationRow | null>(null);

  const mutation = useMutation({
    mutationFn: () => optimizeResume({ data: { targetRole, resumeText } }),
    onSuccess: setResult,
    onError: (error: Error) =>
      showMutationError(error, error.message || "Could not optimize your resume."),
  });

  const canSubmit = targetRole.trim().length >= 2 && resumeText.trim().length >= 50;

  return (
    <AppShell
      title="Resume optimization"
      breadcrumb={[{ label: "AI Tools", to: "/premium" }]}
      description="Weak sections are rewritten for review — current vs. recommended, side by side. Nothing is applied automatically."
    >
      <div className="grid items-start gap-6 lg:grid-cols-[1fr_1.2fr]">
        <Reveal>
          <div className="panel flex flex-col gap-4 p-5">
            <div>
              <Label htmlFor="opt-target-role">Target role</Label>
              <Input
                id="opt-target-role"
                className="mt-1.5"
                placeholder="e.g. Product Manager"
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
              />
            </div>
            <div className="flex flex-1 flex-col">
              <Label>Current resume</Label>
              <Tabs defaultValue="upload" className="mt-1.5 flex flex-1 flex-col">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="upload">Upload file</TabsTrigger>
                  <TabsTrigger value="paste">Paste text</TabsTrigger>
                </TabsList>
                <TabsContent value="upload" className="mt-3 flex-1">
                  <ResumeUpload onExtracted={setResumeText} />
                </TabsContent>
                <TabsContent value="paste" className="mt-3 flex flex-1 flex-col">
                  <Textarea
                    id="opt-resume-text"
                    className="min-h-56 flex-1"
                    placeholder="Paste your current resume text…"
                    value={resumeText}
                    onChange={(e) => setResumeText(e.target.value)}
                  />
                </TabsContent>
              </Tabs>
              <p className="text-muted-foreground mt-1 text-xs">
                {resumeText.trim().length} characters (minimum 50)
              </p>
            </div>
            <Button disabled={!canSubmit || mutation.isPending} onClick={() => mutation.mutate()}>
              {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
              Optimize resume
            </Button>
          </div>
        </Reveal>

        <div className="space-y-4">
          {mutation.isPending && <AiStatusNotice status="pending" />}
          {!mutation.isPending && result?.status === "failed" && (
            <AiStatusNotice
              status="failed"
              errorMessage={result.errorMessage}
              onRetry={() => mutation.mutate()}
            />
          )}
          {!mutation.isPending && result?.status === "completed" && (
            <OptimizationResult result={result} />
          )}
          {!mutation.isPending && !result && (
            <EmptyState
              icon={FileText}
              title="No optimization yet"
              description="Fill in your target role and current resume, then generate suggestions."
            />
          )}
        </div>
      </div>
    </AppShell>
  );
}

function OptimizationResult({ result }: { result: ResumeOptimizationRow }) {
  return (
    <Reveal className="space-y-4">
      {result.summary && (
        <div className="panel p-5">
          <h3 className="text-sm font-semibold">Strategy</h3>
          <p className="text-muted-foreground mt-1 text-sm">{result.summary}</p>
        </div>
      )}
      {result.sections.map((section, i) => (
        <div key={i} className="panel flex h-full flex-col gap-3 p-5">
          <h3 className="text-sm font-semibold">{section.sectionName}</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="bg-muted/40 flex flex-col rounded-lg p-3">
              <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Current
              </span>
              <p className="mt-1.5 text-sm whitespace-pre-wrap">{section.currentText}</p>
            </div>
            <div className="bg-primary-soft/60 flex flex-col rounded-lg p-3">
              <span className="text-primary text-xs font-medium tracking-wide uppercase">
                Recommended
              </span>
              <p className="mt-1.5 text-sm whitespace-pre-wrap">{section.recommendedText}</p>
            </div>
          </div>
          {section.rationale && (
            <p className="text-muted-foreground text-xs">{section.rationale}</p>
          )}
        </div>
      ))}
      {result.keywordImprovements.length > 0 && (
        <div className="panel p-5">
          <h3 className="text-sm font-semibold">Keywords worth adding</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {result.keywordImprovements.map((k, i) => (
              <span key={i} className="bg-muted rounded-full px-2.5 py-1 text-xs">
                {k}
              </span>
            ))}
          </div>
        </div>
      )}
    </Reveal>
  );
}
