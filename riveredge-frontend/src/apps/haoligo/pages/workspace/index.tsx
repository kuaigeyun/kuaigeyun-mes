import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Table, Tag, Progress, Empty, Typography, theme, Spin, Tooltip, Button, Space } from 'antd';
import {
  AppstoreOutlined,
  AuditOutlined,
  ToolOutlined,
  WarningOutlined,
  CodeSandboxOutlined,
  BuildOutlined,
  SearchOutlined,
  FileProtectOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useGlobalStore } from '../../../../stores/globalStore';
import { hasModulePermission } from '../../../../utils/permissionContract';
import { useResourcePermissions } from '../../../../hooks/useResourcePermissions';
import { Column, Pie } from '@ant-design/charts';
import dayjs from 'dayjs';
import {
  getPatrolReport,
  getPatrolReportKpiSummary,
  fetchEquipmentOperationalStatusSummary,
  listMolds,
  listWorkshops,
  type MaintenanceReminderSummary,
} from '../../services/haoligo';
import {
  EQUIPMENT_STATUS_LABEL_CHART_COLORS,
  EQUIPMENT_STATUS_LABEL_ORDER,
} from '../../utils/operationalStatusTrafficLight';
import {
  fetchMoldMaintenanceRemindersPage,
  formatMoldMaintenanceEmptySummary,
  maintenanceProgressColor,
  maintenanceProgressPercent,
  dominantDimensionLabel as moldDominantDimensionLabel,
  reminderKindLabel as moldReminderKindLabel,
  type AlertLevel,
  type MoldMaintenanceAlertRow,
} from '../../utils/moldMaintenanceAlert';
import {
  fetchEquipmentMaintenanceRemindersPage,
  formatMaintenanceEmptySummary,
  dominantDimensionLabel as equipmentDominantDimensionLabel,
  reminderKindLabel as equipmentReminderKindLabel,
  type EquipmentMaintenanceAlertRow,
} from '../../utils/equipmentMaintenanceAlert';
import { HAOLIGO_RESOURCE_EQUIPMENT_UPKEEP_SHEET, HAOLIGO_RESOURCE_MOLD_UPKEEP } from '../../constants/documentPermissionResources';
import {
  ModuleCenterLayout,
  ModuleKpiRow,
  ModuleShortcutGrid,
  ModuleActionPanel,
  ModuleChartPanel,
  ModuleChartRow,
} from '../../../kuaizhizao/components/module-center';
import type { ModuleKpiDef, ModuleShortcutDef } from '../../../kuaizhizao/components/module-center';
import { UniTableStackedPrimaryCell } from '../../../../components/uni-table/stackedPrimaryColumn';
import { formatDateTime } from '../../../../utils/format';

const { Text } = Typography;
const { useToken } = theme;

/**
 * 好力 GO 整体工作台：汇总设备 / 模具 / 巡查关键数量与预警。
 */

function buildEquipmentStatusChartFromCounts(counts: Record<string, number>): { type: string; value: number }[] {
  const eqMap: Record<string, number> = {};
  for (const [raw, n] of Object.entries(counts)) {
    let s = raw === '_unset' ? '未知' : raw;
    if (s === 'running') s = '正常运行';
    else if (s === 'shutdown') s = '停机';
    else if (s === 'repair') s = '维修';
    else if (s === 'upkeep' || s === 'maintenance' || s === '保养') s = '保养';
    else if (s === 'standby') s = '闲置备用';
    eqMap[s] = (eqMap[s] || 0) + n;
  }
  return Object.keys(eqMap).map((k) => ({ type: k, value: eqMap[k] }));
}

function buildHazardTrendFromDailyPoints(
  last7Days: string[],
  points: { label: string; value: number }[],
): { date: string; count: number }[] {
  const countByDay = new Map<string, number>();
  for (const p of points) {
    const mmdd = formatDateTime(p.label, 'MM-DD');
    countByDay.set(mmdd, (countByDay.get(mmdd) ?? 0) + Math.round(p.value));
  }
  return last7Days.map((d) => ({ date: d, count: countByDay.get(d) ?? 0 }));
}

