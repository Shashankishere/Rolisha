import { describe, expect, it } from "vitest";
import { ADMIN_ACCESS_ERROR_MARKER, parseAdminAccessError } from "@/lib/jobs/admin-access-error";

describe("parseAdminAccessError", () => {
  it("parses a not_admin marker", () => {
    const error = new Error(
      `${ADMIN_ACCESS_ERROR_MARKER}::not_admin::Forbidden: admin role required.`,
    );
    expect(parseAdminAccessError(error)).toEqual({
      code: "not_admin",
      message: "Forbidden: admin role required.",
    });
  });

  it("parses a verification_failed marker", () => {
    const error = new Error(
      `${ADMIN_ACCESS_ERROR_MARKER}::verification_failed::Unable to verify admin permissions right now. Please try again.`,
    );
    expect(parseAdminAccessError(error)).toEqual({
      code: "verification_failed",
      message: "Unable to verify admin permissions right now. Please try again.",
    });
  });

  it("returns null for an unrelated error", () => {
    expect(parseAdminAccessError(new Error("Some other bug"))).toBeNull();
  });

  it("returns null for a non-Error value", () => {
    expect(parseAdminAccessError("a string")).toBeNull();
    expect(parseAdminAccessError(null)).toBeNull();
    expect(parseAdminAccessError(undefined)).toBeNull();
  });

  it("returns null for an unknown code even if the marker matches", () => {
    const error = new Error(`${ADMIN_ACCESS_ERROR_MARKER}::something_else::message`);
    expect(parseAdminAccessError(error)).toBeNull();
  });
});
