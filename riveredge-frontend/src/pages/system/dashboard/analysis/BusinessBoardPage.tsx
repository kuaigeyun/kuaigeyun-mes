import React, { useState, useEffect, useRef, useMemo, useCallback, Suspense } from 'react';
import { Typography, Button, Modal, Input, Tooltip, Progress, theme, message, Empty, Radio, Upload } from 'antd';
import type { UploadProps } from 'antd';
import { Canvas, useFrame } from '@react-three/fiber';
import { Billboard, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import {
  FullscreenOutlined,
  FullscreenExitOutlined,
  SettingOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { Column, Area, Chart } from '@ant-design/charts';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import {
  businessBoardChartTheme,
  businessBoardVividHud,
  buildBusinessBoardPlainHud,
  getBusinessBoardWarehouseChartColors,
  type BusinessBoardHud,
} from './chartTheme';
import { useThemeStore } from '../../../../stores/themeStore';
import { SYSTEM_VIEWPORT_OFFSETS, getViewportHeightExpr } from '../../../../components/layout-templates/constants';
import { getBusinessBoardTitle, putBusinessBoardTitle } from '../../../../services/businessBoardTitle';
import { getFilePreview, uploadFile } from '../../../../services/file';
import { useConfigStore } from '../../../../stores/configStore';
import { useSiteLogoUrl } from '../../../../hooks/useSiteLogoUrl';
import i18n from '../../../../config/i18n';
import {
  getSalesSummary,
  getPurchaseSummary,
  getManufacturingSummary,
  getEquipmentSummary,
  getManagementMetrics,
  getProcessProgress,
  getProductionBroadcast,
  getSalesTop10,
  getPurchaseTop10,
  getActiveWorkOrders,
  getWarehouseSummary,
  getWarehouseTrend,
  type ProductionBroadcastItem,
  type ActiveWorkOrderItem,
} from '../../../../services/dashboard';
import { formatDateTime } from '../../../../utils/format';

const { Title } = Typography;

/** 中心 HUD 默认配图（未上传自定义图时使用） */
const DEFAULT_HERO_TEXTURE = '/img/dashboard.png';

const BusinessBoardHudContext = React.createContext<BusinessBoardHud>(businessBoardVividHud);

/** 供本文件内 HUD 子组件读取当前调色板（由 BusinessBoardHudRoot 同步） */
let boardHudSnapshot: BusinessBoardHud = businessBoardVividHud;
const getBoardHud = (): BusinessBoardHud => boardHudSnapshot;

const BusinessBoardHudRoot: React.FC<{ hud: BusinessBoardHud; children: React.ReactNode }> = ({
  hud,
  children,
}) => {
  boardHudSnapshot = hud;
  return <BusinessBoardHudContext.Provider value={hud}>{children}</BusinessBoardHudContext.Provider>;
};

const clockFont =
  '"JetBrains Mono", "SF Mono", "Cascadia Code", Consolas, "Liberation Mono", ui-monospace, monospace';

/** ===== 基础样式 ===== */
const chartHost: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  width: '100%',
  position: 'relative',
  overflow: 'hidden',
  boxSizing: 'border-box',
};

const formatCompact = (value: number): string => {
  if (!Number.isFinite(value)) return '0';
  const abs = Math.abs(value);
  const lang = i18n.language || 'zh-CN';
  const isZh = lang.startsWith('zh');
  if (isZh) {
    if (abs >= 1e8) {
      return i18n.t('dashboard.businessBoard.format.yi', { value: (value / 1e8).toFixed(2) });
    }
    if (abs >= 1e4) {
      return i18n.t('dashboard.businessBoard.format.wan', { value: (value / 1e4).toFixed(1) });
    }
  } else {
    if (abs >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
    if (abs >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  }
  if (abs >= 1e3) return `${(value / 1e3).toFixed(1)}k`;
  return Math.round(value).toLocaleString(lang);
};

/** ===== HUD 面板：科幻斜切角外框 + 粗壮发光边框 ===== */
interface HudPanelProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
  flex?: string | number;
  variant?: 'left' | 'right' | 'middleTop' | 'middleBottom';
}
const HudPanel: React.FC<HudPanelProps> = ({ children, style, flex, variant = 'left' }) => {
  if (variant === 'middleTop') {
    return (
      <div
        style={{
          position: 'relative',
          flex: flex ?? '1 1 0',
          minWidth: 0,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          padding: '16px',
          boxSizing: 'border-box',
          ...style,
        }}
      >
        {/* 没有亮色边框和切角，只有深色打底 */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 0,
            background: `linear-gradient(135deg, rgba(8, 26, 54, 0.4) 0%, rgba(4, 15, 34, 0.3) 100%)`,
            boxShadow: `inset 0 0 30px rgba(0, 180, 230, 0.05)`,
            borderRadius: 4,
          }}
        />
        <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          {children}
        </div>
      </div>
    );
  }

  let outerClip = '';
  let innerClip = '';
  let corner1: React.ReactNode = null;
  let corner2: React.ReactNode = null;

  if (variant === 'right') {
    outerClip = 'polygon(24px 0, 100% 0, 100% calc(100% - 24px), calc(100% - 24px) 100%, 0 100%, 0 24px)';
    innerClip = 'polygon(23px 0, 100% 0, 100% calc(100% - 23px), calc(100% - 23px) 100%, 0 100%, 0 23px)';
    corner1 = (
      <div aria-hidden style={{ position: 'absolute', top: 0, left: 0, width: '35%', height: '40%', maxWidth: 180, maxHeight: 80, zIndex: 1, pointerEvents: 'none' }}>
        <svg width="100%" height="100%" viewBox="0 0 180 80" preserveAspectRatio="none">
          <polyline points="180,2 26,2 2,26 2,80" fill="none" stroke="#00d0ff" strokeWidth="4" filter="drop-shadow(0 0 8px #00d0ff)" />
          <circle cx="160" cy="2" r="3" fill="#ffffff" filter="drop-shadow(0 0 5px #00d0ff)" />
        </svg>
      </div>
    );
    corner2 = (
      <div aria-hidden style={{ position: 'absolute', bottom: 0, right: 0, width: '35%', height: '40%', maxWidth: 180, maxHeight: 80, zIndex: 1, pointerEvents: 'none' }}>
        <svg width="100%" height="100%" viewBox="0 0 180 80" preserveAspectRatio="none">
          <polyline points="0,78 154,78 178,54 178,0" fill="none" stroke="#00d0ff" strokeWidth="4" filter="drop-shadow(0 0 8px #00d0ff)" />
          <circle cx="20" cy="78" r="3" fill="#ffffff" filter="drop-shadow(0 0 5px #00d0ff)" />
        </svg>
      </div>
    );
  } else if (variant === 'middleBottom') {
    outerClip = 'polygon(0 0, 100% 0, 100% calc(100% - 24px), calc(100% - 24px) 100%, 24px 100%, 0 calc(100% - 24px))';
    innerClip = 'polygon(0 0, 100% 0, 100% calc(100% - 23px), calc(100% - 23px) 100%, 23px 100%, 0 calc(100% - 23px))';
    corner1 = (
      <>
        {/* 上边框悬浮装饰梁 */}
        <div style={{ position: 'absolute', top: 0, left: '20%', right: '20%', height: 12, zIndex: 5 }}>
          <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, ${getBoardHud().cyan}44, transparent)`, clipPath: 'polygon(0 0, 100% 0, 96% 100%, 4% 100%)' }} />
          <div style={{ position: 'absolute', left: '35%', right: '35%', top: 0, height: 2, background: getBoardHud().cyan, boxShadow: `0 0 10px ${getBoardHud().cyan}` }} />
        </div>
        <div aria-hidden style={{ position: 'absolute', bottom: 0, left: 0, width: '35%', height: '40%', maxWidth: 180, maxHeight: 80, zIndex: 1, pointerEvents: 'none' }}>
          <svg width="100%" height="100%" viewBox="0 0 180 80" preserveAspectRatio="none">
            <polyline points="180,78 26,78 2,54 2,0" fill="none" stroke="#00d0ff" strokeWidth="4" filter="drop-shadow(0 0 8px #00d0ff)" />
            <circle cx="160" cy="78" r="3" fill="#ffffff" filter="drop-shadow(0 0 5px #00d0ff)" />
          </svg>
        </div>
      </>
    );
    corner2 = (
      <div aria-hidden style={{ position: 'absolute', bottom: 0, right: 0, width: '35%', height: '40%', maxWidth: 180, maxHeight: 80, zIndex: 1, pointerEvents: 'none' }}>
        <svg width="100%" height="100%" viewBox="0 0 180 80" preserveAspectRatio="none">
          <polyline points="0,78 154,78 178,54 178,0" fill="none" stroke="#00d0ff" strokeWidth="4" filter="drop-shadow(0 0 8px #00d0ff)" />
          <circle cx="20" cy="78" r="3" fill="#ffffff" filter="drop-shadow(0 0 5px #00d0ff)" />
        </svg>
      </div>
    );
  } else {
    // left
    outerClip = 'polygon(0 0, calc(100% - 24px) 0, 100% 24px, 100% 100%, 24px 100%, 0 calc(100% - 24px))';
    innerClip = 'polygon(0 0, calc(100% - 23px) 0, 100% 23px, 100% 100%, 23px 100%, 0 calc(100% - 23px))';
    corner1 = (
      <div aria-hidden style={{ position: 'absolute', top: 0, right: 0, width: '35%', height: '40%', maxWidth: 180, maxHeight: 80, zIndex: 1, pointerEvents: 'none' }}>
        <svg width="100%" height="100%" viewBox="0 0 180 80" preserveAspectRatio="none">
          <polyline points="0,2 154,2 178,26 178,80" fill="none" stroke="#00d0ff" strokeWidth="4" filter="drop-shadow(0 0 8px #00d0ff)" />
          <circle cx="20" cy="2" r="3" fill="#ffffff" filter="drop-shadow(0 0 5px #00d0ff)" />
        </svg>
      </div>
    );
    corner2 = (
      <div aria-hidden style={{ position: 'absolute', bottom: 0, left: 0, width: '35%', height: '40%', maxWidth: 180, maxHeight: 80, zIndex: 1, pointerEvents: 'none' }}>
        <svg width="100%" height="100%" viewBox="0 0 180 80" preserveAspectRatio="none">
          <polyline points="180,78 26,78 2,54 2,0" fill="none" stroke="#00d0ff" strokeWidth="4" filter="drop-shadow(0 0 8px #00d0ff)" />
          <circle cx="160" cy="78" r="3" fill="#ffffff" filter="drop-shadow(0 0 5px #00d0ff)" />
        </svg>
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'relative',
        flex: flex ?? '1 1 0',
        minWidth: 0,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        padding: '2px', // 充当边框厚度
        background: 'rgba(37, 99, 235, 0.4)', // 边框底色
        clipPath: outerClip,
        filter: 'drop-shadow(0 0 8px rgba(37, 99, 235, 0.2))',
        boxSizing: 'border-box',
        ...style,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 2, // 向内缩进形成边框
          zIndex: 0,
          background: `linear-gradient(135deg, rgba(12, 36, 70, 0.85) 0%, rgba(4, 15, 34, 0.95) 100%)`,
          clipPath: innerClip,
          boxShadow: `inset 0 0 30px rgba(0, 136, 255, 0.1)`,
        }}
      />
      {corner1}
      {corner2}
      <div
        style={{
          position: 'relative',
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          minHeight: 0,
          padding: '16px', // 恢复正常内容的内边距
        }}
      >
        {children}
      </div>
    </div>
  );
};

/** ===== 区块标题：双书名号 + 青色字 + 右侧小标 ===== */
interface HudTitleProps {
  title: React.ReactNode;
  suffix?: React.ReactNode;
  right?: React.ReactNode;
}
const HudTitle: React.FC<HudTitleProps> = ({ title, suffix, right }) => (
  <div
    style={{
      flexShrink: 0,
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      marginBottom: 8,
      lineHeight: 1.3,
    }}
  >
    <span
      aria-hidden
      style={{
        color: getBoardHud().cyan,
        fontSize: 14,
        fontWeight: 700,
        textShadow: `0 0 8px ${getBoardHud().cyan}`,
      }}
    >
      «
    </span>
    <span
      style={{
        color: getBoardHud().textPrimary,
        fontSize: 14,
        fontWeight: 700,
        letterSpacing: 0.5,
        textShadow: `0 0 8px rgba(0, 180, 230, 0.35)`,
      }}
    >
      {title}
    </span>
    {suffix ? (
      <span style={{ color: getBoardHud().textDim, fontSize: 13, marginLeft: 4 }}>{suffix}</span>
    ) : null}
    {right ? <span style={{ marginLeft: 'auto' }}>{right}</span> : null}
  </div>
);

/* eslint-disable react/no-unknown-property */

/** ===== 高级线性科技指标卡 (Linear Tech HUD Panel) ===== */
interface TechBadgeProps {
  label: string;
  value: React.ReactNode;
  color?: string;
  unit?: string;
  align?: 'left' | 'right';
}
const TechBadge: React.FC<TechBadgeProps & { delay?: number }> = ({
  label,
  value,
  color = getBoardHud().cyan,
  unit,
  align = 'left',
  delay = 0,
}) => {
  return (
    <div 
      className="hud-card-float"
      style={{ 
        width: 130, 
        height: 130, 
        borderRadius: '50%',
        background: `radial-gradient(circle, ${color}15 0%, transparent 70%)`,
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        border: `1px solid ${color}22`,
        boxShadow: `inset 0 0 20px ${color}11`,
        animationDelay: `${delay}s`
      }}
    >
      {/* 外部轨道装饰 (雷达环) */}
      <div 
        className="hud-ring-spin"
        style={{
          position: 'absolute',
          inset: -6,
          borderRadius: '50%',
          border: `1px dashed ${color}44`,
          opacity: 0.5,
          animationDirection: align === 'right' ? 'reverse' : 'normal'
        }} 
      />

      {/* 侧面重点弧度 */}
      <div style={{
        position: 'absolute',
        inset: -2,
        borderRadius: '50%',
        border: `3px solid transparent`,
        borderLeft: align === 'left' ? `6px solid ${color}` : 'none',
        borderRight: align === 'right' ? `6px solid ${color}` : 'none',
        filter: `drop-shadow(0 0 5px ${color})`
      }} />

      {/* 背景微网格 */}
      <div style={{
        position: 'absolute',
        inset: 4,
        borderRadius: '50%',
        opacity: 0.1,
        backgroundImage: `radial-gradient(${color} 1px, transparent 1px)`,
        backgroundSize: '10px 10px',
        backgroundPosition: 'center',
        overflow: 'hidden'
      }} />

      {/* 内部主数据 */}
      <div style={{ 
        position: 'relative',
        zIndex: 2,
        fontSize: 13, 
        color: getBoardHud().textSoft, 
        letterSpacing: 1, 
        textTransform: 'uppercase', 
        marginBottom: 2,
        textAlign: 'center',
        padding: '0 10px',
        maxWidth: '90%'
      }}>
        {label}
      </div>
      
      <div style={{ 
        position: 'relative',
        zIndex: 2,
        display: 'flex', 
        alignItems: 'baseline', 
        gap: 2,
      }}>
        <span style={{ 
          fontSize: 28, 
          fontWeight: 900, 
          color: '#ffffff', 
          fontFamily: clockFont,
          textShadow: `0 0 10px ${color}aa`,
          lineHeight: 1
        }}>
          {value}
        </span>
        {unit && <span style={{ fontSize: 11, color: getBoardHud().textSoft, fontWeight: 500 }}>{unit}</span>}
      </div>
    </div>
  );
};

/** ===== 3D 模型：高精细复合动力堆 (High-Detail Power Core) ===== */
const HudPowerCore: React.FC<{ textureUrl: string }> = ({ textureUrl }) => {
  const meshRef = useRef<THREE.Group>(null);
  const pointsRef = useRef<THREE.Points>(null);
  
  // 1. 加载高清静态大图资源（支持租户自定义 URL）
  const texture = useTexture(textureUrl);
  
  // 2. 优化图片纹理质量 (静默处理)
  useEffect(() => {
    if (texture) {
      texture.anisotropy = 16; // eslint-disable-line
    }
  }, [texture]);

  useFrame((state) => {
    // 仅驱动旋转背景点阵地球，保持中心大图静止
    if (pointsRef.current) {
      pointsRef.current.rotation.y = state.clock.getElapsedTime() * 0.15;
    }
  });

  return (
    <group ref={meshRef}>
      {/* 核心 1：背景数字环境 (点云球体) */}
      <points ref={pointsRef}>
        <sphereGeometry args={[2.2, 64, 64]} />
        <pointsMaterial size={0.02} color={getBoardHud().cyan} transparent opacity={0.2} />
      </points>

      {/* 核心 2：核心大图展示 - 物理嵌套在地球内部 (深度对齐) */}
      <Billboard position={[0, 0, 0]}>
        <mesh>
          <planeGeometry args={[4.2, 3.6]} />
          <meshBasicMaterial 
            map={texture} 
            transparent 
            depthTest={true}
            depthWrite={false}
            toneMapped={false}
            side={THREE.DoubleSide} 
          />
        </mesh>
      </Billboard>
    </group>
  );
};

interface HudHeroProps {
  /** 中心 Billboard 贴图（默认 /img/dashboard.png 或文件预览 URL） */
  centerTextureUrl: string;
  todayOutput: number;
  qualifiedRate: number;
  inProgressWo: number;
  pendingSchedule: number;
  avgCycle: number;
  onTimeDelivery: number;
  reworkCount: number;
  repairingCount: number;
  siteLogoUrl?: string;
  labels: {
    woPlatform: string;
    opPlatform: string;
    todayOutput: string;
    qualifiedRate: string;
    inProgressWo: string;
    pendingSchedule: string;
    avgCycle: string;
    onTimeDelivery: string;
    reworkOrders: string;
    repairingEquip: string;
    unitDays: string;
  };
}

const HudHero: React.FC<HudHeroProps> = ({
  centerTextureUrl,
  todayOutput,
  qualifiedRate,
  inProgressWo,
  pendingSchedule,
  avgCycle,
  onTimeDelivery,
  reworkCount,
  labels,
}) => (
  <div
    style={{
      position: 'relative',
      flex: 1,
      minHeight: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    }}
  >
    {/* 背景空间层次 */}
    <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(circle at 50% 50%, rgba(0, 136, 255, 0.04) 0%, transparent 80%)` }} />
    <div style={{ position: 'absolute', inset: 0, opacity: 0.1, backgroundImage: `linear-gradient(rgba(0,136,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0,136,255,0.05) 1px, transparent 1px)`, backgroundSize: '40px 40px', backgroundPosition: 'center' }} />

    {/* 中央 3D 全景核心容器 (全画幅展示) */}
    <div style={{ width: '100%', height: '100%', position: 'relative', zIndex: 1 }}>
      <Canvas camera={{ position: [0, 0, 8], fov: 32 }}>
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1.5} color={getBoardHud().cyan} />
        <pointLight position={[-10, -10, -10]} intensity={1} color={getBoardHud().platformBlue} />
        <Suspense fallback={null}>
          <HudPowerCore key={centerTextureUrl} textureUrl={centerTextureUrl} />
        </Suspense>
      </Canvas>
      
      {/* 全息悬浮指标分布系统 (中轴挂载) */}
      
      {/* 左侧集群 */}
      <div style={{ 
        position: 'absolute', 
        left: '10%', 
        top: '50%', 
        transform: 'translateY(-50%)', 
        zIndex: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
      }}>
        <div style={{ marginBottom: 0 }}><TechBadge label={labels.inProgressWo} value={inProgressWo} color={getBoardHud().cyan} align="left" /></div>
        <div style={{ marginLeft: -40 }}><TechBadge label={labels.avgCycle} value={avgCycle.toFixed(1)} color={getBoardHud().platformBlue} unit={labels.unitDays} align="left" /></div>
        <div style={{ marginTop: 0 }}><TechBadge label={labels.reworkOrders} value={reworkCount} color={getBoardHud().rose} align="left" /></div>
      </div>

      {/* 右侧集群 */}
      <div style={{ 
        position: 'absolute', 
        right: '10%', 
        top: '50%', 
        transform: 'translateY(-50%)', 
        zIndex: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
        alignItems: 'flex-end'
      }}>
        <div style={{ marginBottom: 0 }}><TechBadge label={labels.pendingSchedule} value={pendingSchedule} color={getBoardHud().cyan} align="right" /></div>
        <div style={{ marginRight: -40 }}><TechBadge label={labels.onTimeDelivery} value={onTimeDelivery.toFixed(1)} color={getBoardHud().platformBlue} unit="%" align="right" /></div>
        <div style={{ marginTop: 0 }}><TechBadge label={labels.qualifiedRate} value={qualifiedRate.toFixed(1)} color={getBoardHud().emerald} unit="%" align="right" /></div>
      </div>

      {/* 中央黄金位置（成品产出，区间成品入库数量） */}
      <div style={{ 
        position: 'absolute', 
        bottom: '1%', 
        left: '50%', 
        transform: 'translateX(-50%)', 
        textAlign: 'center',
        padding: '10px 40px',
        borderTop: '1px solid rgba(0,255,255,0.2)',
        background: 'linear-gradient(180deg, rgba(0,255,255,0.05), transparent)'
      }}>
        <div style={{ 
          fontSize: 14, 
          color: '#fff', 
          letterSpacing: 4, 
          fontWeight: 600,
          background: 'rgba(0, 0, 0, 0.4)', 
          padding: '1px 6px',
          borderRadius: 4,
          display: 'inline-block',
          marginBottom: 6,
          boxShadow: '0 0 10px rgba(0, 82, 204, 0.4)'
        }}>
          {labels.todayOutput}
        </div>
        <div style={{ 
          fontSize: 52, 
          color: '#fff', 
          fontWeight: 900, 
          fontFamily: clockFont, 
          textShadow: `0 0 30px ${getBoardHud().emerald}`,
          lineHeight: 1.1
        }}>
          {formatCompact(todayOutput)}
        </div>
        <div style={{ fontSize: 10, color: getBoardHud().textDim, marginTop: 4 }}>FINISHED_GOODS_INBOUND_QTY</div>
      </div>
    </div>

    <style>{`
      @keyframes hudFloat {
        0% { transform: translateY(0px); }
        50% { transform: translateY(-8px); }
        100% { transform: translateY(0px); }
      }
      @keyframes orbitSpin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
      @keyframes pulse {
        0% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.5; transform: scale(0.8); }
        100% { opacity: 1; transform: scale(1); }
      }
      @keyframes techScanEffect {
        0% { transform: translateX(-100%); }
        100% { transform: translateX(250%); }
      }
      .hud-card-float {
        animation: hudFloat 4s ease-in-out infinite;
      }
      .hud-ring-spin {
        animation: orbitSpin 10s linear infinite;
      }
    `}</style>
  </div>
);






