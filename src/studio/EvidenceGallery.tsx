import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, GripHorizontal, Grid2X2, PanelsTopLeft } from "lucide-react";

export type GalleryItem = { id: string; title: string; preview: ReactNode };
export function EvidenceGallery({
  items,
  activeId,
  onSelect,
  children,
  tools,
}: {
  items: GalleryItem[];
  activeId: string;
  onSelect: (id: string) => void;
  children: ReactNode;
  tools: ReactNode;
}) {
  const [layout, setLayout] = useState<"filmstrip" | "grid">("filmstrip");
  const [height, setHeight] = useState(170);
  const drag = useRef<{ y: number; height: number } | null>(null),
    strip = useRef<HTMLDivElement>(null);
  const index = Math.max(
    0,
    items.findIndex((i) => i.id === activeId),
  );
  const select = (offset: number) =>
    onSelect(items[(index + offset + items.length) % items.length].id);
  useEffect(() => {
    strip.current
      ?.querySelector('[aria-pressed="true"]')
      ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeId, layout]);
  return (
    <div
      className="evidence-gallery"
      style={{ "--gallery-strip-height": `${height}px` } as CSSProperties}
      onKeyDown={(e) => {
        if (
          (e.target as HTMLElement).closest(
            'input,textarea,select,[contenteditable="true"], [role="separator"]',
          )
        )
          return;
        if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
          e.preventDefault();
          select(e.key === "ArrowLeft" ? -1 : 1);
        }
      }}
    >
      <div className="gallery-viewer">
        <div className="gallery-image-label">
          <span>Evidence preview</span>
          <strong>{items[index]?.title}</strong>
        </div>
        <div className="gallery-position" aria-live="polite">
          {index + 1} / {items.length}
        </div>
        <div className="gallery-image-content">{children}</div>
        <button
          className="gallery-previous"
          aria-label="Previous image"
          disabled={items.length < 2}
          onClick={() => select(-1)}
        >
          <ChevronLeft size={28} />
        </button>
        <button
          className="gallery-next"
          aria-label="Next image"
          disabled={items.length < 2}
          onClick={() => select(1)}
        >
          <ChevronRight size={28} />
        </button>
      </div>
      <aside className="gallery-tools" aria-label="Preview tools and details">
        {tools}
      </aside>
      <div className="gallery-browser">
        <div
          role="separator"
          tabIndex={0}
          aria-label="Resize photo filmstrip"
          aria-orientation="horizontal"
          aria-valuemin={110}
          aria-valuemax={300}
          aria-valuenow={height}
          className="gallery-strip-resizer"
          onKeyDown={(e) => {
            if (e.key === "ArrowUp" || e.key === "ArrowDown") {
              e.preventDefault();
              setHeight((h) => Math.max(110, Math.min(300, h + (e.key === "ArrowUp" ? 20 : -20))));
            }
          }}
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            drag.current = { y: e.clientY, height };
          }}
          onPointerMove={(e) => {
            if (drag.current)
              setHeight(
                Math.max(110, Math.min(300, drag.current.height + drag.current.y - e.clientY)),
              );
          }}
          onPointerUp={(e) => {
            drag.current = null;
            if (e.currentTarget.hasPointerCapture(e.pointerId))
              e.currentTarget.releasePointerCapture(e.pointerId);
          }}
          onPointerCancel={() => {
            drag.current = null;
          }}
        >
          <GripHorizontal size={20} />
        </div>
        <div className="gallery-layout-switch">
          <button aria-pressed={layout === "filmstrip"} onClick={() => setLayout("filmstrip")}>
            <PanelsTopLeft size={14} />
            Filmstrip
          </button>
          <button aria-pressed={layout === "grid"} onClick={() => setLayout("grid")}>
            <Grid2X2 size={14} />
            Grid
          </button>
        </div>
        <div
          className="gallery-thumbnails"
          ref={strip}
          data-layout={layout}
          aria-label="Image selector"
        >
          {items.map((item, i) => (
            <button
              key={item.id}
              aria-label={`Select image ${i + 1}: ${item.title}`}
              aria-pressed={item.id === activeId}
              onClick={() => onSelect(item.id)}
            >
              {item.preview}
              <span>
                {i + 1} · {item.title}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
