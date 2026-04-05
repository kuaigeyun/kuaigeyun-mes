import React from 'react';
import { Card, Row, Col, Progress, Table, Typography, Tag, Spin } from 'antd';
import { useRequest } from 'ahooks';
import { ProCard } from '@ant-design/pro-components';
import { 
  FileTextOutlined, 
  SendOutlined, 
  RiseOutlined, 
  UserOutlined,
  CustomerServiceOutlined,
  SolutionOutlined,
  FileDoneOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { mesDashboardService } from '../../../services/dashboard';
import { listSalesOrders } from '../../../services/sales-order';
import { customerFollowUpApi } from '../../../services/customer-follow-up';
import { AmountDisplay } from '../../../../../components/permission';
import { useGlobalStore } from '../../../../../stores/globalStore';
import { canViewKuaizhizaoPricing } from '../../../../../utils/kuaizhizaoPricingPermission';

const { Text } = Typography;

const SalesDashboard: React.FC = () => {
  const navigate = useNavigate();
  const currentUser = useGlobalStore((s) => s.currentUser);
  const showMoney = canViewKuaizhizaoPricing(currentUser);
  
  // 1. 获取汇总数据
  const { data: summary, loading: summaryLoading } = useRequest(mesDashboardService.getSalesSummary);
  
  // 2. 获取最近订单
  const { data: recentOrdersData, loading: ordersLoading } = useRequest(async () => {
    return listSalesOrders({ limit: 8 });
  });
  
  // 3. 获取最近跟进记录
  const { data: followUpsData, loading: followUpsLoading } = useRequest(async () => {
    return customerFollowUpApi.list({ limit: 8 });
  });

  const recentOrders = recentOrdersData?.data || [];
  const recentFollowUps = followUpsData?.items || [];
  const s = summary as any;

  /** 与仓储看板统一的 KPI 卡片样式 */
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
      title: '新建报价',
      icon: <FileDoneOutlined style={{ fontSize: 22, color: '#1890ff' }} />,
      path: '/apps/kuaizhizao/sales-management/quotations',
    },
    {
      title: '销售订单',
      icon: <SolutionOutlined style={{ fontSize: 22, color: '#52c41a' }} />,
      path: '/apps/kuaizhizao/sales-management/sales-orders',
    },
    {
      title: '客户跟进',
      icon: <CustomerServiceOutlined style={{ fontSize: 22, color: '#fa8c16' }} />,
      path: '/apps/kuaizhizao/sales-management/customer-follow-up',
    },
    {
      title: '客户管理',
      icon: <UserOutlined style={{ fontSize: 22, color: '#722ed1' }} />,
      path: '/apps/kuaizhizao/sales-management/customers',
    },
  ];


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
                  onClick={() => navigate('/apps/kuaizhizao/sales-management/quotations')}
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
                      <FileTextOutlined style={{ fontSize: 24, color: '#fff' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255, 255, 255, 0.9)' }}>待处理报价</div>
                      <div style={{ fontSize: 30, fontWeight: 700, color: '#fff', lineHeight: 1.2, marginTop: 6 }}>
                        {s?.pending_quotations ?? 0}
                      </div>
                      <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.72)', marginTop: 8 }}>
                        含草稿与待审核状态单据
                      </div>
                    </div>
                    {kpiSideBlock([
                      { label: '本月新增', value: s?.new_quotations_this_month ?? 0 },
                    ])}
                  </div>
                </Card>
              </Col>
              <Col xs={24} lg={8} style={{ display: 'flex' }}>
                <Card
                  hoverable
                  onClick={() => navigate('/apps/kuaizhizao/sales-management/sales-orders?status=approved')}
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
                      <SendOutlined style={{ fontSize: 24, color: '#fff' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255, 255, 255, 0.9)' }}>待发货订单</div>
                      <div style={{ fontSize: 30, fontWeight: 700, color: '#fff', lineHeight: 1.2, marginTop: 6 }}>
                        {s?.pending_shipments ?? 0}
                      </div>
                      <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.72)', marginTop: 8 }}>
                        {s?.overdue_shipments > 0 ? `含 ${s.overdue_shipments} 单已逾期` : '全部订单在交期内'}
                      </div>
                    </div>
                    {kpiSideBlock([
                      { label: '已逾期', value: <span style={{ color: s?.overdue_shipments > 0 ? '#fff' : 'rgba(255,255,255,0.7)' }}>{s?.overdue_shipments ?? 0}</span> },
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
                      <RiseOutlined style={{ fontSize: 24, color: '#fff' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255, 255, 255, 0.9)' }}>本月销售额 (元)</div>
                      <div style={{ fontSize: 24, fontWeight: 700, color: '#fff', lineHeight: 1.2, marginTop: 6 }}>
                        <AmountDisplay
                          resource="sales_order"
                          value={s?.total_amount != null ? Number(s.total_amount) : null}
                          prefix=""
                          suffix=""
                          style={{ fontSize: 24, fontWeight: 700, color: '#fff' }}
                        />
                      </div>
                      <div style={{ marginTop: 8 }}>
                        <Progress
                          percent={s?.achievement_rate ?? 0}
                          showInfo={false}
                          strokeColor="#fff"
                          railColor="rgba(255, 255, 255, 0.2)"
                          size={6}
                        />
                      </div>
                    </div>
                    {kpiSideBlock([
                      {
                        label: '上月完成',
                        value: showMoney
                          ? `${((s?.total_amount_last_month ?? 0) / 10000).toFixed(1)}w`
                          : '***',
                      },
                      { label: '达成率', value: (s?.achievement_rate ?? 0) + '%' },
                    ])}
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
          <Col xs={24} lg={14}>
            <ProCard
              title="最近销售订单"
              headerBordered
              style={{ height: '100%', borderRadius: 12, boxShadow: '0 1px 2px 0 rgba(0,0,0,0.03)' }}
              bodyStyle={{ padding: 8 }}
              extra={<a onClick={() => navigate('/apps/kuaizhizao/sales-management/sales-orders')}>查看全部</a>}
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
                    render: (text, record) => <a onClick={() => navigate(`/apps/kuaizhizao/sales-management/sales-orders/${record.id}`)}>{text}</a>
                  },
                  { title: '客户', dataIndex: 'customer_name', ellipsis: true },
                  {
                    title: '金额',
                    dataIndex: 'total_amount',
                    align: 'right',
                    render: (val) => (
                      <Text strong>
                        <AmountDisplay resource="sales_order" value={val != null ? Number(val) : null} />
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

          <Col xs={24} lg={10}>
            <ProCard
              title="最近客户跟进"
              headerBordered
              style={{ height: '100%', borderRadius: 12, boxShadow: '0 1px 2px 0 rgba(0,0,0,0.03)' }}
              bodyStyle={{ padding: 8 }}
              extra={<a onClick={() => navigate('/apps/kuaizhizao/sales-management/customer-follow-up')}>查看全部</a>}
            >
              <Table
                size="small"
                loading={followUpsLoading}
                dataSource={recentFollowUps}
                pagination={false}
                rowKey="id"
                columns={[
                  {
                    title: '跟进客户',
                    dataIndex: 'customer_name',
                    render: (text) => <Text strong>{text}</Text>
                  },
                  {
                    title: '内容',
                    dataIndex: 'content',
                    ellipsis: true,
                  },
                  {
                    title: '时间',
                    dataIndex: 'occurred_at',
                    width: 100,
                    align: 'right',
                    render: (t) => <Text type="secondary" style={{ fontSize: 12 }}>{dayjs(t).format('MM-DD')}</Text>
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

export default SalesDashboard;
