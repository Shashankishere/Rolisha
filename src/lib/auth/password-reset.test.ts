import { describe, expect, it } from "vitest";
import {
  forgotPasswordEmailSchema,
  hasPasswordAuth,
  newPasswordSchema,
} from "@/lib/auth/password-reset";

describe("forgotPasswordEmailSchema", () => {
  it("accepts a well-formed email", () => {
    expect(forgotPasswordEmailSchema.safeParse("person@example.com").success).toBe(true);
  });

  it("trims surrounding whitespace", () => {
    const result = forgotPasswordEmailSchema.safeParse("  person@example.com  ");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe("person@example.com");
  });

  it("rejects an invalid email", () => {
    expect(forgotPasswordEmailSchema.safeParse("not-an-email").success).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(forgotPasswordEmailSchema.safeParse("").success).toBe(false);
  });
});

describe("newPasswordSchema", () => {
  it("accepts a valid matching password pair", () => {
    const result = newPasswordSchema.safeParse({
      password: "correct-horse",
      confirmPassword: "correct-horse",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a password shorter than 8 characters", () => {
    const result = newPasswordSchema.safeParse({
      password: "short1",
      confirmPassword: "short1",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a password longer than 72 characters", () => {
    const long = "a".repeat(73);
    const result = newPasswordSchema.safeParse({ password: long, confirmPassword: long });
    expect(result.success).toBe(false);
  });

  it("rejects when the confirmation does not match", () => {
    const result = newPasswordSchema.safeParse({
      password: "correct-horse",
      confirmPassword: "different-horse",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["confirmPassword"]);
    }
  });
});

describe("hasPasswordAuth", () => {
  it("is true for a user who signed up with email/password", () => {
    expect(hasPasswordAuth({ app_metadata: { providers: ["email"] } })).toBe(true);
  });

  it("is true for a user who linked email in addition to Google", () => {
    expect(hasPasswordAuth({ app_metadata: { providers: ["google", "email"] } })).toBe(true);
  });

  it("is false for a Google-only user", () => {
    expect(hasPasswordAuth({ app_metadata: { providers: ["google"] } })).toBe(false);
  });

  it("is false when there's no provider information at all", () => {
    expect(hasPasswordAuth({})).toBe(false);
  });

  it("falls back to the identities array when app_metadata.providers is absent", () => {
    expect(
      hasPasswordAuth({
        app_metadata: {},
        identities: [{ provider: "google" }, { provider: "email" }],
      }),
    ).toBe(true);
  });

  it("is false when identities exist but none are email", () => {
    expect(hasPasswordAuth({ app_metadata: {}, identities: [{ provider: "google" }] })).toBe(false);
  });
});
