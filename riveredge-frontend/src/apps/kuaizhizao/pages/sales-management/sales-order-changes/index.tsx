/**
 * 销售变更单
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { rowActionKind } from '../../../../../components/uni-action';
import { useSearchParams } from 'react-router-dom';
import { ActionType, ProColumns, ProFormTextArea } from '@ant-design/pro-components';
import { App, Button, Descriptions, Form, Input, Space, Tag } from 'antd';
import { CheckOutlined, DeleteOutlined, EditOutlined, EyeOutlined, PlusOutlined, PrinterOutlined, RollbackOutlined, SendOutlined, ThunderboltOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { UniTable } from '../../../../../components/uni-table';
import { UniAuditBatchMenuButton, UniCapabilityBatchButton } from '../../../../../components/uni-batch';
import { UniPullQueryModal, useUniPullQuery } from '../../../../../components/uni-pull-query';
import {
  UniTableStackedPrimaryCell,
  UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
} from '../../../../../components/uni-table/stackedPrimaryColumn';
import { ListPageTemplate, DetailDrawerTemplate, FormModalTemplate, DRAWER_CONFIG, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { UniWorkflowActions } from '../../../../../components/uni-workflow-actions';
import { UniLifecycleStepper } from '../../../../../components/uni-lifecycle';
import { LIST_LIFECYCLE_STAGE_FIELD } from '../../../../../utils/listLifecycleStage';
import { useAuditRequired } from '../../../../../hooks/useAuditRequired';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import {
  useSalesOrderChangeCapabilities,
} from '../../../../../hooks/useDocumentCapabilities';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { NEW_SHORTCUT_HINT } from '../../../../../utils/globalNewShortcut';
import {
  approveSalesOrderChange,
  createSalesOrderChangeFromOrder,
  deleteSalesOrderChange,
  getSalesOrderChange,
  listSalesOrderChanges,
  previewSalesOrderChangeImpact,
  submitSalesOrderChange,
  updateSalesOrderChange,
  withdrawSalesOrderChange,
  type SalesOrderChange,
  type SalesOrderChangeListParams,
} from '../../../services/sales-order-change';
import { getSalesOrder, listSalesOrders, type SalesOrder } from '../../../services/sales-order';
import { customerApi } from '../../../../master-data/services/supply-chain';
import type { Customer } from '../../../../master-data/types/supply-chain';
import {
  buildOrderChangeLifecycleValueEnum,
  getOrderChangeLifecycle,
  resolveOrderChangeListLifecycleParams,
} from '../../../utils/orderChangeLifecycle';
import { formatOrderChangeCategory, ORDER_CHANGE_CATEGORY_LABELS } from '../../../utils/orderChangeCategory';
import { OrderChangeItemsTable } from '../../../components/order-change/OrderChangeItemsTable';
import { OrderChangeImpactModal } from '../../../components/order-change/OrderChangeImpactModal';
import { isSourceOrderEligibleForChange } from '../../../utils/orderChangeSourceOrder';
import { ListUniLifecycleCell } from '../shared/ListUniLifecycleCell';
import { alignProColumns, GLOBAL_DOC_LIST_FIELD_RANK } from '../shared/documentFieldAlignment';
import { DetailLifecycleCollaborationBlock } from '../../../../../components/uni-audit/DetailAuditPhaseRow';
import { createListAuditPhaseColumn } from '../shared/listAuditPhaseColumn';
import { buildDocumentAuditColumns } from '../../shared/documentAuditColumns';
import DocumentAttachmentsField from '../../../components/DocumentAttachmentsField';
import { mapAttachmentsToUploadList, normalizeDocumentAttachments } from '../../../utils/documentAttachments';
import { useKuaizhizaoPrintModal } from '../../../hooks/useKuaizhizaoPrintModal';
import {
  resolveKuaizhizaoDocumentAction,
} from '../../../constants/documentActionRegistry';
import { formatDateTime, formatNumber } from '../../../../../utils/format';
import { extractProTableSort } from '../../../../../utils/tableQueryKey';
import { formDateRangeFormItemProps } from '../../../../../utils/formDate';

const SALES_ORDER_CHANGE_RESOURCE = 'kuaizhizao:sales-order-change';
type PullSalesOrderCandidate = {
  id: number;
  order_code: string;
  customer_name?: string;
  order_date?: string;
  delivery_date?: string;
  total_amount?: number;
  status?: string;
  review_status?: string;
  salesman_name?: string;
};

const isPullSalesOrderSelectable = (record: PullSalesOrderCandidate): boolean =>
  isSourceOrderEligibleForChange(record.status, record.review_status);

const isDraftChangeStatus = (status?: string): boolean => {
  const normalized = String(status ?? '').trim();
  return normalized === 'DRAFT' || normalized === '草稿';
};

const isAppliedChangeStatus = (status?: string): boolean => {
  const normalized = String(status ?? '').trim();
  return normalized === 'APPLIED' || normalized === '已生效';
};

const SALES_ORDER_CHANGE_LIST_FIELD_RANK = {
  ...GLOBAL_DOC_LIST_FIELD_RANK,
  change_reason: 56.5,
  delta_amount: 56.8,
} as const;

const SalesOrderChangesPage: React.FC = () => {
  const { t } = useTranslation();
  const { message, modal } = App.useApp();
  const { openPrint, PrintModal } = useKuaizhizaoPrintModal();
  const pullFromSalesOrderAction = resolveKuaizhizaoDocumentAction(
    t,
    'sales_order_change.pull_from_sales_order',
  );
  const [searchParams, setSearchParams] = useSearchParams();
  const actionRef = useRef<ActionType>();
  const auditEnabled = useAuditRequired('kuaizhizao', 'sales-order-change');
  const changePerms = useResourcePermissions(SALES_ORDER_CHANGE_RESOURCE);
  const permDeniedTitle = t('common.noPermission');

  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<SalesOrderChange | null>(null);
  const detailCapabilityGates = useSalesOrderChangeCapabilities(detail, changePerms, t, permDeniedTitle);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm] = Form.useForm();
  const [pendingEditFormValues, setPendingEditFormValues] = useState<Record<string, any> | null>(null);
  const [editItems, setEditItems] = useState<SalesOrderChange['items']>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [creatingSourceOrderId, setCreatingSourceOrderId] = useState<number | null>(null);
  const [createReason, setCreateReason] = useState(() => t('app.kuaizhizao.salesOrderChange.defaultReason'));
  const [impactOpen, setImpactOpen] = useState(false);
  const [impactLoading, setImpactLoading] = useState(false);
  const [impactData, setImpactData] = useState<Awaited<ReturnType<typeof previewSalesOrderChangeImpact>> | null>(null);
  const [pendingSubmitId, setPendingSubmitId] = useState<number | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const tableRowsRef = useRef<SalesOrderChange[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customersLoading, setCustomersLoading] = useState(false);

  useEffect(() => {
    setCustomersLoading(true);
    customerApi
      .list({ limit: 1000, isActive: true })
      .then((result) => {
        setCustomers(Array.isArray(result) ? result : (result as { data?: Customer[]; items?: Customer[] })?.data ?? (result as { items?: Customer[] })?.items ?? []);
      })
      .catch(() => setCustomers([]))
      .finally(() => setCustomersLoading(false));
  }, []);

  const changeCustomerSearchOptions = useMemo(
    () =>
      customers.map((c) => ({
        value: Number(c.id),
        label: String(c.name ?? c.code ?? ''),
      })),
    [customers],
  );

  const changeCategoryValueEnum = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(ORDER_CHANGE_CATEGORY_LABELS).map(([key, label]) => [key, { text: label }]),
      ),
    [],
  );

  const selectedChangesForBatch = useMemo(
    () =>
      selectedRowKeys
        .map((key) => tableRowsRef.current.find((row) => String(row.id) === String(key)))
        .filter((row): row is SalesOrderChange => row != null),
    [selectedRowKeys],
  );

  const openDetail = async (record: SalesOrderChange) => {
    const full = await getSalesOrderChange(record.id!);
    setDetail(full);
    setDetailOpen(true);
  };

  const openEdit = async (record: SalesOrderChange) => {
    const full = await getSalesOrderChange(record.id!);
    setEditingId(full.id!);
    setCreatingSourceOrderId(null);
    setEditItems(full.items ?? []);
    setPendingEditFormValues({
      change_reason: full.change_reason,
      notes: full.notes,
      attachments: mapAttachmentsToUploadList(full.attachments),
    });
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    const values = await editForm.validateFields();
    const payload = {
      change_reason: values.change_reason,
      notes: values.notes,
      attachments: normalizeDocumentAttachments(values.attachments),
      items: (editItems ?? []).map((item, idx) => ({
        id: item.id,
        line_no: item.line_no ?? idx + 1,
        source_item_id: item.source_item_id,
        change_type: item.change_type ?? 'QUANTITY',
        material_id: item.material_id,
        material_code: item.material_code,
        material_name: item.material_name,
        material_spec: item.material_spec,
        material_unit: item.material_unit,
        before_quantity: item.before_quantity,
        after_quantity: item.after_quantity,
        before_unit_price: item.before_unit_price,
        after_unit_price: item.after_unit_price,
        before_delivery_date: item.before_delivery_date,
        after_delivery_date: item.after_delivery_date,
        notes: item.notes,
      })),
    };
    let changeId: number;
    let updateRes: SalesOrderChange;
    if (editingId) {
      updateRes = await updateSalesOrderChange(editingId, payload);
      changeId = editingId;
    } else {
      if (!creatingSourceOrderId) {
        message.error(t('app.kuaizhizao.salesOrderChange.selectSalesOrder'));
        return;
      }
      const created = await createSalesOrderChangeFromOrder(
        creatingSourceOrderId,
        values.change_reason || t('app.kuaizhizao.salesOrderChange.defaultReason'),
      );
      updateRes = await updateSalesOrderChange(created.id!, payload);
      changeId = created.id!;
    }

    if (isDraftChangeStatus(updateRes.status)) {
      try {
        const submitRes = await submitSalesOrderChange(changeId);
        if (isAppliedChangeStatus(submitRes.status)) {
          message.success(t('app.kuaizhizao.salesOrderChange.savedAndApplied'));
        } else {
          message.success(t('app.kuaizhizao.salesOrderChange.submitSuccess'));
        }
      } catch (submitError: any) {
        message.error(
          t('app.kuaizhizao.salesOrder.saveSuccessSubmitFailed', {
            message: submitError?.message ?? t('app.kuaizhizao.salesOrder.unknownError'),
          }),
        );
      }
    } else if (editingId) {
      message.success(t('common.updateSuccess'));
    } else {
      message.success(t('app.kuaizhizao.salesOrderChange.created', { code: updateRes.change_code }));
    }
    setEditOpen(false);
    setPendingEditFormValues(null);
    setCreatingSourceOrderId(null);
    actionRef.current?.reload();
  };

  const openCreateFromOrder = async (orderId: number, reason: string) => {
    const order = await getSalesOrder(orderId, true);
    setEditingId(null);
    setCreatingSourceOrderId(orderId);
    setEditItems(
      (order.items ?? []).map((item, idx) => ({
        line_no: idx + 1,
        source_item_id: item.id,
        change_type: 'QUANTITY',
        material_id: item.material_id,
        material_code: item.material_code,
        material_name: item.material_name,
        material_spec: item.material_spec,
        material_unit: item.material_unit,
        before_quantity: item.required_quantity,
        after_quantity: item.required_quantity,
        before_unit_price: item.unit_price,
        after_unit_price: item.unit_price,
        before_delivery_date: item.delivery_date,
        after_delivery_date: item.delivery_date,
        notes: item.notes,
      })),
    );
    setPendingEditFormValues({
      change_reason: reason || t('app.kuaizhizao.salesOrderChange.defaultReason'),
      notes: '',
      attachments: [],
    });
    setEditOpen(true);
  };

  const mapPullSalesOrderRows = useCallback((rows: SalesOrder[]): PullSalesOrderCandidate[] => {
    return rows
      .filter((order) => order.id && order.order_code)
      .map((order) => ({
        id: Number(order.id),
        order_code: String(order.order_code),
        customer_name: order.customer_name || '',
        order_date: order.order_date || '',
        delivery_date: order.delivery_date || '',
        total_amount: order.total_amount != null ? Number(order.total_amount) : undefined,
        status: order.status || '',
        review_status: order.review_status || '',
        salesman_name: order.salesman_name || '',
      }));
  }, []);

  const pullFromSalesOrderScopeOptions = useMemo(
    () => [
      { label: t('components.uniPullQuery.scopePullable'), value: 'pullable' },
      { label: t('components.uniPullQuery.scopeAll'), value: 'all' },
    ],
    [t],
  );

  const pullFromSalesOrderQuery = useUniPullQuery<PullSalesOrderCandidate>({
    rowKey: 'id',
    selectionType: 'radio',
    scopeOptions: pullFromSalesOrderScopeOptions,
    defaultScope: 'pullable',
    isRowDisabled: (record) => !isPullSalesOrderSelectable(record),
    loadData: async ({ keyword, page, pageSize, scope }) => {
      try {
        const result = await listSalesOrders({
          skip: 0,
          limit: 200,
          keyword: keyword.trim() || undefined,
          include_items: false,
        });
        const rows = mapPullSalesOrderRows(result.data || []);
        const filtered = scope === 'pullable' ? rows.filter(isPullSalesOrderSelectable) : rows;
        const begin = (page - 1) * pageSize;
        const end = begin + pageSize;
        return {
          data: filtered.slice(begin, end),
          total: filtered.length,
        };
      } catch (error: any) {
        message.error(error?.message ?? t('app.kuaizhizao.orderChange.loadSalesOrdersFailed'));
        return { data: [], total: 0 };
      }
    },
    onConfirm: async (keys, rows) => {
      const selectedId = Number(keys[0]);
      const selected = rows[0];
      if (!selectedId || selectedId <= 0) {
        message.warning(t('app.kuaizhizao.salesOrderChange.selectSalesOrder'));
        return;
      }
      if (selected && !isPullSalesOrderSelectable(selected)) {
        message.warning(t('app.kuaizhizao.salesOrderChange.selectSalesOrder'));
        return;
      }
      await openCreateFromOrder(selectedId, createReason || t('app.kuaizhizao.salesOrderChange.defaultReason'));
      pullFromSalesOrderQuery.closeModal();
    },
  });

  const pullSalesOrderColumns: ProColumns<PullSalesOrderCandidate>[] = useMemo(
    () => [
      { title: t('app.kuaizhizao.orderChange.colOrderCode'), dataIndex: 'order_code', width: 160 },
      {
        title: t('path.customers'),
        dataIndex: 'customer_name',
        ellipsis: true,
        render: (value: string) => value || '-',
      },
      {
        title: t('app.kuaizhizao.salesOrder.orderDate'),
        dataIndex: 'order_date',
        width: 120,
        render: (value: string) => (value ? formatDateTime(value, 'YYYY-MM-DD') : '-'),
      },
      {
        title: t('app.kuaizhizao.salesOrder.deliveryDate'),
        dataIndex: 'delivery_date',
        width: 120,
        render: (value: string) => (value ? formatDateTime(value, 'YYYY-MM-DD') : '-'),
      },
      {
        title: t('app.kuaizhizao.orderChange.colAmount'),
        dataIndex: 'total_amount',
        width: 120,
        align: 'right',
        render: (value: number | undefined) =>
          value != null
            ? Number(value).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : '-',
      },
      {
        title: t('common.status'),
        dataIndex: 'status',
        width: 100,
        render: (value: string) => value || '-',
      },
    ],
    [t],
  );

  const openCreate = useCallback(() => {
    setCreateReason(t('app.kuaizhizao.salesOrderChange.defaultReason'));
    pullFromSalesOrderQuery.openModal();
  }, [pullFromSalesOrderQuery, t]);
  useNewShortcut(openCreate);

  useEffect(() => {
    const sourceId = searchParams.get('source_order_id');
    if (sourceId) {
      openCreateFromOrder(Number(sourceId), t('app.kuaizhizao.salesOrderChange.defaultReason')).finally(() => {
        searchParams.delete('source_order_id');
        setSearchParams(searchParams, { replace: true });
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runSubmitWithPreview = async (id: number) => {
    setPendingSubmitId(id);
    setImpactLoading(true);
    setImpactOpen(true);
    try {
      const impact = await previewSalesOrderChangeImpact(id);
      setImpactData(impact);
    } catch (e: any) {
      message.error(e?.message ?? t('app.kuaizhizao.salesOrderChange.impactPreviewFailed'));
      setImpactOpen(false);
    } finally {
      setImpactLoading(false);
    }
  };

  const confirmSubmit = async () => {
    if (!pendingSubmitId) return;
    await submitSalesOrderChange(pendingSubmitId);
    message.success(t('app.kuaizhizao.salesOrderChange.submitSuccess'));
    setImpactOpen(false);
    setPendingSubmitId(null);
    actionRef.current?.reload();
    if (detail?.id === pendingSubmitId) {
      setDetail(await getSalesOrderChange(pendingSubmitId));
    }
  };

  const orderChangeLifecycleValueEnum = useMemo(
    () => buildOrderChangeLifecycleValueEnum(t),
    [t],
  );
  const orderChangeAuditColumn = useMemo(
    () => createListAuditPhaseColumn<SalesOrderChange>({ t, auditEnabled }),
    [t, auditEnabled],
  );
  const renderDeltaAmount = useCallback((value: unknown) => {
    if (value == null) return '-';
    const amount = Number(value);
    if (!Number.isFinite(amount)) return '-';
    const text = `${amount > 0 ? '+' : ''}${formatNumber(amount, 2)}`;
    const color = amount > 0 ? '#52c41a' : amount < 0 ? '#ff4d4f' : undefined;
    return <span style={{ color }}>{text}</span>;
  }, []);

  const columns: ProColumns<SalesOrderChange>[] = useMemo(
    () => alignProColumns<SalesOrderChange>([
    {
      title: t('app.kuaizhizao.salesOrderChange.colCustomerChangeCode'),
      key: 'change_code',
      dataIndex: 'change_code',
      ...UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
      fixed: 'left',
      width: 220,
      minWidth: 220,
      uniTableKeepWidth: true,
      sorter: true,
      fieldProps: { placeholder: t('app.kuaizhizao.salesOrderChange.colChangeCode') },
      render: (_, record) => (
        <UniTableStackedPrimaryCell
          primary={String(record.customer_name ?? '')}
          secondary={String(record.change_code ?? '')}
        />
      ),
    },
    {
      title: t('app.kuaizhizao.customerFollowUp.colCustomer'),
      dataIndex: 'customer_id',
      hideInTable: true,
      valueType: 'select',
      fieldProps: {
        showSearch: true,
        optionFilterProp: 'label',
        loading: customersLoading,
        options: changeCustomerSearchOptions,
        placeholder: t('app.kuaizhizao.customerFollowUp.colCustomer'),
      },
    },
    {
      title: t('app.kuaizhizao.salesOrderChange.colSourceOrder'),
      dataIndex: 'source_order_code',
      width: 150,
      minWidth: 150,
      uniTableKeepWidth: true,
      sorter: true,
      fieldProps: { placeholder: t('app.kuaizhizao.salesOrderChange.colSourceOrder') },
    },
    {
      title: t('app.kuaizhizao.salesOrderChange.colChangeReason'),
      dataIndex: 'change_reason',
      minWidth: 180,
      ellipsis: true,
      hideInSearch: true,
      uniTablePrimaryFlex: true,
    },
    {
      title: t('app.kuaizhizao.salesOrderChange.colCategory'),
      dataIndex: 'change_category',
      width: 100,
      minWidth: 100,
      uniTableKeepWidth: true,
      sorter: true,
      valueType: 'select',
      valueEnum: changeCategoryValueEnum,
      render: (_, r) => (
        <Tag color="blue" bordered={false}>
          {formatOrderChangeCategory(r.change_category)}
        </Tag>
      ),
    },
    {
      title: t('app.kuaizhizao.salesOrderChange.colDeltaAmount'),
      dataIndex: 'delta_amount',
      width: 100,
      minWidth: 100,
      uniTableKeepWidth: true,
      sorter: true,
      hideInSearch: true,
      align: 'right',
      render: (_, r) => renderDeltaAmount(r.delta_amount),
    },
    ...buildDocumentAuditColumns<SalesOrderChange>(t),
    {
      title: t('common.createdAt'),
      dataIndex: 'created_at_range',
      valueType: 'dateRange',
      hideInTable: true,
      fieldProps: {
        placeholder: [t('app.kuaizhizao.quotation.dateRangeStart'), t('app.kuaizhizao.quotation.dateRangeEnd')],
      },
      formItemProps: formDateRangeFormItemProps,
    },
    {
      title: t('app.kuaizhizao.salesOrderChange.colAppliedAt'),
      dataIndex: 'applied_at',
      width: 132,
      uniTableKeepWidth: true,
      sorter: true,
      hideInSearch: true,
      render: (_, r) => (r.applied_at ? formatDateTime(r.applied_at, 'YYYY-MM-DD HH:mm') : '-'),
    },
    ...(orderChangeAuditColumn ? [orderChangeAuditColumn] : []),
    {
      title: t('app.kuaizhizao.salesOrderChange.colLifecycle'),
      dataIndex: LIST_LIFECYCLE_STAGE_FIELD,
      width: 170,
      fixed: 'right',
      uniTableKeepWidth: true,
      valueType: 'select',
      valueEnum: orderChangeLifecycleValueEnum,
      render: (_, record) => (
        <ListUniLifecycleCell
          lifecycle={getOrderChangeLifecycle(record as Record<string, unknown>, t)}
        />
      ),
    },
    {
      title: t('common.actions'),
      valueType: 'option',
      width: 240,
      fixed: 'right',
      hideInSearch: true,
      render: (_, record) => {
        const canEdit = record.capabilities?.update?.allowed === true && changePerms.canUpdate;
        const canDelete = record.capabilities?.delete?.allowed === true && changePerms.canDelete;
        const canSubmit = record.capabilities?.submit?.allowed === true && (changePerms.canAction?.('submit') ?? false);
        const canRevoke =
          record.capabilities?.withdraw_submit?.allowed === true && (changePerms.canAction?.('revoke') ?? false);
        return [
          <Button {...rowActionKind('read')} key="view" onClick={() => openDetail(record)}>
            {t('common.detail')}
          </Button>,
          canEdit ? (
            <Button {...rowActionKind('update')} key="edit" onClick={() => openEdit(record)}>
              {t('common.edit')}
            </Button>
          ) : null,
          canSubmit ? (
            <Button {...rowActionKind('submit')} key="submit" onClick={() => runSubmitWithPreview(record.id!)}>
              {t('components.uniAction.submit')}
            </Button>
          ) : null,
          canRevoke ? (
            <Button
              {...rowActionKind('revoke')}
              key="revoke"
              onClick={() => {
                modal.confirm({
                  title: t('components.uniAction.revoke'),
                  onOk: async () => {
                    await withdrawSalesOrderChange(record.id!);
                    message.success(t('common.updateSuccess'));
                    actionRef.current?.reload();
                  },
                });
              }}
            >
              {t('components.uniAction.revoke')}
            </Button>
          ) : null,
          canDelete ? (
            <Button
              {...rowActionKind('delete')}
              key="del"
              onClick={() => {
                modal.confirm({
                  title: t('app.kuaizhizao.salesOrderChange.confirmDelete'),
                  onOk: async () => {
                    await deleteSalesOrderChange(record.id!);
                    message.success(t('app.kuaizhizao.salesOrderChange.deleted'));
                    actionRef.current?.reload();
                  },
                });
              }}
            >
              {t('common.delete')}
            </Button>
          ) : null,
        ];
      },
    },
  ], SALES_ORDER_CHANGE_LIST_FIELD_RANK),
    [
      t,
      changeCategoryValueEnum,
      changeCustomerSearchOptions,
      changePerms.canDelete,
      changePerms.canUpdate,
      changePerms.canAction,
      customersLoading,
      modal,
      message,
      orderChangeAuditColumn,
      orderChangeLifecycleValueEnum,
      renderDeltaAmount,
    ],
  );

  const request = useCallback(
    async (
      params: Record<string, unknown>,
      sort: Record<string, unknown> | undefined,
      _filter: unknown,
      searchFormValues?: Record<string, unknown>,
    ) => {
      const sf = searchFormValues ?? {};
      const lifecycleParams = resolveOrderChangeListLifecycleParams(sf, params);
      const { sortBy, sortOrder } = extractProTableSort(sort);
      const orderBy =
        sortBy && sortOrder ? (sortOrder === 'desc' ? `-${sortBy}` : sortBy) : undefined;
      const fuzzyKeyword =
        typeof sf.keyword === 'string' ? sf.keyword.trim() : '';
      const changeCode = sf.change_code != null ? String(sf.change_code).trim() : '';
      const apiParams: SalesOrderChangeListParams = {
        skip: ((Number(params.current) || 1) - 1) * (Number(params.pageSize) || 20),
        limit: Number(params.pageSize) || 20,
        ...lifecycleParams,
        order_by: orderBy,
      };
      if (fuzzyKeyword) {
        apiParams.keyword = fuzzyKeyword;
      } else if (changeCode) {
        apiParams.change_code = changeCode;
      }
      if (sf.customer_id != null && sf.customer_id !== '') {
        apiParams.customer_id = Number(sf.customer_id);
      }
      if (sf.change_category != null && sf.change_category !== '') {
        apiParams.change_category = String(sf.change_category);
      }
      const sourceOrderCode =
        sf.source_order_code != null ? String(sf.source_order_code).trim() : '';
      if (sourceOrderCode) apiParams.source_order_code = sourceOrderCode;
      const createdRange = sf.created_at_range as [unknown, unknown] | undefined;
      if (createdRange && Array.isArray(createdRange) && createdRange[0]) {
        apiParams.start_date = formatDateTime(createdRange[0] as string | Date, 'YYYY-MM-DD');
        apiParams.end_date = createdRange[1]
          ? formatDateTime(createdRange[1] as string | Date, 'YYYY-MM-DD')
          : apiParams.start_date;
      }
      const res = await listSalesOrderChanges(apiParams);
      return { data: res.items ?? [], success: true, total: res.total ?? 0 };
    },
    [],
  );

  const handleBatchDelete = useCallback(async (keys: React.Key[]) => {
    if (!keys || keys.length === 0) {
      message.warning(t('app.kuaizhizao.salesOrderChange.selectToDelete'));
      return;
    }
    let success = 0;
    let failed = 0;
    for (const key of keys) {
      const id = Number(key);
      if (!Number.isFinite(id) || id <= 0) {
        failed += 1;
        continue;
      }
      try {
        await deleteSalesOrderChange(id);
        success += 1;
      } catch {
        failed += 1;
      }
    }
    if (success > 0) message.success(t('app.kuaizhizao.salesOrderChange.batchDeleteSuccess', { count: success }));
    if (failed > 0) message.warning(t('app.kuaizhizao.salesOrderChange.batchDeletePartial', { count: failed }));
    setSelectedRowKeys([]);
    actionRef.current?.reload();
  }, [message, t]);

  const changeAuditBatchHandlers = useMemo(
    () => ({
      submit: submitSalesOrderChange,
      withdraw: withdrawSalesOrderChange,
      approve: (id: number) => approveSalesOrderChange(id, true),
    }),
    [],
  );

  const handleChangeAuditBatchSuccess = useCallback(() => {
    setSelectedRowKeys([]);
    actionRef.current?.reload();
  }, []);

  return (
    <ListPageTemplate>
      <UniTable<SalesOrderChange>
        actionRef={actionRef}
        rowKey="id"
        enableRowSelection
        selectedRowKeys={selectedRowKeys}
        onRowSelectionChange={setSelectedRowKeys}
        columns={columns}
        showAdvancedSearch
        skipFuzzyPinyinClientFilter
        request={request}
        onTableDataChange={(rows) => {
          tableRowsRef.current = rows;
        }}
        columnPersistenceId="apps.kuaizhizao.pages.sales-management.sales-order-changes"
        pinnedTabsField={LIST_LIFECYCLE_STAGE_FIELD}
        pinnedTabsValueEnum={orderChangeLifecycleValueEnum}
        toolBarRender={() => [
          <Button
            {...rowActionKind('create')}
            key="create-sales-order-change-with-pull"
            type="primary"
            icon={<PlusOutlined />}
            onClick={openCreate}
          >
            {pullFromSalesOrderAction.label + NEW_SHORTCUT_HINT}
          </Button>,
        ]}
        showDeleteButton
        onDelete={handleBatchDelete}
        deleteConfirmTitle={(count) => t('app.kuaizhizao.salesOrderChange.confirmBatchDelete', { count })}
        toolBarActionsAfterDelete={[
          <UniAuditBatchMenuButton
            key="sales-order-change-batch-menu"
            selectedRowKeys={selectedRowKeys}
            selectedRecords={selectedChangesForBatch}
            auditEnabled={auditEnabled}
            permGates={changePerms}
            handlers={changeAuditBatchHandlers}
            onSuccess={handleChangeAuditBatchSuccess}
          />,
        ]}
        toolBarActionsAfterBatch={[
          <UniCapabilityBatchButton
            key="sales-order-change-print"
            selectedRowKeys={selectedRowKeys}
            selectedRecords={selectedChangesForBatch}
            capabilityKey="print"
            permAllowed={changePerms.canPrint}
            batchAllowed={(records, perm) =>
              Boolean(perm) && records.some((record) => record.capabilities?.print?.allowed === true)
            }
            singleOnly
            onRun={async (id) => {
              openPrint({ documentType: 'sales_order_change', documentId: id });
            }}
            labels={{
              single: t('components.uniAction.print'),
              batch: t('components.uniAction.print'),
            }}
            icon={<PrinterOutlined />}
            size="middle"
          />,
        ]}
      />

      <UniPullQueryModal<PullSalesOrderCandidate>
        title={pullFromSalesOrderAction.label}
        open={pullFromSalesOrderQuery.open}
        onCancel={pullFromSalesOrderQuery.closeModal}
        onOk={pullFromSalesOrderQuery.handleConfirm}
        okText={t('common.create')}
        rowKey="id"
        columns={pullSalesOrderColumns}
        dataSource={pullFromSalesOrderQuery.dataSource}
        loading={pullFromSalesOrderQuery.loading}
        confirmLoading={pullFromSalesOrderQuery.confirmLoading}
        selectionType={pullFromSalesOrderQuery.selectionType}
        selectedRowKeys={pullFromSalesOrderQuery.selectedRowKeys}
        onSelectedRowKeysChange={pullFromSalesOrderQuery.handleSelectedRowKeysChange}
        isRowDisabled={pullFromSalesOrderQuery.isRowDisabled}
        searchDraft={pullFromSalesOrderQuery.searchDraft}
        onSearchDraftChange={pullFromSalesOrderQuery.setSearchDraft}
        onSearchApply={pullFromSalesOrderQuery.handleSearchApply}
        onSearchClear={pullFromSalesOrderQuery.handleSearchClear}
        appliedKeyword={pullFromSalesOrderQuery.appliedKeyword}
        page={pullFromSalesOrderQuery.page}
        pageSize={pullFromSalesOrderQuery.pageSize}
        total={pullFromSalesOrderQuery.total}
        onPageChange={pullFromSalesOrderQuery.handlePageChange}
        scopeOptions={pullFromSalesOrderQuery.scopeOptions}
        scope={pullFromSalesOrderQuery.scope}
        onScopeChange={pullFromSalesOrderQuery.handleScopeChange}
        searchPlaceholder={t('app.kuaizhizao.orderChange.searchOrderPlaceholder', {
          orderLabel: t('app.kuaizhizao.salesOrderChange.salesOrderLabel'),
          partnerLabel: t('path.customers'),
        })}
        emptyText={t('app.kuaizhizao.orderChange.emptyNoEligibleOrders', {
          orderLabel: t('app.kuaizhizao.salesOrderChange.salesOrderLabel'),
        })}
        emptySearchText={t('app.kuaizhizao.orderChange.emptyNoSearchResults', {
          orderLabel: t('app.kuaizhizao.salesOrderChange.salesOrderLabel'),
        })}
        okButtonProps={{
          disabled:
            pullFromSalesOrderQuery.selectedRowKeys.length === 0 ||
            pullFromSalesOrderQuery.hasDisabledSelection ||
            pullFromSalesOrderQuery.loading,
        }}
        alert={
          <Form layout="vertical">
            <Form.Item label={t('app.kuaizhizao.salesOrderChange.colChangeReason')} required style={{ marginBottom: 0 }}>
              <Input.TextArea
                rows={2}
                value={createReason}
                onChange={(e) => setCreateReason(e.target.value)}
              />
            </Form.Item>
          </Form>
        }
      />

      <FormModalTemplate
        title={t('app.kuaizhizao.salesOrderChange.editTitle')}
        open={editOpen}
        onClose={() => {
          setEditOpen(false);
          setCreatingSourceOrderId(null);
        }}
        afterOpenChange={(open) => {
          if (open) {
            if (pendingEditFormValues) {
              editForm.setFieldsValue(pendingEditFormValues);
            }
            return;
          }
          editForm.resetFields();
          setPendingEditFormValues(null);
        }}
        onFinish={handleSaveEdit}
        form={editForm}
        width={MODAL_CONFIG.EXTRA_LARGE_WIDTH}
      >
        <OrderChangeItemsTable items={editItems ?? []} editable onChange={setEditItems} />
        <ProFormTextArea name="change_reason" label={t('app.kuaizhizao.salesOrderChange.colChangeReason')} rules={[{ required: true }]} />
        <DocumentAttachmentsField category="sales_order_change_attachments" />
        <ProFormTextArea name="notes" label={t('app.kuaizhizao.salesOrderChange.notes')} />
      </FormModalTemplate>

      <DetailDrawerTemplate
        title={t('app.kuaizhizao.salesOrderChange.detailTitle', { code: detail?.change_code ?? '' })}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        width={DRAWER_CONFIG.LARGE_WIDTH ?? DRAWER_CONFIG.HALF_WIDTH}
        extra={
          detail ? (
            <Space>
              {!detailCapabilityGates.update.disabled && (
                <Button icon={<EditOutlined />} onClick={() => { setDetailOpen(false); openEdit(detail); }}>{t('common.edit')}</Button>
              )}
              {!detailCapabilityGates.submit.disabled && (
                <Button icon={<ThunderboltOutlined />} onClick={() => runSubmitWithPreview(detail.id!)}>{t('app.kuaizhizao.salesOrderChange.submit')}</Button>
              )}
              <UniWorkflowActions {...rowActionKind('skip')}
                record={detail}
                entityName={t('app.kuaizhizao.salesOrderChange.entityName')}
                statusField="status"
                reviewStatusField="review_status"
                draftStatuses={['DRAFT', '草稿']}
                pendingStatuses={['PENDING_REVIEW', '待审核']}
                approvedStatuses={['AUDITED', '已审核', 'APPLIED', '已生效']}
                rejectedStatuses={['REJECTED', '已驳回']}
                onSuccess={async () => {
                  actionRef.current?.reload();
                  if (detail.id) setDetail(await getSalesOrderChange(detail.id));
                }}
              />
              {!detailCapabilityGates.print.disabled && detail.id != null && (
                <Button
                  icon={<PrinterOutlined />}
                  onClick={() => openPrint({ documentType: 'sales_order_change', documentId: detail.id! })}
                >
                  {t('components.uniAction.print')}
                </Button>
              )}
            </Space>
          ) : null
        }
      >
        {detail && (
          <>
            {(() => {
              const lc = getOrderChangeLifecycle(detail as Record<string, unknown>, t);
              const mainStages = lc.mainStages ?? [];
              if (!mainStages.length) return null;
              return (
                <DetailLifecycleCollaborationBlock record={detail} auditEnabled={auditEnabled}>
                  <UniLifecycleStepper
                    steps={mainStages}
                    status={lc.status}
                    showLabels
                    nextStepSuggestions={lc.nextStepSuggestions}
                    hideNextStepSuggestions
                  />
                </DetailLifecycleCollaborationBlock>
              );
            })()}
            <Descriptions column={2} size="small" style={{ marginTop: 16 }}>
              <Descriptions.Item label={t('app.kuaizhizao.salesOrderChange.colSourceOrderCode')}>{detail.source_order_code}</Descriptions.Item>
              <Descriptions.Item label={t('app.kuaizhizao.customerFollowUp.colCustomer')}>{detail.customer_name}</Descriptions.Item>
              <Descriptions.Item label={t('app.kuaizhizao.salesOrderChange.colCategory')}>
                {formatOrderChangeCategory(detail.change_category)}
              </Descriptions.Item>
              <Descriptions.Item label={t('app.kuaizhizao.salesOrderChange.colBeforeAmount')}>{detail.before_total_amount}</Descriptions.Item>
              <Descriptions.Item label={t('app.kuaizhizao.salesOrderChange.colAfterAmount')}>{detail.after_total_amount}</Descriptions.Item>
              <Descriptions.Item label={t('app.kuaizhizao.salesOrderChange.colDeltaAmount')}>
                {renderDeltaAmount(detail.delta_amount)}
              </Descriptions.Item>
              <Descriptions.Item label={t('app.kuaizhizao.salesOrderChange.colAppliedAt')}>{detail.applied_at ? formatDateTime(detail.applied_at, 'YYYY-MM-DD HH:mm') : '-'}</Descriptions.Item>
              <Descriptions.Item label={t('app.kuaizhizao.salesOrderChange.colChangeReason')} span={2}>{detail.change_reason}</Descriptions.Item>
            </Descriptions>
            <div style={{ marginTop: 16 }}>
              <OrderChangeItemsTable items={detail.items ?? []} />
            </div>
          </>
        )}
      </DetailDrawerTemplate>

      <OrderChangeImpactModal
        open={impactOpen}
        loading={impactLoading}
        impact={impactData}
        onClose={() => { setImpactOpen(false); setPendingSubmitId(null); }}
        onConfirm={confirmSubmit}
      />
      {PrintModal}
    </ListPageTemplate>
  );
};

export default SalesOrderChangesPage;
