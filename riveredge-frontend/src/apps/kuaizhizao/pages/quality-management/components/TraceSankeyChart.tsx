import React, { useCallback, useMemo } from 'react';
import { Sankey } from '@ant-design/charts';
import { Empty } from 'antd';
import { useTranslation } from 'react-i18next';
import type { TraceProfile } from '../../../services/traceability';
import {
  formatTraceSankeyIdLabel,
  sankeyNodeDepth,
  sankeyStageRank,
  TRACE_SANKEY_COLOR_SCALE,
  traceProfileToSankeyModel,
} from './traceToSankey';

export interface TraceSankeyChartProps {
  profile: TraceProfile;
  height?: number;
}

function resolveSankeyEndpointId(endpoint: unknown): string {
  if (endpoint == null) return '';
  if (typeof endpoint === 'string') return endpoint;
  if (typeof endpoint === 'object') {
    const obj = endpoint as { key?: string; id?: string };
    return String(obj.key ?? obj.id ?? '');
  }
  return String(endpoint);
}

const TraceSankeyChart: React.FC<TraceSankeyChartProps> = ({ profile, height = 480 }) => {
  const { t } = useTranslation();

  const { links, nodes, labelById } = useMemo(
    () => traceProfileToSankeyModel(profile, t),
    [profile, t],
  );

  const resolveLabel = useCallback(
    (id: string) => labelById.get(id) || formatTraceSankeyIdLabel(id, t),
    [labelById, t],
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
      data={{ links, nodes }}
      colorField="documentType"
      autoFit
      height={height}
      scale={{
        color: TRACE_SANKEY_COLOR_SCALE,
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
        labelFill: '#1f2937',
        labelText,
        linkFillOpacity: 0.55,
        nodeStroke: '#e8e8e8',
        nodeLineWidth: 1,
      }}
      tooltip={{
        nodeTitle: (datum: { key?: string }) => resolveLabel(String(datum?.key ?? '')),
        nodeItems: [{ field: 'value', name: t('common.quantity') }],
        linkTitle: (datum: { source?: unknown; target?: unknown }) => {
          const src = resolveLabel(resolveSankeyEndpointId(datum?.source));
          const tgt = resolveLabel(resolveSankeyEndpointId(datum?.target));
          return src && tgt ? `${src} → ${tgt}` : src || tgt;
        },
        linkItems: [
          (datum: { source?: unknown }) => ({
            name: t('app.kuaizhizao.quality.traceability.sankeyLinkSource'),
            value: resolveLabel(resolveSankeyEndpointId(datum?.source)),
          }),
          (datum: { target?: unknown }) => ({
            name: t('app.kuaizhizao.quality.traceability.sankeyLinkTarget'),
            value: resolveLabel(resolveSankeyEndpointId(datum?.target)),
          }),
          (datum: { value?: number }) => ({
            name: t('common.quantity'),
            value: datum?.value ?? '',
          }),
        ],
      }}
    />
  );
};

export default TraceSankeyChart;
