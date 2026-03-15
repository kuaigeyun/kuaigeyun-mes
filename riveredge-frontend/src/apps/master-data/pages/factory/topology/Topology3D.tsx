/**
 * 3D 工厂拓扑视图
 *
 * 使用 Three.js 以 3D 方式展示工厂层级结构，采用 Kenney 开源工业模型（CC0）。
 */

import React, { useMemo, useLayoutEffect, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Html, useGLTF, Grid, QuadraticBezierLine } from '@react-three/drei';
import * as THREE from 'three';
import { clone as cloneScene } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { FactoryTopologyNode, FactoryTopologyEdge } from '../../../services/factory';

const LEVEL_COLORS: Record<number, { fill: string; stroke: string }> = {
  0: { fill: '#F0F5FF', stroke: '#597EF7' },
  1: { fill: '#E6F7FF', stroke: '#1890FF' },
  2: { fill: '#F6FFED', stroke: '#52C41A' },
  3: { fill: '#FFF7E6', stroke: '#FA8C16' },
  4: { fill: '#FFF1F0', stroke: '#F5222D' },
};

/** 节点类型对应的 Kenney 工业模型（CC0），工作中心为虚拟概念不占模型 */
const MODEL_BY_TYPE: Record<string, string> = {
  root: '/models/building-a.glb',
  plant: '/models/building-b.glb',
  workshop: '/models/building-c.glb',
  production_line: '/models/building-d.glb',
  workstation: '/models/building-h.glb',
};

/** 各类型模型缩放比例（真实车间尺度，模型为主体） */
const SCALE_BY_TYPE: Record<string, number> = {
  root: 2.8,
  plant: 2.4,
  workshop: 2.0,
  production_line: 1.6,
  workstation: 1.4,
};

const X_SPACING = 8;
const Y_SPACING = 9;
const NODE_SIZE = 0.8;

/** 预加载所有模型 */
function preloadModels() {
  Object.values(MODEL_BY_TYPE).forEach((url) => {
    useGLTF.preload(url);
  });
}

const FLOOR_Y = 0; // 地面高度，所有节点放置在此平面上
const WORK_CENTER_Y = 7.5; // 工作中心标识 Y 轴层级，高于模型与标签
const WORK_CENTER_X_OFFSET = 4; // 同平面工作中心 X 轴错开，避免重叠

/** 布局结果：位置映射 + 边界（用于地面） */
interface LayoutResult {
  posMap: Map<string, [number, number, number]>;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
}

/** 计算节点 3D 布局位置（X-Z 平面，Y 为地面高度） */
function computeLayout(
  nodes: FactoryTopologyNode[],
  _edges: FactoryTopologyEdge[]
): LayoutResult {
  const posMap = new Map<string, [number, number, number]>();

  const byDepth = new Map<number, FactoryTopologyNode[]>();
  for (const n of nodes) {
    const depth = (n.data as { depth?: number })?.depth ?? 0;
    const list = byDepth.get(depth) ?? [];
    list.push(n);
    byDepth.set(depth, list);
  }

  const depths = Array.from(byDepth.keys()).sort((a, b) => a - b);
  const maxDepth = Math.max(...depths, 0);

  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  for (const depth of depths) {
    const list = (byDepth.get(depth) ?? []).sort((a, b) => {
      const codeA = (a.data as { code?: string })?.code ?? a.id;
      const codeB = (b.data as { code?: string })?.code ?? b.id;
      return codeB.localeCompare(codeA, undefined, { numeric: true });
    });
    const z = (maxDepth - depth) * Y_SPACING;
    const totalWidth = (list.length - 1) * X_SPACING;
    const startX = -totalWidth / 2;

    list.forEach((n, i) => {
      const x = startX + i * X_SPACING;
      posMap.set(n.id, [x, FLOOR_Y, z]);
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minZ = Math.min(minZ, z);
      maxZ = Math.max(maxZ, z);
    });
  }

  const bounds = {
    minX: minX === Infinity ? -20 : minX - 15,
    maxX: maxX === -Infinity ? 20 : maxX + 15,
    minZ: minZ === Infinity ? -20 : minZ - 15,
    maxZ: maxZ === -Infinity ? 20 : maxZ + 15,
  };

  return { posMap, bounds };
}

