import React from 'react';
import { Card, Col, Row, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import type { ModuleShortcutDef } from './types';

const { Text } = Typography;

export function ModuleShortcutGrid({
  items,
  colProps = { xs: 12, sm: 12, md: 6 },
}: {
  items: ModuleShortcutDef[];
  colProps?: { xs?: number; sm?: number; md?: number; lg?: number };
}) {
  const navigate = useNavigate();

  return (
    <Row gutter={[16, 16]}>
      {items.map((sc) => (
        <Col {...colProps} key={sc.key}>
          <Card
            hoverable
            onClick={() => navigate(sc.path)}
            styles={{ body: { padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 } }}
            style={{ borderRadius: 10 }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: 'rgba(0,0,0,0.04)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {sc.icon}
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
