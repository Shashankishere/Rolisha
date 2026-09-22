import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const extractSchema = z.object({
  // Base64 payload of a PDF/DOCX capped well above the real byte limit (the
  // server re-checks the true byte size — this just stops absurdly large
  // request bodies from being parsed at all).
  fileBase64: z.string().min(1).max(8_000_000),
  fileName: z.string().min(1).max(260),
  mimeType: z.string().min(1).max(200),
});

export interface ExtractedResume {
  text: string;
  truncated: boolean;
}

/** Extracts plain text from an uploaded PDF/DOCX resume. The file itself is
 * never stored — only the extracted, sanitized text is returned. */
export const extractResumeFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => extractSchema.parse(data))
  .handler(async ({ data }): Promise<ExtractedResume> => {
    const { extractResumeText } = await import("@/lib/premium/resume-extract.server");
    return extractResumeText(data);
  });
