import React, { useMemo } from 'react';
import { Card, Row, Col, Tag, Popover, Table, Progress, Space, Typography, Empty, Spin } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  ThunderboltOutlined,
  SolutionOutlined,
  SafetyOutlined,
  InboxOutlined,
} from '@ant-design/icons';
import {
  getPurchaseOrderTracking,
  type PurchaseTrackingResponse,
} from '../../../services/purchase';
import { getPriceComparison } from '../../../services/purchase-requisition';
import dayjs from 'dayjs';
import { formatDateTime } from '../../../../../utils/format';

const { Text, Title } = Typography;

type PurchaseTrackingNode = PurchaseTrackingResponse['nodes'][number];

function trackingGroupPercent(nodes: PurchaseTrackingNode[]): number {
  if (!nodes.length) return 0;
  return Math.round((nodes.filter((n) => n.is_completed).length / nodes.length) * 100);
}

/** 多供应商比价助手 */
export const MultiSupplierPriceComparison: React.FC<{ materialId: number; onSelectSupplier?: (id: number) => void }> = ({ materialId, onSelectSupplier }) => {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery({
    queryKey: ['priceComparison', materialId],
    queryFn: () => getPriceComparison([materialId]),
    enabled: !!materialId,
  });

  const comparison = data?.results?.find(r => r.material_id === materialId);

  const columns = useMemo(
    () => [
      { title: t('app.kuaizhizao.purchaseOrder.col.supplier'), dataIndex: 'supplier_name', key: 'supplier', ellipsis: true },
      {
        title: t('app.kuaizhizao.purchaseOrder.empower.dealPrice'),
        dataIndex: 'last_price',
        key: 'price',
        width: 100,
        align: 'right' as const,
        render: (p: number) => <Text strong>¥{Number(p).toFixed(2)}</Text>,
      },
      {
        title: t('app.kuaizhizao.purchaseOrder.empower.purchaseDate'),
        dataIndex: 'last_order_date',
        key: 'date',
        width: 110,
        render: (d: string) => (d ? formatDateTime(d, 'YYYY-MM-DD') : '-'),
      },
      {
        title: t('common.actions'),
        key: 'action',
        width: 70,
        align: 'center' as const,
        render: (_: unknown, record: { supplier_id: number }) => (
          <a style={{ fontSize: 13 }} onClick={() => onSelectSupplier?.(record.supplier_id)}>
            {t('app.kuaizhizao.purchaseOrder.empower.select')}
          </a>
        ),
      },
    ],
    [t, onSelectSupplier],
  );

  const content = (
    <div style={{ width: 550 }}>
      {isLoading ? (
        <div style={{ padding: 20, textAlign: 'center' }}><Spin size="small" /></div>
      ) : !comparison || !comparison.comparison?.length ? (
        <Empty description={t('app.kuaizhizao.purchaseOrder.empower.compareEmpty')} />
      ) : (
        <>
          <div style={{ marginBottom: 12, fontSize: 13, color: 'rgba(0,0,0,0.65)' }}>
            {t('app.kuaizhizao.purchaseOrder.empower.compareIntro', {
              name: comparison.material_name,
              code: comparison.material_code
                ? t('app.kuaizhizao.purchaseOrder.empower.compareIntroCode', { code: comparison.material_code })
                : '',
            })}
          </div>
          <Table
            size="small"
            dataSource={comparison.comparison}
            pagination={false}
            rowKey="supplier_id"
            columns={columns}
          />
        </>
      )}
    </div>
  );

  return (
    <Popover content={content} title={t('app.kuaizhizao.purchaseOrder.empower.compareTitle')} trigger="click" placement="right">
      <Tag
        color="orange"
        icon={<ThunderboltOutlined />}
        style={{ cursor: 'pointer', borderRadius: 4, padding: '2px 8px' }}
      >
        {t('app.kuaizhizao.purchaseOrder.empower.compare')}
      </Tag>
    </Popover>
  );
};

/**
 * 履约全链路追踪（与销售订单 SalesOrderTrackingRadar 一致的卡片式进度 + 分组明细）
 */
export const FulfillmentTrackingTimeline: React.FC<{ orderId: number }> = ({ orderId }) => {
  const { t } = useTranslation();
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
      return <Text type="secondary" style={{ fontSize: 13 }}>{t('app.kuaizhizao.purchaseOrder.empower.noNodeData')}</Text>;
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
                  {formatDateTime(node.time, 'MM-DD HH:mm')}
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
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={
          isError
            ? t('app.kuaizhizao.purchaseOrder.empower.trackingLoadFailed')
            : t('app.kuaizhizao.purchaseOrder.empower.trackingEmpty')
        }
      />
    );
  }

  const nodes = data.nodes;
  const orderAudit = nodes.slice(0, 2);
  const supplierQc = nodes.slice(2, 4);
  const warehousing = nodes.slice(4);

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
        <Text strong>{t('app.kuaizhizao.purchaseOrder.empower.overallProgress')}</Text>
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
            t('app.kuaizhizao.purchaseOrder.empower.groupOrderAudit'),
            trackingGroupPercent(orderAudit),
            <SolutionOutlined />,
            '#1890ff',
            renderNodeSummary(orderAudit),
          )}
        </Col>
        <Col xs={24} md={8}>
          {renderProgressCard(
            t('app.kuaizhizao.purchaseOrder.empower.groupSupplierQc'),
            trackingGroupPercent(supplierQc),
            <SafetyOutlined />,
            '#fa8c16',
            renderNodeSummary(supplierQc),
          )}
        </Col>
        <Col xs={24} md={8}>
          {renderProgressCard(
            t('app.kuaizhizao.purchaseOrder.empower.groupWarehousing'),
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
