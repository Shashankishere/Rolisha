import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ProjectDetail, ProjectListItem } from "@/lib/projects.server";

/** Lists the project catalog with the current user's status merged in. */
export const getProjects = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ProjectListItem[]> => {
    const { listProjectsForUser } = await import("@/lib/projects.server");
    return listProjectsForUser(context.supabase, context.userId);
  });

const setProjectStatusSchema = z.object({
  projectId: z.string().uuid(),
  status: z.enum(["not_started", "started", "completed"]),
});

/** Marks a project as started/completed, or resets it to not-started. */
export const setProjectStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => setProjectStatusSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { setProjectStatus: setStatus } = await import("@/lib/projects.server");
    return setStatus(context.supabase, context.userId, data.projectId, data.status);
  });

const getProjectSchema = z.object({ projectId: z.string().uuid() });

/** Loads a single project's learning workspace: objective, skills, tasks,
 * real resources and the current user's progress. */
export const getProjectDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => getProjectSchema.parse(data))
  .handler(async ({ context, data }): Promise<ProjectDetail | null> => {
    const { getProjectDetail: getDetail } = await import("@/lib/projects.server");
    const detail = await getDetail(context.supabase, context.userId, data.projectId);
    if (!detail) return null;

    // Merged here (not inside projects.server.ts) to keep the two server
    // modules from importing each other's runtime code — see the
    // type-only import note on ProjectTask.evidence in projects.server.ts.
    // Mutating each task in place (rather than mapping to new objects)
    // means the same task objects referenced from `detail.milestones`
    // pick up their evidence too, since groupTasksIntoMilestones groups by
    // reference, not by copy.
    const { listProjectEvidenceByTask } = await import("@/lib/task-evidence.server");
    const evidenceByTask = await listProjectEvidenceByTask(
      context.supabase,
      context.userId,
      data.projectId,
    );
    for (const task of detail.tasks) {
      task.evidence = evidenceByTask.get(task.index) ?? [];
    }

    return detail;
  });

const taskWorkspaceSchema = z.object({
  projectId: z.string().uuid(),
  taskIndex: z.number().int().min(0),
  note: z.string().max(5000).default(""),
  link: z
    .string()
    .trim()
    .max(500)
    .refine((v) => v.length === 0 || /^https?:\/\//i.test(v), {
      message: "Link must start with http:// or https://",
    })
    .transform((v) => (v.length === 0 ? null : v))
    .nullable()
    .default(null),
});

/** Saves a work-in-progress draft (note/link) for a task without marking it
 * complete. */
export const saveProjectTaskProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => taskWorkspaceSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { saveProjectTaskProgress: save } = await import("@/lib/projects.server");
    return save(context.supabase, context.userId, data.projectId, data.taskIndex, {
      note: data.note,
      link: data.link,
    });
  });

/** Submits a task's evidence and marks it completed — the only path by
 * which a task can become "done". */
export const submitProjectTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => taskWorkspaceSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { submitProjectTask: submit } = await import("@/lib/projects.server");
    return submit(context.supabase, context.userId, data.projectId, data.taskIndex, {
      note: data.note,
      link: data.link,
    });
  });

const uploadTaskEvidenceSchema = z.object({
  projectId: z.string().uuid(),
  taskIndex: z.number().int().min(0),
  fileBase64: z.string().min(1),
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1).max(255),
});

/** Uploads one evidence file (screenshot/document) for a task. Validation
 * (type, size, signature, task-locked state, per-task file cap) all
 * happens server-side in task-evidence.server.ts — the client-side checks
 * in the upload widget are a UX convenience only. */
export const uploadTaskEvidence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => uploadTaskEvidenceSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { uploadTaskEvidence: upload } = await import("@/lib/task-evidence.server");
    return upload(context.supabase, context.userId, data.projectId, data.taskIndex, {
      fileBase64: data.fileBase64,
      fileName: data.fileName,
      mimeType: data.mimeType,
    });
  });

const removeTaskEvidenceSchema = z.object({
  projectId: z.string().uuid(),
  taskIndex: z.number().int().min(0),
  evidenceId: z.string().uuid(),
});

/** Removes one evidence file — blocked once its task is completed, same as
 * the note/link fields. */
export const removeTaskEvidence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => removeTaskEvidenceSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { removeTaskEvidence: remove } = await import("@/lib/task-evidence.server");
    return remove(
      context.supabase,
      context.userId,
      data.projectId,
      data.taskIndex,
      data.evidenceId,
    );
  });
