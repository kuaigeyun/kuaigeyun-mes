/**
 * STEP/STP 解析（occt-import-js，浏览器端）
 */

import * as THREE from 'three';
import {
  parseStepAssemblyFromOcctRoot,
  type OcctAssemblyNodeRaw,
  type StepAssemblyParseResult,
  type StepBomEdge,
} from './stepAssemblyParser';
import { yieldToMain } from './yieldToMain';

export type { StepAssemblyParseResult, StepBomEdge };

export type OcctMesh = {
  name?: string;
  color?: number[];
  attributes: {
    position: { array: number[] };
    normal?: { array: number[] };
  };
  index: { array: number[] };
  brep_faces?: Array<{ first: number; last: number; color?: number[] }>;
};

export type StepParseResult = {
  meshes: OcctMesh[];
  assembly?: StepAssemblyParseResult;
};

export type OcctTessellationParams = {
  linearUnit?: 'millimeter' | 'centimeter' | 'meter' | 'inch' | 'foot';
  linearDeflectionType?: 'bounding_box_ratio' | 'absolute_value';
  linearDeflection?: number;
  angularDeflection?: number;
};

export type StepParseOptions = {
  /** OCCT 三角化精度；预览用默认精度，BOM 向导可用较粗网格 */
  tessellation?: OcctTessellationParams | null;
  /** 预览仅需 mesh 时可关闭，跳过装配树遍历 */
  includeAssembly?: boolean;
};

/** 预览用：与 occt-import-js 默认三角化一致 */
export const STEP_PREVIEW_TESSELLATION: OcctTessellationParams = {
  linearDeflectionType: 'bounding_box_ratio',
  linearDeflection: 0.001,
  angularDeflection: 0.5,
};

/** BOM 向导仅需装配树，同样使用较粗网格 */
export const STEP_ASSEMBLY_TESSELLATION: OcctTessellationParams = {
  linearDeflectionType: 'bounding_box_ratio',
  linearDeflection: 0.025,
  angularDeflection: 1.0,
};

type OcctReadStepResult = {
  success?: boolean;
  meshes?: OcctMesh[];
  root?: OcctAssemblyNodeRaw;
};

type OcctModule = {
  ReadStepFile: (buffer: Uint8Array, options: OcctTessellationParams | null) => OcctReadStepResult;
};

type OcctInitOptions = { locateFile?: (path: string) => string };
type OcctInitFn = (options?: OcctInitOptions) => Promise<OcctModule>;

let occtPromise: Promise<OcctModule> | null = null;

const parseCache = new Map<string, Promise<StepParseResult>>();
const MAX_PARSE_CACHE = 6;

function resolveOcctInitFn(mod: unknown): OcctInitFn {
  let current: unknown = mod;
  for (let depth = 0; depth < 8; depth += 1) {
    if (typeof current === 'function') {
      return current as OcctInitFn;
    }
    if (!current || typeof current !== 'object') {
      break;
    }
    const record = current as Record<string, unknown> & Partial<OcctModule>;
    if (typeof record.ReadStepFile === 'function') {
      return async () => record as OcctModule;
    }
    if (typeof record.occtimportjs === 'function') {
      return record.occtimportjs as OcctInitFn;
    }
    if ('default' in record) {
      current = record.default;
      continue;
    }
    break;
  }
  throw new Error('occt-import-js init is not a function');
}

/** 预加载 WASM，缩短首次预览等待 */
export function preloadStepOcctModule(): void {
  void loadOcctModule();
}

export async function loadOcctModule(): Promise<OcctModule> {
  if (!occtPromise) {
    occtPromise = (async () => {
      const wasmUrl = (await import('occt-import-js/dist/occt-import-js.wasm?url')).default as string;
      const mod = await import('occt-import-js/dist/occt-import-js.js');
      const initFn = resolveOcctInitFn(mod);
      const occt = await initFn({
        locateFile: (path: string) => (path.endsWith('.wasm') ? wasmUrl : path),
      });
      if (typeof occt?.ReadStepFile !== 'function') {
        throw new Error('occt-import-js failed to initialize');
      }
      return occt;
    })().catch((err) => {
      occtPromise = null;
      throw err;
    });
  }
  return occtPromise;
}

function buildParseCacheKey(fileUrl: string, options?: StepParseOptions): string {
  const tessellation = options?.tessellation === undefined ? 'preview-default' : JSON.stringify(options.tessellation);
  return `${fileUrl}|asm:${options?.includeAssembly !== false}|t:${tessellation}`;
}

function rememberParseCache(key: string, promise: Promise<StepParseResult>): Promise<StepParseResult> {
  if (parseCache.size >= MAX_PARSE_CACHE) {
    const firstKey = parseCache.keys().next().value;
    if (firstKey) parseCache.delete(firstKey);
  }
  parseCache.set(key, promise);
  return promise;
}

async function parseStepBuffer(
  buffer: Uint8Array,
  options?: StepParseOptions,
): Promise<StepParseResult> {
  const occt = await loadOcctModule();
  await yieldToMain();
  const tessellation =
    options?.tessellation === undefined ? STEP_PREVIEW_TESSELLATION : options.tessellation;
  const result = occt.ReadStepFile(buffer, tessellation);
  await yieldToMain();
  if (!result?.meshes?.length) {
    throw new Error('STEP parse produced no geometry');
  }
  const includeAssembly = options?.includeAssembly !== false;
  const assembly = includeAssembly
    ? parseStepAssemblyFromOcctRoot(result.root, result.meshes)
    : undefined;
  return { meshes: result.meshes, assembly };
}

