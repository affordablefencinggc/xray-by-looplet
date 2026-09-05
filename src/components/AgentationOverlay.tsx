import { Component, useEffect, useState, type ReactNode } from "react";

type AgentationComponent = typeof import("agentation").Agentation;

/** Annotation tooling must never prevent the workbench from rendering. */
class AnnotationBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    console.warn("Agentation could not start; the workbench remains available.", error);
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/** Local development only: no server render, production bundle, or sync endpoint. */
export function AgentationOverlay() {
  const [AnnotationTool, setAnnotationTool] = useState<AgentationComponent | null>(null);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    let mounted = true;
    void import("agentation")
      .then(({ Agentation }) => {
        if (mounted) setAnnotationTool(() => Agentation);
      })
      .catch((error: unknown) => {
        console.warn("Agentation could not load; the workbench remains available.", error);
      });
    return () => {
      mounted = false;
    };
  }, []);

  if (!import.meta.env.DEV || !AnnotationTool) return null;
  return (
    <AnnotationBoundary>
      <AnnotationTool />
    </AnnotationBoundary>
  );
}
