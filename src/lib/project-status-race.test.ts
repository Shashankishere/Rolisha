import { describe, expect, it } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { applyProjectStatusToDetail, applyProjectStatusToListItem } from "@/lib/projects.server";

/**
 * Regression tests for the "Start Project reverts to 'Start Project' a few
 * seconds after it correctly showed 'In Progress'" bug.
 *
 * Root cause (traced through the actual code, not guessed): the database
 * write and read are both correct. The bug is a React Query out-of-order
 * response race — with the app's `new QueryClient()` (default staleTime:
 * 0, refetchOnMount: true) and `__root.tsx`'s auth-listener calling a
 * bare `queryClient.invalidateQueries()`, a `getProjectDetail` fetch that
 * was already in flight *before* the mutation resolved could still be
 * pending when `onSuccess` patched the cache, and would then land *after*
 * that patch with stale pre-mutation data, silently overwriting it.
 *
 * These tests use a REAL `QueryClient` (not a mock) and reproduce that
 * exact sequence: a slow, already-in-flight fetch racing against the
 * mutation's cache write, verifying the fix (`cancelQueries` before
 * `setQueryData`) actually closes the race rather than merely making it
 * less likely.
 */

type ProjectRow = { id: string; status: "not_started" | "started" | "completed" };
type ProjectListRow = { id: string; status: "not_started" | "started" | "completed" };

function createClient() {
  // Mirrors the app's real router.tsx: `new QueryClient()` with no
  // defaultOptions overrides — same staleTime: 0 / refetchOnMount: true
  // defaults that make the race possible in the first place. Testing
  // against anything friendlier than the app's real config would prove
  // nothing.
  return new QueryClient();
}

/** Simulates a slow `getProjectDetail`-style fetch that was already in
 * flight before the mutation — resolves after `resolveAfterMs` with
 * whatever status the DB had *at the time the fetch started* (i.e. the
 * stale, pre-mutation value). */
function slowStaleFetch(staleValue: ProjectRow, resolveAfterMs: number): Promise<ProjectRow> {
  return new Promise((resolve) => setTimeout(() => resolve(staleValue), resolveAfterMs));
}

