import React, { cloneElement, isValidElement } from 'react';
import { Card, Col, Grid, Row, Typography, theme } from 'antd';
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
  const { useBreakpoint } = Grid;
  const screens = useBreakpoint();
  const themeStyle = useThemeStore((s) => s.resolved.themeStyle);
  const plain = isModuleDashboardPlain(themeStyle);
  const equalFillOnDesktop = fillByItemCount && !!screens.lg && items.length > 0;

  return (
    <div
      className="module-shortcut-grid__container"
      style={{
        background: token.colorBgContainer,
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: token.borderRadiusLG,
        padding: 12,
      }}
    >
      <Row gutter={[16, 16]} className={plain ? 'module-shortcut-grid--plain' : undefined}>
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
            <Card
              hoverable
              onClick={() => navigate(sc.path)}
              styles={{ body: { padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 } }}
              style={{
                borderRadius: token.borderRadiusLG,
                background: token.colorFillQuaternary,
              }}
            >
              <div
                className="module-shortcut-grid__icon-wrap"
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: token.borderRadius,
                  background: plain ? token.colorPrimaryBg : 'rgba(0,0,0,0.04)',
                  border: plain ? `1px solid ${token.colorPrimaryBorder}` : undefined,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {plain ? plainShortcutIcon(sc.icon, token.colorPrimary) : sc.icon}
              </div>
              <Text strong style={{ fontSize: 14 }}>
                {sc.title}
              </Text>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
}

export default ModuleShortcutGrid;
