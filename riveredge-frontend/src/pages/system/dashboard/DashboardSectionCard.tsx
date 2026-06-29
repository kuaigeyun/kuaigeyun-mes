/**
 * 工作台区块：标题栏在卡片外（左标题 + 右操作），下方为白底内容卡
 */

import React from 'react';
import { Card } from 'antd';
import { DASHBOARD_SECTION_CARD_CLASS } from './dashboardCardSurface';

export interface DashboardSectionCardProps {
  title: React.ReactNode;
  extra?: React.ReactNode;
  children: React.ReactNode;
  loading?: boolean;
  /** 整块高度（含外置标题行）；不传则随内容高度 */
  height?: number | string;
  cardRadius?: number | string;
  className?: string;
  cardClassName?: string;
  styles?: {
    body?: React.CSSProperties;
  };
}

export function DashboardSectionCard({
  title,
  extra,
  children,
  loading,
  height,
  cardRadius,
  className,
  cardClassName,
  styles,
}: DashboardSectionCardProps) {
  const bounded = height != null;

  return (
    <div
      className={[
        'dashboard-section',
        bounded ? 'dashboard-section--bounded' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      style={
        bounded
          ? {
              height,
              minHeight: height,
              maxHeight: height,
            }
          : undefined
      }
    >
      <div className="dashboard-section__head">
        <div className="dashboard-section__title">{title}</div>
        {extra ? <div className="dashboard-section__extra">{extra}</div> : null}
      </div>
      <Card
        loading={loading}
        variant="borderless"
        className={[DASHBOARD_SECTION_CARD_CLASS, cardClassName].filter(Boolean).join(' ')}
        style={{
          borderRadius: cardRadius,
        }}
        styles={{
          body: styles?.body,
        }}
      >
        {children}
      </Card>
    </div>
  );
}

export default DashboardSectionCard;
