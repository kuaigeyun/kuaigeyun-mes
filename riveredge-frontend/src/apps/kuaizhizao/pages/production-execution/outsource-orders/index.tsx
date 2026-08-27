/**
 * 工序委外管理页面
 *
 * 提供工序委外的 CRUD 功能；新建须经加载选源后进入录入表单。
 *
 * Author: Luigi Lu
 * Date: 2025-01-04
 * Updated: 2026-01-20（重命名为工序委外）
 */

import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { rowActionKind } from '../../../../../components/uni-action';
import { useInvalidateMenuBadgeCounts } from '../../../../../hooks/useInvalidateMenuBadgeCounts';
import { useNavigate } from 'react-router-dom';
import {
  ActionType,
  ProColumns,
  ProDescriptionsItemProps,
  ProFormSelect,
  ProFormDatePicker,
  ProFormDigit,
  ProFormTextArea,
  ProFormItem,
  ProFormText,
  ProFormDependency,
} from '@ant-design/pro-components';
import {
  App,
  Button,
  Tag,
  Space,
  Modal,
  Descriptions,
  Typography,
  Dropdown,
  Empty,
  Spin,
  Alert,
  Card,
  theme as AntdTheme,
} from 'antd';
import { EditOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import { UniTable, type UniTableRequestMeta} from '../../../../../components/uni-table';
import {
  UniTableStackedPrimaryCell,
  UNI_TABLE_STACKED_BADGE_DATETIME_COLUMN_DEFAULTS,
} from '../../../../../components/uni-table/stackedPrimaryColumn';
import {
  UniPullQueryModal,
  filterByPullScope,
  paginatePullRows,
  useUniPullQuery,
} from '../../../../../components/uni-pull-query';
import { UniDropdown } from '../../../../../components/uni-dropdown';
import {
  ListPageTemplate,
  FormModalTemplate,
  DetailDrawerTemplate,
  MODAL_CONFIG,
  DRAWER_CONFIG,
  useDetailDrawerDescriptionItems,
  type StatCard,
} from '../../../../../components/layout-templates';
import { SimpleSparkline } from '../../../../../components';
import CodeField from '../../../../../components/code-field';
import { outsourceOrderApi, workOrderApi } from '../../../services/production';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';
import { getOutsourceOrderLifecycle, buildOutsourceOrderLifecycleValueEnum, resolveOutsourceOrderListLifecycleParams } from '../../../utils/outsourceOrderLifecycle';
import { UniLifecycle, UniLifecycleStepper } from '../../../../../components/uni-lifecycle';
import { DocumentTrackingTimelineBody, useDocumentTracking } from '../../../../../components/document-tracking-panel';
import { WarehouseTraceBriefPrimaryActions } from '../../warehouse-management/WarehouseTraceBriefFooter';
import { searchReferenceDisplayAll } from '../../../../../utils/referenceDisplay';
import dayjs from 'dayjs';
import {formatDateTime, formatDateTimeBySiteSetting} from '../../../../../utils/format';
import { extractProTableSort } from '../../../../../utils/tableQueryKey';
import { formDateFormItemProps, formDateRangeFormItemProps, toApiDateTimeString } from '../../../../../utils/formDate';
import { alignProColumns, alignDescriptionColumns, SALES_DOC_LIST_FIELD_RANK } from '../../sales-management/shared/documentFieldAlignment';
import type { AuditPhaseRecord } from '../../../../../components/uni-audit/AuditPhaseBadge';
import { buildDocumentAuditColumns } from '../../shared/documentAuditColumns';
import { buildFutureDateShortcutFieldProps } from '../../../../../utils/futureDatePickerShortcuts';
import { useTranslation } from 'react-i18next';
import { useCustomFields } from '../../../../../hooks/useCustomFields';
import { useCustomFieldsForList } from '../../../../../hooks/useCustomFieldsForList';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import {
  CustomFieldsFormSection,
  CustomFieldsDetailSection,
  hasCustomFieldsDetailContent,
} from '../../../../../components/custom-fields';
import DocumentAttachmentsField from '../../../components/DocumentAttachmentsField';
import { mapAttachmentsToUploadList, normalizeDocumentAttachments } from '../../../utils/documentAttachments';
import { withSingleNewShortcutHint } from '../../../../../utils/globalNewShortcut';
import { getAntdModal } from '../../../../../utils/antdAppApis';
import { buildDocumentListHelpViewConfig, DOCUMENT_LIST_HELP_KEYS } from '../../../../../components/page-help-wiki';
const OUTSOURCE_ORDER_CUSTOM_FIELD_TABLE = 'apps_kuaizhizao_outsource_orders';
const OUTSOURCE_ORDER_HOST_RESOURCE = 'kuaizhizao:outsource-order';


interface OutsourceOrder {
  id?: number;
  tenant_id?: number;
  code?: string;
  work_order_id?: number;
  work_order_code?: string;
  work_order_operation_id?: number;
  operation_id?: number;
  operation_code?: string;
  operation_name?: string;
  supplier_id?: number;
  supplier_code?: string;
  supplier_name?: string;
  outsource_quantity?: number;
  received_quantity?: number;
  qualified_quantity?: number;
  unqualified_quantity?: number;
  unit_price?: number;
  total_amount?: number;
  planned_start_date?: string;
  planned_end_date?: string;
  actual_start_date?: string;
  actual_end_date?: string;
  status?: string;
  purchase_receipt_id?: number;
  purchase_receipt_code?: string;
  remarks?: string;
  attachments?: Array<{ uid?: string; name?: string; url?: string }>;
  created_at?: string;
  updated_at?: string;
}

interface PullOutsourceOperationCandidate {
  pull_row_key: string;
  work_order_id: number;
  work_order_code?: string;
  work_order_name?: string;
  product_name?: string;
  work_order_operation_id: number;
  operation_code?: string;
  operation_name?: string;
  sequence?: number;
  max_quantity: number;
  completed_quantity: number;
  already_outsourced_quantity: number;
  outsourceable_quantity: number;
  occupied_quantity: number;
}

interface Supplier {
  id: number;
  uuid: string;
  code: string;
  name: string;
  isActive: boolean;
}

const OO_STAT_SPARK_1 = [2, 3, 4, 3, 5, 4, 6];
const OO_STAT_SPARK_2 = [1, 2, 1, 0, 2, 1, 1];
const OO_STAT_SPARK_3 = [3, 4, 5, 6, 5, 7, 8];

export const OutsourceOrdersTable: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const { token } = AntdTheme.useToken();
  const outsourceOrderDetailDrawerZIndex = token.zIndexPopupBase;
  const actionRef = useRef<ActionType>(null);

  const invalidateMenuBadgeCounts = useInvalidateMenuBadgeCounts();
  const [statsVersion, setStatsVersion] = useState(0);
  const [localStats, setLocalStats] = useState({ total: 0, draft: 0, inProgress: 0 });
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);


  // Modal 相关状态
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentOutsourceOrder, setCurrentOutsourceOrder] = useState<OutsourceOrder | null>(null);
  const formRef = useRef<any>(null);

  const {
    customFields: outsourceFormCustomFields,
    customFieldValues: outsourceFormCustomFieldValues,
    loadFieldValues: loadOutsourceFormFieldValues,
    extractFormValues: extractOutsourceFormValues,
    saveCustomFieldValues: saveOutsourceCustomFieldValues,
    resetFieldValues: resetOutsourceFormFieldValues,
  } = useCustomFields({
    tableName: OUTSOURCE_ORDER_CUSTOM_FIELD_TABLE,
    hostResource: OUTSOURCE_ORDER_HOST_RESOURCE,
    loadWhenOpen: true,
    open: modalVisible,
  });

  const {
    customFields: outsourceListCustomFields,
    generateCustomFieldColumns: generateOutsourceCustomFieldColumns,
    enrichRecordsWithCustomFields: enrichOutsourceRecordsWithCustomFields,
    customFieldValues: outsourceDetailCustomFieldValues,
    loadFieldValuesForDetail: loadOutsourceFieldValuesForDetail,
    resetDetailFieldValues: resetOutsourceDetailFieldValues,
  } = useCustomFieldsForList<OutsourceOrder>({
    tableName: OUTSOURCE_ORDER_CUSTOM_FIELD_TABLE,
    hostResource: OUTSOURCE_ORDER_HOST_RESOURCE,
  });
  // Drawer 相关状态
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [outsourceOrderDetail, setOutsourceOrderDetail] = useState<OutsourceOrder | null>(null);

  const [ooTrackingRefreshKey, setOoTrackingRefreshKey] = useState(0);

  const outsourceOrderTracking = useDocumentTracking(
    detailDrawerVisible && outsourceOrderDetail?.id ? 'outsource_order' : undefined,
    outsourceOrderDetail?.id,
    ooTrackingRefreshKey,
  );

  // 供应商列表
  const [supplierList, setSupplierList] = useState<Supplier[]>([]);

  const [createModalVisible, setCreateModalVisible] = useState(false);
  const createFormRef = useRef<any>(null);
  const [createWorkOrder, setCreateWorkOrder] = useState<{
    id: number;
    code?: string;
    name?: string;
    product_name?: string;
  } | null>(null);
  const [createLockedOperation, setCreateLockedOperation] = useState<PullOutsourceOperationCandidate | null>(null);
  const [createMaxOutsourceQty, setCreateMaxOutsourceQty] = useState(0);

  const openCreateModalFromPullContext = useCallback(
    (workOrder: any, operation: PullOutsourceOperationCandidate) => {
      setCreateWorkOrder({
        id: Number(workOrder.id ?? operation.work_order_id),
        code: workOrder.code ?? operation.work_order_code,
        name: workOrder.name ?? operation.work_order_name,
        product_name: workOrder.product_name,
      });
      setCreateLockedOperation(operation);
      setCreateMaxOutsourceQty(Number(operation.outsourceable_quantity ?? 0));
      setCreateModalVisible(true);
      createFormRef.current?.resetFields();
      createFormRef.current?.setFieldsValue({
        work_order_operation_id: operation.work_order_operation_id,
      });
    },
    [],
  );

  const openOutsourceCreateFromSource = useCallback(
    async (workOrderId: number, workOrderOperationId: number) => {
      try {
        const [workOrder, optionsRes] = await Promise.all([
          workOrderApi.get(String(workOrderId)),
          outsourceOrderApi.getOutsourceOptions(String(workOrderId)),
        ]);
        const options = Array.isArray(optionsRes) ? optionsRes : [];
        const matched = options.find(
          (opt: any) => Number(opt.work_order_operation_id) === Number(workOrderOperationId),
        );
        if (!matched || Number(matched.outsourceable_quantity ?? 0) <= 0) {
          messageApi.warning(t('app.kuaizhizao.outsourceOrder.pullPreviewBlocked'));
          return;
        }
        const operationRow: PullOutsourceOperationCandidate = {
          pull_row_key: `${workOrderId}-${workOrderOperationId}`,
          work_order_id: workOrderId,
          work_order_code: workOrder.code,
          work_order_name: workOrder.name,
          product_name: workOrder.product_name,
          work_order_operation_id: Number(matched.work_order_operation_id),
          operation_code: matched.operation_code,
          operation_name: matched.operation_name,
          sequence: matched.sequence,
          max_quantity: Number(matched.max_quantity ?? 0),
          completed_quantity: Number(matched.completed_quantity ?? 0),
          already_outsourced_quantity: Number(matched.already_outsourced_quantity ?? 0),
          outsourceable_quantity: Number(matched.outsourceable_quantity ?? 0),
          occupied_quantity:
            Number(matched.completed_quantity ?? 0) + Number(matched.already_outsourced_quantity ?? 0),
        };
        openCreateModalFromPullContext(workOrder, operationRow);
      } catch (error: unknown) {
        messageApi.error(getApiErrorMessage(error, t('app.kuaizhizao.outsourceOrder.pullPreviewFailed')));
      }
    },
    [messageApi, openCreateModalFromPullContext, t],
  );

  const isPullOutsourceOperationSelectable = useCallback(
    (record: PullOutsourceOperationCandidate) => Number(record.outsourceable_quantity ?? 0) > 0,
    [],
  );

  const pullFromWorkOrderScopeOptions = useMemo(
    () => [
      { label: t('app.kuaizhizao.outsourceOrder.pullScopeOutsourceable'), value: 'outsourceable' },
      { label: t('app.kuaizhizao.outsourceOrder.pullScopeAll'), value: 'all' },
    ],
    [t],
  );

  const pullFromWorkOrderQuery = useUniPullQuery<PullOutsourceOperationCandidate>({
    rowKey: 'pull_row_key',
    selectionType: 'radio',
    scopeOptions: pullFromWorkOrderScopeOptions,
    defaultScope: 'outsourceable',
    loadData: async ({ keyword, page, pageSize, scope }) => {
      const normalizedKeyword = keyword.trim().toLowerCase();
      const chunkSize = 100;
      const maxRows = 1000;
      const workOrders: Array<{ id: number; code?: string; name?: string; product_name?: string; quantity?: number }> = [];
      let skip = 0;
      while (workOrders.length < maxRows) {
        const res = await workOrderApi.list({
          status: 'in_progress',
          code: normalizedKeyword || undefined,
          skip,
          limit: chunkSize,
        });
        const chunk = Array.isArray(res) ? res : (res as any)?.data ?? (res as any)?.items ?? [];
        if (!Array.isArray(chunk) || chunk.length === 0) break;
        workOrders.push(...chunk);
        if (chunk.length < chunkSize) break;
        skip += chunkSize;
      }
      const rows = (
        await Promise.all(
          workOrders.map(async (workOrder) => {
            if (!workOrder?.id) return [];
            const optionsRes = await outsourceOrderApi.getOutsourceOptions(String(workOrder.id));
            const options = Array.isArray(optionsRes) ? optionsRes : [];
            return options.map((opt: any) => ({
              pull_row_key: `${workOrder.id}-${opt.work_order_operation_id}`,
              work_order_id: Number(workOrder.id),
              work_order_code: workOrder.code,
              work_order_name: workOrder.name,
              product_name: workOrder.product_name,
              work_order_operation_id: Number(opt.work_order_operation_id),
              operation_code: opt.operation_code,
              operation_name: opt.operation_name,
              sequence: opt.sequence,
              max_quantity: Number(opt.max_quantity ?? 0),
              completed_quantity: Number(opt.completed_quantity ?? 0),
              already_outsourced_quantity: Number(opt.already_outsourced_quantity ?? 0),
              outsourceable_quantity: Number(opt.outsourceable_quantity ?? 0),
              occupied_quantity:
                Number(opt.completed_quantity ?? 0) + Number(opt.already_outsourced_quantity ?? 0),
            }));
          }),
        )
      ).flat();
      const keywordFiltered = normalizedKeyword
        ? rows.filter((row) => {
          const workOrderCode = String(row.work_order_code || '').toLowerCase();
          const workOrderName = String(row.work_order_name || '').toLowerCase();
          const operationCode = String(row.operation_code || '').toLowerCase();
          const operationName = String(row.operation_name || '').toLowerCase();
          return (
            workOrderCode.includes(normalizedKeyword)
            || workOrderName.includes(normalizedKeyword)
            || operationCode.includes(normalizedKeyword)
            || operationName.includes(normalizedKeyword)
          );
        })
        : rows;
      const filteredRows = filterByPullScope(keywordFiltered, scope, isPullOutsourceOperationSelectable);
      return paginatePullRows(filteredRows, page, pageSize);
    },
    isRowDisabled: (record) => !isPullOutsourceOperationSelectable(record),
    onConfirm: async (_selectedKeys, selectedRows) => {
      const selected = selectedRows[0];
      if (!selected?.work_order_id || !selected?.work_order_operation_id) {
        messageApi.warning(t('app.kuaizhizao.outsourceOrder.pullSelectOperationFirst'));
        return;
      }
      if (Number(selected.outsourceable_quantity ?? 0) <= 0) {
        messageApi.warning(t('app.kuaizhizao.outsourceOrder.pullPreviewBlocked'));
        return;
      }
      pullFromWorkOrderQuery.closeModal();
      await openOutsourceCreateFromSource(selected.work_order_id, selected.work_order_operation_id);
    },
  });

  const handleSubmitCreate = async (values: any): Promise<void> => {
    if (!createWorkOrder?.id || !createLockedOperation) {
      messageApi.error(t('app.kuaizhizao.outsourceOrder.createFromWorkOrder'));
      throw new Error(t('app.kuaizhizao.outsourceOrder.createFromWorkOrder'));
    }
    const outsourceQty = Number(values.outsource_quantity);
    if (!Number.isFinite(outsourceQty) || outsourceQty <= 0) {
      messageApi.error(t('app.kuaizhizao.outsourceOrder.ruleEnterOutsourceQty'));
      throw new Error('invalid qty');
    }
    if (outsourceQty > createMaxOutsourceQty) {
      messageApi.error(t('app.kuaizhizao.outsourceOrder.ruleEnterOutsourceQty'));
      throw new Error('exceed qty');
    }
    try {
      await outsourceOrderApi.createFromWorkOrder(String(createWorkOrder.id), {
        work_order_operation_id: createLockedOperation.work_order_operation_id,
        supplier_id: values.supplier_id,
        outsource_quantity: outsourceQty,
        unit_price: values.unit_price,
        planned_start_date: toApiDateTimeString(values.planned_start_date),
        planned_end_date: toApiDateTimeString(values.planned_end_date),
        remarks: values.remarks,
      });
      messageApi.success(t('app.kuaizhizao.outsourceOrder.createSuccess'));
      setCreateModalVisible(false);
      setCreateWorkOrder(null);
      setCreateLockedOperation(null);
      setCreateMaxOutsourceQty(0);
      createFormRef.current?.resetFields();
      invalidateMenuBadgeCounts();
      actionRef.current?.reload();
      setStatsVersion((v) => v + 1);
    } catch (error: any) {
      messageApi.error(error?.message || t('app.kuaizhizao.outsourceOrder.createFailed'));
      throw error;
    }
  };

  const refreshLocalStats = useCallback(async () => {
    try {
      const response = await outsourceOrderApi.list({ skip: 0, limit: 1000 });
      const arr = response.data ?? [];
      setLocalStats({
        total: arr.length,
        draft: arr.filter((x: OutsourceOrder) => (x.status || '').trim() === 'draft').length,
        inProgress: arr.filter((x: OutsourceOrder) => (x.status || '').trim() === 'in_progress').length,
      });
    } catch {
      setLocalStats({ total: 0, draft: 0, inProgress: 0 });
    }
  }, []);

  useEffect(() => {
    refreshLocalStats();
  }, [statsVersion, refreshLocalStats]);

  /**
   * 加载供应商列表
   */
  useEffect(() => {
    const loadSuppliers = async () => {
      try {
        const items = await searchReferenceDisplayAll({
          resource: 'master-data:supply-chain:supplier',
          hostResource: OUTSOURCE_ORDER_HOST_RESOURCE,
        });
        const suppliers: Supplier[] = items
          .filter((item) => item.id != null)
          .map((item) => ({
            id: item.id as number,
            uuid: String(item.uuid ?? ''),
            code: String(item.code ?? ''),
            name: String(item.name ?? item.label ?? ''),
            isActive: true,
          }));
        setSupplierList(suppliers);
      } catch (error) {
        window.console.error('获取数据失败:', error);
        messageApi.error(t('app.kuaizhizao.outsourceOrder.fetchDataFailed'));
      }
    };
    loadSuppliers();
  }, [messageApi, t]);

  const getOoStatusTag = useCallback(
    (status?: string) => {
      const m: Record<string, { text: string; color: string }> = {
        draft: { text: t('app.kuaizhizao.outsourceOrder.statusDraft'), color: 'default' },
        released: { text: t('app.kuaizhizao.outsourceOrder.statusReleased'), color: 'processing' },
        in_progress: { text: t('app.kuaizhizao.outsourceOrder.statusInProgress'), color: 'processing' },
        completed: { text: t('app.kuaizhizao.outsourceOrder.statusCompleted'), color: 'success' },
        cancelled: { text: t('app.kuaizhizao.outsourceOrder.statusCancelled'), color: 'error' },
      };
      const x = m[String(status)] || { text: String(status ?? '-'), color: 'default' };
      return <Tag color={x.color}>{x.text}</Tag>;
    },
    [t],
  );

  const statusFormOptions = useMemo(
    () => [
      { label: t('app.kuaizhizao.outsourceOrder.statusDraft'), value: 'draft' },
      { label: t('app.kuaizhizao.outsourceOrder.statusReleased'), value: 'released' },
      { label: t('app.kuaizhizao.outsourceOrder.statusInProgress'), value: 'in_progress' },
      { label: t('app.kuaizhizao.outsourceOrder.statusCompleted'), value: 'completed' },
      { label: t('app.kuaizhizao.outsourceOrder.statusCancelled'), value: 'cancelled' },
    ],
    [t],
  );

  const detailBaseColumns: ProDescriptionsItemProps<OutsourceOrder>[] = useMemo(
    () =>
      alignDescriptionColumns([
      {
        title: t('app.kuaizhizao.outsourceOrder.colCode'),
        dataIndex: 'code',
        key: 'outsource_order_code',
        render: (_, r) => (
          <Typography.Text copyable={{ text: String(r.code ?? '') }}>{r.code ?? '-'}</Typography.Text>
        ),
      },
      {
        title: t('app.kuaizhizao.outsourceOrder.colWorkOrderCode'),
        dataIndex: 'work_order_code',
        key: 'linked_work_order_code',
      },
      { title: t('app.kuaizhizao.outsourceOrder.colOperationName'), dataIndex: 'operation_name' },
      { title: t('app.kuaizhizao.outsourceOrder.colSupplierName'), dataIndex: 'supplier_name' },
      { title: t('app.kuaizhizao.outsourceOrder.colUnitPrice'), dataIndex: 'unit_price', valueType: 'money' },
      { title: t('app.kuaizhizao.outsourceOrder.colOutsourceQty'), dataIndex: 'outsource_quantity', valueType: 'digit' },
      { title: t('app.kuaizhizao.outsourceOrder.colTotalAmount'), dataIndex: 'total_amount', valueType: 'money' },
      { title: t('app.kuaizhizao.outsourceOrder.colReceivedQty'), dataIndex: 'received_quantity', valueType: 'digit' },
      { title: t('app.kuaizhizao.outsourceOrder.colQualifiedQty'), dataIndex: 'qualified_quantity', valueType: 'digit' },
      { title: t('app.kuaizhizao.outsourceOrder.colUnqualifiedQty'), dataIndex: 'unqualified_quantity', valueType: 'digit' },
      { title: t('app.kuaizhizao.outsourceOrder.colPlannedStart'), dataIndex: 'planned_start_date', valueType: 'dateTime' },
      { title: t('app.kuaizhizao.outsourceOrder.colPlannedEnd'), dataIndex: 'planned_end_date', valueType: 'dateTime' },
      {
        title: t('app.kuaizhizao.outsourceOrder.colActualStart'),
        dataIndex: 'actual_start_date',
        valueType: 'dateTime',
      },
      {
        title: t('app.kuaizhizao.outsourceOrder.colActualEnd'),
        dataIndex: 'actual_end_date',
        valueType: 'dateTime',
      },
      {
        title: t('app.kuaizhizao.outsourceOrder.colPurchaseReceiptCode'),
        dataIndex: 'purchase_receipt_code',
      },
    ] as ProDescriptionsItemProps<OutsourceOrder>[]),
    [t],
  );

  const detailRemarksColumn: ProDescriptionsItemProps<OutsourceOrder>[] = useMemo(
    () =>
      alignDescriptionColumns([
        {
          title: t('common.remark'),
          dataIndex: 'remarks',
          span: 3,
        },
      ] as ProDescriptionsItemProps<OutsourceOrder>[]),
    [t],
  );

  const outsourceDetailLifecycle = useMemo(
    () => (outsourceOrderDetail ? getOutsourceOrderLifecycle(outsourceOrderDetail as Record<string, unknown>) : null),
    [outsourceOrderDetail],
  );
  const outsourceNextSteps = outsourceDetailLifecycle?.nextStepSuggestions;
  const outsourceShowNextInTitle = Boolean(outsourceNextSteps?.length);

  const handleDetail = async (record: OutsourceOrder) => {
    try {
      const detail = await outsourceOrderApi.get(record.id!.toString());
      setOutsourceOrderDetail(detail);
      setDetailDrawerVisible(true);
      setOoTrackingRefreshKey((k) => k + 1);
      if (detail.id != null) {
        await loadOutsourceFieldValuesForDetail(detail.id);
      }
    } catch (error) {
      messageApi.error(t('app.kuaizhizao.outsourceOrder.fetchDetailFailed'));
    }
  };

  /**
   * 处理删除（从选中行）
   */
  const handleDelete = async (keys: React.Key[]) => {
    if (keys.length === 0) {
      messageApi.warning(t('app.kuaizhizao.outsourceOrder.selectToDelete'));
      return;
    }

    const ids = keys.map((k) => Number(k));
    try {
      await Promise.all(ids.map((id) => outsourceOrderApi.delete(id.toString())));
      messageApi.success(t('common.deleteSuccess'));
      setSelectedRowKeys([]);
      if (outsourceOrderDetail?.id != null && ids.includes(outsourceOrderDetail.id)) {
        setDetailDrawerVisible(false);
        setOutsourceOrderDetail(null);
      }
      setStatsVersion((v) => v + 1);
      invalidateMenuBadgeCounts();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('common.deleteFailed'));
    }
  };

  /**
   * 处理编辑（从记录）
   */
  const handleEditFromRecord = async (record: OutsourceOrder) => {
    try {
      const detail = await outsourceOrderApi.get(record.id!.toString());
      setIsEdit(true);
      setCurrentOutsourceOrder(detail);
      setModalVisible(true);
      window.setTimeout(() => {
        formRef.current?.setFieldsValue({
          code: detail.code,
          supplier_id: detail.supplier_id,
          outsource_quantity: detail.outsource_quantity,
          unit_price: detail.unit_price,
          status: detail.status,
          planned_start_date: detail.planned_start_date ? dayjs(detail.planned_start_date) : undefined,
          planned_end_date: detail.planned_end_date ? dayjs(detail.planned_end_date) : undefined,
          received_quantity: detail.received_quantity,
          qualified_quantity: detail.qualified_quantity,
          unqualified_quantity: detail.unqualified_quantity,
          remarks: detail.remarks,
          attachments: mapAttachmentsToUploadList(detail.attachments),
        });
        if (detail.id != null) {
          loadOutsourceFormFieldValues(detail.id).then((fieldFormValues) => {
            formRef.current?.setFieldsValue(fieldFormValues);
          });
        }
      }, 100);
    } catch (error) {
      messageApi.error(t('app.kuaizhizao.outsourceOrder.fetchDetailFailed'));
    }
  };

  /**
   * 处理删除（从记录）
   */
  const handleDeleteFromRecord = async (record: OutsourceOrder) => {
    getAntdModal().confirm({
      title: t('app.kuaizhizao.outsourceOrder.confirmDeleteTitle'),
      content: t('app.kuaizhizao.outsourceOrder.confirmDeleteContent', { code: record.code }),
      okText: t('common.confirm'),
      cancelText: t('common.cancel'),
      onOk: async () => {
        try {
          await outsourceOrderApi.delete(record.id!.toString());
          messageApi.success(t('common.deleteSuccess'));
          if (outsourceOrderDetail?.id === record.id) {
            setDetailDrawerVisible(false);
            setOutsourceOrderDetail(null);
          }
          setStatsVersion((v) => v + 1);
          invalidateMenuBadgeCounts();

          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || t('common.deleteFailed'));
        }
      },
    });
  };

  /** 工序委外单须经加载选源创建 */
  const handleCreate = () => {
    pullFromWorkOrderQuery.openModal();
  };
  useNewShortcut(handleCreate);
  const createButtonLabel = useMemo(
    () => withSingleNewShortcutHint(t('app.kuaizhizao.outsourceOrder.createButton')),
    [t],
  );

  /**
   * 处理提交表单（创建/更新）
   */
  const handleSubmitForm = async (values: any): Promise<void> => {
    try {
      const { customData, standardValues } = extractOutsourceFormValues(values);
      const submitData = {
        ...standardValues,
        attachments: normalizeDocumentAttachments(standardValues.attachments),
        planned_start_date: toApiDateTimeString(standardValues.planned_start_date),
        planned_end_date: toApiDateTimeString(standardValues.planned_end_date),
      };

      const oid = currentOutsourceOrder?.id;

      if (isEdit && oid) {
        await outsourceOrderApi.update(oid.toString(), submitData);
        await saveOutsourceCustomFieldValues(oid, customData);
        messageApi.success(t('app.kuaizhizao.outsourceOrder.updateSuccess'));
      } else {
        messageApi.warning(t('app.kuaizhizao.outsourceOrder.createFromWorkOrder'));
        throw new Error(t('app.kuaizhizao.outsourceOrder.createFromWorkOrder'));
      }
      setModalVisible(false);
      resetOutsourceFormFieldValues();
      invalidateMenuBadgeCounts();

      actionRef.current?.reload();
      setStatsVersion((v) => v + 1);
      if (oid && outsourceOrderDetail?.id === oid) {
        try {
          const fresh = await outsourceOrderApi.get(String(oid));
          setOutsourceOrderDetail(fresh);
          setOoTrackingRefreshKey((k) => k + 1);
          await loadOutsourceFieldValuesForDetail(oid);
        } catch {
          /* ignore */
        }
      }
    } catch (error: any) {
      messageApi.error(error.message || t('common.operationFailed'));
      throw error;
    }
  };

  const renderOoRowActionNodes = (record: OutsourceOrder): React.ReactNode[] => {
    const nodes: React.ReactNode[] = [];
    nodes.push(
      <Button {...rowActionKind('read')}
        key="detail"
        type="link"
        size="small"
        icon={<EyeOutlined />}
        onClick={(e) => {
          e.stopPropagation();
          void handleDetail(record);
        }}
      >
        {t('common.detail')}
      </Button>
    );
    nodes.push(
      <Button {...rowActionKind('update')}
        key="edit"
        type="link"
        size="small"
        icon={<EditOutlined />}
        disabled={record.status === 'completed' || record.status === 'cancelled'}
        onClick={(e) => {
          e.stopPropagation();
          void handleEditFromRecord(record);
        }}
      >
        {t('common.edit')}
      </Button>
    );
    nodes.push(
      <Button {...rowActionKind('delete')}
        key="delete"
        type="link"
        size="small"
        danger
        icon={<DeleteOutlined />}
        disabled={record.status === 'completed' || record.status === 'in_progress'}
        onClick={(e) => {
          e.stopPropagation();
          handleDeleteFromRecord(record);
        }}
      >
        {t('common.delete')}
      </Button>
    );
    return nodes;
  };

  const outsourceOrderLifecycleValueEnum = useMemo(() => buildOutsourceOrderLifecycleValueEnum(t), [t]);
  const supplierSearchValueEnum = useMemo(
    () =>
      Object.fromEntries(
        supplierList.map((s) => [String(s.id), { text: s.name || s.code }]),
      ),
    [supplierList],
  );

  const outsourceCustomFieldColumns = generateOutsourceCustomFieldColumns();
  const columns: ProColumns<OutsourceOrder>[] = useMemo(
    () => alignProColumns<OutsourceOrder>([
      {
        title: t('app.kuaizhizao.outsourceOrder.colPlannedStart'),
        dataIndex: 'planned_start_date_range',
        valueType: 'dateRange',
        hideInTable: true,
        hideInSearch: false,
        fieldProps: {
          placeholder: [t('app.kuaizhizao.quotation.dateRangeStart'), t('app.kuaizhizao.quotation.dateRangeEnd')],
        },
        formItemProps: formDateRangeFormItemProps,
      },
      {
        title: t('common.createdAt'),
        dataIndex: 'created_at_range',
        valueType: 'dateRange',
        hideInTable: true,
        hideInSearch: false,
        fieldProps: {
          placeholder: [t('app.kuaizhizao.quotation.dateRangeStart'), t('app.kuaizhizao.quotation.dateRangeEnd')],
        },
        formItemProps: formDateRangeFormItemProps,
      },
      {
        title: t('app.kuaizhizao.outsourceOrder.colCode'),
        dataIndex: 'code',
        width: 168,
        ellipsis: true,
        sorter: true,
        hideInTable: true,
        hideInSearch: false,
        render: (_, r) => (
          <Typography.Text copyable={{ text: String(r.code ?? '') }} ellipsis>
            {r.code ?? '-'}
          </Typography.Text>
        ),
      },
      {
        title: `${t('app.kuaizhizao.outsourceOrder.colSupplierName')} / ${t('app.kuaizhizao.outsourceOrder.colCode')}`,
        key: 'supplier_code_stacked',
        dataIndex: 'supplier_name',
        // 无行项目明细：供应商/单号叠列吃掉视口剩余（RemainderFlex）
        fixed: 'left',
        minWidth: 200,
        uniTablePrimaryFlex: true,
        uniTableRemainderFlex: true,
        resizable: false,
        ellipsis: false,
        hideInSearch: true,
        render: (_, record) => (
          <UniTableStackedPrimaryCell
            primary={String(record.supplier_name ?? '-')}
            secondary={String(record.code ?? '-')}
          />
        ),
      },
      {
        title: `${t('app.kuaizhizao.outsourceOrder.colPlannedStart')} / ${t('app.kuaizhizao.outsourceOrder.colPlannedEnd')}`,
        key: 'planned_range_stacked',
        dataIndex: 'planned_start_date',
        ...UNI_TABLE_STACKED_BADGE_DATETIME_COLUMN_DEFAULTS,
        sorter: true,
        hideInSearch: true,
        render: (_, record) => (
          <UniTableStackedPrimaryCell
            primary={record.planned_start_date ? formatDateTimeBySiteSetting(record.planned_start_date) : '-'}
            secondary={record.planned_end_date ? formatDateTimeBySiteSetting(record.planned_end_date) : '-'}
            secondaryCopyable={false}
            uniformText
            primaryBadge={t('common.start')}
            secondaryBadge={t('common.end')}
          />
        ),
      },
      {
        title: `${t('app.kuaizhizao.outsourceOrder.colOperationName')} / ${t('app.kuaizhizao.outsourceOrder.colWorkOrderCode')}`,
        key: 'operation_work_order_stacked',
        dataIndex: 'operation_name',
        width: 200,
        minWidth: 200,
        uniTableKeepWidth: true,
        uniTablePrimaryFlex: false,
        resizable: false,
        ellipsis: false,
        hideInSearch: true,
        render: (_, r) => (
          <UniTableStackedPrimaryCell
            primary={String(r.operation_name ?? '-')}
            secondary={String(r.work_order_code ?? '-')}
            secondaryCopyable={false}
          />
        ),
      },
      {
        title: t('app.kuaizhizao.outsourceOrder.colWorkOrderCode'),
        dataIndex: 'work_order_code',
        width: 148,
        ellipsis: true,
        sorter: true,
        hideInTable: true,
        hideInSearch: false,
        render: (_, r) => (
          <Typography.Text copyable={{ text: String(r.work_order_code ?? '') }} ellipsis>
            {r.work_order_code ?? '-'}
          </Typography.Text>
        ),
      },
      {
        title: t('app.kuaizhizao.outsourceOrder.colOperationName'),
        dataIndex: 'operation_name',
        width: 150,
        ellipsis: true,
        sorter: true,
        hideInTable: true,
        hideInSearch: false,
      },
      {
        title: t('app.kuaizhizao.outsourceOrder.colSupplierName'),
        dataIndex: 'supplier_id',
        width: 150,
        ellipsis: true,
        hideInTable: true,
        hideInSearch: false,
        valueType: 'select',
        valueEnum: supplierSearchValueEnum,
        render: (_, record) => record.supplier_name ?? '-',
      },
      {
        title: t('app.kuaizhizao.outsourceOrder.colUnitPrice'),
        dataIndex: 'unit_price',
        width: 100,
        minWidth: 100,
        uniTableKeepWidth: true,
        resizable: false,
        valueType: 'money',
        sorter: true,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.outsourceOrder.colOutsourceQty'),
        dataIndex: 'outsource_quantity',
        width: 100,
        minWidth: 100,
        uniTableKeepWidth: true,
        resizable: false,
        valueType: 'digit',
        sorter: true,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.outsourceOrder.colTotalAmount'),
        dataIndex: 'total_amount',
        width: 120,
        minWidth: 120,
        uniTableKeepWidth: true,
        resizable: false,
        valueType: 'money',
        sorter: true,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.outsourceOrder.colReceivedQty'),
        dataIndex: 'received_quantity',
        width: 100,
        minWidth: 100,
        uniTableKeepWidth: true,
        resizable: false,
        valueType: 'digit',
        sorter: true,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.outsourceOrder.colQualifiedQty'),
        dataIndex: 'qualified_quantity',
        width: 100,
        minWidth: 100,
        uniTableKeepWidth: true,
        resizable: false,
        valueType: 'digit',
        sorter: true,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.outsourceOrder.colPlannedStart'),
        dataIndex: 'planned_start_date',
        valueType: 'dateTime',
        width: 132,
        uniTableKeepWidth: true,
        sorter: true,
        hideInTable: true,
        hideInSearch: true,
        render: (_, record) =>
          record.planned_start_date ? formatDateTimeBySiteSetting(record.planned_start_date) : '-',
      },
      {
        title: t('app.kuaizhizao.outsourceOrder.colPlannedEnd'),
        dataIndex: 'planned_end_date',
        valueType: 'dateTime',
        width: 132,
        uniTableKeepWidth: true,
        sorter: true,
        hideInTable: true,
        hideInSearch: true,
        render: (_, record) =>
          record.planned_end_date ? formatDateTimeBySiteSetting(record.planned_end_date) : '-',
      },
      ...buildDocumentAuditColumns<OutsourceOrder>(t),
      {
        title: t('app.kuaizhizao.outsourceOrder.colLifecycle'),
        // 搜索仍绑 status；key 声明列身份，UniTable 据此给出与审核状态列一致的宽度与对齐
        key: 'lifecycle',
        dataIndex: 'status',
        fixed: 'right',
        hideInSearch: false,
        valueType: 'select',
        valueEnum: outsourceOrderLifecycleValueEnum,
        render: (_, record) => {
          const lifecycle = getOutsourceOrderLifecycle(record as any);
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
      ...outsourceCustomFieldColumns,
      {
        title: t('common.actions'),
        key: 'option',
        fixed: 'right',
        hideInSearch: true,
        render: (_, record) => renderOoRowActionNodes(record),
      },
    ], SALES_DOC_LIST_FIELD_RANK),
    [outsourceCustomFieldColumns, outsourceOrderLifecycleValueEnum, supplierSearchValueEnum, t],
  );

  /**
   * 处理请求
   */
  const handleRequest = async (
    params: any,
    sort: Record<string, 'ascend' | 'descend' | null>,
    _filter: Record<string, React.ReactText[] | null>,
    searchFormValues?: Record<string, unknown>,
    meta?: UniTableRequestMeta,
  ) => {
    try {
      const s = searchFormValues ?? {};
      const lifecycleParams = resolveOutsourceOrderListLifecycleParams(s);
      const { sortBy, sortOrder } = extractProTableSort(sort);
      const orderBy =
        sortBy && sortOrder ? (sortOrder === 'desc' ? `-${sortBy}` : sortBy) : undefined;
      const fuzzyKeyword = typeof s.keyword === 'string' ? s.keyword.trim() : '';

      const apiParams: Parameters<typeof outsourceOrderApi.list>[0] = {
        skip: ((params.current ?? 1) - 1) * (params.pageSize ?? 20),
        limit: params.pageSize ?? 20,
        ...lifecycleParams,
        order_by: orderBy,
      };

      if (fuzzyKeyword) {
        apiParams.keyword = fuzzyKeyword;
      } else {
        if (s.code != null && String(s.code).trim()) {
          apiParams.code = String(s.code).trim();
        }
        if (s.work_order_code != null && String(s.work_order_code).trim()) {
          apiParams.work_order_code = String(s.work_order_code).trim();
        }
        if (s.operation_name != null && String(s.operation_name).trim()) {
          apiParams.operation_name = String(s.operation_name).trim();
        }
        if (s.supplier_id != null && String(s.supplier_id).trim()) {
          apiParams.supplier_id = Number(s.supplier_id);
        } else if (s.supplier_name != null && String(s.supplier_name).trim()) {
          apiParams.supplier_name = String(s.supplier_name).trim();
        }
      }

      const plannedRange = s.planned_start_date_range as [unknown, unknown] | undefined;
      if (plannedRange && Array.isArray(plannedRange) && plannedRange[0]) {
        apiParams.planned_start_from = formatDateTime(plannedRange[0] as string | Date, 'YYYY-MM-DD');
        apiParams.planned_start_to = plannedRange[1]
          ? formatDateTime(plannedRange[1] as string | Date, 'YYYY-MM-DD')
          : apiParams.planned_start_from;
      }

      const createdRange = s.created_at_range as [unknown, unknown] | undefined;
      if (createdRange && Array.isArray(createdRange) && createdRange[0]) {
        apiParams.created_start_date = formatDateTime(createdRange[0] as string | Date, 'YYYY-MM-DD');
        apiParams.created_end_date = createdRange[1]
          ? formatDateTime(createdRange[1] as string | Date, 'YYYY-MM-DD')
          : apiParams.created_start_date;
      }

      const response = await outsourceOrderApi.list(apiParams);
      const list = response.data ?? [];
      const enriched = meta?.purpose === 'prefetch'
        ? list
        : await enrichOutsourceRecordsWithCustomFields(list);
      return {
        data: enriched,
        success: response.success,
        total: response.total ?? 0,
      };
    } catch (error) {
      messageApi.error(t('app.kuaizhizao.outsourceOrder.fetchListFailed'));
      return {
        data: [],
        success: false,
        total: 0,
      };
    }
  };

  const statCards: StatCard[] = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.outsourceOrder.statTotal'),
        value: localStats.total,
        valueStyle: { color: token.colorPrimary },
        backgroundChart: <SimpleSparkline data={OO_STAT_SPARK_1} color={token.colorPrimary} />,
      },
      {
        title: t('app.kuaizhizao.outsourceOrder.statDraft'),
        value: localStats.draft,
        valueStyle: { color: token.colorWarning },
        backgroundChart: <SimpleSparkline data={OO_STAT_SPARK_2} color={token.colorWarning} />,
      },
      {
        title: t('app.kuaizhizao.outsourceOrder.statInProgress'),
        value: localStats.inProgress,
        valueStyle: { color: token.colorSuccess },
        backgroundChart: <SimpleSparkline data={OO_STAT_SPARK_3} color={token.colorSuccess} />,
      },
    ],
    [localStats.draft, localStats.inProgress, localStats.total, t, token.colorPrimary, token.colorSuccess, token.colorWarning],
  );

  const timeconfigBasicItems0 = useDetailDrawerDescriptionItems(
    detailBaseColumns, outsourceOrderDetail,
    'outsource_order',
  );

  const timeconfigBasicItems1 = useDetailDrawerDescriptionItems(
    detailRemarksColumn, outsourceOrderDetail,
    'outsource_order',
  );

  return (
    <>
      <ListPageTemplate statCards={statCards}>
      <UniTable<OutsourceOrder>
        headerTitle={t('app.kuaizhizao.outsourceOrder.title')}
        viewTypes={['table', 'help']}
          helpViewConfig={buildDocumentListHelpViewConfig(DOCUMENT_LIST_HELP_KEYS.outsourceOrder)}
        columnPersistenceId="apps.kuaizhizao.pages.production-execution.outsource-orders-width-v1"
        actionRef={actionRef}
        columns={columns}
        request={handleRequest}
        rowKey="id"
        enableRowSelection={true}
        selectedRowKeys={selectedRowKeys}
        onRowSelectionChange={setSelectedRowKeys}
        showCreateButton={true}
        createButtonText={createButtonLabel}
        onCreate={handleCreate}
        showDeleteButton={true}
        onDelete={handleDelete}
        deleteConfirmTitle={(count) => t('app.kuaizhizao.outsourceOrder.confirmBatchDelete', { count })}
        showAdvancedSearch={true}
        skipFuzzyPinyinClientFilter
        pinnedTabsField="status"
        pinnedTabsValueEnum={outsourceOrderLifecycleValueEnum}
        onRow={(record) => ({
          onClick: () => void handleDetail(record),
          style: { cursor: 'pointer' },
        })}
      />
      </ListPageTemplate>

      <UniPullQueryModal<PullOutsourceOperationCandidate>
        open={pullFromWorkOrderQuery.open}
        title={t('app.kuaizhizao.outsourceOrder.pullSelectSource')}
        onCancel={pullFromWorkOrderQuery.closeModal}
        onOk={pullFromWorkOrderQuery.handleConfirm}
        rowKey="pull_row_key"
        isRowDisabled={pullFromWorkOrderQuery.isRowDisabled}
        columns={[
          { title: t('app.kuaizhizao.outsourceOrder.colWorkOrderCode'), dataIndex: 'work_order_code', width: 160, ellipsis: true },
          { title: t('app.kuaizhizao.workReporting.colWorkOrderName'), dataIndex: 'work_order_name', width: 180, ellipsis: true },
          {
            title: t('app.kuaizhizao.outsourceOrder.colOperationName'),
            key: 'operation_display',
            width: 200,
            ellipsis: true,
            render: (_, row) => `${row.operation_name || '-'} (${row.operation_code || '-'})`,
          },
          { title: t('common.quantity'), dataIndex: 'max_quantity', width: 90, align: 'right' },
          { title: t('app.kuaizhizao.salesOrder.colPushedQty'), dataIndex: 'occupied_quantity', width: 90, align: 'right' },
          { title: t('app.kuaizhizao.salesOrder.colPushableQty'), dataIndex: 'outsourceable_quantity', width: 90, align: 'right' },
        ]}
        dataSource={pullFromWorkOrderQuery.dataSource}
        loading={pullFromWorkOrderQuery.loading}
        confirmLoading={pullFromWorkOrderQuery.confirmLoading}
        selectionType={pullFromWorkOrderQuery.selectionType}
        selectedRowKeys={pullFromWorkOrderQuery.selectedRowKeys}
        selectedRows={pullFromWorkOrderQuery.selectedRows}
        onSelectedRowKeysChange={pullFromWorkOrderQuery.handleSelectedRowKeysChange}
        searchDraft={pullFromWorkOrderQuery.searchDraft}
        onSearchDraftChange={pullFromWorkOrderQuery.setSearchDraft}
        onSearchApply={pullFromWorkOrderQuery.handleSearchApply}
        onSearchClear={pullFromWorkOrderQuery.handleSearchClear}
        appliedKeyword={pullFromWorkOrderQuery.appliedKeyword}
        searchPlaceholder={t('app.kuaizhizao.workReporting.formWorkOrderPlaceholder')}
        page={pullFromWorkOrderQuery.page}
        pageSize={pullFromWorkOrderQuery.pageSize}
        total={pullFromWorkOrderQuery.total}
        onPageChange={pullFromWorkOrderQuery.handlePageChange}
        scopeOptions={pullFromWorkOrderQuery.scopeOptions}
        scope={pullFromWorkOrderQuery.scope}
        onScopeChange={pullFromWorkOrderQuery.handleScopeChange}
        okText={t('common.next')}
      />

      <FormModalTemplate
        title={t('app.kuaizhizao.outsourceOrder.createModalTitle')}
        open={createModalVisible}
        onClose={() => {
          setCreateModalVisible(false);
          setCreateWorkOrder(null);
          setCreateLockedOperation(null);
          setCreateMaxOutsourceQty(0);
          createFormRef.current?.resetFields();
        }}
        onFinish={handleSubmitCreate}
        formRef={createFormRef}
        {...MODAL_CONFIG}
      >
        {createWorkOrder && createLockedOperation ? (
          <>
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
              message={t('app.kuaizhizao.outsourceOrder.formSourceLocked')}
            />
            <Card size="small" style={{ marginBottom: 16 }}>
              <Descriptions column={2} size="small">
                <Descriptions.Item label={t('app.kuaizhizao.outsourceOrder.colWorkOrderCode')}>
                  {createWorkOrder.code || '—'}
                </Descriptions.Item>
                <Descriptions.Item label={t('app.kuaizhizao.workReporting.colWorkOrderName')}>
                  {createWorkOrder.name || '—'}
                </Descriptions.Item>
                <Descriptions.Item label={t('app.kuaizhizao.outsourceOrder.colOperationName')} span={2}>
                  {`${createLockedOperation.operation_name || '—'} (${createLockedOperation.operation_code || '—'})`}
                </Descriptions.Item>
              </Descriptions>
            </Card>
            <ProFormText name="work_order_operation_id" hidden />
            <ProFormItem
              name="supplier_id"
              label={t('app.kuaizhizao.outsourceOrder.fieldSupplier')}
              rules={[{ required: true, message: t('app.kuaizhizao.outsourceOrder.ruleSelectSupplier') }]}
            >
              <UniDropdown
                placeholder={t('app.kuaizhizao.outsourceOrder.placeholderSupplier')}
                showSearch
                allowClear
                style={{ width: '100%' }}
                options={supplierList.map((s: Supplier) => ({
                  label: `${s.code} - ${s.name}`,
                  value: s.id,
                }))}
                quickCreate={{ label: t('app.kuaizhizao.outsourceOrder.supplierManage'), onClick: () => navigate('/apps/master-data/supply-chain/suppliers') }}
              />
            </ProFormItem>
            <ProFormDigit
              name="outsource_quantity"
              label={t('app.kuaizhizao.outsourceOrder.fieldOutsourceQty')}
              placeholder={t('app.kuaizhizao.outsourceOrder.placeholderOutsourceQty')}
              rules={[
                { required: true, message: t('app.kuaizhizao.outsourceOrder.ruleEnterOutsourceQty') },
                {
                  validator: async (_, value) => {
                    if (value == null || value === '') return;
                    const qty = Number(value);
                    if (!Number.isFinite(qty) || qty <= 0) {
                      throw new Error(t('app.kuaizhizao.outsourceOrder.ruleEnterOutsourceQty'));
                    }
                    if (qty > createMaxOutsourceQty) {
                      throw new Error(t('app.kuaizhizao.outsourceOrder.ruleEnterOutsourceQty'));
                    }
                  },
                },
              ]}
              min={0}
              max={createMaxOutsourceQty > 0 ? createMaxOutsourceQty : undefined}
              fieldProps={{ precision: 2 }}
              extra={t('app.kuaizhizao.salesOrder.colPushableQty') + `: ${createMaxOutsourceQty}`}
            />
            <ProFormDigit
              name="unit_price"
              label={t('app.kuaizhizao.outsourceOrder.fieldUnitPrice')}
              placeholder={t('app.kuaizhizao.outsourceOrder.placeholderUnitPrice')}
              min={0}
              fieldProps={{ precision: 2 }}
            />
            <ProFormDatePicker
              name="planned_start_date"
              label={t('app.kuaizhizao.outsourceOrder.fieldPlannedStart')}
              placeholder={t('app.kuaizhizao.outsourceOrder.placeholderPlannedStart')}
              formItemProps={formDateFormItemProps}
              fieldProps={{ showTime: true }}
            />
            <ProFormDatePicker
              name="planned_end_date"
              label={t('app.kuaizhizao.outsourceOrder.fieldPlannedEnd')}
              placeholder={t('app.kuaizhizao.outsourceOrder.placeholderPlannedEnd')}
              formItemProps={formDateFormItemProps}
              fieldProps={buildFutureDateShortcutFieldProps({
                showTime: true,
              })}
            />
            <ProFormTextArea
              name="remarks"
              label={t('common.remark')}
              placeholder={t('app.kuaizhizao.outsourceOrder.placeholderRemarks')}
              fieldProps={{ rows: 3 }}
            />
          </>
        ) : null}
      </FormModalTemplate>

      {/* 表单Modal（主要用于编辑） */}
      {isEdit && (
        <FormModalTemplate
          title={t('app.kuaizhizao.outsourceOrder.editTitle')}
          open={modalVisible}
          onClose={() => {
            setModalVisible(false);
            resetOutsourceFormFieldValues();
          }}
          onFinish={handleSubmitForm}
          formRef={formRef}
          {...MODAL_CONFIG}
        >
          <CodeField
            pageCode="kuaizhizao-production-outsource-order"
            name="code"
            label={t('app.kuaizhizao.outsourceOrder.fieldCode')}
            required={!isEdit}
            autoGenerateOnCreate={!isEdit}
            showGenerateButton={false}
            context={{}}
            disabled={isEdit}
          />
          <ProFormItem
            name="supplier_id"
            label={t('app.kuaizhizao.outsourceOrder.fieldSupplier')}
            rules={[{ required: true, message: t('app.kuaizhizao.outsourceOrder.ruleSelectSupplier') }]}
          >
            <UniDropdown
              placeholder={t('app.kuaizhizao.outsourceOrder.placeholderSupplier')}
              showSearch
              allowClear
              style={{ width: '100%' }}
              options={supplierList.map((s: Supplier) => ({
                label: `${s.code} - ${s.name}`,
                value: s.id,
              }))}
              quickCreate={{ label: t('app.kuaizhizao.outsourceOrder.supplierManage'), onClick: () => navigate('/apps/master-data/supply-chain/suppliers') }}
            />
          </ProFormItem>
          <ProFormDigit
            name="outsource_quantity"
            label={t('app.kuaizhizao.outsourceOrder.fieldOutsourceQty')}
            placeholder={t('app.kuaizhizao.outsourceOrder.placeholderOutsourceQty')}
            rules={[{ required: true, message: t('app.kuaizhizao.outsourceOrder.ruleEnterOutsourceQty') }]}
            min={0}
            fieldProps={{ precision: 2 }}
          />
          <ProFormDigit
            name="unit_price"
            label={t('app.kuaizhizao.outsourceOrder.fieldUnitPrice')}
            placeholder={t('app.kuaizhizao.outsourceOrder.placeholderUnitPrice')}
            min={0}
            fieldProps={{ precision: 2 }}
          />
          <ProFormSelect
            name="status"
            label={t('common.status')}
            placeholder={t('app.kuaizhizao.outsourceOrder.placeholderStatus')}
            options={statusFormOptions}
          />
          <ProFormDatePicker
            name="planned_start_date"
            label={t('app.kuaizhizao.outsourceOrder.fieldPlannedStart')}
            placeholder={t('app.kuaizhizao.outsourceOrder.placeholderPlannedStart')}
            formItemProps={formDateFormItemProps}
            fieldProps={{ showTime: true }}
          />
          <ProFormDatePicker
            name="planned_end_date"
            label={t('app.kuaizhizao.outsourceOrder.fieldPlannedEnd')}
            placeholder={t('app.kuaizhizao.outsourceOrder.placeholderPlannedEnd')}
            formItemProps={formDateFormItemProps}
            fieldProps={buildFutureDateShortcutFieldProps({
              getForm: () => formRef.current,
              fieldName: 'planned_end_date',
              baseFieldName: 'planned_start_date',
              t,
              fieldProps: { showTime: true },
            })}
          />
          <ProFormDigit
            name="received_quantity"
            label={t('app.kuaizhizao.outsourceOrder.fieldReceivedQty')}
            placeholder={t('app.kuaizhizao.outsourceOrder.placeholderReceivedQty')}
            initialValue={0}
            min={0}
            fieldProps={{ precision: 2 }}
          />
          <ProFormDigit
            name="qualified_quantity"
            label={t('app.kuaizhizao.outsourceOrder.fieldQualifiedQty')}
            placeholder={t('app.kuaizhizao.outsourceOrder.placeholderQualifiedQty')}
            initialValue={0}
            min={0}
            fieldProps={{ precision: 2 }}
          />
          <ProFormDigit
            name="unqualified_quantity"
            label={t('app.kuaizhizao.outsourceOrder.fieldUnqualifiedQty')}
            placeholder={t('app.kuaizhizao.outsourceOrder.placeholderUnqualifiedQty')}
            initialValue={0}
            min={0}
            fieldProps={{ precision: 2 }}
          />
          <CustomFieldsFormSection
            customFields={outsourceFormCustomFields}
            customFieldValues={outsourceFormCustomFieldValues}
            gridColumns={1}
          />
          <DocumentAttachmentsField category="outsource_order_attachments" />
          <ProFormTextArea
            name="remarks"
            label={t('common.remark')}
            placeholder={t('app.kuaizhizao.outsourceOrder.placeholderRemarks')}
            fieldProps={{ rows: 3 }}
          />
        </FormModalTemplate>
      )}

      <DetailDrawerTemplate
        title={`${t('app.kuaizhizao.outsourceOrder.detailTitle')}${outsourceOrderDetail?.code ? ` - ${outsourceOrderDetail.code}` : ''}`}
        open={detailDrawerVisible}
        zIndex={outsourceOrderDetailDrawerZIndex}
        onClose={() => {
          setDetailDrawerVisible(false);
          setOutsourceOrderDetail(null);
          resetOutsourceDetailFieldValues();
        }}
        width={DRAWER_CONFIG.HALF_WIDTH}
        extra={
          outsourceOrderDetail ? (
            <Space>
              <Button
                icon={<EditOutlined />}
                disabled={outsourceOrderDetail.status === 'completed' || outsourceOrderDetail.status === 'cancelled'}
                onClick={() => void handleEditFromRecord(outsourceOrderDetail)}
              >
                {t('common.edit')}
              </Button>
              <Button
                danger
                icon={<DeleteOutlined />}
                disabled={outsourceOrderDetail.status === 'completed' || outsourceOrderDetail.status === 'in_progress'}
                onClick={() => handleDeleteFromRecord(outsourceOrderDetail)}
              >
                {t('common.delete')}
              </Button>
            </Space>
          ) : null
        }
        collaborationTitleSuffix={
          outsourceOrderDetail && outsourceShowNextInTitle ? (
            <Typography.Text type="secondary" style={{ fontSize: 13, fontWeight: 400 }}>
              {t('common.next')}：
              {outsourceNextSteps!.join(t('components.uniLifecycle.nextStepSeparator'))}
            </Typography.Text>
          ) : undefined
        }
        collaborationAuditRecord={outsourceOrderDetail as AuditPhaseRecord | null}
        basic={
          outsourceOrderDetail ? (
            <>
              <Descriptions
                column={3}
                size="small"
                items={timeconfigBasicItems0}
              />
              {hasCustomFieldsDetailContent(outsourceListCustomFields, outsourceDetailCustomFieldValues) ? (
                <div style={{ marginTop: 16 }}>
                  <CustomFieldsDetailSection
                    customFields={outsourceListCustomFields}
                    customFieldValues={outsourceDetailCustomFieldValues}
                  />
                </div>
              ) : null}
              <Descriptions
                column={3}
                size="small"
                style={{ marginTop: 16 }}
                items={timeconfigBasicItems1}
              />
            </>
          ) : undefined
        }
        collaboration={
          outsourceOrderDetail && (outsourceDetailLifecycle?.mainStages ?? []).length > 0 ? (
            <UniLifecycleStepper
              steps={outsourceDetailLifecycle!.mainStages ?? []}
              status={outsourceDetailLifecycle!.status}
              showLabels
              nextStepSuggestions={outsourceDetailLifecycle!.nextStepSuggestions}
              hideNextStepSuggestions={outsourceShowNextInTitle}
            />
          ) : null
        }
        lines={
          outsourceOrderDetail ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('app.kuaizhizao.outsourceOrder.noLineItems')} />
          ) : undefined
        }
        timeline={
          outsourceOrderDetail ? (
            outsourceOrderTracking.data && !outsourceOrderTracking.loading ? (
              <DocumentTrackingTimelineBody data={outsourceOrderTracking.data} />
            ) : outsourceOrderTracking.error ? (
              <Typography.Text type="danger">{outsourceOrderTracking.error}</Typography.Text>
            ) : !outsourceOrderTracking.loading ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('components.documentTrackingPanel.noOperations')} />
            ) : null
          ) : undefined
        }
        traceDocument={
          outsourceOrderDetail?.id != null
            ? {
                documentType: 'outsource_order',
                documentId: outsourceOrderDetail.id,
                selfDocumentId: outsourceOrderDetail.id,
                renderBriefActions: (doc) => (
                  <WarehouseTraceBriefPrimaryActions
                    doc={doc}
                    t={t}
                    navigate={navigate}
                    closeDrawer={() => {
                      setDetailDrawerVisible(false);
                      setOutsourceOrderDetail(null);
                    }}
                  />
                ),
              }
            : undefined
        }
      />
    </>
  );
};

const OutsourceOrdersPage: React.FC = () => {
  return <OutsourceOrdersTable />;
};

export default OutsourceOrdersPage;

