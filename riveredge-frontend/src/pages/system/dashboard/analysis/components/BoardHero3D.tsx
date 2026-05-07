/* eslint-disable react/no-unknown-property */
import React, { useRef, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, Float, Environment, Stars, ContactShadows, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

/** ===== 3D 模型：仪表盘地球 / 星球主体 ===== */
function OperationalCore() {
  const { scene } = useGLTF('/models/tech-planet.glb');
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (groupRef.current) {
      // 基础缓慢自转
      groupRef.current.rotation.y = state.clock.getElapsedTime() * 0.15;
    }
  });

  return (
    <group ref={groupRef}>
      <Float speed={2} rotationIntensity={0.5} floatIntensity={0.5}>
        <primitive object={scene} scale={3.2} position={[0, -0.5, 0]} rotation={[0, Math.PI / 2, 0]} />
        
        {/* 为满足“圆形”需求，添加多层科技能量环 */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[3.8, 0.02, 16, 100]} />
          <meshStandardMaterial color="#00ffff" emissive="#00ffff" emissiveIntensity={2} transparent opacity={0.6} />
        </mesh>
        
        <mesh rotation={[Math.PI / 2, 0.5, 0]}>
          <torusGeometry args={[4.2, 0.012, 12, 100]} />
          <meshStandardMaterial color="#00ffff" emissive="#00ffff" emissiveIntensity={1} transparent opacity={0.3} />
        </mesh>
      </Float>

      {/* 扫掠激光效果 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -3, 0]}>
        <ringGeometry args={[2, 5, 64]} />
        <meshBasicMaterial color="#00ffff" transparent opacity={0.05} />
      </mesh>
    </group>
  );
}

export const BoardHero3D: React.FC = () => {
  return (
    <div style={{ width: '100%', height: '100%', minHeight: '550px', position: 'relative' }}>
      <Canvas camera={{ position: [0, 4, 12], fov: 40 }}>
        <color attach="background" args={['#000000']} />
        
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1.5} color="#00ffff" />
        <spotLight position={[-10, 20, 10]} angle={0.15} penumbra={1} intensity={2} castShadow />

        <Suspense fallback={null}>
          <OperationalCore />
          <Environment preset="night" />
          {/* 星空背景 */}
          <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
          {/* 地面阴影 */}
          <ContactShadows resolution={1024} scale={15} blur={2} opacity={0.6} far={10} color="#00ffff" />
        </Suspense>

        <OrbitControls 
          enableZoom={false} 
          enablePan={false}
          autoRotate 
          autoRotateSpeed={0.5}
          maxPolarAngle={Math.PI / 1.8}
          minPolarAngle={Math.PI / 4}
        />
      </Canvas>

      {/* HUD Overlay - 保持原有信息 */}
      <div style={{
          position: 'absolute',
          top: '30px',
          left: '30px',
          color: '#00ffff',
          fontFamily: 'monospace',
          fontSize: '11px',
          zIndex: 10,
          borderLeft: '4px solid #00ffff',
          padding: '12px',
          background: 'rgba(0, 255, 255, 0.05)',
          backdropFilter: 'blur(10px)'
      }}>
          <div style={{ fontWeight: 'bold', fontSize: '13px', marginBottom: '8px' }}>CENTRAL_HUB_OPERATIONAL</div>
          <div>STATUS: SYNCING</div>
          <div>LATENCY: 12ms</div>
      </div>
    </div>
  );
};

export default BoardHero3D;