function joinMaintenanceMeta(parts: Array<string | null | undefined>): string {
  return parts.map((p) => (p ?? '').trim()).filter(Boolean).join(' · ');
}

function equipmentRemainingLabel(record: EquipmentMaintenanceAlertRow): string | null {
  if (record.reminder_kind !== 'cycle_plan') return null;
  if (record.dominant_dimension === 'days' && record.remaining_days != null) {
    return `剩 ${record.remaining_days} 天`;
  }
  if (record.dominant_dimension === 'yield' && record.yield_usage_pct != null) {
    const cycle = Number(record.maintenance_cycle_by_yield);
    const used = Number(record.used_yield);
    if (Number.isFinite(cycle) && Number.isFinite(used)) {
      return `剩 ${Math.max(0, Math.round(cycle - used))}`;
    }
  }
  return null;
}

function moldRemainingLabel(record: MoldMaintenanceAlertRow): string | null {
  if (record.reminder_kind !== 'cycle_plan') return null;
  const cycle = Number(record.maintenance_cycle_by_yield);
  if (!Number.isFinite(cycle) || cycle <= 0) return null;
  const used =
    record.dominant_dimension === 'yield_total'
      ? Number(record.total_manufacture_qty)
      : Number(record.used_yield);
  if (!Number.isFinite(used)) return null;
  return `剩 ${Math.max(0, Math.round(cycle - used))}`;
}

const metaLineStyle: React.CSSProperties = {
  display: 'block',
  marginTop: 4,
  fontSize: 12,
  lineHeight: 1.25,
  maxWidth: '100%',
};

const WorkspaceMaintenanceMetricsCell: React.FC<{
  variant: 'equipment' | 'mold';
  record: EquipmentMaintenanceAlertRow | MoldMaintenanceAlertRow;
}> = ({ variant, record }) => {
  const { token } = useToken();
  const reasons = record.alert_reasons ?? [];
  const reasonText = reasons.length ? reasons.join('；') : '—';

  if (record.reminder_kind !== 'cycle_plan') {
    return (
      <Tooltip title={reasonText === '—' ? undefined : reasonText}>
        <Text type="secondary" ellipsis style={{ ...metaLineStyle, marginTop: 0 }}>
          {reasonText}
        </Text>
      </Tooltip>
    );
  }

  const percent = maintenanceProgressPercent(record);
  const color = maintenanceProgressColor(percent, token);
  const status = percent >= 100 ? 'exception' : percent >= 90 ? 'normal' : 'success';
  const dimLabel =
    variant === 'equipment'
      ? equipmentDominantDimensionLabel(
          (record as EquipmentMaintenanceAlertRow).dominant_dimension ?? null,
        )
      : moldDominantDimensionLabel((record as MoldMaintenanceAlertRow).dominant_dimension ?? null);
  const lastAt = record.last_upkeep_at;
  const lastLabel = lastAt ? `上次 ${formatDateTime(lastAt, 'MM-DD')}` : null;
  const remainingLabel =
    variant === 'equipment'
      ? equipmentRemainingLabel(record as EquipmentMaintenanceAlertRow)
      : moldRemainingLabel(record as MoldMaintenanceAlertRow);
  const meta = joinMaintenanceMeta([dimLabel !== '—' ? dimLabel : null, lastLabel, remainingLabel]);

  return (
    <div style={{ minWidth: 0, maxWidth: '100%' }}>
      <Progress
        percent={Math.min(100, percent)}
        status={status as 'exception' | 'normal' | 'success'}
        strokeColor={color}
        size="small"
        showInfo={false}
      />
      {meta ? (
        <Tooltip title={reasonText === '—' ? meta : `${meta}；${reasonText}`}>
          <Text type="secondary" ellipsis style={metaLineStyle}>
            {meta}
          </Text>
        </Tooltip>
      ) : (
        <Tooltip title={reasonText}>
          <Text type="secondary" ellipsis style={metaLineStyle}>
            {reasonText}
          </Text>
        </Tooltip>
      )}
    </div>
  );
};

