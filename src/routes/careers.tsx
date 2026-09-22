import { createFileRoute, Link, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/careers")({
  component: () => <Outlet />,
  notFoundComponent: () => (
    <div className="mx-auto max-w-2xl px-4 py-24 text-center">
      <h1 className="text-2xl font-semibold">Career path not found</h1>
      <p className="text-muted-foreground mt-3 text-sm">
        That career path is not part of the catalogue.
      </p>
      <Link to="/careers" className="text-primary mt-6 inline-block text-sm font-medium">
        Browse all career paths
      </Link>
    </div>
  ),
});
