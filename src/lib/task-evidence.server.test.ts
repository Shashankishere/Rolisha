import { describe, expect, it } from "vitest";
import {
  EVIDENCE_MAX_FILES_PER_TASK,
  listProjectEvidenceByTask,
  removeTaskEvidence,
  uploadTaskEvidence,
} from "@/lib/task-evidence.server";
import { attachFakeStorage, createFakeSupabase } from "@/lib/jobs/__tests__/fake-supabase";
import { USER_A, USER_B } from "@/lib/jobs/__tests__/fixtures";

const PROJECT_ID = "proj-1";

function seedProject(fake: ReturnType<typeof createFakeSupabase>, requirements: string[]) {
  fake.seed("projects", [
    {
      id: PROJECT_ID,
      slug: "sales-dashboard",
      title: "Sales Performance Dashboard",
      requirements,
    },
  ]);
}

function pngBase64(): string {
  const buf = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.from("fake png bytes for testing"),
  ]);
  return buf.toString("base64");
}

function pdfBase64(): string {
  return Buffer.from("%PDF-1.4 fake pdf content for testing").toString("base64");
}

function setup() {
  const fake = createFakeSupabase();
  attachFakeStorage(fake);
  seedProject(fake, ["Step one", "Step two", "Step three"]);
  return fake;
}

