import React, { cloneElement, isValidElement } from 'react';
import { Card, Col, Row, Typography, theme } from 'antd';
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
}: {
  items: ModuleShortcutDef[];
  colProps?: { xs?: number; sm?: number; md?: number; lg?: number };
}) {
  const navigate = useNavigate();
  const { token } = theme.useToken();
  const themeStyle = useThemeStore((s) => s.resolved.themeStyle);
  const plain = isModuleDashboardPlain(themeStyle);

  return (
    <Row gutter={[16, 16]} className={plain ? 'module-shortcut-grid--plain' : undefined}>
      {items.map((sc) => (
        <Col {...colProps} key={sc.key}>
          <Card
            hoverable
            onClick={() => navigate(sc.path)}
            styles={{ body: { padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 } }}
            style={{ borderRadius: 10 }}
          >
            <div
              className="module-shortcut-grid__icon-wrap"
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
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
  );
}

export default ModuleShortcutGrid;
