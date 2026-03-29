import React from 'react';
import { RiseOutlined, FallOutlined, MinusOutlined } from '@ant-design/icons';
import type { TFunction } from 'i18next';
import { accent } from '../chartTheme';
import type { KpiItem } from '../mockData';
import { useAnimatedKpiValue } from '../hooks/useAnimatedKpiValue';

const accentMap: Record<KpiItem['accent'], string> = {
  cyan: accent.cyan,
  emerald: accent.emerald,
  amber: accent.amber,
  violet: accent.violet,
  rose: accent.rose,
  slate: accent.slate,
};

export const KpiCard: React.FC<{
  item: KpiItem;
  t: TFunction;
  compact?: boolean;
  orbital?: boolean;
}> = ({ item, t, compact, orbital }) => {
  const animatedOrbitalValue = useAnimatedKpiValue(item.value, 700);
  const color = accentMap[item.accent];
  const trendLabel =
    item.trend === 'up'
      ? t('dashboard.businessBoard.kpi.trendUp')
      : item.trend === 'down'
        ? t('dashboard.businessBoard.kpi.trendDown')
        : t('dashboard.businessBoard.kpi.trendFlat');
  const trendColor =
    item.trend === 'up' ? accent.emerald : item.trend === 'down' ? accent.rose : accent.slate;

  const planetRadius = orbital ? 18 : compact ? 10 : 14;
  const planetPad = orbital ? '9px 10px' : compact ? '8px 10px' : '18px 20px';

  if (orbital) {
    const line3 = item.sub?.trim() ? item.sub : trendLabel;
    return (
      <div
        className="kpi-planet-card"
        style={{
          background: `radial-gradient(120% 100% at 30% 20%, ${color}18 0%, rgba(15, 23, 42, 0.82) 45%, rgba(15, 23, 42, 0.88) 100%)`,
          backdropFilter: 'blur(14px) saturate(1.06)',
          border: `1px solid ${color}38`,
          borderTop: `1px solid ${color}55`,
          borderRadius: planetRadius,
          padding: planetPad,
          color: '#f8fafc',
          minHeight: 104,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: 5,
          boxSizing: 'border-box',
          boxShadow:
            '0 0 0 1px rgba(255,255,255,0.03), 0 4px 18px rgba(0,0,0,0.36), inset 0 1px 0 rgba(255,255,255,0.06)',
          transition: 'transform 0.22s ease, border-color 0.22s ease',
        }}
      >
        <div
          style={{
            color: '#cbd5e1',
            fontSize: 10,
            letterSpacing: 0.35,
            lineHeight: 1.25,
            minHeight: 14,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: `radial-gradient(circle at 30% 30%, #fff 0%, ${color} 55%, transparent 70%)`,
              flexShrink: 0,
            }}
          />
          <span style={{ minWidth: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {t(item.titleKey)}
          </span>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: 6,
            minHeight: 22,
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontSize: 16,
              fontWeight: 700,
              color,
              lineHeight: 1.15,
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {animatedOrbitalValue}
          </span>
          <span
            style={{
              fontSize: 10,
              color: trendColor,
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              flexShrink: 0,
            }}
          >
            {item.trend === 'up' && <RiseOutlined style={{ fontSize: 10 }} />}
            {item.trend === 'down' && <FallOutlined style={{ fontSize: 10 }} />}
            {item.trend === 'flat' && <MinusOutlined style={{ fontSize: 10 }} />}
            {item.trendValue}
          </span>
        </div>
        <div
          title={line3}
          style={{
            fontSize: 9,
            color: '#64748b',
            lineHeight: 1.25,
            minHeight: 26,
            flexShrink: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          {line3}
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        background: 'linear-gradient(145deg, rgba(30, 41, 59, 0.55) 0%, rgba(15, 23, 42, 0.85) 100%)',
        backdropFilter: 'blur(14px)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderTop: `1px solid ${color}55`,
        borderRadius: planetRadius,
        padding: planetPad,
        color: '#f8fafc',
        minHeight: compact ? 0 : 112,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      <div
        style={{
          color: '#94a3b8',
          fontSize: compact ? 10 : 12,
          letterSpacing: 0.3,
          lineHeight: 1.25,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        {t(item.titleKey)}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 6, marginTop: compact ? 4 : 0 }}>
        <span
          style={{
            fontSize: compact ? 16 : 28,
            fontWeight: 700,
            color,
            lineHeight: 1.1,
          }}
        >
          {item.value}
        </span>
        <span
          style={{
            fontSize: compact ? 10 : 12,
            color: trendColor,
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            flexShrink: 0,
          }}
        >
          {item.trend === 'up' && <RiseOutlined style={{ fontSize: compact ? 10 : 12 }} />}
          {item.trend === 'down' && <FallOutlined style={{ fontSize: compact ? 10 : 12 }} />}
          {item.trend === 'flat' && <MinusOutlined style={{ fontSize: compact ? 10 : 12 }} />}
          {item.trendValue}
        </span>
      </div>
      {item.sub && (
        <div
          style={{
            fontSize: compact ? 9 : 11,
            color: '#64748b',
            marginTop: compact ? 2 : 4,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {item.sub}
        </div>
      )}
      {!compact && <div style={{ fontSize: 10, color: '#475569', marginTop: 6 }}>{trendLabel}</div>}
    </div>
  );
};
