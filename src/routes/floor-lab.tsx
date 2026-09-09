import { createFileRoute } from "@tanstack/react-router";
import { FloorConstructionStudio } from "@/studio/FloorConstructionStudio";

export const Route = createFileRoute("/floor-lab")({ component: FloorConstructionStudio });
