import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useState } from "react";
import { Loader2, Pencil, Plus } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { AdminAccessFallback } from "@/components/admin/admin-access-fallback";
import { AdminSubNav } from "@/components/admin/admin-sub-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  createCareer,
  getAdminCareers,
  setCareerActive,
  updateCareer,
} from "@/lib/admin.functions";
import type { AdminCareerRow } from "@/lib/admin.server";

function careersQuery() {
  return queryOptions({
    queryKey: ["admin", "careers"],
    queryFn: () => getAdminCareers(),
  });
}

export const Route = createFileRoute("/_authenticated/admin/careers")({
  loader: ({ context }) => context.queryClient.ensureQueryData(careersQuery()),
  head: () => ({
    meta: [{ title: "Admin — Careers — Rolisha" }, { name: "robots", content: "noindex" }],
  }),
  errorComponent: ({ error, reset }) => (
    <AdminAccessFallback
      error={error}
      reset={reset}
      routeId="admin.careers"
      title="Admin: Careers"
    />
  ),
  component: AdminCareersPage,
});

interface CareerFormState {
  slug: string;
  title: string;
  shortDescription: string;
  description: string;
  seoTitle: string;
  seoDescription: string;
  typicalSalaryMin: string;
  typicalSalaryMax: string;
  salaryCurrency: string;
}

const EMPTY_FORM: CareerFormState = {
  slug: "",
  title: "",
  shortDescription: "",
  description: "",
  seoTitle: "",
  seoDescription: "",
  typicalSalaryMin: "",
  typicalSalaryMax: "",
  salaryCurrency: "INR",
};

