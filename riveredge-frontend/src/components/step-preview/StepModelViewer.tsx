/**
 * STEP/STP 三维预览（React Three Fiber）
 */

import React, { Suspense, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { Bounds, Center, OrbitControls } from '@react-three/drei';
import type { OcctMesh } from '../../utils/stepFileLoader';
import { buildStepObject3D } from '../../utils/stepFileLoader';

export interface StepModelViewerProps {
  meshes: OcctMesh[];
  height?: number | string;
  showEdges?: boolean;
}

const StepMeshes: React.FC<{ meshes: OcctMesh[]; showEdges: boolean }> = ({ meshes, showEdges }) => {
  const object = useMemo(() => buildStepObject3D(meshes, showEdges), [meshes, showEdges]);
  return <primitive object={object} />;
};

export const StepModelViewer: React.FC<StepModelViewerProps> = ({
  meshes,
  height = '100%',
  showEdges = false,
}) => {
  return (
    <div style={{ width: '100%', height, minHeight: 200, background: 'var(--ant-color-fill-quaternary, #f5f5f5)' }}>
      <Canvas
        camera={{ fov: 45, near: 0.1, far: 100000, position: [100, 100, 100] }}
        gl={{ antialias: true, alpha: true }}
        style={{ width: '100%', height: '100%' }}
      >
        <color attach="background" args={['#f5f5f5']} />
        <ambientLight intensity={0.75} />
        <directionalLight position={[120, 180, 100]} intensity={0.9} />
        <directionalLight position={[-80, -40, -60]} intensity={0.35} />
        <Suspense fallback={null}>
          <Bounds fit clip observe margin={1.15}>
            <Center>
              <StepMeshes meshes={meshes} showEdges={showEdges} />
            </Center>
          </Bounds>
        </Suspense>
        <OrbitControls makeDefault enableDamping dampingFactor={0.08} />
      </Canvas>
    </div>
  );
};
