import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, CircleDot, ExternalLink, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { showMutationError } from "@/components/app/upgrade-prompt";
import { TaskEvidenceUpload } from "@/components/app/projects/task-evidence-upload";
import { saveProjectTaskProgress, submitProjectTask } from "@/lib/projects.functions";
import type { ProjectTask } from "@/lib/projects.server";

const MIN_NOTE_LENGTH = 20;

/**
 * The task's actual workspace: a place to demonstrate real work was done,
 * not a checkbox. A task can only move to "Completed" through the Submit
 * action here, which requires a real written explanation of what was done
 * (server-enforced, not just a disabled button).
 */
export function TaskWorkspaceDialog({
  open,
  onOpenChange,
  projectId,
  milestoneLabel,
  task,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  milestoneLabel: string;
  task: ProjectTask | null;
}) {
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  const [link, setLink] = useState("");

  useEffect(() => {
    if (task) {
      setNote(task.note);
      setLink(task.link ?? "");
    }
    // Only re-sync when a different task is opened or its saved state
    // changes — not on every keystroke while the user is editing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.index, task?.note, task?.link]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["project", projectId] });
    queryClient.invalidateQueries({ queryKey: ["projects"] });
    queryClient.invalidateQueries({ queryKey: ["workspace"] });
  };

  const saveMutation = useMutation({
    mutationFn: (vars: { note: string; link: string }) =>
      saveProjectTaskProgress({
        data: { projectId, taskIndex: task!.index, note: vars.note, link: vars.link },
      }),
    onSuccess: invalidate,
    onError: (error: Error) => showMutationError(error, "Could not save your progress."),
  });

  const submitMutation = useMutation({
    mutationFn: (vars: { note: string; link: string }) =>
      submitProjectTask({
        data: { projectId, taskIndex: task!.index, note: vars.note, link: vars.link },
      }),
    onSuccess: () => {
      invalidate();
      onOpenChange(false);
    },
    onError: (error: Error) => showMutationError(error, "Could not submit this step."),
  });

  if (!task) return null;

  const isCompleted = task.status === "completed";
  const trimmedLength = note.trim().length;
  const canSubmit = trimmedLength >= MIN_NOTE_LENGTH && !isCompleted;
  const isBusy = saveMutation.isPending || submitMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {isCompleted ? (
              <CheckCircle2 className="text-success size-4 shrink-0" />
            ) : (
              <CircleDot className="text-muted-foreground size-4 shrink-0" />
            )}
            <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              {milestoneLabel} · Step {task.index + 1}
            </span>
          </div>
          <DialogTitle>{task.title}</DialogTitle>
          <DialogDescription>
            Do the work, then explain what you did below. A step is only marked complete once you
            submit real evidence of it — there's no checkbox shortcut.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {isCompleted ? (
            <div className="bg-success-soft/60 flex items-center gap-2 rounded-lg px-3 py-2">
              <CheckCircle2 className="text-success size-4 shrink-0" />
              <p className="text-success text-sm font-medium">
                Completed
                {task.updatedAt ? ` on ${new Date(task.updatedAt).toLocaleDateString()}` : ""}
              </p>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              Work on this step in your own repo/tool of choice, then come back and record what you
              did — a short summary of the work, plus a link if you have one (repo, deployed app,
              doc, etc).
            </p>
          )}

          <div>
            <Label htmlFor="task-note">What did you do for this step?</Label>
            <Textarea
              id="task-note"
              className="mt-1.5 min-h-32"
              placeholder="Describe the work you actually did…"
              value={note}
              disabled={isCompleted || isBusy}
              onChange={(e) => setNote(e.target.value)}
            />
            {!isCompleted && (
              <p className="text-muted-foreground mt-1 text-xs">
                {trimmedLength} characters (minimum {MIN_NOTE_LENGTH} to submit)
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="task-link">Supporting link (optional)</Label>
            {isCompleted && task.link ? (
              <a
                href={task.link}
                target="_blank"
                rel="noreferrer"
                className="text-primary mt-1.5 flex items-center gap-1.5 text-sm hover:underline"
              >
                {task.link} <ExternalLink className="size-3.5 shrink-0" />
              </a>
            ) : (
              <Input
                id="task-link"
                className="mt-1.5"
                placeholder="https://github.com/you/repo"
                value={link}
                disabled={isCompleted || isBusy}
                onChange={(e) => setLink(e.target.value)}
              />
            )}
          </div>

          {isCompleted && (
            <Badge variant="outline" className="text-success border-success/40 w-fit">
              <CheckCircle2 className="size-3" /> Evidence locked — step is complete
            </Badge>
          )}

          <div className="border-border/70 border-t pt-4">
            <TaskEvidenceUpload
              projectId={projectId}
              taskIndex={task.index}
              evidence={task.evidence}
              locked={isCompleted}
            />
          </div>
        </div>

        {!isCompleted && (
          <p className="text-muted-foreground text-xs">
            A written explanation is required to submit. A supporting link or evidence file is
            optional, but strengthens your submission.
          </p>
        )}

        {!isCompleted && (
          <DialogFooter>
            <Button
              variant="outline"
              disabled={isBusy}
              onClick={() => saveMutation.mutate({ note, link })}
            >
              {saveMutation.isPending && <Loader2 className="size-4 animate-spin" />}
              Save progress
            </Button>
            <Button
              disabled={!canSubmit || isBusy}
              onClick={() => submitMutation.mutate({ note, link })}
            >
              {submitMutation.isPending && <Loader2 className="size-4 animate-spin" />}
              Submit & complete step
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
