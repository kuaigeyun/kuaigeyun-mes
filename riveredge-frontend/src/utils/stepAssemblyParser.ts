/**
 * STEP/STP 装配树解析（occt-import-js root 层级 → BOM 边）
 */

import type { OcctMesh } from './stepFileLoader';

export type OcctAssemblyNodeRaw = {
  name?: string;
  meshes?: number[];
  children?: OcctAssemblyNodeRaw[];
};

export type StepAssemblyNode = {
  key: string;
  name: string;
  depth: number;
  meshIndices: number[];
  parentKey: string | null;
  childKeys: string[];
  hasChildren: boolean;
  children: StepAssemblyNode[];
};

export type StepBomEdge = {
  parentKey: string;
  childKey: string;
  childName: string;
  quantity: number;
};

export type StepAssemblyParseResult = {
  rootName: string;
  assemblyTree: StepAssemblyNode | null;
  flatNodes: StepAssemblyNode[];
  bomEdges: StepBomEdge[];
};

function normalizeNodeName(name: string | undefined, fallback: string): string {
  const trimmed = (name ?? '').trim();
  return trimmed || fallback;
}

function walkAssemblyNode(
  raw: OcctAssemblyNodeRaw,
  key: string,
  depth: number,
  parentKey: string | null,
): StepAssemblyNode {
  const childrenRaw = raw.children ?? [];
  const name = normalizeNodeName(raw.name, key === '0' ? 'Assembly' : `Part-${key}`);
  const meshIndices = Array.isArray(raw.meshes) ? raw.meshes.filter((n) => Number.isFinite(n)) : [];
  const children = childrenRaw.map((child, index) =>
    walkAssemblyNode(child, `${key}/${index}`, depth + 1, key),
  );
  return {
    key,
    name,
    depth,
    meshIndices,
    parentKey,
    childKeys: children.map((c) => c.key),
    hasChildren: children.length > 0,
    children,
  };
}

/** 规范化 STEP 节点名为物料编码候选 */
export function sanitizeStepMaterialCode(name: string, prefix = 'STP-'): string {
  const base = name
    .trim()
    .toUpperCase()
    .replace(/[^\w\u4e00-\u9fff-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  const code = base || 'PART';
  return prefix ? `${prefix}${code}` : code;
}

function collectFlatNodes(node: StepAssemblyNode, out: StepAssemblyNode[] = []): StepAssemblyNode[] {
  out.push(node);
  node.children.forEach((child) => collectFlatNodes(child, out));
  return out;
}

/** 从装配树生成多层级 BOM 边（顶层 parentKey = "root"，由根物料承接） */
export function buildStepBomEdges(assemblyTree: StepAssemblyNode | null): StepBomEdge[] {
  if (!assemblyTree) return [];

  const edgeMap = new Map<string, StepBomEdge>();

  const visit = (node: StepAssemblyNode, parentKeyForBom: string) => {
    node.children.forEach((child) => {
      const mapKey = `${parentKeyForBom}::${child.key}::${child.name}`;
      const existing = edgeMap.get(mapKey);
      if (existing) {
        existing.quantity += 1;
      } else {
        edgeMap.set(mapKey, {
          parentKey: parentKeyForBom,
          childKey: child.key,
          childName: child.name,
          quantity: 1,
        });
      }
      if (child.hasChildren) {
        visit(child, child.key);
      }
    });
  };

  visit(assemblyTree, 'root');
  return Array.from(edgeMap.values());
}

export function parseStepAssemblyFromOcctRoot(
  root: OcctAssemblyNodeRaw | null | undefined,
  meshes?: OcctMesh[],
): StepAssemblyParseResult {
  if (!root) {
    if (meshes?.length) {
      const synthetic: StepAssemblyNode = {
        key: '0',
        name: meshes[0]?.name || 'Assembly',
        depth: 0,
        meshIndices: meshes.map((_, i) => i),
        parentKey: null,
        childKeys: [],
        hasChildren: false,
        children: [],
      };
      return {
        rootName: synthetic.name,
        assemblyTree: synthetic,
        flatNodes: [synthetic],
        bomEdges: [],
      };
    }
    return { rootName: '', assemblyTree: null, flatNodes: [], bomEdges: [] };
  }

  const assemblyTree = walkAssemblyNode(root, '0', 0, null);
  const flatNodes = collectFlatNodes(assemblyTree);
  const bomEdges = buildStepBomEdges(assemblyTree);

  return {
    rootName: assemblyTree.name,
    assemblyTree,
    flatNodes,
    bomEdges,
  };
}

/** 将装配树转为 Ant Design Tree 数据 */
export function stepAssemblyToTreeData(node: StepAssemblyNode): {
  key: string;
  title: string;
  children?: ReturnType<typeof stepAssemblyToTreeData>[];
} {
  return {
    key: node.key,
    title: node.name,
    children: node.children.length ? node.children.map(stepAssemblyToTreeData) : undefined,
  };
}
