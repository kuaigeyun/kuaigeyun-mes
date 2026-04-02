import React, { useMemo } from 'react';
import { App, Card, Row, Col, Typography, Table, Spin, Space, Button } from 'antd';
import {
  InboxOutlined,
  AlertOutlined,
  SwapOutlined,
  ImportOutlined,
  ExportOutlined,
  AppstoreOutlined,
  HistoryOutlined,
  FormOutlined,
  RetweetOutlined,
} from '@ant-design/icons';
import { useRequest } from 'ahooks';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { getWarehouseDashboardSummary, type WarehouseDashboardSummary } from '../../../services/warehouse-dashboard';
import { AmountDisplay } from '../../../../../components/permission';

const { Text } = Typography;

const WarehouseDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { message } = App.useApp();

  const { data, loading } = useRequest(() => getWarehouseDashboardSummary({ recent_limit: 8 }), {
    onError: (e: any) => {
      message.error(e?.message || '加载仓储看板失败');
    },
  });

  const s = data as WarehouseDashboardSummary | undefined;

  const normalSkuPercent = useMemo(() => {
    if (!s || s.total_sku <= 0) return 100;
    return Math.min(100, Math.round((s.normal_stock / s.total_sku) * 100));
  }, [s]);

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
      title: '采购入库',
      icon: <ImportOutlined style={{ fontSize: 20, color: '#1890ff' }} />,
      path: '/apps/kuaizhizao/warehouse-management/inbound',
    },
    {
      title: '销售出库',
      icon: <ExportOutlined style={{ fontSize: 20, color: '#52c41a' }} />,
      path: '/apps/kuaizhizao/warehouse-management/outbound',
    },
    {
      title: '生产领料',
      icon: <AppstoreOutlined style={{ fontSize: 20, color: '#722ed1' }} />,
      path: '/apps/kuaizhizao/warehouse-management/picking',
    },
    {
      title: '其他出入',
      icon: <HistoryOutlined style={{ fontSize: 20, color: '#fa8c16' }} />,
      path: '/apps/kuaizhizao/warehouse-management/other-inventory',
    },
    {
      title: '库存盘点',
      icon: <FormOutlined style={{ fontSize: 20, color: '#ff4d4f' }} />,
      path: '/apps/kuaizhizao/warehouse-management/stocktake',
    },
    {
      title: '库存调拨',
      icon: <RetweetOutlined style={{ fontSize: 20, color: '#36cfc9' }} />,
      path: '/apps/kuaizhizao/warehouse-management/transfer',
    },
  ];

  const formatTime = (iso: string | null | undefined) => {
    if (!iso) return '—';
    const d = dayjs(iso);
    return d.isValid() ? d.format('MM-DD HH:mm') : '—';
  };

  return (
    <div style={{ padding: '0 0 16px', overflow: 'visible' }}>
      <Spin spinning={loading && !s}>
        <Row gutter={[16, 16]}>
          {/* KPI 区 */}
          <Col span={24}>
            <Row gutter={[18, 18]} align="stretch">
              <Col xs={24} lg={8} style={{ display: 'flex' }}>
                <Card
                  hoverable
                  onClick={() => navigate('/apps/kuaizhizao/warehouse-management/inventory')}
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
                      <InboxOutlined style={{ fontSize: 24, color: '#fff' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255, 255, 255, 0.9)' }}>总库存金额 (元)</div>
                      <div style={{ fontSize: 26, fontWeight: 700, color: '#fff', lineHeight: 1.2, marginTop: 6 }}>
                        <AmountDisplay
                          resource="inventory"
                          value={s?.total_inventory_value != null ? Number(s.total_inventory_value) : null}
                          prefix=""
                          style={{ fontSize: 26, fontWeight: 700, color: '#fff' }}
                        />
                      </div>
                      <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.72)', marginTop: 8 }}>
                        按物料标准成本/均价估算
                      </div>
                    </div>
                    {kpiSideBlock([
                      { label: 'SKU 数', value: s?.total_sku ?? 0 },
                      { label: '总数量', value: s?.total_quantity ?? 0 },
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
                      <AlertOutlined style={{ fontSize: 24, color: '#fff' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255, 255, 255, 0.9)' }}>库存健康度</div>
                      <div style={{ fontSize: 32, fontWeight: 700, color: '#fff', lineHeight: 1.2, marginTop: 6 }}>
                        {normalSkuPercent}%
                      </div>
                      <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.72)', marginTop: 8 }}>
                        正常库存 SKU 占比
                      </div>
                    </div>
                    {kpiSideBlock([
                      { label: '低库存', value: s?.low_stock ?? 0 },
                      { label: '缺料', value: s?.out_of_stock ?? 0 },
                    ])}
                  </div>
                </Card>
              </Col>

              <Col xs={24} lg={8} style={{ display: 'flex' }}>
                <Card
                  hoverable
                  onClick={() => navigate('/apps/kuaizhizao/warehouse-management/inbound')}
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
                      <SwapOutlined style={{ fontSize: 24, color: '#fff' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255, 255, 255, 0.9)' }}>待办出入库</div>
                      <div style={{ fontSize: 32, fontWeight: 700, color: '#fff', lineHeight: 1.2, marginTop: 6 }}>
                        {(s?.pending_inbound || 0) + (s?.pending_outbound || 0)}
                      </div>
                      <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.72)', marginTop: 8 }}>
                        {s?.overdue_inbound ? `有 ${s.overdue_inbound} 单入库逾期` : '所有单据在有效期内'}
                      </div>
                    </div>
                    {kpiSideBlock([
                      { label: '待入库', value: s?.pending_inbound ?? 0 },
                      { label: '待出库', value: s?.pending_outbound ?? 0 },
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
                <Col xs={12} sm={8} md={4} key={sc.path}>
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
                    <Text strong style={{ fontSize: 13 }}>{sc.title}</Text>
                  </Card>
                </Col>
              ))}
            </Row>
          </Col>

          {/* 最近明细 */}
          <Col xs={24} lg={12}>
            <Card
              title={<Space><ImportOutlined /><span>最近入库记录</span></Space>}
              extra={<Button type="link" onClick={() => navigate('/apps/kuaizhizao/warehouse-management/inbound')}>更多</Button>}
              style={{ borderRadius: 12 }}
              styles={{ body: { padding: 8 } }}
            >
              <Table
                size="small"
                dataSource={s?.recent_inbounds ?? []}
                pagination={false}
                rowKey={(r) => `${r.doc_type}-${r.doc_code}`}
                columns={[
                  { title: '单号', dataIndex: 'doc_code', ellipsis: true },
                  { title: '物料', dataIndex: 'material_name', ellipsis: true },
                  { title: '数量', dataIndex: 'quantity', width: 80, align: 'right', render: (v) => <Text type="success">+{v}</Text> },
                  { title: '时间', dataIndex: 'time', width: 110, align: 'right', render: (v) => formatTime(v) },
                ]}
              />
            </Card>
          </Col>

          <Col xs={24} lg={12}>
            <Card
              title={<Space><ExportOutlined /><span>最近出库记录</span></Space>}
              extra={<Button type="link" onClick={() => navigate('/apps/kuaizhizao/warehouse-management/outbound')}>更多</Button>}
              style={{ borderRadius: 12 }}
              styles={{ body: { padding: 8 } }}
            >
              <Table
                size="small"
                dataSource={s?.recent_outbounds ?? []}
                pagination={false}
                rowKey={(r) => `${r.doc_type}-${r.doc_code}`}
                columns={[
                  { title: '单号', dataIndex: 'doc_code', ellipsis: true },
                  { title: '物料', dataIndex: 'material_name', ellipsis: true },
                  { title: '数量', dataIndex: 'quantity', width: 80, align: 'right', render: (v) => <Text type="danger">-{v}</Text> },
                  { title: '时间', dataIndex: 'time', width: 110, align: 'right', render: (v) => formatTime(v) },
                ]}
              />
            </Card>
          </Col>
        </Row>
      </Spin>
    </div>
  );
};

export default WarehouseDashboard;
