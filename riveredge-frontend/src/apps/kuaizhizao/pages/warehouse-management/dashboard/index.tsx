import React, { useMemo } from 'react';
import { App, Card, Row, Col, Typography, Empty, Progress, Table, Spin } from 'antd';
import { ProCard } from '@ant-design/pro-components';
import {
  InboxOutlined,
  AlertOutlined,
  SwapOutlined,
  SearchOutlined,
  ImportOutlined,
  ExportOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { useRequest } from 'ahooks';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { getWarehouseDashboardSummary, type WarehouseDashboardSummary } from '../../../services/warehouse-dashboard';

const { Text } = Typography;

const WarehouseDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { message } = App.useApp();

  const { data, loading, error } = useRequest(() => getWarehouseDashboardSummary({ recent_limit: 8 }), {
    onError: (e: any) => {
      message.error(e?.message || '加载仓储看板失败');
    },
  });

  const s = data as WarehouseDashboardSummary | undefined;

  const normalSkuPercent = useMemo(() => {
    if (!s || s.total_sku <= 0) return 100;
    return Math.min(100, Math.round((s.normal_stock / s.total_sku) * 100));
  }, [s]);

  /** 与质检中心、计划中心 KPI 统一的卡片体（略松排版） */
  const kpiCardBodyStyle: React.CSSProperties = {
    padding: '22px 24px',
    color: '#fff',
    minHeight: 184,
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

  const formatTime = (iso: string | null | undefined) => {
    if (!iso) return '—';
    const d = dayjs(iso);
    return d.isValid() ? d.format('MM-DD HH:mm') : '—';
  };

  if (loading && !s) {
    return (
      <div style={{ padding: '16px 0', overflow: 'visible' }}>
        <Spin spinning>
          <Card loading bordered={false} />
        </Spin>
      </div>
    );
  }

  if (error && !s) {
    return (
      <div style={{ padding: '16px 0', overflow: 'visible' }}>
        <Empty description="暂无仓储数据" />
      </div>
    );
  }

  if (!s) {
    return (
      <div style={{ padding: '16px 0', overflow: 'visible' }}>
        <Empty description="暂无仓储数据" />
      </div>
    );
  }

  const shortcuts = [
    {
      title: '库存查询',
      icon: <SearchOutlined style={{ fontSize: 22, color: '#1890ff' }} />,
      path: '/apps/kuaizhizao/warehouse-management/inventory',
    },
    {
      title: '采购入库',
      icon: <ImportOutlined style={{ fontSize: 22, color: '#52c41a' }} />,
      path: '/apps/kuaizhizao/warehouse-management/inbound',
    },
    {
      title: '销售出库',
      icon: <ExportOutlined style={{ fontSize: 22, color: '#fa8c16' }} />,
      path: '/apps/kuaizhizao/warehouse-management/outbound',
    },
    {
      title: '库存预警',
      icon: <WarningOutlined style={{ fontSize: 22, color: '#ff4d4f' }} />,
      path: '/apps/kuaizhizao/warehouse-management/inventory-alert',
    },
  ];

  return (
    <div style={{ padding: '16px 0', overflow: 'visible' }}>
      <Spin spinning={loading}>
        <Row gutter={[16, 16]}>
          <Col span={24}>
            <Row gutter={[18, 18]} align="stretch">
              <Col xs={24} lg={8} style={{ display: 'flex' }}>
                <Card
                  hoverable
                  onClick={() => navigate('/apps/kuaizhizao/warehouse-management/inventory')}
                  style={{
                    flex: 1,
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    borderRadius: 12,
                    border: 'none',
                    background: 'linear-gradient(135deg, #1890ff 0%, #36cfc9 100%)',
                    boxShadow: '0 4px 12px rgba(24, 144, 255, 0.15)',
                  }}
                  styles={{ body: { ...kpiCardBodyStyle } }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 18, width: '100%' }}>
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 12,
                        background: 'rgba(255, 255, 255, 0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <InboxOutlined style={{ fontSize: 24, color: '#fff' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255, 255, 255, 0.9)', lineHeight: 1.35 }}>
                        总库存金额（元）
                      </div>
                      <div style={{ fontSize: 28, fontWeight: 700, color: '#fff', lineHeight: 1.2, marginTop: 6 }}>
                        {s.total_inventory_value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.72)', marginTop: 8, lineHeight: 1.45 }}>
                        按物料标准成本/均价估算；未维护单价时记 0
                      </div>
                    </div>
                    {kpiSideBlock([
                      { label: 'SKU 数', value: s.total_sku },
                      { label: '总数量', value: s.total_quantity },
                    ])}
                  </div>
                </Card>
              </Col>
              <Col xs={24} lg={8} style={{ display: 'flex' }}>
                <Card
                  hoverable
                  onClick={() => navigate('/apps/kuaizhizao/warehouse-management/inventory-alert')}
                  style={{
                    flex: 1,
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    borderRadius: 12,
                    border: 'none',
                    background: 'linear-gradient(135deg, #ff4d4f 0%, #ff7875 100%)',
                    boxShadow: '0 4px 12px rgba(255, 77, 79, 0.15)',
                  }}
                  styles={{ body: { ...kpiCardBodyStyle } }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 18, width: '100%' }}>
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 12,
                        background: 'rgba(255, 255, 255, 0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <AlertOutlined style={{ fontSize: 24, color: '#fff' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255, 255, 255, 0.9)', lineHeight: 1.35 }}>
                        库存预警 SKU
                      </div>
                      <div style={{ fontSize: 30, fontWeight: 700, color: '#fff', lineHeight: 1.2, marginTop: 6 }}>
                        {s.low_stock + s.out_of_stock}
                      </div>
                      <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.72)', marginTop: 8, lineHeight: 1.45 }}>
                        {s.low_stock + s.out_of_stock > 0 ? '含低库存与缺料，点击查看预警列表' : '当前无待处理预警'}
                      </div>
                    </div>
                    {kpiSideBlock([
                      { label: '低库存', value: s.low_stock },
                      { label: '缺料', value: s.out_of_stock },
                    ])}
                  </div>
                </Card>
              </Col>
              <Col xs={24} lg={8} style={{ display: 'flex' }}>
                <Card
                  style={{
                    flex: 1,
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    borderRadius: 12,
                    border: 'none',
                    background: 'linear-gradient(135deg, #52c41a 0%, #95de64 100%)',
                    boxShadow: '0 4px 12px rgba(82, 196, 26, 0.15)',
                  }}
                  styles={{ body: { ...kpiCardBodyStyle } }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 18, width: '100%' }}>
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 12,
                        background: 'rgba(255, 255, 255, 0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <SwapOutlined style={{ fontSize: 24, color: '#fff' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255, 255, 255, 0.9)', lineHeight: 1.35 }}>
                        待办出入库
                      </div>
                      <div style={{ display: 'flex', gap: 20, marginTop: 8, flexWrap: 'wrap' }}>
                        <div>
                          <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.72)' }}>待入库</div>
                          <div style={{ fontSize: 24, fontWeight: 700, color: '#fff', lineHeight: 1.2, marginTop: 2 }}>
                            {s.pending_inbound}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.72)' }}>待出库</div>
                          <div style={{ fontSize: 24, fontWeight: 700, color: '#fff', lineHeight: 1.2, marginTop: 2 }}>
                            {s.pending_outbound}
                          </div>
                        </div>
                      </div>
                      <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.72)', marginTop: 8, lineHeight: 1.45 }}>
                        右侧为正常 SKU 占比（相对有库存 SKU 总数）
                      </div>
                    </div>
                    <div style={{ flexShrink: 0, width: 76, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                      <Progress
                        type="circle"
                        percent={normalSkuPercent}
                        size={68}
                        strokeColor="#fff"
                        trailColor="rgba(255,255,255,0.25)"
                        format={(pct) => <span style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>{pct}%</span>}
                      />
                    </div>
                  </div>
                </Card>
              </Col>
            </Row>
          </Col>

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
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 10,
                        background: 'rgba(0,0,0,0.04)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {sc.icon}
                    </div>
                    <Text strong style={{ fontSize: 14 }}>
                      {sc.title}
                    </Text>
                  </Card>
                </Col>
              ))}
            </Row>
          </Col>

          <Col xs={24} lg={12}>
            <ProCard
              title="最近入库"
              extra={
                <a onClick={() => navigate('/apps/kuaizhizao/warehouse-management/inbound')}>查看全部</a>
              }
              headerBordered
              style={{ height: '100%', borderRadius: 8, boxShadow: '0 1px 2px 0 rgba(0,0,0,0.03)' }}
            >
              <Table
                size="small"
                dataSource={s.recent_inbounds}
                pagination={false}
                rowKey={(row) => `${row.doc_type}-${row.doc_code}`}
                locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无记录" /> }}
                columns={[
                  { title: '单号', dataIndex: 'doc_code', width: 140, ellipsis: true },
                  { title: '物料', dataIndex: 'material_name', ellipsis: true },
                  {
                    title: '数量',
                    dataIndex: 'quantity',
                    width: 96,
                    render: (q: number) => <Text type="success">+{q}</Text>,
                  },
                  {
                    title: '时间',
                    dataIndex: 'time',
                    width: 110,
                    align: 'right' as const,
                    render: (t: string | null) => formatTime(t),
                  },
                ]}
              />
            </ProCard>
          </Col>

          <Col xs={24} lg={12}>
            <ProCard
              title="最近出库"
              extra={
                <a onClick={() => navigate('/apps/kuaizhizao/warehouse-management/outbound')}>查看全部</a>
              }
              headerBordered
              style={{ height: '100%', borderRadius: 8, boxShadow: '0 1px 2px 0 rgba(0,0,0,0.03)' }}
            >
              <Table
                size="small"
                dataSource={s.recent_outbounds}
                pagination={false}
                rowKey={(row) => `${row.doc_type}-${row.doc_code}`}
                locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无记录" /> }}
                columns={[
                  { title: '单号', dataIndex: 'doc_code', width: 140, ellipsis: true },
                  { title: '物料', dataIndex: 'material_name', ellipsis: true },
                  {
                    title: '数量',
                    dataIndex: 'quantity',
                    width: 96,
                    render: (q: number) => <Text type="danger">-{q}</Text>,
                  },
                  {
                    title: '时间',
                    dataIndex: 'time',
                    width: 110,
                    align: 'right' as const,
                    render: (t: string | null) => formatTime(t),
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

export default WarehouseDashboard;
