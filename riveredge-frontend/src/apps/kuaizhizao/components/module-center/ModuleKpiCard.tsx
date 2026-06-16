import React from 'react';
import { Card, Col, Progress, Row, theme } from 'antd';
import { useThemeStore } from '../../../../stores/themeStore';
import type { ModuleKpiDef } from './types';
import { MODULE_KPI_CARD_BODY_STYLE } from './constants';
import { isModuleDashboardPlain, resolveModuleKpiVisual } from './moduleDashboardTheme';

function withIconColor(icon: React.ReactNode, color: string): React.ReactNode {
  if (!React.isValidElement(icon)) return icon;
  const prevStyle = (icon.props as { style?: React.CSSProperties }).style ?? {};
  return React.cloneElement(icon, {
    style: { ...prevStyle, color },
  } as Partial<{ style: React.CSSProperties }>);
}

function KpiSideBlock({
  lines,
  sideBorder,
  sideLabelColor,
  sideValueColor,
}: {
  lines: { label: string; value: React.ReactNode }[];
  sideBorder: string;
  sideLabelColor: string;
  sideValueColor: string;
}) {
  return (
    <div
      className="module-kpi-card__side"
      style={{
        flexShrink: 0,
        paddingLeft: 16,
        marginLeft: 4,
        borderLeft: `1px solid ${sideBorder}`,
        minWidth: 76,
        maxWidth: 88,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 6,
      }}
    >
      {lines.map((line) => (
        <div key={String(line.label)}>
          <div className="module-kpi-card__side-label" style={{ fontSize: 11, color: sideLabelColor, lineHeight: 1.2 }}>
            {line.label}
          </div>
          <div
            className="module-kpi-card__side-value"
            style={{ fontSize: 15, fontWeight: 700, color: sideValueColor, lineHeight: 1.2, marginTop: 1 }}
          >
            {line.value}
          </div>
        </div>
      ))}
    </div>
  );
}

export function ModuleKpiRow({
  items,
  colProps = { xs: 24, lg: 8 },
}: {
  items: ModuleKpiDef[];
  colProps?: { xs?: number; sm?: number; md?: number; lg?: number; xl?: number };
}) {
  const { token } = theme.useToken();
  const themeStyle = useThemeStore((s) => s.resolved.themeStyle);
  const isDark = useThemeStore((s) => s.resolved.isDark);
  const plain = isModuleDashboardPlain(themeStyle);

  return (
    <Row gutter={[18, 18]} align="stretch" className={plain ? 'module-kpi-row--plain' : undefined}>
      {items.map((kpi) => {
        const visual = resolveModuleKpiVisual(kpi.gradient, kpi.boxShadow, plain, token, isDark);
        return (
          <Col {...colProps} key={kpi.key} style={{ display: 'flex' }}>
            <Card
              hoverable={!!kpi.onClick}
              onClick={kpi.onClick}
              className={['module-kpi-card', visual.plain ? 'module-kpi-card--plain' : ''].filter(Boolean).join(' ')}
              style={{
                flex: 1,
                width: '100%',
                borderRadius: token.borderRadiusLG,
                ...visual.card,
              }}
              styles={{
                body: {
                  ...MODULE_KPI_CARD_BODY_STYLE,
                  color: !visual.plain && !isDark ? '#fff' : token.colorText,
                },
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', minWidth: 0 }}>
                <div
                  className="module-kpi-card__icon-wrap"
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: token.borderRadius,
                    background: visual.iconWrapBg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    ...(visual.plain
                      ? { border: `1px solid ${token.colorPrimaryBorder}` }
                      : {}),
                  }}
                >
                  {withIconColor(kpi.icon, visual.iconColor)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    className="module-kpi-card__title"
                    style={{
                      fontSize: 14,
                      fontWeight: 500,
                      color: visual.titleColor,
                      lineHeight: 1.25,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {kpi.title}
                  </div>
                  <div
                    className="module-kpi-card__value"
                    style={{
                      fontSize: 30,
                      fontWeight: 700,
                      color: visual.valueColor,
                      lineHeight: 1.15,
                      marginTop: 4,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {kpi.value}
                  </div>
                  {kpi.subtitle ? (
                    <div
                      className="module-kpi-card__subtitle"
                      style={{
                        fontSize: 12,
                        color: visual.subtitleColor,
                        marginTop: 4,
                        lineHeight: 1.25,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {kpi.subtitle}
                    </div>
                  ) : null}
                  {typeof kpi.progress === 'number' ? (
                    <div style={{ marginTop: 6 }}>
                      <Progress
                        percent={kpi.progress}
                        showInfo={false}
                        strokeColor={visual.progressStroke}
                        railColor={visual.progressRail}
                        size={[-1, 6]}
                      />
                    </div>
                  ) : null}
                </div>
                {kpi.sideMetrics?.length ? (
                  <KpiSideBlock
                    lines={kpi.sideMetrics}
                    sideBorder={visual.sideBorder}
                    sideLabelColor={visual.sideLabelColor}
                    sideValueColor={visual.sideValueColor}
                  />
                ) : null}
              </div>
            </Card>
          </Col>
        );
      })}
    </Row>
  );
}

export default ModuleKpiRow;
