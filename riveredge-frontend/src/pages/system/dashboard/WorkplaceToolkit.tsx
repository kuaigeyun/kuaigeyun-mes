/**
 * 工业工具组 (Common Tool Grid) - 高频实战版
 * 
 * 布局：卡片整体向下弹出抽屉托盘
 * 功能：集成人民币大写、文本整理等生产日常实战工具
 */

import React, { useCallback, useRef, useState } from 'react';
import { Card, Popover, theme } from 'antd';
import * as LucideIcons from 'lucide-react';
import {
  TaxCalculator,
  WeightCalculator,
  ExchangeCalculator,
  UnitConverter,
  MemoTool,
  RmbCapitalizer,
  TextTransformer,
  PasswordGen,
  QrGenerator,
} from './ToolkitComponents';
import { AppstoreOutlined, CloseOutlined } from '@ant-design/icons';
import {
  getDashboardTopBarCardBorder,
  getDashboardTopBarCardShadow,
  getDashboardTopBarTheme,
} from './dashboardTopBarTheme';

interface WorkplaceToolkitProps {
  cardHeight: string | number;
  cardRadius: string | number;
  backgroundTint?: string;
  isDark?: boolean;
}

/**
 * 仿真托盘内部的工具按钮
 */
const TrayToolButton: React.FC<{
  icon: React.ReactNode;
  label: string;
  color: string;
  render?: React.ReactNode;
  onClick?: () => void;
  popoverKey: string;
  popoverOpen: boolean;
  onPopoverOpenChange: (open: boolean) => void;
  /** 挂到抽屉容器内，避免与 body 上多个 portal 叠层时受控 open 不同步导致旧浮层残留 */
  getPopupContainer: (triggerNode: HTMLElement) => HTMLElement;
  theme: ReturnType<typeof getDashboardTopBarTheme>;
}> = ({ icon, label, color, render, onClick, popoverKey, popoverOpen, onPopoverOpenChange, getPopupContainer, theme }) => {
  const [hover, setHover] = useState(false);
  
  const content = (
    <div 
      onClick={(e) => {
        if (onClick) {
          e.stopPropagation();
          onClick();
        }
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        width: '100%',
        height: 72,
        borderRadius: 12,
        cursor: 'pointer',
        background: hover ? theme.itemHoverBg : 'transparent',
        border: hover ? theme.itemBorder : '1px solid transparent',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        transform: hover ? 'translateY(-1px)' : 'translateY(0)',
      }}
    >
      <div style={{ 
        width: 28, 
        height: 28, 
        borderRadius: 8, 
        background: `${color}15`, 
        color: color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: hover ? `0 0 12px ${color}30` : 'none',
      }}>
        {icon}
      </div>
      <span
        style={{
          fontSize: 11,
          color: hover ? theme.textColor : theme.textSecondaryColor,
          fontWeight: 500,
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>
    </div>
  );

  if (render) {
    return (
      <Popover
        key={popoverKey}
        open={popoverOpen}
        onOpenChange={onPopoverOpenChange}
        content={render}
        trigger="click"
        placement="top"
        getPopupContainer={getPopupContainer}
        destroyOnHidden
        styles={{ root: { display: 'block', maxWidth: '100%', overflow: 'visible' } }}
      >
        {content}
      </Popover>
    );
  }

  return content;
};

export const WorkplaceToolkit: React.FC<WorkplaceToolkitProps> = ({
  cardHeight,
  cardRadius,
  backgroundTint,
  isDark = false,
}) => {
  const [showTray, setShowTray] = useState(false);
  const currentTheme = getDashboardTopBarTheme(isDark);
  /** 本卡片内同时只保留一个工具 Popover（主区 + 托盘共用） */
  const [activeToolPopoverKey, setActiveToolPopoverKey] = useState<string | null>(null);
  const trayPopoverMountRef = useRef<HTMLDivElement | null>(null);

  const { token } = theme.useToken();
  const getTrayPopupContainer = useCallback(
    (triggerNode: HTMLElement) => trayPopoverMountRef.current ?? triggerNode.ownerDocument.body,
    [],
  );

  const handleToolPopoverOpenChange = (key: string, open: boolean) => {
    setActiveToolPopoverKey((prev) => {
      if (open) return key;
      return prev === key ? null : prev;
    });
  };

  // 基础工具 (前3个)
  const baseTools = [
    {
      key: 'tax',
      icon: <LucideIcons.Calculator size={20} strokeWidth={2.2} />,
      label: '价税换算',
      desc: '13% 增值税',
      color: '#64748b',
      render: <TaxCalculator />
    },
    {
      key: 'weight',
      icon: <LucideIcons.Scale size={20} strokeWidth={2.2} />,
      label: '重量计算',
      desc: '板材 / 管材',
      color: '#5f8570',
      render: <WeightCalculator />
    },
    {
      key: 'exchange',
      icon: <LucideIcons.Globe size={20} strokeWidth={2.2} />,
      label: '汇率换算',
      desc: 'USD/EUR 参考',
      color: '#a67c52',
      render: <ExchangeCalculator />
    }
  ];

  return (
    <div style={{ position: 'relative', flex: 1, width: '100%', height: cardHeight }}>
      <Card
        variant="borderless"
        style={{
          width: '100%',
          minHeight: cardHeight,
          height: cardHeight,
          maxHeight: cardHeight,
          borderRadius: cardRadius,
          background: backgroundTint 
            ? `${backgroundTint}, ${currentTheme.toolkitCardBackground}` 
            : currentTheme.toolkitCardBackground,
          border: getDashboardTopBarCardBorder(isDark),
          borderBottom: '0 solid transparent',
          borderBottomLeftRadius: showTray ? 0 : cardRadius,
          borderBottomRightRadius: showTray ? 0 : cardRadius,
          boxShadow: getDashboardTopBarCardShadow(isDark),
          zIndex: 11,
          position: 'relative',
        }}
        styles={{
          body: {
            padding: '8px 10px',
            height: '100%',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gridTemplateRows: '1fr 1fr',
            gap: '10px 10px',
          }
        }}
      >
        {baseTools.map((tool) => {
          const popKey = `base:${tool.key}`;
          return (
          <Popover
            key={tool.key}
            open={activeToolPopoverKey === popKey}
            onOpenChange={(open) => handleToolPopoverOpenChange(popKey, open)}
            content={tool.render}
            trigger="click"
            placement="bottom"
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '6px 10px',
                borderRadius: 8,
                background: currentTheme.itemHoverBg,
                border: currentTheme.itemBorder,
                cursor: 'pointer',
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                overflow: 'hidden',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = currentTheme.itemActiveBg;
                e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(24,24,27,0.12)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = currentTheme.itemHoverBg;
                e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(24,24,27,0.08)';
              }}
            >
              <div 
                style={{ 
                  width: 32, 
                  height: 32, 
                  borderRadius: 8, 
                  background: `${tool.color}25`, 
                  color: tool.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  boxShadow: `0 2px 8px ${tool.color}15`,
                }}
              >
                {tool.icon}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: currentTheme.textColor, lineHeight: 1.2 }}>{tool.label}</div>
                <div
                  style={{
                    fontSize: 10,
                    color: currentTheme.textSecondaryColor,
                    marginTop: 2,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {tool.desc}
                </div>
              </div>
            </div>
          </Popover>
          );
        })}

        {/* 扩展托盘开关 */}
        <div
          onClick={() => {
            const next = !showTray;
            setShowTray(next);
            if (!next) setActiveToolPopoverKey(null);
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '6px 10px',
            borderRadius: 8,
            background: showTray ? currentTheme.itemActiveBg : currentTheme.itemHoverBg,
            border: showTray ? (isDark ? '1px solid rgba(255,255,255,0.2)' : '1px solid rgba(24,24,27,0.16)') : (isDark ? '1px dashed rgba(255,255,255,0.15)' : '1px dashed rgba(24,24,27,0.14)'),
            cursor: 'pointer',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
          onMouseEnter={(e) => {
            if (!showTray) {
              e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.25)' : 'rgba(24,24,27,0.22)';
              e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(24,24,27,0.07)';
            }
          }}
          onMouseLeave={(e) => {
            if (!showTray) {
              e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(24,24,27,0.14)';
              e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(24,24,27,0.04)';
            }
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(24,24,27,0.06)',
              color: isDark ? 'rgba(255,255,255,0.65)' : 'rgba(24,24,27,0.65)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
              transform: showTray ? 'rotate(90deg)' : 'none',
            }}
          >
            {showTray ? <CloseOutlined style={{ fontSize: 16 }} /> : <AppstoreOutlined style={{ fontSize: 17 }} />}
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, color: currentTheme.textColor, opacity: 0.85 }}>
            {showTray ? '收起托盘' : '扩展托盘'}
          </div>
        </div>
      </Card>

      {/* 仿真弹出抽屉 (实战工具集成)；托盘 Popover 挂到此节点下，避免挂 body 时旧层不卸 */}
      <div
        ref={trayPopoverMountRef}
        style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          background: backgroundTint 
            ? `${backgroundTint}, ${isDark ? 'rgba(24, 24, 27, 0.7)' : 'rgba(255, 255, 255, 0.75)'}` 
            : (isDark ? 'rgba(24, 24, 27, 0.7)' : 'rgba(255, 255, 255, 0.75)'),
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderRadius: `0 0 ${cardRadius || token.borderRadiusLG}px ${cardRadius || token.borderRadiusLG}px`,
          boxShadow: showTray ? (isDark ? '0 20px 40px -12px rgba(0, 0, 0, 0.4)' : '0 12px 24px -10px rgba(24, 24, 27, 0.1)') : 'none',
          padding: showTray ? '16px 14px 14px 14px' : '0',
          border: showTray ? getDashboardTopBarCardBorder(isDark) : '0 solid transparent',
          borderTop: 'none',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          zIndex: 12, // 保持恒定层级，仅靠透明度和位移控制，防止层级突变导致动画失效
          opacity: showTray ? 1 : 0,
          transform: showTray ? 'translateY(0)' : 'translateY(-24px)', // 增大位移，使动效更明显
          transition: 'opacity 0.4s ease, transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
          marginTop: -1,
          pointerEvents: showTray ? 'auto' : 'none',
          overflow: 'visible',
          backfaceVisibility: 'hidden', // 提示浏览器开启 GPU 加速
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: 10,
            maxHeight: 320,
            overflowY: 'auto',
            overflowX: 'hidden',
            /* 为首行 translateY + icon 外发光留出滚动区内边距，避免被 overflow 裁平 */
            paddingTop: 10,
            paddingBottom: 8,
            paddingLeft: 4,
            paddingRight: 6,
          }}
        >
          <TrayToolButton
            getPopupContainer={getTrayPopupContainer}
            popoverKey="tray:rmb"
            popoverOpen={activeToolPopoverKey === 'tray:rmb'}
            onPopoverOpenChange={(open) => handleToolPopoverOpenChange('tray:rmb', open)}
            icon={<LucideIcons.Coins size={18} />}
            label="金额大写"
            color="#f59e0b"
            render={<RmbCapitalizer />}
            theme={currentTheme}
          />
          <TrayToolButton
            getPopupContainer={getTrayPopupContainer}
            popoverKey="tray:text"
            popoverOpen={activeToolPopoverKey === 'tray:text'}
            onPopoverOpenChange={(open) => handleToolPopoverOpenChange('tray:text', open)}
            icon={<LucideIcons.CaseUpper size={18} />}
            label="文本整理"
            color="#10b981"
            render={<TextTransformer />}
            theme={currentTheme}
          />
          <TrayToolButton
            getPopupContainer={getTrayPopupContainer}
            popoverKey="tray:unit"
            popoverOpen={activeToolPopoverKey === 'tray:unit'}
            onPopoverOpenChange={(open) => handleToolPopoverOpenChange('tray:unit', open)}
            icon={<LucideIcons.RefreshCw size={18} />}
            label="单位换算"
            color="#8b5cf6"
            render={<UnitConverter />}
            theme={currentTheme}
          />
          <TrayToolButton
            getPopupContainer={getTrayPopupContainer}
            popoverKey="tray:pwd"
            popoverOpen={activeToolPopoverKey === 'tray:pwd'}
            onPopoverOpenChange={(open) => handleToolPopoverOpenChange('tray:pwd', open)}
            icon={<LucideIcons.Key size={18} />}
            label="密码生成"
            color="#ec4899"
            render={<PasswordGen />}
            theme={currentTheme}
          />
          <TrayToolButton
            getPopupContainer={getTrayPopupContainer}
            popoverKey="tray:memo"
            popoverOpen={activeToolPopoverKey === 'tray:memo'}
            onPopoverOpenChange={(open) => handleToolPopoverOpenChange('tray:memo', open)}
            icon={<LucideIcons.PenTool size={18} />}
            label="随手便签"
            color="#f97316"
            render={<MemoTool />}
            theme={currentTheme}
          />
          <TrayToolButton
            getPopupContainer={getTrayPopupContainer}
            popoverKey="tray:qr"
            popoverOpen={activeToolPopoverKey === 'tray:qr'}
            onPopoverOpenChange={(open) => handleToolPopoverOpenChange('tray:qr', open)}
            icon={<LucideIcons.QrCode size={18} />}
            label="二维码"
            color="#22d3ee"
            render={<QrGenerator />}
            theme={currentTheme}
          />
        </div>
      </div>
    </div>
  );
};

export default WorkplaceToolkit;
