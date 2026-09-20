import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { BOOT_GUARD_SOURCE } from "@/lib/boot-guard";
// Let Start's client manifest supply the SSR stylesheet URL. A separate ?url
// transform can produce a server-only CSS hash that the client build never emits.
import "../styles.css";

const APP_NAME = "X-Ray by Looplet";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: APP_NAME },
      {
        name: "description",
        content:
          "Architectural construction-plan takeoff studio. PDF in, scale, mark, evidence, BOM — quantities never invented.",
      },
      { name: "theme-color", content: "#050b14" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
    ],
  }),
  component: () => (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <PreviewHostBridge />
        <AuthProvider>
          <Outlet />
        </AuthProvider>
        {/* A classic inline script runs before any deferred module, so this is
            the one place that executes ahead of every dependency in the bundle.
            polygon-clipping's bundled splaytree assigns Tree.prototype.toString
            at module-evaluation time; were toString read-only, that throw would
            abort the route module, and no render boundary can catch a module
            that never finished evaluating. */}
        <script dangerouslySetInnerHTML={{ __html: BOOT_GUARD_SOURCE }} />
        <Scripts />
      </body>
    </html>
  ),
});
