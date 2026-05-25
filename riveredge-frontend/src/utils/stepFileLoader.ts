/**
 * STEP/STP 解析（occt-import-js，浏览器端）
 */

import * as THREE from 'three';

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
};

type OcctModule = {
  ReadStepFile: (buffer: Uint8Array, options: null) => StepParseResult & { success?: boolean };
};

type OcctInitOptions = { locateFile?: (path: string) => string };
type OcctInitFn = (options?: OcctInitOptions) => Promise<OcctModule>;

let occtPromise: Promise<OcctModule> | null = null;

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

async function loadOcctModule(): Promise<OcctModule> {
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

export async function parseStepFileFromUrl(fileUrl: string): Promise<StepParseResult> {
  const occt = await loadOcctModule();
  const response = await fetch(fileUrl);
  if (!response.ok) {
    throw new Error(`STEP load failed: ${response.status}`);
  }
  const buffer = new Uint8Array(await response.arrayBuffer());
  const result = occt.ReadStepFile(buffer, null);
  if (!result?.meshes?.length) {
    throw new Error('STEP parse produced no geometry');
  }
  return { meshes: result.meshes };
}

function buildMeshFromOcct(geometryMesh: OcctMesh, showEdges = false): THREE.Group {
  const group = new THREE.Group();
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(geometryMesh.attributes.position.array, 3));
  if (geometryMesh.attributes.normal) {
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(geometryMesh.attributes.normal.array, 3));
  }
  const index = Uint32Array.from(geometryMesh.index.array);
  geometry.setIndex(new THREE.BufferAttribute(index, 1));

  const defaultColor = geometryMesh.color
    ? new THREE.Color(geometryMesh.color[0], geometryMesh.color[1], geometryMesh.color[2])
    : new THREE.Color(0x9aa0a6);

  const defaultMaterial = new THREE.MeshStandardMaterial({
    color: defaultColor,
    metalness: 0.15,
    roughness: 0.65,
  });

  const materials: THREE.Material[] = [defaultMaterial];

  if (geometryMesh.brep_faces?.length) {
    geometryMesh.brep_faces.forEach((face) => {
      const color = face.color
        ? new THREE.Color(face.color[0], face.color[1], face.color[2])
        : defaultColor;
      materials.push(
        new THREE.MeshStandardMaterial({
          color,
          metalness: 0.15,
          roughness: 0.65,
        }),
      );
    });

    const triangleCount = geometryMesh.index.array.length / 3;
    let triangleIndex = 0;
    let faceColorGroupIndex = 0;
    while (triangleIndex < triangleCount) {
      const firstIndex = triangleIndex;
      let lastIndex: number;
      let materialIndex: number;
      if (faceColorGroupIndex >= geometryMesh.brep_faces.length) {
        lastIndex = triangleCount;
        materialIndex = 0;
      } else if (triangleIndex < geometryMesh.brep_faces[faceColorGroupIndex].first) {
        lastIndex = geometryMesh.brep_faces[faceColorGroupIndex].first;
        materialIndex = 0;
      } else {
        lastIndex = geometryMesh.brep_faces[faceColorGroupIndex].last + 1;
        materialIndex = faceColorGroupIndex + 1;
        faceColorGroupIndex += 1;
      }
      geometry.addGroup(firstIndex * 3, (lastIndex - firstIndex) * 3, materialIndex);
      triangleIndex = lastIndex;
    }
  }

  const mesh = new THREE.Mesh(geometry, materials.length > 1 ? materials : materials[0]);
  mesh.name = geometryMesh.name || 'step-mesh';
  group.add(mesh);

  if (showEdges) {
    const edges = new THREE.EdgesGeometry(geometry, 25);
    const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x333333, transparent: true, opacity: 0.35 }));
    line.renderOrder = mesh.renderOrder + 1;
    group.add(line);
  }

  return group;
}

export function buildStepObject3D(meshes: OcctMesh[], showEdges = false): THREE.Group {
  const root = new THREE.Group();
  meshes.forEach((mesh) => {
    root.add(buildMeshFromOcct(mesh, showEdges));
  });
  return root;
}
