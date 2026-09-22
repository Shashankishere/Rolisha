import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const url = new URL(request.url);
      // Razorpay webhooks hit this exact path with a raw signed body.
      // Handled before the TanStack Start router entirely -- this
      // version of TanStack Start has no built-in API-route primitive,
      // and a webhook payload must never be parsed/re-serialized by
      // anything (like a router loader) before signature verification.
      if (url.pathname === "/api/webhooks/razorpay" && request.method === "POST") {
        const { handleRazorpayWebhook } = await import("./lib/payments/webhook-handler.server");
        return await handleRazorpayWebhook(request);
      }

      // Secret-gated HTTP fallback for the automatic Adzuna sync — used
      // for local/manual testing (Cloudflare Cron Triggers have no way to
      // be invoked over HTTP) and as an option for operators who'd rather
      // point an external scheduler (GitHub Actions, another host's cron,
      // etc) at this URL instead of relying solely on the native
      // Cloudflare Cron Trigger (see server/tasks/adzuna-sync.ts for the
      // primary, platform-native path). Reuses the existing
      // `authenticateCronRequest` helper (CRON_SECRET) rather than
      // inventing a second secret/verification scheme.
      if (url.pathname === "/api/cron/adzuna-sync" && request.method === "POST") {
        const { authenticateCronRequest } = await import("./integrations/supabase/cron-auth");
        const authError = await authenticateCronRequest(request);
        if (authError) return authError;

        const { supabaseAdmin } = await import("./integrations/supabase/client.server");
        const { runAdzunaSyncTask } = await import("./lib/jobs/adzuna-sync-task.server");
        const summary = await runAdzunaSyncTask(supabaseAdmin, { trigger: "cron_http" });
        return new Response(JSON.stringify(summary), {
          status: summary.status === "success" ? 200 : 502,
          headers: { "content-type": "application/json" },
        });
      }

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
