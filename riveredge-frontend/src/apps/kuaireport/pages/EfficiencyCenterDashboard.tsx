import React, { Suspense, lazy, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRequest } from 'ahooks';
import {
  ClockCircleOutlined,
  BarChartOutlined,
  LineChartOutlined,
  FileSearchOutlined,
} from '@ant-design/icons';
import { apiRequest } from '../../../services/api';
import {
  ModuleCenterLayout,
  ModuleKpiRow,
  ModuleShortcutGrid,
  ModuleActionPanel,
  ModuleChartPanel,
  ModuleChartRow,
} from '../../kuaizhizao/components/module-center';
import type { ModuleKpiDef, ModuleShortcutDef } from '../../kuaizhizao/components/module-center';
const TimingColumn = lazy(async () => {
  const { Column } = await import('@ant-design/charts');
  return { default: (props: React.ComponentProps<typeof Column>) => <Column {...props} /> };
});

type TimingRow = {
  document_type?: string;
  document_code?: string;
  total_duration_hours?: number;
};

const EfficiencyCenterDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { data: timingList, loading } = useRequest(() =>
    apiRequest<TimingRow[]>('/apps/kuaizhizao/documents/timing', { method: 'GET', params: { limit: 50 } }),
  );

  const rows = timingList || [];
  const avgHours = useMemo(() => {
    if (!rows.length) return 0;
    const sum = rows.reduce((acc, r) => acc + (r.total_duration_hours || 0), 0);
    return Math.round((sum / rows.length) * 10) / 10;
  }, [rows]);

  const slowDocs = useMemo(
    () => [...rows].sort((a, b) => (b.total_duration_hours || 0) - (a.total_duration_hours || 0)).slice(0, 8),
    [rows],
  );

  const chartData = useMemo(
    () =>
      slowDocs.map((r) => ({
        name: (r.document_code || '-').slice(0, 10),
        hours: r.total_duration_hours || 0,
      })),
    [slowDocs],
  );

  const kpis: ModuleKpiDef[] = [
    {
      key: 'count',
      title: '跟踪单据数',
      value: rows.length,
      subtitle: '近 50 条节点耗时记录',
      icon: <FileSearchOutlined style={{ fontSize: 24, color: '#fff' }} />,
      gradient: 'linear-gradient(135deg, #1890ff 0%, #36cfc9 100%)',
    },
    {
      key: 'avg',
      title: '平均耗时 (小时)',
      value: avgHours,
      subtitle: '全节点合计均值',
      icon: <ClockCircleOutlined style={{ fontSize: 24, color: '#fff' }} />,
      gradient: 'linear-gradient(135deg, #722ed1 0%, #b37feb 100%)',
    },
    {
      key: 'slow',
      title: '超时单据',
      value: slowDocs.filter((r) => (r.total_duration_hours || 0) > avgHours && avgHours > 0).length,
      subtitle: '高于平均耗时',
      icon: <BarChartOutlined style={{ fontSize: 24, color: '#fff' }} />,
      gradient: 'linear-gradient(135deg, #faad14 0%, #ffbb33 100%)',
    },
  ];

  const shortcuts: ModuleShortcutDef[] = [
    { key: 'timing', title: '节点时效', icon: <ClockCircleOutlined style={{ fontSize: 22, color: '#1890ff' }} />, path: '/apps/kuaireport/analysis-center/document-timing' },
    { key: 'efficiency', title: '处理效率', icon: <LineChartOutlined style={{ fontSize: 22, color: '#52c41a' }} />, path: '/apps/kuaireport/analysis-center/document-efficiency' },
  ];

  return (
    <div>
      <ModuleCenterLayout
        loading={loading && !rows.length}
        kpiRow={<ModuleKpiRow items={kpis} />}
        shortcutRow={<ModuleShortcutGrid items={shortcuts} colProps={{ xs: 12, md: 6 }} />}
        actionRow={
          <ModuleActionPanel title="耗时 Top 单据" lg={24}>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {slowDocs.map((r) => (
                <li key={`${r.document_type}-${r.document_code}`} style={{ marginBottom: 6 }}>
                  <a onClick={() => navigate('/apps/kuaireport/analysis-center/document-timing')}>
                    {r.document_code} — {r.total_duration_hours ?? 0}h
                  </a>
                </li>
              ))}
            </ul>
          </ModuleActionPanel>
        }
        chartRow={
          <ModuleChartRow>
            <ModuleChartPanel title="单据耗时排行" lg={24}>
              <Suspense fallback={null}>
                <TimingColumn data={chartData} xField="name" yField="hours" height={240} />
              </Suspense>
            </ModuleChartPanel>
          </ModuleChartRow>
        }
      />
    </div>
  );
};

export default EfficiencyCenterDashboard;