/** 带 GLB 模型的 3D 节点 */
const ModelNode3D: React.FC<{
  node: FactoryTopologyNode;
  position: [number, number, number];
  onClick: (node: FactoryTopologyNode) => void;
}> = ({ node, position, onClick }) => {
  const modelUrl = MODEL_BY_TYPE[node.type] ?? MODEL_BY_TYPE.workstation;
  const scale = SCALE_BY_TYPE[node.type] ?? 1.4;
  const { scene } = useGLTF(modelUrl);
  const clone = useMemo(() => cloneScene(scene), [scene]);
  const depth = (node.data as { depth?: number })?.depth ?? 0;
  const colors = LEVEL_COLORS[depth] ?? { fill: '#f0f0f0', stroke: '#d9d9d9' };
  const code = (node.data as { code?: string })?.code;
  const name = (node.data as { name?: string })?.name;

  useLayoutEffect(() => {
    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const mat = mesh.material as THREE.MeshStandardMaterial;
        if (mat?.color) mat.color.set(colors.stroke);
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((m) => {
            if ((m as THREE.MeshStandardMaterial).color) {
              (m as THREE.MeshStandardMaterial).color.set(colors.stroke);
            }
          });
        }
      }
    });
  }, [clone, colors.stroke]);

  return (
    <group
      position={position}
      scale={scale}
      onClick={(e) => {
        e.stopPropagation();
        onClick(node);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        document.body.style.cursor = 'default';
      }}
    >
      <primitive object={clone} />
      <Html
        position={[0, 2.2, 0]}
        center
        zIndexRange={[50, 1]}
        style={{
          pointerEvents: 'none',
          userSelect: 'none',
          textAlign: 'center',
          fontSize: 11,
          color: '#fff',
          fontWeight: 600,
          textShadow: '0 1px 3px rgba(0,0,0,0.8)',
          padding: '4px 8px',
          background: 'rgba(0,0,0,0.5)',
          borderRadius: 4,
        }}
      >
        {code && name ? (
          <>
            <div style={{ whiteSpace: 'nowrap' }}>{code}</div>
            <div style={{ whiteSpace: 'nowrap' }}>{name}</div>
          </>
        ) : (
          <div style={{ whiteSpace: 'nowrap' }}>{node.label}</div>
        )}
      </Html>
    </group>
  );
};

/** 工作中心虚拟标识：在工位上方用连线+标签表示，无实体模型 */
const WorkCenterIndicator: React.FC<{
  node: FactoryTopologyNode;
  workstationPositions: [number, number, number][];
  xOffset: number;
  onClick: (node: FactoryTopologyNode) => void;
}> = ({ node, workstationPositions, xOffset, onClick }) => {
  const code = (node.data as { code?: string })?.code;
  const name = (node.data as { name?: string })?.name;
  const depth = (node.data as { depth?: number })?.depth ?? 0;
  const colors = LEVEL_COLORS[depth] ?? { fill: '#f0f0f0', stroke: '#d9d9d9' };

  const { labelPos, centerX, centerZ } = useMemo(() => {
    if (workstationPositions.length === 0) return { labelPos: [0, WORK_CENTER_Y, 0] as [number, number, number], centerX: 0, centerZ: 0 };
    const y = WORK_CENTER_Y;
    const xs = workstationPositions.map((p) => p[0]);
    const zs = workstationPositions.map((p) => p[2]);
    const centerX = (Math.min(...xs) + Math.max(...xs)) / 2 + xOffset;
    const centerZ = (Math.min(...zs) + Math.max(...zs)) / 2;
    const labelPos: [number, number, number] = [centerX, y + 0.8, centerZ];
    return { labelPos, centerX, centerZ };
  }, [workstationPositions, xOffset]);

  if (workstationPositions.length === 0) return null;

  return (
    <group>
      {workstationPositions.map((pos, i) => {
        const [x, , z] = pos;
        const start: [number, number, number] = [x, 0.6, z];
        const end: [number, number, number] = [centerX, WORK_CENTER_Y - 0.1, centerZ];
        const arcOffset = (i - (workstationPositions.length - 1) / 2) * 2;
        const mid: [number, number, number] = [
          (x + centerX) / 2 + arcOffset,
          WORK_CENTER_Y * 0.55,
          (z + centerZ) / 2,
        ];
        return (
          <QuadraticBezierLine
            key={`${x}-${z}`}
            start={start}
            end={end}
            mid={mid}
            segments={24}
            color={colors.stroke}
            lineWidth={1.2}
            dashed
            dashSize={0.35}
            gapSize={0.22}
            transparent
            opacity={0.7}
          />
        );
      })}
      <Html
        position={labelPos}
        center
        zIndexRange={[50, 1]}
        style={{
          pointerEvents: 'auto',
          userSelect: 'none',
          textAlign: 'center',
          fontSize: 10,
          color: colors.stroke,
          fontWeight: 600,
          textShadow: '0 1px 2px rgba(255,255,255,0.9)',
          padding: '2px 6px',
          background: 'rgba(255,255,255,0.85)',
          borderRadius: 4,
          border: `1px solid ${colors.stroke}`,
          cursor: 'pointer',
        }}
        onClick={() => onClick(node)}
      >
        {code && name ? (
          <>
            <div style={{ whiteSpace: 'nowrap' }}>{code}</div>
            <div style={{ whiteSpace: 'nowrap' }}>{name}</div>
          </>
        ) : (
          <div style={{ whiteSpace: 'nowrap' }}>{node.label}</div>
        )}
      </Html>
    </group>
  );
};

