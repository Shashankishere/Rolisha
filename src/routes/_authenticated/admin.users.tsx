import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useState } from "react";
import { AppShell } from "@/components/app/app-shell";
import { AdminAccessFallback } from "@/components/admin/admin-access-fallback";
import { AdminSubNav } from "@/components/admin/admin-sub-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { getAdminUsers, setUserAdminRole, setUserPlan } from "@/lib/admin.functions";
import { useAuth } from "@/hooks/useAuth";
import type { AdminUserRow } from "@/lib/admin.server";
import { PLAN_LABEL, PLAN_TIERS, type PlanTier } from "@/lib/subscription";

function usersQuery() {
  return queryOptions({
    queryKey: ["admin", "users"],
    queryFn: () => getAdminUsers(),
  });
}

export const Route = createFileRoute("/_authenticated/admin/users")({
  loader: ({ context }) => context.queryClient.ensureQueryData(usersQuery()),
  head: () => ({
    meta: [{ title: "Admin — Users — Rolisha" }, { name: "robots", content: "noindex" }],
  }),
  errorComponent: ({ error, reset }) => (
    <AdminAccessFallback error={error} reset={reset} routeId="admin.users" title="Admin: Users" />
  ),
  component: AdminUsersPage,
});

function AdminUsersPage() {
  const { data: users } = useSuspenseQuery(usersQuery());
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const mutation = useMutation({
    mutationFn: (vars: { userId: string; makeAdmin: boolean }) => setUserAdminRole({ data: vars }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "overview"] });
      toast.success("Role updated.");
    },
    onError: (error: Error) => toast.error(error.message || "Could not update role."),
  });

  const planMutation = useMutation({
    mutationFn: (vars: { userId: string; plan: PlanTier }) => setUserPlan({ data: vars }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      toast.success("Plan updated.");
    },
    onError: (error: Error) => toast.error(error.message || "Could not update plan."),
  });

  const filtered = users.filter((u: AdminUserRow) => {
    const q = search.toLowerCase();
    return (
      (u.email ?? "").toLowerCase().includes(q) || (u.fullName ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <AppShell
      title="Admin: Users"
      description="Grant or revoke admin access. You cannot change your own admin role from here — that must be done by another admin, to avoid locking every admin out."
    >
      <AdminSubNav />
      <Input
        placeholder="Search by name or email…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-4 max-w-sm"
      />
      <div className="panel hover-lift overflow-x-auto p-0">
        <table className="w-full text-sm">
          <caption className="sr-only">Users</caption>
          <thead>
            <tr className="border-border/70 border-b text-left text-xs text-muted-foreground">
              <th className="px-5 py-3 font-medium">Name</th>
              <th className="px-5 py-3 font-medium">Email</th>
              <th className="px-5 py-3 font-medium">Target role</th>
              <th className="px-5 py-3 font-medium">Access</th>
              <th className="px-5 py-3 font-medium">Plan</th>
              <th className="px-5 py-3 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row: AdminUserRow) => {
              const isSelf = row.id === user?.id;
              return (
                <tr key={row.id} className="border-border/70 border-t">
                  <td className="px-5 py-3 font-medium">{row.fullName ?? "—"}</td>
                  <td className="text-muted-foreground px-5 py-3">{row.email ?? "—"}</td>
                  <td className="text-muted-foreground px-5 py-3">{row.targetRole ?? "—"}</td>
                  <td className="px-5 py-3">
                    <Badge variant={row.isAdmin ? "default" : "outline"}>
                      {row.isAdmin ? "Admin" : "User"}
                    </Badge>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex flex-col gap-1">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <button type="button" className="w-fit">
                            <Badge variant="secondary" className="cursor-pointer">
                              {PLAN_LABEL[row.plan]}
                            </Badge>
                          </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              Change plan for {row.email ?? "this user"}
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              Manually assigning a plan is for development/testing ahead of payment
                              integration. It will be labelled "Manual / Admin assigned" and does
                              not create any billing record.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <div className="py-2">
                            <Select
                              defaultValue={row.plan}
                              onValueChange={(v) =>
                                planMutation.mutate({ userId: row.id, plan: v as PlanTier })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {PLAN_TIERS.map((p) => (
                                  <SelectItem key={p} value={p}>
                                    {PLAN_LABEL[p]}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Close</AlertDialogCancel>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                      {row.planSource === "manual_admin" && (
                        <span className="text-muted-foreground text-xs">
                          Manual / Admin assigned
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="outline" disabled={isSelf}>
                          {row.isAdmin ? "Revoke admin" : "Make admin"}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            {row.isAdmin ? "Revoke admin access?" : "Grant admin access?"}
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            {row.isAdmin
                              ? `${row.email ?? "This user"} will lose access to the admin panel.`
                              : `${row.email ?? "This user"} will gain full access to the admin panel, including job ingestion and user management.`}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() =>
                              mutation.mutate({ userId: row.id, makeAdmin: !row.isAdmin })
                            }
                          >
                            Confirm
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="text-muted-foreground px-5 py-8 text-center text-sm">
                  No users match "{search}".
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
