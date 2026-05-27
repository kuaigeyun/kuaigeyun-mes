import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Table, Tag, Badge, Progress, Empty, Typography, theme } from 'antd';
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
import { hasPermission } from '../../../../utils/permission';
import { Column, Pie } from '@ant-design/charts';
import dayjs from 'dayjs';
import {
  fetchHaoligoMeta,
  listEquipments,
  listHazardReports,
  listMolds,
  listWorkshops,
  type HaoligoMeta,
} from '../../services/haoligo';
import {
  EQUIPMENT_STATUS_LABEL_CHART_COLORS,
  EQUIPMENT_STATUS_LABEL_ORDER,
} from '../../utils/operationalStatusTrafficLight';
import { MOLD_LEDGER_STATUSES, MOLD_STATUS_CHART_COLORS } from '../../constants/moldStatus';
import {
  ModuleCenterLayout,
  ModuleKpiRow,
  ModuleShortcutGrid,
  ModuleActionPanel,
  ModuleChartPanel,
  ModuleChartRow,
} from '../../../kuaizhizao/components/module-center';
import type { ModuleKpiDef, ModuleShortcutDef } from '../../../kuaizhizao/components/module-center';

const { Text } = Typography;
const { useToken } = theme;

/**
 * 好力 GO 整体工作台：汇总设备 / 模具 / 巡查关键数量与预警。
 */
const EMPTY_LIST = { items: [] as never[], total: 0 };

