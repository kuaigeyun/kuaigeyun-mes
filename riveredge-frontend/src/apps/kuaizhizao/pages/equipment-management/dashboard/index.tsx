import React, { Suspense, lazy, useMemo } from 'react';
import { Progress, Table, Tag, Typography } from 'antd';
import { useRequest } from 'ahooks';
import {
  ToolOutlined,
  CalendarOutlined,
  DashboardOutlined,
  SettingOutlined,
  AlertOutlined,
  SafetyCertificateOutlined,
  BuildOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { mesDashboardService } from '../../../services/dashboard';
import { equipmentFaultApi, maintenancePlanApi } from '../../../services/equipment';
import { dashboardRequestOptions } from '../../../utils/dashboardRequestOptions';
import {
  ModuleCenterLayout,
  ModuleKpiRow,
  ModuleShortcutGrid,
  ModuleActionPanel,
  ModuleTodoList,
  ModuleChartPanel,
  ModuleChartRow,
} from '../../../components/module-center';
import type { ModuleKpiDef, ModuleShortcutDef } from '../../../components/module-center';

const { Text } = Typography;

const EquipmentTrendColumn = lazy(async () => {
  const { Column } = await import('@ant-design/charts');
  return { default: (props: React.ComponentProps<typeof Column>) => <Column {...props} /> };
});

const EquipmentStatusPie = lazy(async () => {
  const { Pie } = await import('@ant-design/charts');
  return { default: (props: React.ComponentProps<typeof Pie>) => <Pie {...props} /> };
});

const EquipmentDashboard: React.FC = () => {
  const navigate = useNavigate();

  const { data: summary, loading: summaryLoading } = useRequest(
    mesDashboardService.getEquipmentSummary,
    dashboardRequestOptions('kz:equipment-dashboard:summary'),
  );
  const { data: todosData, loading: todosLoading } = useRequest(() =>
    mesDashboardService.getTodosByModule('equipment', 8),
    dashboardRequestOptions('kz:equipment-dashboard:todos'),
  );
  const { data: recentFaultsResult, loading: faultsLoading } = useRequest(async () => {
    const res = await equipmentFaultApi.list({ limit: 6 });
    return Array.isArray(res) ? res : res?.items || [];
  }, dashboardRequestOptions('kz:equipment-dashboard:faults'));
  const { data: recentMaintenanceResult, loading: maintenanceLoading } = useRequest(async () => {
    const res = await maintenancePlanApi.list({ limit: 6 });
    return Array.isArray(res) ? res : res?.items || [];
  }, dashboardRequestOptions('kz:equipment-dashboard:maintenance'));
  const { data: trendData, loading: trendLoading } = useRequest(
    mesDashboardService.getEquipmentTrend,
    dashboardRequestOptions('kz:equipment-dashboard:trend'),
  );

  const s = summary as Record<string, number> | undefined;
  const recentFaults = recentFaultsResult || [];
  const recentMaintenance = recentMaintenanceResult || [];
  const todos = todosData?.items || [];

  const kpis: ModuleKpiDef[] = useMemo(
    () => [
      {
        key: 'fault',
        title: '报修/故障中',
        value: s?.faulty_count ?? 0,
        subtitle: (s?.faulty_count ?? 0) > 0 ? `当前有 ${s?.faulty_count} 台设备停机待修` : '全厂设备运行状态良好',
        icon: <ToolOutlined style={{ fontSize: 24, color: '#fff' }} />,
        gradient: 'linear-gradient(135deg, #ff4d4f 0%, #ff7875 100%)',
        onClick: () => navigate('/apps/kuaizhizao/equipment-management/faults?status=维修中'),
        sideMetrics: [{ label: '设备总计', value: s?.total_count ?? 0 }],
      },
      {
        key: 'calibration',
        title: '需校验/计量',
        value: s?.calibration_needed ?? 0,
        subtitle: '含已逾期或本月需校验设备',
        icon: <SafetyCertificateOutlined style={{ fontSize: 24, color: '#fff' }} />,
        gradient: 'linear-gradient(135deg, #faad14 0%, #ffbb33 100%)',
        onClick: () => navigate('/apps/kuaizhizao/equipment-management/list'),
        sideMetrics: [{ label: '逾期校验', value: s?.calibration_needed ?? 0 }],
      },
      {
        key: 'oee',
        title: '综合效率 OEE',
        value: `${s?.average_oee ?? 0}%`,
        icon: <DashboardOutlined style={{ fontSize: 24, color: '#fff' }} />,
        gradient: 'linear-gradient(135deg, #1890ff 0%, #36cfc9 100%)',
        progress: s?.average_oee ?? 0,
        sideMetrics: [
          { label: '稼动率', value: '88.2%' },
          { label: '故障率', value: '1.5%' },
        ],
      },
    ],
    [navigate, s],
  );

  const shortcuts: ModuleShortcutDef[] = [
    { key: 'ledger', title: '设备台账', icon: <BuildOutlined style={{ fontSize: 22, color: '#1890ff' }} />, path: '/apps/kuaizhizao/equipment-management/list' },
    { key: 'maint', title: '保养计划', icon: <CalendarOutlined style={{ fontSize: 22, color: '#52c41a' }} />, path: '/apps/kuaizhizao/equipment-management/maintenance' },
    { key: 'fault', title: '故障报修', icon: <AlertOutlined style={{ fontSize: 22, color: '#ff4d4f' }} />, path: '/apps/kuaizhizao/equipment-management/faults' },
    { key: 'spare', title: '备品备件', icon: <SettingOutlined style={{ fontSize: 22, color: '#fa8c16' }} />, path: '/apps/kuaizhizao/equipment-management/spare-parts' },
  ];

  const statusPieData = useMemo(
    () => [
      { type: '正常', value: Math.max(0, (s?.total_count ?? 0) - (s?.faulty_count ?? 0)) },
      { type: '故障/维修', value: s?.faulty_count ?? 0 },
    ],
    [s],
  );

  return (
    <ModuleCenterLayout
      loading={summaryLoading && !s}
      kpiRow={<ModuleKpiRow items={kpis} />}
      shortcutRow={<ModuleShortcutGrid items={shortcuts} />}
      actionRow={
        <>
          <ModuleActionPanel title="设备待办" lg={8} loading={todosLoading}>
            <ModuleTodoList items={todos} emptyText="暂无设备待办" />
          </ModuleActionPanel>
          <ModuleActionPanel
            title="待处理故障"
            lg={8}
            loading={faultsLoading}
            extra={<a onClick={() => navigate('/apps/kuaizhizao/equipment-management/faults')}>全部</a>}
          >
            <Table
              size="small"
              dataSource={recentFaults.filter((f: { status?: string }) =>
                !String(f.status).includes('完成') && !String(f.status).includes('fixed'),
              ).slice(0, 6)}
              pagination={false}
              rowKey="id"
              columns={[
                {
                  title: '报修单号',
                  dataIndex: 'fault_no',
                  render: (text, record: { uuid?: string }) => (
                    <a onClick={() => navigate(`/apps/kuaizhizao/equipment-management/faults/${record.uuid}`)}>{text}</a>
                  ),
                },
                { title: '设备', dataIndex: 'equipment_name', ellipsis: true },
                {
                  title: '状态',
                  dataIndex: 'status',
                  width: 80,
                  render: (status) => <Tag color="error">{status}</Tag>,
                },
              ]}
            />
          </ModuleActionPanel>
          <ModuleActionPanel
            title="保养到期提醒"
            lg={8}
            loading={maintenanceLoading}
            extra={<a onClick={() => navigate('/apps/kuaizhizao/equipment-management/maintenance')}>全部</a>}
          >
            <Table
              size="small"
              dataSource={recentMaintenance.slice(0, 6)}
              pagination={false}
              rowKey="id"
              columns={[
                { title: '维护名称', dataIndex: 'name', ellipsis: true },
                {
                  title: '下次计划',
                  dataIndex: 'next_execution_date',
                  width: 100,
                  render: (t) => <Text type="secondary" style={{ fontSize: 12 }}>{t || '—'}</Text>,
                },
              ]}
            />
          </ModuleActionPanel>
        </>
      }
      chartRow={
        <ModuleChartRow>
          <ModuleChartPanel title="设备状态分布" lg={10}>
            <Suspense fallback={null}>
              <EquipmentStatusPie
                data={statusPieData}
                angleField="value"
                colorField="type"
                radius={0.8}
                height={240}
              />
            </Suspense>
          </ModuleChartPanel>
          <ModuleChartPanel title="故障报修趋势" loading={trendLoading} lg={14}>
            <Suspense fallback={null}>
              <EquipmentTrendColumn
                data={trendData?.items || []}
                xField="date"
                yField="count"
                height={240}
              />
            </Suspense>
          </ModuleChartPanel>
        </ModuleChartRow>
      }
    />
  );
};

export default EquipmentDashboard;