/** ===== StatTile：面板内小卡 ===== */
interface StatTileProps {
  label: string;
  value: React.ReactNode;
  color?: string;
  unit?: string;
}
const StatTile: React.FC<StatTileProps> = ({ label, value, color = getBoardHud().cyan, unit }) => (
  <div
    style={{
      flex: 1,
      minWidth: 0,
      padding: '8px 10px',
      background: 'linear-gradient(160deg, rgba(10, 32, 64, 0.7), rgba(4, 15, 34, 0.7))',
      border: `1px solid ${getBoardHud().borderLine}`,
      boxShadow: `inset 0 0 14px rgba(0, 130, 210, 0.12)`,
      display: 'flex',
      flexDirection: 'column',
      gap: 2,
    }}
  >
    <span style={{ fontSize: 13, color: getBoardHud().textSoft, letterSpacing: 0.3 }}>{label}</span>
    <span
      style={{
        fontSize: 22,
        fontWeight: 800,
        lineHeight: 1.1,
        color,
        fontFamily: clockFont,
        textShadow: `0 0 8px ${color}55`,
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: 4,
      }}
    >
      {value}
      {unit ? <span style={{ fontSize: 11, color: getBoardHud().textSoft, fontWeight: 500 }}>{unit}</span> : null}
    </span>
  </div>
);

