import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, FileSearch, History, Loader2, X } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ResumeUpload } from "@/components/app/premium/resume-upload";
import { getSubscriptionStatus } from "@/lib/subscription.functions";
import { FEATURE_INFO } from "@/lib/subscription";
import { analyzeResume, getResumeAnalyses } from "@/lib/premium/resume-analysis.functions";
import type { ResumeAnalysisRow } from "@/lib/premium/resume-analysis.server";

export const Route = createFileRoute("/_authenticated/premium/resume-analysis")({
  head: () => ({
    meta: [{ title: "AI Resume Analysis — Rolisha" }, { name: "robots", content: "noindex" }],
  }),
  errorComponent: ({ error, reset }) => (
    <RouteErrorFallback
      error={error}
      reset={reset}
      routeId="premium-resume-analysis"
      title="Resume analysis unavailable"
      description="Please refresh to try again."
    />
  ),
  component: ResumeAnalysisPage,
});

function ResumeAnalysisPage() {
  const { data: subscription, isLoading: subLoading } = useQuery({
    queryKey: ["subscription-status"],
    queryFn: () => getSubscriptionStatus(),
  });

  if (subLoading) {
    return (
      <AppShell title="AI resume analysis" breadcrumb={[{ label: "AI Tools", to: "/premium" }]}>
        <div className="flex items-center justify-center py-16">
          <Loader2 className="text-muted-foreground size-6 animate-spin" />
        </div>
      </AppShell>
    );
  }

  if (subscription && !subscription.features.resume_analysis) {
    return (
      <AppShell title="AI resume analysis" breadcrumb={[{ label: "AI Tools", to: "/premium" }]}>
        <UpgradePrompt
          feature="resume_analysis"
          label={FEATURE_INFO.resume_analysis.label}
          description={FEATURE_INFO.resume_analysis.description}
          currentPlan={subscription.plan}
          requiredPlan="pro"
          implemented
        />
      </AppShell>
    );
  }

  return <ResumeAnalysisWorkspace />;
}

