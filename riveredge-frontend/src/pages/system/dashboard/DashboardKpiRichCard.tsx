/**
 * 工作台 KPI 单元：垂直堆叠（标题 → 主数值 → 底栏副指标）
 */

import React from 'react';
import { Card, Typography, theme } from 'antd';
import { useThemeStore } from '../../../stores/themeStore';

const { Text } = Typography;
const { useToken } = theme;

export function formatDashboardMetric(n: number | undefined | null): string {
  if (n == null || Number.isNaN(Number(n))) return '0';
  return Number(n).toLocaleString();
}

export function formatDashboardRate(n: number | undefined | null): string {
  if (n == null || Number.isNaN(Number(n))) return '0';
  const v = Number(n);
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

/** 指标卡主数值语义（用于配色） */
export type DashboardKpiMainSemantic =
  | 'work_order_total'
  | 'work_order_wip'
  | 'completion_rate'
  | 'output_quantity'
  | 'inventory_alert'
  | 'quality_rate';

export function resolveDashboardKpiMainColor(
  semantic: DashboardKpiMainSemantic | undefined,
  rawNumeric: number | undefined | null,
  isDark: boolean,
  token: ReturnType<typeof theme.useToken>['token'],
  themeStyle: 'vivid' | 'plain' = 'vivid',
): string {
  if (themeStyle === 'plain') {
    return isDark ? 'var(--ant-colorText, rgba(255,255,255,0.85))' : token.colorText;
  }
  if (!semantic) {
    return isDark ? 'var(--ant-colorText)' : '#18181b';
  }
  const n = rawNumeric == null || Number.isNaN(Number(rawNumeric)) ? 0 : Number(rawNumeric);

  switch (semantic) {
    case 'work_order_total':
      return isDark ? '#93c5fd' : token.colorPrimary;
    case 'work_order_wip':
      return isDark ? '#5eead4' : '#0891b2';
    case 'completion_rate':
      if (n >= 85) return isDark ? '#86efac' : token.colorSuccess;
      if (n >= 50) return isDark ? '#fcd34d' : token.colorWarning;
      return isDark ? '#fca5a5' : token.colorError;
    case 'output_quantity':
      return isDark ? '#fdba74' : '#ea580c';
    case 'inventory_alert':
      if (n > 0) return isDark ? '#fca5a5' : token.colorError;
      return isDark ? '#86efac' : token.colorSuccess;
    case 'quality_rate':
      if (n >= 95) return isDark ? '#86efac' : '#15803d';
      if (n >= 80) return isDark ? '#bef264' : token.colorSuccess;
      if (n >= 60) return isDark ? '#fcd34d' : token.colorWarning;
      return isDark ? '#fca5a5' : token.colorError;
    default:
      return isDark ? 'var(--ant-colorText)' : '#18181b';
  }
}

type KpiRichSide = { label: string; value: React.ReactNode };

export type DashboardKpiRichCardProps = {
  /** 独立 Card 模式背景；嵌入 KPI 面板时由 CSS 控制 */
  gradient?: string;
  title: string;
  mainValue: React.ReactNode;
  mainSuffix?: string;
  subtitle: string;
  rightTop: KpiRichSide;
  rightBottom: KpiRichSide;
  onClick?: () => void;
  isDark?: boolean;
  mainSemantic?: DashboardKpiMainSemantic;
  mainNumeric?: number | null;
  /** 嵌入 KPI 面板内：无独立 Card 外框 */
  embedded?: boolean;
};

function FooterMetric({ label, value, align }: KpiRichSide & { align?: 'left' | 'right' }) {
  const { token } = theme.useToken();
  return (
    <div
      className="dashboard-kpi-cell-footer-item"
      style={{
        flex: '1 1 0',
        minWidth: 0,
        textAlign: align ?? 'left',
      }}
    >
      <div
        style={{
          fontSize: 12,
          color: token.colorTextTertiary,
          lineHeight: 1.35,
          marginBottom: 2,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 13,
          color: token.colorTextSecondary,
          fontWeight: 500,
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1.3,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {value}
      </div>
    </div>
  );
}

function KpiStackBody({
  title,
  mainValue,
  mainSuffix,
  subtitle,
  rightTop,
  rightBottom,
  isDark,
  mainSemantic,
  mainNumeric,
}: Omit<DashboardKpiRichCardProps, 'gradient' | 'onClick' | 'embedded'>) {
  const { token } = useToken();
  const themeStyle = useThemeStore((s) => s.resolved.themeStyle);
  const mainColor = resolveDashboardKpiMainColor(mainSemantic, mainNumeric, !!isDark, token, themeStyle);

  return (
    <div className="dashboard-kpi-cell-inner">
      <div className="dashboard-kpi-cell-head">
        <Text
          style={{
            fontSize: 13,
            color: token.colorTextSecondary,
            fontWeight: 500,
            lineHeight: 1.35,
            display: 'block',
            marginBottom: 6,
          }}
        >
          {title}
        </Text>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, flexWrap: 'nowrap' }}>
          <span
            style={{
              fontSize: 28,
              color: mainColor,
              fontWeight: 700,
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1.1,
              letterSpacing: '-0.02em',
            }}
          >
            {mainValue}
          </span>
          {mainSuffix ? (
            <span
              style={{
                fontSize: 14,
                color: token.colorTextTertiary,
                fontWeight: 500,
                flexShrink: 0,
              }}
            >
              {mainSuffix}
            </span>
          ) : null}
        </div>
        <Text
          ellipsis={{ tooltip: subtitle }}
          style={{
            fontSize: 12,
            color: token.colorTextQuaternary,
            marginTop: 4,
            lineHeight: 1.4,
            display: 'block',
          }}
        >
          {subtitle}
        </Text>
      </div>
      <div className="dashboard-kpi-cell-footer">
        <FooterMetric label={rightTop.label} value={rightTop.value} align="left" />
        <div className="dashboard-kpi-cell-footer-divider" aria-hidden />
        <FooterMetric label={rightBottom.label} value={rightBottom.value} align="right" />
      </div>
    </div>
  );
}

export default function DashboardKpiRichCard({
  gradient,
  title,
  mainValue,
  mainSuffix,
  subtitle,
  rightTop,
  rightBottom,
  onClick,
  isDark,
  mainSemantic,
  mainNumeric,
  embedded = false,
}: DashboardKpiRichCardProps) {
  const { token } = useToken();

  const body = (
    <KpiStackBody
      title={title}
      mainValue={mainValue}
      mainSuffix={mainSuffix}
      subtitle={subtitle}
      rightTop={rightTop}
      rightBottom={rightBottom}
      isDark={isDark}
      mainSemantic={mainSemantic}
      mainNumeric={mainNumeric}
    />
  );

  if (embedded) {
    return (
      <div
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        className="dashboard-kpi-cell"
        onClick={onClick}
        onKeyDown={
          onClick
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onClick();
                }
              }
            : undefined
        }
        title={subtitle}
        style={{
          height: '100%',
          width: '100%',
          cursor: onClick ? 'pointer' : 'default',
          boxSizing: 'border-box',
        }}
      >
        {body}
      </div>
    );
  }

  return (
    <Card
      variant="borderless"
      hoverable
      onClick={onClick}
      className="dashboard-section__card"
      style={{
        borderRadius: token.borderRadiusLG,
        background: gradient ?? token.colorBgContainer,
        width: '100%',
        height: '100%',
      }}
      styles={{
        body: {
          padding: '14px 16px',
          height: '100%',
        },
      }}
    >
      {body}
    </Card>
  );
}
