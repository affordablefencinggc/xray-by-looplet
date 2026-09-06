import type { Primitive } from "./drawing";
import { arcPath, ringsPath } from "./drawing";
export function DrawingPrimitives({
  items,
  selected,
  onPick,
}: {
  items: Primitive[];
  selected?: string | null;
  onPick?: (id: string) => void;
}) {
  return (
    <>
      {items.map((p, i) => {
        const style = {
            stroke: p.id === selected ? "#ad553d" : (p.stroke ?? "none"),
            strokeWidth: p.id === selected ? Math.max(p.width ?? 10, 24) : (p.width ?? 10),
            fill: p.fill ?? "none",
          },
          props = {
            "data-entity-id": p.id,
            onClick: () => p.id && onPick?.(p.id),
            style,
            strokeDasharray: p.dash ? "160 100" : undefined,
            vectorEffect: undefined,
          };
        if (p.kind === "path")
          return <path key={i} {...props} d={ringsPath(p.rings!)} fillRule="evenodd" />;
        if (p.kind === "line")
          return (
            <line
              key={i}
              {...props}
              x1={p.points![0][0]}
              y1={p.points![0][1]}
              x2={p.points![1][0]}
              y2={p.points![1][1]}
            />
          );
        if (p.kind === "circle")
          return <circle key={i} {...props} cx={p.center![0]} cy={p.center![1]} r={p.radius} />;
        if (p.kind === "arc") return <path key={i} {...props} d={arcPath(p)} />;
        return (
          <text
            key={i}
            data-entity-id={p.id}
            onClick={() => p.id && onPick?.(p.id)}
            x={p.center![0]}
            y={p.center![1]}
            textAnchor="middle"
            fontSize={p.size ?? 150}
            fill={p.id === selected ? "#ad553d" : (p.fill ?? "#26343d")}
            fontFamily="Arial, sans-serif"
          >
            {p.text}
          </text>
        );
      })}
    </>
  );
}
