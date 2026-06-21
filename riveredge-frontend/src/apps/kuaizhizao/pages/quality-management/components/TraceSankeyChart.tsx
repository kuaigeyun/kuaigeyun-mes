import React, { useMemo } from 'react';
import { Sankey } from '@ant-design/charts';
import { Empty } from 'antd';
import { useTranslation } from 'react-i18next';
import type { TraceProfile } from '../../../services/traceability';
import { traceProfileToSankeyLinks } from './traceToSankey';

export interface TraceSankeyChartProps {
  profile: TraceProfile;
  height?: number;
}

const TraceSankeyChart: React.FC<TraceSankeyChartProps> = ({ profile, height = 480 }) => {
  const { t } = useTranslation();

  const data = useMemo(() => traceProfileToSankeyLinks(profile, t), [profile, t]);

  if (data.length === 0) {
    return (
      <Empty
        description={t('app.kuaizhizao.quality.traceability.sankeyEmpty')}
        style={{ paddingTop: height / 2 - 40 }}
      />
    );
  }

  return (
    <Sankey
      data={data}
      autoFit
      height={height}
      scale={{
        color: { range: ['#64748b', '#475569', '#334155', '#94a3b8', '#0891b2', '#0284c7'] },
      }}
      layout={{
        nodeAlign: 'justify',
        nodePadding: 0.025,
        iterations: 32,
      }}
      style={{
        labelFontSize: 11,
        labelFill: '#334155',
        linkFillOpacity: 0.45,
        nodeStroke: '#94a3b8',
        nodeLineWidth: 1,
      }}
      tooltip={{
        title: (datum: { source?: string; target?: string }) =>
          datum?.source && datum?.target ? `${datum.source} → ${datum.target}` : '',
        items: [{ field: 'value', name: t('app.kuaizhizao.quality.traceability.sankeyQuantity') }],
      }}
    />
  );
};

export default TraceSankeyChart;