/** 3D 边：虚线 + 二次贝塞尔曲线，地面层连线 */
const Edge3D: React.FC<{
  sourcePos: [number, number, number];
  targetPos: [number, number, number];
  floorY: number;
}> = ({ sourcePos, targetPos, floorY }) => {
  const { start, end, mid } = useMemo(() => {
    const [sx, , sz] = sourcePos;
    const [tx, , tz] = targetPos;
    const y = floorY + 0.08;
    const start: [number, number, number] = [sx, y, sz];
    const end: [number, number, number] = [tx, y, tz];
    const arcHeight = 1.5;
    const mid: [number, number, number] = [
      (sx + tx) / 2,
      y + arcHeight,
      (sz + tz) / 2,
    ];
    return { start, end, mid };
  }, [sourcePos, targetPos, floorY]);
  return (
    <QuadraticBezierLine
      start={start}
      end={end}
      mid={mid}
      segments={24}
      color="#4a5a6a"
      lineWidth={1.2}
      dashed
      dashSize={0.35}
      gapSize={0.22}
      transparent
      opacity={0.75}
    />
  );
};

/** 车间地面（X-Z 平面，Y 为高度）+ 淡化网格线 */
const WorkshopFloor: React.FC<{
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
}> = ({ bounds }) => {
  const w = Math.max(bounds.maxX - bounds.minX, 60);
  const h = Math.max(bounds.maxZ - bounds.minZ, 60);
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cz = (bounds.minZ + bounds.maxZ) / 2;
  const floorY = -0.1;

  return (
    <group position={[cx, floorY, cz]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial
          color="#b8c4d0"
          roughness={0.92}
          metalness={0.02}
        />
      </mesh>
      <Grid
        position={[0, 0.01, 0]}
        args={[w, h]}
        cellSize={3}
        cellThickness={0.25}
        sectionSize={12}
        sectionThickness={0.4}
        fadeDistance={Math.max(w, h) * 0.9}
        fadeStrength={1.5}
        cellColor="#b8c0c8"
        sectionColor="#a8b0b8"
        infiniteGrid={false}
      />
    </group>
  );
};

/** 加载占位 */
const ModelFallback: React.FC<{
  node: FactoryTopologyNode;
  position: [number, number, number];
  onClick: (node: FactoryTopologyNode) => void;
}> = ({ node, position, onClick }) => {
  const depth = (node.data as { depth?: number })?.depth ?? 0;
  const colors = LEVEL_COLORS[depth] ?? { fill: '#f0f0f0', stroke: '#d9d9d9' };
  const code = (node.data as { code?: string })?.code;
  const name = (node.data as { name?: string })?.name;

  return (
    <group position={position}>
      <mesh
        onClick={(e) => {
          e.stopPropagation();
          onClick(node);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          document.body.style.cursor = 'default';
        }}
      >
        <boxGeometry args={[NODE_SIZE * 1.5, NODE_SIZE, NODE_SIZE * 0.4]} />
        <meshStandardMaterial color={colors.stroke} />
      </mesh>
      <Html
        position={[0, 0, NODE_SIZE * 0.25]}
        center
        zIndexRange={[50, 1]}
        style={{
          pointerEvents: 'none',
          userSelect: 'none',
          textAlign: 'center',
          fontSize: 10,
          color: '#fff',
          fontWeight: 600,
          textShadow: '0 1px 2px rgba(0,0,0,0.5)',
        }}
      >
        {code && name ? (
          <>
            <div style={{ whiteSpace: 'nowrap' }}>{code}</div>
            <div style={{ whiteSpace: 'nowrap' }}>{name}</div>
          </>
        ) : (
          <div style={{ whiteSpace: 'nowrap' }}>{node.label}</div>
        )}
      </Html>
    </group>
  );
};

export interface Topology3DProps {
  nodes: FactoryTopologyNode[];
  edges: FactoryTopologyEdge[];
  onNodeClick: (node: FactoryTopologyNode) => void;
}

const Topology3DContent: React.FC<Topology3DProps> = ({
  nodes,
  edges,
  onNodeClick,
}) => {
  const { posMap, processedEdges, bounds, workCenterToWorkstations } = useMemo(() => {
    const reversedEdges = edges.map((e) => {
      const isWcToWs =
        e.source.startsWith('work_center_') && e.target.startsWith('workstation_');
      return isWcToWs ? { source: e.target, target: e.source } : e;
    });
    const { posMap: map, bounds: b } = computeLayout(nodes, reversedEdges);
    const wcToWs = new Map<string, string[]>();
    for (const e of edges) {
      if (e.source.startsWith('work_center_') && e.target.startsWith('workstation_')) {
        const list = wcToWs.get(e.source) ?? [];
        list.push(e.target);
        wcToWs.set(e.source, list);
      }
    }
    const plToWc = new Map<string, string[]>();
    for (const e of edges) {
      if (e.source.startsWith('production_line_') && e.target.startsWith('work_center_')) {
        const list = plToWc.get(e.source) ?? [];
        list.push(e.target);
        plToWc.set(e.source, list);
      }
    }
    const syntheticPlToWs: { source: string; target: string }[] = [];
    plToWc.forEach((wcIds, plId) => {
      wcIds.forEach((wcId) => {
        (wcToWs.get(wcId) ?? []).forEach((wsId) => {
          syntheticPlToWs.push({ source: plId, target: wsId });
        });
      });
    });
    const validEdges = [
      ...reversedEdges.filter((e) => {
        if (!map.has(e.source) || !map.has(e.target)) return false;
        const isWsToWc =
          e.source.startsWith('workstation_') && e.target.startsWith('work_center_');
        const isPlToWc =
          e.source.startsWith('production_line_') && e.target.startsWith('work_center_');
        return !isWsToWc && !isPlToWc;
      }),
      ...syntheticPlToWs.filter((e) => map.has(e.source) && map.has(e.target)),
    ];
    return { posMap: map, processedEdges: validEdges, bounds: b, workCenterToWorkstations: wcToWs };
  }, [nodes, edges]);

  return (
    <>
      <ambientLight intensity={0.85} />
      <directionalLight position={[15, 25, 15]} intensity={1.3} castShadow />
      <directionalLight position={[-10, 10, -5]} intensity={0.35} />
      <OrbitControls enableDamping dampingFactor={0.05} />
      <WorkshopFloor bounds={bounds} />
      {nodes.map((n) => {
        if (n.type === 'work_center') {
          const wsIds = workCenterToWorkstations.get(n.id) ?? [];
          const wsPositions = wsIds
            .map((id) => posMap.get(id))
            .filter((p): p is [number, number, number] => p != null);
          const workCenterNodes = nodes
            .filter((nn) => nn.type === 'work_center')
            .sort((a, b) => {
              const ca = (a.data as { code?: string })?.code ?? a.id;
              const cb = (b.data as { code?: string })?.code ?? b.id;
              return ca.localeCompare(cb, undefined, { numeric: true });
            });
          const wcIndex = workCenterNodes.findIndex((nn) => nn.id === n.id);
          const xOffset = wcIndex >= 0 ? wcIndex * WORK_CENTER_X_OFFSET : 0;
          return (
            <WorkCenterIndicator
              key={n.id}
              node={n}
              workstationPositions={wsPositions}
              xOffset={xOffset}
              onClick={onNodeClick}
            />
          );
        }
        const pos = posMap.get(n.id);
        if (!pos) return null;
        return (
          <Suspense key={n.id} fallback={<ModelFallback node={n} position={pos} onClick={onNodeClick} />}>
            <ModelNode3D node={n} position={pos} onClick={onNodeClick} />
          </Suspense>
        );
      })}
      {processedEdges.map((e) => {
        const sp = posMap.get(e.source);
        const tp = posMap.get(e.target);
        if (!sp || !tp) return null;
        return (
          <Edge3D
            key={`${e.source}-${e.target}`}
            sourcePos={sp}
            targetPos={tp}
            floorY={-0.1}
          />
        );
      })}
    </>
  );
};

const Topology3D: React.FC<Topology3DProps> = (props) => {
  preloadModels();

  return (
    <Canvas
      camera={{ position: [25, 35, 45], fov: 45 }}
      frameloop="always"
      style={{ width: '100%', height: '100%', background: 'linear-gradient(180deg, #d8e0e8 0%, #c4d0dc 100%)' }}
    >
      <Suspense
        fallback={
          <Html center zIndexRange={[50, 1]}>
            <div style={{ color: '#666', fontSize: 14 }}>加载 3D 模型中...</div>
          </Html>
        }
      >
        <Topology3DContent {...props} />
      </Suspense>
    </Canvas>
  );
};

export default Topology3D;
