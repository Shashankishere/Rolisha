import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useState } from "react";
import { Mail, MailOpen, CheckCircle2 } from "lucide-react";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { getContactMessages, updateContactMessageStatus } from "@/lib/admin-contact.functions";
import type { ContactMessageItem, ContactMessageStatus } from "@/lib/admin-contact.server";

function contactMessagesQuery() {
  return queryOptions({
    queryKey: ["admin", "contact-messages"],
    queryFn: () => getContactMessages({ data: { status: "all" } }),
  });
}

export const Route = createFileRoute("/_authenticated/admin/contact")({
  loader: ({ context }) => context.queryClient.ensureQueryData(contactMessagesQuery()),
  head: () => ({
    meta: [{ title: "Admin — Contact — Rolisha" }, { name: "robots", content: "noindex" }],
  }),
  errorComponent: ({ error, reset }) => (
    <AdminAccessFallback
      error={error}
      reset={reset}
      routeId="admin.contact"
      title="Admin: Contact"
    />
  ),
  component: AdminContactPage,
});

const STATUS_LABEL: Record<ContactMessageStatus, string> = {
  new: "New",
  read: "Read",
  resolved: "Resolved",
};

const STATUS_BADGE_CLASS: Record<ContactMessageStatus, string> = {
  new: "bg-primary-soft text-primary border-none",
  read: "bg-muted text-muted-foreground border-none",
  resolved: "bg-success-soft text-success border-none",
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function AdminContactPage() {
  const { data: messages } = useSuspenseQuery(contactMessagesQuery());
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ContactMessageStatus | "all">("all");
  const [openMessage, setOpenMessage] = useState<ContactMessageItem | null>(null);

  const statusMutation = useMutation({
    mutationFn: (vars: { messageId: string; status: ContactMessageStatus }) =>
      updateContactMessageStatus({ data: vars }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "contact-messages"] });
    },
    onError: (error: Error) => toast.error(error.message || "Could not update this message."),
  });

  const filtered = messages.filter((m) => {
    if (statusFilter !== "all" && m.status !== statusFilter) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      m.name.toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q) ||
      (m.subject ?? "").toLowerCase().includes(q) ||
      m.message.toLowerCase().includes(q)
    );
  });

  function openAndMarkRead(message: ContactMessageItem) {
    setOpenMessage(message);
    if (message.status === "new") {
      statusMutation.mutate({ messageId: message.id, status: "read" });
    }
  }

  const newCount = messages.filter((m) => m.status === "new").length;

  return (
    <AppShell
      title="Admin: Contact"
      description={
        newCount > 0
          ? `${newCount} new message${newCount === 1 ? "" : "s"} from the /contact form.`
          : "Messages submitted through the /contact form."
      }
    >
      <AdminSubNav />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          placeholder="Search name, email, subject, or message…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="read">Read</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="panel hover-lift overflow-x-auto p-0">
        <table className="w-full text-sm">
          <caption className="sr-only">Contact form submissions</caption>
          <thead>
            <tr className="border-border/70 border-b text-left text-xs text-muted-foreground">
              <th className="px-5 py-3 font-medium">Name</th>
              <th className="px-5 py-3 font-medium">Email</th>
              <th className="px-5 py-3 font-medium">Subject</th>
              <th className="px-5 py-3 font-medium">Received</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((message) => (
              <tr key={message.id} className="border-border/70 border-t">
                <td className="px-5 py-3 font-medium">{message.name}</td>
                <td className="text-muted-foreground px-5 py-3">{message.email}</td>
                <td className="text-muted-foreground max-w-[220px] truncate px-5 py-3">
                  {message.subject || "—"}
                </td>
                <td className="text-muted-foreground px-5 py-3 whitespace-nowrap">
                  {formatDateTime(message.createdAt)}
                </td>
                <td className="px-5 py-3">
                  <Badge className={STATUS_BADGE_CLASS[message.status]}>
                    {STATUS_LABEL[message.status]}
                  </Badge>
                </td>
                <td className="px-5 py-3">
                  <Dialog
                    open={openMessage?.id === message.id}
                    onOpenChange={(open) => !open && setOpenMessage(null)}
                  >
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline" onClick={() => openAndMarkRead(message)}>
                        {message.status === "new" ? (
                          <Mail className="size-3.5" />
                        ) : (
                          <MailOpen className="size-3.5" />
                        )}
                        Open
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>{message.subject || "Contact message"}</DialogTitle>
                        <DialogDescription>
                          From {message.name} ({message.email}) ·{" "}
                          {formatDateTime(message.createdAt)}
                        </DialogDescription>
                      </DialogHeader>
                      <p className="text-sm whitespace-pre-wrap">{message.message}</p>
                      <DialogFooter className="gap-2 sm:justify-between">
                        <Badge className={STATUS_BADGE_CLASS[message.status]}>
                          {STATUS_LABEL[message.status]}
                        </Badge>
                        <div className="flex gap-2">
                          {message.status !== "resolved" && (
                            <Button
                              size="sm"
                              disabled={statusMutation.isPending}
                              onClick={() =>
                                statusMutation.mutate({
                                  messageId: message.id,
                                  status: "resolved",
                                })
                              }
                            >
                              <CheckCircle2 className="size-3.5" />
                              Mark resolved
                            </Button>
                          )}
                          {message.status === "resolved" && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={statusMutation.isPending}
                              onClick={() =>
                                statusMutation.mutate({ messageId: message.id, status: "read" })
                              }
                            >
                              Reopen
                            </Button>
                          )}
                        </div>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="text-muted-foreground px-5 py-8 text-center text-sm">
                  No messages match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
