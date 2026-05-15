/**
 * 巡查统计报表 — 多图表类型（面积 / 雷达 / 条形 / 饼 / 折线 / 词云），避免整页 Column。
 */

import React from 'react';
import { Empty, Typography } from 'antd';
import { Area, Bar, Line, Pie, Radar, WordCloud } from '@ant-design/charts';
import type { PatrolReportDef } from './reportRegistry';
import type { PatrolReportPayload } from '../../../services/haoligo';

const { Text } = Typography;

const PALETTE = ['#1677ff', '#52c41a', '#faad14', '#ff7875', '#9254de', '#13c2c2', '#2f54eb', '#eb2f96'];
const AREA_PRIMARY = '#1677ff';

export type PatrolReportTranslate = (key: string) => string;

function toPieData(payload: PatrolReportPayload) {
  return (payload.points ?? []).map((p) => ({ type: p.label, value: p.value }));
}

function toColumnData(payload: PatrolReportPayload) {
  return (payload.points ?? []).map((p) => ({ month: p.label, value: p.value }));
}

function toLineData(payload: PatrolReportPayload) {
  const rows: { month: string; value: number; series: string }[] = [];
  for (const s of payload.series ?? []) {
    for (const p of s.data) {
      rows.push({ month: p.label, value: p.value, series: s.name });
    }
  }
  return rows;
}

function toWordData(payload: PatrolReportPayload) {
  return (payload.points ?? []).map((p) => ({ text: p.label, value: p.value }));
}

function toRadarData(payload: PatrolReportPayload) {
  return (payload.points ?? []).map((p) => ({ item: p.label, score: Math.min(100, Math.max(0, p.value)) }));
}

function chartShell(children: React.ReactNode) {
  return (
    <div
      style={{
        borderRadius: 12,
        background: 'linear-gradient(180deg, #fafcff 0%, #ffffff 40%)',
        padding: '8px 4px 0',
      }}
    >
      {children}
    </div>
  );
}