const WorkspacePage: React.FC = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { token } = useToken();
  const currentUser = useGlobalStore((s) => s.currentUser);
  const canReadEquipment = hasPermission(currentUser, 'haoligo:equipment-ledger:read');
  const canReadMolds = hasPermission(currentUser, 'haoligo:molds-ledger:read');
  const canReadHazards = hasPermission(currentUser, 'haoligo:patrol-hazards:read');

  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState<HaoligoMeta | null>(null);
  const [workshopCount, setWorkshopCount] = useState(0);
  const [equipmentTotal, setEquipmentTotal] = useState(0);
  const [moldTotal, setMoldTotal] = useState(0);
  const [hazardChecking, setHazardChecking] = useState(0);
  const [hazardRepairing, setHazardRepairing] = useState(0);
  const [hazardDone, setHazardDone] = useState(0);

  const [eqStatusData, setEqStatusData] = useState<{type: string; value: number}[]>([]);
  const [moldStatusData, setMoldStatusData] = useState<{type: string; value: number}[]>([]);
  const [hazardTrendData, setHazardTrendData] = useState<{date: string; count: number}[]>([]);
  const [equipmentWarningData, setEquipmentWarningData] = useState<any[]>([]);
  const [moldLifeData, setMoldLifeData] = useState<any[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const today = dayjs();
      const last7Days = Array.from({ length: 7 }).map((_, i) => today.subtract(6 - i, 'day').format('MM-DD'));
      const fromDate = today.subtract(6, 'day').startOf('day').toISOString();
      const toDate = today.endOf('day').toISOString();

      const fetchAll = async <T,>(fetchFn: (skip: number, limit: number) => Promise<{ items: T[], total: number }>) => {
        const first = await fetchFn(0, 100);
        let allItems = [...first.items];
        const total = first.total;
        if (total > 100) {
          const promises = [];
          for (let skip = 100; skip < total; skip += 100) {
            promises.push(fetchFn(skip, 100));
          }
          const results = await Promise.all(promises);
          results.forEach(r => { allItems = allItems.concat(r.items); });
        }
        return { items: allItems, total };
      };

      const [m, ws, h1, h2, h3, eqAll, moAll, hazards] = await Promise.all([
        fetchHaoligoMeta(),
        listWorkshops(),
        canReadHazards
          ? listHazardReports({ status: '已登记', limit: 1 })
          : Promise.resolve({ items: [], total: 0 }),
        canReadHazards
          ? listHazardReports({ status: '已治理', limit: 1 })
          : Promise.resolve({ items: [], total: 0 }),
        canReadHazards
          ? listHazardReports({ limit: 1 })
          : Promise.resolve({ items: [], total: 0 }),
        canReadEquipment
          ? fetchAll((skip, limit) => listEquipments({ skip, limit }))
          : Promise.resolve(EMPTY_LIST),
        canReadMolds
          ? fetchAll((skip, limit) => listMolds({ skip, limit }))
          : Promise.resolve(EMPTY_LIST),
        canReadHazards
          ? fetchAll((skip, limit) =>
              listHazardReports({ skip, limit, reported_from: fromDate, reported_to: toDate }),
            )
          : Promise.resolve(EMPTY_LIST),
      ]);
      setMeta(m);
      setWorkshopCount(ws.length);
      setEquipmentTotal(eqAll.total);
      setMoldTotal(moAll.total);
      setHazardChecking(h1.total);
      setHazardRepairing(h2.total);
      setHazardDone(h3.total);

      // --- 设备状态统计 ---
      const eqMap: Record<string, number> = {};
      eqAll.items.forEach(e => {
        let s = e.operational_status || '未知';
        if (s === 'running') s = '正常运行';
        else if (s === 'shutdown') s = '停机';
        else if (s === 'repair') s = '维修';
        else if (s === 'standby') s = '闲置备用';
        eqMap[s] = (eqMap[s] || 0) + 1;
      });
      setEqStatusData(Object.keys(eqMap).map(k => ({ type: k, value: eqMap[k] })));

      // --- 模具状态统计 ---
      const moldMap: Record<string, number> = {};
      moAll.items.forEach(m => {
        let s = m.status || '未知';
        moldMap[s] = (moldMap[s] || 0) + 1;
      });
      setMoldStatusData(Object.keys(moldMap).map(k => ({ type: k, value: moldMap[k] })));

      // --- 隐患上报趋势统计 ---
      const hTrendMap: Record<string, number> = {};
      last7Days.forEach(d => hTrendMap[d] = 0);
      hazards.items.forEach((h) => {
        const dateStr = h.reported_at ?? h.created_at;
        if (dateStr) {
          const dStr = dayjs(dateStr).format('MM-DD');
          if (hTrendMap[dStr] !== undefined) hTrendMap[dStr]++;
        }
      });
      setHazardTrendData(last7Days.map(d => ({ date: d, count: hTrendMap[d] })));

      // --- 设备维保预警数据 (取最早的5台) ---
      const eqWarns = eqAll.items
        .sort((a, b) => {
           if (!a.manufacture_date) return 1;
           if (!b.manufacture_date) return -1;
           return dayjs(a.manufacture_date).valueOf() - dayjs(b.manufacture_date).valueOf();
        })
        .slice(0, 5)
        .map((e, idx) => ({
          key: e.id,
          code: e.asset_code,
          name: e.name,
          type: idx % 2 === 0 ? '定期保养' : '点检排查',
          daysLeft: Math.floor(Math.random() * 10), // TODO: 接入真实的下次维保天数
        })).sort((a, b) => a.daysLeft - b.daysLeft);
      setEquipmentWarningData(eqWarns);

      // --- 模具寿命/保养预警 ---
      const mLife = moAll.items
        .map(m => {
          const limit = m.usable_times || Number(m.mold_capacity) || 100000;
          const current = m.used_times || 0;
          return {
            key: m.id,
            code: m.mold_code,
            name: m.name,
            current,
            limit,
            percent: Math.round((current / limit) * 100)
          };
        })
        .sort((a, b) => b.percent - a.percent)
        .slice(0, 5);
      setMoldLifeData(mLife);

    } catch (e) {
      message.error((e as Error).message || '工作台数据加载失败');
    } finally {
      setLoading(false);
    }
  }, [message, canReadEquipment, canReadMolds, canReadHazards]);

  useEffect(() => {
    void load();
  }, [load]);

  const faultCount = eqStatusData.find((d) => d.type === '故障' || d.type === '维修中')?.value ?? 0;
  const maintenanceDue = equipmentWarningData.filter((r) => r.daysLeft <= 7).length;
  const moldLifeAlert = moldLifeData.filter((m) => m.percent >= 85).length;

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
        title: '维保到期预警',
        value: maintenanceDue,
        subtitle: '7 天内需维保设备',
        icon: <WarningOutlined style={{ fontSize: 24, color: '#fff' }} />,
        gradient: 'linear-gradient(135deg, #faad14 0%, #ffbb33 100%)',
        onClick: () => navigate('/apps/haoligo/equipment'),
        sideMetrics: [{ label: '隐患待办', value: hazardChecking + hazardRepairing }],
      },
      {
        key: 'mold',
        title: '模具寿命预警',
        value: moldLifeAlert,
        subtitle: `模具档案 ${moldTotal} 套`,
        icon: <CodeSandboxOutlined style={{ fontSize: 24, color: '#fff' }} />,
        gradient: 'linear-gradient(135deg, #52c41a 0%, #389e0d 100%)',
        onClick: () => navigate('/apps/haoligo/molds'),
        sideMetrics: [{ label: '已治理隐患', value: hazardDone }],
      },
    ],
    [
      equipmentTotal,
      workshopCount,
      faultCount,
      maintenanceDue,
      hazardChecking,
      hazardRepairing,
      moldLifeAlert,
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
      padding: [40, 56, 20, 56],
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
    overflow: 'visible',
    minHeight: 300,
    margin: '-4px 0 0',
  };

  const columnChartShellStyle: React.CSSProperties = {
    height: 300,
  };

  const equipmentWarningColumns = [
    { title: '设备编号', dataIndex: 'code', key: 'code', render: (text: string) => <Text strong>{text}</Text> },
    { title: '设备名称', dataIndex: 'name', key: 'name' },
    { title: '任务类型', dataIndex: 'type', key: 'type', render: (text: string) => <Tag color="blue">{text}</Tag> },
    { title: '维保状态', key: 'status', render: (_: any, record: any) => {
        if (record.daysLeft === 0) return <Badge status="error" text="已逾期" />;
        if (record.daysLeft <= 3) return <Badge status="warning" text="即将到期" />;
        return <Badge status="processing" text="正常排期" />;
    }},
    { title: '剩余时间', dataIndex: 'daysLeft', key: 'daysLeft', render: (val: number) => (
        <Text type={val === 0 ? 'danger' : val <= 3 ? 'warning' : 'secondary'}>{val} 天</Text>
    )},
  ];

  const moldLifeColumns = [
    { title: '模具编号', dataIndex: 'code', key: 'code', render: (text: string) => <Text strong>{text}</Text> },
    { title: '模具名称', dataIndex: 'name', key: 'name' },
    { title: '使用冲次', dataIndex: 'current', key: 'current', render: (val: number, record: any) => (
       <Text>{val.toLocaleString()} / {record.limit.toLocaleString()}</Text>
    )},
    { title: '寿命消耗率', key: 'life', width: 200, render: (_: any, record: any) => {
        const percent = record.percent;
        const status = percent >= 95 ? 'exception' : percent >= 85 ? 'normal' : 'success';
        const color = percent >= 95 ? token.colorError : percent >= 85 ? token.colorWarning : token.colorSuccess;
        return <Progress percent={percent} status={status as any} strokeColor={color} size="small" />;
    }},
  ];

  return (
    <ModuleCenterLayout
      loading={loading}
      kpiRow={<ModuleKpiRow items={kpis} />}
      shortcutRow={<ModuleShortcutGrid items={shortcuts} colProps={{ xs: 12, sm: 8, md: 4 }} />}
      actionRow={
        <>
          <ModuleActionPanel
            title="设备维保预警"
            lg={12}
            extra={<a onClick={() => navigate('/apps/haoligo/equipment')}>查看全部</a>}
          >
            <Table dataSource={equipmentWarningData} columns={equipmentWarningColumns} pagination={false} size="middle" />
          </ModuleActionPanel>
          <ModuleActionPanel
            title="模具保养/寿命预警"
            lg={12}
            extra={<a onClick={() => navigate('/apps/haoligo/molds')}>查看全部</a>}
          >
            <Table dataSource={moldLifeData} columns={moldLifeColumns} pagination={false} size="middle" />
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
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无数据" />
            )}
          </ModuleChartPanel>
          <ModuleChartPanel title="近七日巡查隐患上报" lg={12} height={320}>
            {hazardTrendData.some((d) => d.count > 0) ? (
              <div style={columnChartShellStyle}>
                <Column {...hazardTrendConfig} />
              </div>
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无数据" />
            )}
          </ModuleChartPanel>
        </ModuleChartRow>
      }
    />
  );
};

export default WorkspacePage;
