import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CalculatorOutlined,
  FileSearchOutlined,
  BarChartOutlined,
  DiffOutlined,
  AuditOutlined,
} from '@ant-design/icons';
import { mesDashboardService } from '../../../services/dashboard';
import { useDashboardRequest } from '../../../utils/dashboardRequestOptions';
import {
  ModuleCenterLayout,
  ModuleKpiRow,
  ModuleShortcutGrid,
  type ModuleKpiDef,
  type ModuleShortcutDef,
} from '../../../components/module-center';

const CostCenterDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { data: summary, loading } = useDashboardRequest(
    mesDashboardService.getCostSummary,
    'kz:cost-dashboard:summary',
  );
  const s = summary as Record<string, number> | undefined;

  const kpis: ModuleKpiDef[] = useMemo(
    () => [
      {
        key: 'pending',
        title: '待核算',
        value: s?.pending_calculations ?? 0,
        subtitle: '草稿状态成本核算单',
        icon: <CalculatorOutlined style={{ fontSize: 24, color: '#fff' }} />,
        gradient: 'linear-gradient(135deg, #1890ff 0%, #36cfc9 100%)',
        onClick: () => navigate('/apps/kuaicaiwu/cost-management/cost-calculations'),
      },
      {
        key: 'approved',
        title: '已审核核算',
        value: s?.approved_calculations ?? 0,
        subtitle: '可用于成本分析',
        icon: <AuditOutlined style={{ fontSize: 24, color: '#fff' }} />,
        gradient: 'linear-gradient(135deg, #52c41a 0%, #95de64 100%)',
        onClick: () => navigate('/apps/kuaicaiwu/cost-management/cost-calculations'),
      },
      {
        key: 'month',
        title: '本月核算次数',
        value: s?.month_calculations ?? 0,
        subtitle: '含工单与产品成本核算',
        icon: <BarChartOutlined style={{ fontSize: 24, color: '#fff' }} />,
        gradient: 'linear-gradient(135deg, #722ed1 0%, #b37feb 100%)',
      },
    ],
    [navigate, s],
  );

  const shortcuts: ModuleShortcutDef[] = [
    { key: 'calc', title: '成本核算', icon: <CalculatorOutlined style={{ fontSize: 22, color: '#1890ff' }} />, path: '/apps/kuaicaiwu/cost-management/cost-calculations' },
    { key: 'rules', title: '分摊规则', icon: <FileSearchOutlined style={{ fontSize: 22, color: '#52c41a' }} />, path: '/apps/kuaicaiwu/cost-management/cost-rules' },
    { key: 'report', title: '成本报表', icon: <BarChartOutlined style={{ fontSize: 22, color: '#fa8c16' }} />, path: '/apps/kuaicaiwu/cost-management/cost-report' },
    { key: 'compare', title: '成本对比', icon: <DiffOutlined style={{ fontSize: 22, color: '#722ed1' }} />, path: '/apps/kuaicaiwu/cost-management/cost-calculations?cat=compare' },
  ];

  return (
    <ModuleCenterLayout
      loading={loading && !s}
      kpiRow={<ModuleKpiRow items={kpis} />}
      shortcutRow={<ModuleShortcutGrid items={shortcuts} />}
    />
  );
};

export default CostCenterDashboard;