export async function parseStepFileFromUrl(
  fileUrl: string,
  options?: StepParseOptions,
): Promise<StepParseResult> {
  const cacheKey = buildParseCacheKey(fileUrl, options);
  const cached = parseCache.get(cacheKey);
  if (cached) return cached;

  const promise = (async () => {
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`STEP load failed: ${response.status}`);
    }
    const buffer = new Uint8Array(await response.arrayBuffer());
    return parseStepBuffer(buffer, options);
  })();

  return rememberParseCache(cacheKey, promise);
}

export async function parseStepAssemblyFromUrl(
  fileUrl: string,
  options?: Omit<StepParseOptions, 'includeAssembly'>,
): Promise<StepAssemblyParseResult> {
  const parsed = await parseStepFileFromUrl(fileUrl, {
    ...options,
    tessellation: options?.tessellation ?? STEP_ASSEMBLY_TESSELLATION,
    includeAssembly: true,
  });
  if (!parsed.assembly) {
    throw new Error('STEP assembly tree parse failed');
  }
  return parsed.assembly;
}

const materialCache = new Map<string, THREE.MeshLambertMaterial>();

function colorKey(color: number[] | undefined): string {
  if (!color?.length) return 'default';
  return `${color[0]},${color[1]},${color[2]}`;
}

function getLambertMaterial(color: number[] | undefined): THREE.MeshLambertMaterial {
  const key = colorKey(color);
  let mat = materialCache.get(key);
  if (!mat) {
    mat = new THREE.MeshLambertMaterial({
      color: color
        ? new THREE.Color(color[0], color[1], color[2])
        : new THREE.Color(0x9aa0a6),
    });
    materialCache.set(key, mat);
  }
  return mat;
}

function buildMeshFromOcct(geometryMesh: OcctMesh, showEdges = false, simplified = true): THREE.Group {
  const group = new THREE.Group();
  const positions = geometryMesh.attributes.position.array;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  if (geometryMesh.attributes.normal?.array?.length) {
    geometry.setAttribute(
      'normal',
      new THREE.Float32BufferAttribute(geometryMesh.attributes.normal.array, 3),
    );
  } else {
    geometry.computeVertexNormals();
  }
  const indexArr = geometryMesh.index.array;
  geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(indexArr), 1));

  const mesh = new THREE.Mesh(
    geometry,
    simplified || !geometryMesh.brep_faces?.length
      ? getLambertMaterial(geometryMesh.color)
      : buildMultiMaterial(geometryMesh, geometry),
  );
  mesh.name = geometryMesh.name || 'step-mesh';
  group.add(mesh);

  if (showEdges) {
    const edges = new THREE.EdgesGeometry(geometry, 25);
    const line = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color: 0x333333, transparent: true, opacity: 0.35 }),
    );
    line.renderOrder = mesh.renderOrder + 1;
    group.add(line);
  }

  return group;
}

function buildMultiMaterial(geometryMesh: OcctMesh, geometry: THREE.BufferGeometry): THREE.Material[] {
  const defaultColor = geometryMesh.color
    ? new THREE.Color(geometryMesh.color[0], geometryMesh.color[1], geometryMesh.color[2])
    : new THREE.Color(0x9aa0a6);
  const materials: THREE.Material[] = [
    new THREE.MeshLambertMaterial({ color: defaultColor }),
  ];
  geometryMesh.brep_faces!.forEach((face) => {
    const color = face.color
      ? new THREE.Color(face.color[0], face.color[1], face.color[2])
      : defaultColor;
    materials.push(new THREE.MeshLambertMaterial({ color }));
  });
  const triangleCount = geometryMesh.index.array.length / 3;
  let triangleIndex = 0;
  let faceColorGroupIndex = 0;
  while (triangleIndex < triangleCount) {
    const firstIndex = triangleIndex;
    let lastIndex: number;
    let materialIndex: number;
    if (faceColorGroupIndex >= geometryMesh.brep_faces!.length) {
      lastIndex = triangleCount;
      materialIndex = 0;
    } else if (triangleIndex < geometryMesh.brep_faces![faceColorGroupIndex].first) {
      lastIndex = geometryMesh.brep_faces![faceColorGroupIndex].first;
      materialIndex = 0;
    } else {
      lastIndex = geometryMesh.brep_faces![faceColorGroupIndex].last + 1;
      materialIndex = faceColorGroupIndex + 1;
      faceColorGroupIndex += 1;
    }
    geometry.addGroup(firstIndex * 3, (lastIndex - firstIndex) * 3, materialIndex);
    triangleIndex = lastIndex;
  }
  return materials;
}

const MESH_BUILD_CHUNK = 12;

export async function buildStepObject3DAsync(
  meshes: OcctMesh[],
  showEdges = false,
  simplified = true,
): Promise<THREE.Group> {
  const root = new THREE.Group();
  for (let i = 0; i < meshes.length; i += MESH_BUILD_CHUNK) {
    if (i > 0) await yieldToMain();
    const end = Math.min(i + MESH_BUILD_CHUNK, meshes.length);
    for (let j = i; j < end; j += 1) {
      root.add(buildMeshFromOcct(meshes[j], showEdges, simplified));
    }
  }
  return root;
}

/** @deprecated 同步构建，大装配会阻塞主线程；请用 buildStepObject3DAsync */
export function buildStepObject3D(meshes: OcctMesh[], showEdges = false): THREE.Group {
  const root = new THREE.Group();
  meshes.forEach((mesh) => {
    root.add(buildMeshFromOcct(mesh, showEdges, true));
  });
  return root;
}

export function disposeStepObject3D(object: THREE.Object3D): void {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
    }
    if (child instanceof THREE.LineSegments) {
      child.geometry.dispose();
      const mat = child.material;
      if (mat && !Array.isArray(mat)) mat.dispose();
    }
  });
}