const WorkspacePage: React.FC = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { token } = useToken();
  const currentUser = useGlobalStore((s) => s.currentUser);
  const canReadWorkspaceDashboard = hasModulePermission(currentUser, 'haoligo:workspace-dashboard', 'read');
  const canReadEquipment = hasModulePermission(currentUser, 'haoligo:equipment-ledger', 'read');
  const canReadMolds = hasModulePermission(currentUser, 'haoligo:molds-ledger', 'read');
  const canReadMaintenanceAlert = hasModulePermission(currentUser, 'haoligo:molds-reports-maintenance-alert', 'read');
  const canReadEquipmentMaintenancePlan = hasModulePermission(
    currentUser,
    'haoligo:equipment-reports-maintenance-plan',
    'read',
  );
  const canReadHazards = hasModulePermission(currentUser, 'haoligo:patrol-hazards', 'read');
  const equipmentUpkeepPerms = useResourcePermissions(HAOLIGO_RESOURCE_EQUIPMENT_UPKEEP_SHEET);
  const moldUpkeepPerms = useResourcePermissions(HAOLIGO_RESOURCE_MOLD_UPKEEP);
  const canCreateEquipmentUpkeep = equipmentUpkeepPerms.canCreate;
  const canCreateMoldUpkeep = moldUpkeepPerms.canCreate;

  const [loading, setLoading] = useState(true);
  const [hazardTrendLoading, setHazardTrendLoading] = useState(false);
  const [workshopCount, setWorkshopCount] = useState(0);
  const [equipmentTotal, setEquipmentTotal] = useState(0);
  const [moldTotal, setMoldTotal] = useState(0);
  const [hazardChecking, setHazardChecking] = useState(0);
  const [hazardRepairing, setHazardRepairing] = useState(0);
  const [hazardDone, setHazardDone] = useState(0);

  const [eqStatusData, setEqStatusData] = useState<{type: string; value: number}[]>([]);
  const [hazardTrendData, setHazardTrendData] = useState<{date: string; count: number}[]>([]);
  const [equipmentMaintenanceAlertData, setEquipmentMaintenanceAlertData] = useState<EquipmentMaintenanceAlertRow[]>([]);
  const [equipmentMaintenanceAlertTotal, setEquipmentMaintenanceAlertTotal] = useState(0);
  const [moldMaintenanceAlertData, setMoldMaintenanceAlertData] = useState<MoldMaintenanceAlertRow[]>([]);
  const [moldMaintenanceAlertTotal, setMoldMaintenanceAlertTotal] = useState(0);
  const [equipmentMaintenanceSummary, setEquipmentMaintenanceSummary] =
    useState<MaintenanceReminderSummary | null>(null);
  const [moldMaintenanceSummary, setMoldMaintenanceSummary] = useState<MaintenanceReminderSummary | null>(null);

  const loadHazardTrend = useCallback(
    async (last7Days: string[]) => {
      if (!canReadHazards) {
        setHazardTrendData(last7Days.map((d) => ({ date: d, count: 0 })));
        return;
      }
      setHazardTrendLoading(true);
      try {
        const report = await getPatrolReport('daily-volume', { days: 7 });
        setHazardTrendData(buildHazardTrendFromDailyPoints(last7Days, report.points ?? []));
      } catch (e) {
        setHazardTrendData(last7Days.map((d) => ({ date: d, count: 0 })));
        message.error((e as Error).message || '隐患趋势加载失败');
      } finally {
        setHazardTrendLoading(false);
      }
    },
    [canReadHazards, message],
  );

  const load = useCallback(async () => {
    setLoading(true);
    const today = dayjs();
    const last7Days = Array.from({ length: 7 }).map((_, i) => today.subtract(6 - i, 'day').format('MM-DD'));

    const needEquipmentAlerts = canReadEquipment && canReadEquipmentMaintenancePlan;
    const needMoldAlerts = canReadMolds && canReadMaintenanceAlert;

    try {
      const [ws, hazardKpi, eqStatusSummary, moldTotal, equipmentReminders, moldReminders] =
        await Promise.all([
          canReadWorkspaceDashboard || canReadEquipment
            ? listWorkshops()
            : Promise.resolve([]),
          canReadHazards ? getPatrolReportKpiSummary() : Promise.resolve(null),
          canReadEquipment ? fetchEquipmentOperationalStatusSummary() : Promise.resolve(null),
          canReadMolds ? listMolds({ limit: 1, skip: 0 }).then((r) => r.total) : Promise.resolve(0),
          needEquipmentAlerts
            ? fetchEquipmentMaintenanceRemindersPage({
                actionable_only: true,
                limit: 5,
                preview: true,
              })
            : Promise.resolve(null),
          needMoldAlerts
            ? fetchMoldMaintenanceRemindersPage({ actionable_only: true, limit: 5, preview: true })
            : Promise.resolve(null),
        ]);

      setWorkshopCount(ws.length);
      setEquipmentTotal(eqStatusSummary?.total ?? 0);
      setMoldTotal(moldTotal);

      if (hazardKpi) {
        setHazardChecking(hazardKpi.open_tasks);
        setHazardRepairing(hazardKpi.completed_tasks);
        setHazardDone(hazardKpi.total_tasks);
      } else {
        setHazardChecking(0);
        setHazardRepairing(0);
        setHazardDone(0);
      }

      setEqStatusData(
        eqStatusSummary ? buildEquipmentStatusChartFromCounts(eqStatusSummary.counts) : [],
      );

      if (equipmentReminders) {
        setEquipmentMaintenanceAlertTotal(equipmentReminders.summary.actionable);
        setEquipmentMaintenanceAlertData(equipmentReminders.items);
        setEquipmentMaintenanceSummary(equipmentReminders.summary);
      } else {
        setEquipmentMaintenanceAlertTotal(0);
        setEquipmentMaintenanceAlertData([]);
        setEquipmentMaintenanceSummary(null);
      }

      if (moldReminders) {
        setMoldMaintenanceAlertTotal(moldReminders.summary.actionable);
        setMoldMaintenanceAlertData(moldReminders.items);
        setMoldMaintenanceSummary(moldReminders.summary);
      } else {
        setMoldMaintenanceAlertTotal(0);
        setMoldMaintenanceAlertData([]);
        setMoldMaintenanceSummary(null);
      }
    } catch (e) {
      message.error((e as Error).message || '工作台数据加载失败');
    } finally {
      setLoading(false);
    }

    void loadHazardTrend(last7Days);
  }, [
    message,
    canReadWorkspaceDashboard,
    canReadEquipment,
    canReadMolds,
    canReadMaintenanceAlert,
    canReadEquipmentMaintenancePlan,
    canReadHazards,
    loadHazardTrend,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  const faultCount = eqStatusData
    .filter((d) => d.type === '停机' || d.type === '维修')
    .reduce((sum, d) => sum + d.value, 0);
  const equipmentMaintenanceAlertCount = equipmentMaintenanceAlertTotal;
  const moldMaintenanceAlertCount = moldMaintenanceAlertTotal;

  const kpis: ModuleKpiDef[] = useMemo(
    () => [
      {
        key: 'equipment',
        title: '设备总台账',
        value: equipmentTotal,
        subtitle: `覆盖 ${workshopCount} 个车间`,
        icon: <ToolOutlined style={{ fontSize: 24, color: '#fff' }} />,
        gradient: 'linear-gradient(135deg, #1677ff 0%, #0958d9 100%)',
        onClick: () => navigate('/apps/haoligo/equipment'),
        sideMetrics: [{ label: '故障/停机', value: faultCount }],
      },
      {
        key: 'maintenance',
        title: '设备保养计划',
        value: equipmentMaintenanceAlertCount,
        subtitle: '可执行保养项',
        icon: <WarningOutlined style={{ fontSize: 24, color: '#fff' }} />,
        gradient: 'linear-gradient(135deg, #faad14 0%, #ffbb33 100%)',
        onClick: () => navigate('/apps/haoligo/equipment/reports/maintenance-plan'),
        sideMetrics: [{ label: '隐患待办', value: hazardChecking + hazardRepairing }],
      },
      {
        key: 'mold',
        title: '模具保养预警',
        value: moldMaintenanceAlertCount,
        subtitle: `模具档案 ${moldTotal} 套`,
        icon: <CodeSandboxOutlined style={{ fontSize: 24, color: '#fff' }} />,
        gradient: 'linear-gradient(135deg, #52c41a 0%, #389e0d 100%)',
        onClick: () => navigate('/apps/haoligo/molds/reports/maintenance-alert'),
        sideMetrics: [{ label: '已治理隐患', value: hazardDone }],
      },
    ],
    [
      equipmentTotal,
      workshopCount,
      faultCount,
      equipmentMaintenanceAlertCount,
      hazardChecking,
      hazardRepairing,
      moldMaintenanceAlertCount,
      moldTotal,
      hazardDone,
      navigate,
    ],
  );

  const shortcuts: ModuleShortcutDef[] = [
    { key: 'molds', title: '模具管理', icon: <AppstoreOutlined style={{ fontSize: 22, color: '#13c2c2' }} />, path: '/apps/haoligo/molds' },
    { key: 'equipment', title: '设备台账', icon: <ToolOutlined style={{ fontSize: 22, color: '#1890ff' }} />, path: '/apps/haoligo/equipment/ledger' },
    { key: 'spot-check', title: '设备点检', icon: <AuditOutlined style={{ fontSize: 22, color: '#fa8c16' }} />, path: '/apps/haoligo/equipment/documents/spot-check' },
    { key: 'repair', title: '故障报修', icon: <BuildOutlined style={{ fontSize: 22, color: '#ff4d4f' }} />, path: '/apps/haoligo/equipment/documents/upkeep-sheet?service_type=维修' },
    { key: 'maintenance', title: '保养计划', icon: <FileProtectOutlined style={{ fontSize: 22, color: '#52c41a' }} />, path: '/apps/haoligo/equipment/documents/upkeep-sheet?service_type=保养' },
    { key: 'inspection', title: '巡查隐患', icon: <SearchOutlined style={{ fontSize: 22, color: '#722ed1' }} />, path: '/apps/haoligo/patrol/hazards' },
  ];

  const hazardTrendConfig = {
    data: hazardTrendData,
    xField: 'date',
    yField: 'count',
    height: 300,
    autoFit: true,
    padding: [20, 20, 20, 20],
    scale: {
      y: {
        domainMin: 0,
        domainMax: Math.max(1, ...hazardTrendData.map((d) => d.count)),
      },
    },
    axis: {
      x: { title: false },
      y: { title: false, grid: true },
    },
    style: { fill: token.colorPrimary, radiusTopLeft: 4, radiusTopRight: 4 },
    tooltip: { name: '隐患上报数量' },
  };

  /** G2 5 / @ant-design/charts v2：外部标签用 position: 'spider' + connector，勿用旧版 type: 'outer' */
  const buildDonutPieConfig = (
    data: { type: string; value: number }[],
    colorMap: Record<string, string>,
    domainOrder: readonly string[],
  ) => {
    const OTHER_SLICE = '其他';
    const minSlicePct = 5;
    const positive = data.filter((item) => item.value > 0);
    const total = positive.reduce((sum, item) => sum + item.value, 0);

    /** 过小扇区合并为「其他」，避免 spider 为空标签仍画引线 */
    let chartData = positive;
    if (total > 0 && positive.length > 1) {
      const major: { type: string; value: number }[] = [];
      let otherValue = 0;
      for (const d of positive) {
        if ((d.value / total) * 100 >= minSlicePct) major.push(d);
        else otherValue += d.value;
      }
      if (otherValue > 0) {
        chartData = [...major, { type: OTHER_SLICE, value: otherValue }];
      } else if (major.length > 0) {
        chartData = major;
      }
    }

    const present = new Set(chartData.map((d) => d.type));
    const domain = [
      ...domainOrder.filter((t) => present.has(t)),
      ...chartData.map((d) => d.type).filter((t) => !domainOrder.includes(t)),
    ];
    const otherColor = token.colorTextQuaternary;
    const range = domain.map((t) =>
      t === OTHER_SLICE ? otherColor : (colorMap[t] ?? otherColor),
    );
    return {
      data: chartData,
      angleField: 'value',
      colorField: 'type',
      radius: 0.62,
      innerRadius: 0.42,
      height: 300,
      autoFit: true,
      padding: [24, 48, 16, 48],
      scale: { color: { type: 'ordinal', domain, range } },
      legend: {
        color: {
          position: 'bottom',
          layout: { justifyContent: 'center' },
          flipPage: true,
          maxRow: 2,
        },
      },
      label: {
        text: (d: { type: string; value: number }) => {
          if (total <= 0) return '';
          const pct = Math.round((d.value / total) * 100);
          return `${d.type}\n${pct}%`;
        },
        position: 'spider',
        style: { fontSize: 11, fill: token.colorText, lineHeight: 14 },
        transform: [{ type: 'overlapDodgeY' }, { type: 'exceedAdjust', bounds: 'padding' }],
      },
    };
  };

  const statusCountColor = (type: string, colorMap: Record<string, string>) =>
    colorMap[type] ?? token.colorTextQuaternary;

  const pieChartShellStyle: React.CSSProperties = {
    height: 300,
    overflow: 'hidden',
    flex: 1,
  };

  const chartBodyShellStyle: React.CSSProperties = {
    height: 300,
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  const renderEquipmentAlertTag = (record: EquipmentMaintenanceAlertRow) => {
    if (record.reminder_kind === 'manual_maintenance') {
      return <Tag color="processing">{equipmentReminderKindLabel(record.reminder_kind)}</Tag>;
    }
    if (record.reminder_kind === 'setup_no_cycle' || record.reminder_kind === 'setup_no_baseline') {
      return <Tag color="default">{equipmentReminderKindLabel(record.reminder_kind)}</Tag>;
    }
    const level: AlertLevel = record.alert_level;
    if (level === 'critical') return <Tag color="error">紧急</Tag>;
    if (level === 'warning') return <Tag color="warning">预警</Tag>;
    return <Tag color="success">正常</Tag>;
  };

  const equipmentMaintenanceAlertColumns = [
    {
      title: '设备',
      key: 'equipment',
      ellipsis: true,
      render: (_: unknown, record: EquipmentMaintenanceAlertRow) => (
        <UniTableStackedPrimaryCell
          primary={String(record.asset_code ?? '').trim() || '—'}
          secondary={String(record.name ?? '').trim() || '—'}
          primaryExtra={renderEquipmentAlertTag(record)}
        />
      ),
    },
    {
      title: '维保进度',
      key: 'metrics',
      ellipsis: true,
      render: (_: unknown, record: EquipmentMaintenanceAlertRow) => (
        <WorkspaceMaintenanceMetricsCell variant="equipment" record={record} />
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 64,
      align: 'center' as const,
      render: (_: unknown, record: EquipmentMaintenanceAlertRow) =>
        canCreateEquipmentUpkeep ? (
          <Button
            type="link"
            size="small"
            onClick={() =>
              navigate(
                `/apps/haoligo/equipment/documents/upkeep-sheet?service_type=${encodeURIComponent('保养')}&equipment_id=${record.id}`,
              )
            }
          >
            保养单
          </Button>
        ) : null,
    },
  ];

  const renderMoldAlertTag = (record: MoldMaintenanceAlertRow) => {
    if (record.reminder_kind === 'manual_maintenance') {
      return <Tag color="processing">{moldReminderKindLabel(record.reminder_kind)}</Tag>;
    }
    if (record.reminder_kind === 'setup_no_cycle' || record.reminder_kind === 'setup_no_baseline') {
      return <Tag color="default">{moldReminderKindLabel(record.reminder_kind)}</Tag>;
    }
    const level: AlertLevel = record.alert_level;
    if (level === 'critical') return <Tag color="error">紧急</Tag>;
    if (level === 'warning') return <Tag color="warning">预警</Tag>;
    return <Tag color="success">正常</Tag>;
  };

  const moldMaintenanceAlertColumns = [
    {
      title: '模具',
      key: 'mold',
      ellipsis: true,
      render: (_: unknown, record: MoldMaintenanceAlertRow) => (
        <UniTableStackedPrimaryCell
          primary={String(record.mold_code ?? '').trim() || '—'}
          secondary={String(record.name ?? '').trim() || '—'}
          primaryExtra={renderMoldAlertTag(record)}
        />
      ),
    },
    {
      title: '维保进度',
      key: 'metrics',
      ellipsis: true,
      render: (_: unknown, record: MoldMaintenanceAlertRow) => (
        <WorkspaceMaintenanceMetricsCell variant="mold" record={record} />
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 64,
      align: 'center' as const,
      render: (_: unknown, record: MoldMaintenanceAlertRow) =>
        canCreateMoldUpkeep ? (
          <Button
            type="link"
            size="small"
            onClick={() =>
              navigate(
                `/apps/haoligo/molds/documents/maintenance?service_type=${encodeURIComponent('保养')}&mold_code=${encodeURIComponent(record.mold_code)}`,
              )
            }
          >
            保养单
          </Button>
        ) : null,
    },
  ];

  return (
    <ModuleCenterLayout
      showSidebar={false}
      loading={loading}
      kpiRow={<ModuleKpiRow items={kpis} />}
      shortcutRow={<ModuleShortcutGrid items={shortcuts} colProps={{ xs: 12, sm: 8, md: 4 }} />}
      actionRow={
        <>
          <ModuleActionPanel
            title="设备保养计划"
            lg={12}
            extra={<a onClick={() => navigate('/apps/haoligo/equipment/reports/maintenance-plan')}>查看全部</a>}
          >
            <Table
              dataSource={equipmentMaintenanceAlertData}
              columns={equipmentMaintenanceAlertColumns}
              rowKey="id"
              pagination={false}
              size="middle"
              locale={{
                emptyText: (
                  <Space direction="vertical" size={4}>
                    <Text type="secondary">{formatMaintenanceEmptySummary(equipmentMaintenanceSummary)}</Text>
                    {canReadEquipmentMaintenancePlan ? (
                      <a onClick={() => navigate('/apps/haoligo/equipment/reports/maintenance-plan')}>查看全部</a>
                    ) : null}
                  </Space>
                ),
              }}
              tableLayout="fixed"
            />
          </ModuleActionPanel>
          <ModuleActionPanel
            title="模具保养预警"
            lg={12}
            extra={<a onClick={() => navigate('/apps/haoligo/molds/reports/maintenance-alert')}>查看全部</a>}
          >
            <Table
              dataSource={moldMaintenanceAlertData}
              columns={moldMaintenanceAlertColumns}
              rowKey="id"
              pagination={false}
              size="middle"
              locale={{
                emptyText: (
                  <Space direction="vertical" size={4}>
                    <Text type="secondary">{formatMoldMaintenanceEmptySummary(moldMaintenanceSummary)}</Text>
                    {canReadMaintenanceAlert ? (
                      <a onClick={() => navigate('/apps/haoligo/molds/reports/maintenance-alert')}>查看全部</a>
                    ) : null}
                  </Space>
                ),
              }}
              tableLayout="fixed"
            />
          </ModuleActionPanel>
        </>
      }
      chartRow={
        <ModuleChartRow>
          <ModuleChartPanel title="设备综合运行状态" lg={12} height={320}>
            {eqStatusData.some((d) => d.value > 0) ? (
              <div style={pieChartShellStyle}>
                <Pie {...buildDonutPieConfig(eqStatusData, EQUIPMENT_STATUS_LABEL_CHART_COLORS, EQUIPMENT_STATUS_LABEL_ORDER)} />
              </div>
            ) : (
              <div style={chartBodyShellStyle}>
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无数据" />
              </div>
            )}
          </ModuleChartPanel>
          <ModuleChartPanel title="近七日巡查隐患上报" lg={12} height={320}>
            {hazardTrendLoading ? (
              <div style={chartBodyShellStyle}>
                <Spin />
              </div>
            ) : hazardTrendData.some((d) => d.count > 0) ? (
              <div style={pieChartShellStyle}>
                <Column {...hazardTrendConfig} />
              </div>
            ) : (
              <div style={chartBodyShellStyle}>
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无数据" />
              </div>
            )}
          </ModuleChartPanel>
        </ModuleChartRow>
      }
    />
  );
};

export default WorkspacePage;