function ResumeAnalysisWorkspace() {
  const queryClient = useQueryClient();
  const [targetRole, setTargetRole] = useState("");
  const [resumeText, setResumeText] = useState("");
  const [result, setResult] = useState<ResumeAnalysisRow | null>(null);

  const historyQuery = useQuery({
    queryKey: ["resume-analyses"],
    queryFn: () => getResumeAnalyses(),
  });

  const mutation = useMutation({
    mutationFn: () => analyzeResume({ data: { targetRole, resumeText } }),
    onSuccess: (data) => {
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ["resume-analyses"] });
    },
    onError: (error: Error) =>
      showMutationError(error, error.message || "Could not analyze your resume."),
  });

  const canSubmit = targetRole.trim().length >= 2 && resumeText.trim().length >= 50;

  return (
    <AppShell
      title="AI resume analysis"
      breadcrumb={[{ label: "AI Tools", to: "/premium" }]}
      description="Paste your resume text and a target role to get a structured, honest assessment."
    >
      <div className="grid items-start gap-6 lg:grid-cols-[1fr_1.2fr]">
        <Reveal>
          <div className="panel flex flex-col gap-4 p-5">
            <div>
              <Label htmlFor="target-role">Target role</Label>
              <Input
                id="target-role"
                className="mt-1.5"
                placeholder="e.g. Data Analyst"
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
              />
            </div>
            <div className="flex flex-1 flex-col">
              <Label>Resume</Label>
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
                    id="resume-text"
                    className="min-h-56 flex-1"
                    placeholder="Paste the full text of your resume here…"
                    value={resumeText}
                    onChange={(e) => setResumeText(e.target.value)}
                  />
                </TabsContent>
              </Tabs>
              <p className="text-muted-foreground mt-1 text-xs">
                {resumeText.trim().length} characters (minimum 50)
              </p>
            </div>
            <Button
              className="mt-auto"
              disabled={!canSubmit || mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
              Analyze resume
            </Button>
          </div>
        </Reveal>

        <div className="space-y-4">
          {mutation.isPending && <AiStatusNotice status="pending" />}
          {!mutation.isPending && result && result.status === "failed" && (
            <AiStatusNotice
              status="failed"
              errorMessage={result.errorMessage}
              onRetry={() => mutation.mutate()}
            />
          )}
          {!mutation.isPending && result && result.status === "completed" && (
            <AnalysisResult result={result} />
          )}
          {!mutation.isPending && !result && (
            <EmptyState
              icon={FileSearch}
              title="No analysis yet"
              description="Fill in your target role and resume text, then run an analysis."
            />
          )}

          {historyQuery.data && historyQuery.data.length > 0 && (
            <Reveal>
              <div className="panel p-5">
                <h2 className="flex items-center gap-2 font-display text-sm font-semibold">
                  <History className="size-4" />
                  Past analyses
                </h2>
                <ul className="mt-3 space-y-2">
                  {historyQuery.data.slice(0, 5).map((row) => (
                    <li key={row.id}>
                      <button
                        type="button"
                        onClick={() => setResult(row)}
                        className="hover:bg-muted flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm"
                      >
                        <span className="truncate">{row.targetRole}</span>
                        {row.status === "completed" ? (
                          <Badge variant="outline">{row.overallScore}%</Badge>
                        ) : (
                          <Badge variant="outline" className="text-destructive">
                            Failed
                          </Badge>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function AnalysisResult({ result }: { result: ResumeAnalysisRow }) {
  return (
    <Reveal className="space-y-4">
      <div className="panel grid grid-cols-2 gap-4 p-5 sm:grid-cols-4">
        <ScoreTile label="Overall score" value={result.overallScore} />
        <ScoreTile label="ATS readability" value={result.atsScore} />
      </div>
      {result.atsNotes && (
        <div className="panel p-5">
          <h3 className="text-sm font-semibold">ATS notes</h3>
          <p className="text-muted-foreground mt-1 text-sm">{result.atsNotes}</p>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <ListPanel
          title="Skills detected"
          items={result.skillsDetected}
          icon={Check}
          tone="success"
        />
        <ListPanel
          title="Missing skills"
          items={result.missingSkills}
          icon={X}
          tone="destructive"
        />
        <ListPanel title="Strengths" items={result.strengths} icon={Check} tone="success" />
        <ListPanel title="Weaknesses" items={result.weaknesses} icon={X} tone="destructive" />
      </div>
      <div className="panel space-y-3 p-5">
        {result.experienceRelevance && (
          <div>
            <h3 className="text-sm font-semibold">Experience relevance</h3>
            <p className="text-muted-foreground mt-1 text-sm">{result.experienceRelevance}</p>
          </div>
        )}
        {result.educationRelevance && (
          <div>
            <h3 className="text-sm font-semibold">Education relevance</h3>
            <p className="text-muted-foreground mt-1 text-sm">{result.educationRelevance}</p>
          </div>
        )}
        {result.jobDescriptionAlignment && (
          <div>
            <h3 className="text-sm font-semibold">Role alignment</h3>
            <p className="text-muted-foreground mt-1 text-sm">{result.jobDescriptionAlignment}</p>
          </div>
        )}
      </div>
      {result.keywordCoverage.length > 0 && (
        <div className="panel p-5">
          <h3 className="text-sm font-semibold">Keyword coverage</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {result.keywordCoverage.map((k, i) => (
              <Badge
                key={i}
                variant="outline"
                className={
                  k.covered
                    ? "text-success border-success/40"
                    : "text-destructive border-destructive/40"
                }
              >
                {k.covered ? <Check className="size-3" /> : <X className="size-3" />}
                {k.keyword}
              </Badge>
            ))}
          </div>
        </div>
      )}
      {result.recommendations.length > 0 && (
        <div className="panel p-5">
          <h3 className="text-sm font-semibold">Recommendations</h3>
          <ul className="mt-2 list-disc space-y-1.5 pl-4 text-sm">
            {result.recommendations.map((rec, i) => (
              <li key={i}>{rec}</li>
            ))}
          </ul>
        </div>
      )}
    </Reveal>
  );
}

function ScoreTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <p className="font-display text-2xl font-bold">{value}%</p>
      <p className="text-muted-foreground text-xs">{label}</p>
    </div>
  );
}

function ListPanel({
  title,
  items,
  icon: Icon,
  tone,
}: {
  title: string;
  items: string[];
  icon: typeof Check;
  tone: "success" | "destructive";
}) {
  return (
    <div className="panel flex h-full flex-col p-5">
      <h3 className="text-sm font-semibold">{title}</h3>
      {items.length === 0 ? (
        <p className="text-muted-foreground mt-2 text-sm">None identified.</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {items.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              <Icon
                className={`mt-0.5 size-3.5 shrink-0 ${tone === "success" ? "text-success" : "text-destructive"}`}
              />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
