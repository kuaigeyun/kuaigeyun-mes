import React, { useRef, useLayoutEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

function TransparentScene() {
  const { scene, gl } = useThree();
  useLayoutEffect(() => {
    scene.background = null;
    gl.setClearColor(0x000000, 0);
  }, [scene, gl]);
  return null;
}

function CoreGroup() {
  const group = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (!group.current) return;
    group.current.rotation.y += delta * 0.35;
    group.current.rotation.x += delta * 0.12;
  });
  return (
    <group ref={group} scale={0.72}>
      <mesh>
        <icosahedronGeometry args={[1.65, 1]} />
        <meshStandardMaterial
          color="#38bdf8"
          wireframe
          emissive="#0284c7"
          emissiveIntensity={0.5}
          metalness={0.25}
          roughness={0.35}
        />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0.4, 0]}>
        <torusGeometry args={[2.15, 0.055, 14, 72]} />
        <meshStandardMaterial
          color="#34d399"
          emissive="#059669"
          emissiveIntensity={0.4}
          transparent
          opacity={0.92}
        />
      </mesh>
      <mesh rotation={[0.2, 0.8, 0]}>
        <torusGeometry args={[1.48, 0.04, 10, 56]} />
        <meshStandardMaterial color="#a78bfa" emissive="#7c3aed" emissiveIntensity={0.3} transparent opacity={0.78} />
      </mesh>
    </group>
  );
}

const BoardHero3D: React.FC = () => (
  <div style={{ width: '100%', height: '100%', minHeight: 0, touchAction: 'none', background: 'transparent' }}>
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0, 0.04, 4.35], fov: 45, near: 0.1, far: 50 }}
      gl={{ alpha: true, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: false }}
      style={{ width: '100%', height: '100%', background: 'transparent', display: 'block' }}
    >
      <TransparentScene />
      <ambientLight intensity={0.4} />
      <pointLight position={[7, 9, 9]} intensity={1.55} color="#7dd3fc" />
      <pointLight position={[-7, -5, 7]} intensity={0.75} color="#c4b5fd" />
      <CoreGroup />
      <OrbitControls
        enableZoom={false}
        enablePan={false}
        autoRotate
        autoRotateSpeed={0.65}
        minPolarAngle={Math.PI * 0.14}
        maxPolarAngle={Math.PI * 0.82}
      />
    </Canvas>
  </div>
);

export default BoardHero3D;
