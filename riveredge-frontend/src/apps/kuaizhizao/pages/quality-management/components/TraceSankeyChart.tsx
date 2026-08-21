import React, { useMemo } from 'react';
import { Sankey } from '@ant-design/charts';
import { Empty } from 'antd';
import { useTranslation } from 'react-i18next';
import type { TraceProfile } from '../../../services/traceability';
import { sankeyNodeDepth, sankeyStageRank, traceProfileToSankeyModel } from './traceToSankey';

export interface TraceSankeyChartProps {
  profile: TraceProfile;
  height?: number;
}

const TraceSankeyChart: React.FC<TraceSankeyChartProps> = ({ profile, height = 480 }) => {
  const { t } = useTranslation();

  const { links, labelById } = useMemo(
    () => traceProfileToSankeyModel(profile, t),
    [profile, t],
  );

  const nodeDepth = useMemo(() => {
    const ids = new Set<string>();
    for (const link of links) {
      ids.add(link.source);
      ids.add(link.target);
    }
    const used = [...new Set([...ids].map((id) => sankeyStageRank(id)))].sort((a, b) => a - b);
    const compressed = new Map(used.map((rank, index) => [rank, index]));
    return (node: { key?: string }) =>
      compressed.get(sankeyStageRank(String(node.key || ''))) ?? sankeyNodeDepth(node);
  }, [links]);

  const labelText = useMemo(() => {
    const map = labelById;
    return (datum: { key?: string }) => map.get(String(datum?.key ?? '')) || String(datum?.key ?? '');
  }, [labelById]);

  if (links.length === 0) {
    return (
      <Empty
        description={t('app.kuaizhizao.quality.traceability.sankeyEmpty')}
        style={{ paddingTop: height / 2 - 40 }}
      />
    );
  }

  return (
    <Sankey
      data={links}
      autoFit
      height={height}
      scale={{
        color: { range: ['#64748b', '#475569', '#334155', '#94a3b8', '#0891b2', '#0284c7'] },
      }}
      layout={{
        nodeAlign: 'left',
        nodePadding: 0.03,
        nodeWidth: 0.018,
        iterations: 32,
        nodeDepth,
      }}
      style={{
        labelFontSize: 11,
        labelFill: '#334155',
        labelText,
        linkFillOpacity: 0.45,
        nodeStroke: '#94a3b8',
        nodeLineWidth: 1,
      }}
      tooltip={{
        title: (datum: { source?: string; target?: string; key?: string }) => {
          if (datum?.source && datum?.target) {
            const src = labelById.get(datum.source) || datum.source;
            const tgt = labelById.get(datum.target) || datum.target;
            return `${src} → ${tgt}`;
          }
          if (datum?.key) return labelById.get(datum.key) || datum.key;
          return '';
        },
        items: [{ field: 'value', name: t('common.quantity') }],
      }}
    />
  );
};

export default TraceSankeyChart;
