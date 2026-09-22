import { useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import {
  ENGINE_EDGES,
  ENGINE_NODES,
  type EngineEdge,
  type EngineNode,
  type EngineNodeKind,
} from "@/components/marketing/engine-network-data";

/* Hardcoded to match the dark-theme design tokens (this scene only ever
 * renders on the dark-scoped marketing pages) — resolving CSS custom
 * properties containing oklch() to a THREE.Color at runtime isn't reliably
 * supported across browsers, so the actual token values are mirrored here
 * directly rather than read from CSS. */
const NODE_COLOR: Record<EngineNodeKind, string> = {
  career: "#8fa2ff",
  skill: "#8fa2ff",
  roadmap: "#98a2b8",
  project: "#e8b368",
  job: "#e8b368",
};
const EDGE_COLOR_IDLE = "#3a4256";
const EDGE_COLOR_ACTIVE = "#a9b9ff";

const SCALE = 1.3;
/** Kept deliberately small — a few dozen points read as "ambient depth"
 * without adding meaningful GPU cost; this renders as a single draw call
 * (one THREE.Points object), not per-particle geometry. */
const PARTICLE_COUNT = 90;

function AmbientParticles() {
  const positions = useMemo(() => {
    const arr = new Float32Array(PARTICLE_COUNT * 3);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      // Scatter within a sphere shell around the node network so particles
      // read as depth/atmosphere behind the graph, not as their own object.
      const r = 1.6 + Math.random() * 1.4;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      arr[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      arr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      arr[i * 3 + 2] = r * Math.cos(phi);
    }
    return arr;
  }, []);
  const ref = useRef<THREE.Points>(null);

  useFrame((state) => {
    if (!ref.current) return;
    ref.current.rotation.y = state.clock.elapsedTime * 0.015;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color="#8fa2ff"
        size={0.02}
        sizeAttenuation
        transparent
        opacity={0.35}
        depthWrite={false}
      />
    </points>
  );
}

function Node({
  node,
  hovered,
  onHover,
}: {
  node: EngineNode;
  hovered: boolean;
  onHover: (id: string | null) => void;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const isCareer = node.kind === "career";
  const baseScale = isCareer ? 0.17 : 0.095;

  useFrame(() => {
    if (!ref.current) return;
    const target = hovered ? baseScale * 1.7 : baseScale;
    ref.current.scale.lerp(new THREE.Vector3(target, target, target), 0.18);
  });

  return (
    <mesh
      ref={ref}
      position={[node.x * SCALE, node.y * SCALE, node.z * SCALE]}
      scale={baseScale}
      onPointerOver={(e) => {
        e.stopPropagation();
        onHover(node.id);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        onHover(null);
        document.body.style.cursor = "auto";
      }}
    >
      <sphereGeometry args={[1, 24, 24]} />
      <meshStandardMaterial
        color={NODE_COLOR[node.kind]}
        emissive={NODE_COLOR[node.kind]}
        emissiveIntensity={isCareer ? 0.7 : hovered ? 0.55 : 0.18}
        roughness={0.35}
        metalness={0.15}
      />
    </mesh>
  );
}

function Edge({ from, to, active }: { from: EngineNode; to: EngineNode; active: boolean }) {
  const positions = useMemo(
    () =>
      new Float32Array([
        from.x * SCALE,
        from.y * SCALE,
        from.z * SCALE,
        to.x * SCALE,
        to.y * SCALE,
        to.z * SCALE,
      ]),
    [from, to],
  );
  return (
    <line>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <lineBasicMaterial
        color={active ? EDGE_COLOR_ACTIVE : EDGE_COLOR_IDLE}
        transparent
        opacity={active ? 0.9 : 0.4}
      />
    </line>
  );
}

function PointerParallax() {
  const { camera } = useThree();
  const target = useRef({ x: 0, y: 0 });

  useMemo(() => {
    const handler = (e: PointerEvent) => {
      target.current = {
        x: (e.clientX / window.innerWidth) * 2 - 1,
        y: (e.clientY / window.innerHeight) * 2 - 1,
      };
    };
    window.addEventListener("pointermove", handler);
    return () => window.removeEventListener("pointermove", handler);
  }, []);

  useFrame(() => {
    camera.position.x = THREE.MathUtils.lerp(camera.position.x, target.current.x * 0.35, 0.04);
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, -target.current.y * 0.25, 0.04);
    camera.lookAt(0, 0, 0);
  });
  return null;
}

function Scene({ nodes, edges }: { nodes: EngineNode[]; edges: EngineEdge[] }) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y += delta * 0.06;
    groupRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.35) * 0.06;
  });

  return (
    <>
      <ambientLight intensity={0.55} />
      <pointLight position={[3, 3, 4]} intensity={40} color="#c9d3ff" />
      <PointerParallax />
      <AmbientParticles />
      <group ref={groupRef}>
        {edges.map((edge) => {
          const from = nodes.find((n) => n.id === edge.from)!;
          const to = nodes.find((n) => n.id === edge.to)!;
          const active = hoveredId === edge.from || hoveredId === edge.to;
          return <Edge key={`${edge.from}-${edge.to}`} from={from} to={to} active={active} />;
        })}
        {nodes.map((node) => (
          <Node key={node.id} node={node} hovered={hoveredId === node.id} onHover={setHoveredId} />
        ))}
      </group>
    </>
  );
}

/** The real WebGL scene. Lazy-imported by `career-engine-3d.tsx` (and by
 * `skill-constellation-section.tsx`, which reuses this exact chunk with a
 * different node/edge dataset rather than shipping a second WebGL bundle)
 * so Three.js never ships in the initial page bundle; only mounted
 * client-side, never during SSR, and never under prefers-reduced-motion
 * (see each wrapper). */
export default function CareerEngineScene({
  nodes = ENGINE_NODES,
  edges = ENGINE_EDGES,
}: {
  nodes?: EngineNode[];
  edges?: EngineEdge[];
}) {
  return (
    <Canvas
      dpr={[1, 1.75]}
      camera={{ position: [0, 0, 3.1], fov: 42 }}
      gl={{ alpha: true, antialias: true }}
    >
      <Scene nodes={nodes} edges={edges} />
    </Canvas>
  );
}
