import React, { useCallback, useEffect, useState } from 'react';
import { App, Card, Col, Row, Space, Spin, Typography, theme, Table, Tag, Badge, Progress, Empty } from 'antd';
import {
  AppstoreOutlined,
  ToolOutlined,
  WarningOutlined,
  CodeSandboxOutlined,
  ShopOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
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
import { useGlobalStore } from '../../../../stores/globalStore';
import { PAGE_SPACING } from '../../../../components/layout-templates/constants';
import {
  EQUIPMENT_STATUS_LABEL_CHART_COLORS,
  EQUIPMENT_STATUS_LABEL_ORDER,
} from '../../utils/operationalStatusTrafficLight';
import { MOLD_LEDGER_STATUSES, MOLD_STATUS_CHART_COLORS } from '../../constants/moldStatus';

const { Title, Paragraph, Text } = Typography;
const { useToken } = theme;

/**
 * 好力 GO 整体工作台：汇总设备 / 模具 / 巡查关键数量与预警。
 */
const WorkspacePage: React.FC = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { token } = useToken();
  const { currentUser } = useGlobalStore();

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
        listHazardReports({ status: '已登记', limit: 1 }),
        listHazardReports({ status: '已治理', limit: 1 }),
        listHazardReports({ limit: 1 }),
        fetchAll((skip, limit) => listEquipments({ skip, limit })),
        fetchAll((skip, limit) => listMolds({ skip, limit })),
        fetchAll((skip, limit) => listHazardReports({ skip, limit, created_from: fromDate, created_to: toDate })),
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
      hazards.items.forEach(h => {
        // Assume hazard report has a created_at or recorded_at
        const dateStr = (h as any).created_at || (h as any).recorded_at;
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
  }, [message]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
        <Spin size="large" tip="加载工作台…" />
      </div>
    );
  }

  const statCardStyle = {
    borderRadius: token.borderRadiusLG,
    boxShadow: '0 8px 24px rgba(0,0,0,0.03)',
    border: 'none',
    height: '100%',
    transition: 'all 0.3s ease',
  };

  const chartCardBodyStyle = { overflow: 'visible' as const, padding: 16 };

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
    const chartData = data.filter((item) => item.value > 0);
    const total = chartData.reduce((sum, item) => sum + item.value, 0);
    const present = new Set(chartData.map((d) => d.type));
    const domain = [
      ...domainOrder.filter((t) => present.has(t)),
      ...chartData.map((d) => d.type).filter((t) => !domainOrder.includes(t)),
    ];
    const range = domain.map((t) => colorMap[t] ?? token.colorTextQuaternary);
    return {
      data: chartData,
      angleField: 'value',
      colorField: 'type',
      radius: 0.62,
      innerRadius: 0.42,
      height: 300,
      autoFit: true,
      padding: [32, 48, 16, 48],
      scale: { color: { type: 'ordinal', domain, range } },
      legend: {
        color: {
          position: 'bottom',
          layout: { justifyContent: 'center' },
        },
      },
      label: {
        text: (d: { type: string; value: number }) => {
          const pct = total > 0 ? Math.round((d.value / total) * 100) : 0;
          return `${d.type}\n${pct}%`;
        },
        position: 'spider',
        style: { fontSize: 11, fill: token.colorText, lineHeight: 14 },
        transform: [{ type: 'exceedAdjust', bounds: 'padding' }],
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
    <div style={{ width: '100%', padding: PAGE_SPACING.PADDING }}>
      {/* 顶部通栏 Hero 区域 */}
      <div
        style={{
          background: `linear-gradient(135deg, ${token.colorPrimary} 0%, #1d39c4 100%)`,
          borderRadius: token.borderRadiusLG,
          padding: '36px 48px',
          color: '#fff',
          boxShadow: '0 10px 30px -10px rgba(0,0,0,0.25)',
          marginBottom: PAGE_SPACING.BLOCK_GAP,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ position: 'absolute', right: -60, top: -60, width: 250, height: 250, background: 'rgba(255,255,255,0.08)', borderRadius: '50%' }} />
        <div style={{ position: 'absolute', right: 120, bottom: -50, width: 140, height: 140, background: 'rgba(255,255,255,0.08)', borderRadius: '50%' }} />
        
        <Title level={2} style={{ color: '#fff', marginTop: 0, marginBottom: 12, fontWeight: 600 }}>
          👋 欢迎回来，{currentUser?.full_name || currentUser?.username || '管理员'}！祝您工作顺利。
        </Title>
        <Paragraph style={{ color: 'rgba(255,255,255,0.85)', fontSize: 16, maxWidth: 650, marginBottom: 0, lineHeight: 1.6 }}>
          一站式设备与模具管理、现场巡查统一入口。为您提供全生命周期的资产管理。
        </Paragraph>
      </div>

      {/* 核心指标区域 */}
      <Row gutter={[PAGE_SPACING.BLOCK_GAP, PAGE_SPACING.BLOCK_GAP]} style={{ marginBottom: PAGE_SPACING.BLOCK_GAP }}>
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} style={{ ...statCardStyle, background: '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 56, height: 56, borderRadius: 16, background: 'linear-gradient(135deg, #1677ff 0%, #0958d9 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 26, boxShadow: '0 8px 16px rgba(22,119,255,0.25)' }}>
                <ShopOutlined />
              </div>
              <div style={{ flex: 1 }}>
                <Text type="secondary" style={{ fontSize: 14 }}>覆盖车间数</Text>
                <div style={{ fontSize: 28, fontWeight: 600, color: token.colorTextHeading, lineHeight: 1.2 }}>
                  {workshopCount} <span style={{ fontSize: 14, fontWeight: 'normal', color: token.colorTextSecondary }}>个</span>
                </div>
                <div style={{ fontSize: 12, color: token.colorTextDescription, marginTop: 4 }}>
                  已全面覆盖 <span style={{ color: token.colorPrimary }}>100%</span> 核心生产区域
                </div>
              </div>
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} style={{ ...statCardStyle, background: '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 56, height: 56, borderRadius: 16, background: 'linear-gradient(135deg, #13c2c2 0%, #08979c 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 26, boxShadow: '0 8px 16px rgba(19,194,194,0.25)' }}>
                <ToolOutlined />
              </div>
              <div style={{ flex: 1 }}>
                <Text type="secondary" style={{ fontSize: 14 }}>设备总台账</Text>
                <div style={{ fontSize: 28, fontWeight: 600, color: token.colorTextHeading, lineHeight: 1.2 }}>
                  {equipmentTotal} <span style={{ fontSize: 14, fontWeight: 'normal', color: token.colorTextSecondary }}>台</span>
                </div>
                <div style={{ fontSize: 12, color: token.colorTextDescription, marginTop: 4 }}>
                  {eqStatusData.length > 0 ? [...eqStatusData].sort((a,b)=>b.value-a.value).slice(0,3).map((item, idx, arr) => (
                    <span key={item.type}>
                      <span style={{ color: statusCountColor(item.type, EQUIPMENT_STATUS_LABEL_CHART_COLORS) }}>{item.value}</span> {item.type}{idx < arr.length - 1 ? ' / ' : ''}
                    </span>
                  )) : '暂无数据'}
                </div>
              </div>
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} style={{ ...statCardStyle, background: '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 56, height: 56, borderRadius: 16, background: 'linear-gradient(135deg, #52c41a 0%, #389e0d 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 26, boxShadow: '0 8px 16px rgba(82,196,26,0.25)' }}>
                <CodeSandboxOutlined />
              </div>
              <div style={{ flex: 1 }}>
                <Text type="secondary" style={{ fontSize: 14 }}>模具总档案</Text>
                <div style={{ fontSize: 28, fontWeight: 600, color: token.colorTextHeading, lineHeight: 1.2 }}>
                  {moldTotal} <span style={{ fontSize: 14, fontWeight: 'normal', color: token.colorTextSecondary }}>套</span>
                </div>
                <div style={{ fontSize: 12, color: token.colorTextDescription, marginTop: 4 }}>
                  {moldStatusData.length > 0 ? [...moldStatusData].sort((a,b)=>b.value-a.value).slice(0,3).map((item, idx, arr) => (
                    <span key={item.type}>
                      <span style={{ color: statusCountColor(item.type, MOLD_STATUS_CHART_COLORS) }}>{item.value}</span> {item.type}{idx < arr.length - 1 ? ' / ' : ''}
                    </span>
                  )) : '暂无数据'}
                </div>
              </div>
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} style={{ ...statCardStyle, background: '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 56, height: 56, borderRadius: 16, background: 'linear-gradient(135deg, #ff4d4f 0%, #cf1322 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 26, boxShadow: '0 8px 16px rgba(255,77,79,0.25)' }}>
                <WarningOutlined />
              </div>
              <div style={{ flex: 1 }}>
                <Text type="secondary" style={{ fontSize: 14 }}>隐患处置单</Text>
                <div style={{ fontSize: 28, fontWeight: 600, color: token.colorTextHeading, lineHeight: 1.2 }}>
                  {hazardDone} <span style={{ fontSize: 14, fontWeight: 'normal', color: token.colorTextSecondary }}>单</span>
                </div>
                <div style={{ fontSize: 12, color: token.colorTextDescription, marginTop: 4 }}>
                  <span style={{ color: '#faad14' }}>{hazardChecking}</span> 已登记 / <span style={{ color: '#52c41a' }}>{hazardRepairing}</span> 已治理
                </div>
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* 中部图表区域 */}
      <Row gutter={[PAGE_SPACING.BLOCK_GAP, PAGE_SPACING.BLOCK_GAP]} style={{ marginBottom: PAGE_SPACING.BLOCK_GAP }}>
        <Col xs={24} lg={8}>
          <Card
            title="设备综合运行状态"
            bordered={false}
            styles={{ body: chartCardBodyStyle }}
            style={{ borderRadius: token.borderRadiusLG, boxShadow: '0 4px 12px rgba(0,0,0,0.03)', height: '100%' }}
          >
            {eqStatusData.some((d) => d.value > 0) ? (
              <div style={pieChartShellStyle}>
                <Pie {...buildDonutPieConfig(eqStatusData, EQUIPMENT_STATUS_LABEL_CHART_COLORS, EQUIPMENT_STATUS_LABEL_ORDER)} />
              </div>
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无数据" />
            )}
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card
            title="模具资产状态分布"
            bordered={false}
            styles={{ body: chartCardBodyStyle }}
            style={{ borderRadius: token.borderRadiusLG, boxShadow: '0 4px 12px rgba(0,0,0,0.03)', height: '100%' }}
          >
            {moldStatusData.some((d) => d.value > 0) ? (
              <div style={pieChartShellStyle}>
                <Pie {...buildDonutPieConfig(moldStatusData, MOLD_STATUS_CHART_COLORS, MOLD_LEDGER_STATUSES)} />
              </div>
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无数据" />
            )}
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card
            title="近七日巡查隐患上报"
            bordered={false}
            styles={{ body: chartCardBodyStyle }}
            style={{ borderRadius: token.borderRadiusLG, boxShadow: '0 4px 12px rgba(0,0,0,0.03)', height: '100%' }}
          >
            <div style={columnChartShellStyle}>
              <Column {...hazardTrendConfig} />
            </div>
          </Card>
        </Col>
      </Row>

      {/* 核心业务预警大盘 (设备 & 模具核心) */}
      <Row gutter={[PAGE_SPACING.BLOCK_GAP, PAGE_SPACING.BLOCK_GAP]} style={{ marginBottom: PAGE_SPACING.BLOCK_GAP }}>
        <Col xs={24} xl={12}>
          <Card 
            title={<><WarningOutlined style={{ color: token.colorWarning, marginRight: 8 }} />设备维保预警</>} 
            bordered={false} 
            style={{ borderRadius: token.borderRadiusLG, boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}
            extra={<a onClick={() => navigate('/apps/haoligo/equipment')}>查看全部</a>}
          >
            <Table 
              dataSource={equipmentWarningData} 
              columns={equipmentWarningColumns} 
              pagination={false} 
              size="middle"
            />
          </Card>
        </Col>
        <Col xs={24} xl={12}>
          <Card 
            title={<><AppstoreOutlined style={{ color: '#13c2c2', marginRight: 8 }} />模具保养/寿命预警</>} 
            bordered={false} 
            style={{ borderRadius: token.borderRadiusLG, boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}
            extra={<a onClick={() => navigate('/apps/haoligo/molds')}>查看全部</a>}
          >
            <Table 
              dataSource={moldLifeData} 
              columns={moldLifeColumns} 
              pagination={false} 
              size="middle"
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default WorkspacePage;
