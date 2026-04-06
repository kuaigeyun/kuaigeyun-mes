/**
 * 采购退货单管理页面
 *
 * 提供采购退货单的查看、确认退货与删除；列表与详情遵循 UI_Standard / riveredge-detail-drawer-ui。
 *
 * @author RiverEdge Team
 * @date 2026-01-17
 */

import React, { useRef, useState, useMemo } from 'react';
import { useInvalidateMenuBadgeCounts } from '../../../../../hooks/useInvalidateMenuBadgeCounts';
import { useLocation } from 'react-router-dom';
import { ActionType, ProColumns, ProDescriptionsItemProps } from '@ant-design/pro-components';
import type { DescriptionsProps } from 'antd';
import {
  App,
  Button,
  Tag,
  Space,
  Modal,
  Table,
  Typography,
  Descriptions,
  Empty,
  Dropdown,
  Spin,
  theme,
} from 'antd';
import { EyeOutlined, CheckCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { UniTable } from '../../../../../components/uni-table';
import {
  ListPageTemplate,
  DetailDrawerTemplate,
  DetailDrawerSection,
  DetailDrawerActions,
  DRAWER_CONFIG,
  type StatCard,
} from '../../../../../components/layout-templates';
import { SimpleSparkline } from '../../../../../components';
import { UniLifecycle, UniLifecycleStepper } from '../../../../../components/uni-lifecycle';
import {
  DocumentTrackingRelationsBody,
  DocumentTrackingTimelineBody,
  useDocumentTracking,
} from '../../../../../components/document-tracking-panel';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { warehouseApi } from '../../../services/production';
import { usePageMetrics } from '../../../../../hooks/usePageMetrics';
import { getPurchaseReturnLifecycle } from '../../../utils/purchaseReturnLifecycle';

interface PurchaseReturn {
  id?: number;
  tenant_id?: number;
  return_code?: string;
  purchase_receipt_id?: number;
  purchase_receipt_code?: string;
  purchase_order_id?: number;
  purchase_order_code?: string;
  supplier_id?: number;
  supplier_name?: string;
  warehouse_id?: number;
  warehouse_name?: string;
  return_time?: string;
  returner_id?: number;
  returner_name?: string;
  reviewer_id?: number;
  reviewer_name?: string;
  review_time?: string;
  review_status?: string;
  review_remarks?: string;
  return_reason?: string;
  return_type?: string;
  status?: string;
  total_quantity?: number;
  total_amount?: number;
  shipping_method?: string;
  tracking_number?: string;
  shipping_address?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

interface PurchaseReturnDetail extends PurchaseReturn {
  items?: PurchaseReturnItem[];
}

interface PurchaseReturnItem {
  id?: number;
  material_code?: string;
  material_name?: string;
  return_quantity?: number;
  unit_price?: number;
  total_amount?: number;
  batch_number?: string;
  expiry_date?: string;
  location_code?: string;
  serial_numbers?: string[];
  notes?: string;
}

const PR_DETAIL_ITEMS_MIN_WIDTH = 1000;

const PURCHASE_RETURN_ROW_ACTIONS_INLINE_MAX = 4;

function buildDescriptionItemsFromColumns<T extends Record<string, any>>(
  dataSource: T,
  cols: ProDescriptionsItemProps<T>[]
): NonNullable<DescriptionsProps['items']> {
  return cols.map((col, index) => {
    const dataIndex = col.dataIndex as keyof T | undefined;
    const value = dataIndex != null ? dataSource[dataIndex] : undefined;
    let content: React.ReactNode = value as React.ReactNode;
    if (col.valueType === 'dateTime' && value) {
      content = dayjs(value as string).format('YYYY-MM-DD HH:mm:ss');
    } else if (col.valueType === 'date' && value) {
      content = dayjs(value as string).format('YYYY-MM-DD');
    }
    if (col.render && dataSource != null) {
      content = col.render(content, dataSource, index, {}, col);
    }
    return {
      key: String(col.key ?? col.dataIndex ?? index),
      label: col.title as React.ReactNode,
      children: content !== undefined && content !== null ? content : '-',
      span: col.span ?? 1,
    };
  });
}

function renderPurchaseReturnRowActions(nodes: React.ReactNode[], keyPrefix: string): React.ReactNode {
  const wrapped = nodes.map((node, i) => <span key={`${keyPrefix}-${i}`}>{node}</span>);
  if (wrapped.length <= PURCHASE_RETURN_ROW_ACTIONS_INLINE_MAX) {
    return <Space size="small" wrap>{wrapped}</Space>;
  }
  const inline = wrapped.slice(0, PURCHASE_RETURN_ROW_ACTIONS_INLINE_MAX);
  const overflow = wrapped.slice(PURCHASE_RETURN_ROW_ACTIONS_INLINE_MAX);
  return (
    <Space size="small" wrap>
      {inline}
      <Dropdown
        menu={{
          items: overflow.map((node, i) => ({
            key: `${keyPrefix}-more-${i}`,
            label: node,
          })),
        }}
        trigger={['click']}
      >
        <Button type="link" size="small">
          更多
        </Button>
      </Dropdown>
    </Space>
  );
}

const PurchaseReturnsPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const { token } = theme.useToken();
  const location = useLocation();
  const actionRef = useRef<ActionType>(null);
  const invalidateMenuBadgeCounts = useInvalidateMenuBadgeCounts();
  const queryClient = useQueryClient();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const { statCards: pageMetricCards, hasConfig: hasPageMetricConfig } = usePageMetrics(location.pathname);

  const invalidatePurchaseReturnStatistics = () => {
    queryClient.invalidateQueries({ queryKey: ['purchaseReturnStatistics'] });
    queryClient.invalidateQueries({ queryKey: ['pageMetrics', location.pathname] });
  };

  const { data: prStats } = useQuery({
    queryKey: ['purchaseReturnStatistics'],
    queryFn: () => warehouseApi.purchaseReturn.statistics(),
    enabled: !hasPageMetricConfig,
  });

  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [returnDetail, setReturnDetail] = useState<PurchaseReturnDetail | null>(null);
  const purchaseReturnTracking = useDocumentTracking(
    detailDrawerVisible && returnDetail?.id ? 'purchase_return' : undefined,
    returnDetail?.id
  );

  const handleDetail = async (record: PurchaseReturn) => {
    try {
      const detail = await warehouseApi.purchaseReturn.get(record.id!.toString());
      setReturnDetail(detail as PurchaseReturnDetail);
      setDetailDrawerVisible(true);
    } catch {
      messageApi.error('获取采购退货单详情失败');
    }
  };

  const handleConfirm = async (record: PurchaseReturn) => {
    Modal.confirm({
      title: '确认采购退货',
      content: `确定要确认采购退货单 "${record.return_code}" 吗？确认后将自动更新库存。`,
      onOk: async () => {
        try {
          await warehouseApi.purchaseReturn.confirm(record.id!.toString());
          messageApi.success('采购退货确认成功');
          invalidatePurchaseReturnStatistics();
          if (returnDetail?.id === record.id) {
            const fresh = await warehouseApi.purchaseReturn.get(record.id!.toString());
            setReturnDetail(fresh as PurchaseReturnDetail);
          }
          invalidateMenuBadgeCounts();

          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '采购退货确认失败');
        }
      },
    });
  };

  const detailColumns: ProDescriptionsItemProps<PurchaseReturnDetail>[] = [
    {
      title: '退货单编号',
      dataIndex: 'return_code',
      render: (_, entity) => (
        <Typography.Text copyable={{ text: String(entity.return_code ?? '') }}>{entity.return_code ?? '-'}</Typography.Text>
      ),
    },
    {
      title: '采购入库单编号',
      dataIndex: 'purchase_receipt_code',
      render: (_, entity) => (
        <Typography.Text copyable={{ text: String(entity.purchase_receipt_code ?? '') }}>{entity.purchase_receipt_code ?? '-'}</Typography.Text>
      ),
    },
    {
      title: '采购订单编号',
      dataIndex: 'purchase_order_code',
      render: (_, entity) => (
        <Typography.Text copyable={{ text: String(entity.purchase_order_code ?? '') }}>{entity.purchase_order_code ?? '-'}</Typography.Text>
      ),
    },
    { title: '供应商', dataIndex: 'supplier_name' },
    { title: '仓库', dataIndex: 'warehouse_name' },
    {
      title: '退货状态',
      dataIndex: 'status',
      render: (status) => {
        const statusMap: Record<string, { text: string; color: string }> = {
          待退货: { text: '待退货', color: 'default' },
          已退货: { text: '已退货', color: 'success' },
          已取消: { text: '已取消', color: 'error' },
        };
        const config = statusMap[(status as string) || ''] || { text: (status as string) || '-', color: 'default' };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '审核状态',
      dataIndex: 'review_status',
      render: (status) => {
        const statusMap: Record<string, { text: string; color: string }> = {
          待审核: { text: '待审核', color: 'default' },
          审核通过: { text: '审核通过', color: 'success' },
          审核驳回: { text: '审核驳回', color: 'error' },
        };
        const config = statusMap[(status as string) || ''] || { text: (status as string) || '-', color: 'default' };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    { title: '退货原因', dataIndex: 'return_reason' },
    { title: '退货类型', dataIndex: 'return_type' },
    { title: '总数量', dataIndex: 'total_quantity' },
    {
      title: '总金额',
      dataIndex: 'total_amount',
      render: (text: any) => `¥${text?.toLocaleString() || 0}`,
    },
    { title: '退货时间', dataIndex: 'return_time', valueType: 'dateTime' },
    { title: '退货人', dataIndex: 'returner_name' },
    { title: '审核人', dataIndex: 'reviewer_name' },
    { title: '审核时间', dataIndex: 'review_time', valueType: 'dateTime' },
    { title: '备注', dataIndex: 'notes', span: 3, render: (text: any) => text || '-' },
  ];

  const columns: ProColumns<PurchaseReturn>[] = [
    {
      title: '退货单编号',
      dataIndex: 'return_code',
      width: 148,
      ellipsis: true,
      fixed: 'left',
      render: (_, r) => (
        <Typography.Text copyable={{ text: String(r.return_code ?? '') }} ellipsis>
          {r.return_code ?? '-'}
        </Typography.Text>
      ),
    },
    {
      title: '采购入库单编号',
      dataIndex: 'purchase_receipt_code',
      width: 148,
      ellipsis: true,
      render: (_, r) => (
        <Typography.Text copyable={{ text: String(r.purchase_receipt_code ?? '') }} ellipsis>
          {r.purchase_receipt_code ?? '-'}
        </Typography.Text>
      ),
    },
    {
      title: '采购订单编号',
      dataIndex: 'purchase_order_code',
      width: 148,
      ellipsis: true,
      render: (_, r) => (
        <Typography.Text copyable={{ text: String(r.purchase_order_code ?? '') }} ellipsis>
          {r.purchase_order_code ?? '-'}
        </Typography.Text>
      ),
    },
    { title: '供应商', dataIndex: 'supplier_name', width: 150, ellipsis: true },
    { title: '仓库', dataIndex: 'warehouse_name', width: 120, ellipsis: true },
    {
      title: '审核状态',
      dataIndex: 'review_status',
      width: 100,
      hideInSearch: true,
      render: (status: any) => {
        const statusMap: Record<string, { text: string; color: string }> = {
          待审核: { text: '待审核', color: 'default' },
          审核通过: { text: '审核通过', color: 'success' },
          审核驳回: { text: '审核驳回', color: 'error' },
        };
        const config = statusMap[status as keyof typeof statusMap] || statusMap['待审核'];
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '总数量',
      dataIndex: 'total_quantity',
      width: 100,
      align: 'right',
    },
    {
      title: '总金额',
      dataIndex: 'total_amount',
      width: 120,
      align: 'right',
      render: (text: any) => `¥${text?.toLocaleString() || 0}`,
    },
    {
      title: '退货时间',
      dataIndex: 'return_time',
      valueType: 'dateTime',
      width: 160,
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      valueType: 'dateTime',
      width: 168,
      hideInSearch: true,
      defaultSortOrder: 'descend',
    },
    {
      title: '生命周期',
      dataIndex: 'lifecycle',
      width: 132,
      fixed: 'right',
      align: 'left',
      hideInSearch: true,
      render: (_, record) => {
        const lifecycle = getPurchaseReturnLifecycle(record);
        return (
          <UniLifecycle
            percent={lifecycle.percent}
            stageName={lifecycle.stageName}
            status={lifecycle.status}
            subStages={lifecycle.subStages}
            showLabel
            size="small"
            showCircleTooltip={false}
          />
        );
      },
    },
    {
      title: '操作',
      width: 160,
      fixed: 'right',
      hideInSearch: true,
      render: (_, record) => {
        const parts: React.ReactNode[] = [
          <Button
            key="d"
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              handleDetail(record);
            }}
          >
            详情
          </Button>,
        ];
        if (record.status === '待退货') {
          parts.push(
            <Button
              key="c"
              type="link"
              size="small"
              icon={<CheckCircleOutlined />}
              style={{ color: '#52c41a' }}
              onClick={(e) => {
                e.stopPropagation();
                handleConfirm(record);
              }}
            >
              确认退货
            </Button>
          );
        }
        return renderPurchaseReturnRowActions(parts, `pr-${record.id ?? 'row'}`);
      },
    },
  ];

  const statCards: StatCard[] = useMemo(() => {
    if (hasPageMetricConfig && pageMetricCards.length > 0) {
      return pageMetricCards;
    }
    const s = prStats;
    const z = [0, 0, 0, 0, 0, 0, 0];
    return [
      {
        title: '退货单总数',
        value: s?.total_count ?? 0,
        valueStyle: { color: token.colorPrimary },
        backgroundChart: <SimpleSparkline data={s?.trend_total?.length ? s.trend_total : z} color={token.colorPrimary} />,
      },
      {
        title: '待退货',
        value: s?.pending_count ?? 0,
        valueStyle: { color: token.colorWarning },
        backgroundChart: <SimpleSparkline data={s?.trend_pending?.length ? s.trend_pending : z} color={token.colorWarning} />,
      },
      {
        title: '已退货',
        value: s?.done_count ?? 0,
        valueStyle: { color: token.colorSuccess },
        backgroundChart: <SimpleSparkline data={s?.trend_done?.length ? s.trend_done : z} color={token.colorSuccess} />,
      },
      {
        title: '已取消',
        value: s?.cancelled_count ?? 0,
        valueStyle: { color: token.colorError },
        backgroundChart: <SimpleSparkline data={s?.trend_cancelled?.length ? s.trend_cancelled : z} color={token.colorError} />,
      },
    ];
  }, [hasPageMetricConfig, pageMetricCards, prStats, token]);

  return (
    <>
      <ListPageTemplate statCards={statCards}>
        <UniTable<PurchaseReturn>
          headerTitle="采购退货单"
          columnPersistenceId="kuaizhizao-purchase-returns"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          showAdvancedSearch={true}
          request={async (params) => {
            try {
              const response = await warehouseApi.purchaseReturn.list({
                skip: (params.current! - 1) * params.pageSize!,
                limit: params.pageSize,
                status: params.status,
                purchase_receipt_id: params.purchase_receipt_id,
                supplier_id: params.supplier_id,
                keyword: params.keyword,
              });
              return {
                data: Array.isArray(response) ? response : response.data || [],
                success: true,
                total: Array.isArray(response) ? response.length : response.total || 0,
              };
            } catch {
              messageApi.error('获取采购退货单列表失败');
              return {
                data: [],
                success: false,
                total: 0,
              };
            }
          }}
          enableRowSelection={true}
          onRowSelectionChange={setSelectedRowKeys}
          showDeleteButton={true}
          onDelete={async (keys) => {
            Modal.confirm({
              title: '确认批量删除',
              content: `确定要删除选中的 ${keys.length} 条采购退货单吗？`,
              onOk: async () => {
                try {
                  for (const id of keys) {
                    await warehouseApi.purchaseReturn.delete(String(id));
                  }
                  messageApi.success(`成功删除 ${keys.length} 条记录`);
                  setSelectedRowKeys([]);
                  invalidatePurchaseReturnStatistics();
                  if (returnDetail?.id != null && keys.includes(returnDetail.id)) {
                    setReturnDetail(null);
                    setDetailDrawerVisible(false);
                  }
                  invalidateMenuBadgeCounts();

                  actionRef.current?.reload();
                } catch (error: any) {
                  messageApi.error(error.message || '删除失败');
                }
              },
            });
          }}
          scroll={{ x: 1500 }}
          onRow={(record) => ({
            onClick: () => handleDetail(record),
            style: { cursor: 'pointer' },
          })}
        />
      </ListPageTemplate>

      <DetailDrawerTemplate<PurchaseReturnDetail>
        title={`采购退货单详情${returnDetail?.return_code ? ` - ${returnDetail.return_code}` : ''}`}
        open={detailDrawerVisible}
        onClose={() => {
          setDetailDrawerVisible(false);
          setReturnDetail(null);
        }}
        width={DRAWER_CONFIG.HALF_WIDTH}
        columns={[]}
        column={3}
        dataSource={returnDetail || undefined}
        extra={
          returnDetail && returnDetail.status === '待退货' ? (
            <DetailDrawerActions
              items={[
                {
                  key: 'confirm',
                  render: () => (
                    <Button
                      type="link"
                      size="small"
                      icon={<CheckCircleOutlined />}
                      style={{ color: '#52c41a' }}
                      onClick={() => handleConfirm(returnDetail)}
                    >
                      确认退货
                    </Button>
                  ),
                },
              ]}
            />
          ) : null
        }
        customContent={
          returnDetail && (
            <>
              <DetailDrawerSection title="基本信息">
                <Descriptions
                  column={3}
                  size="small"
                  items={buildDescriptionItemsFromColumns(returnDetail, detailColumns)}
                />
              </DetailDrawerSection>

              <DetailDrawerSection title="生命周期">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {(() => {
                    const lifecycle = getPurchaseReturnLifecycle(returnDetail);
                    const mainStages = lifecycle.mainStages ?? [];
                    if (mainStages.length === 0) return null;
                    return (
                      <UniLifecycleStepper
                        steps={mainStages}
                        status={lifecycle.status}
                        showLabels
                        nextStepSuggestions={lifecycle.nextStepSuggestions}
                      />
                    );
                  })()}
                  <div
                    style={{
                      paddingTop: 12,
                      borderTop: '1px solid var(--ant-color-border-secondary)',
                    }}
                  >
                    <div style={{ marginBottom: 8, fontWeight: 600, fontSize: 13, color: 'var(--ant-color-text)' }}>
                      上下游单据
                    </div>
                    {purchaseReturnTracking.loading && (
                      <div style={{ padding: '8px 0' }}>
                        <Spin size="small" />
                      </div>
                    )}
                    {purchaseReturnTracking.error && (
                      <Typography.Text type="danger">{purchaseReturnTracking.error}</Typography.Text>
                    )}
                    {purchaseReturnTracking.data && (
                      <DocumentTrackingRelationsBody
                        data={purchaseReturnTracking.data}
                        onDocumentClick={(type, id) => messageApi.info(`跳转到${type}#${id}`)}
                      />
                    )}
                  </div>
                </div>
              </DetailDrawerSection>

              <DetailDrawerSection title="明细信息">
                <style>{`
                  .purchase-return-detail-items .ant-table-wrapper .ant-table-body,
                  .purchase-return-detail-items .ant-table-wrapper .ant-table-content {
                    overflow: visible !important;
                  }
                `}</style>
                {returnDetail.items && returnDetail.items.length > 0 ? (
                  <div
                    className="purchase-return-detail-items"
                    style={{ width: '100%', maxWidth: '100%', overflowX: 'auto', overflowY: 'hidden' }}
                  >
                    <Table
                      size="small"
                      tableLayout="fixed"
                      style={{ minWidth: PR_DETAIL_ITEMS_MIN_WIDTH }}
                      columns={[
                        { title: '物料编号', dataIndex: 'material_code', width: 120, ellipsis: true },
                        { title: '物料名称', dataIndex: 'material_name', width: 150, ellipsis: true },
                        { title: '退货数量', dataIndex: 'return_quantity', width: 100, align: 'right' },
                        {
                          title: '单价',
                          dataIndex: 'unit_price',
                          width: 100,
                          align: 'right',
                          render: (text) => `¥${text || 0}`,
                        },
                        {
                          title: '金额',
                          dataIndex: 'total_amount',
                          width: 100,
                          align: 'right',
                          render: (text) => `¥${text || 0}`,
                        },
                        { title: '批次号', dataIndex: 'batch_number', width: 120 },
                        { title: '库位', dataIndex: 'location_code', width: 100 },
                      ]}
                      dataSource={returnDetail.items}
                      pagination={false}
                      rowKey="id"
                      bordered
                    />
                  </div>
                ) : (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无明细" />
                )}
              </DetailDrawerSection>

              <DetailDrawerSection title="操作记录">
                {purchaseReturnTracking.loading && (
                  <div style={{ textAlign: 'center', padding: 24 }}>
                    <Spin />
                  </div>
                )}
                {purchaseReturnTracking.error && !purchaseReturnTracking.loading && (
                  <Typography.Text type="danger">{purchaseReturnTracking.error}</Typography.Text>
                )}
                {purchaseReturnTracking.data && !purchaseReturnTracking.loading && (
                  <DocumentTrackingTimelineBody data={purchaseReturnTracking.data} />
                )}
                {!purchaseReturnTracking.loading && !purchaseReturnTracking.data && !purchaseReturnTracking.error && (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无操作记录" />
                )}
              </DetailDrawerSection>
            </>
          )
        }
      />
    </>
  );
};

export default PurchaseReturnsPage;
