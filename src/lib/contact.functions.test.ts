import { describe, expect, it } from "vitest";
import { contactMessageSchema } from "@/lib/contact.functions";

const valid = {
  name: "Jordan Lee",
  email: "jordan@example.com",
  message: "Hi, I ran into an issue with my dashboard and wanted to ask about it.",
};

describe("contactMessageSchema", () => {
  it("accepts a fully populated, valid submission", () => {
    const result = contactMessageSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("accepts values coming straight out of FormData (all strings, as the contact form now reads them)", () => {
    // Mirrors what `new FormData(form).get(...)` returns — plain strings,
    // regardless of whether the browser populated them via typing,
    // autofill, or a prefilled default value.
    const result = contactMessageSchema.safeParse({
      name: String("Autofilled Name"),
      email: String("autofill@example.com"),
      message: String("This value came from a prefilled/autofilled form field."),
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty name", () => {
    const result = contactMessageSchema.safeParse({ ...valid, name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a whitespace-only name", () => {
    const result = contactMessageSchema.safeParse({ ...valid, name: "   " });
    expect(result.success).toBe(false);
  });

  it("rejects an empty email", () => {
    const result = contactMessageSchema.safeParse({ ...valid, email: "" });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid email", () => {
    const result = contactMessageSchema.safeParse({ ...valid, email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("rejects an empty message", () => {
    const result = contactMessageSchema.safeParse({ ...valid, message: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a message that's too short to be meaningful", () => {
    const result = contactMessageSchema.safeParse({ ...valid, message: "hi" });
    expect(result.success).toBe(false);
  });

  it("does not require the optional subject field", () => {
    const result = contactMessageSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("does not require the honeypot field, and treats it as a plain optional string", () => {
    const result = contactMessageSchema.safeParse({ ...valid, companyWebsite: "" });
    expect(result.success).toBe(true);
  });
});
