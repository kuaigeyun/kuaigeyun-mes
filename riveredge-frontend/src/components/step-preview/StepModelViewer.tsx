/**
 * STEP/STP 三维预览（React Three Fiber）
 */

import React, {
  useCallback,
  forwardRef,
  startTransition,
  Suspense,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { Bounds, Center, GizmoHelper, GizmoViewport, OrbitControls, useBounds } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import type { OcctMesh } from '../../utils/stepFileLoader';
import { buildStepObject3DAsync, disposeStepObject3D } from '../../utils/stepFileLoader';

export type StepModelViewerRef = {
  resetView: () => void;
};

export interface StepModelViewerProps {
  meshes: OcctMesh[];
  height?: number | string;
  showEdges?: boolean;
  /** 大图预览：显示 drei 原生视角方块 */
  showGizmo?: boolean;
}

const StepMeshes: React.FC<{ meshes: OcctMesh[]; showEdges: boolean }> = ({ meshes, showEdges }) => {
  const [object, setObject] = useState<THREE.Group | null>(null);
  const objectRef = useRef<THREE.Group | null>(null);

  useEffect(() => {
    let cancelled = false;
    setObject(null);
    objectRef.current = null;

    void (async () => {
      const built = await buildStepObject3DAsync(meshes, showEdges, true);
      if (cancelled) {
        disposeStepObject3D(built);
        return;
      }
      objectRef.current = built;
      startTransition(() => {
        if (!cancelled) setObject(built);
      });
    })();

    return () => {
      cancelled = true;
      if (objectRef.current) {
        disposeStepObject3D(objectRef.current);
        objectRef.current = null;
      }
    };
  }, [meshes, showEdges]);

  if (!object) return null;
  return <primitive object={object} />;
};

const BoundsFitBridge: React.FC<{ onFitReady: (fit: () => void) => void; children: React.ReactNode }> = ({
  onFitReady,
  children,
}) => {
  const boundsApi = useBounds();

  useEffect(() => {
    onFitReady(() => {
      boundsApi.refresh().clip().fit();
    });
  }, [boundsApi, onFitReady]);

  return <>{children}</>;
};

export const StepModelViewer = forwardRef<StepModelViewerRef, StepModelViewerProps>(
  function StepModelViewer({ meshes, height = '100%', showEdges = false, showGizmo = false }, ref) {
    const fitBoundsRef = useRef<(() => void) | null>(null);
    const controlsRef = useRef<OrbitControlsImpl | null>(null);
    const handleFitReady = useCallback((fit: () => void) => {
      fitBoundsRef.current = fit;
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        resetView() {
          fitBoundsRef.current?.();
          controlsRef.current?.reset();
        },
      }),
      [],
    );

    return (
      <div
        style={{
          width: '100%',
          height,
          minHeight: 200,
          background: 'var(--ant-color-fill-quaternary, #f5f5f5)',
        }}
      >
        <Canvas
          frameloop="demand"
          dpr={[1, 1.5]}
          camera={{ fov: 45, near: 0.1, far: 100000, position: [100, 100, 100] }}
          gl={{ antialias: false, alpha: true, powerPreference: 'high-performance' }}
          style={{ width: '100%', height: '100%' }}
        >
          <color attach="background" args={['#f5f5f5']} />
          <ambientLight intensity={0.8} />
          <directionalLight position={[120, 180, 100]} intensity={0.85} />
          <Suspense fallback={null}>
            <Bounds fit clip margin={1.12}>
              <BoundsFitBridge onFitReady={handleFitReady}>
                <Center>
                  <StepMeshes meshes={meshes} showEdges={showEdges} />
                </Center>
              </BoundsFitBridge>
            </Bounds>
          </Suspense>
          <OrbitControls ref={controlsRef} makeDefault enableDamping dampingFactor={0.08} />
          {showGizmo ? (
            <GizmoHelper alignment="bottom-right" margin={[72, 72]}>
              <GizmoViewport
                axisColors={['#ff3653', '#0adb00', '#2c8fff']}
                labelColor="white"
              />
            </GizmoHelper>
          ) : null}
        </Canvas>
      </div>
    );
  },
);
