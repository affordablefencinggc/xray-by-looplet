import { useEffect, useRef, useState } from "react";
import { sourceViewport, type SourcePage } from "./documentViewport";
import type { AiProposal } from "./construction/aiMaterials";

export function AiEvidenceRegion({
  page,
  box,
}: {
  page: SourcePage | null;
  box: AiProposal["evidence"]["box"];
}) {
  const ref = useRef<HTMLDivElement>(null),
    [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    if (!ref.current) return;
    const observer = new ResizeObserver(([e]) =>
      setSize({ width: e.contentRect.width, height: e.contentRect.height }),
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  const v = page ? sourceViewport(page.bounds, size.width, size.height) : null;
  return (
    <div ref={ref} className="material-ai-evidence-overlay">
      {page && v && (
        <div
          data-ai-evidence-region
          className="material-ai-evidence-box"
          style={{
            left: v.x + (page.bounds.x + box.x * page.bounds.width) * v.scale,
            top: v.y + (page.bounds.y + box.y * page.bounds.height) * v.scale,
            width: box.width * page.bounds.width * v.scale,
            height: box.height * page.bounds.height * v.scale,
          }}
        >
          <span>AI evidence · verify against drawing</span>
        </div>
      )}
    </div>
  );
}
