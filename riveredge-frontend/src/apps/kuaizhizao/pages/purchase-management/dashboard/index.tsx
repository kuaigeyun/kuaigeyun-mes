import React, { useMemo } from 'react';
import { Card, Row, Col, Progress, Table, Typography, Empty, Tag, Spin, Space } from 'antd';
import { useRequest } from 'ahooks';
import { ProCard } from '@ant-design/pro-components';
import { 
  ShoppingCartOutlined, 
  InboxOutlined, 
  CheckCircleOutlined,
  PlusOutlined,
  UserOutlined,
  FileSearchOutlined,
  BellOutlined,
  RocketOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { mesDashboardService } from '../../../services/dashboard';
import { listPurchaseOrders } from '../../../services/purchase';
import { listPurchaseRequisitions } from '../../../services/purchase-requisition';
import { AmountDisplay } from '../../../../../components/permission';

const { Text } = Typography;

const PurchaseDashboard: React.FC = () => {
  const navigate = useNavigate();
  
  // 1. 获取汇总数据
  const { data: summary, loading: summaryLoading } = useRequest(mesDashboardService.getPurchaseSummary);
  
  // 2. 获取最近采购订单
  const { data: recentOrdersData, loading: ordersLoading } = useRequest(async () => {
    return listPurchaseOrders({ limit: 8 });
  });
  
  // 3. 获取最近采购申请
  const { data: recentRequisitionsData, loading: requisitionsLoading } = useRequest(async () => {
    return listPurchaseRequisitions({ limit: 8 });
  });

  const recentOrders = recentOrdersData?.data || [];
  const recentRequisitions = recentRequisitionsData?.data || [];
  const s = summary as any;

  /** 与仓储、销售看板统一的 KPI 卡片样式 */
  const kpiCardBodyStyle: React.CSSProperties = {
    padding: '16px 24px',
    color: '#fff',
    minHeight: 140,
    display: 'flex',
    alignItems: 'center',
    flex: 1,
  };

  const kpiSideBlock = (lines: { label: string; value: React.ReactNode }[]) => (
    <div
      style={{
        flexShrink: 0,
        paddingLeft: 18,
        marginLeft: 8,
        borderLeft: '1px solid rgba(255, 255, 255, 0.28)',
        minWidth: 82,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 8,
      }}
    >
      {lines.map((line) => (
        <div key={String(line.label)}>
          <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.72)', lineHeight: 1.25 }}>{line.label}</div>
          <div style={{ fontSize: 17, fontWeight: 700, color: '#fff', lineHeight: 1.25, marginTop: 2 }}>{line.value}</div>
        </div>
      ))}
    </div>
  );

  const shortcuts = [
    {
      title: '采购申请',
      icon: <FileSearchOutlined style={{ fontSize: 22, color: '#1890ff' }} />,
      path: '/apps/kuaizhizao/purchase-management/purchase-requisitions',
    },
    {
      title: '采购订单',
      icon: <ShoppingCartOutlined style={{ fontSize: 22, color: '#52c41a' }} />,
      path: '/apps/kuaizhizao/purchase-management/purchase-orders',
    },
    {
      title: '供应商管理',
      icon: <UserOutlined style={{ fontSize: 22, color: '#fa8c16' }} />,
      path: '/apps/kuaizhizao/purchase-management/suppliers',
    },
    {
      title: '收货通知',
      icon: <BellOutlined style={{ fontSize: 22, color: '#722ed1' }} />,
      path: '/apps/kuaizhizao/purchase-management/receipt-notices',
    },
  ];

  const formatTime = (iso: string | null | undefined) => {
    if (!iso) return '—';
    const d = dayjs(iso);
    return d.isValid() ? d.format('MM-DD HH:mm') : '—';
  };

  return (
    <div style={{ padding: '0 0 16px', overflow: 'visible' }}>
      <Spin spinning={summaryLoading && !s}>
        <Row gutter={[16, 16]}>
          {/* KPI 区 */}
          <Col span={24}>
            <Row gutter={[18, 18]} align="stretch">
              <Col xs={24} lg={8} style={{ display: 'flex' }}>
                <Card
                  hoverable
                  onClick={() => navigate('/apps/kuaizhizao/purchase-management/purchase-requisitions')}
                  style={{
                    flex: 1,
                    width: '100%',
                    borderRadius: 12,
                    border: 'none',
                    background: 'linear-gradient(135deg, #1890ff 0%, #36cfc9 100%)',
                    boxShadow: '0 4px 12px rgba(24, 144, 255, 0.15)',
                  }}
                  styles={{ body: { ...kpiCardBodyStyle } }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 18, width: '100%' }}>
                    <div style={{
                      width: 48, height: 48, borderRadius: 12,
                      background: 'rgba(255, 255, 255, 0.2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                    }}>
                      <RocketOutlined style={{ fontSize: 24, color: '#fff' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255, 255, 255, 0.9)' }}>待处理申购</div>
                      <div style={{ fontSize: 30, fontWeight: 700, color: '#fff', lineHeight: 1.2, marginTop: 6 }}>
                        {s?.pending_requisitions ?? 0}
                      </div>
                      <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.72)', marginTop: 8 }}>
                        本月新增申购 {s?.new_requisitions_this_month ?? 0} 条
                      </div>
                    </div>
                    {kpiSideBlock([
                      { label: '本月新增', value: s?.new_requisitions_this_month ?? 0 },
                    ])}
                  </div>
                </Card>
              </Col>
              <Col xs={24} lg={8} style={{ display: 'flex' }}>
                <Card
                  hoverable
                  onClick={() => navigate('/apps/kuaizhizao/purchase-management/purchase-orders?status=approved')}
                  style={{
                    flex: 1,
                    width: '100%',
                    borderRadius: 12,
                    border: 'none',
                    background: 'linear-gradient(135deg, #ff4d4f 0%, #ff7875 100%)',
                    boxShadow: '0 4px 12px rgba(255, 77, 79, 0.15)',
                  }}
                  styles={{ body: { ...kpiCardBodyStyle } }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 18, width: '100%' }}>
                    <div style={{
                      width: 48, height: 48, borderRadius: 12,
                      background: 'rgba(255, 255, 255, 0.2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                    }}>
                      <InboxOutlined style={{ fontSize: 24, color: '#fff' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255, 255, 255, 0.9)' }}>待收货订单</div>
                      <div style={{ fontSize: 30, fontWeight: 700, color: '#fff', lineHeight: 1.2, marginTop: 6 }}>
                        {s?.pending_receipts ?? 0}
                      </div>
                      <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.72)', marginTop: 8 }}>
                        {s?.overdue_receipts > 0 ? `含 ${s.overdue_receipts} 单已逾期未到货` : '全部到货计划正常'}
                      </div>
                    </div>
                    {kpiSideBlock([
                      { label: '已逾期', value: <span style={{ color: s?.overdue_receipts > 0 ? '#fff' : 'rgba(255,255,255,0.7)' }}>{s?.overdue_receipts ?? 0}</span> },
                    ])}
                  </div>
                </Card>
              </Col>
              <Col xs={24} lg={8} style={{ display: 'flex' }}>
                <Card
                  style={{
                    flex: 1,
                    width: '100%',
                    borderRadius: 12,
                    border: 'none',
                    background: 'linear-gradient(135deg, #52c41a 0%, #95de64 100%)',
                    boxShadow: '0 4px 12px rgba(82, 196, 26, 0.15)',
                  }}
                  styles={{ body: { ...kpiCardBodyStyle } }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 18, width: '100%' }}>
                    <div style={{
                      width: 48, height: 48, borderRadius: 12,
                      background: 'rgba(255, 255, 255, 0.2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                    }}>
                      <CheckCircleOutlined style={{ fontSize: 24, color: '#fff' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255, 255, 255, 0.9)' }}>本月采购到货率</div>
                      <div style={{ fontSize: 30, fontWeight: 700, color: '#fff', lineHeight: 1.2, marginTop: 6 }}>
                        {s?.arrival_rate ?? 0}%
                      </div>
                      <div style={{ marginTop: 8 }}>
                        <Progress
                          percent={s?.arrival_rate ?? 0}
                          showInfo={false}
                          strokeColor="#fff"
                          railColor="rgba(255, 255, 255, 0.2)"
                          strokeWidth={6}
                        />
                      </div>
                    </div>
                    <div style={{ flexShrink: 0, paddingLeft: 18, marginLeft: 8, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4 }}>
                       <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>上月指标</div>
                       <div style={{ fontSize: 17, fontWeight: 700, color: '#fff' }}>91.0%</div>
                    </div>
                  </div>
                </Card>
              </Col>
            </Row>
          </Col>

          {/* 快捷功能 */}
          <Col span={24}>
            <Row gutter={[16, 16]}>
              {shortcuts.map((sc) => (
                <Col xs={12} sm={12} md={6} key={sc.path}>
                  <Card
                    hoverable
                    onClick={() => navigate(sc.path)}
                    styles={{ body: { padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 } }}
                    style={{ borderRadius: 10 }}
                  >
                    <div style={{
                      width: 40, height: 40, borderRadius: 10,
                      background: 'rgba(0,0,0,0.04)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {sc.icon}
                    </div>
                    <Text strong style={{ fontSize: 14 }}>{sc.title}</Text>
                  </Card>
                </Col>
              ))}
            </Row>
          </Col>

          {/* 业务表格 */}
          <Col xs={24} lg={12}>
            <ProCard
              title="待处理采购申请"
              headerBordered
              style={{ height: '100%', borderRadius: 12, boxShadow: '0 1px 2px 0 rgba(0,0,0,0.03)' }}
              bodyStyle={{ padding: 8 }}
              extra={<a onClick={() => navigate('/apps/kuaizhizao/purchase-management/purchase-requisitions')}>查看全部</a>}
            >
              <Table
                size="small"
                loading={requisitionsLoading}
                dataSource={recentRequisitions}
                pagination={false}
                rowKey="id"
                columns={[
                  {
                    title: '申请单号',
                    dataIndex: 'requisition_code',
                    render: (text, record) => <a onClick={() => navigate(`/apps/kuaizhizao/purchase-management/purchase-requisitions/${record.id}`)}>{text}</a>
                  },
                  { title: '申请人', dataIndex: 'applicant_name' },
                  {
                    title: '状态',
                    dataIndex: 'status',
                    width: 90,
                    render: (status) => {
                      let color = 'default';
                      if (status === '待审核' || status === '审批中') color = 'warning';
                      if (status === '已通过' || status === '部分转单') color = 'processing';
                      return <Tag color={color}>{status}</Tag>;
                    }
                  },
                ]}
              />
            </ProCard>
          </Col>

          <Col xs={24} lg={12}>
            <ProCard
              title="最近采购订单"
              headerBordered
              style={{ height: '100%', borderRadius: 12, boxShadow: '0 1px 2px 0 rgba(0,0,0,0.03)' }}
              bodyStyle={{ padding: 8 }}
              extra={<a onClick={() => navigate('/apps/kuaizhizao/purchase-management/purchase-orders')}>查看全部</a>}
            >
              <Table
                size="small"
                loading={ordersLoading}
                dataSource={recentOrders}
                pagination={false}
                rowKey="id"
                columns={[
                  {
                    title: '订单编号',
                    dataIndex: 'order_code',
                    render: (text, record) => <a onClick={() => navigate(`/apps/kuaizhizao/purchase-management/purchase-orders/${record.id}`)}>{text}</a>
                  },
                  { title: '供应商', dataIndex: 'supplier_name', ellipsis: true },
                  {
                    title: '金额',
                    dataIndex: 'total_amount',
                    align: 'right',
                    render: (val) => (
                      <Text strong>
                        <AmountDisplay resource="purchase_order" value={val != null ? Number(val) : null} />
                      </Text>
                    )
                  },
                  {
                    title: '状态',
                    dataIndex: 'status',
                    width: 90,
                    render: (status) => {
                      let color = 'default';
                      const s = String(status).toLowerCase();
                      if (s.includes('approved') || s.includes('已审核')) color = 'processing';
                      if (s.includes('completed') || s.includes('已完成')) color = 'success';
                      if (s.includes('cancelled') || s.includes('已取消')) color = 'error';
                      return <Tag color={color}>{status}</Tag>;
                    }
                  },
                ]}
              />
            </ProCard>
          </Col>
        </Row>
      </Spin>
    </div>
  );
};

export default PurchaseDashboard;
