import { createFileRoute } from "@tanstack/react-router";
import { Studio } from "@/studio/Studio";
import { WorkspaceStartup } from "@/studio/WorkspaceStartup";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <WorkspaceStartup><Studio /></WorkspaceStartup>;
}