export function renderPatrolReportChart(
  def: PatrolReportDef,
  data: PatrolReportPayload | undefined,
  t: PatrolReportTranslate,
): React.ReactNode {
  if (!data) return null;
  const empty = !(data.points?.length || data.series?.length);
  if (empty) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('app.haoligo.patrol.reports.emptyChart')} />;
  }

  if (def.chartType === 'pie') {
    const d = toPieData(data);
    return chartShell(
      <div style={{ minHeight: 380 }}>
        <Pie
          data={d}
          angleField="value"
          colorField="type"
          radius={0.92}
          innerRadius={0.52}
          scale={{ color: { range: PALETTE } }}
          style={{ stroke: '#fff', lineWidth: 2 }}
          label={{
            type: 'spider',
            content: '{name}\n{percentage}',
            style: { fontSize: 11, fill: '#434343' },
          }}
          legend={{ position: 'bottom', flipPage: true, maxRow: 2 }}
          interactions={[{ type: 'element-highlight' }, { type: 'legend-filter' }]}
          height={400}
        />
      </div>,
    );
  }

  if (def.chartType === 'area' && !def.multiSeries) {
    const d = toColumnData(data);
    return chartShell(
      <div style={{ minHeight: 400 }}>
        <Area
          data={d}
          xField="month"
          yField="value"
          shapeField="smooth"
          style={{
            fill: def.percentY ? 'l(270) 0:#ffffff 0.35:#d3f5e8 0.95:#52c41a' : 'l(270) 0:#ffffff 0.4:#bae0ff 1:#1677ff',
            fillOpacity: 0.45,
            stroke: def.percentY ? '#52c41a' : AREA_PRIMARY,
            lineWidth: 2.5,
          }}
          point={{
            size: 4,
            shape: 'circle',
            style: { fill: '#fff', stroke: def.percentY ? '#52c41a' : AREA_PRIMARY, lineWidth: 2 },
          }}
          axis={{
            x: {
              title: t('app.haoligo.patrol.reports.axisMonth'),
              grid: { line: { style: { stroke: '#f0f0f0', lineDash: [4, 4] } } },
            },
            y: {
              title: def.percentY
                ? t('app.haoligo.patrol.reports.axisPercent')
                : t('app.haoligo.patrol.reports.axisCount'),
              grid: { line: { style: { stroke: '#f5f5f5' } } },
            },
          }}
          tooltip={{ showMarkers: true }}
          height={420}
        />
      </div>,
    );
  }

  if (def.chartType === 'area' && def.multiSeries) {
    const d = toLineData(data);
    return chartShell(
      <div style={{ minHeight: 420 }}>
        <Area
          data={d}
          xField="month"
          yField="value"
          seriesField="series"
          stack={false}
          shapeField="smooth"
          scale={{ color: { range: PALETTE } }}
          style={{ fillOpacity: 0.35 }}
          line={{ style: { lineWidth: 2 } }}
          point={{ size: 3 }}
          axis={{
            x: {
              title: t('app.haoligo.patrol.reports.axisMonth'),
              grid: { line: { style: { stroke: '#f0f0f0' } } },
            },
            y: {
              title: t('app.haoligo.patrol.reports.axisCount'),
              grid: { line: { style: { stroke: '#fafafa' } } },
            },
          }}
          legend={{ position: 'top', flipPage: true }}
          tooltip={{ showMarkers: true }}
          height={440}
        />
      </div>,
    );
  }

  if (def.chartType === 'radar') {
    const d = toRadarData(data);
    const maxScore = Math.max(100, ...d.map((x) => x.score));
    return chartShell(
      <div style={{ minHeight: 400 }}>
        <Radar
          data={d}
          xField="item"
          yField="score"
          area={{ style: { fillOpacity: 0.25 } }}
          point={{ size: 4 }}
          line={{ style: { lineWidth: 2 } }}
          color="#1677ff"
          axis={{
            x: { line: false, tickLine: false, grid: { line: { style: { lineDash: undefined } } } },
            y: {
              tickCount: 5,
              grid: { line: { type: 'line' } },
              label: false,
            },
          }}
          scale={{ y: { domainMin: 0, domainMax: maxScore } }}
          tooltip={{ showMarkers: true }}
          height={420}
        />
      </div>,
    );
  }

  if (def.chartType === 'bar-h') {
    const d = toColumnData(data);
    const isRank = def.key === 'overdue-ranking';
    return chartShell(
      <div style={{ minHeight: Math.max(340, d.length * 44) }}>
        <Bar
          data={d}
          xField="value"
          yField="month"
          color={isRank ? '#722ed1' : '#fa8c16'}
          style={{ radiusTopRight: 8, radiusBottomRight: 8, maxWidth: 28 }}
          label={
            def.percentY
              ? {
                  position: 'right',
                  style: { fill: '#434343', fontSize: 11 },
                  formatter: (datum: { value?: number }) => `${datum.value ?? ''}%`,
                }
              : { position: 'right', style: { fill: '#434343', fontSize: 12 } }
          }
          axis={{
            x: {
              title: def.percentY
                ? t('app.haoligo.patrol.reports.axisPercent')
                : t('app.haoligo.patrol.reports.axisCount'),
              grid: { line: { style: { stroke: '#f0f0f0' } } },
            },
            y: {
              title: isRank ? t('app.haoligo.patrol.reports.axisPerson') : t('app.haoligo.patrol.reports.axisMonth'),
              label: { style: { fontSize: 12 } },
            },
          }}
          tooltip={{ showMarkers: true }}
        />
      </div>,
    );
  }

  if (def.chartType === 'line' && def.multiSeries) {
    const d = toLineData(data);
    return chartShell(
      <div style={{ minHeight: 420 }}>
        <Line
          data={d}
          xField="month"
          yField="value"
          seriesField="series"
          smooth
          scale={{ color: { range: PALETTE } }}
          lineStyle={{ lineWidth: 2.5 }}
          point={{ size: 4, shape: 'circle', style: { lineWidth: 2, stroke: '#fff' } }}
          axis={{
            x: {
              title: t('app.haoligo.patrol.reports.axisMonth'),
              grid: { line: { style: { stroke: '#f0f0f0', lineDash: [4, 4] } } },
            },
            y: {
              title: t('app.haoligo.patrol.reports.axisCount'),
              grid: { line: { style: { stroke: '#fafafa' } } },
            },
          }}
          legend={{ position: 'top', flipPage: true }}
          tooltip={{ showMarkers: true }}
          height={440}
        />
      </div>,
    );
  }

  if (def.chartType === 'wordcloud') {
    const words = toWordData(data);
    return chartShell(
      <div style={{ minHeight: 420, padding: '0 8px' }}>
        <WordCloud
          data={words}
          textField="text"
          valueField="value"
          colorField="text"
          layout={{ spiral: 'archimedean', fontSize: [12, 48] } as Record<string, unknown>}
          style={{ fontFamily: 'inherit' }}
          height={400}
        />
        <div style={{ padding: '12px 8px 8px' }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {t('app.haoligo.patrol.reports.keywordCloudHint')}
          </Text>
        </div>
      </div>,
    );
  }

  return <Empty description={t('app.haoligo.patrol.reports.unsupportedChart')} />;
}
