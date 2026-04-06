import React from 'react';
import { Timeline, Tag, Popover, Table, Progress, Space, Typography, Empty, Spin } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { InfoCircleOutlined, ClockCircleOutlined, CheckCircleOutlined, WarningOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { 
  getMaterialPriceHistory, getPurchaseOrderTracking, getSupplierPerformance,
  getPurchaseOrderChanges, PurchaseOrderChange
} from '../../../services/purchase';
import { getPriceComparison } from '../../../services/purchase-requisition';
import dayjs from 'dayjs';

const { Text } = Typography;

/** 多供应商比价助手 */
export const MultiSupplierPriceComparison: React.FC<{ materialId: number; onSelectSupplier?: (id: number) => void }> = ({ materialId, onSelectSupplier }) => {
  const { data, isLoading } = useQuery({
    queryKey: ['priceComparison', materialId],
    queryFn: () => getPriceComparison([materialId]),
    enabled: !!materialId,
  });

  const comparison = data?.results?.find(r => r.material_id === materialId);

  const content = (
    <div style={{ width: 550 }}>
      {isLoading ? (
        <div style={{ padding: 20, textAlign: 'center' }}><Spin size="small" /></div>
      ) : !comparison || !comparison.comparison?.length ? (
        <Empty description="暂无其他供应商历史成交记录" />
      ) : (
        <>
          <div style={{ marginBottom: 12, fontSize: 13, color: 'rgba(0,0,0,0.65)' }}>
            为物料{' '}
            <Text strong>
              {comparison.material_name}
              {comparison.material_code ? ` (${comparison.material_code})` : ''}
            </Text>{' '}
            找到以下成交记录：
          </div>
          <Table
            size="small"
            dataSource={comparison.comparison}
            pagination={false}
            rowKey="supplier_id"
            columns={[
              { title: '供应商', dataIndex: 'supplier_name', key: 'supplier', ellipsis: true },
              { 
                title: '绩效', 
                dataIndex: 'reliability_rating', 
                key: 'level',
                width: 70,
                render: (l) => {
                  const colorMap: Record<string, string> = { 'S': '#fadb14', 'A': '#52c41a', 'B': '#1890ff', 'C': '#ff4d4f' };
                  return <Tag color={colorMap[l] || 'default'} style={{ margin: 0, fontSize: 11 }}>{l}级</Tag>;
                }
              },
              { 
                title: '成交价', 
                dataIndex: 'last_price', 
                key: 'price',
                width: 100,
                align: 'right',
                render: (p) => <Text strong>¥{Number(p).toFixed(2)}</Text>
              },
              { 
                title: '进货日期', 
                dataIndex: 'last_order_date', 
                key: 'date',
                width: 110,
                render: (d) => d ? dayjs(d).format('YYYY-MM-DD') : '-'
              },
              {
                title: '操作',
                key: 'action',
                width: 70,
                align: 'center',
                render: (_, record) => (
                  <a style={{ fontSize: 13 }} onClick={() => onSelectSupplier?.(record.supplier_id)}>
                    选用
                  </a>
                )
              }
            ]}
          />
        </>
      )}
    </div>
  );

  return (
    <Popover content={content} title="伙计比价助手" trigger="click" placement="right">
      <Tag 
        color="orange" 
        icon={<ThunderboltOutlined />} 
        style={{ cursor: 'pointer', borderRadius: 4, padding: '2px 8px' }}
      >
        比价
      </Tag>
    </Popover>
  );
};

/** 履约全链路追踪时间轴 */
export const FulfillmentTrackingTimeline: React.FC<{ orderId: number }> = ({ orderId }) => {
  const { data, isLoading } = useQuery({
    queryKey: ['purchaseTracking', orderId],
    queryFn: () => getPurchaseOrderTracking(orderId),
  });

  if (isLoading) return <Spin size="small" />;
  if (!data || !data.nodes) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />;

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
        <Text strong>总体进度: </Text>
        <Progress percent={data.overall_progress} size="small" style={{ flex: 1 }} />
      </div>
      <Timeline
        items={data.nodes.map((node) => ({
          color: node.is_completed ? 'green' : node.is_warning ? 'red' : 'gray',
          dot: node.is_completed ? <CheckCircleOutlined /> : node.is_warning ? <WarningOutlined /> : <ClockCircleOutlined />,
          children: (
            <div style={{ opacity: node.is_completed ? 1 : 0.6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text strong>{node.node_name}</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>{node.time ? dayjs(node.time).format('YYYY-MM-DD HH:mm') : ''}</Text>
              </div>
              <div>
                <Tag color={node.is_completed ? 'success' : node.is_warning ? 'error' : 'default'}>
                  {node.status}
                </Tag>
                {node.operator && <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>执行人: {node.operator}</Text>}
              </div>
              {node.detail && <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)', marginTop: 4 }}>{node.detail}</div>}
            </div>
          ),
        }))}
      />
    </div>
  );
};

/** 物料历史价格洞察 */
export const PriceHistoryInsight: React.FC<{ materialId: number; currentPrice?: number }> = ({ materialId, currentPrice }) => {
  const { data, isLoading } = useQuery({
    queryKey: ['materialPriceHistory', materialId],
    queryFn: () => getMaterialPriceHistory(materialId),
    enabled: !!materialId,
  });
  const toNumber = (v: unknown): number => {
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : 0;
  };
  const avgPrice = toNumber(data?.average_price);
  const minPrice = toNumber(data?.min_price);
  const maxPrice = toNumber(data?.max_price);

  const content = (
    <div style={{ width: 450 }}>
      {isLoading ? (
        <Spin size="small" />
      ) : !data || data.history_items.length === 0 ? (
        <Empty description="暂无历史采购记录" />
      ) : (
        <>
          <Space split={<div style={{ width: 1, height: 14, background: 'var(--river-divider-color)' }} />} style={{ marginBottom: 12, width: '100%', justifyContent: 'space-around' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)' }}>平均成交价</div>
              <Text strong style={{ color: '#1890ff' }}>¥{avgPrice.toFixed(2)}</Text>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)' }}>历史最低价</div>
              <Text strong style={{ color: '#52c41a' }}>¥{minPrice.toFixed(2)}</Text>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)' }}>历史最高价</div>
              <Text strong style={{ color: '#ff4d4f' }}>¥{maxPrice.toFixed(2)}</Text>
            </div>
          </Space>
          
          <Table
            size="small"
            dataSource={data.history_items}
            pagination={false}
            columns={[
              { title: '进货日期', dataIndex: 'order_date', key: 'date', render: (d) => dayjs(d).format('YYYY-MM-DD') },
              { title: '供应商', dataIndex: 'supplier_name', key: 'supplier', ellipsis: true },
              { 
                title: '单价', 
                dataIndex: 'unit_price', 
                key: 'price', 
                render: (p) => (
                  <Text strong style={{ color: currentPrice && toNumber(p) < currentPrice ? '#52c41a' : 'inherit' }}>
                    ¥{toNumber(p).toFixed(2)}
                  </Text>
                ) 
              },
            ]}
          />
          {currentPrice && avgPrice > 0 && (
            <div style={{ marginTop: 12, padding: '8px 12px', background: '#f0faff', borderRadius: 4 }}>
              <Text>
                当前报价较历史均价: 
                <Text strong style={{ color: currentPrice <= avgPrice ? '#52c41a' : '#ff4d4f', marginLeft: 4 }}>
                  {currentPrice <= avgPrice ? '调低' : '调高'} {Math.abs(((currentPrice - avgPrice) / avgPrice) * 100).toFixed(1)}%
                </Text>
              </Text>
            </div>
          )}
        </>
      )}
    </div>
  );

  return (
    <Popover content={content} title="价格洞察 (最近10笔)" trigger="hover">
      <InfoCircleOutlined style={{ color: '#1890ff', cursor: 'pointer', marginLeft: 4 }} />
    </Popover>
  );
};

/** 供应商表现评分卡 */
export const SupplierPerformanceTag: React.FC<{ supplierId: number }> = ({ supplierId }) => {
  const { data, isLoading } = useQuery({
    queryKey: ['supplierPerformance', supplierId],
    queryFn: () => getSupplierPerformance(supplierId),
    enabled: !!supplierId,
  });

  if (isLoading) return <Tag icon={<ClockCircleOutlined spin />}>计算中</Tag>;
  if (!data || data.reliability_rating === 'N/A') return null;

  const colorMap: Record<string, string> = { 'S': '#fadb14', 'A': '#52c41a', 'B': '#1890ff', 'C': '#ff4d4f' };
  const otif = data.on_time_delivery_rate ?? 0;
  const quality = data.quality_pass_rate ?? 0;
  const compositeScore = Math.round(otif * 0.5 + quality * 0.5);

  const content = (
    <div style={{ width: 280 }}>
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 36, fontWeight: 'bold', color: colorMap[data.reliability_rating] }}>{data.reliability_rating}</div>
        <div style={{ fontSize: 14 }}>等级 (综合得分: {compositeScore})</div>
      </div>
      <Space direction="vertical" style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>到货及时率 (OTIF):</span>
          <Text strong>{otif}%</Text>
        </div>
        <Progress percent={otif} size="small" strokeColor={otif >= 90 ? '#52c41a' : '#faad14'} />
        
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>一次合格率:</span>
          <Text strong>{quality}%</Text>
        </div>
        <Progress percent={quality} size="small" strokeColor={quality >= 95 ? '#52c41a' : '#ff4d4f'} />
        
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>平均到货周期:</span>
          <Text strong>{data.average_lead_time_days} 天</Text>
        </div>
      </Space>
    </div>
  );

  return (
    <Popover content={content} title="供应商绩效" trigger="hover">
      <Tag color={colorMap[data.reliability_rating]} style={{ cursor: 'pointer' }}>
        表现: {data.reliability_rating}级
      </Tag>
    </Popover>
  );
};

