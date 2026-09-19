import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { RouteLoadingBar } from "@/components/app/route-loading-bar";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    // Previously there was no global pending UI at all — a route loader
    // slower than instant just looked like the click did nothing. Only
    // show the bar past 300ms so fast, cached navigations stay silent.
    defaultPendingComponent: RouteLoadingBar,
    defaultPendingMs: 300,
    defaultPendingMinMs: 300,
  });

  return router;
};
