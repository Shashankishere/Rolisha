export type EngineNodeKind = "career" | "skill" | "roadmap" | "project" | "job";

export interface EngineNode {
  id: string;
  label: string;
  kind: EngineNodeKind;
  /** Normalized position, roughly -1..1 on each axis. */
  x: number;
  y: number;
  z: number;
}

export interface EngineEdge {
  from: string;
  to: string;
}

/** One central career node, orbited by skill / roadmap / project / job
 * nodes — a small, legible network rather than a dense graph, so every
 * node is individually readable on hover. */
export const ENGINE_NODES: EngineNode[] = [
  { id: "career", label: "Data Analyst", kind: "career", x: 0, y: 0, z: 0 },

  { id: "skill-sql", label: "SQL", kind: "skill", x: -0.85, y: 0.5, z: 0.3 },
  { id: "skill-python", label: "Python", kind: "skill", x: 0.9, y: 0.55, z: -0.2 },
  { id: "skill-stats", label: "Statistics", kind: "skill", x: -0.55, y: -0.75, z: -0.35 },
  { id: "skill-viz", label: "Data Viz", kind: "skill", x: 0.6, y: -0.8, z: 0.25 },

  { id: "roadmap-m1", label: "Month 1", kind: "roadmap", x: -1.15, y: 0.05, z: -0.5 },
  { id: "roadmap-m3", label: "Month 3", kind: "roadmap", x: 1.2, y: -0.05, z: 0.45 },

  { id: "project-churn", label: "Churn Project", kind: "project", x: -0.35, y: 1.05, z: 0.15 },
  { id: "project-dash", label: "Dashboard Project", kind: "project", x: 0.4, y: 1.1, z: -0.15 },

  { id: "job-1", label: "Live Job Match", kind: "job", x: 0, y: -1.2, z: 0.1 },
];

export const ENGINE_EDGES: EngineEdge[] = [
  { from: "career", to: "skill-sql" },
  { from: "career", to: "skill-python" },
  { from: "career", to: "skill-stats" },
  { from: "career", to: "skill-viz" },
  { from: "skill-sql", to: "roadmap-m1" },
  { from: "skill-python", to: "roadmap-m3" },
  { from: "skill-sql", to: "project-churn" },
  { from: "skill-viz", to: "project-dash" },
  { from: "career", to: "job-1" },
  { from: "skill-stats", to: "job-1" },
];

export const ENGINE_NODE_COLOR: Record<EngineNodeKind, string> = {
  career: "var(--primary)",
  skill: "var(--primary)",
  roadmap: "var(--muted-foreground)",
  project: "var(--accent)",
  job: "var(--accent)",
};

/** A smaller, skill-focused constellation for the "Skill Intelligence"
 * marketing section — reuses the same 3D scene component/chunk as the
 * hero, with a different dataset, rather than shipping a second WebGL
 * bundle. Example: SQL + Python + Statistics converging on Data Analyst. */
export const CONSTELLATION_NODES: EngineNode[] = [
  { id: "target", label: "Data Analyst", kind: "career", x: 0, y: 0, z: 0 },
  { id: "c-sql", label: "SQL", kind: "skill", x: -0.95, y: 0.6, z: 0.2 },
  { id: "c-python", label: "Python", kind: "skill", x: -0.95, y: -0.6, z: -0.2 },
  { id: "c-stats", label: "Statistics", kind: "skill", x: 0.9, y: 0.15, z: 0.35 },
  { id: "c-excel", label: "Excel", kind: "skill", x: 0.75, y: -0.85, z: -0.3 },
];
export const CONSTELLATION_EDGES: EngineEdge[] = [
  { from: "c-sql", to: "c-stats" },
  { from: "c-sql", to: "target" },
  { from: "c-python", to: "target" },
  { from: "c-stats", to: "target" },
  { from: "c-excel", to: "target" },
];
