import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { queryOptions, useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/app/app-shell";
import { RouteErrorFallback } from "@/components/app/route-error-fallback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { listCareers, listSkills } from "@/lib/catalog.functions";
import { completeOnboarding } from "@/lib/me.functions";
import {
  EDUCATION_LABEL,
  EXPERIENCE_LABEL,
  PROFICIENCY_LABEL,
  WORK_MODE_LABEL,
  type EducationLevel,
  type ExperienceLevel,
  type ProficiencyLevel,
  type WorkMode,
} from "@/lib/domain";

const onboardingQuery = queryOptions({
  queryKey: ["onboarding-catalog"],
  queryFn: async () => ({ careers: await listCareers(), skills: await listSkills() }),
});

export const Route = createFileRoute("/_authenticated/onboarding")({
  loader: ({ context }) => context.queryClient.ensureQueryData(onboardingQuery),
  head: () => ({
    meta: [{ title: "Set up your roadmap — Rolisha" }, { name: "robots", content: "noindex" }],
  }),
  errorComponent: ({ error, reset }) => (
    <RouteErrorFallback
      error={error}
      reset={reset}
      routeId="onboarding"
      title="Setup unavailable"
      description="Please refresh to try again."
    />
  ),
  component: OnboardingPage,
});

const LEVELS: ProficiencyLevel[] = ["none", "beginner", "intermediate", "advanced", "expert"];

function OnboardingPage() {
  const { data } = useSuspenseQuery(onboardingQuery);
  const navigate = useNavigate();

  const [careerId, setCareerId] = useState<string>(data.careers[0]?.id ?? "");
  const [targetRole, setTargetRole] = useState<string>(data.careers[0]?.title ?? "");
  const [educationLevel, setEducationLevel] = useState<EducationLevel>("bachelors");
  const [fieldOfStudy, setFieldOfStudy] = useState("");
  const [experience, setExperience] = useState<ExperienceLevel>("none");
  const [hoursPerWeek, setHoursPerWeek] = useState(10);
  const [workMode, setWorkMode] = useState<WorkMode>("any");
  const [country, setCountry] = useState("");
  const [levels, setLevels] = useState<Record<string, ProficiencyLevel>>({});

  const save = useMutation({
    mutationFn: () =>
      completeOnboarding({
        data: {
          careerId: careerId || null,
          targetRole: targetRole.trim(),
          educationLevel,
          fieldOfStudy: fieldOfStudy.trim() || undefined,
          experience,
          hoursPerWeek,
          workMode,
          country: country.trim() || undefined,
          skills: Object.entries(levels)
            .filter(([, level]) => level !== "none")
            .map(([skillId, level]) => ({ skillId, level })),
        },
      }),
    onSuccess: () => {
      toast.success("Your roadmap is ready.");
      navigate({ to: "/dashboard" });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not save your answers."),
  });

  return (
    <AppShell
      title="Set up your roadmap"
      description="Eight questions. Everything here feeds the skill gap analysis and your six month plan."
    >
      <form
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <section className="panel grid gap-4 p-6 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="career">Target career path</Label>
            <select
              id="career"
              className="border-input bg-transparent dark:bg-white/[0.04] text-foreground h-10 w-full rounded-lg border px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={careerId}
              onChange={(e) => {
                setCareerId(e.target.value);
                const found = data.careers.find((c) => c.id === e.target.value);
                if (found) setTargetRole(found.title);
              }}
            >
              {data.careers.map((career) => (
                <option
                  className="bg-popover text-popover-foreground"
                  key={career.id}
                  value={career.id}
                >
                  {career.title}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="role">Target role title</Label>
            <Input
              id="role"
              value={targetRole}
              maxLength={120}
              onChange={(e) => setTargetRole(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="education">Education level</Label>
            <select
              id="education"
              className="border-input bg-transparent dark:bg-white/[0.04] text-foreground h-10 w-full rounded-lg border px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={educationLevel}
              onChange={(e) => setEducationLevel(e.target.value as EducationLevel)}
            >
              {Object.entries(EDUCATION_LABEL).map(([value, label]) => (
                <option className="bg-popover text-popover-foreground" key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="field">Field of study</Label>
            <Input
              id="field"
              value={fieldOfStudy}
              maxLength={120}
              onChange={(e) => setFieldOfStudy(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="experience">Experience</Label>
            <select
              id="experience"
              className="border-input bg-transparent dark:bg-white/[0.04] text-foreground h-10 w-full rounded-lg border px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={experience}
              onChange={(e) => setExperience(e.target.value as ExperienceLevel)}
            >
              {Object.entries(EXPERIENCE_LABEL).map(([value, label]) => (
                <option className="bg-popover text-popover-foreground" key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
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
            <Label htmlFor="workmode">Work preference</Label>
            <select
              id="workmode"
              className="border-input bg-transparent dark:bg-white/[0.04] text-foreground h-10 w-full rounded-lg border px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={workMode}
              onChange={(e) => setWorkMode(e.target.value as WorkMode)}
            >
              {Object.entries(WORK_MODE_LABEL).map(([value, label]) => (
                <option className="bg-popover text-popover-foreground" key={value} value={value}>
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
        </section>

        <section className="panel p-6">
          <h2 className="text-base font-semibold">Your current skills</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Set a level for anything you already know. Leave the rest at “None”.
          </p>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {data.skills.map((skill) => (
              <li key={skill.id} className="flex items-center justify-between gap-3">
                <Label htmlFor={`skill-${skill.id}`} className="truncate text-sm font-normal">
                  {skill.name}
                </Label>
                <select
                  id={`skill-${skill.id}`}
                  className="border-input bg-transparent dark:bg-white/[0.04] text-foreground h-9 w-36 shrink-0 rounded-lg border px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={levels[skill.id] ?? "none"}
                  onChange={(e) =>
                    setLevels((prev) => ({
                      ...prev,
                      [skill.id]: e.target.value as ProficiencyLevel,
                    }))
                  }
                >
                  {LEVELS.map((level) => (
                    <option
                      className="bg-popover text-popover-foreground"
                      key={level}
                      value={level}
                    >
                      {PROFICIENCY_LABEL[level]}
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
        </section>

        <Button type="submit" size="lg" disabled={save.isPending}>
          {save.isPending ? "Building your roadmap…" : "Build my roadmap"}
        </Button>
      </form>
    </AppShell>
  );
}