/** 订单变更审计历史表格 (V2) */
export const OrderChangeHistoryTable: React.FC<{ orderId: number }> = ({ orderId }) => {
  const { data, isLoading } = useQuery({
    queryKey: ['purchaseOrderChanges', orderId],
    queryFn: () => getPurchaseOrderChanges(orderId),
    enabled: !!orderId,
  });

  if (isLoading) return <div style={{ padding: 20, textAlign: 'center' }}><Spin size="small" /></div>;
  if (!data || data.length === 0) return <Empty description="暂无变更记录" image={Empty.PRESENTED_IMAGE_SIMPLE} />;

  const columns = [
    { 
      title: '变更时间', 
      dataIndex: 'created_at', 
      key: 'time', 
      width: 170,
      render: (t: string) => dayjs(t).format('YYYY-MM-DD HH:mm:ss')
    },
    { 
      title: '操作人', 
      dataIndex: 'operator_name', 
      key: 'operator',
      width: 100 
    },
    { 
      title: '变更类型', 
      dataIndex: 'change_type', 
      key: 'type',
      width: 100,
      render: (t: string) => {
        const colors: Record<string, string> = { 'UPDATE': 'blue', 'DELETE': 'red', 'CREATE': 'green' };
        return <Tag color={colors[t] || 'default'}>{t}</Tag>;
      }
    },
    { 
      title: '详细信息', 
      key: 'details',
      render: (_: any, record: any) => (
        <div style={{ fontSize: 12 }}>
          {record.field_name && (
            <>
              <Text type="secondary">{record.field_name}: </Text>
              <Text delete type="danger">{record.old_value || '(空)'}</Text>
              <Text type="success" style={{ margin: '0 4px' }}>→</Text>
              <Text strong type="success">{record.new_value || '(空)'}</Text>
            </>
          )}
        </div>
      )
    },
    { 
      title: '变更原因', 
      dataIndex: 'reason', 
      key: 'reason',
      width: 180,
      ellipsis: true 
    },
  ];

  return (
    <Table
      size="small"
      dataSource={data}
      columns={columns}
      pagination={data.length > 5 ? { pageSize: 5 } : false}
      rowKey="id"
      bordered
      style={{ marginTop: 8 }}
    />
  );
};
