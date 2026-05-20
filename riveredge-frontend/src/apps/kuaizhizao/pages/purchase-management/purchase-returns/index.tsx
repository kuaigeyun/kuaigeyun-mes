/**
 * 采购退货单管理页面
 *
 * 提供采购退货单的查看、确认退货与删除；列表与详情遵循 UI_Standard / riveredge-detail-drawer-ui。
 *
 * @author RiverEdge Team
 * @date 2026-01-17
 */

import React, { useRef, useState, useMemo, useEffect, useCallback } from 'react';
import { useInvalidateMenuBadgeCounts } from '../../../../../hooks/useInvalidateMenuBadgeCounts';
import { useNavigate } from 'react-router-dom';
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
import { EyeOutlined, CheckCircleOutlined, ReloadOutlined } from '@ant-design/icons';
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
  DocumentTrackingRelationsTabsBody,
  DocumentTrackingTimelineBody,
  TraceLinkedDocumentBrief,
  useDocumentTracking,
} from '../../../../../components/document-tracking-panel';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { warehouseApi } from '../../../services/production';
import { getPurchaseReturnLifecycle } from '../../../utils/purchaseReturnLifecycle';
import { ROUTES } from '../../../constants/routes';
import { renderRowActionsOverflow } from '../../../../../utils/renderRowActionsOverflow';

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

/** 详情 Drawer 外左侧全链路浮层（Uni-detail） */
const PR_RET_DETAIL_CHAIN_FLOAT_MARGIN = 16;
const PR_RET_DETAIL_LEFT_CHAIN_GAP = 16;
const PR_RET_DETAIL_CHAIN_DRAWER_GAP = 16;
const PR_RET_DETAIL_CHAIN_VERTICAL_TRIM = PR_RET_DETAIL_CHAIN_FLOAT_MARGIN * 2 + PR_RET_DETAIL_LEFT_CHAIN_GAP;
const prRetDetailChainHalfHeightCss = `calc((100vh - ${PR_RET_DETAIL_CHAIN_VERTICAL_TRIM}px) / 2)`;
const prRetDetailChainPanelWidthCss = `calc(50vw - ${PR_RET_DETAIL_CHAIN_FLOAT_MARGIN * 2 + PR_RET_DETAIL_CHAIN_DRAWER_GAP}px)`;
const prRetDetailBriefPanelTopCss = `calc(${PR_RET_DETAIL_CHAIN_FLOAT_MARGIN}px + (100vh - ${PR_RET_DETAIL_CHAIN_VERTICAL_TRIM}px) / 2 + ${PR_RET_DETAIL_LEFT_CHAIN_GAP}px)`;

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
            content = (col.render as (dom: import('react').ReactNode, entity: T, i: number) => import('react').ReactNode)(
        content,
        dataSource,
        index,
      );
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
  return renderRowActionsOverflow(nodes, keyPrefix);
}

const PurchaseReturnsPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const navigate = useNavigate();
  const { token } = theme.useToken();
  const purchaseReturnDetailDrawerZIndex = token.zIndexPopupBase;
  const purchaseReturnChainOverlayZIndex = token.zIndexPopupBase + 1;
  const actionRef = useRef<ActionType>(null);
  const invalidateMenuBadgeCounts = useInvalidateMenuBadgeCounts();
  const queryClient = useQueryClient();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const invalidatePurchaseReturnStatistics = () => {
    queryClient.invalidateQueries({ queryKey: ['purchaseReturnStatistics'] });
  };

  const { data: prStats } = useQuery({
    queryKey: ['purchaseReturnStatistics'],
    queryFn: () => warehouseApi.purchaseReturn.statistics(),
  });

  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [returnDetail, setReturnDetail] = useState<PurchaseReturnDetail | null>(null);
  const [prRetTrackingRefreshKey, setPrRetTrackingRefreshKey] = useState(0);
  const [fullChainRefreshKey, setFullChainRefreshKey] = useState(0);
  const [fullChainTraceLoading, setFullChainTraceLoading] = useState(false);
  const [fullChainBriefDoc, setFullChainBriefDoc] = useState<{ document_type: string; document_id: number } | null>(
    null,
  );
  const purchaseReturnTracking = useDocumentTracking(
    detailDrawerVisible && returnDetail?.id ? 'purchase_return' : undefined,
    returnDetail?.id,
    prRetTrackingRefreshKey,
  );

  const onFullChainGraphNodeClick = useCallback(
    (type: string, id: number) => {
      if (!id) return;
      if (type === 'purchase_return' && returnDetail?.id != null && id === returnDetail.id) {
        setFullChainBriefDoc(null);
        return;
      }
      setFullChainBriefDoc({ document_type: type, document_id: id });
    },
    [returnDetail?.id],
  );

  useEffect(() => {
    if (detailDrawerVisible && returnDetail?.id != null) {
      setFullChainBriefDoc(null);
    }
  }, [detailDrawerVisible, returnDetail?.id]);

  const handleDetail = async (record: PurchaseReturn) => {
    try {
      const detail = await warehouseApi.purchaseReturn.get(record.id!.toString());
      setReturnDetail(detail as PurchaseReturnDetail);
      setDetailDrawerVisible(true);
      setPrRetTrackingRefreshKey((k) => k + 1);
      setFullChainRefreshKey((k) => k + 1);
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
            setPrRetTrackingRefreshKey((k) => k + 1);
            setFullChainRefreshKey((k) => k + 1);
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
  }, [prStats, token]);

  return (
    <>
      <ListPageTemplate statCards={statCards}>
        <UniTable<PurchaseReturn>
          headerTitle="采购退货单"
          columnPersistenceId="apps.kuaizhizao.pages.purchase-management.purchase-returns"
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
          selectedRowKeys={selectedRowKeys}
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

      {detailDrawerVisible && returnDetail?.id != null ? (
        <>
          <div
            role="complementary"
            aria-label={t('components.documentTrackingPanel.relationsFullChainTitle')}
            style={{
              position: 'fixed',
              left: PR_RET_DETAIL_CHAIN_FLOAT_MARGIN,
              top: PR_RET_DETAIL_CHAIN_FLOAT_MARGIN,
              width: prRetDetailChainPanelWidthCss,
              height: prRetDetailChainHalfHeightCss,
              zIndex: purchaseReturnChainOverlayZIndex,
              boxSizing: 'border-box',
              padding: 16,
              borderRadius: token.borderRadiusLG,
              background: 'var(--ant-color-bg-container)',
              borderRight: '1px solid var(--ant-color-border)',
              borderBottom: '1px solid var(--ant-color-border)',
              boxShadow: 'var(--ant-box-shadow-secondary)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <div style={{ flexShrink: 0, marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--ant-color-text)' }}>
                    {t('components.documentTrackingPanel.relationsFullChainTitle')}
                  </div>
                </div>
                <Button
                  type="default"
                  size="small"
                  icon={<ReloadOutlined />}
                  loading={fullChainTraceLoading}
                  style={{ flexShrink: 0 }}
                  onClick={() => setFullChainRefreshKey((k) => k + 1)}
                >
                  {t('components.documentRelationGraph.refresh')}
                </Button>
              </div>
            </div>
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <DocumentTrackingRelationsTabsBody
                documentType="purchase_return"
                documentId={returnDetail.id}
                refreshKey={fullChainRefreshKey}
                onDocumentClick={onFullChainGraphNodeClick}
                compact
                hideInlineRefresh
                onTraceLoadingChange={setFullChainTraceLoading}
              />
            </div>
          </div>

          <div
            role="complementary"
            aria-label={t('components.documentTrackingPanel.traceBriefTitle')}
            style={{
              position: 'fixed',
              left: PR_RET_DETAIL_CHAIN_FLOAT_MARGIN,
              top: prRetDetailBriefPanelTopCss,
              width: prRetDetailChainPanelWidthCss,
              height: prRetDetailChainHalfHeightCss,
              zIndex: purchaseReturnChainOverlayZIndex,
              boxSizing: 'border-box',
              padding: 16,
              borderRadius: token.borderRadiusLG,
              background: 'var(--ant-color-bg-container)',
              borderRight: '1px solid var(--ant-color-border)',
              borderBottom: '1px solid var(--ant-color-border)',
              boxShadow: 'var(--ant-box-shadow-secondary)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                fontWeight: 600,
                fontSize: 13,
                marginBottom: 8,
                flexShrink: 0,
                color: 'var(--ant-color-text)',
              }}
            >
              {t('components.documentTrackingPanel.traceBriefTitle')}
            </div>
            <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
              <TraceLinkedDocumentBrief
                documentType={fullChainBriefDoc?.document_type}
                documentId={fullChainBriefDoc?.document_id}
                compactChrome
              />
            </div>
            {fullChainBriefDoc ? (
              <div
                style={{
                  flexShrink: 0,
                  marginTop: 8,
                  paddingTop: 10,
                  borderTop: '1px solid var(--ant-color-border)',
                  display: 'flex',
                  justifyContent: 'flex-end',
                }}
              >
                <Space wrap>
                  <Button onClick={() => setFullChainBriefDoc(null)}>
                    {t('components.documentTrackingPanel.traceBriefDismiss')}
                  </Button>
                  {fullChainBriefDoc.document_type === 'purchase_order' ? (
                    <Button
                      type="primary"
                      onClick={() => {
                        setDetailDrawerVisible(false);
                        navigate(ROUTES.PURCHASE_ORDERS);
                      }}
                    >
                      {t('components.documentTrackingPanel.traceBriefOpenPurchaseOrder', { defaultValue: '前往采购订单' })}
                    </Button>
                  ) : null}
                  {fullChainBriefDoc.document_type === 'receipt_notice' ? (
                    <Button
                      type="primary"
                      onClick={() => {
                        setDetailDrawerVisible(false);
                        navigate(ROUTES.RECEIPT_NOTICES);
                      }}
                    >
                      {t('components.documentTrackingPanel.traceBriefOpenReceiptNotice', { defaultValue: '前往收货通知' })}
                    </Button>
                  ) : null}
                </Space>
              </div>
            ) : null}
          </div>
        </>
      ) : null}

      <DetailDrawerTemplate
        title={`采购退货单详情${returnDetail?.return_code ? ` - ${returnDetail.return_code}` : ''}`}
        open={detailDrawerVisible}
        zIndex={purchaseReturnDetailDrawerZIndex}
        onClose={() => {
          setDetailDrawerVisible(false);
          setReturnDetail(null);
          setFullChainBriefDoc(null);
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
                        hideNextStepSuggestions
                      />
                    );
                  })()}
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
