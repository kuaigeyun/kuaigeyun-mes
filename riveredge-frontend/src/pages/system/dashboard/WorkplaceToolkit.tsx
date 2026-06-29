/**
 * 工业工具组 — 欢迎条胶囊入口 + 下拉托盘
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Popover, Space, theme } from 'antd';
import * as LucideIcons from 'lucide-react';
import { useTranslation } from 'react-i18next';
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
import { getDashboardTopBarTheme } from './dashboardTopBarTheme';

export interface WorkplaceToolkitProps {
  cardRadius?: string | number;
  backgroundTint?: string;
  isDark?: boolean;
}

type ToolItem = {
  key: string;
  icon: React.ReactNode;
  label: string;
  color: string;
  render: React.ReactNode;
};

const TrayToolButton: React.FC<{
  icon: React.ReactNode;
  label: string;
  color: string;
  render?: React.ReactNode;
  onClick?: () => void;
  popoverKey: string;
  popoverOpen: boolean;
  onPopoverOpenChange: (open: boolean) => void;
  getPopupContainer: (triggerNode: HTMLElement) => HTMLElement;
  theme: ReturnType<typeof getDashboardTopBarTheme>;
}> = ({
  icon,
  label,
  color,
  render,
  onClick,
  popoverKey,
  popoverOpen,
  onPopoverOpenChange,
  getPopupContainer,
  theme: barTheme,
}) => {
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
        background: hover ? barTheme.itemHoverBg : 'transparent',
        border: hover ? 'var(--dashboard-card-border)' : '1px solid transparent',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        transform: hover ? 'translateY(-1px)' : 'translateY(0)',
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 8,
          background: `${color}15`,
          color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: hover ? `0 0 12px ${color}30` : 'none',
        }}
      >
        {icon}
      </div>
      <span
        style={{
          fontSize: 11,
          color: hover ? barTheme.textColor : barTheme.textSecondaryColor,
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
  cardRadius,
  isDark = false,
}) => {
  const { t } = useTranslation();
  const [showTray, setShowTray] = useState(false);
  const currentTheme = getDashboardTopBarTheme(isDark);
  const [activeToolPopoverKey, setActiveToolPopoverKey] = useState<string | null>(null);
  const toolkitRootRef = useRef<HTMLDivElement | null>(null);
  const trayPopoverMountRef = useRef<HTMLDivElement | null>(null);

  const { token } = theme.useToken();
  const trayRadius = cardRadius || token.borderRadiusLG;

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

  const allTools: ToolItem[] = [
    {
      key: 'tax',
      icon: <LucideIcons.Calculator size={18} strokeWidth={2.2} />,
      label: t('pages.dashboard.toolkit.taxConversion'),
      color: '#64748b',
      render: <TaxCalculator />,
    },
    {
      key: 'weight',
      icon: <LucideIcons.Scale size={18} strokeWidth={2.2} />,
      label: t('pages.dashboard.toolkit.weightCalc'),
      color: '#5f8570',
      render: <WeightCalculator />,
    },
    {
      key: 'exchange',
      icon: <LucideIcons.Globe size={18} strokeWidth={2.2} />,
      label: t('pages.dashboard.toolkit.exchangeRate'),
      color: '#a67c52',
      render: <ExchangeCalculator />,
    },
    {
      key: 'rmb',
      icon: <LucideIcons.Coins size={18} />,
      label: t('pages.dashboard.toolkit.amountToUppercase'),
      color: '#f59e0b',
      render: <RmbCapitalizer />,
    },
    {
      key: 'text',
      icon: <LucideIcons.CaseUpper size={18} />,
      label: t('pages.dashboard.toolkit.textCleanup'),
      color: '#10b981',
      render: <TextTransformer />,
    },
    {
      key: 'unit',
      icon: <LucideIcons.RefreshCw size={18} />,
      label: t('pages.dashboard.toolkit.unitConversion'),
      color: '#8b5cf6',
      render: <UnitConverter />,
    },
    {
      key: 'pwd',
      icon: <LucideIcons.Key size={18} />,
      label: t('pages.dashboard.toolkit.passwordGen'),
      color: '#ec4899',
      render: <PasswordGen />,
    },
    {
      key: 'memo',
      icon: <LucideIcons.PenTool size={18} />,
      label: t('pages.dashboard.toolkit.notes'),
      color: '#f97316',
      render: <MemoTool />,
    },
    {
      key: 'qr',
      icon: <LucideIcons.QrCode size={18} />,
      label: t('pages.dashboard.toolkit.qrcode'),
      color: '#22d3ee',
      render: <QrGenerator />,
    },
  ];

  const toggleTray = () => {
    setShowTray((prev) => {
      const next = !prev;
      if (!next) setActiveToolPopoverKey(null);
      return next;
    });
  };

  useEffect(() => {
    if (!showTray) return;
    const handleOutsidePointerDown = (event: MouseEvent) => {
      const root = toolkitRootRef.current;
      const target = event.target as Node | null;
      if (!root || !target) return;
      if (root.contains(target)) return;
      setShowTray(false);
      setActiveToolPopoverKey(null);
    };
    document.addEventListener('mousedown', handleOutsidePointerDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsidePointerDown);
    };
  }, [showTray]);

  return (
    <div ref={toolkitRootRef} className="dashboard-welcome-toolkit">
      <Space
        className="dashboard-welcome-onboarding"
        size={4}
        onClick={toggleTray}
        aria-label={t('pages.dashboard.toolkit.quickTools')}
        aria-expanded={showTray}
      >
        <span
          className="dashboard-welcome-toolkit__icon"
          aria-hidden="true"
        >
          {showTray ? <CloseOutlined /> : <AppstoreOutlined />}
        </span>
        <span className="dashboard-welcome-onboarding__label">
          {t('pages.dashboard.toolkit.quickTools')}
        </span>
      </Space>

      <div
        ref={trayPopoverMountRef}
        className="dashboard-welcome-toolkit__tray"
        data-open={showTray ? 'true' : 'false'}
        style={{ borderRadius: trayRadius }}
      >
        <div className="dashboard-welcome-toolkit__grid">
          {allTools.map((tool) => {
            const popKey = `tray:${tool.key}`;
            return (
              <TrayToolButton
                key={tool.key}
                getPopupContainer={getTrayPopupContainer}
                popoverKey={popKey}
                popoverOpen={activeToolPopoverKey === popKey}
                onPopoverOpenChange={(open) => handleToolPopoverOpenChange(popKey, open)}
                icon={tool.icon}
                label={tool.label}
                color={tool.color}
                render={tool.render}
                theme={currentTheme}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default WorkplaceToolkit;