/** ===== 实时播报 Feed ===== */
interface BroadcastFeedProps {
  items: ProductionBroadcastItem[];
  emptyText: string;
}
const BroadcastFeed: React.FC<BroadcastFeedProps> = ({ items, emptyText }) => {
  if (!items || items.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={<span style={{ color: getBoardHud().textDim }}>{emptyText}</span>}
        />
      </div>
    );
  }
  const animKey = 'live-scroll';
  const loop = items.length > 4 ? [...items, ...items] : items;
  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        overflow: 'hidden',
        position: 'relative',
        maskImage:
          'linear-gradient(to bottom, transparent, black 10%, black 90%, transparent)',
      }}
    >
      <style>
        {`
          @keyframes ${animKey} {
            0% { transform: translateY(0); }
            100% { transform: translateY(-50%); }
          }
          .hud-live-feed { animation: ${animKey} 42s linear infinite; }
          .hud-live-feed:hover { animation-play-state: paused; }
          @media (prefers-reduced-motion: reduce) {
            .hud-live-feed { animation: none !important; }
          }
        `}
      </style>
      <div
        className="hud-live-feed"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          paddingTop: 4,
          paddingBottom: 4,
        }}
      >
        {loop.map((it, idx) => {
          const qualified = Number(it.qualified_quantity || 0);
          const unqualified = Number(it.unqualified_quantity || 0);
          const level: 'info' | 'warn' | 'risk' =
            unqualified > qualified ? 'risk' : unqualified > 0 ? 'warn' : 'info';
          const dotColor =
            level === 'risk'
              ? getBoardHud().rose
              : level === 'warn'
                ? getBoardHud().amber
                : getBoardHud().cyan;
          const timeText = it.created_at ? formatDateTime(it.created_at, 'MM-DD HH:mm') : '';
          return (
            <div
              key={`${it.id}-${idx}`}
              style={{
                padding: '5px 10px',
                background: 'rgba(8, 24, 50, 0.55)',
                border: `1px solid rgba(0, 229, 255, 0.12)`,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                flexShrink: 0,
                fontSize: 13,
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: dotColor,
                  boxShadow: `0 0 6px ${dotColor}`,
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  color: getBoardHud().textSoft,
                  fontFamily: clockFont,
                  fontSize: 11,
                  flexShrink: 0,
                }}
              >
                {timeText}
              </span>
              <span
                style={{
                  color: getBoardHud().textPrimary,
                  fontWeight: 600,
                  flex: 1,
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {it.operator_name} · {it.process_name} · {it.work_order_no}
              </span>
              <span style={{ color: getBoardHud().emerald, fontFamily: clockFont, fontSize: 13 }}>
                ✓{qualified}
              </span>
              {unqualified > 0 && (
                <span style={{ color: getBoardHud().rose, fontFamily: clockFont, fontSize: 13 }}>
                  ×{unqualified}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

/** ===== 顶部装饰标题栏（对齐参考图：中心大字 + 两侧波形） ===== */
const HeaderDecoration: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      position: 'absolute',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      pointerEvents: 'none',
      overflow: 'hidden',
    }}
  >
    <style>
      {`
        @keyframes headerPulseLine {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
        @keyframes headerGlow {
          0%, 100% { filter: drop-shadow(0 0 8px rgba(0, 229, 255, 0.4)); }
          50% { filter: drop-shadow(0 0 16px rgba(0, 229, 255, 0.8)); }
        }
        @keyframes headerFlash {
          0%, 40%, 60%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}
    </style>
    <svg
      width="100%"
      height="100%"
      preserveAspectRatio="none"
      viewBox="0 0 1600 80"
      style={{ position: 'absolute', inset: 0 }}
    >
      <defs>
        <radialGradient id="hud-center-glow" cx="50%" cy="100%" r="50%">
          <stop offset="0%" stopColor="rgba(0, 229, 255, 0.2)" />
          <stop offset="60%" stopColor="rgba(0, 229, 255, 0.05)" />
          <stop offset="100%" stopColor="rgba(0, 229, 255, 0)" />
        </radialGradient>
        <linearGradient id="hud-line-glow" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="transparent" />
          <stop offset="0.3" stopColor={getBoardHud().cyan} stopOpacity="0.8" />
          <stop offset="0.5" stopColor="#ffffff" />
          <stop offset="0.7" stopColor={getBoardHud().cyan} stopOpacity="0.8" />
          <stop offset="1" stopColor="transparent" />
        </linearGradient>
      </defs>
      
      {/* 顶部柔和中心背景 */}
      <rect x="0" y="0" width="1600" height="80" fill="url(#hud-center-glow)" />
      
      {/* 底部折线轮廓，带发光动画 */}
      <g style={{ animation: 'headerGlow 3s ease-in-out infinite' }}>
        <polyline points="0,60 450,60 500,78 1100,78 1150,60 1600,60" fill="none" stroke="url(#hud-line-glow)" strokeWidth="2" />
      </g>
      
      {/* 装饰边框内线 */}
      <polyline points="0,55 440,55 490,72 1110,72 1160,55 1600,55" fill="none" stroke={getBoardHud().cyanSoft} strokeOpacity="0.2" strokeWidth="1" />
      
      {/* 斜线切角装饰（左） */}
      <polygon points="455,60 480,75 470,75 445,60" fill={getBoardHud().cyan} opacity="0.9" />
      <polygon points="465,60 490,75 480,75 455,60" fill={getBoardHud().cyan} opacity="0.4" />
      <polygon points="475,60 500,75 490,75 465,60" fill={getBoardHud().cyan} opacity="0.15" />
      
      {/* 斜线切角装饰（右） */}
      <polygon points="1145,60 1120,75 1130,75 1155,60" fill={getBoardHud().cyan} opacity="0.9" />
      <polygon points="1135,60 1110,75 1120,75 1145,60" fill={getBoardHud().cyan} opacity="0.4" />
      <polygon points="1125,60 1100,75 1110,75 1135,60" fill={getBoardHud().cyan} opacity="0.15" />

      {/* 顶部脉冲指示栏 */}
      <rect x="700" y="0" width="200" height="3" fill={getBoardHud().cyan} style={{ animation: 'headerPulseLine 2s ease-in-out infinite' }} />
      <rect x="760" y="3" width="80" height="2" fill="#ffffff" opacity="0.6" style={{ animation: 'headerFlash 3s infinite' }} />

      {/* 点阵和刻度装饰 */}
      {Array.from({ length: 15 }).map((_, i) => (
        <rect key={`tickL-${i}`} x={300 + i * 8} y="56" width="3" height="4" fill={getBoardHud().cyanSoft} opacity={0.3 + ((i % 3) * 0.2)} />
      ))}
      {Array.from({ length: 15 }).map((_, i) => (
        <rect key={`tickR-${i}`} x={1300 - i * 8} y="56" width="3" height="4" fill={getBoardHud().cyanSoft} opacity={0.3 + ((i % 3) * 0.2)} />
      ))}
    </svg>
    {children}
  </div>
);

const BusinessBoardPage: React.FC = () => {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState(formatDateTime(new Date(), 'YYYY-MM-DD HH:mm:ss'));
  const containerRef = useRef<HTMLDivElement>(null);
  const [customBoardTitle, setCustomBoardTitle] = useState('');
  /** 中间配图文件 UUID，null 表示使用系统默认图 */
  const [customHeroImageUuid, setCustomHeroImageUuid] = useState<string | null>(null);
  const [heroTextureUrl, setHeroTextureUrl] = useState(DEFAULT_HERO_TEXTURE);
  const [titleModalOpen, setTitleModalOpen] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  /** 弹窗内编辑中的中间图 UUID */
  const [heroImageUuidDraft, setHeroImageUuidDraft] = useState<string | null>(null);
  const [heroDraftPreviewUrl, setHeroDraftPreviewUrl] = useState(DEFAULT_HERO_TEXTURE);
  const [timeRange, setTimeRange] = useState<'today' | 'week' | 'month'>('month');

  /** 根据 timeRange 推导 YYYY-MM-DD 区间；week 以周一为起点 */
  const dateRange = useMemo(() => {
    const now = dayjs();
    let start = now;
    let end = now;
    if (timeRange === 'today') {
      start = now.startOf('day');
      end = now.endOf('day');
    } else if (timeRange === 'week') {
      const dow = now.day();
      const daysBack = dow === 0 ? 6 : dow - 1;
      start = now.subtract(daysBack, 'day').startOf('day');
      end = start.add(6, 'day').endOf('day');
    } else {
      start = now.startOf('month');
      end = now.endOf('month');
    }
    return {
      dateStart: start.format('YYYY-MM-DD'),
      dateEnd: end.format('YYYY-MM-DD'),
    };
  }, [timeRange]);

  const siteName = (useConfigStore((state) => state.configs['site_name']) as string) || 'RiverEdge SaaS';
  const siteLogoUrl = useSiteLogoUrl();

  const defaultBoardTitle = t('dashboard.businessBoard.siteTitle', { siteName });
  const displayBoardTitle = customBoardTitle || defaultBoardTitle;

  useEffect(() => {
    document.title = `${displayBoardTitle} - ${siteName}`;
  }, [displayBoardTitle, siteName]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          const res = await getBusinessBoardTitle();
          if (cancelled) return;
          const fromApi = (res?.title || '').trim();
          setCustomBoardTitle(fromApi);
          setCustomHeroImageUuid(res?.hero_image_uuid ?? null);
          return;
        } catch {
          if (attempt < 2) {
            await new Promise((resolve) => setTimeout(resolve, 400));
            continue;
          }
          setCustomBoardTitle('');
          setCustomHeroImageUuid(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** 将已保存的中间图 UUID 解析为 Three 可用的贴图 URL */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!customHeroImageUuid) {
        setHeroTextureUrl(DEFAULT_HERO_TEXTURE);
        return;
      }
      try {
        const previewInfo = await getFilePreview(customHeroImageUuid);
        if (!cancelled) setHeroTextureUrl(previewInfo.preview_url);
      } catch {
        if (!cancelled) setHeroTextureUrl(DEFAULT_HERO_TEXTURE);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [customHeroImageUuid]);

  /** 弹窗内预览：随草稿 UUID 变化 */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!heroImageUuidDraft) {
        setHeroDraftPreviewUrl(DEFAULT_HERO_TEXTURE);
        return;
      }
      try {
        const previewInfo = await getFilePreview(heroImageUuidDraft);
        if (!cancelled) setHeroDraftPreviewUrl(previewInfo.preview_url);
      } catch {
        if (!cancelled) setHeroDraftPreviewUrl(DEFAULT_HERO_TEXTURE);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [heroImageUuidDraft]);

  const openTitleModal = useCallback(() => {
    setTitleDraft(customBoardTitle || defaultBoardTitle);
    setHeroImageUuidDraft(customHeroImageUuid);
    setTitleModalOpen(true);
  }, [customBoardTitle, customHeroImageUuid, defaultBoardTitle]);

  const handleHeroBeforeUpload = useCallback<NonNullable<UploadProps['beforeUpload']>>(
    async (file) => {
      const f = file as { type?: string; size?: number };
      if (!f.type?.startsWith('image/')) {
        message.error(t('dashboard.businessBoard.heroImageInvalidType'));
        return Upload.LIST_IGNORE;
      }
      if ((f.size ?? 0) > 5 * 1024 * 1024) {
        message.error(t('dashboard.businessBoard.heroImageTooLarge'));
        return Upload.LIST_IGNORE;
      }
      try {
        const res = await uploadFile(file as Parameters<typeof uploadFile>[0], {
          category: 'dashboard_hero',
          description: 'business-board-center-image',
        });
        setHeroImageUuidDraft(res.uuid);
      } catch (e: unknown) {
        message.error((e as Error)?.message || t('dashboard.businessBoard.error.uploadFailed'));
      }
      return false;
    },
    [t],
  );

  const saveBoardTitle = useCallback(async () => {
    const nextTitle = titleDraft.trim() || null;
    try {
      const data = await putBusinessBoardTitle({
        title: nextTitle,
        hero_image_uuid: heroImageUuidDraft,
      });
      setCustomBoardTitle((data.title || '').trim());
      setCustomHeroImageUuid(data.hero_image_uuid ?? null);
      setTitleModalOpen(false);
    } catch (e: unknown) {
      message.error((e as Error)?.message || t('dashboard.businessBoard.error.saveFailed'));
    }
  }, [titleDraft, heroImageUuidDraft]);

  const resetBoardTitle = useCallback(async () => {
    try {
      const data = await putBusinessBoardTitle({
        title: null,
        hero_image_uuid: customHeroImageUuid,
      });
      setCustomBoardTitle((data.title || '').trim());
      setCustomHeroImageUuid(data.hero_image_uuid ?? null);
      setTitleDraft(defaultBoardTitle);
    } catch (e: unknown) {
      message.error((e as Error)?.message || t('dashboard.businessBoard.error.resetFailed'));
    }
  }, [defaultBoardTitle, customHeroImageUuid]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(formatDateTime(new Date(), 'YYYY-MM-DD HH:mm:ss')), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const onFs = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  /** ===== 真实数据 ===== */
  const salesQuery = useQuery({
    queryKey: ['dashboard-board', 'sales', timeRange],
    queryFn: () => getSalesSummary(dateRange.dateStart, dateRange.dateEnd),
    refetchInterval: 60_000,
    retry: 1,
  });
  const purchaseQuery = useQuery({
    queryKey: ['dashboard-board', 'purchase', timeRange],
    queryFn: () => getPurchaseSummary(dateRange.dateStart, dateRange.dateEnd),
    refetchInterval: 60_000,
    retry: 1,
  });
  const manufacturingQuery = useQuery({
    queryKey: ['dashboard-board', 'manufacturing', timeRange],
    queryFn: () => getManufacturingSummary(dateRange.dateStart, dateRange.dateEnd),
    refetchInterval: 45_000,
    retry: 1,
  });
  const equipmentQuery = useQuery({
    queryKey: ['dashboard-board', 'equipment', timeRange],
    queryFn: () => getEquipmentSummary(dateRange.dateStart, dateRange.dateEnd),
    refetchInterval: 60_000,
    retry: 1,
  });
  const metricsQuery = useQuery({
    queryKey: ['dashboard-board', 'metrics', timeRange],
    queryFn: () => getManagementMetrics(dateRange.dateStart, dateRange.dateEnd),
    refetchInterval: 90_000,
    retry: 1,
  });
  const processQuery = useQuery({
    queryKey: ['dashboard-board', 'process'],
    queryFn: () => getProcessProgress(false),
    refetchInterval: 45_000,
    retry: 1,
  });
  const broadcastQuery = useQuery({
    queryKey: ['dashboard-board', 'broadcast'],
    queryFn: () => getProductionBroadcast(20),
    refetchInterval: 30_000,
    retry: 1,
  });
  const salesTop10Query = useQuery({
    queryKey: ['dashboard-board', 'sales-top10', timeRange],
    queryFn: () => getSalesTop10(dateRange.dateStart, dateRange.dateEnd),
    refetchInterval: 120_000,
    retry: 1,
  });
  const purchaseTop10Query = useQuery({
    queryKey: ['dashboard-board', 'purchase-top10', timeRange],
    queryFn: () => getPurchaseTop10(dateRange.dateStart, dateRange.dateEnd),
    refetchInterval: 120_000,
    retry: 1,
  });
  const activeWorkOrdersQuery = useQuery({
    queryKey: ['dashboard-board', 'active-work-orders'],
    queryFn: () => getActiveWorkOrders(50),
    refetchInterval: 30_000,
    retry: 1,
  });
  const warehouseSummaryQuery = useQuery({
    queryKey: ['dashboard-board', 'warehouse-summary'],
    queryFn: getWarehouseSummary,
    refetchInterval: 60_000,
    retry: 1,
  });
  const warehouseTrendQuery = useQuery({
    queryKey: ['dashboard-board', 'warehouse-trend', timeRange],
    queryFn: () => getWarehouseTrend(dateRange.dateStart, dateRange.dateEnd),
    refetchInterval: 120_000,
    retry: 1,
  });

  const [woPage, setWoPage] = useState(0);
  const WO_PAGE_SIZE = 5;
  const allWorkOrders: ActiveWorkOrderItem[] = useMemo(
    () => activeWorkOrdersQuery.data ?? [],
    [activeWorkOrdersQuery.data],
  );

  useEffect(() => {
    if (allWorkOrders.length <= WO_PAGE_SIZE) return;
    const totalPages = Math.ceil(allWorkOrders.length / WO_PAGE_SIZE);
    const timer = setInterval(() => {
      setWoPage(prev => (prev + 1) % totalPages);
    }, 6000);
    return () => clearInterval(timer);
  }, [allWorkOrders.length]);

  const sales = salesQuery.data;
  const purchase = purchaseQuery.data;
  const manufacturing = manufacturingQuery.data;
  const equipment = equipmentQuery.data;
  const metrics = metricsQuery.data;
  const processItems = useMemo(() => processQuery.data ?? [], [processQuery.data]);
  const broadcastItems = useMemo(() => broadcastQuery.data ?? [], [broadcastQuery.data]);
  const salesTop10 = useMemo(() => salesTop10Query.data ?? [], [salesTop10Query.data]);
  const purchaseTop10 = useMemo(() => purchaseTop10Query.data ?? [], [purchaseTop10Query.data]);
  const warehouseSummary = warehouseSummaryQuery.data;
  const warehouseTrend = useMemo(() => warehouseTrendQuery.data ?? [], [warehouseTrendQuery.data]);

  const salesBarData = useMemo(
    () => [
      {
        period: t('dashboard.businessBoard.sales.lastMonth'),
        amount: Number(sales?.total_amount_last_month ?? 0),
      },
      {
        period: t('dashboard.businessBoard.sales.thisMonth'),
        amount: Number(sales?.total_amount ?? 0),
      },
    ],
    [sales, t],
  );

  const processChartData = useMemo(() => {
    const arr = processItems.slice(0, 6);
    const qLabel = t('dashboard.businessBoard.process.qualified');
    const uLabel = t('dashboard.businessBoard.process.unqualified');
    const pLabel = t('dashboard.businessBoard.process.planned');
    return arr.flatMap((p) => [
      { process: p.process_name, series: pLabel, value: Number(p.planned_quantity || 0) },
      { process: p.process_name, series: qLabel, value: Number(p.qualified_quantity || 0) },
      { process: p.process_name, series: uLabel, value: Number(p.unqualified_quantity || 0) },
    ]);
  }, [processItems, t]);

  const heroLabels = useMemo(
    () => ({
      woPlatform: t('dashboard.businessBoard.hero.woPlatform'),
      opPlatform: t('dashboard.businessBoard.hero.opPlatform'),
      todayOutput: t('dashboard.businessBoard.hero.todayOutput'),
      qualifiedRate: t('dashboard.businessBoard.hero.qualifiedRate'),
      inProgressWo: t('dashboard.businessBoard.hero.inProgressWo'),
      pendingSchedule: t('dashboard.businessBoard.hero.pendingSchedule'),
      avgCycle: t('dashboard.businessBoard.hero.avgCycle'),
      onTimeDelivery: t('dashboard.businessBoard.hero.onTimeDelivery'),
      reworkOrders: t('dashboard.businessBoard.hero.reworkOrders'),
      repairingEquip: t('dashboard.businessBoard.hero.repairingEquip'),
      unitDays: t('dashboard.businessBoard.unit.days'),
    }),
    [t],
  );

  const themeStyle = useThemeStore((s) => s.resolved.themeStyle);
  const colorPrimary = useThemeStore((s) => s.resolved.token.colorPrimary) || '#1890ff';
  const isPlainBoard = themeStyle === 'plain';
  const boardHudPalette = useMemo(
    () => (isPlainBoard ? buildBusinessBoardPlainHud(colorPrimary) : businessBoardVividHud),
    [isPlainBoard, colorPrimary],
  );
  const warehouseChartColors = useMemo(
    () => getBusinessBoardWarehouseChartColors(isPlainBoard, colorPrimary),
    [isPlainBoard, colorPrimary],
  );

  return (
    <BusinessBoardHudRoot hud={boardHudPalette}>
    <div
      ref={containerRef}
      style={{
        width: isFullscreen ? '100vw' : '100%',
        height: isFullscreen
          ? '100vh'
          : getViewportHeightExpr(SYSTEM_VIEWPORT_OFFSETS.BUSINESS_BOARD_PX, {
              compensateHeaderInFullscreen: true,
            }),
        position: isFullscreen ? 'fixed' : 'relative',
        top: isFullscreen ? 0 : 'auto',
        left: isFullscreen ? 0 : 'auto',
        zIndex: isFullscreen ? 1000 : 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: isPlainBoard
          ? `linear-gradient(180deg, ${getBoardHud().bgDeep} 0%, ${getBoardHud().bgMid} 100%)`
          : `
          radial-gradient(ellipse 80% 50% at 50% 0%, rgba(0, 136, 255, 0.22), transparent 85%),
          radial-gradient(circle at 50% 50%, rgba(0, 136, 255, 0.05), transparent 70%),
          linear-gradient(180deg, ${getBoardHud().bgDeep} 0%, ${getBoardHud().bgDeep} 100%)
        `,
        backgroundColor: getBoardHud().bgDeep,
        boxSizing: 'border-box',
        borderRadius: isFullscreen ? 0 : token.borderRadiusLG || token.borderRadius,
      }}
    >
      {/* 细网格（backgroundPosition 使重复纹理相对视区居中） */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(0, 208, 255, 0.08) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 208, 255, 0.08) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
          backgroundPosition: 'center',
          pointerEvents: 'none',
          mixBlendMode: 'screen',
          opacity: 0.8
        }}
      />

      <header
        style={{
          position: 'relative',
          zIndex: 10,
          flexShrink: 0,
          height: 80,
          overflow: 'hidden',
        }}
      >
        <HeaderDecoration>
          <div />
        </HeaderDecoration>
        <div
          style={{
            position: 'relative',
            zIndex: 2,
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)',
            alignItems: 'center',
            gap: 12,
            padding: '10px 24px 6px',
            height: '100%',
          }}
        >
          <div
            style={{
              justifySelf: 'start',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              minWidth: 0,
            }}
          >
            <style>
              {`
                .hud-time-filter .ant-radio-button-wrapper {
                  background: rgba(8, 26, 54, 0.6);
                  border-color: rgba(0, 208, 255, 0.2);
                  color: #9fb8d0;
                }
                .hud-time-filter .ant-radio-button-wrapper:hover {
                  color: #00d0ff;
                }
                .hud-time-filter .ant-radio-button-wrapper-checked:not(.ant-radio-button-wrapper-disabled) {
                  border-color: #00d0ff;
                  color: #040d1e;
                  background: #00d0ff;
                  box-shadow: 0 0 15px rgba(0, 208, 255, 0.6);
                }
                .hud-time-filter .ant-radio-button-wrapper-checked:not(.ant-radio-button-wrapper-disabled):hover {
                  color: #040d1e;
                  border-color: #00d0ff;
                }
                .hud-time-filter .ant-radio-button-wrapper::before {
                  background-color: rgba(0, 208, 255, 0.2) !important;
                }
                .hud-time-filter .ant-radio-button-wrapper-checked::before {
                  background-color: transparent !important;
                }
              `}
            </style>
            <Radio.Group
              className="hud-time-filter"
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              buttonStyle="solid"
            >
              <Radio.Button value="today">{t('dashboard.businessBoard.timeRange.today')}</Radio.Button>
              <Radio.Button value="week">{t('dashboard.businessBoard.timeRange.week')}</Radio.Button>
              <Radio.Button value="month">{t('dashboard.businessBoard.timeRange.month')}</Radio.Button>
            </Radio.Group>
          </div>
          <div
            style={{
              justifySelf: 'center',
              textAlign: 'center',
              minWidth: 0,
              maxWidth: 'min(52vw, 540px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Title
              level={4}
              style={{
                color: '#ffffff',
                margin: 0,
                fontWeight: 800,
                fontSize: 32,
                lineHeight: 0.75,
                letterSpacing: 4,
                textShadow: `0 0 20px rgba(0, 208, 255, 0.8), 0 0 35px rgba(0, 136, 255, 0.4)`,
                padding: '18px 32px',
              }}
              ellipsis
            >
              {displayBoardTitle}
            </Title>
          </div>
          <div
            style={{
              justifySelf: 'end',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              flexShrink: 0,
            }}
          >
            <time
              dateTime={currentTime}
              style={{
                color: '#ffffff',
                fontSize: 20,
                fontWeight: 600,
                fontFamily: '"Varela Round", "Arial Rounded MT Bold", "Microsoft YaHei", sans-serif',
                letterSpacing: 1.5,
                whiteSpace: 'nowrap',
              }}
            >
              {currentTime}
            </time>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <Tooltip title={t('dashboard.businessBoard.customizeTitle')}>
                <Button
                  type="text"
                  icon={<SettingOutlined style={{ fontSize: 18 }} />}
                  onClick={openTitleModal}
                  style={{ color: '#ffffff' }}
                  aria-label={t('dashboard.businessBoard.customizeTitle')}
                />
              </Tooltip>
              <Tooltip
                title={
                  isFullscreen
                    ? t('dashboard.businessBoard.exitFullscreen')
                    : t('dashboard.businessBoard.fullscreen')
                }
              >
                <Button
                  type="text"
                  icon={
                    isFullscreen ? (
                      <FullscreenExitOutlined style={{ fontSize: 18 }} />
                    ) : (
                      <FullscreenOutlined style={{ fontSize: 18 }} />
                    )
                  }
                  onClick={toggleFullscreen}
                  style={{ color: '#ffffff' }}
                  aria-label={
                    isFullscreen
                      ? t('dashboard.businessBoard.exitFullscreen')
                      : t('dashboard.businessBoard.fullscreen')
                  }
                />
              </Tooltip>
            </div>
          </div>
        </div>
      </header>

      <Modal
        title={t('dashboard.businessBoard.titleSettingsModal')}
        open={titleModalOpen}
        onOk={saveBoardTitle}
        onCancel={() => setTitleModalOpen(false)}
        okText={t('dashboard.businessBoard.saveTitle')}
        cancelText={t('common.cancel')}
        destroyOnHidden
        width={480}
      >
        <Input
          value={titleDraft}
          onChange={(e) => setTitleDraft(e.target.value)}
          placeholder={t('dashboard.businessBoard.titleInputPlaceholder')}
          maxLength={80}
          showCount
          onPressEnter={saveBoardTitle}
        />
        <Button type="link" size="small" onClick={resetBoardTitle} style={{ paddingLeft: 0, marginTop: 8 }}>
          {t('dashboard.businessBoard.resetTitle')}
        </Button>

        <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${token.colorBorderSecondary}` }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
            {t('dashboard.businessBoard.heroImageLabel')}
          </div>
          <div style={{ fontSize: 12, color: token.colorTextSecondary, marginBottom: 10 }}>
            {t('dashboard.businessBoard.heroImageHint')}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 12 }}>
            <Upload accept="image/*" showUploadList={false} maxCount={1} beforeUpload={handleHeroBeforeUpload}>
              <div
                style={{
                  width: 104,
                  height: 104,
                  border: `1px dashed ${token.colorBorder}`,
                  borderRadius: token.borderRadiusLG,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  background: token.colorFillAlter,
                }}
              >
                {heroImageUuidDraft ? (
                  <img
                    src={heroDraftPreviewUrl}
                    alt=""
                    style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                  />
                ) : (
                  <div style={{ textAlign: 'center', padding: 8 }}>
                    <PlusOutlined style={{ fontSize: 22, color: token.colorTextSecondary }} />
                    <div style={{ marginTop: 6, fontSize: 12, color: token.colorTextSecondary }}>
                      {t('dashboard.businessBoard.uploadHeroImage')}
                    </div>
                  </div>
                )}
              </div>
            </Upload>
            {heroImageUuidDraft ? (
              <Button type="link" size="small" onClick={() => setHeroImageUuidDraft(null)} style={{ paddingLeft: 0 }}>
                {t('dashboard.businessBoard.resetHeroImage')}
              </Button>
            ) : null}
          </div>
        </div>
      </Modal>

      {/* 主体：左 2 + 中（装饰 + 1）+ 右 2 */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          flex: 1,
          minHeight: 0,
          display: 'flex',
          gap: 16,
          padding: '10px 16px 16px',
          boxSizing: 'border-box',
        }}
      >
        {/* Left */}
        <div
          style={{
            flex: '1 1 0',
            minWidth: 0,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          <HudPanel>
            <HudTitle
              title={t('dashboard.businessBoard.section.salesPanel')}
              suffix={t('dashboard.businessBoard.sales.thisMonth')}
            />
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gap: 8,
                marginBottom: 10,
                flexShrink: 0,
              }}
            >
              <StatTile
                label={t('dashboard.businessBoard.sales.pendingQuotation')}
                value={sales?.pending_quotations ?? '—'}
                color={getBoardHud().cyan}
              />
              <StatTile
                label={t('dashboard.businessBoard.sales.pendingShipment')}
                value={sales?.pending_shipments ?? '—'}
                color={getBoardHud().amber}
              />
              <StatTile
                label={t('dashboard.businessBoard.sales.overdueShipment')}
                value={sales?.overdue_shipments ?? '—'}
                color={getBoardHud().rose}
              />
              <StatTile
                label={t('dashboard.businessBoard.sales.achievementRate')}
                value={sales ? sales.achievement_rate.toFixed(1) : '—'}
                unit="%"
                color={getBoardHud().emerald}
              />
            </div>
            <div style={{ ...chartHost, minHeight: 220, marginTop: 0 }}>
              <div style={{ fontSize: 10, color: getBoardHud().textDim, marginBottom: 8, letterSpacing: 2 }}>PRODUCT_SALES_RANKING_TOP10</div>
              <div style={{ height: '100%', width: '100%' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
                  {(() => {
                    if (salesTop10.length === 0) {
                      return (
                        <div style={{ textAlign: 'center', color: getBoardHud().textDim, padding: '24px 0', fontSize: 13 }}>
                          {t('common.noData', { defaultValue: '暂无数据' })}
                        </div>
                      );
                    }
                    const maxQty = Math.max(1, ...salesTop10.map((x) => x.quantity));
                    return salesTop10.map((item, idx) => (
                      <div key={`${item.material_id}-${item.material_code || idx}`} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 18, fontSize: 13, color: getBoardHud().textDim, fontFamily: clockFont }}>{(idx + 1).toString().padStart(2, '0')}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                            <span style={{ fontSize: 13, color: getBoardHud().textSoft, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.material_name || item.material_code}</span>
                            <span style={{ fontSize: 13, color: getBoardHud().cyan, fontWeight: 700, fontFamily: clockFont }}>{formatCompact(item.quantity)}</span>
                          </div>
                          <div style={{ height: 4, background: 'rgba(255,255,255,0.03)', borderRadius: 2, overflow: 'hidden', position: 'relative' }}>
                            <div
                              style={{
                                height: '100%',
                                width: `${(item.quantity / maxQty) * 100}%`,
                                background: `linear-gradient(90deg, ${getBoardHud().cyan}33, ${getBoardHud().cyan})`,
                                boxShadow: `0 0 10px ${getBoardHud().cyan}66`,
                                borderRadius: 2,
                                transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1)',
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            </div>
          </HudPanel>

          <HudPanel>
            <HudTitle title={t('dashboard.businessBoard.section.purchasePanel')} />
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gap: 8,
                marginBottom: 10,
                flexShrink: 0,
              }}
            >
              <StatTile
                label={t('dashboard.businessBoard.purchase.pendingRequisition')}
                value={purchase?.pending_requisitions ?? '—'}
                color={getBoardHud().cyan}
              />
              <StatTile
                label={t('dashboard.businessBoard.purchase.urgent')}
                value={purchase?.urgent_requisitions ?? '—'}
                color={getBoardHud().rose}
              />
              <StatTile
                label={t('dashboard.businessBoard.purchase.pendingReceipt')}
                value={purchase?.pending_receipts ?? '—'}
                color={getBoardHud().amber}
              />
              <StatTile
                label={t('dashboard.businessBoard.purchase.overdueReceipt')}
                value={purchase?.overdue_receipts ?? '—'}
                color={getBoardHud().rose}
              />
            </div>
            <div style={{ ...chartHost, minHeight: 220, marginTop: 0 }}>
              <div style={{ fontSize: 10, color: getBoardHud().textDim, marginBottom: 8, letterSpacing: 2 }}>RAW_MATERIAL_PURCHASE_TOP10</div>
              <div style={{ height: '100%', width: '100%' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
                  {(() => {
                    if (purchaseTop10.length === 0) {
                      return (
                        <div style={{ textAlign: 'center', color: getBoardHud().textDim, padding: '24px 0', fontSize: 13 }}>
                          {t('common.noData', { defaultValue: '暂无数据' })}
                        </div>
                      );
                    }
                    const maxQty = Math.max(1, ...purchaseTop10.map((x) => x.quantity));
                    return purchaseTop10.map((item, idx) => (
                      <div key={`${item.material_id}-${item.material_code || idx}`} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 18, fontSize: 13, color: getBoardHud().textDim, fontFamily: clockFont }}>{(idx + 1).toString().padStart(2, '0')}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                            <span style={{ fontSize: 13, color: getBoardHud().textSoft, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.material_name || item.material_code}</span>
                            <span style={{ fontSize: 13, color: getBoardHud().cyan, fontWeight: 700, fontFamily: clockFont }}>{formatCompact(item.quantity)}</span>
                          </div>
                          <div style={{ height: 4, background: 'rgba(255,255,255,0.03)', borderRadius: 2, overflow: 'hidden' }}>
                            <div
                              style={{
                                height: '100%',
                                width: `${(item.quantity / maxQty) * 100}%`,
                                background: `linear-gradient(90deg, ${getBoardHud().cyan}33, ${getBoardHud().cyan})`,
                                boxShadow: `0 0 10px ${getBoardHud().cyan}66`,
                                borderRadius: 2,
                                transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1)',
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            </div>
          </HudPanel>
        </div>

        {/* Middle */}
        <div
          style={{
            flex: '1.55 1 0',
            minWidth: 0,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          <HudPanel variant="middleTop" style={{ flex: '1.15 1 0', minHeight: 260 }}>
            {/* 制造态势标题与实时标签已根据要求移除 */}
            <HudHero
              centerTextureUrl={heroTextureUrl}
              todayOutput={Number(manufacturing?.today_output ?? 0)}
              qualifiedRate={Number(manufacturing?.qualified_rate ?? 0)}
              inProgressWo={Number(manufacturing?.in_progress_count ?? 0)}
              pendingSchedule={Number(manufacturing?.pending_scheduling ?? 0)}
              avgCycle={Number(metrics?.average_production_cycle ?? 0)}
              onTimeDelivery={Number(metrics?.on_time_delivery_rate ?? 0)}
              reworkCount={Number(manufacturing?.rework_count ?? 0)}
              repairingCount={Number(equipment?.repairing_count ?? 0)}
              siteLogoUrl={siteLogoUrl}
              labels={heroLabels}
            />
          </HudPanel>

          <HudPanel variant="middleBottom" style={{ flex: '0.75 1 0' }}>
            <HudTitle 
              title={t('dashboard.businessBoard.section.activeWorkOrders')} 
              right={
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                   <span style={{ fontSize: 10, color: getBoardHud().cyan, opacity: 0.8, fontFamily: clockFont }}>PAGE {woPage + 1}/{Math.ceil(allWorkOrders.length / WO_PAGE_SIZE)}</span>
                   <span style={{ fontSize: 10, color: getBoardHud().cyan, fontFamily: clockFont }}>TOTAL: {allWorkOrders.length.toString().padStart(2, '0')}</span>
                </div>
              } 
            />
            <div style={{ ...chartHost, minHeight: 200, display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 6 }}>
              {allWorkOrders.slice(woPage * WO_PAGE_SIZE, (woPage + 1) * WO_PAGE_SIZE).map((wo, woIdx) => (
                <div 
                  key={wo.id} 
                  className="hud-wo-row"
                  style={{ 
                    position: 'relative', 
                    padding: '8px 16px',
                    background: 'rgba(255,255,255,0.02)',
                    borderRadius: 4,
                    animation: 'rowEnter 0.5s ease forwards',
                    animationDelay: `${woIdx * 0.1}s`,
                    opacity: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 20,
                    minHeight: 52
                  }}
                >
                  {/* 左侧：工单 & 产品 & 计划数 (占 42%) */}
                  <div style={{ flex: '0 0 42%', display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <span style={{ fontSize: 13, background: getBoardHud().cyan, color: getBoardHud().bgDeep, fontWeight: 'bold', padding: '2px 6px', borderRadius: 2, fontFamily: clockFont, whiteSpace: 'nowrap' }}>{wo.id}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                      <span style={{ fontSize: 13, color: getBoardHud().textPrimary, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{wo.product}</span>
                      <span style={{ fontSize: 13, color: getBoardHud().textDim, whiteSpace: 'nowrap' }}>
                        [ {t('dashboard.businessBoard.workOrder.planned')}:{' '}
                        <span style={{ color: getBoardHud().cyan, fontWeight: 'bold', fontFamily: clockFont }}>
                          {wo.planned}
                        </span>{' '}
                        ]
                      </span>
                    </div>
                  </div>

                  {/* 右侧：强化版步骤轴 (固定显示 5 槽位) */}
                  <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', paddingLeft: 10, paddingRight: 10, alignSelf: 'stretch', paddingTop: 4 }}>
                    {/* 贯穿背景线 */}
                    <div style={{ position: 'absolute', left: 24, right: 24, top: 16, height: 1, background: 'rgba(255,255,255,0.08)', zIndex: 0 }} />

                    {(() => {
                      // 固定 5 个槽位：不足补占位、超过走窗口算法
                      const SLOT = 5;
                      type Slot = { key: string; step?: typeof wo.steps[number]; placeholder: boolean };
                      const slots: Slot[] = [];

                      if (wo.steps.length >= SLOT) {
                        const activeIdx = wo.steps.findIndex(s => s.status === 'active');
                        const focusIdx = activeIdx === -1 ? wo.steps.length - 1 : activeIdx;
                        let start = Math.max(0, focusIdx - 3);
                        let end = Math.min(wo.steps.length, focusIdx + 2);
                        if (end - start < SLOT) {
                          if (start === 0) end = Math.min(wo.steps.length, SLOT);
                          else if (end === wo.steps.length) start = Math.max(0, wo.steps.length - SLOT);
                        }
                        wo.steps.slice(start, end).forEach((step, idx) => {
                          slots.push({ key: `s-${start + idx}-${step.name}`, step, placeholder: false });
                        });
                      } else {
                        wo.steps.forEach((step, idx) => {
                          slots.push({ key: `s-${idx}-${step.name}`, step, placeholder: false });
                        });
                        // 后补占位圆环，保证 5 个对齐
                        for (let i = wo.steps.length; i < SLOT; i++) {
                          slots.push({ key: `ph-${wo.id}-${i}`, placeholder: true });
                        }
                      }
                      return slots;
                    })().map(({ key, step, placeholder }) => {
                      const isDone = step?.status === 'done';
                      const isActive = step?.status === 'active';
                      const isPending = step?.status === 'pending';
                      const COMPLETED_GREEN = '#34d399';
                      const PENDING_COLOR = 'rgba(255,255,255,0.1)';

                      return (
                        <div key={key} style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flex: 1 }}>
                          {placeholder ? (
                            <div style={{
                              width: 24,
                              height: 24,
                              borderRadius: '50%',
                              background: getBoardHud().bgDeep,
                              border: `2px solid ${PENDING_COLOR}`,
                              boxSizing: 'border-box',
                            }} />
                          ) : (
                            <div style={{
                              width: 24,
                              height: 24,
                              borderRadius: '50%',
                              background: isDone ? COMPLETED_GREEN : getBoardHud().bgDeep,
                              border: `2px solid ${isPending ? PENDING_COLOR : (isDone ? COMPLETED_GREEN : getBoardHud().cyan)}`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              boxSizing: 'border-box'
                            }}>
                              {isDone ? (
                                <span style={{ color: getBoardHud().bgDeep, fontSize: 13, fontWeight: 'bold' }}>✓</span>
                              ) : isActive ? (
                                <span style={{ color: getBoardHud().cyan, fontSize: 8, fontWeight: 'bold', fontFamily: clockFont }}>{step!.progress}%</span>
                              ) : null}
                            </div>
                          )}
                          <span style={{
                            fontSize: 13,
                            color: placeholder
                              ? 'transparent'
                              : isPending
                                ? getBoardHud().textDim
                                : isActive
                                  ? getBoardHud().cyan
                                  : (isDone ? COMPLETED_GREEN : getBoardHud().textSoft),
                            textAlign: 'center',
                            whiteSpace: 'nowrap',
                            userSelect: 'none'
                          }}>
                            {placeholder ? '—' : step!.name}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              
              <style>{`
                @keyframes rowEnter {
                  from { transform: translateX(10px); opacity: 0; }
                  to { transform: translateX(0); opacity: 1; }
                }
              `}</style>
            </div>
          </HudPanel>
        </div>

        {/* Right */}
        <div
          style={{
            flex: '1 1 0',
            minWidth: 0,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          <HudPanel variant="right">
            <HudTitle
              title={t('dashboard.businessBoard.section.warehouseLogistics')}
              suffix={t('dashboard.businessBoard.warehouse.monthTrend')}
              right={
                <div style={{ display: 'flex', gap: 10, fontSize: 13, alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: 10, height: 2, background: '#0095ff' }} />
                    <span style={{ color: '#0095ff' }}>{t('dashboard.businessBoard.warehouse.inboundShort')}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: 10, height: 2, background: '#fb7185' }} />
                    <span style={{ color: '#fb7185' }}>{t('dashboard.businessBoard.warehouse.outboundShort')}</span>
                  </div>
                  <span style={{ fontSize: 13, color: getBoardHud().cyan, fontFamily: clockFont, marginLeft: 4 }}>LO_TREND</span>
                </div>
              }
            />
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gap: 8,
                marginBottom: 10,
                flexShrink: 0,
              }}
            >
              <StatTile
                label={t('dashboard.businessBoard.warehouse.totalStock')}
                value={warehouseSummary ? formatCompact(warehouseSummary.total_stock) : '—'}
                color={getBoardHud().cyan}
              />
              <StatTile
                label={t('dashboard.businessBoard.warehouse.inStockBatches')}
                value={warehouseSummary?.in_stock_batches ?? '—'}
                unit={t('dashboard.businessBoard.unit.batch')}
                color={getBoardHud().emerald}
              />
              <StatTile
                label={t('dashboard.businessBoard.warehouse.pendingInbound')}
                value={warehouseSummary?.pending_inbound ?? '—'}
                unit={t('dashboard.businessBoard.unit.order')}
                color={getBoardHud().amber}
              />
              <StatTile
                label={t('dashboard.businessBoard.warehouse.pendingOutbound')}
                value={warehouseSummary?.pending_outbound ?? '—'}
                unit={t('dashboard.businessBoard.unit.order')}
                color={getBoardHud().rose}
              />
            </div>
            {(() => {
              const inData = warehouseTrend.map((p) => ({ time: p.date, val: p.in }));
              const outData = warehouseTrend.map((p) => ({ time: p.date, val: p.out }));
              const COLOR_IN = warehouseChartColors.colorIn;
              const COLOR_OUT = warehouseChartColors.colorOut;

              const chartHeight = isFullscreen ? 360 : 220;

              if (warehouseTrend.length === 0) {
                return (
                  <div style={{ width: '100%', height: chartHeight, display: 'flex', alignItems: 'center', justifyContent: 'center', color: getBoardHud().textDim, fontSize: 13 }}>
                    {t('common.noData', { defaultValue: '暂无数据' })}
                  </div>
                );
              }

              return (
                <div style={{ width: '100%', height: chartHeight, position: 'relative', overflow: 'visible', flexShrink: 0 }}>
                  <Column
                    key={`logistics-grouped-column-${isFullscreen ? 'fs' : 'nm'}`}
                    autoFit
                    appendPadding={4}
                    padding="auto"
                    data={[
                      ...inData.map(d => ({ ...d, type: 'IN' })),
                      ...outData.map(d => ({ ...d, type: 'OUT' })),
                    ]}
                    xField="time"
                    yField="val"
                    colorField="type"
                    group={true}
                    scale={{
                      color: { range: [COLOR_IN, COLOR_OUT] },
                      x: { paddingInner: 0.35, paddingOuter: 0.2 },
                      y: { nice: true, domainMin: 0 },
                    }}
                    // HUD 柔光柱：顶部色 → 柱底渐隐（v2 G2 mark style）
                    style={{
                      fill: (datum: any) =>
                        datum.type === 'IN'
                          ? `l(270) 0:${COLOR_IN} 1:${COLOR_IN}22`
                          : `l(270) 0:${COLOR_OUT} 1:${COLOR_OUT}22`,
                      stroke: (datum: any) => (datum.type === 'IN' ? COLOR_IN : COLOR_OUT),
                      lineWidth: 0.8,
                      strokeOpacity: 0.85,
                      radiusTopLeft: 2,
                      radiusTopRight: 2,
                      shadowColor: (datum: any) => (datum.type === 'IN' ? COLOR_IN : COLOR_OUT),
                      shadowBlur: 3,
                    }}
                    axis={{
                      x: {
                        labelFill: 'rgba(255,255,255,0.55)',
                        labelFontSize: 10,
                        labelAutoRotate: false,
                        grid: false,
                        lineStroke: 'rgba(255,255,255,0.2)',
                        tickStroke: 'rgba(255,255,255,0.3)',
                        tickLength: 3,
                      },
                      y: {
                        labelFill: 'rgba(255,255,255,0.55)',
                        labelFontSize: 10,
                        // 与刻度配套的水平虚线标线
                        grid: true,
                        gridStroke: 'rgba(255,255,255,0.22)',
                        gridStrokeOpacity: 0.8,
                        gridLineWidth: 1,
                        gridLineDash: [3, 3],
                        line: false,
                        tick: false,
                      },
                    }}
                    interaction={{ tooltip: { shared: true } }}
                    legend={false}
                  />
                </div>
              );
            })()}
          </HudPanel>

          <HudPanel variant="right">
            <HudTitle
              title={t('dashboard.businessBoard.section.liveBroadcast')}
              right={
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '2px 8px',
                    border: `1px solid ${getBoardHud().emerald}55`,
                    background: 'rgba(52, 211, 153, 0.08)',
                    color: getBoardHud().emerald,
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: 1,
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: getBoardHud().emerald,
                      boxShadow: `0 0 6px ${getBoardHud().emerald}`,
                    }}
                  />
                  {t('dashboard.businessBoard.live')}
                </span>
              }
            />
            <BroadcastFeed
              items={broadcastItems}
              emptyText={t('dashboard.businessBoard.empty')}
            />
          </HudPanel>
        </div>
      </div>

      {/* 底部信息条 */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          flexShrink: 0,
          height: 22,
          padding: '0 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderTop: `1px solid ${getBoardHud().borderLine}`,
          background: 'linear-gradient(180deg, transparent, rgba(0, 229, 255, 0.05))',
          fontSize: 10,
          color: getBoardHud().textDim,
          letterSpacing: 0.5,
          fontFamily: clockFont,
        }}
      >
        <span>
          SYS · OK · {broadcastItems.length.toString().padStart(2, '0')} BROADCAST · {processItems.length.toString().padStart(2, '0')} PROCESS
        </span>
        <span>{currentTime}</span>
      </div>
    </div>
    </BusinessBoardHudRoot>
  );
};

export default BusinessBoardPage;
