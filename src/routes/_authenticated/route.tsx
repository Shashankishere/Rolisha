import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  head: () => ({
    // The entire authenticated product (dashboard, roadmap, projects,
    // learning, assessments, settings, premium, admin, etc.) is private,
    // per-user data behind a login wall. It has no business being indexed
    // even if a crawler follows a shared or bookmarked link — set this
    // once here rather than on every authenticated route.
    meta: [{ name: "robots", content: "noindex, nofollow" }],
  }),
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: () => <Outlet />,
});
