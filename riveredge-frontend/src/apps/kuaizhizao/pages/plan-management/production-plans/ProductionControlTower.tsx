import React, { useState, useMemo, useEffect } from 'react';
import { 
  Card, Row, Col, Progress, Table, Tag, Typography, Space, Spin, Empty, 
  Button, Drawer, Form, Select, InputNumber, DatePicker, message, 
  theme, List, Divider, Alert
} from 'antd';
import { useDashboardRequest } from '../../../utils/dashboardRequestOptions';
import {
  RocketOutlined,
  AlertOutlined,
  CheckCircleOutlined,
  DashboardOutlined,
  AppstoreOutlined,
  SafetyOutlined,
  AuditOutlined,
  ScheduleOutlined,
  ThunderboltOutlined,
  FireOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { apiRequest } from '../../../../../services/api';
import dayjs from 'dayjs';
import CoordinationPipelinePanel from './CoordinationPipelinePanel';
import { ModuleKpiRow, ModuleShortcutGrid } from '../../../components/module-center';
import { UniDashboard } from '../../../../../components/uni-dashboard';
import type { ModuleKpiDef, ModuleShortcutDef } from '../../../components/module-center';

const { Text } = Typography;

type SummaryShape = {
  material_readiness: any[];
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
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { token } = theme.useToken();
  const [form] = Form.useForm();

  // 状态管理
  const [simulationVisible, setSimulationVisible] = useState(false);
  const [simulateLoading, setSimulateLoading] = useState(false);
  const [simulationResult, setSimulationResult] = useState<any>(null);
  const [materials, setMaterials] = useState<any[]>([]);
  const [materialsLoading, setMaterialsLoading] = useState(false);

  const { data: summary, loading, refresh: refreshSummary } = useDashboardRequest(async () => {
    return apiRequest('/apps/kuaizhizao/production-control/summary');
  }, 'kz:plan-dashboard:control-tower-summary', {
    pollingInterval: 30000,
  });

  const s = summary as SummaryShape | undefined;

  const readinessList = s?.material_readiness || [];
  const risks = s?.delivery_risks || [];
  
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
      message.error(err?.message || t('app.kuaizhizao.planControlTower.simulationFailed'));
    } finally {
      setSimulateLoading(false);
    }
  };

  // 监听 Drawer 打开以获取物料
  useEffect(() => {
    if (simulationVisible && materials.length === 0) {
      fetchMaterials();
    }
  }, [simulationVisible]);

  const kpiShortcuts: ModuleShortcutDef[] = useMemo(
    () => [
      { key: 'demand', title: t('app.kuaizhizao.planControlTower.shortcut.demandComputation'), icon: <RocketOutlined style={{ fontSize: 20, color: '#1890ff' }} />, path: '/apps/kuaizhizao/plan-management/demand-computation' },
      { key: 'scheduling', title: t('app.kuaizhizao.planControlTower.shortcut.visualScheduling'), icon: <AppstoreOutlined style={{ fontSize: 20, color: '#fa8c16' }} />, path: '/apps/kuaizhizao/plan-management/scheduling' },
      { key: 'plans', title: t('app.kuaizhizao.planControlTower.shortcut.productionPlans'), icon: <ScheduleOutlined style={{ fontSize: 20, color: '#722ed1' }} />, path: '/apps/kuaizhizao/plan-management/production-plans' },
      { key: 'work-orders', title: t('app.kuaizhizao.planControlTower.shortcut.workOrderRelease'), icon: <SafetyOutlined style={{ fontSize: 20, color: '#52c41a' }} />, path: '/apps/kuaizhizao/production-execution/work-orders' },
      { key: 'shortage', title: t('app.kuaizhizao.planControlTower.shortcut.shortageAlert'), icon: <AlertOutlined style={{ fontSize: 20, color: '#ff4d4f' }} />, path: '/apps/kuaizhizao/plan-management/reports/material-shortage-alert' },
      { key: 'reporting', title: t('app.kuaizhizao.planControlTower.shortcut.reportingBoard'), icon: <DashboardOutlined style={{ fontSize: 20, color: '#13c2c2' }} />, path: '/apps/kuaizhizao/production-execution/reporting' },
    ],
    [t],
  );

  const kpis: ModuleKpiDef[] = useMemo(
    () => [
      {
        key: 'plans',
        title: t('app.kuaizhizao.planControlTower.kpi.totalPlans'),
        value: s?.stats?.total_count ?? 0,
        subtitle: t('app.kuaizhizao.planControlTower.kpi.totalPlansSubtitle'),
        icon: <AuditOutlined style={{ fontSize: 24, color: '#fff' }} />,
        gradient: 'linear-gradient(135deg, #1890ff 0%, #36cfc9 100%)',
        boxShadow: '0 4px 12px rgba(24, 144, 255, 0.15)',
        onClick: () => navigate('/apps/kuaizhizao/plan-management/production-plans'),
        sideMetrics: [
          { label: t('app.kuaizhizao.planControlTower.kpi.pendingReview'), value: s?.stats?.pending_review_count ?? 0 },
          { label: t('app.kuaizhizao.planControlTower.kpi.executed'), value: s?.stats?.executed_count ?? 0 },
        ],
      },
      {
        key: 'risks',
        title: t('app.kuaizhizao.planControlTower.kpi.deliveryRisk'),
        value: s?.total_risk_count ?? 0,
        subtitle: t('app.kuaizhizao.planControlTower.kpi.deliveryRiskSubtitle'),
        icon: <AlertOutlined style={{ fontSize: 24, color: '#fff' }} />,
        gradient: 'linear-gradient(135deg, #ff4d4f 0%, #ff7875 100%)',
        boxShadow: '0 4px 12px rgba(255, 77, 79, 0.15)',
        sideMetrics: [
          { label: t('app.kuaizhizao.planControlTower.kpi.overduePlans'), value: s?.stats?.overdue_plans_count ?? 0 },
          { label: t('app.kuaizhizao.planControlTower.kpi.delayedDocs'), value: delayedCount },
        ],
      },
      {
        key: 'readiness',
        title: t('app.kuaizhizao.planControlTower.kpi.avgReadiness'),
        value: `${avgReadiness}%`,
        subtitle: t('app.kuaizhizao.planControlTower.kpi.wipCount', { count: s?.total_wip_count ?? 0 }),
        icon: <CheckCircleOutlined style={{ fontSize: 24, color: '#fff' }} />,
        gradient: 'linear-gradient(135deg, #52c41a 0%, #95de64 100%)',
        boxShadow: '0 4px 12px rgba(82, 196, 26, 0.15)',
        sideMetrics: [
          { label: t('app.kuaizhizao.planControlTower.kpi.shortageWorkOrders'), value: notFullyKitted },
          { label: t('app.kuaizhizao.planControlTower.kpi.expectedKitted'), value: Math.max(0, readinessList.length - notFullyKitted) },
        ],
      },
    ],
    [avgReadiness, delayedCount, navigate, notFullyKitted, readinessList.length, s, t],
  );

  return (
    <UniDashboard className="plan-module-dashboard" style={{ padding: 0, overflow: 'visible' }}>
      <Row gutter={[16, 16]}>
        
        {/* KPI 区 */}
        <Col span={24}>
          <Spin spinning={loading && !s}>
            <ModuleKpiRow items={kpis} />
          </Spin>
        </Col>

        {/* 快捷按钮 (6 宫格) */}
        <Col span={24}>
          <ModuleShortcutGrid items={kpiShortcuts} colProps={{ xs: 12, sm: 8, md: 4 }} />
        </Col>

        {/* 执行协调 */}
        <Col span={24}>
          <Card
            style={{ borderRadius: token.borderRadiusLG, border: 'none', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)' }}
            styles={{ body: { padding: '16px 24px' } }}
          >
            <CoordinationPipelinePanel onRefreshSummary={refreshSummary} />
          </Card>
        </Col>
      </Row>

      {/* 紧急插单影响模拟 Drawer */}
      <Drawer
        title={<Space><ThunderboltOutlined style={{ color: '#1890ff' }} /><span>{t('app.kuaizhizao.planControlTower.simulation.title')}</span></Space>}
        placement="right"
        size={580}
        onClose={() => {
          setSimulationVisible(false);
          setSimulationResult(null);
          form.resetFields();
        }}
        open={simulationVisible}
        destroyOnHidden
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
            label={t('app.kuaizhizao.planControlTower.simulation.productLabel')}
            rules={[{ required: true, message: t('app.kuaizhizao.planControlTower.simulation.productRequired') }]}
          >
            <Select
              showSearch
              placeholder={t('app.kuaizhizao.planControlTower.simulation.productPlaceholder')}
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
                label={t('app.kuaizhizao.planControlTower.simulation.quantityLabel')}
                rules={[{ required: true, message: t('app.kuaizhizao.planControlTower.simulation.quantityRequired') }]}
              >
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="dates"
                label={t('app.kuaizhizao.planControlTower.simulation.periodLabel')}
                rules={[{ required: true, message: t('app.kuaizhizao.planControlTower.simulation.periodRequired') }]}
              >
                <DatePicker.RangePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item style={{ marginBottom: 24 }}>
            <Button type="primary" htmlType="submit" block loading={simulateLoading} icon={<RocketOutlined />}>
              {t('app.kuaizhizao.planControlTower.simulation.startAnalysis')}
            </Button>
          </Form.Item>
        </Form>

        {simulationResult && (
          <div style={{ marginTop: 12 }}>
            <Divider orientation={"left" as any} style={{ margin: '12px 0 16px 0', fontSize: 14 }}>{t('app.kuaizhizao.planControlTower.simulation.reportTitle')}</Divider>
            
            {/* 决策推荐 */}
            <Alert
              message={t('app.kuaizhizao.planControlTower.simulation.recommendation')}
              description={simulationResult.recommendation}
              type={simulationResult.can_fulfill_material ? "success" : "warning"}
              showIcon
              style={{ borderRadius: token.borderRadius, marginBottom: 20 }}
            />


            {/* 物料齐套状态 */}
            <Card 
              size="small" 
              title={t('app.kuaizhizao.planControlTower.simulation.materialReadiness')} 
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
                    <div>{t('app.kuaizhizao.planControlTower.simulation.readinessRate')}<Text strong>{simulationResult.readiness_rate}%</Text></div>
                    {simulationResult.can_fulfill_material ? (
                      <div style={{ color: '#52c41a' }}>{t('app.kuaizhizao.planControlTower.simulation.allMaterialsAvailable')}</div>
                    ) : (
                      <div style={{ color: '#ff4d4f' }}>
                        {t('app.kuaizhizao.planControlTower.simulation.shortageCount')}<Text type="danger" strong>{simulationResult.shortage_items?.length ?? 0} {t('app.kuaizhizao.planControlTower.simulation.shortageUnit')}</Text>
                      </div>
                    )}
                  </div>
                </Col>
              </Row>

              {simulationResult.shortage_items && simulationResult.shortage_items.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 6, color: 'rgba(0,0,0,0.45)' }}>{t('app.kuaizhizao.planControlTower.simulation.shortageDetail')}</div>
                  <Table
                    size="small"
                    pagination={false}
                    dataSource={simulationResult.shortage_items}
                    rowKey="material_id"
                    columns={[
                      { title: t('app.kuaizhizao.planControlTower.simulation.materialCode'), dataIndex: 'material_code', key: 'material_code', width: 100 },
                      { title: t('app.kuaizhizao.planControlTower.simulation.materialName'), dataIndex: 'material_name', key: 'material_name', ellipsis: true },
                      { title: t('app.kuaizhizao.planControlTower.simulation.shortageQty'), dataIndex: 'shortage_quantity', key: 'shortage_quantity', align: 'right', render: (q) => <Text type="danger">{q}</Text> }
                    ]}
                  />
                </div>
              )}
            </Card>

            {/* 受影响的现有订单 */}
            <Card 
              size="small" 
              title={t('app.kuaizhizao.planControlTower.simulation.orderConflict')} 
              style={{ borderRadius: token.borderRadius, marginBottom: 16 }}
            >
              {!simulationResult.impacted_orders || simulationResult.impacted_orders.length === 0 ? (
                <Empty description={t('app.kuaizhizao.planControlTower.simulation.noOrderConflict')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
              ) : (
                <List
                  size="small"
                  dataSource={simulationResult.impacted_orders}
                  renderItem={(item: any) => (
                    <List.Item>
                      <List.Item.Meta
                        title={
                          <Space>
                            <Tag color="red">{t('app.kuaizhizao.planControlTower.simulation.preemptMaterial')}</Tag>
                            <Text strong>{item.work_order_code}</Text>
                          </Space>
                        }
                        description={
                          <div style={{ fontSize: 12 }}>
                            <div>{t('app.kuaizhizao.planControlTower.simulation.impactedProduct')}{item.product_name}</div>
                            <div>{t('app.kuaizhizao.planControlTower.simulation.impactedMaterials')}{item.shortage_items?.join(', ')}</div>
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
              title={t('app.kuaizhizao.planControlTower.simulation.loadAssessment')} 
              style={{ borderRadius: token.borderRadius }}
            >
              {!simulationResult.resource_load_change || simulationResult.resource_load_change.length === 0 ? (
                <Empty description={t('app.kuaizhizao.planControlTower.simulation.noLoadChange')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
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
                        <Tag color="orange">{t('app.kuaizhizao.planControlTower.simulation.addedHours', { hours: item.added_hours })}</Tag>
                      </div>
                    </List.Item>
                  )}
                />
              )}
            </Card>
          </div>
        )}
      </Drawer>
    </UniDashboard>
  );
};

export default ProductionControlTower;
