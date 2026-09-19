import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useState } from "react";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { AdminAccessFallback } from "@/components/admin/admin-access-fallback";
import { AdminSubNav } from "@/components/admin/admin-sub-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  createAssessment,
  createProject,
  createResource,
  deleteAssessment,
  deleteProject,
  deleteResource,
  getAdminCatalog,
  updateAssessment,
  updateProject,
  updateResource,
} from "@/lib/admin.functions";
import type { AdminAssessmentRow, AdminProjectRow, AdminResourceRow } from "@/lib/admin.server";

function catalogQuery() {
  return queryOptions({
    queryKey: ["admin", "catalog"],
    queryFn: () => getAdminCatalog(),
  });
}

export const Route = createFileRoute("/_authenticated/admin/catalog")({
  loader: ({ context }) => context.queryClient.ensureQueryData(catalogQuery()),
  head: () => ({
    meta: [{ title: "Admin — Catalog — Rolisha" }, { name: "robots", content: "noindex" }],
  }),
  errorComponent: ({ error, reset }) => (
    <AdminAccessFallback
      error={error}
      reset={reset}
      routeId="admin.catalog"
      title="Admin: Catalog"
    />
  ),
  component: AdminCatalogPage,
});

function AdminCatalogPage() {
  const { data } = useSuspenseQuery(catalogQuery());

  return (
    <AppShell
      title="Admin: Catalog"
      description="Manage the learning resources, portfolio projects, and skill assessments used across the product."
    >
      <AdminSubNav />
      <Tabs defaultValue="resources">
        <TabsList className="w-full justify-start overflow-x-auto sm:w-auto">
          <TabsTrigger value="resources" className="shrink-0">
            Resources ({data.resources.length})
          </TabsTrigger>
          <TabsTrigger value="projects" className="shrink-0">
            Projects ({data.projects.length})
          </TabsTrigger>
          <TabsTrigger value="assessments" className="shrink-0">
            Assessments ({data.assessments.length})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="resources" className="mt-4">
          <ResourcesPanel resources={data.resources} />
        </TabsContent>
        <TabsContent value="projects" className="mt-4">
          <ProjectsPanel projects={data.projects} />
        </TabsContent>
        <TabsContent value="assessments" className="mt-4">
          <AssessmentsPanel assessments={data.assessments} />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

// =============================================================================
// RESOURCES
// =============================================================================

const RESOURCE_TYPES = ["documentation", "course", "video", "book", "practice", "project"] as const;

interface ResourceFormState {
  title: string;
  provider: string;
  url: string;
  type: (typeof RESOURCE_TYPES)[number];
  isFree: boolean;
  estimatedHours: string;
  description: string;
}

const EMPTY_RESOURCE_FORM: ResourceFormState = {
  title: "",
  provider: "",
  url: "",
  type: "documentation",
  isFree: true,
  estimatedHours: "",
  description: "",
};

function resourceToForm(r: AdminResourceRow): ResourceFormState {
  return {
    title: r.title,
    provider: r.provider ?? "",
    url: r.url,
    type: (r.type as (typeof RESOURCE_TYPES)[number]) ?? "documentation",
    isFree: r.isFree,
    estimatedHours: r.estimatedHours?.toString() ?? "",
    description: r.description ?? "",
  };
}

function resourceFormToPayload(form: ResourceFormState) {
  return {
    title: form.title.trim(),
    provider: form.provider.trim() || null,
    url: form.url.trim(),
    type: form.type,
    skillId: null,
    careerId: null,
    isFree: form.isFree,
    estimatedHours: form.estimatedHours.trim() ? Number(form.estimatedHours) : null,
    description: form.description.trim() || null,
  };
}

function ResourcesPanel({ resources }: { resources: AdminResourceRow[] }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AdminResourceRow | null>(null);
  const [form, setForm] = useState<ResourceFormState>(EMPTY_RESOURCE_FORM);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin", "catalog"] });

  const createMutation = useMutation({
    mutationFn: () => createResource({ data: resourceFormToPayload(form) }),
    onSuccess: () => {
      invalidate();
      toast.success("Resource added.");
      setDialogOpen(false);
    },
    onError: (error: Error) => toast.error(error.message || "Could not add this resource."),
  });

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!editing) throw new Error("No resource selected.");
      return updateResource({ data: { resourceId: editing.id, ...resourceFormToPayload(form) } });
    },
    onSuccess: () => {
      invalidate();
      toast.success("Resource updated.");
      setDialogOpen(false);
    },
    onError: (error: Error) => toast.error(error.message || "Could not update this resource."),
  });

  const deleteMutation = useMutation({
    mutationFn: (resourceId: string) => deleteResource({ data: { resourceId } }),
    onSuccess: () => {
      invalidate();
      toast.success("Resource deleted.");
    },
    onError: (error: Error) => toast.error(error.message || "Could not delete this resource."),
  });

  const isSaving = createMutation.isPending || updateMutation.isPending;

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_RESOURCE_FORM);
    setDialogOpen(true);
  }
  function openEdit(r: AdminResourceRow) {
    setEditing(r);
    setForm(resourceToForm(r));
    setDialogOpen(true);
  }
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editing) updateMutation.mutate();
    else createMutation.mutate();
  }

  const filtered = resources.filter((r) => r.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Input
          placeholder="Search resources…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}>
              <Plus className="size-4" />
              Add resource
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>{editing ? "Edit resource" : "Add resource"}</DialogTitle>
                <DialogDescription>
                  A learning link shown in the resource library — documentation, a course, a video,
                  etc.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-1.5">
                  <Label htmlFor="res-title">Title</Label>
                  <Input
                    id="res-title"
                    required
                    value={form.title}
                    onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="res-url">URL</Label>
                  <Input
                    id="res-url"
                    type="url"
                    required
                    value={form.url}
                    onChange={(e) => setForm((p) => ({ ...p, url: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <Label htmlFor="res-provider">Provider</Label>
                    <Input
                      id="res-provider"
                      value={form.provider}
                      onChange={(e) => setForm((p) => ({ ...p, provider: e.target.value }))}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Type</Label>
                    <Select
                      value={form.type}
                      onValueChange={(v) =>
                        setForm((p) => ({ ...p, type: v as ResourceFormState["type"] }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {RESOURCE_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="res-hours">Estimated hours</Label>
                  <Input
                    id="res-hours"
                    type="number"
                    min={0}
                    value={form.estimatedHours}
                    onChange={(e) => setForm((p) => ({ ...p, estimatedHours: e.target.value }))}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="res-free"
                    checked={form.isFree}
                    onCheckedChange={(checked) => setForm((p) => ({ ...p, isFree: checked }))}
                  />
                  <Label htmlFor="res-free">Free to access</Label>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="res-description">Description</Label>
                  <Textarea
                    id="res-description"
                    rows={3}
                    value={form.description}
                    onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={isSaving}>
                  {isSaving && <Loader2 className="size-4 animate-spin" />}
                  {editing ? "Save changes" : "Add resource"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="panel hover-lift overflow-x-auto p-0">
        <table className="w-full text-sm">
          <caption className="sr-only">Resources</caption>
          <thead>
            <tr className="border-border/70 border-b text-left text-xs text-muted-foreground">
              <th className="px-5 py-3 font-medium">Title</th>
              <th className="px-5 py-3 font-medium">Type</th>
              <th className="px-5 py-3 font-medium">Provider</th>
              <th className="px-5 py-3 font-medium">Free</th>
              <th className="px-5 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-border/70 border-t">
                <td className="px-5 py-3 font-medium">
                  <a href={r.url} target="_blank" rel="noreferrer" className="hover:underline">
                    {r.title}
                  </a>
                </td>
                <td className="px-5 py-3">
                  <Badge variant="outline">{r.type}</Badge>
                </td>
                <td className="text-muted-foreground px-5 py-3">{r.provider ?? "—"}</td>
                <td className="px-5 py-3">{r.isFree ? "Free" : "Paid"}</td>
                <td className="px-5 py-3">
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => openEdit(r)}>
                      <Pencil className="size-3.5" />
                      Edit
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="outline">
                          <Trash2 className="size-3.5" />
                          Delete
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete "{r.title}"?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This permanently removes the resource. This can't be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteMutation.mutate(r.id)}>
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="text-muted-foreground px-5 py-8 text-center text-sm">
                  No resources match "{search}".
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// =============================================================================
// PROJECTS
// =============================================================================

const DIFFICULTIES = ["beginner", "intermediate", "advanced"] as const;

interface ProjectFormState {
  slug: string;
  title: string;
  summary: string;
  difficulty: (typeof DIFFICULTIES)[number];
  estimatedHours: string;
  skills: string;
  requirements: string;
  datasetSuggestion: string;
  expectedOutput: string;
  readmeOutline: string;
  resumeBullet: string;
}

const EMPTY_PROJECT_FORM: ProjectFormState = {
  slug: "",
  title: "",
  summary: "",
  difficulty: "intermediate",
  estimatedHours: "12",
  skills: "",
  requirements: "",
  datasetSuggestion: "",
  expectedOutput: "",
  readmeOutline: "",
  resumeBullet: "",
};

function projectToForm(p: AdminProjectRow): ProjectFormState {
  return {
    slug: p.slug,
    title: p.title,
    summary: p.summary ?? "",
    difficulty: (p.difficulty as (typeof DIFFICULTIES)[number]) ?? "intermediate",
    estimatedHours: p.estimatedHours.toString(),
    skills: p.skills.join("\n"),
    requirements: p.requirements.join("\n"),
    datasetSuggestion: p.datasetSuggestion ?? "",
    expectedOutput: p.expectedOutput ?? "",
    readmeOutline: p.readmeOutline.join("\n"),
    resumeBullet: p.resumeBullet ?? "",
  };
}

function linesToArray(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

function projectFormToPayload(form: ProjectFormState) {
  return {
    slug: form.slug.trim(),
    title: form.title.trim(),
    summary: form.summary.trim() || null,
    difficulty: form.difficulty,
    estimatedHours: Number(form.estimatedHours) || 1,
    careerId: null,
    skills: linesToArray(form.skills),
    datasetSuggestion: form.datasetSuggestion.trim() || null,
    requirements: linesToArray(form.requirements),
    expectedOutput: form.expectedOutput.trim() || null,
    readmeOutline: linesToArray(form.readmeOutline),
    resumeBullet: form.resumeBullet.trim() || null,
  };
}

function ProjectsPanel({ projects }: { projects: AdminProjectRow[] }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AdminProjectRow | null>(null);
  const [form, setForm] = useState<ProjectFormState>(EMPTY_PROJECT_FORM);
  const [slugTouched, setSlugTouched] = useState(false);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin", "catalog"] });

  const createMutation = useMutation({
    mutationFn: () => createProject({ data: projectFormToPayload(form) }),
    onSuccess: () => {
      invalidate();
      toast.success("Project created.");
      setDialogOpen(false);
    },
    onError: (error: Error) => toast.error(error.message || "Could not create this project."),
  });

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!editing) throw new Error("No project selected.");
      return updateProject({ data: { projectId: editing.id, ...projectFormToPayload(form) } });
    },
    onSuccess: () => {
      invalidate();
      toast.success("Project updated.");
      setDialogOpen(false);
    },
    onError: (error: Error) => toast.error(error.message || "Could not update this project."),
  });

  const deleteMutation = useMutation({
    mutationFn: (projectId: string) => deleteProject({ data: { projectId } }),
    onSuccess: () => {
      invalidate();
      toast.success("Project deleted.");
    },
    onError: (error: Error) => toast.error(error.message || "Could not delete this project."),
  });

  const isSaving = createMutation.isPending || updateMutation.isPending;

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_PROJECT_FORM);
    setSlugTouched(false);
    setDialogOpen(true);
  }
  function openEdit(p: AdminProjectRow) {
    setEditing(p);
    setForm(projectToForm(p));
    setSlugTouched(true);
    setDialogOpen(true);
  }
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editing) updateMutation.mutate();
    else createMutation.mutate();
  }

  const filtered = projects.filter(
    (p) =>
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.slug.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Input
          placeholder="Search projects…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}>
              <Plus className="size-4" />
              Add project
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>{editing ? "Edit project" : "Add project"}</DialogTitle>
                <DialogDescription>
                  List fields (skills, requirements, readme outline) are one item per line.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-1.5">
                  <Label htmlFor="proj-title">Title</Label>
                  <Input
                    id="proj-title"
                    required
                    value={form.title}
                    onChange={(e) => {
                      const title = e.target.value;
                      setForm((p) => ({
                        ...p,
                        title,
                        slug: slugTouched
                          ? p.slug
                          : title
                              .toLowerCase()
                              .trim()
                              .replace(/[^a-z0-9]+/g, "-")
                              .replace(/(^-|-$)/g, ""),
                      }));
                    }}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="proj-slug">Slug</Label>
                  <Input
                    id="proj-slug"
                    required
                    pattern="[a-z0-9]+(-[a-z0-9]+)*"
                    value={form.slug}
                    onChange={(e) => {
                      setSlugTouched(true);
                      setForm((p) => ({ ...p, slug: e.target.value }));
                    }}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="proj-summary">Summary</Label>
                  <Textarea
                    id="proj-summary"
                    rows={2}
                    value={form.summary}
                    onChange={(e) => setForm((p) => ({ ...p, summary: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <Label>Difficulty</Label>
                    <Select
                      value={form.difficulty}
                      onValueChange={(v) =>
                        setForm((p) => ({ ...p, difficulty: v as ProjectFormState["difficulty"] }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DIFFICULTIES.map((d) => (
                          <SelectItem key={d} value={d}>
                            {d}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="proj-hours">Estimated hours</Label>
                    <Input
                      id="proj-hours"
                      type="number"
                      min={1}
                      required
                      value={form.estimatedHours}
                      onChange={(e) => setForm((p) => ({ ...p, estimatedHours: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="proj-skills">Skills (one per line)</Label>
                  <Textarea
                    id="proj-skills"
                    rows={3}
                    value={form.skills}
                    onChange={(e) => setForm((p) => ({ ...p, skills: e.target.value }))}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="proj-requirements">Requirements (one per line)</Label>
                  <Textarea
                    id="proj-requirements"
                    rows={4}
                    value={form.requirements}
                    onChange={(e) => setForm((p) => ({ ...p, requirements: e.target.value }))}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="proj-dataset">Dataset suggestion</Label>
                  <Input
                    id="proj-dataset"
                    value={form.datasetSuggestion}
                    onChange={(e) => setForm((p) => ({ ...p, datasetSuggestion: e.target.value }))}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="proj-output">Expected output</Label>
                  <Textarea
                    id="proj-output"
                    rows={2}
                    value={form.expectedOutput}
                    onChange={(e) => setForm((p) => ({ ...p, expectedOutput: e.target.value }))}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="proj-readme">README outline (one per line)</Label>
                  <Textarea
                    id="proj-readme"
                    rows={3}
                    value={form.readmeOutline}
                    onChange={(e) => setForm((p) => ({ ...p, readmeOutline: e.target.value }))}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="proj-resume">Resume bullet</Label>
                  <Input
                    id="proj-resume"
                    value={form.resumeBullet}
                    onChange={(e) => setForm((p) => ({ ...p, resumeBullet: e.target.value }))}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={isSaving}>
                  {isSaving && <Loader2 className="size-4 animate-spin" />}
                  {editing ? "Save changes" : "Create project"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="panel hover-lift overflow-x-auto p-0">
        <table className="w-full text-sm">
          <caption className="sr-only">Projects</caption>
          <thead>
            <tr className="border-border/70 border-b text-left text-xs text-muted-foreground">
              <th className="px-5 py-3 font-medium">Title</th>
              <th className="px-5 py-3 font-medium">Slug</th>
              <th className="px-5 py-3 font-medium">Difficulty</th>
              <th className="px-5 py-3 font-medium">Hours</th>
              <th className="px-5 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className="border-border/70 border-t">
                <td className="px-5 py-3 font-medium">{p.title}</td>
                <td className="text-muted-foreground px-5 py-3">{p.slug}</td>
                <td className="px-5 py-3">
                  <Badge variant="outline">{p.difficulty}</Badge>
                </td>
                <td className="px-5 py-3 tabular-nums">{p.estimatedHours}</td>
                <td className="px-5 py-3">
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => openEdit(p)}>
                      <Pencil className="size-3.5" />
                      Edit
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="outline">
                          <Trash2 className="size-3.5" />
                          Delete
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete "{p.title}"?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This is blocked if any user has already started this project (to avoid
                            wiping their progress). Otherwise it's permanent.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteMutation.mutate(p.id)}>
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="text-muted-foreground px-5 py-8 text-center text-sm">
                  No projects match "{search}".
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// =============================================================================
// ASSESSMENTS
// =============================================================================

interface AssessmentFormState {
  slug: string;
  title: string;
  difficulty: (typeof DIFFICULTIES)[number];
  description: string;
  passScore: string;
}

const EMPTY_ASSESSMENT_FORM: AssessmentFormState = {
  slug: "",
  title: "",
  difficulty: "beginner",
  description: "",
  passScore: "60",
};

function assessmentToForm(a: AdminAssessmentRow): AssessmentFormState {
  return {
    slug: a.slug,
    title: a.title,
    difficulty: (a.difficulty as (typeof DIFFICULTIES)[number]) ?? "beginner",
    description: a.description ?? "",
    passScore: a.passScore.toString(),
  };
}

function assessmentFormToPayload(form: AssessmentFormState) {
  return {
    slug: form.slug.trim(),
    title: form.title.trim(),
    skillId: null,
    difficulty: form.difficulty,
    description: form.description.trim() || null,
    passScore: Number(form.passScore) || 0,
  };
}

function AssessmentsPanel({ assessments }: { assessments: AdminAssessmentRow[] }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AdminAssessmentRow | null>(null);
  const [form, setForm] = useState<AssessmentFormState>(EMPTY_ASSESSMENT_FORM);
  const [slugTouched, setSlugTouched] = useState(false);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin", "catalog"] });

  const createMutation = useMutation({
    mutationFn: () => createAssessment({ data: assessmentFormToPayload(form) }),
    onSuccess: () => {
      invalidate();
      toast.success("Assessment created. Add questions via a migration/seed script.");
      setDialogOpen(false);
    },
    onError: (error: Error) => toast.error(error.message || "Could not create this assessment."),
  });

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!editing) throw new Error("No assessment selected.");
      return updateAssessment({
        data: { assessmentId: editing.id, ...assessmentFormToPayload(form) },
      });
    },
    onSuccess: () => {
      invalidate();
      toast.success("Assessment updated.");
      setDialogOpen(false);
    },
    onError: (error: Error) => toast.error(error.message || "Could not update this assessment."),
  });

  const deleteMutation = useMutation({
    mutationFn: (assessmentId: string) => deleteAssessment({ data: { assessmentId } }),
    onSuccess: () => {
      invalidate();
      toast.success("Assessment deleted.");
    },
    onError: (error: Error) => toast.error(error.message || "Could not delete this assessment."),
  });

  const isSaving = createMutation.isPending || updateMutation.isPending;

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_ASSESSMENT_FORM);
    setSlugTouched(false);
    setDialogOpen(true);
  }
  function openEdit(a: AdminAssessmentRow) {
    setEditing(a);
    setForm(assessmentToForm(a));
    setSlugTouched(true);
    setDialogOpen(true);
  }
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editing) updateMutation.mutate();
    else createMutation.mutate();
  }

  const filtered = assessments.filter(
    (a) =>
      a.title.toLowerCase().includes(search.toLowerCase()) ||
      a.slug.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-xs">
        This covers assessment metadata only — question editing isn't available in this UI yet;
        manage questions via a migration or seed script for now.
      </p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Input
          placeholder="Search assessments…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}>
              <Plus className="size-4" />
              Add assessment
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>{editing ? "Edit assessment" : "Add assessment"}</DialogTitle>
                <DialogDescription>
                  Creates the assessment shell. Questions are added separately (not yet supported in
                  this UI).
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-1.5">
                  <Label htmlFor="assess-title">Title</Label>
                  <Input
                    id="assess-title"
                    required
                    value={form.title}
                    onChange={(e) => {
                      const title = e.target.value;
                      setForm((p) => ({
                        ...p,
                        title,
                        slug: slugTouched
                          ? p.slug
                          : title
                              .toLowerCase()
                              .trim()
                              .replace(/[^a-z0-9]+/g, "-")
                              .replace(/(^-|-$)/g, ""),
                      }));
                    }}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="assess-slug">Slug</Label>
                  <Input
                    id="assess-slug"
                    required
                    pattern="[a-z0-9]+(-[a-z0-9]+)*"
                    value={form.slug}
                    onChange={(e) => {
                      setSlugTouched(true);
                      setForm((p) => ({ ...p, slug: e.target.value }));
                    }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <Label>Difficulty</Label>
                    <Select
                      value={form.difficulty}
                      onValueChange={(v) =>
                        setForm((p) => ({
                          ...p,
                          difficulty: v as AssessmentFormState["difficulty"],
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DIFFICULTIES.map((d) => (
                          <SelectItem key={d} value={d}>
                            {d}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="assess-pass">Pass score (%)</Label>
                    <Input
                      id="assess-pass"
                      type="number"
                      min={0}
                      max={100}
                      required
                      value={form.passScore}
                      onChange={(e) => setForm((p) => ({ ...p, passScore: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="assess-description">Description</Label>
                  <Textarea
                    id="assess-description"
                    rows={3}
                    value={form.description}
                    onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={isSaving}>
                  {isSaving && <Loader2 className="size-4 animate-spin" />}
                  {editing ? "Save changes" : "Create assessment"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="panel hover-lift overflow-x-auto p-0">
        <table className="w-full text-sm">
          <caption className="sr-only">Assessments</caption>
          <thead>
            <tr className="border-border/70 border-b text-left text-xs text-muted-foreground">
              <th className="px-5 py-3 font-medium">Title</th>
              <th className="px-5 py-3 font-medium">Slug</th>
              <th className="px-5 py-3 font-medium">Difficulty</th>
              <th className="px-5 py-3 font-medium">Questions</th>
              <th className="px-5 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((a) => (
              <tr key={a.id} className="border-border/70 border-t">
                <td className="px-5 py-3 font-medium">{a.title}</td>
                <td className="text-muted-foreground px-5 py-3">{a.slug}</td>
                <td className="px-5 py-3">
                  <Badge variant="outline">{a.difficulty}</Badge>
                </td>
                <td className="px-5 py-3 tabular-nums">{a.questionCount}</td>
                <td className="px-5 py-3">
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => openEdit(a)}>
                      <Pencil className="size-3.5" />
                      Edit
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="outline">
                          <Trash2 className="size-3.5" />
                          Delete
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete "{a.title}"?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This is blocked if anyone has already attempted it. Otherwise it's
                            permanent, including its questions.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteMutation.mutate(a.id)}>
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="text-muted-foreground px-5 py-8 text-center text-sm">
                  No assessments match "{search}".
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
