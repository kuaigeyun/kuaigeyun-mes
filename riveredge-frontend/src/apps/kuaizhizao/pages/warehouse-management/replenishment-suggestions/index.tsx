/**
 * 补货建议管理页面
 *
 * 提供补货建议的查看、生成、处理与下推采购功能。
 *
 * @author RiverEdge Team
 * @date 2026-01-17
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useInvalidateMenuBadgeCounts } from '../../../../../hooks/useInvalidateMenuBadgeCounts';
import { ActionType, ProColumns, ProDescriptionsItemProps, ProForm, ProFormRadio, ProFormTextArea } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Modal, Descriptions, Select } from 'antd';
import { CheckOutlined, ReloadOutlined, ExclamationCircleOutlined, StopOutlined, CalculatorOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import {
  MaterialStackedCell,
  UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
} from '../../../../../components/uni-table/stackedPrimaryColumn';
import {   useDetailDrawerDescriptionItems, DetailDrawerTemplate, DRAWER_CONFIG, ListPageTemplate } from '../../../../../components/layout-templates';
import { rowActionKind, rowActionLabelKeep } from '../../../../../components/uni-action';
import { UniBatchMenuButton, runCapabilityBatchLoop } from '../../../../../components/uni-batch';
import { buildUniPushMenuItems, UniPushToolbarButton } from '../../../../../components/uni-push';
import { MarkerTag } from '../../../../../constants/statusBadges';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import {
  replenishmentBatchIgnoreAllowed,
  replenishmentBatchProcessAllowed,
  replenishmentBatchPushPurchaseOrderAllowed,
  replenishmentBatchPushPurchaseRequisitionAllowed,
} from '../../../../../hooks/useDocumentCapabilities';
import { resolveKuaizhizaoDocumentAction } from '../../../constants/documentActionRegistry';
import { warehouseApi } from '../../../services/production';
import { listDemandComputations } from '../../../services/demand-computation';
import { formatDateTime } from '../../../../../utils/format';
import { buildDocumentAuditColumns } from '../../shared/documentAuditColumns';
import {
  WAREHOUSE_DOC_PINNED_STATUS_FIELD,
  buildReplenishmentSuggestionStatusValueEnum,
  normalizeWarehouseListResponse,
  resolveReplenishmentSuggestionListParams,
} from '../../../utils/warehouseListCore';
import { resolveListLifecycleStageFromSearch } from '../../../../../utils/listLifecycleStage';
import { alignProColumns } from '../../sales-management/shared/documentFieldAlignment';
import { WAREHOUSE_DOC_LIST_FIELD_RANK } from '../shared/warehouseDocListFieldRank';

interface ReplenishmentSuggestion {
  id?: number;
  tenant_id?: number;
  uuid?: string;
  material_id?: number;
  material_code?: string;
  material_name?: string;
  warehouse_id?: number;
  warehouse_name?: string;
  current_quantity?: number;
  safety_stock?: number;
  min_stock?: number;
  max_stock?: number;
  suggested_quantity?: number;
  priority?: string;
  suggestion_type?: string;
  estimated_delivery_days?: number;
  suggested_order_date?: string;
  supplier_id?: number;
  supplier_name?: string;
  status?: string;
  processed_by?: number;
  processed_by_name?: string;
  processed_at?: string;
  processing_notes?: string;
  alert_id?: number;
  related_demand_id?: number;
  related_demand_code?: string;
  remarks?: string;
  created_at?: string;
  updated_at?: string;
  capabilities?: {
    process?: { allowed?: boolean; reason?: string };
    ignore?: { allowed?: boolean; reason?: string };
    push_purchase_requisition?: { allowed?: boolean; reason?: string };
    push_purchase_order?: { allowed?: boolean; reason?: string };
  };
}

const SUGGESTION_TYPE_COLORS: Record<string, string> = {
  low_stock: 'orange',
  demand_based: 'blue',
  seasonal: 'geekblue',
};

const ReplenishmentSuggestionsPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi, modal } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const tableRowsRef = useRef<ReplenishmentSuggestion[]>([]);
  const invalidateMenuBadgeCounts = useInvalidateMenuBadgeCounts();
  const replenishmentPerms = useResourcePermissions('kuaizhizao:warehouse-management-replenishment-suggestions');
  const purchaseRequisitionPerms = useResourcePermissions('kuaizhizao:purchase-requisition');
  const purchaseOrderPerms = useResourcePermissions('kuaizhizao:purchase-order');

  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [suggestionDetail, setSuggestionDetail] = useState<ReplenishmentSuggestion | null>(null);

  const [processModalVisible, setProcessModalVisible] = useState(false);
  const [processSuggestion, setProcessSuggestion] = useState<ReplenishmentSuggestion | null>(null);
  const [processStatus, setProcessStatus] = useState<string>('processed');
  const [processNotes, setProcessNotes] = useState<string>('');

  const [demandModalVisible, setDemandModalVisible] = useState(false);
  const [demandComputationId, setDemandComputationId] = useState<number | undefined>();
  const [demandOptions, setDemandOptions] = useState<Array<{ label: string; value: number }>>([]);
  const [demandLoading, setDemandLoading] = useState(false);
  const [generatingDemand, setGeneratingDemand] = useState(false);

  const pushToPrAction = resolveKuaizhizaoDocumentAction(
    t,
    'purchase_requisition.pull_from_replenishment_suggestion',
  );
  const pushToPoAction = resolveKuaizhizaoDocumentAction(
    t,
    'purchase_order.pull_from_replenishment_suggestion',
  );

  const selectedRecordsForBatch = useMemo(
    () =>
      selectedRowKeys
        .map((key) => tableRowsRef.current.find((row) => String(row.id) === String(key)))
        .filter((row): row is ReplenishmentSuggestion => row != null),
    [selectedRowKeys],
  );

  const handleBatchSuccess = useCallback(() => {
    setSelectedRowKeys([]);
    invalidateMenuBadgeCounts();
    actionRef.current?.reload();
  }, [invalidateMenuBadgeCounts]);

  const runBatchMark = useCallback(
    async (keys: React.Key[], status: 'processed' | 'ignored') => {
      const capabilityKey = status === 'processed' ? 'process' : 'ignore';
      await runCapabilityBatchLoop({
        keys,
        records: selectedRecordsForBatch,
        capabilityKey,
        permAllowed: replenishmentPerms.canUpdate,
        notAllowedMessage: t('app.kuaizhizao.replenishmentSuggestions.msgSelectSuggestions'),
        onRun: (id) =>
          warehouseApi.replenishmentSuggestion.process(String(id), {
            status,
          }),
        message: messageApi,
        t,
        onSuccess: handleBatchSuccess,
      });
    },
    [handleBatchSuccess, messageApi, replenishmentPerms.canUpdate, selectedRecordsForBatch, t],
  );

  const suggestionTypeLabel = (type?: string) => {
    const typeMap: Record<string, string> = {
      low_stock: t('app.kuaizhizao.replenishmentSuggestions.typeLowStock'),
      demand_based: t('app.kuaizhizao.replenishmentSuggestions.typeDemandBased'),
      seasonal: t('app.kuaizhizao.replenishmentSuggestions.typeSeasonal'),
    };
    return type ? typeMap[type] || type : '-';
  };

  const renderSuggestionTypeTag = (type?: string) => {
    if (!type) return '-';
    return (
      <MarkerTag color={SUGGESTION_TYPE_COLORS[type] ?? 'default'}>
        {suggestionTypeLabel(type)}
      </MarkerTag>
    );
  };

  const priorityConfig = (priority?: string) => {
    const priorityMap: Record<string, { text: string; color: string }> = {
      high: { text: t('app.kuaizhizao.warehouseCommon.priorityHigh'), color: 'error' },
      medium: { text: t('app.kuaizhizao.warehouseCommon.priorityMedium'), color: 'warning' },
      low: { text: t('app.kuaizhizao.warehouseCommon.priorityLow'), color: 'default' },
    };
    return priorityMap[priority || ''] || priorityMap.medium;
  };

  const statusConfig = (status?: string) => {
    const statusMap: Record<string, { text: string; color: string }> = {
      pending: { text: t('app.kuaizhizao.warehouseCommon.statusPending'), color: 'default' },
      processed: { text: t('app.kuaizhizao.replenishmentSuggestions.statusProcessed'), color: 'success' },
      ignored: { text: t('app.kuaizhizao.warehouseCommon.statusIgnored'), color: 'error' },
    };
    const key = status || '';
    return statusMap[key] || { text: key || '-', color: 'default' };
  };

  const canPushPr = replenishmentBatchPushPurchaseRequisitionAllowed(
    selectedRecordsForBatch,
    replenishmentPerms.canUpdate,
    purchaseRequisitionPerms.canCreate,
  );
  const canPushPo = replenishmentBatchPushPurchaseOrderAllowed(
    selectedRecordsForBatch,
    replenishmentPerms.canUpdate,
    purchaseOrderPerms.canCreate,
  );

  const runPush = useCallback(
    async (target: 'purchase_requisition' | 'purchase_order') => {
      const ids = selectedRecordsForBatch
        .filter((r) =>
          target === 'purchase_requisition'
            ? r.capabilities?.push_purchase_requisition?.allowed
            : r.capabilities?.push_purchase_order?.allowed,
        )
        .map((r) => Number(r.id))
        .filter((id) => Number.isFinite(id) && id > 0);
      if (ids.length === 0) {
        messageApi.warning(t('app.kuaizhizao.replenishmentSuggestions.msgSelectSuggestions'));
        return;
      }
      try {
        const preview =
          target === 'purchase_requisition'
            ? await warehouseApi.replenishmentSuggestion.previewPushToPurchaseRequisition(ids)
            : await warehouseApi.replenishmentSuggestion.previewPushToPurchaseOrder(ids);
        if (preview?.has_blocking_issues) {
          messageApi.error(
            preview.blocking_reason || t('app.kuaizhizao.replenishmentSuggestions.msgPushBlocked'),
          );
          return;
        }
        modal.confirm({
          title:
            target === 'purchase_requisition'
              ? t('app.kuaizhizao.replenishmentSuggestions.msgPushPrConfirm', { count: ids.length })
              : t('app.kuaizhizao.replenishmentSuggestions.msgPushPoConfirm', { count: ids.length }),
          content: preview?.tip,
          onOk: async () => {
            const result =
              target === 'purchase_requisition'
                ? await warehouseApi.replenishmentSuggestion.pushToPurchaseRequisition(ids)
                : await warehouseApi.replenishmentSuggestion.pushToPurchaseOrder(ids);
            messageApi.success(
              result?.message || t('app.kuaizhizao.replenishmentSuggestions.msgPushSuccess'),
            );
            handleBatchSuccess();
          },
        });
      } catch (error: any) {
        messageApi.error(error?.message || t('app.kuaizhizao.replenishmentSuggestions.msgPushFailed'));
      }
    },
    [handleBatchSuccess, messageApi, modal, selectedRecordsForBatch, t],
  );

  const toolbarPushMenuItems = useMemo(
    () =>
      buildUniPushMenuItems([
        {
          key: 'push-purchase-requisition',
          label: pushToPrAction.label,
          disabled: !canPushPr,
          title: !canPushPr
            ? t('app.kuaizhizao.replenishmentSuggestions.msgSelectSuggestions')
            : undefined,
          onClick: () => void runPush('purchase_requisition'),
        },
        {
          key: 'push-purchase-order',
          label: pushToPoAction.label,
          disabled: !canPushPo,
          title: !canPushPo
            ? t('app.kuaizhizao.replenishmentSuggestions.msgPushPoDisabled')
            : undefined,
          onClick: () => void runPush('purchase_order'),
        },
      ]),
    [canPushPo, canPushPr, pushToPoAction.label, pushToPrAction.label, runPush, t],
  );

  const pushToolbarDisabled = selectedRowKeys.length === 0 || (!canPushPr && !canPushPo);
  const pushToolbarDisabledReason =
    selectedRowKeys.length === 0
      ? t('app.kuaizhizao.replenishmentSuggestions.msgSelectSuggestions')
      : t('app.kuaizhizao.replenishmentSuggestions.msgPushUnavailable');

  const columns: ProColumns<ReplenishmentSuggestion>[] = useMemo(() => [
    {
      title: t('app.kuaizhizao.warehouseCommon.colMaterial'),
      key: 'material_name',
      dataIndex: 'material_name',
      ...UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
      fixed: 'left',
      render: (_, r) => (
        <MaterialStackedCell material_name={r.material_name} material_code={r.material_code} />
      ),
    },
    { title: t('app.kuaizhizao.warehouseReports.colMaterialCode'), dataIndex: 'material_code', hideInTable: true },
    { title: t('app.kuaizhizao.warehouseReports.colMaterialName'), dataIndex: 'material_name', hideInTable: true },
    {
      title: t('app.kuaizhizao.warehouseReports.colWarehouse'),
      dataIndex: 'warehouse_name',
      width: 120,
      ellipsis: true,
    },
    {
      title: t('app.kuaizhizao.replenishmentSuggestions.colCurrentStock'),
      dataIndex: 'current_quantity',
      width: 100,
      align: 'right',
      sorter: true,
    },
    {
      title: t('app.kuaizhizao.replenishmentSuggestions.colSafetyStock'),
      dataIndex: 'safety_stock',
      width: 100,
      align: 'right',
    },
    {
      title: t('app.kuaizhizao.replenishmentSuggestions.colSuggestedQty'),
      dataIndex: 'suggested_quantity',
      width: 120,
      align: 'right',
      sorter: true,
      render: (_, record) => (
        <span style={{ fontWeight: 'bold', color: '#1890ff' }}>{record.suggested_quantity}</span>
      ),
    },
    {
      title: t('app.kuaizhizao.replenishmentSuggestions.colPriority'),
      dataIndex: 'priority',
      width: 100,
      render: (priority) => {
        const config = priorityConfig(String(priority ?? ''));
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: t('app.kuaizhizao.replenishmentSuggestions.colSuggestionType'),
      dataIndex: 'suggestion_type',
      width: 120,
      render: (type) => renderSuggestionTypeTag(String(type ?? '')),
    },
    {
      title: t('app.kuaizhizao.replenishmentSuggestions.colSupplier'),
      dataIndex: 'supplier_name',
      width: 140,
      ellipsis: true,
      render: (_, r) => r.supplier_name || '-',
    },
    {
      title: t('app.kuaizhizao.replenishmentSuggestions.colEstimatedDeliveryDays'),
      dataIndex: 'estimated_delivery_days',
      width: 110,
      align: 'right',
      render: (_, r) => (r.estimated_delivery_days != null ? r.estimated_delivery_days : '-'),
    },
    {
      title: t('app.kuaizhizao.warehouseCommon.colStatus'),
      dataIndex: 'status',
      hideInTable: true,
      valueType: 'select',
      valueEnum: buildReplenishmentSuggestionStatusValueEnum(t),
    },
    {
      title: t('app.kuaizhizao.replenishmentSuggestions.colSuggestedOrderDate'),
      dataIndex: 'suggested_order_date',
      valueType: 'dateTime',
      width: 132,
      uniTableKeepWidth: true,
      sorter: true,
      render: (_, record) => formatDateTime(record.suggested_order_date),
    },
    ...buildDocumentAuditColumns<Record<string, unknown>>(t),
    {
      title: t('app.kuaizhizao.warehouseCommon.colActions'),
      width: 150,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button {...rowActionKind('read')} onClick={() => handleDetail(record)} />
          {record.capabilities?.process?.allowed && replenishmentPerms.canUpdate && (
            <Button {...rowActionKind('execute')} {...rowActionLabelKeep()} onClick={() => handleProcess(record)}>
              {t('app.kuaizhizao.warehouseCommon.handle')}
            </Button>
          )}
        </Space>
      ),
    },
  ], [t, replenishmentPerms]);

  const handleDetail = async (record: ReplenishmentSuggestion) => {
    setDetailDrawerVisible(true);
    setDetailLoading(true);
    setSuggestionDetail(null);
    try {
      const detail = await warehouseApi.replenishmentSuggestion.get(record.id!.toString());
      setSuggestionDetail(detail);
    } catch {
      messageApi.error(t('app.kuaizhizao.replenishmentSuggestions.msgGetDetailFailed'));
      setDetailDrawerVisible(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleProcess = (record: ReplenishmentSuggestion) => {
    setProcessSuggestion(record);
    setProcessStatus('processed');
    setProcessNotes('');
    setProcessModalVisible(true);
  };

  const handleProcessSubmit = async () => {
    if (!processSuggestion) return;
    try {
      await warehouseApi.replenishmentSuggestion.process(processSuggestion.id!.toString(), {
        status: processStatus,
        processing_notes: processNotes,
      });
      messageApi.success(t('app.kuaizhizao.replenishmentSuggestions.msgProcessSuccess'));
      setProcessModalVisible(false);
      setProcessSuggestion(null);
      handleBatchSuccess();
    } catch (error: any) {
      messageApi.error(error.message || t('app.kuaizhizao.replenishmentSuggestions.msgProcessFailed'));
    }
  };

  const showGenerateSummary = (result: {
    created?: number;
    skipped_existing?: number;
    skipped_zero_qty?: number;
  }) => {
    messageApi.success(
      t('app.kuaizhizao.replenishmentSuggestions.msgGenerateSummary', {
        created: result.created ?? 0,
        skippedExisting: result.skipped_existing ?? 0,
        skippedZero: result.skipped_zero_qty ?? 0,
      }),
    );
  };

  const handleGenerateFromAlerts = async () => {
    modal.confirm({
      title: t('app.kuaizhizao.replenishmentSuggestions.msgGenerateTitle'),
      content: t('app.kuaizhizao.replenishmentSuggestions.msgGenerateContent'),
      onOk: async () => {
        try {
          const result = await warehouseApi.replenishmentSuggestion.generateFromAlerts();
          showGenerateSummary(result || {});
          invalidateMenuBadgeCounts();
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || t('app.kuaizhizao.replenishmentSuggestions.msgGenerateFailed'));
        }
      },
    });
  };

  const openDemandGenerateModal = async () => {
    setDemandModalVisible(true);
    setDemandComputationId(undefined);
    setDemandLoading(true);
    try {
      const res = await listDemandComputations({
        computation_status: '完成',
        limit: 50,
        skip: 0,
      });
      const raw = res as { data?: any[]; items?: any[] };
      const items = raw?.data || raw?.items || [];
      setDemandOptions(
        items
          .filter((item) => item.id != null)
          .map((item) => ({
            value: Number(item.id),
            label: `${item.computation_code || item.id}${item.demand_code ? ` / ${item.demand_code}` : ''}`,
          })),
      );
    } catch (error: any) {
      messageApi.error(error?.message || t('app.kuaizhizao.replenishmentSuggestions.msgLoadDemandFailed'));
      setDemandOptions([]);
    } finally {
      setDemandLoading(false);
    }
  };

  const handleGenerateFromDemand = async () => {
    if (!demandComputationId) {
      messageApi.warning(t('app.kuaizhizao.replenishmentSuggestions.msgSelectDemandComputation'));
      return;
    }
    setGeneratingDemand(true);
    try {
      const result = await warehouseApi.replenishmentSuggestion.generateFromDemandComputation({
        demand_computation_id: demandComputationId,
      });
      showGenerateSummary(result || {});
      setDemandModalVisible(false);
      invalidateMenuBadgeCounts();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error?.message || t('app.kuaizhizao.replenishmentSuggestions.msgGenerateFailed'));
    } finally {
      setGeneratingDemand(false);
    }
  };

  const detailColumns: ProDescriptionsItemProps<ReplenishmentSuggestion>[] = useMemo(() => [
    {
      title: t('app.kuaizhizao.warehouseReports.colMaterialCode'),
      dataIndex: 'material_code',
    },
    {
      title: t('app.kuaizhizao.warehouseReports.colMaterialName'),
      dataIndex: 'material_name',
    },
    {
      title: t('app.kuaizhizao.warehouseReports.colWarehouse'),
      dataIndex: 'warehouse_name',
    },
    {
      title: t('app.kuaizhizao.replenishmentSuggestions.colCurrentStock'),
      dataIndex: 'current_quantity',
    },
    {
      title: t('app.kuaizhizao.replenishmentSuggestions.colSafetyStock'),
      dataIndex: 'safety_stock',
    },
    {
      title: t('app.kuaizhizao.replenishmentSuggestions.colMinStock'),
      dataIndex: 'min_stock',
    },
    {
      title: t('app.kuaizhizao.replenishmentSuggestions.colMaxStock'),
      dataIndex: 'max_stock',
    },
    {
      title: t('app.kuaizhizao.replenishmentSuggestions.colSuggestedQty'),
      dataIndex: 'suggested_quantity',
      render: (_, record) => (
        <span style={{ fontWeight: 'bold', color: '#1890ff' }}>{record.suggested_quantity}</span>
      ),
    },
    {
      title: t('app.kuaizhizao.replenishmentSuggestions.colPriority'),
      dataIndex: 'priority',
      render: (_, record) => {
        const config = priorityConfig(record.priority);
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: t('app.kuaizhizao.replenishmentSuggestions.colSuggestionType'),
      dataIndex: 'suggestion_type',
      render: (_, record) => renderSuggestionTypeTag(record.suggestion_type),
    },
    {
      title: t('app.kuaizhizao.replenishmentSuggestions.colEstimatedDeliveryDays'),
      dataIndex: 'estimated_delivery_days',
    },
    {
      title: t('app.kuaizhizao.replenishmentSuggestions.colSuggestedOrderDate'),
      dataIndex: 'suggested_order_date',
      valueType: 'dateTime',
    },
    {
      title: t('app.kuaizhizao.replenishmentSuggestions.colSupplier'),
      dataIndex: 'supplier_name',
    },
    {
      title: t('app.kuaizhizao.replenishmentSuggestions.colRelatedDemand'),
      dataIndex: 'related_demand_code',
    },
    {
      title: t('app.kuaizhizao.warehouseCommon.colStatus'),
      dataIndex: 'status',
      render: (_, record) => {
        const config = statusConfig(record.status);
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: t('app.kuaizhizao.warehouseCommon.colRemarks'),
      dataIndex: 'remarks',
      span: 2,
      render: (text) => text || '-',
    },
  ], [t]);

  const timeconfigBasicItems = useDetailDrawerDescriptionItems(
    detailColumns,
    suggestionDetail,
    'replenishment_suggestion',
  );

  return (
    <>
      <ListPageTemplate
        statCards={[
          {
            title: t('app.kuaizhizao.replenishmentSuggestions.statPending'),
            value: 0,
            prefix: <ExclamationCircleOutlined />,
            valueStyle: { color: '#faad14' },
          },
          {
            title: t('app.kuaizhizao.replenishmentSuggestions.statHighPriority'),
            value: 0,
            suffix: t('app.kuaizhizao.replenishmentSuggestions.statUnit'),
            valueStyle: { color: '#f5222d' },
          },
          {
            title: t('app.kuaizhizao.replenishmentSuggestions.statProcessed'),
            value: 0,
            suffix: t('app.kuaizhizao.replenishmentSuggestions.statUnit'),
            valueStyle: { color: '#52c41a' },
          },
        ]}
      >
        <UniTable
          headerTitle={t('app.kuaizhizao.replenishmentSuggestions.headerTitle')}
          actionRef={actionRef}
          rowKey="id"
          columns={alignProColumns(columns, WAREHOUSE_DOC_LIST_FIELD_RANK)}
          columnPersistenceId="apps.kuaizhizao.pages.warehouse-management.replenishment-suggestions"
          showAdvancedSearch={true}
          pinnedTabsField={WAREHOUSE_DOC_PINNED_STATUS_FIELD}
          skipFuzzyPinyinClientFilter
          enableRowSelection={replenishmentPerms.canUpdate}
          selectedRowKeys={selectedRowKeys}
          onRowSelectionChange={setSelectedRowKeys}
          rowSelectionGetCheckboxProps={(record) => ({
            disabled: !record.capabilities?.process?.allowed,
          })}
          onTableDataChange={(rows) => {
            tableRowsRef.current = rows;
          }}
          request={async (params, sort, _filter, searchFormValues) => {
            try {
              const lifecycleStage = resolveListLifecycleStageFromSearch(searchFormValues, params);
              const listParams = resolveReplenishmentSuggestionListParams(searchFormValues, sort);
              const response = await warehouseApi.replenishmentSuggestion.list({
                skip: (params.current! - 1) * params.pageSize!,
                limit: params.pageSize,
                ...listParams,
                status: lifecycleStage ?? listParams.status,
              });
              const { data, total } = normalizeWarehouseListResponse(response);
              return { data, success: true, total };
            } catch {
              messageApi.error(t('app.kuaizhizao.replenishmentSuggestions.msgListFailed'));
              return {
                data: [],
                success: false,
                total: 0,
              };
            }
          }}
          toolBarRender={() => [
            ...(replenishmentPerms.canCreate
              ? [
                  <Button
                    key="generate-alerts"
                    type="primary"
                    icon={<ReloadOutlined />}
                    onClick={() => void handleGenerateFromAlerts()}
                  >
                    {t('app.kuaizhizao.replenishmentSuggestions.actionGenerateFromAlerts')}
                  </Button>,
                  <Button
                    key="generate-demand"
                    icon={<CalculatorOutlined />}
                    onClick={() => void openDemandGenerateModal()}
                  >
                    {t('app.kuaizhizao.replenishmentSuggestions.actionGenerateFromDemand')}
                  </Button>,
                ]
              : []),
            ...(replenishmentPerms.canUpdate
              ? [
                  <UniPushToolbarButton
                    key="replenishment-push"
                    menuItems={toolbarPushMenuItems}
                    disabled={pushToolbarDisabled}
                    disabledReason={pushToolbarDisabledReason}
                  />,
                ]
              : []),
          ]}
          toolBarActionsAfterDelete={
            replenishmentPerms.canUpdate
              ? [
                  <UniBatchMenuButton
                    key="replenishment-batch-ops"
                    selectedRowKeys={selectedRowKeys}
                    buttonText={t('app.kuaizhizao.warehouseCommon.batchOps')}
                    menuItems={[
                      {
                        key: 'mark-processed',
                        label: t('app.kuaizhizao.warehouseCommon.batchMarkProcessed'),
                        icon: <CheckOutlined />,
                        disabled: !replenishmentBatchProcessAllowed(
                          selectedRecordsForBatch,
                          replenishmentPerms.canUpdate,
                        ),
                        requireConfirm: true,
                        confirmTitle: (count) =>
                          t('app.kuaizhizao.replenishmentSuggestions.msgBatchProcessConfirm', { count }),
                        onClick: (keys) => runBatchMark(keys, 'processed'),
                      },
                      {
                        key: 'mark-ignored',
                        label: t('app.kuaizhizao.warehouseCommon.batchMarkIgnored'),
                        icon: <StopOutlined />,
                        disabled: !replenishmentBatchIgnoreAllowed(
                          selectedRecordsForBatch,
                          replenishmentPerms.canUpdate,
                        ),
                        requireConfirm: true,
                        confirmTitle: (count) =>
                          t('app.kuaizhizao.replenishmentSuggestions.msgBatchIgnoreConfirm', { count }),
                        onClick: (keys) => runBatchMark(keys, 'ignored'),
                      },
                    ]}
                  />,
                ]
              : []
          }
        />
      </ListPageTemplate>

      <DetailDrawerTemplate
        title={
          suggestionDetail?.material_code
            ? t('app.kuaizhizao.replenishmentSuggestions.detailTitleWithCode', { code: suggestionDetail.material_code })
            : t('app.kuaizhizao.replenishmentSuggestions.detailTitle')
        }
        open={detailDrawerVisible}
        loading={detailLoading}
        onClose={() => {
          setDetailDrawerVisible(false);
          setSuggestionDetail(null);
        }}
        width={DRAWER_CONFIG.HALF_WIDTH}
        basic={
          suggestionDetail ? (
            <Descriptions column={2} size="small" items={timeconfigBasicItems} />
          ) : undefined
        }
      />

      <Modal
        title={t('app.kuaizhizao.replenishmentSuggestions.modalProcess')}
        open={processModalVisible}
        onOk={handleProcessSubmit}
        onCancel={() => {
          setProcessModalVisible(false);
          setProcessSuggestion(null);
          setProcessNotes('');
        }}
        okText={t('app.kuaizhizao.warehouseCommon.confirm')}
        cancelText={t('app.kuaizhizao.warehouseCommon.cancel')}
      >
        <ProForm
          submitter={false}
          initialValues={{
            status: processStatus,
            notes: processNotes,
          }}
          onValuesChange={(changedValues) => {
            if (changedValues.status !== undefined) {
              setProcessStatus(changedValues.status);
            }
            if (changedValues.notes !== undefined) {
              setProcessNotes(changedValues.notes);
            }
          }}
        >
          <ProFormRadio.Group
            name="status"
            label={t('app.kuaizhizao.replenishmentSuggestions.formProcessStatus')}
            options={[
              { label: t('app.kuaizhizao.replenishmentSuggestions.statusProcessed'), value: 'processed' },
              { label: t('app.kuaizhizao.replenishmentSuggestions.formIgnore'), value: 'ignored' },
            ]}
          />
          <ProFormTextArea
            name="notes"
            label={t('app.kuaizhizao.replenishmentSuggestions.formProcessNotes')}
            placeholder={t('app.kuaizhizao.replenishmentSuggestions.formProcessNotesPlaceholder')}
            fieldProps={{
              rows: 4,
            }}
          />
        </ProForm>
      </Modal>

      <Modal
        title={t('app.kuaizhizao.replenishmentSuggestions.modalGenerateFromDemand')}
        open={demandModalVisible}
        onOk={() => void handleGenerateFromDemand()}
        confirmLoading={generatingDemand}
        onCancel={() => setDemandModalVisible(false)}
        okText={t('app.kuaizhizao.warehouseCommon.confirm')}
        cancelText={t('app.kuaizhizao.warehouseCommon.cancel')}
      >
        <div style={{ marginBottom: 8 }}>
          {t('app.kuaizhizao.replenishmentSuggestions.formDemandComputation')}
        </div>
        <Select
          style={{ width: '100%' }}
          loading={demandLoading}
          placeholder={t('app.kuaizhizao.replenishmentSuggestions.formDemandComputationPlaceholder')}
          options={demandOptions}
          value={demandComputationId}
          onChange={(v) => setDemandComputationId(v)}
          showSearch
          optionFilterProp="label"
        />
      </Modal>
    </>
  );
};

export default ReplenishmentSuggestionsPage;
