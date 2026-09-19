/** A slim, indeterminate progress bar pinned to the top of the viewport,
 * shown while a route transition is loading data (see router.tsx's
 * defaultPendingComponent). Previously there was no global loading
 * feedback at all — a slow route loader just looked like a frozen page. */
export function RouteLoadingBar() {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5 overflow-hidden bg-transparent">
      <div className="bg-primary h-full w-1/3 animate-[route-loading_1.1s_ease-in-out_infinite]" />
    </div>
  );
}
