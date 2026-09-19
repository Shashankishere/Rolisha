import {
  ENGINE_EDGES,
  ENGINE_NODES,
  ENGINE_NODE_COLOR,
  type EngineEdge,
  type EngineNode,
} from "@/components/marketing/engine-network-data";

/** A flat orthographic projection of the same node/edge data used by the
 * 3D scene, so swapping between this and the WebGL version causes no
 * layout shift. This is what's shown before the 3D bundle loads, and the
 * only thing shown under prefers-reduced-motion. */
export function EngineNetworkStatic({
  className,
  nodes = ENGINE_NODES,
  edges = ENGINE_EDGES,
}: {
  className?: string;
  nodes?: EngineNode[];
  edges?: EngineEdge[];
}) {
  const project = (x: number, y: number) => ({ cx: 200 + x * 130, cy: 180 - y * 110 });

  return (
    <svg
      viewBox="0 0 400 360"
      className={className}
      role="img"
      aria-label="A network diagram connecting a target career to its required skills, roadmap months, projects, and a matching job."
    >
      <g strokeWidth={1}>
        {edges.map((edge) => {
          const from = nodes.find((n) => n.id === edge.from)!;
          const to = nodes.find((n) => n.id === edge.to)!;
          const a = project(from.x, from.y);
          const b = project(to.x, to.y);
          return (
            <line
              key={`${edge.from}-${edge.to}`}
              x1={a.cx}
              y1={a.cy}
              x2={b.cx}
              y2={b.cy}
              stroke="var(--border)"
            />
          );
        })}
      </g>
      {nodes.map((node) => {
        const { cx, cy } = project(node.x, node.y);
        const r = node.kind === "career" ? 9 : 5.5;
        return (
          <g key={node.id}>
            <circle cx={cx} cy={cy} r={r} fill={ENGINE_NODE_COLOR[node.kind]} opacity={0.9} />
            <text
              x={cx}
              y={cy + r + 13}
              textAnchor="middle"
              fontSize={10}
              fill="var(--muted-foreground)"
              fontFamily="var(--font-sans)"
            >
              {node.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
