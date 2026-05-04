import React from 'react';
import { Card, Row, Col, Tag, Popover, Table, Progress, Space, Typography, Empty, Spin } from 'antd';
import { useQuery } from '@tanstack/react-query';
import {
  InfoCircleOutlined,
  ThunderboltOutlined,
  SolutionOutlined,
  SafetyOutlined,
  InboxOutlined,
} from '@ant-design/icons';
import {
  getMaterialPriceHistory,
  getPurchaseOrderTracking,
  type PurchaseTrackingResponse,
} from '../../../services/purchase';
import { getPriceComparison } from '../../../services/purchase-requisition';
import dayjs from 'dayjs';

const { Text, Title } = Typography;

type PurchaseTrackingNode = PurchaseTrackingResponse['nodes'][number];

function trackingGroupPercent(nodes: PurchaseTrackingNode[]): number {
  if (!nodes.length) return 0;
  return Math.round((nodes.filter((n) => n.is_completed).length / nodes.length) * 100);
}

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

/**
 * 履约全链路追踪（与销售订单 SalesOrderTrackingRadar 一致的卡片式进度 + 分组明细）
 */
export const FulfillmentTrackingTimeline: React.FC<{ orderId: number }> = ({ orderId }) => {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['purchaseTracking', orderId],
    queryFn: () => getPurchaseOrderTracking(orderId),
  });

  const renderProgressCard = (
    title: string,
    percent: number,
    icon: React.ReactNode,
    color: string,
    details: React.ReactNode,
  ) => (
    <Card
      size="small"
      styles={{
        header: { borderBottom: 'none', paddingBottom: 0 },
        body: { paddingTop: 8 },
      }}
      style={{
        height: '100%',
        borderRadius: 8,
        border: `1px solid ${color}40`,
        background: `linear-gradient(to bottom right, ${color}05, ${color}15)`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
        <div
          style={{
            backgroundColor: color,
            color: '#fff',
            width: 32,
            height: 32,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 12,
          }}
        >
          {icon}
        </div>
        <Title level={5} style={{ margin: 0 }}>
          {title}
        </Title>
      </div>
      <Progress
        percent={percent}
        strokeColor={{ '0%': `${color}80`, '100%': color }}
        status={percent === 100 ? 'success' : 'active'}
        size={{ height: 10 }}
      />
      <div style={{ marginTop: 16 }}>{details}</div>
    </Card>
  );

  const renderNodeSummary = (nodes: PurchaseTrackingNode[]) => {
    if (!nodes.length) {
      return <Text type="secondary" style={{ fontSize: 13 }}>暂无环节数据。</Text>;
    }
    return (
      <div style={{ maxHeight: 140, overflowY: 'auto' }}>
        {nodes.map((node, idx) => (
          <div
            key={`${node.node_name}-${idx}`}
            style={{
              fontSize: 12,
              marginBottom: 8,
              padding: '6px 8px',
              background: 'rgba(255,255,255,0.6)',
              borderRadius: 4,
              opacity: node.is_completed ? 1 : 0.85,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, gap: 8 }}>
              <Text strong ellipsis style={{ flex: 1 }}>
                {node.node_name}
              </Text>
              {node.time ? (
                <Text type="secondary" style={{ fontSize: 11, flexShrink: 0 }}>
                  {dayjs(node.time).format('MM-DD HH:mm')}
                </Text>
              ) : null}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
              <Tag
                color={node.is_completed ? 'success' : node.is_warning ? 'error' : 'default'}
                style={{ margin: 0, fontSize: 11 }}
              >
                {node.status}
              </Tag>
              {node.operator ? (
                <Text type="secondary" style={{ fontSize: 11 }}>
                  {node.operator}
                </Text>
              ) : null}
            </div>
            {node.detail ? (
              <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.45)', marginTop: 4 }}>{node.detail}</div>
            ) : null}
          </div>
        ))}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div style={{ padding: '16px 0', textAlign: 'center' }}>
        <Spin />
      </div>
    );
  }

  if (isError || !data?.nodes?.length) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={isError ? '加载履约追踪失败' : '暂无追踪数据'} />;
  }

  const nodes = data.nodes;
  const orderAudit = nodes.slice(0, 2);
  const supplierQc = nodes.slice(2, 4);
  const warehousing = nodes.slice(4);

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
        <Text strong>总体进度</Text>
        <Progress
          percent={data.overall_progress}
          size="small"
          style={{ flex: 1 }}
          strokeColor={{ '0%': '#108ee9', '100%': '#87d068' }}
        />
      </div>
      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          {renderProgressCard(
            '订单与审核',
            trackingGroupPercent(orderAudit),
            <SolutionOutlined />,
            '#1890ff',
            renderNodeSummary(orderAudit),
          )}
        </Col>
        <Col xs={24} md={8}>
          {renderProgressCard(
            '供应商与质检',
            trackingGroupPercent(supplierQc),
            <SafetyOutlined />,
            '#fa8c16',
            renderNodeSummary(supplierQc),
          )}
        </Col>
        <Col xs={24} md={8}>
          {renderProgressCard(
            '仓库入库',
            trackingGroupPercent(warehousing),
            <InboxOutlined />,
            '#52c41a',
            renderNodeSummary(warehousing),
          )}
        </Col>
      </Row>
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
