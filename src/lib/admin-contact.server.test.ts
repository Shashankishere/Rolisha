import { describe, expect, it } from "vitest";
import { listContactMessages, setContactMessageStatus } from "@/lib/admin-contact.server";
import { createFakeSupabase } from "@/lib/jobs/__tests__/fake-supabase";
import { USER_A, USER_B } from "@/lib/jobs/__tests__/fixtures";

// Same convention as admin.server.test.ts: these only exercise the
// requireAdmin gate (every export checks the caller's own admin role
// before ever reaching the service-role client), since the actual
// service-role read/write requires a live Supabase project. Non-admin
// rejection is exactly the security property that matters for "only
// admins can access contact submissions".
describe("admin-contact.server requireAdmin gating", () => {
  it("listContactMessages rejects a non-admin caller", async () => {
    const fake = createFakeSupabase();
    fake.seed("user_roles", [{ user_id: USER_B, role: "member" }]);
    await expect(listContactMessages(fake, USER_B)).rejects.toThrow(/forbidden/i);
  });

  it("listContactMessages rejects a caller with no role row at all", async () => {
    const fake = createFakeSupabase();
    await expect(listContactMessages(fake, USER_A)).rejects.toThrow(/forbidden/i);
  });

  it("setContactMessageStatus rejects a non-admin caller", async () => {
    const fake = createFakeSupabase();
    fake.seed("user_roles", [{ user_id: USER_B, role: "member" }]);
    await expect(setContactMessageStatus(fake, USER_B, "message-1", "resolved")).rejects.toThrow(
      /forbidden/i,
    );
  });
});