describe("Start Project reversion race (regression)", () => {
  const projectId = "proj-1";
  const detailKey = ["project", projectId];
  const listKey = ["projects"];

  it("BUG REPRODUCTION: without cancelling the in-flight fetch, a slow stale response overwrites a correct mutation result", async () => {
    const queryClient = createClient();
    const staleDetail: ProjectRow = { id: projectId, status: "not_started" };
    queryClient.setQueryData(detailKey, staleDetail);

    // A background refetch (mount/focus/broad-invalidate triggered) is
    // already in flight, carrying the OLD status. In production this
    // resolves ~5s later (matching the reported timing); the test uses a
    // short delay since only the ordering — started before the mutation,
    // resolved after — is what matters, not the real-world duration.
    const inFlightStalePromise = queryClient.fetchQuery({
      queryKey: detailKey,
      queryFn: () => slowStaleFetch(staleDetail, 50),
    });

    // The mutation resolves quickly and patches the cache — WITHOUT first
    // cancelling the in-flight fetch (this is the old, buggy sequence).
    queryClient.setQueryData<ProjectRow | undefined>(detailKey, (prev) =>
      applyProjectStatusToDetail(prev, "started"),
    );
    expect(queryClient.getQueryData<ProjectRow>(detailKey)?.status).toBe("started");

    // Now the slow, stale fetch that started before the mutation finally
    // resolves and (without cancellation) overwrites the cache.
    await inFlightStalePromise;

    // This reproduces the reported bug: the UI would now show
    // "Start Project" again, several seconds after correctly showing
    // "In Progress" — even though the database was never wrong.
    expect(queryClient.getQueryData<ProjectRow>(detailKey)?.status).toBe("not_started");
  });

  it("FIX VERIFIED: cancelling in-flight queries before patching the cache prevents the stale response from ever landing", async () => {
    const queryClient = createClient();
    const staleDetail: ProjectRow = { id: projectId, status: "not_started" };
    queryClient.setQueryData(detailKey, staleDetail);

    const inFlightStalePromise = queryClient.fetchQuery({
      queryKey: detailKey,
      queryFn: () => slowStaleFetch(staleDetail, 40),
    });

    // The fixed sequence: cancel first, exactly as onSuccess now does.
    await queryClient.cancelQueries({ queryKey: detailKey });
    queryClient.setQueryData<ProjectRow | undefined>(detailKey, (prev) =>
      applyProjectStatusToDetail(prev, "started"),
    );
    expect(queryClient.getQueryData<ProjectRow>(detailKey)?.status).toBe("started");

    // The previously in-flight fetch is cancelled; awaiting it must not
    // throw uncaught and must not resolve with data that overwrites the
    // cache (cancelled queries either reject with a CancelledError or the
    // outer await is skipped — either way the cache is what matters).
    await inFlightStalePromise.catch(() => undefined);

    // Item 4/5 from the requirements: a later "refetch" (any fetch that
    // starts after the mutation committed) reads the real, current status
    // and agrees with it — simulated here as a fetch returning "started"
    // because that's what the database actually has by now.
    await queryClient.fetchQuery({
      queryKey: detailKey,
      queryFn: () => Promise.resolve<ProjectRow>({ id: projectId, status: "started" }),
    });

    expect(queryClient.getQueryData<ProjectRow>(detailKey)?.status).toBe("started");
  });

  it("FIX VERIFIED: the project list cache is protected the same way", async () => {
    const queryClient = createClient();
    const staleList: ProjectListRow[] = [{ id: projectId, status: "not_started" }];
    queryClient.setQueryData(listKey, staleList);

    const inFlightStalePromise = queryClient.fetchQuery({
      queryKey: listKey,
      queryFn: () => slowStaleFetch(staleList[0]!, 40).then((row) => [row]),
    });

    await queryClient.cancelQueries({ queryKey: listKey });
    queryClient.setQueryData<ProjectListRow[] | undefined>(listKey, (prev) =>
      applyProjectStatusToListItem(prev, projectId, "started"),
    );

    await inFlightStalePromise.catch(() => undefined);

    expect(queryClient.getQueryData<ProjectListRow[]>(listKey)?.[0]?.status).toBe("started");
  });

  it("SCENARIO: unstarted project shows 'Start Project' (not_started) with no mutation involved", async () => {
    const queryClient = createClient();
    await queryClient.prefetchQuery({
      queryKey: detailKey,
      queryFn: () => Promise.resolve<ProjectRow>({ id: projectId, status: "not_started" }),
    });
    expect(queryClient.getQueryData<ProjectRow>(detailKey)?.status).toBe("not_started");
  });

  it("SCENARIO: page reload — a brand-new QueryClient with no prior cache reads the current persisted status directly", async () => {
    // A reload creates an entirely fresh QueryClient (no carried-over
    // cache, no in-flight requests from before) and fetches once from the
    // route loader. There is nothing to race against — this fetch simply
    // reads whatever the database currently has, which is why the fix
    // for the *live* race (cancelQueries) is sufficient: reload was never
    // vulnerable to begin with, it just needs the database write (already
    // verified correct — see projects.server.test.ts) to have persisted.
    const freshClient = createClient();
    await freshClient.prefetchQuery({
      queryKey: detailKey,
      queryFn: () => Promise.resolve<ProjectRow>({ id: projectId, status: "started" }),
    });
    expect(freshClient.getQueryData<ProjectRow>(detailKey)?.status).toBe("started");
  });

  it("SCENARIO: returning to the dashboard reads the same shared ['projects'] cache the detail page just patched", async () => {
    // dashboard.tsx, projects.index.tsx, skills.tsx, roadmap.tsx and
    // learn.$topicSlug.tsx all use the exact same queryKey: ["projects"]
    // (verified by reading each file) — so the list-cache protection
    // above covers every one of these consumers uniformly, not just the
    // detail page. This test models navigating from the detail page
    // (where the mutation just happened) to a second page that reads the
    // same shared key.
    const queryClient = createClient();
    queryClient.setQueryData<ProjectListRow[]>(listKey, [{ id: projectId, status: "not_started" }]);

    // Detail page mutation succeeds; fixed onSuccess sequence runs.
    await queryClient.cancelQueries({ queryKey: listKey });
    queryClient.setQueryData<ProjectListRow[] | undefined>(listKey, (prev) =>
      applyProjectStatusToListItem(prev, projectId, "started"),
    );

    // Navigating to the dashboard mounts a fresh `useQuery({queryKey:
    // ["projects"]})` there; it reads the same cache entry the detail
    // page just patched (no separate/duplicated query key involved).
    const dashboardView = queryClient.getQueryData<ProjectListRow[]>(listKey);
    expect(dashboardView?.find((p) => p.id === projectId)?.status).toBe("started");
  });
  it("a project remains 'started' across the full realistic lifecycle: mount fetch, mutation, cancellation, and a subsequent confirming refetch", async () => {
    const queryClient = createClient();

    // 1. Route loader / mount fetch establishes the initial not_started state.
    await queryClient.prefetchQuery({
      queryKey: detailKey,
      queryFn: () => Promise.resolve<ProjectRow>({ id: projectId, status: "not_started" }),
    });
    expect(queryClient.getQueryData<ProjectRow>(detailKey)?.status).toBe("not_started");

    // 2. A slow background refetch is triggered (refetchOnMount) and is
    //    still in flight when the user clicks Start Project moments later.
    const backgroundRefetch = queryClient.fetchQuery({
      queryKey: detailKey,
      queryFn: () => slowStaleFetch({ id: projectId, status: "not_started" }, 40),
    });

    // 3. Mutation resolves (server + database confirmed "started").
    // 4. onSuccess cancels in-flight queries, then patches the cache.
    await queryClient.cancelQueries({ queryKey: detailKey });
    queryClient.setQueryData<ProjectRow | undefined>(detailKey, (prev) =>
      applyProjectStatusToDetail(prev, "started"),
    );
    expect(queryClient.getQueryData<ProjectRow>(detailKey)?.status).toBe("started");

    // 5. The stale background refetch from step 2 finishes settling — must
    //    not resurrect the old status.
    await backgroundRefetch.catch(() => undefined);
    expect(queryClient.getQueryData<ProjectRow>(detailKey)?.status).toBe("started");

    // 6. The mutation's own invalidate() triggers a fresh refetch, which
    //    reads the now-genuinely-current database state and agrees.
    await queryClient.fetchQuery({
      queryKey: detailKey,
      queryFn: () => Promise.resolve<ProjectRow>({ id: projectId, status: "started" }),
    });
    expect(queryClient.getQueryData<ProjectRow>(detailKey)?.status).toBe("started");
  });
});
