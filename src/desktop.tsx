import { createRoot } from "react-dom/client";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { PreviewHostBridge } from "./components/preview-host-bridge";
import { AuthProvider } from "./lib/auth/provider";
import { AppErrorComponent } from "./lib/error-component";
import { Studio } from "./studio/Studio";
import { FloorConstructionStudio } from "./studio/FloorConstructionStudio";
import "./styles.css";

// The desktop document owns <html>/<body>; reuse the product and providers
// without mounting TanStack Start's server document inside a second document.
const rootRoute = createRootRoute({
  component: () => (
    <>
      <PreviewHostBridge />
      <AuthProvider><Outlet /></AuthProvider>
    </>
  ),
});
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: Studio,
});
const router = createRouter({
  routeTree: rootRoute.addChildren([indexRoute, createRoute({
    getParentRoute: () => rootRoute,
    path: "/floor-lab",
    component: FloorConstructionStudio,
  })]),
  // Packaged URLs end in index.html. Pane state belongs to Studio, while
  // the router keeps its normal root route and the preview bridge context.
  history: createMemoryHistory({ initialEntries: [`/${window.location.search}`] }),
  defaultErrorComponent: AppErrorComponent,
});

const container = document.getElementById("root");
if (!container) throw new Error("The desktop application mount is missing.");
createRoot(container).render(<RouterProvider router={router} />);