describe("uploadTaskEvidence", () => {
  it("accepts a valid PNG and records its metadata", async () => {
    const fake = setup();
    const result = await uploadTaskEvidence(fake, USER_A, PROJECT_ID, 0, {
      fileBase64: pngBase64(),
      fileName: "screenshot.png",
      mimeType: "image/png",
    });
    expect(result.fileName).toBe("screenshot.png");
    expect(result.mimeType).toBe("image/png");
    expect(result.viewUrl).toMatch(/^https:\/\/fake\.local\//);
    expect(fake.table("task_evidence")).toHaveLength(1);
  });

  it("accepts a valid PDF", async () => {
    const fake = setup();
    const result = await uploadTaskEvidence(fake, USER_A, PROJECT_ID, 0, {
      fileBase64: pdfBase64(),
      fileName: "notes.pdf",
      mimeType: "application/pdf",
    });
    expect(result.mimeType).toBe("application/pdf");
  });

  it("rejects an unsupported file type", async () => {
    const fake = setup();
    await expect(
      uploadTaskEvidence(fake, USER_A, PROJECT_ID, 0, {
        fileBase64: Buffer.from("#!/bin/sh\necho hi").toString("base64"),
        fileName: "script.sh",
        mimeType: "application/x-sh",
      }),
    ).rejects.toThrow(/unsupported file type/i);
    expect(fake.table("task_evidence")).toHaveLength(0);
  });

  it("rejects a file whose extension/MIME claim doesn't match its actual bytes", async () => {
    const fake = setup();
    // Claims to be a PNG (extension + MIME both say so) but the bytes are
    // plain text — the magic-number check should catch this even though
    // the extension/MIME check alone would pass it.
    await expect(
      uploadTaskEvidence(fake, USER_A, PROJECT_ID, 0, {
        fileBase64: Buffer.from("this is not actually a png").toString("base64"),
        fileName: "fake.png",
        mimeType: "image/png",
      }),
    ).rejects.toThrow(/doesn't look like a valid/i);
    expect(fake.table("task_evidence")).toHaveLength(0);
  });

  it("rejects an oversized file", async () => {
    const fake = setup();
    const bigBuffer = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.alloc(11 * 1024 * 1024, 1),
    ]);
    await expect(
      uploadTaskEvidence(fake, USER_A, PROJECT_ID, 0, {
        fileBase64: bigBuffer.toString("base64"),
        fileName: "huge.png",
        mimeType: "image/png",
      }),
    ).rejects.toThrow(/too large/i);
  });

  it("rejects an empty file", async () => {
    const fake = setup();
    await expect(
      uploadTaskEvidence(fake, USER_A, PROJECT_ID, 0, {
        fileBase64: "",
        fileName: "empty.png",
        mimeType: "image/png",
      }),
    ).rejects.toThrow(/empty/i);
  });

  it("refuses to upload to a step that doesn't exist", async () => {
    const fake = setup();
    await expect(
      uploadTaskEvidence(fake, USER_A, PROJECT_ID, 99, {
        fileBase64: pngBase64(),
        fileName: "screenshot.png",
        mimeType: "image/png",
      }),
    ).rejects.toThrow(/doesn't exist/i);
  });

  it("refuses to upload once the task is already completed", async () => {
    const fake = setup();
    fake.seed("user_projects", [
      { user_id: USER_A, project_id: PROJECT_ID, status: "started", completed_tasks: [0] },
    ]);
    await expect(
      uploadTaskEvidence(fake, USER_A, PROJECT_ID, 0, {
        fileBase64: pngBase64(),
        fileName: "screenshot.png",
        mimeType: "image/png",
      }),
    ).rejects.toThrow(/already completed/i);
  });

  it("enforces a per-task file cap", async () => {
    const fake = setup();
    for (let i = 0; i < EVIDENCE_MAX_FILES_PER_TASK; i++) {
      await uploadTaskEvidence(fake, USER_A, PROJECT_ID, 0, {
        fileBase64: pngBase64(),
        fileName: `shot-${i}.png`,
        mimeType: "image/png",
      });
    }
    await expect(
      uploadTaskEvidence(fake, USER_A, PROJECT_ID, 0, {
        fileBase64: pngBase64(),
        fileName: "one-too-many.png",
        mimeType: "image/png",
      }),
    ).rejects.toThrow(/up to 5 files/i);
    expect(fake.table("task_evidence")).toHaveLength(EVIDENCE_MAX_FILES_PER_TASK);
  });

  it("associates evidence with the uploading user, project, and task index", async () => {
    const fake = setup();
    await uploadTaskEvidence(fake, USER_A, PROJECT_ID, 1, {
      fileBase64: pngBase64(),
      fileName: "shot.png",
      mimeType: "image/png",
    });
    const row = fake.table("task_evidence")[0];
    expect(row).toMatchObject({ user_id: USER_A, project_id: PROJECT_ID, task_index: 1 });
  });
});

describe("listProjectEvidenceByTask", () => {
  it("groups evidence by task index and never leaks another user's files", async () => {
    const fake = setup();
    await uploadTaskEvidence(fake, USER_A, PROJECT_ID, 0, {
      fileBase64: pngBase64(),
      fileName: "a.png",
      mimeType: "image/png",
    });
    await uploadTaskEvidence(fake, USER_B, PROJECT_ID, 0, {
      fileBase64: pngBase64(),
      fileName: "b.png",
      mimeType: "image/png",
    });

    const byTaskA = await listProjectEvidenceByTask(fake, USER_A, PROJECT_ID);
    expect(byTaskA.get(0)?.map((e) => e.fileName)).toEqual(["a.png"]);

    const byTaskB = await listProjectEvidenceByTask(fake, USER_B, PROJECT_ID);
    expect(byTaskB.get(0)?.map((e) => e.fileName)).toEqual(["b.png"]);
  });

  it("returns an empty map for a project with no evidence", async () => {
    const fake = setup();
    const byTask = await listProjectEvidenceByTask(fake, USER_A, PROJECT_ID);
    expect(byTask.size).toBe(0);
  });
});

describe("removeTaskEvidence", () => {
  it("removes the db row and the underlying storage object", async () => {
    const fake = setup();
    const files = attachFakeStorage(fake);
    const uploaded = await uploadTaskEvidence(fake, USER_A, PROJECT_ID, 0, {
      fileBase64: pngBase64(),
      fileName: "a.png",
      mimeType: "image/png",
    });

    await removeTaskEvidence(fake, USER_A, PROJECT_ID, 0, uploaded.id);

    expect(fake.table("task_evidence")).toHaveLength(0);
    expect([...files.keys()]).toHaveLength(0);
  });

  it("refuses to remove evidence once the task is completed", async () => {
    const fake = setup();
    const uploaded = await uploadTaskEvidence(fake, USER_A, PROJECT_ID, 0, {
      fileBase64: pngBase64(),
      fileName: "a.png",
      mimeType: "image/png",
    });
    fake.seed("user_projects", [
      { user_id: USER_A, project_id: PROJECT_ID, status: "started", completed_tasks: [0] },
    ]);

    await expect(removeTaskEvidence(fake, USER_A, PROJECT_ID, 0, uploaded.id)).rejects.toThrow(
      /already completed/i,
    );
    expect(fake.table("task_evidence")).toHaveLength(1);
  });

  it("refuses to remove another user's evidence", async () => {
    const fake = setup();
    const uploaded = await uploadTaskEvidence(fake, USER_A, PROJECT_ID, 0, {
      fileBase64: pngBase64(),
      fileName: "a.png",
      mimeType: "image/png",
    });

    await expect(removeTaskEvidence(fake, USER_B, PROJECT_ID, 0, uploaded.id)).rejects.toThrow(
      /not found|access/i,
    );
    expect(fake.table("task_evidence")).toHaveLength(1);
  });
});
