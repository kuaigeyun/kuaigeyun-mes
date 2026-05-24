import React from 'react';
import { Card, Col, Progress, Row } from 'antd';
import type { ModuleKpiDef } from './types';
import { MODULE_KPI_CARD_BODY_STYLE } from './constants';

function KpiSideBlock({ lines }: { lines: { label: string; value: React.ReactNode }[] }) {
  return (
    <div
      style={{
        flexShrink: 0,
        paddingLeft: 18,
        marginLeft: 8,
        borderLeft: '1px solid rgba(255, 255, 255, 0.28)',
        minWidth: 82,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 8,
      }}
    >
      {lines.map((line) => (
        <div key={String(line.label)}>
          <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.72)', lineHeight: 1.25 }}>
            {line.label}
          </div>
          <div style={{ fontSize: 17, fontWeight: 700, color: '#fff', lineHeight: 1.25, marginTop: 2 }}>
            {line.value}
          </div>
        </div>
      ))}
    </div>
  );
}

export function ModuleKpiRow({ items }: { items: ModuleKpiDef[] }) {
  return (
    <Row gutter={[18, 18]} align="stretch">
      {items.map((kpi) => (
        <Col xs={24} lg={8} key={kpi.key} style={{ display: 'flex' }}>
          <Card
            hoverable={!!kpi.onClick}
            onClick={kpi.onClick}
            style={{
              flex: 1,
              width: '100%',
              borderRadius: 12,
              border: 'none',
              background: kpi.gradient,
              boxShadow: kpi.boxShadow ?? '0 4px 12px rgba(0, 0, 0, 0.08)',
            }}
            styles={{ body: { ...MODULE_KPI_CARD_BODY_STYLE } }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 18, width: '100%' }}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  background: 'rgba(255, 255, 255, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {kpi.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255, 255, 255, 0.9)' }}>
                  {kpi.title}
                </div>
                <div style={{ fontSize: 30, fontWeight: 700, color: '#fff', lineHeight: 1.2, marginTop: 6 }}>
                  {kpi.value}
                </div>
                {kpi.subtitle ? (
                  <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.72)', marginTop: 8 }}>
                    {kpi.subtitle}
                  </div>
                ) : null}
                {typeof kpi.progress === 'number' ? (
                  <div style={{ marginTop: 8 }}>
                    <Progress
                      percent={kpi.progress}
                      showInfo={false}
                      strokeColor="#fff"
                      railColor="rgba(255, 255, 255, 0.2)"
                      strokeWidth={6}
                    />
                  </div>
                ) : null}
              </div>
              {kpi.sideMetrics?.length ? <KpiSideBlock lines={kpi.sideMetrics} /> : null}
            </div>
          </Card>
        </Col>
      ))}
    </Row>
  );
}

export default ModuleKpiRow;