function careerToForm(career: AdminCareerRow): CareerFormState {
  return {
    slug: career.slug,
    title: career.title,
    shortDescription: career.shortDescription ?? "",
    description: career.description ?? "",
    seoTitle: career.seoTitle ?? "",
    seoDescription: career.seoDescription ?? "",
    typicalSalaryMin: career.typicalSalaryMin?.toString() ?? "",
    typicalSalaryMax: career.typicalSalaryMax?.toString() ?? "",
    salaryCurrency: career.salaryCurrency ?? "INR",
  };
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function formToPayload(form: CareerFormState) {
  return {
    slug: form.slug.trim(),
    title: form.title.trim(),
    shortDescription: form.shortDescription.trim() || null,
    description: form.description.trim() || null,
    seoTitle: form.seoTitle.trim() || null,
    seoDescription: form.seoDescription.trim() || null,
    typicalSalaryMin: form.typicalSalaryMin.trim() ? Number(form.typicalSalaryMin) : null,
    typicalSalaryMax: form.typicalSalaryMax.trim() ? Number(form.typicalSalaryMax) : null,
    salaryCurrency: form.salaryCurrency.trim() || null,
  };
}

function AdminCareersPage() {
  const { data: careers } = useSuspenseQuery(careersQuery());
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCareer, setEditingCareer] = useState<AdminCareerRow | null>(null);
  const [form, setForm] = useState<CareerFormState>(EMPTY_FORM);
  const [slugTouched, setSlugTouched] = useState(false);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin", "careers"] });

  const activeMutation = useMutation({
    mutationFn: (vars: { careerId: string; isActive: boolean }) => setCareerActive({ data: vars }),
    onSuccess: () => {
      invalidate();
      toast.success("Career updated.");
    },
    onError: (error: Error) => toast.error(error.message || "Could not update career."),
  });

  const createMutation = useMutation({
    mutationFn: () => createCareer({ data: formToPayload(form) }),
    onSuccess: () => {
      invalidate();
      toast.success("Career created.");
      setDialogOpen(false);
    },
    onError: (error: Error) => toast.error(error.message || "Could not create this career."),
  });

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!editingCareer) throw new Error("No career selected.");
      return updateCareer({ data: { careerId: editingCareer.id, ...formToPayload(form) } });
    },
    onSuccess: () => {
      invalidate();
      toast.success("Career updated.");
      setDialogOpen(false);
    },
    onError: (error: Error) => toast.error(error.message || "Could not update this career."),
  });

  const isSaving = createMutation.isPending || updateMutation.isPending;

  function openCreate() {
    setEditingCareer(null);
    setForm(EMPTY_FORM);
    setSlugTouched(false);
    setDialogOpen(true);
  }

  function openEdit(career: AdminCareerRow) {
    setEditingCareer(career);
    setForm(careerToForm(career));
    setSlugTouched(true);
    setDialogOpen(true);
  }

  function handleTitleChange(title: string) {
    setForm((prev) => ({
      ...prev,
      title,
      slug: slugTouched ? prev.slug : slugify(title),
    }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editingCareer) updateMutation.mutate();
    else createMutation.mutate();
  }

  const filtered = careers.filter(
    (c) =>
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.slug.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <AppShell
      title="Admin: Careers"
      description="Add, edit, and archive the careers that appear in the public catalog. All writes go through the service role client, gated by an admin check."
      actions={
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}>
              <Plus className="size-4" />
              Add career
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>{editingCareer ? "Edit career" : "Add career"}</DialogTitle>
                <DialogDescription>
                  {editingCareer
                    ? `Editing "${editingCareer.title}".`
                    : "Fields match the existing careers schema — no new columns are added."}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-1.5">
                  <Label htmlFor="career-title">Title</Label>
                  <Input
                    id="career-title"
                    required
                    value={form.title}
                    onChange={(e) => handleTitleChange(e.target.value)}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="career-slug">Slug</Label>
                  <Input
                    id="career-slug"
                    required
                    pattern="[a-z0-9]+(-[a-z0-9]+)*"
                    title="Lowercase letters, numbers, and hyphens only"
                    value={form.slug}
                    onChange={(e) => {
                      setSlugTouched(true);
                      setForm((prev) => ({ ...prev, slug: e.target.value }));
                    }}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="career-short">Short description</Label>
                  <Textarea
                    id="career-short"
                    rows={2}
                    value={form.shortDescription}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, shortDescription: e.target.value }))
                    }
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="career-description">Full description</Label>
                  <Textarea
                    id="career-description"
                    rows={4}
                    value={form.description}
                    onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <Label htmlFor="career-salary-min">Typical salary min</Label>
                    <Input
                      id="career-salary-min"
                      type="number"
                      min={0}
                      value={form.typicalSalaryMin}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, typicalSalaryMin: e.target.value }))
                      }
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="career-salary-max">Typical salary max</Label>
                    <Input
                      id="career-salary-max"
                      type="number"
                      min={0}
                      value={form.typicalSalaryMax}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, typicalSalaryMax: e.target.value }))
                      }
                    />
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="career-currency">Salary currency</Label>
                  <Input
                    id="career-currency"
                    maxLength={8}
                    value={form.salaryCurrency}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, salaryCurrency: e.target.value }))
                    }
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="career-seo-title">SEO title</Label>
                  <Input
                    id="career-seo-title"
                    value={form.seoTitle}
                    onChange={(e) => setForm((prev) => ({ ...prev, seoTitle: e.target.value }))}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="career-seo-description">SEO description</Label>
                  <Textarea
                    id="career-seo-description"
                    rows={2}
                    value={form.seoDescription}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, seoDescription: e.target.value }))
                    }
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={isSaving}>
                  {isSaving && <Loader2 className="size-4 animate-spin" />}
                  {editingCareer ? "Save changes" : "Create career"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      }
    >
      <AdminSubNav />
      <Input
        placeholder="Search careers…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-4 max-w-sm"
      />
      <div className="panel hover-lift overflow-x-auto p-0">
        <table className="w-full text-sm">
          <caption className="sr-only">Careers</caption>
          <thead>
            <tr className="border-border/70 border-b text-left text-xs text-muted-foreground">
              <th className="px-5 py-3 font-medium">Title</th>
              <th className="px-5 py-3 font-medium">Slug</th>
              <th className="px-5 py-3 font-medium">Skills</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((career) => (
              <tr key={career.id} className="border-border/70 border-t">
                <td className="px-5 py-3 font-medium">{career.title}</td>
                <td className="text-muted-foreground px-5 py-3">{career.slug}</td>
                <td className="px-5 py-3 tabular-nums">{career.skillCount}</td>
                <td className="px-5 py-3">
                  <Badge variant={career.isActive ? "default" : "outline"}>
                    {career.isActive ? "Active" : "Archived"}
                  </Badge>
                </td>
                <td className="px-5 py-3">
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => openEdit(career)}>
                      <Pencil className="size-3.5" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={
                        activeMutation.isPending && activeMutation.variables?.careerId === career.id
                      }
                      onClick={() =>
                        activeMutation.mutate({ careerId: career.id, isActive: !career.isActive })
                      }
                    >
                      {career.isActive ? "Archive" : "Reactivate"}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="text-muted-foreground px-5 py-8 text-center text-sm">
                  No careers match "{search}".
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
