import React, { useState } from 'react';
import { 
  Card, Row, Col, Progress, Table, Tag, Typography, Space, Spin, Empty, 
  Button, Drawer, Form, Select, InputNumber, DatePicker, message, 
  theme, Modal, List, Divider, notification, Alert, Tabs, Badge
} from 'antd';
import { useRequest } from 'ahooks';
import {
  RocketOutlined,
  AlertOutlined,
  CheckCircleOutlined,
  DashboardOutlined,
  AppstoreOutlined,
  SafetyOutlined,
  ToolOutlined,
  AuditOutlined,
  ScheduleOutlined,
  PlayCircleOutlined,
  ThunderboltOutlined,
  FireOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../../../../../services/api';
import dayjs from 'dayjs';
import { Column } from '@ant-design/charts';
import { SimulationSchedulingScorePreview } from '../../../../../components/SimulationSchedulingScorePreview';

const { Text } = Typography;

const renderPickingScoreTag = (v: number | null | undefined, row: { picking_rank_band?: string | null }) =>
  v != null ? (
    <Tag
      color={row.picking_rank_band === 'A' ? 'red' : row.picking_rank_band === 'B' ? 'orange' : 'default'}
      style={{ margin: 0 }}
    >
      {Number(v).toFixed(0)}
      {row.picking_rank_band ? `·${row.picking_rank_band}` : ''}
    </Tag>
  ) : (
    '-'
  );

type SummaryShape = {
  material_readiness: any[];
  resource_load: any[];
  delivery_risks: any[];
  total_wip_count: number;
  total_risk_count: number;
  stats?: {
    total_count: number;
    pending_review_count: number;
    executed_count: number;
    overdue_plans_count: number;
  }
};

const ProductionControlTower: React.FC = () => {
  const navigate = useNavigate();
  const { token } = theme.useToken();
  const [form] = Form.useForm();

  // 状态管理
  const [simulationVisible, setSimulationVisible] = useState(false);
  const [simulateLoading, setSimulateLoading] = useState(false);
  const [simulationResult, setSimulationResult] = useState<any>(null);
  const [materials, setMaterials] = useState<any[]>([]);
  const [materialsLoading, setMaterialsLoading] = useState(false);
  const [releasing, setReleasing] = useState(false);

  const { data: summary, loading, refresh: refreshSummary } = useRequest(async () => {
    return apiRequest('/apps/kuaizhizao/production-control/summary');
  }, {
    pollingInterval: 30000,
  });

  const s = summary as SummaryShape | undefined;

  const readinessList = s?.material_readiness || [];
  const risks = s?.delivery_risks || [];
  
  // 获取待协调缺料物料异常记录
  const { data: shortagesData, loading: shortagesLoading, refresh: refreshShortages } = useRequest(async () => {
    return apiRequest('/apps/kuaizhizao/exceptions/material-shortage?status=pending');
  });
  const shortages = shortagesData || [];
  const delayedCount = risks.filter((r: any) => r.risk_type === 'delayed').length;
  const avgReadiness =
    readinessList.length > 0
      ? Number(
          (readinessList.reduce((acc: number, cur: any) => acc + (cur.readiness_rate ?? 0), 0) / readinessList.length).toFixed(1)
        )
      : 100;
  const notFullyKitted = readinessList.filter((r: any) => (r.readiness_rate ?? 0) < 100).length;

  // 获取物料列表用于插单下拉选择
  const fetchMaterials = async () => {
    try {
      setMaterialsLoading(true);
      const res = await apiRequest('/apps/master-data/materials');
      if (Array.isArray(res)) {
        setMaterials(res);
      } else if (res && Array.isArray(res.items)) {
        setMaterials(res.items);
      } else if (res && typeof res === 'object') {
        const possibleArray = Object.values(res).find(val => Array.isArray(val));
        if (possibleArray) setMaterials(possibleArray);
      }
    } catch (err) {
      console.error("Failed to load materials", err);
    } finally {
      setMaterialsLoading(false);
    }
  };

  // 一键自动下达齐套工单
  const handleAutoRelease = () => {
    Modal.confirm({
      title: '确认自动下达齐套工单？',
      icon: <PlayCircleOutlined style={{ color: '#52c41a' }} />,
      content: '系统将扫描所有“草稿”状态的工单，若分析其物料完全齐套，将直接下达为“待执行”状态。',
      okText: '立即下达',
      cancelText: '取消',
      onOk: async () => {
        try {
          setReleasing(true);
          const res = await apiRequest('/apps/kuaizhizao/production-control/release-kitted', {
            method: 'POST',
            data: { work_order_ids: [] }
          });
          const successCount = res?.count ?? 0;
          if (successCount > 0) {
            notification.success({
              message: '自动下达完成',
              description: `成功下达了 ${successCount} 个齐套工单。`,
              duration: 4.5,
            });
          } else {
            notification.info({
              message: '下达结果',
              description: '当前未发现符合完全齐套条件的“草稿”状态工单。',
            });
          }
          refreshSummary();
        } catch (err: any) {
          message.error(err?.message || "下达请求失败");
        } finally {
          setReleasing(false);
        }
      }
    });
  };

  // 提交插单模拟
  const handleSimulate = async (values: any) => {
    try {
      setSimulateLoading(true);
      const res = await apiRequest('/apps/kuaizhizao/production-control/simulate-impact', {
        method: 'POST',
        data: {
          product_id: values.product_id,
          quantity: values.quantity,
          planned_start_date: values.dates[0].toISOString(),
          planned_end_date: values.dates[1].toISOString(),
          priority: "urgent"
        }
      });
      setSimulationResult(res);
    } catch (err: any) {
      message.error(err?.message || "模拟计算失败");
    } finally {
      setSimulateLoading(false);
    }
  };

  const kpiCardBodyStyle: React.CSSProperties = {
    padding: '16px 20px',
    minHeight: 140,
    display: 'flex',
    alignItems: 'center',
  };

  const kpiSideBlock = (items: { label: string; value: string | number }[]) => (
    <div style={{
      marginLeft: 'auto',
      paddingLeft: 20,
      borderLeft: '1px solid rgba(255, 255, 255, 0.2)',
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      minWidth: 100
    }}>
      {items.map((it, idx) => (
        <div key={idx}>
          <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.7)', marginBottom: 2 }}>{it.label}</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#fff' }}>{it.value}</div>
        </div>
      ))}
    </div>
  );

  const shortcuts = [
    {
      title: '需求运算',
      icon: <RocketOutlined style={{ fontSize: 20, color: '#1890ff' }} />,
      path: '/apps/kuaizhizao/plan-management/demand-computation',
    },
    {
      title: '主生产排程',
      icon: <AppstoreOutlined style={{ fontSize: 20, color: '#fa8c16' }} />,
      path: '/apps/kuaizhizao/plan-management/scheduling',
    },
    {
      title: '生产计划',
      icon: <ScheduleOutlined style={{ fontSize: 20, color: '#722ed1' }} />,
      path: '/apps/kuaizhizao/plan-management/production-plans',
    },
    {
      title: '工单下放',
      icon: <SafetyOutlined style={{ fontSize: 20, color: '#52c41a' }} />,
      path: '/apps/kuaizhizao/production-execution/work-orders',
    },
    {
      title: '缺料预警',
      icon: <AlertOutlined style={{ fontSize: 20, color: '#ff4d4f' }} />,
      path: '/apps/kuaizhizao/plan-management/reports/material-shortage-alert',
    },
    {
      title: '报工看板',
      icon: <DashboardOutlined style={{ fontSize: 20, color: '#13c2c2' }} />,
      path: '/apps/kuaizhizao/production-execution/reporting',
    },
  ];

  return (
    <div style={{ padding: 0, overflow: 'visible' }}>
      <Spin spinning={loading && !s}>
        <Row gutter={[16, 16]}>
          
          {/* KPI 区 */}
          <Col span={24}>
            <Row gutter={[16, 16]} align="stretch">
              <Col xs={24} lg={8} style={{ display: 'flex' }}>
                <Card
                  hoverable
                  onClick={() => navigate('/apps/kuaizhizao/plan-management/production-plans')}
                  style={{
                    flex: 1,
                    width: '100%',
                    borderRadius: token.borderRadiusLG,
                    border: 'none',
                    background: 'linear-gradient(135deg, #1890ff 0%, #36cfc9 100%)',
                    boxShadow: '0 4px 12px rgba(24, 144, 255, 0.15)',
                  }}
                  styles={{ body: { ...kpiCardBodyStyle } }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 18, width: '100%' }}>
                    <div style={{
                      width: 48, height: 48, borderRadius: token.borderRadius,
                      background: 'rgba(255, 255, 255, 0.2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                    }}>
                      <AuditOutlined style={{ fontSize: 24, color: '#fff' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255, 255, 255, 0.9)' }}>生产计划总数</div>
                      <div style={{ fontSize: 30, fontWeight: 700, color: '#fff', lineHeight: 1.2, marginTop: 6 }}>
                        {s?.stats?.total_count ?? 0}
                      </div>
                      <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.72)', marginTop: 8 }}>
                        所有层级计划累计
                      </div>
                    </div>
                    {kpiSideBlock([
                      { label: '待审核', value: s?.stats?.pending_review_count ?? 0 },
                      { label: '已下达', value: s?.stats?.executed_count ?? 0 },
                    ])}
                  </div>
                </Card>
              </Col>

              <Col xs={24} lg={8} style={{ display: 'flex' }}>
                <Card
                  hoverable
                  style={{
                    flex: 1,
                    width: '100%',
                    borderRadius: token.borderRadiusLG,
                    border: 'none',
                    background: 'linear-gradient(135deg, #ff4d4f 0%, #ff7875 100%)',
                    boxShadow: '0 4px 12px rgba(255, 77, 79, 0.15)',
                  }}
                  styles={{ body: { ...kpiCardBodyStyle } }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 18, width: '100%' }}>
                    <div style={{
                      width: 48, height: 48, borderRadius: token.borderRadius,
                      background: 'rgba(255, 255, 255, 0.2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                    }}>
                      <AlertOutlined style={{ fontSize: 24, color: '#fff' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255, 255, 255, 0.9)' }}>交付风险预控</div>
                      <div style={{ fontSize: 30, fontWeight: 700, color: '#fff', lineHeight: 1.2, marginTop: 6 }}>
                        {s?.total_risk_count ?? 0}
                      </div>
                      <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.72)', marginTop: 8 }}>
                        含延期与产能瓶颈风险
                      </div>
                    </div>
                    {kpiSideBlock([
                      { label: '逾期计划', value: s?.stats?.overdue_plans_count ?? 0 },
                      { label: '延期单据', value: delayedCount },
                    ])}
                  </div>
                </Card>
              </Col>

              <Col xs={24} lg={8} style={{ display: 'flex' }}>
                <Card
                  hoverable
                  style={{
                    flex: 1,
                    width: '100%',
                    borderRadius: token.borderRadiusLG,
                    border: 'none',
                    background: 'linear-gradient(135deg, #52c41a 0%, #95de64 100%)',
                    boxShadow: '0 4px 12px rgba(82, 196, 26, 0.15)',
                  }}
                  styles={{ body: { ...kpiCardBodyStyle } }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 18, width: '100%' }}>
                    <div style={{
                      width: 48, height: 48, borderRadius: token.borderRadius,
                      background: 'rgba(255, 255, 255, 0.2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                    }}>
                      <CheckCircleOutlined style={{ fontSize: 24, color: '#fff' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255, 255, 255, 0.9)' }}>平均齐套进度</div>
                      <div style={{ fontSize: 30, fontWeight: 700, color: '#fff', lineHeight: 1.2, marginTop: 6 }}>
                        {avgReadiness}%
                      </div>
                      <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.72)', marginTop: 8 }}>
                        在制工单 {s?.total_wip_count ?? 0} 个
                      </div>
                    </div>
                    {kpiSideBlock([
                      { label: '欠料工单', value: notFullyKitted },
                      { label: '预计齐套', value: Math.max(0, readinessList.length - notFullyKitted) },
                    ])}
                  </div>
                </Card>
              </Col>
            </Row>
          </Col>

          {/* 快捷按钮 (6 宫格) */}
          <Col span={24}>
            <Row gutter={[16, 16]}>
              {shortcuts.map((sc) => (
                <Col xs={12} sm={8} md={4} key={sc.title}>
                  <Card
                    hoverable
                    onClick={() => navigate(sc.path)}
                    styles={{ body: { padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 } }}
                    style={{ borderRadius: token.borderRadius }}
                  >
                    <div style={{
                      width: 40, height: 40, borderRadius: token.borderRadiusSM,
                      background: 'rgba(0,0,0,0.04)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {sc.icon}
                    </div>
                    <Text strong style={{ fontSize: 13 }}>{sc.title}</Text>
                  </Card>
                </Col>
              ))}
            </Row>
          </Col>

          {/* 业务台账区 */}
          <Col span={24}>
            <Card
              style={{ borderRadius: token.borderRadiusLG, border: 'none', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)' }}
              styles={{ body: { padding: '16px 24px' } }}
            >
              <Tabs
                defaultActiveKey="kitting"
                size="large"
                style={{ marginBottom: -8 }}
                items={[
                  {
                    key: 'kitting',
                    label: (
                      <Space>
                        <ToolOutlined style={{ color: token.colorPrimary }} />
                        <span style={{ fontWeight: 600 }}>物料齐套与缺料监控</span>
                      </Space>
                    ),
                    children: (
                      <Row gutter={[24, 16]} style={{ marginTop: 12 }}>
                        {/* 工单齐套监控 */}
                        <Col xs={24} lg={12}>
                          <div style={{
                            padding: '8px 12px',
                            background: 'rgba(0, 0, 0, 0.02)',
                            borderRadius: token.borderRadius,
                            fontWeight: 600,
                            fontSize: 13,
                            marginBottom: 12,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            border: '1px solid rgba(0, 0, 0, 0.03)'
                          }}>
                            <Badge status="processing" />
                            <span>工单齐套进度跟踪 (Top 10)</span>
                          </div>
                          <Table
                            size="small"
                            dataSource={readinessList.slice(0, 10)}
                            pagination={false}
                            rowKey="work_order_id"
                            bordered={false}
                            columns={[
                              { title: '工单', dataIndex: 'work_order_code', width: 120, ellipsis: true },
                              {
                                title: '备料分',
                                dataIndex: 'picking_score',
                                width: 88,
                                render: (v: number, row: any) => renderPickingScoreTag(v, row),
                              },
                              {
                                title: '计划开工',
                                dataIndex: 'planned_start_date',
                                width: 80,
                                render: (v) => v ? dayjs(v).format('MM-DD') : '-'
                              },
                              { 
                                title: '开工倒计时', 
                                dataIndex: 'planned_start_date', 
                                width: 100, 
                                render: (v) => {
                                  if (!v) return '-';
                                  const diffDays = dayjs(v).startOf('day').diff(dayjs().startOf('day'), 'day');
                                  if (diffDays < 0) return <span style={{ color: '#ff4d4f' }}>已开工</span>;
                                  if (diffDays === 0) return <span style={{ color: '#fa8c16', fontWeight: 'bold' }}>今天</span>;
                                  if (diffDays === 1) return <span style={{ color: '#fa8c16' }}>明天</span>;
                                  return <span>{diffDays} 天后</span>;
                                }
                              },
                              { title: '齐套率', dataIndex: 'readiness_rate', width: 100, render: (v) => <Progress percent={v} size="small" /> },
                              { 
                                title: '缺料', 
                                dataIndex: 'shortage_count', 
                                width: 70,
                                render: (count: number) => count > 0 ? <Tag color="error" style={{ margin: 0 }}>{count} 种</Tag> : <Badge status="success" text="齐套" />
                              }
                            ]}
                          />
                        </Col>

                        {/* 缺料预警明细 */}
                        <Col xs={24} lg={12}>
                          <div style={{
                            padding: '8px 12px',
                            background: 'rgba(0, 0, 0, 0.02)',
                            borderRadius: token.borderRadius,
                            fontWeight: 600,
                            fontSize: 13,
                            marginBottom: 12,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            border: '1px solid rgba(0, 0, 0, 0.03)'
                          }}>
                            <Badge status="error" />
                            <span>待协调缺料明细 (采购/替代跟进)</span>
                          </div>
                          <Table
                            size="small"
                            dataSource={shortages.slice(0, 10)}
                            loading={shortagesLoading}
                            pagination={false}
                            rowKey="id"
                            bordered={false}
                            locale={{ emptyText: <Empty style={{ padding: 40 }} description="暂无待协调缺料物料" /> }}
                            columns={[
                              { title: '工单', dataIndex: 'work_order_code', width: 100, ellipsis: true },
                              {
                                title: '备料分',
                                dataIndex: 'picking_score',
                                width: 88,
                                render: (v: number, row: any) => renderPickingScoreTag(v, row),
                              },
                              { title: '缺料物料', dataIndex: 'material_name', ellipsis: true },
                              { title: '物料编码', dataIndex: 'material_code', width: 100, ellipsis: true },
                              { 
                                title: '缺料量', 
                                dataIndex: 'shortage_quantity', 
                                width: 80, 
                                render: (v) => (
                                  <span style={{ color: '#ff4d4f', fontWeight: 600 }}>
                                    {v}
                                  </span>
                                ) 
                              },
                              { 
                                title: '预警', 
                                dataIndex: 'alert_level', 
                                width: 70,
                                render: (level: string) => {
                                  const colors: Record<string, string> = { critical: 'red', high: 'orange', medium: 'gold', low: 'blue' };
                                  const names: Record<string, string> = { critical: '紧急', high: '高', medium: '中', low: '低' };
                                  return <Tag color={colors[level] || 'blue'} style={{ border: 'none', margin: 0 }}>{names[level] || level}</Tag>;
                                }
                              },
                              { 
                                title: '建议行动', 
                                dataIndex: 'suggested_action', 
                                width: 80,
                                render: (action: string) => {
                                  const names: Record<string, string> = { purchase: '提报采购', substitute: '寻找替代', adjust: '调整计划' };
                                  return <Tag color="geekblue" style={{ border: 'none', margin: 0 }}>{names[action] || action}</Tag>;
                                }
                              }
                            ]}
                          />
                        </Col>
                      </Row>
                    )
                  },
                  {
                    key: 'risks',
                    label: (
                      <Space>
                        <AlertOutlined style={{ color: '#ff4d4f' }} />
                        <span style={{ fontWeight: 600 }}>交期风险与异常调度</span>
                      </Space>
                    ),
                    children: (
                      <Row gutter={[24, 16]} style={{ marginTop: 12 }}>
                        {/* 交期风险工单 */}
                        <Col xs={24} lg={12}>
                          <div style={{
                            padding: '8px 12px',
                            background: 'rgba(0, 0, 0, 0.02)',
                            borderRadius: token.borderRadius,
                            fontWeight: 600,
                            fontSize: 13,
                            marginBottom: 12,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            border: '1px solid rgba(0, 0, 0, 0.03)'
                          }}>
                            <Badge status="warning" />
                            <span>交付风险工单追踪</span>
                          </div>
                          <Table
                            size="small"
                            dataSource={risks.slice(0, 10)}
                            pagination={false}
                            rowKey="work_order_id"
                            bordered={false}
                            columns={[
                              { 
                                title: '风险级别', 
                                dataIndex: 'risk_type', 
                                width: 90, 
                                render: (v) => <Tag color={v === 'delayed' ? 'red' : 'orange'} style={{ border: 'none', margin: 0 }}>{v === 'delayed' ? '逾期' : '风险'}</Tag> 
                              },
                              { title: '工单编码', dataIndex: 'work_order_code', ellipsis: true },
                              { title: '产品名称', dataIndex: 'product_name', ellipsis: true },
                              {
                                title: '综合分',
                                dataIndex: 'scheduling_score',
                                width: 88,
                                render: (v: number, row: any) =>
                                  v != null ? (
                                    <Tag color={row.scheduling_rank_band === 'A' ? 'red' : row.scheduling_rank_band === 'B' ? 'orange' : 'default'}>
                                      {Number(v).toFixed(0)}{row.scheduling_rank_band ? `·${row.scheduling_rank_band}` : ''}
                                    </Tag>
                                  ) : (
                                    '-'
                                  ),
                              },
                              { 
                                title: '计划完工', 
                                dataIndex: 'planned_end_date', 
                                width: 110, 
                                render: (v) => v ? dayjs(v).format('YYYY-MM-DD') : '-' 
                              },
                            ]}
                            locale={{ emptyText: <Empty style={{ padding: 40 }} description="当前暂无交期风险" /> }}
                          />
                        </Col>

                        {/* 延迟/调整分析建议 */}
                        <Col xs={24} lg={12}>
                          <div style={{
                            padding: '8px 12px',
                            background: 'rgba(0, 0, 0, 0.02)',
                            borderRadius: token.borderRadius,
                            fontWeight: 600,
                            fontSize: 13,
                            marginBottom: 12,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            border: '1px solid rgba(0, 0, 0, 0.03)'
                          }}>
                            <Badge status="default" />
                            <span>智能排产调度建议</span>
                          </div>
                          <List
                            size="small"
                            bordered={false}
                            dataSource={
                              risks.length > 0 
                                ? risks.slice(0, 5).map((r: any) => ({
                                    title: `工单 ${r.work_order_code} 风险提示`,
                                    desc: r.risk_desc || `交付时间与实际计划有冲突，建议立即点击快捷菜单进入【智能排产】进行产能平衡与重新排定。`
                                  }))
                                : [
                                    { title: '生产计划执行状态良好', desc: '目前未检测到潜在的延期工单或异常交期风险，无需执行调整。' }
                                  ]
                            }
                            renderItem={(item: any) => (
                              <List.Item style={{ padding: '8px 4px' }}>
                                <List.Item.Meta
                                  avatar={<Badge status={risks.length > 0 ? "warning" : "success"} style={{ marginTop: 6 }} />}
                                  title={<span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(0,0,0,0.85)' }}>{item.title}</span>}
                                  description={<span style={{ fontSize: 12, color: 'rgba(0,0,0,0.5)' }}>{item.desc}</span>}
                                />
                              </List.Item>
                            )}
                          />
                        </Col>
                      </Row>
                    )
                  }
                ]}
              />
            </Card>
          </Col>

          {/* 图表展示区 */}
          <Col span={24}>
            <Row gutter={[16, 16]} align="stretch">
              {/* 关键工作中心负荷率对比 */}
              <Col xs={24} lg={12} style={{ display: 'flex' }}>
                <Card
                  title={<Space><DashboardOutlined style={{ color: token.colorPrimary }} /><span>工作中心负荷率对比 (14天预测)</span></Space>}
                  style={{ borderRadius: token.borderRadiusLG, flex: 1, display: 'flex', flexDirection: 'column', border: 'none', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)' }}
                  styles={{ body: { padding: '16px 24px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' } }}
                >
                  {!s?.resource_load || s.resource_load.length === 0 ? (
                    <Empty description="暂无负荷数据" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: '40px 0' }} />
                  ) : (
                    <Column
                      data={s.resource_load}
                      xField="work_center_name"
                      yField="load_rate"
                      height={220}
                      autoFit
                      style={{
                        fill: '#fa8c16',
                        radiusTopLeft: 4,
                        radiusTopRight: 4,
                      }}
                      scale={{
                        y: {
                          formatter: (val: any) => `${val}%`
                        }
                      }}
                      axis={{
                        x: { title: false },
                        y: { title: false, grid: true }
                      }}
                    />
                  )}
                </Card>
              </Col>

              {/* 工单物料齐套率分布 */}
              <Col xs={24} lg={12} style={{ display: 'flex' }}>
                <Card
                  title={<Space><CheckCircleOutlined style={{ color: '#52c41a' }} /><span>工单物料齐套率排行 (TOP 8)</span></Space>}
                  style={{ borderRadius: token.borderRadiusLG, flex: 1, display: 'flex', flexDirection: 'column', border: 'none', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)' }}
                  styles={{ body: { padding: '16px 24px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' } }}
                >
                  {readinessList.length === 0 ? (
                    <Empty description="暂无齐套进度数据" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: '40px 0' }} />
                  ) : (
                    <Column
                      data={readinessList.slice(0, 8)}
                      xField="work_order_code"
                      yField="readiness_rate"
                      height={220}
                      autoFit
                      style={{
                        fill: token.colorPrimary,
                        radiusTopLeft: 4,
                        radiusTopRight: 4,
                      }}
                      scale={{
                        y: {
                          formatter: (val: any) => `${val}%`
                        }
                      }}
                      axis={{
                        x: { title: false },
                        y: { title: false, grid: true }
                      }}
                    />
                  )}
                </Card>
              </Col>
            </Row>
          </Col>
        </Row>
      </Spin>

      {/* 紧急插单影响模拟 Drawer */}
      <Drawer
        title={<Space><ThunderboltOutlined style={{ color: '#1890ff' }} /><span>紧急插单影响模拟分析</span></Space>}
        placement="right"
        width={580}
        onClose={() => {
          setSimulationVisible(false);
          setSimulationResult(null);
          form.resetFields();
        }}
        open={simulationVisible}
        destroyOnClose
        style={{
          borderLeft: '1px solid rgba(0, 0, 0, 0.08)',
        }}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSimulate}
          initialValues={{ quantity: 10, dates: [dayjs(), dayjs().add(7, 'day')] }}
        >
          <Form.Item
            name="product_id"
            label="模拟插单产品"
            rules={[{ required: true, message: '请选择模拟产品' }]}
          >
            <Select
              showSearch
              placeholder="请输入物料编码或名称搜索"
              loading={materialsLoading}
              filterOption={(input, option) =>
                String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={materials.map(m => ({
                value: m.id,
                label: `[${m.code}] ${m.name}`
              }))}
            />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="quantity"
                label="模拟生产数量"
                rules={[{ required: true, message: '请输入数量' }]}
              >
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="dates"
                label="计划生产周期"
                rules={[{ required: true, message: '请选择日期' }]}
              >
                <DatePicker.RangePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item style={{ marginBottom: 24 }}>
            <Button type="primary" htmlType="submit" block loading={simulateLoading} icon={<RocketOutlined />}>
              开始模拟分析
            </Button>
          </Form.Item>
        </Form>

        {simulationResult && (
          <div style={{ marginTop: 12 }}>
            <Divider orientation={"left" as any} style={{ margin: '12px 0 16px 0', fontSize: 14 }}>模拟评估报告</Divider>
            
            {/* 决策推荐 */}
            <Alert
              message="决策建议"
              description={simulationResult.recommendation}
              type={simulationResult.can_fulfill_material ? "success" : "warning"}
              showIcon
              style={{ borderRadius: token.borderRadius, marginBottom: 20 }}
            />

            <SimulationSchedulingScorePreview preview={simulationResult.scheduling_score_preview} />

            {/* 物料齐套状态 */}
            <Card 
              size="small" 
              title="物料齐套分析" 
              style={{ borderRadius: token.borderRadius, marginBottom: 16 }}
            >
              <Row align="middle" gutter={20}>
                <Col span={8} style={{ textAlign: 'center' }}>
                  <Progress 
                    type="circle" 
                    percent={simulationResult.readiness_rate} 
                    width={80} 
                    strokeColor={simulationResult.readiness_rate === 100 ? '#52c41a' : '#1890ff'}
                  />
                </Col>
                <Col span={16}>
                  <div style={{ fontSize: 13, lineHeight: 1.6 }}>
                    <div>齐套比例：<Text strong>{simulationResult.readiness_rate}%</Text></div>
                    {simulationResult.can_fulfill_material ? (
                      <div style={{ color: '#52c41a' }}>所有BOM物料可用库存充足</div>
                    ) : (
                      <div style={{ color: '#ff4d4f' }}>
                        缺料品种：<Text type="danger" strong>{simulationResult.shortage_items?.length ?? 0} 种</Text>
                      </div>
                    )}
                  </div>
                </Col>
              </Row>

              {simulationResult.shortage_items && simulationResult.shortage_items.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 6, color: 'rgba(0,0,0,0.45)' }}>缺料明细：</div>
                  <Table
                    size="small"
                    pagination={false}
                    dataSource={simulationResult.shortage_items}
                    rowKey="material_id"
                    columns={[
                      { title: '物料编码', dataIndex: 'material_code', key: 'material_code', width: 100 },
                      { title: '物料名称', dataIndex: 'material_name', key: 'material_name', ellipsis: true },
                      { title: '缺料数量', dataIndex: 'shortage_quantity', key: 'shortage_quantity', align: 'right', render: (q) => <Text type="danger">{q}</Text> }
                    ]}
                  />
                </div>
              )}
            </Card>

            {/* 受影响的现有订单 */}
            <Card 
              size="small" 
              title="排产资源与现有订单冲突" 
              style={{ borderRadius: token.borderRadius, marginBottom: 16 }}
            >
              {!simulationResult.impacted_orders || simulationResult.impacted_orders.length === 0 ? (
                <Empty description="无可检测的订单冲突" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              ) : (
                <List
                  size="small"
                  dataSource={simulationResult.impacted_orders}
                  renderItem={(item: any) => (
                    <List.Item>
                      <List.Item.Meta
                        title={
                          <Space>
                            <Tag color="red">抢占物料</Tag>
                            <Text strong>{item.work_order_code}</Text>
                            {item.scheduling_score != null && (
                              <Tag color={item.scheduling_rank_band === 'A' ? 'red' : item.scheduling_rank_band === 'B' ? 'orange' : 'default'}>
                                排程分 {Number(item.scheduling_score).toFixed(0)}
                                {item.scheduling_rank_band ? `·${item.scheduling_rank_band}` : ''}
                              </Tag>
                            )}
                          </Space>
                        }
                        description={
                          <div style={{ fontSize: 12 }}>
                            <div>影响产品：{item.product_name}</div>
                            <div>受影响物料：{item.shortage_items?.join(', ')}</div>
                          </div>
                        }
                      />
                    </List.Item>
                  )}
                />
              )}
            </Card>

            {/* 产能负荷增量 */}
            <Card 
              size="small" 
              title="新增排产负荷评估" 
              style={{ borderRadius: token.borderRadius }}
            >
              {!simulationResult.resource_load_change || simulationResult.resource_load_change.length === 0 ? (
                <Empty description="无可检测的负荷变更" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              ) : (
                <List
                  size="small"
                  dataSource={simulationResult.resource_load_change}
                  renderItem={(item: any) => (
                    <List.Item style={{ padding: '8px 0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                        <Space>
                          <FireOutlined style={{ color: '#fa8c16' }} />
                          <Text>{item.work_center_name}</Text>
                        </Space>
                        <Tag color="orange">新增 +{item.added_hours} 小时</Tag>
                      </div>
                    </List.Item>
                  )}
                />
              )}
            </Card>
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default ProductionControlTower;
