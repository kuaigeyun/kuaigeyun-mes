import React, { cloneElement, isValidElement } from 'react';
import { Col, Grid, Row, Typography, theme } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useThemeStore } from '../../../../stores/themeStore';
import type { ModuleShortcutDef } from './types';
import { isModuleDashboardPlain } from './moduleDashboardTheme';

const { Text } = Typography;

function plainShortcutIcon(icon: React.ReactNode, colorPrimary: string): React.ReactNode {
  if (!isValidElement(icon)) return icon;
  const prev = (icon.props as { style?: React.CSSProperties }).style;
  return cloneElement(icon, {
    style: { ...prev, color: colorPrimary },
  } as { style?: React.CSSProperties });
}

function normalizeShortcutIcon(icon: React.ReactNode, plain: boolean, colorPrimary: string): React.ReactNode {
  const node = plain ? plainShortcutIcon(icon, colorPrimary) : icon;
  if (!isValidElement(node)) return node;
  const prev = (node.props as { style?: React.CSSProperties }).style;
  return cloneElement(node, {
    style: { ...prev, fontSize: 20, lineHeight: 1 },
  } as { style?: React.CSSProperties });
}

export function ModuleShortcutGrid({
  items,
  colProps = { xs: 12, sm: 12, md: 6 },
  fillByItemCount = false,
}: {
  items: ModuleShortcutDef[];
  colProps?: { xs?: number; sm?: number; md?: number; lg?: number };
  /** 大屏按条目数等分整行宽度（例如 5 项=每项 20%） */
  fillByItemCount?: boolean;
}) {
  const navigate = useNavigate();
  const { token } = theme.useToken();
  const screens = Grid.useBreakpoint();
  const themeStyle = useThemeStore((s) => s.resolved.themeStyle);
  const plain = isModuleDashboardPlain(themeStyle);
  const equalFillOnDesktop = fillByItemCount && !!screens.lg && items.length > 0;

  return (
    <div
      className={plain ? 'module-shortcut-grid module-shortcut-grid--plain' : 'module-shortcut-grid'}
      style={{
        borderRadius: token.borderRadiusLG,
        background: token.colorBgContainer,
        border: `1px solid ${token.colorBorderSecondary}`,
        boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.03)',
        padding: 8,
      }}
    >
      <Row gutter={[8, 8]}>
        {items.map((sc) => (
          <Col
            {...colProps}
            key={sc.key}
            flex={equalFillOnDesktop ? `0 0 ${100 / items.length}%` : undefined}
            style={
              equalFillOnDesktop
                ? {
                    maxWidth: `${100 / items.length}%`,
                    minWidth: 0,
                  }
                : undefined
            }
          >
            <div
              role="button"
              tabIndex={0}
              className="module-shortcut-grid__item"
              onClick={() => navigate(sc.path)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  navigate(sc.path);
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                minHeight: 44,
                padding: '10px 12px',
                borderRadius: token.borderRadius,
                cursor: 'pointer',
                userSelect: 'none',
                transition: 'background 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = token.colorFillAlter;
                e.currentTarget.style.boxShadow = 'none';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <span
                className="module-shortcut-grid__icon"
                style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}
              >
                {normalizeShortcutIcon(sc.icon, plain, token.colorPrimary)}
              </span>
              <Text
                ellipsis
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: token.colorText,
                  lineHeight: 1.35,
                  minWidth: 0,
                }}
              >
                {sc.title}
              </Text>
            </div>
          </Col>
        ))}
      </Row>
    </div>
  );
}

export default ModuleShortcutGrid;
