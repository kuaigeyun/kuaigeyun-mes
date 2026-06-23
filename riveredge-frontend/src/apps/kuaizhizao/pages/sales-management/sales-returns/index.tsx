/**
 * 销售退货单管理页面
 *
 * 提供销售退货单的创建、查看和管理功能
 *
 * @author RiverEdge Team
 * @date 2026-01-17
 */

import React, { useRef, useState, useEffect, useMemo, lazy, Suspense } from 'react';
import type { TFunction } from 'i18next';
import { renderRowActionsOverflow, rowActionKind } from '../../../../../components/uni-action';
import { useNavigate } from 'react-router-dom';
import { useInvalidateMenuBadgeCounts } from '../../../../../hooks/useInvalidateMenuBadgeCounts';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import {
  salesReturnBatchConfirmAllowed,
  salesReturnBatchWithdrawAllowed,
} from '../../../../../hooks/useDocumentCapabilities';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns, ProDescriptionsItemProps, ProForm, ProFormText, ProFormDatePicker, ProFormTextArea, ProFormDigit, ProFormSelect, ProFormInstance } from '@ant-design/pro-components';
import { App, Button, Space, Table, Row, Col, Form as AntForm, InputNumber, Input, Select, Dropdown, Tag, Card, Typography, Spin, Empty } from 'antd';
import { EyeOutlined, CheckCircleOutlined, PlusOutlined, AppstoreAddOutlined, ImportOutlined, MoreOutlined, CopyOutlined, EditOutlined, PrinterOutlined } from '@ant-design/icons';
import { theme as AntdTheme } from 'antd';
import { UniTable } from '../../../../../components/uni-table';
import {
  UniTableStackedPrimaryCell,
  UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
} from '../../../../../components/uni-table/stackedPrimaryColumn';
import { UniCapabilityBatchButton } from '../../../../../components/uni-batch';
import { UniPullCreateToolbar } from '../../../../../components/uni-pull';
import { UniPullQueryModal, useUniPullQuery } from '../../../../../components/uni-pull-query';
import { ListPageTemplate, DetailDrawerTemplate, DetailDrawerInlineFullChain, DRAWER_CONFIG, MODAL_CONFIG, FormModalTemplate, DetailDrawerSection } from '../../../../../components/layout-templates';
const LazyUniImport = lazy(() =>
  import('../../../../../components/uni-import').then((m) => ({ default: m.UniImport })),
);
import { UniTableDetail } from '../../../../../components/uni-table-detail';
import {
  DOCUMENT_DETAIL_COL_WIDTH,
  DOCUMENT_DETAIL_CONTROL_SIZE,
  DOCUMENT_DETAIL_NUM_COL,
  DOCUMENT_DETAIL_TABLE_PROPS,
  DOCUMENT_DETAIL_TEXT_COL,
  DocumentDetailTableStyles,
} from '../../../components/document-detail-table/documentDetailTable';
import { getDictionaryOptions } from '../../../../master-data/services/supply-chain';
import { initializeSystemDictionaries } from '../../../../../services/dataDictionary';
import { UniMaterialSelect } from '../../../../../components/uni-material-select';
import { UniMaterialBatchPicker } from '../../../../../components/uni-material-batch-picker';
import { ThemedSegmented } from '../../../../../components/themed-segmented';
import type { Material } from '../../../../master-data/types/material';
import { warehouseApi } from '../../../services/production';
import type { SalesReturn, SalesReturnItem } from '../../../services/sales-return';
import { customerApi } from '../../../../master-data/services/supply-chain';
import { useWarehouseLocationOptions } from '../../../hooks/useWarehouseLocationOptions';
import { UniWarehouseSelect } from '../../../../../components/uni-warehouse-select';
import dayjs from 'dayjs';
import { UniLifecycleStepper } from '../../../../../components/uni-lifecycle';
import { getSalesReturnLifecycle } from '../../../utils/salesReturnLifecycle';
import { listSalesOrders } from '../../../services/sales-order';
import { LIST_LIFECYCLE_STAGE_FIELD } from '../../../../../utils/listLifecycleStage';
import { ListUniLifecycleCell } from '../shared/ListUniLifecycleCell';
import {
  DocumentTrackingTimelineBody,
  useDocumentTracking,
} from '../../../../../components/document-tracking-panel';
import { WarehouseTraceBriefPrimaryActions } from '../../warehouse-management/WarehouseTraceBriefFooter';
import { useCustomFields } from '../../../../../hooks/useCustomFields';
import { useCustomFieldsForList } from '../../../../../hooks/useCustomFieldsForList';
import {
  CustomFieldsFormSection,
  CustomFieldsDetailSection,
  hasCustomFieldsDetailContent,
} from '../../../../../components/custom-fields';
import DocumentAttachmentsField from '../../../components/DocumentAttachmentsField';
import { mapAttachmentsToUploadList, normalizeDocumentAttachments } from '../../../utils/documentAttachments';
import { resolveKuaizhizaoDocumentAction } from '../../../constants/documentActionRegistry';
import { useKuaizhizaoPrintModal } from '../../../hooks/useKuaizhizaoPrintModal';
import { formatDateTime } from '../../../../../utils/format';

const SALES_RETURN_RESOURCE = 'kuaizhizao:sales-return';
const SALES_RETURN_CUSTOM_FIELD_TABLE = 'apps_kuaizhizao_sales_returns';

interface SalesReturnDetail extends SalesReturn {
  items?: SalesReturnItem[];
}

interface PullSalesOrderCandidate {
  id: number;
  order_code?: string;
  customer_name?: string;
  status?: string;
  delivery_date?: string;
  updated_at?: string;
}

/** 与后端 `system_dictionaries.py` 一致，租户未同步字典时的下拉兜底 */
const RETURN_REASON_VALUES = [
  'QUALITY_ISSUE',
  'SPEC_MISMATCH',
  'QTY_ERROR',
  'PACKAGE_DAMAGE',
  'WRONG_OR_MISSING',
  'CUSTOMER_CANCEL',
  'OTHER',
];
const RETURN_TYPE_VALUES = ['EXCHANGE', 'REFUND', 'REWORK', 'SCRAP_RETURN', 'OTHER'];
const SHIPPING_METHOD_VALUES = ['EXPRESS', 'LOGISTICS', 'SELF_PICKUP', 'DEDICATED', 'AIR', 'SEA'];

const DICT_VALUE_TO_KEY: Record<string, string> = {
  QUALITY_ISSUE: 'qualityIssue',
  SPEC_MISMATCH: 'specMismatch',
  QTY_ERROR: 'qtyError',
  PACKAGE_DAMAGE: 'packageDamage',
  WRONG_OR_MISSING: 'wrongOrMissing',
  CUSTOMER_CANCEL: 'customerCancel',
  OTHER: 'other',
  EXCHANGE: 'exchange',
  REFUND: 'refund',
  REWORK: 'rework',
  SCRAP_RETURN: 'scrapReturn',
  EXPRESS: 'express',
  LOGISTICS: 'logistics',
  SELF_PICKUP: 'selfPickup',
  DEDICATED: 'dedicated',
  AIR: 'air',
  SEA: 'sea',
};

function buildDictFallbackOptions(t: TFunction, values: string[]) {
  return values.map((value) => {
    const dictKey = DICT_VALUE_TO_KEY[value] ?? value.toLowerCase();
    return {
      label: t(`app.kuaizhizao.salesReturn.dict.${dictKey}`),
      value,
    };
  });
}

function getImportRowValue(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return value;
    }
  }
  return undefined;
}

const SalesReturnsPage: React.FC = () => {
  const { t } = useTranslation();
  const { openPrint, PrintModal } = useKuaizhizaoPrintModal();
  const pullFromSalesOrderAction = resolveKuaizhizaoDocumentAction(t, 'sales_return.pull_from_sales_order');
  const navigate = useNavigate();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const { token } = AntdTheme.useToken();
  const returnDetailDrawerZIndex = token.zIndexPopupBase;

  const invalidateMenuBadgeCounts = useInvalidateMenuBadgeCounts();
  const salesReturnPerms = useResourcePermissions(SALES_RETURN_RESOURCE);
  // Drawer 相关状态
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [returnDetail, setReturnDetail] = useState<SalesReturnDetail | null>(null);
  const [trackingRefreshKey, setTrackingRefreshKey] = useState(0);
  const salesReturnTracking = useDocumentTracking(
    detailDrawerVisible && returnDetail?.id ? 'sales_return' : undefined,
    returnDetail?.id,
    trackingRefreshKey,
  );

  const handleCopy = async (text?: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      messageApi.success(t('common.copySuccess'));
    } catch {
      messageApi.error(t('common.copyFailed'));
    }
  };

  const fallbackReturnReasonOptions = useMemo(
    () => buildDictFallbackOptions(t, RETURN_REASON_VALUES),
    [t],
  );
  const fallbackReturnTypeOptions = useMemo(
    () => buildDictFallbackOptions(t, RETURN_TYPE_VALUES),
    [t],
  );
  const fallbackShippingMethodOptions = useMemo(
    () => buildDictFallbackOptions(t, SHIPPING_METHOD_VALUES),
    [t],
  );

  const getReturnStatusLabel = (status?: string) => {
    if (!status) return '-';
    const statusLabelMap: Record<string, string> = {
      '待退货': t('app.kuaizhizao.salesReturn.statusPending'),
      '已退货': t('app.kuaizhizao.salesReturn.statusReturned'),
      '已取消': t('app.kuaizhizao.salesReturn.statusCancelled'),
      '草稿': t('app.kuaizhizao.salesReturn.statusDraft'),
    };
    return statusLabelMap[status] ?? status;
  };
  // 创建/编辑相关状态
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingDetail, setEditingDetail] = useState<SalesReturnDetail | null>(null);
  const [pendingFormValues, setPendingFormValues] = useState<Record<string, any> | null>(null);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const tableRowsRef = useRef<SalesReturn[]>([]);

  const selectedReturnsForBatch = useMemo(
    () =>
      selectedRowKeys
        .map((key) => tableRowsRef.current.find((row) => String(row.id) === String(key)))
        .filter((row): row is SalesReturn => row != null),
    [selectedRowKeys],
  );
  const [materialPickerOpen, setMaterialPickerOpen] = useState(false);
  const [productScope, setProductScope] = useState<'make' | 'all'>('make');
  const [pullWarehouseId, setPullWarehouseId] = useState<number | undefined>(undefined);
  const materialSourceType = productScope === 'make' ? 'Make' : undefined;
  const productColumnTitle = (
    <Space size={8} align="center">
      <span>{t('app.kuaizhizao.salesOrder.material')}</span>
      <ThemedSegmented
        size="small"
        value={productScope}
        options={[
          { label: t('app.kuaizhizao.sales.common.productScopeMake'), value: 'make' },
          { label: t('app.kuaizhizao.sales.common.productScopeAll'), value: 'all' },
        ]}
        onChange={(val) => setProductScope((val as 'make' | 'all') ?? 'make')}
      />
    </Space>
  );

  const [pullWarehouseName, setPullWarehouseName] = useState('');
  const formRef = useRef<ProFormInstance>(null);

  const {
    customFields: salesReturnFormCustomFields,
    customFieldValues: salesReturnFormCustomFieldValues,
    loadFieldValues: loadSalesReturnFormFieldValues,
    extractFormValues: extractSalesReturnFormValues,
    saveCustomFieldValues: saveSalesReturnCustomFieldValues,
    resetFieldValues: resetSalesReturnFormFieldValues,
  } = useCustomFields({ tableName: SALES_RETURN_CUSTOM_FIELD_TABLE, loadWhenOpen: true, open: modalVisible });

  const {
    customFields: salesReturnListCustomFields,
    generateCustomFieldColumns: generateSalesReturnCustomFieldColumns,
    enrichRecordsWithCustomFields: enrichSalesReturnRecordsWithCustomFields,
    customFieldValues: salesReturnDetailCustomFieldValues,
    loadFieldValuesForDetail: loadSalesReturnFieldValuesForDetail,
    resetDetailFieldValues: resetSalesReturnDetailFieldValues,
  } = useCustomFieldsForList<SalesReturn>({ tableName: SALES_RETURN_CUSTOM_FIELD_TABLE });

  useEffect(() => {
    if (salesReturnListCustomFields.length > 0 && actionRef.current) {
      setTimeout(() => actionRef.current?.reload(), 200);
    }
  }, [salesReturnListCustomFields.length]);

  const {
    selectedWarehouseId,
    locationOptions,
    updateSelectedWarehouseId,
    resetSelectedWarehouseId,
  } = useWarehouseLocationOptions();
  const [returnReasonOptions, setReturnReasonOptions] = useState(fallbackReturnReasonOptions);
  const [returnTypeOptions, setReturnTypeOptions] = useState(fallbackReturnTypeOptions);
  const [shippingMethodOptions, setShippingMethodOptions] = useState(fallbackShippingMethodOptions);
  const [dictOptionsLoading, setDictOptionsLoading] = useState(false);

  /** 打开表单时拉取字典；若租户未初始化则尝试同步系统字典（与 core 配置一致） */
  useEffect(() => {
    if (!modalVisible) return;
    let cancelled = false;
    (async () => {
      setDictOptionsLoading(true);
      const loadAll = async () => {
        const [reason, rtype, ship] = await Promise.all([
          getDictionaryOptions('RETURN_REASON'),
          getDictionaryOptions('RETURN_TYPE'),
          getDictionaryOptions('SHIPPING_METHOD'),
        ]);
        return { reason, rtype, ship };
      };
      try {
        let { reason, rtype, ship } = await loadAll();
        if (!cancelled && (reason.length === 0 || rtype.length === 0 || ship.length === 0)) {
          try {
            await initializeSystemDictionaries();
            if (!cancelled) ({ reason, rtype, ship } = await loadAll());
          } catch (e) {
            console.warn('initializeSystemDictionaries failed:', e);
          }
        }
        if (!cancelled) {
          setReturnReasonOptions(reason.length ? reason : fallbackReturnReasonOptions);
          setReturnTypeOptions(rtype.length ? rtype : fallbackReturnTypeOptions);
          setShippingMethodOptions(ship.length ? ship : fallbackShippingMethodOptions);
        }
      } finally {
        if (!cancelled) setDictOptionsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [modalVisible, fallbackReturnReasonOptions, fallbackReturnTypeOptions, fallbackShippingMethodOptions]);

  const renderSalesReturnRowActions = (actions: React.ReactNode[], keyPrefix: string) => {
    return renderRowActionsOverflow(actions, keyPrefix);
  };

  const salesReturnCustomFieldColumns = generateSalesReturnCustomFieldColumns();

  // 表格列定义
  const columns: ProColumns<SalesReturn>[] = [
    {
      title: t('app.kuaizhizao.salesReturn.colCustomerReturnCode'),
      key: 'return_code',
      dataIndex: 'return_code',
      ...UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
      fixed: 'left',
      render: (_, record) => (
        <UniTableStackedPrimaryCell
          primary={String(record.customer_name ?? '')}
          secondary={String(record.return_code ?? '')}
        />
      ),
    },
    { title: t('app.kuaizhizao.salesReturn.colReturnCode'), dataIndex: 'return_code', hideInTable: true },
    { title: t('app.kuaizhizao.salesReturn.customer'), dataIndex: 'customer_name', hideInTable: true },
    {
      title: t('app.kuaizhizao.salesReturn.colSalesDeliveryCode'),
      dataIndex: 'sales_delivery_code',
      width: 140,
      ellipsis: true,
    },
    {
      title: t('app.kuaizhizao.salesReturn.colSalesOrderCode'),
      dataIndex: 'sales_order_code',
      width: 140,
      ellipsis: true,
    },
    {
      title: t('app.kuaizhizao.salesReturn.colWarehouse'),
      dataIndex: 'warehouse_name',
      width: 120,
      ellipsis: true,
    },
    {
      title: t('app.kuaizhizao.salesReturn.totalQuantity'),
      dataIndex: 'total_quantity',
      width: 100,
      align: 'right',
    },
    {
      title: t('app.kuaizhizao.salesReturn.totalAmount'),
      dataIndex: 'total_amount',
      width: 120,
      align: 'right',
      render: (text: any) => `¥${Number(text || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    },
    {
      title: t('app.kuaizhizao.salesReturn.returnTime'),
      dataIndex: 'return_time',
      valueType: 'dateTime',
      width: 160,
    },
    {
      title: t('common.createdAt'),
      dataIndex: 'created_at',
      valueType: 'dateTime',
      width: 160,
    },
    {
      title: t('app.kuaizhizao.salesReturn.colLifecycle'),
      dataIndex: LIST_LIFECYCLE_STAGE_FIELD,
      align: 'center',
      fixed: 'right',
      render: (_, record) => (
        <ListUniLifecycleCell lifecycle={getSalesReturnLifecycle(record as any, t)} />
      ),
    },
    ...salesReturnCustomFieldColumns,
    {
      title: t('common.actions'),
      width: 220,
      fixed: 'right',
      render: (_, record) => renderSalesReturnRowActions([
        <Button {...rowActionKind('read')} key="detail" onClick={() => handleDetail(record)}>{t('common.detail')}</Button>,
        record.capabilities?.update?.allowed && salesReturnPerms.canUpdate ? (
          <Button {...rowActionKind('update')} key="edit" onClick={() => void handleEdit(record)}>{t('common.edit')}</Button>
        ) : null,
      ].filter(Boolean), `sr-${record.id ?? 'row'}`),
    },
  ];

  // 处理详情查看
  const handleDetail = async (record: SalesReturn) => {
    try {
      const detail = await warehouseApi.salesReturn.get(record.id!.toString());
      setReturnDetail(detail as SalesReturnDetail);
      setDetailDrawerVisible(true);
      setTrackingRefreshKey((k) => k + 1);
      if (record.id != null) {
        await loadSalesReturnFieldValuesForDetail(record.id);
      }
    } catch (error) {
      messageApi.error(t('app.kuaizhizao.salesReturn.detailFailed'));
    }
  };

  const buildSalesReturnItemsPayload = (items: any[]) =>
    (items || []).map((it) => {
      const qty = Number(it.return_quantity ?? 0);
      const price = Number(it.unit_price ?? 0);
      const total = Number((it.total_amount != null ? it.total_amount : qty * price).toFixed(2));
      return {
        sales_delivery_item_id: it.sales_delivery_item_id ?? undefined,
        material_id: it.material_id,
        material_code: it.material_code || '',
        material_name: it.material_name || '',
        material_spec: it.material_spec ?? undefined,
        material_unit: it.material_unit || t('app.kuaizhizao.salesReturn.defaultUnit'),
        return_quantity: qty,
        unit_price: price,
        total_amount: total,
        batch_number: it.batch_number ?? undefined,
        location_code: it.location_code ?? undefined,
        notes: it.notes ?? undefined,
      };
    });

  // 处理新增
  const handleCreate = () => {
    setEditingId(null);
    setEditingDetail(null);
    resetSalesReturnFormFieldValues();
    resetSelectedWarehouseId();
    setPendingFormValues({
      return_time: dayjs(),
      items: [{ return_quantity: 1, unit_price: 0 }],
    });
    setModalVisible(true);
  };

  const pullSalesOrderColumns: ProColumns<PullSalesOrderCandidate>[] = useMemo(
    () => [
      { title: t('app.kuaizhizao.salesReturn.salesOrderNo'), dataIndex: 'order_code', width: 180, ellipsis: true },
      { title: t('app.kuaizhizao.salesReturn.customer'), dataIndex: 'customer_name', width: 220, ellipsis: true },
      { title: t('app.kuaizhizao.salesReturn.orderStatus'), dataIndex: 'status', width: 130, align: 'center' },
      { title: t('app.kuaizhizao.salesReturn.deliveryDate'), dataIndex: 'delivery_date', width: 130, render: (v) => (v ? formatDateTime(v, 'YYYY-MM-DD') : '-') },
      { title: t('common.updatedAt'), dataIndex: 'updated_at', width: 180, render: (v) => (v ? formatDateTime(v, 'YYYY-MM-DD HH:mm:ss') : '-') },
    ],
    [t],
  );

  const pullFromSalesOrderQuery = useUniPullQuery<PullSalesOrderCandidate>({
    rowKey: 'id',
    selectionType: 'radio',
    loadData: async ({ keyword, page, pageSize }) => {
      try {
        const res = await listSalesOrders({
          skip: 0,
          limit: 200,
          keyword: keyword.trim() || undefined,
        });
        const orders = Array.isArray((res as any)?.data) ? (res as any).data : [];
        const candidates = orders.map((order: any) => ({
          id: Number(order.id),
          order_code: order.order_code,
          customer_name: order.customer_name,
          status: order.status,
          delivery_date: order.delivery_date,
          updated_at: order.updated_at,
        }));
        const start = (page - 1) * pageSize;
        return { data: candidates.slice(start, start + pageSize), total: candidates.length };
      } catch (error: any) {
        messageApi.error(error?.message || t('app.kuaizhizao.salesReturn.loadSalesOrdersFailed'));
        return { data: [], total: 0 };
      }
    },
    onConfirm: async (keys) => {
      const selectedId = Number(keys[0]);
      if (!selectedId || selectedId <= 0) {
        messageApi.warning(t('app.kuaizhizao.salesReturn.selectSalesOrder'));
        return;
      }
      if (!pullWarehouseId || pullWarehouseId <= 0) {
        messageApi.warning(t('app.kuaizhizao.salesReturn.selectReturnWarehouse'));
        return;
      }
      await warehouseApi.salesReturn.pullFromSalesOrder({
        sales_order_id: selectedId,
        warehouse_id: pullWarehouseId,
        warehouse_name: pullWarehouseName || undefined,
      });
      messageApi.success(t('app.kuaizhizao.salesReturn.pullSuccess'));
      invalidateMenuBadgeCounts();
      actionRef.current?.reload();
      pullFromSalesOrderQuery.closeModal();
    },
  });

  const openPullFromSalesOrder = () => {
    setPullWarehouseId(undefined);
    setPullWarehouseName('');
    pullFromSalesOrderQuery.openModal();
  };

  const handleEdit = async (record: SalesReturn) => {
    try {
      const detail = (await warehouseApi.salesReturn.get(record.id!.toString())) as SalesReturnDetail;
      setEditingId(record.id!);
      setEditingDetail(detail);
      updateSelectedWarehouseId(detail.warehouse_id ?? null);
      const rt = detail.return_time ? dayjs(detail.return_time) : dayjs();
      setPendingFormValues({
        customer_id: detail.customer_id,
        customer_name: detail.customer_name,
        warehouse_id: detail.warehouse_id,
        warehouse_name: detail.warehouse_name,
        return_time: rt,
        return_reason: detail.return_reason,
        return_type: detail.return_type,
        shipping_method: detail.shipping_method,
        notes: detail.notes,
        attachments: mapAttachmentsToUploadList(detail.attachments),
        items: (detail.items || []).map((it) => ({
          material_id: it.material_id,
          material_code: it.material_code,
          material_name: it.material_name,
          return_quantity: it.return_quantity,
          unit_price: it.unit_price,
          batch_number: it.batch_number,
          location_code: it.location_code,
          notes: it.notes,
          sales_delivery_item_id: it.sales_delivery_item_id,
          material_spec: (it as any).material_spec,
          material_unit: (it as any).material_unit ?? t('app.kuaizhizao.salesReturn.defaultUnit'),
        })),
      });
      if (record.id != null) {
        window.setTimeout(() => {
          loadSalesReturnFormFieldValues(record.id!).then((fieldFormValues) => {
            formRef.current?.setFieldsValue(fieldFormValues);
          });
        }, 100);
      }
      setModalVisible(true);
    } catch {
      messageApi.error(t('app.kuaizhizao.salesReturn.loadDetailFailed'));
    }
  };

  // 处理批量删除
  const handleDelete = async (keys: React.Key[]) => {
    if (!keys || keys.length === 0) return;
    try {
      for (const id of keys) {
        await warehouseApi.salesReturn.delete(String(id));
      }
      messageApi.success(t('app.kuaizhizao.salesReturn.batchDeleteSuccess', { count: keys.length }));
      invalidateMenuBadgeCounts();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('app.kuaizhizao.salesReturn.deleteFailed'));
    }
  };

  // 表单提交处理
  const onFinish = async (values: any) => {
    try {
      const { customData, standardValues } = extractSalesReturnFormValues(values);
      const itemsPayload = buildSalesReturnItemsPayload(standardValues.items);
      const returnTime =
        standardValues.return_time && typeof standardValues.return_time.format === 'function'
          ? standardValues.return_time.format('YYYY-MM-DD')
          : standardValues.return_time;
      let recordId: number | undefined;
      if (editingId) {
        const detail = editingDetail;
        if (!detail?.capabilities?.update?.allowed) {
          messageApi.warning(t('app.kuaizhizao.salesReturn.editNotAllowed'));
          return;
        }
        await warehouseApi.salesReturn.update(editingId.toString(), {
          customer_id: standardValues.customer_id,
          customer_name: standardValues.customer_name ?? detail.customer_name,
          warehouse_id: standardValues.warehouse_id,
          warehouse_name: standardValues.warehouse_name ?? detail.warehouse_name,
          return_time: returnTime,
          return_reason: standardValues.return_reason ?? null,
          return_type: standardValues.return_type ?? detail.return_type ?? '质量问题',
          shipping_method: standardValues.shipping_method ?? null,
          tracking_number: detail.tracking_number ?? null,
          shipping_address: detail.shipping_address ?? null,
          notes: standardValues.notes ?? null,
          attachments: normalizeDocumentAttachments(standardValues.attachments),
          sales_delivery_id: detail.sales_delivery_id ?? null,
          sales_delivery_code: detail.sales_delivery_code ?? null,
          sales_order_id: detail.sales_order_id ?? null,
          sales_order_code: detail.sales_order_code ?? null,
          status: detail.status,
          items: itemsPayload,
        });
        recordId = editingId;
        messageApi.success(t('app.kuaizhizao.salesReturn.updateSuccess'));
      } else {
        const created = await warehouseApi.salesReturn.create({
          ...standardValues,
          return_time: returnTime,
          attachments: normalizeDocumentAttachments(standardValues.attachments),
          items: itemsPayload,
        });
        recordId = (created as any)?.id;
        messageApi.success(t('app.kuaizhizao.salesReturn.createSuccess'));
      }
      if (recordId != null) {
        await saveSalesReturnCustomFieldValues(recordId, customData);
      }
      setModalVisible(false);
      resetSalesReturnFormFieldValues();
      setEditingId(null);
      setEditingDetail(null);
      setPendingFormValues(null);
      resetSelectedWarehouseId();
      invalidateMenuBadgeCounts();

      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('app.kuaizhizao.salesReturn.operationFailed'));
    }
  };

  // 产品选择器追加明细
  const appendItemsFromMaterials = (materials: Material[]) => {
    const currentItems = formRef.current?.getFieldValue('items') || [];
    const newItems = materials.map(m => ({
      material_id: m.id,
      material_code: m.mainCode,
      material_name: m.name,
      material_spec: m.specification,
      material_unit: m.baseUnit,
      return_quantity: 1,
      unit_price: m.defaults?.defaultSalePrice ?? 0,
    }));
    formRef.current?.setFieldsValue({
      items: [...currentItems, ...newItems]
    });
    setMaterialPickerOpen(false);
  };

  // Excel导入处理
  const handleImport = (data: any[]) => {
    const materialCodeKeys = [
      t('app.kuaizhizao.salesReturn.import.materialCode'),
      t('app.kuaizhizao.salesOrder.materialCode'),
      '产品编号',
    ];
    const returnQuantityKeys = [
      t('app.kuaizhizao.salesReturn.import.returnQuantity'),
      '退货数量',
    ];
    const unitPriceKeys = [
      t('app.kuaizhizao.salesReturn.import.unitPrice'),
      t('app.kuaizhizao.salesOrder.unitPrice'),
      '单价',
    ];
    const batchNumberKeys = [
      t('app.kuaizhizao.salesReturn.import.batchNumber'),
      '批次号',
    ];
    const locationKeys = [
      t('app.kuaizhizao.salesReturn.import.location'),
      '库位',
    ];
    const notesKeys = [
      t('app.kuaizhizao.salesReturn.import.notes'),
      t('app.kuaizhizao.common.fieldNotes'),
      '备注',
    ];
    const currentItems = formRef.current?.getFieldValue('items') || [];
    const newItems = data.map((row) => ({
      material_code: getImportRowValue(row, materialCodeKeys),
      return_quantity: Number(getImportRowValue(row, returnQuantityKeys) ?? 1),
      unit_price: Number(getImportRowValue(row, unitPriceKeys) ?? 0),
      batch_number: getImportRowValue(row, batchNumberKeys),
      location_code: getImportRowValue(row, locationKeys),
      notes: getImportRowValue(row, notesKeys),
    }));
    formRef.current?.setFieldsValue({
      items: [...currentItems, ...newItems]
    });
    setImportModalVisible(false);
  };

  // 详情列 definition
  const detailColumns: ProDescriptionsItemProps<SalesReturnDetail>[] = [
    {
      title: t('app.kuaizhizao.salesReturn.colReturnCode'),
      dataIndex: 'return_code',
    },
    {
      title: t('app.kuaizhizao.salesReturn.colSalesDeliveryCode'),
      dataIndex: 'sales_delivery_code',
    },
    {
      title: t('app.kuaizhizao.salesReturn.colSalesOrderCode'),
      dataIndex: 'sales_order_code',
    },
    {
      title: t('app.kuaizhizao.salesReturn.customer'),
      dataIndex: 'customer_name',
    },
    {
      title: t('app.kuaizhizao.salesReturn.colWarehouse'),
      dataIndex: 'warehouse_name',
    },
    {
      title: t('app.kuaizhizao.salesReturn.returnStatus'),
      dataIndex: 'status',
      render: (status) => {
        const statusMap: Record<string, { text: string; color: string }> = {
          '待退货': { text: t('app.kuaizhizao.salesReturn.statusPending'), color: 'default' },
          '已退货': { text: t('app.kuaizhizao.salesReturn.statusReturned'), color: 'success' },
          '已取消': { text: t('app.kuaizhizao.salesReturn.statusCancelled'), color: 'error' },
        };
        const config = statusMap[(status as any) || ''] || { text: getReturnStatusLabel(status as string), color: 'default' };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: t('app.kuaizhizao.salesReturn.returnReason'),
      dataIndex: 'return_reason',
    },
    {
      title: t('app.kuaizhizao.salesReturn.returnType'),
      dataIndex: 'return_type',
    },
    {
      title: t('app.kuaizhizao.salesReturn.totalQuantity'),
      dataIndex: 'total_quantity',
    },
    {
      title: t('app.kuaizhizao.salesReturn.totalAmount'),
      dataIndex: 'total_amount',
      render: (text) => `¥${text?.toLocaleString() || 0}`,
    },
    {
      title: t('app.kuaizhizao.salesReturn.returnTime'),
      dataIndex: 'return_time',
      valueType: 'dateTime',
    },
    {
      title: t('app.kuaizhizao.salesReturn.returner'),
      dataIndex: 'returner_name',
    },
  ];

  return (
    <>
      <ListPageTemplate>
        <UniTable
          columnPersistenceId="apps.kuaizhizao.pages.sales-management.sales-returns"
          headerTitle={t('app.kuaizhizao.salesReturn.title')}
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          onTableDataChange={(rows) => {
            tableRowsRef.current = rows;
          }}
          selectedRowKeys={selectedRowKeys}
          onRowSelectionChange={setSelectedRowKeys}
          showAdvancedSearch={true}
          showCreateButton={false}
          createButtonText={t('app.kuaizhizao.salesReturn.create')}
          onCreate={handleCreate}
          toolBarRender={() => [
            <UniPullCreateToolbar
              compactKey="create-sales-return-with-pull"
              createIcon={<PlusOutlined />}
              createLabel={t('app.kuaizhizao.salesReturn.create')}
              onCreate={handleCreate}
              menuItems={[
                {
                  key: 'pull-from-sales-order',
                  label: pullFromSalesOrderAction.label,
                  onClick: openPullFromSalesOrder,
                },
              ]}
            />,
          ]}
          request={async (params) => {
            try {
              const response = await warehouseApi.salesReturn.list({
                skip: (params.current! - 1) * params.pageSize!,
                limit: params.pageSize,
                status: params.status,
                sales_delivery_id: params.sales_delivery_id,
                customer_id: params.customer_id,
              });
              const list = Array.isArray(response) ? response : response.data || [];
              const enriched = await enrichSalesReturnRecordsWithCustomFields(list);
              return {
                data: enriched,
                success: true,
                total: Array.isArray(response) ? enriched.length : response.total || enriched.length,
              };
            } catch (error) {
              messageApi.error(t('app.kuaizhizao.salesReturn.listFailed'));
              return {
                data: [],
                success: false,
                total: 0,
              };
            }
          }}
          enableRowSelection={true}
          showDeleteButton={true}
          onDelete={handleDelete}
          deleteConfirmTitle={(count) => t('app.kuaizhizao.salesReturn.confirmBatchDelete', { count })}
          toolBarActionsAfterBatch={[
            <UniCapabilityBatchButton
              key="sales-return-confirm"
              selectedRowKeys={selectedRowKeys}
              selectedRecords={selectedReturnsForBatch}
              capabilityKey="confirm"
              permAllowed={salesReturnPerms.canAction?.('submit') ?? false}
              batchAllowed={salesReturnBatchConfirmAllowed}
              onRun={(id) => warehouseApi.salesReturn.confirm(String(id))}
              notAllowedMessage={t('app.kuaizhizao.salesReturn.batchConfirmNotAllowed')}
              onSuccess={() => {
                setSelectedRowKeys([]);
                invalidateMenuBadgeCounts();
                actionRef.current?.reload();
              }}
              requireConfirm
              labels={{
                single: t('app.kuaizhizao.salesReturn.confirmReturn'),
                batch: t('app.kuaizhizao.salesReturn.batchConfirm'),
                singleConfirmTitle: t('app.kuaizhizao.salesReturn.confirmTitle'),
              }}
              icon={<CheckCircleOutlined />}
              size="middle"
              color="green"
              variant="solid"
            />,
            <UniCapabilityBatchButton
              key="sales-return-withdraw"
              selectedRowKeys={selectedRowKeys}
              selectedRecords={selectedReturnsForBatch}
              capabilityKey="withdraw"
              permAllowed={salesReturnPerms.canAction?.('revoke') ?? false}
              batchAllowed={salesReturnBatchWithdrawAllowed}
              onRun={(id) => warehouseApi.salesReturn.withdraw(String(id))}
              notAllowedMessage={t('app.kuaizhizao.salesReturn.batchWithdrawNotAllowed')}
              onSuccess={() => {
                setSelectedRowKeys([]);
                invalidateMenuBadgeCounts();
                actionRef.current?.reload();
              }}
              requireConfirm
              labels={{
                single: t('app.kuaizhizao.salesReturn.withdrawConfirm'),
                batch: t('app.kuaizhizao.salesReturn.batchWithdraw'),
              }}
              icon={<CopyOutlined />}
              size="middle"
              color="orange"
              variant="solid"
            />,
            <UniCapabilityBatchButton
              key="sales-return-print"
              selectedRowKeys={selectedRowKeys}
              selectedRecords={selectedReturnsForBatch}
              capabilityKey="print"
              permAllowed={salesReturnPerms.canPrint}
              batchAllowed={(records, perm) =>
                Boolean(perm) && records.some((record) => record.capabilities?.print?.allowed === true)
              }
              singleOnly
              onRun={async (id) => {
                openPrint({ documentType: 'sales_return', documentId: id });
              }}
              labels={{
                single: t('components.uniAction.print'),
                batch: t('components.uniAction.print'),
              }}
              icon={<PrinterOutlined />}
              size="middle"
            />,
          ]}
          scroll={{ x: 1200 }}
        />
      </ListPageTemplate>

      <FormModalTemplate
        title={editingId ? t('app.kuaizhizao.salesReturn.editTitle') : t('app.kuaizhizao.salesReturn.createTitle')}
        open={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setEditingId(null);
          setEditingDetail(null);
          setPendingFormValues(null);
          resetSalesReturnFormFieldValues();
        }}
        afterOpenChange={(open) => {
          if (open) {
            if (pendingFormValues) {
              formRef.current?.setFieldsValue(pendingFormValues);
            }
            return;
          }
          formRef.current?.resetFields?.();
          setPendingFormValues(null);
        }}
        onFinish={onFinish}
        formRef={formRef}
        width={MODAL_CONFIG.LARGE_WIDTH}
      >
        <Row gutter={16}>
          <Col span={8}>
            <ProFormSelect
              name="customer_id"
              label={t('app.kuaizhizao.salesReturn.customer')}
              placeholder={t('app.kuaizhizao.salesReturn.selectCustomer')}
              required
              request={async () => {
                const res = await customerApi.list({ limit: 1000, isActive: true });
                const list = Array.isArray(res) ? res : (res as any)?.data || (res as any)?.items || [];
                return list.map((c: any) => ({
                  label: c.name || c.customer_name || c.code || t('app.kuaizhizao.salesReturn.customerFallback', { id: c.id }),
                  value: c.id ?? c.customer_id,
                }));
              }}
              fieldProps={{
                showSearch: true,
                optionFilterProp: 'label',
                onChange: (_, option) => {
                  formRef.current?.setFieldsValue({ customer_name: (option as any)?.label ?? '' });
                },
              }}
              rules={[{ required: true, message: t('app.kuaizhizao.salesReturn.selectCustomer') }]}
            />
            <ProFormText name="customer_name" hidden />
          </Col>
          <Col span={8}>
            <UniWarehouseSelect
              name="warehouse_id"
              label={t('app.kuaizhizao.salesReturn.returnWarehouse')}
              placeholder={t('app.kuaizhizao.salesReturn.selectWarehouse')}
              required
              onChange={(value, wh) => {
                formRef.current?.setFieldsValue({ warehouse_name: (wh as any)?.name ?? '' });
                updateSelectedWarehouseId(value);
              }}
              rules={[{ required: true, message: t('app.kuaizhizao.salesReturn.selectWarehouse') }]}
            />
            <ProFormText name="warehouse_name" hidden />
          </Col>
          <Col span={8}>
            <ProFormDatePicker
              name="return_time"
              label={t('app.kuaizhizao.salesReturn.returnDate')}
              required
              fieldProps={{ style: { width: '100%' } }}
              initialValue={dayjs()}
            />
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={8}>
            <ProFormSelect
              name="return_reason"
              label={t('app.kuaizhizao.salesReturn.returnReason')}
              placeholder={t('app.kuaizhizao.salesReturn.selectReturnReason')}
              options={returnReasonOptions}
              fieldProps={{ showSearch: true, allowClear: true, loading: dictOptionsLoading }}
            />
          </Col>
          <Col span={8}>
            <ProFormSelect
              name="return_type"
              label={t('app.kuaizhizao.salesReturn.returnType')}
              placeholder={t('app.kuaizhizao.salesReturn.selectReturnType')}
              options={returnTypeOptions}
              fieldProps={{ showSearch: true, allowClear: true, loading: dictOptionsLoading }}
            />
          </Col>
          <Col span={8}>
            <ProFormSelect
              name="shipping_method"
              label={t('app.kuaizhizao.salesOrder.shippingMethod')}
              placeholder={t('app.kuaizhizao.salesReturn.selectShippingMethod')}
              options={shippingMethodOptions}
              fieldProps={{ showSearch: true, allowClear: true, loading: dictOptionsLoading }}
            />
          </Col>
          <CustomFieldsFormSection
            customFields={salesReturnFormCustomFields}
            customFieldValues={salesReturnFormCustomFieldValues}
            gridColumns={3}
            embedInParentRow
          />
        </Row>

        <DocumentDetailTableStyles />
        <UniTableDetail
          name="items"
          title={t('app.kuaizhizao.salesReturn.itemsTitle')}
          required
          requiredMessage={t('app.kuaizhizao.salesReturn.itemsRequired')}
          headerExtra={(
            <Space size={8}>
              <Button
                type="default"
                icon={<ImportOutlined />}
                onClick={() => setImportModalVisible(true)}
              >
                {t('app.kuaizhizao.salesReturn.importItems')}
              </Button>
              <Button
                type="default"
                icon={<PlusOutlined />}
                onClick={() => {
                  const items = [...(formRef.current?.getFieldValue('items') ?? [])];
                  items.push({ return_quantity: 1, unit_price: 0 });
                  formRef.current?.setFieldsValue({ items });
                }}
              >
                {t('common.addDetail')}
              </Button>
              <Button
                type="default"
                icon={<AppstoreAddOutlined />}
                onClick={() => setMaterialPickerOpen(true)}
              >
                {t('app.kuaizhizao.sales.common.productBatchSelect')}
              </Button>
            </Space>
          )}
          columns={[
                    {
                      title: productColumnTitle,
                      dataIndex: 'material_id',
                      width: DOCUMENT_DETAIL_COL_WIDTH.material,
                      ...DOCUMENT_DETAIL_TEXT_COL,
                      render: (_: unknown, __: unknown, index: number) => (
                        <UniMaterialSelect
                          name={[index, 'material_id']}
                          label=""
                          placeholder={t('app.kuaizhizao.salesOrder.materialPickerTitle')}
                          required
                          size={DOCUMENT_DETAIL_CONTROL_SIZE}
                          listFieldKey={index}
                          listFieldName="items"
                          fillMapping={{
                            material_code: 'mainCode',
                            material_name: 'name',
                            material_spec: 'specification',
                            material_unit: 'baseUnit',
                          }}
                          sourceType={materialSourceType}
                          showAdvancedSearch
                        />
                      ),
                    },
                    {
                      title: t('app.kuaizhizao.salesReturn.batchNumber'),
                      dataIndex: 'batch_number',
                      width: 150,
                      ...DOCUMENT_DETAIL_TEXT_COL,
                      render: (_: unknown, __: unknown, index: number) => (
                        <AntForm.Item name={[index, 'batch_number']} noStyle>
                          <Input size={DOCUMENT_DETAIL_CONTROL_SIZE} placeholder={t('app.kuaizhizao.salesReturn.batchNumberPlaceholder')} />
                        </AntForm.Item>
                      ),
                    },
                    {
                      title: t('app.kuaizhizao.salesReturn.location'),
                      dataIndex: 'location_code',
                      width: 180,
                      ...DOCUMENT_DETAIL_TEXT_COL,
                      render: (_: unknown, __: unknown, index: number) => (
                        <AntForm.Item name={[index, 'location_code']} noStyle>
                          <Select
                            options={locationOptions}
                            placeholder={selectedWarehouseId ? t('app.kuaizhizao.salesReturn.selectLocation') : t('app.kuaizhizao.salesReturn.selectWarehouseFirst')}
                            style={{ width: '100%' }}
                            size={DOCUMENT_DETAIL_CONTROL_SIZE}
                            showSearch
                            optionFilterProp="label"
                            allowClear
                            disabled={!selectedWarehouseId}
                          />
                        </AntForm.Item>
                      ),
                    },
                    {
                      title: t('app.kuaizhizao.salesReturn.returnQuantity'),
                      dataIndex: 'return_quantity',
                      width: DOCUMENT_DETAIL_COL_WIDTH.quantity,
                      ...DOCUMENT_DETAIL_NUM_COL,
                      render: (_: unknown, __: unknown, index: number) => (
                        <AntForm.Item name={[index, 'return_quantity']} noStyle>
                          <InputNumber size={DOCUMENT_DETAIL_CONTROL_SIZE} style={{ width: '100%' }} min={1} />
                        </AntForm.Item>
                      ),
                    },
                    {
                      title: t('app.kuaizhizao.salesOrder.unitPrice'),
                      dataIndex: 'unit_price',
                      width: DOCUMENT_DETAIL_COL_WIDTH.unitPrice,
                      ...DOCUMENT_DETAIL_NUM_COL,
                      render: (_: unknown, __: unknown, index: number) => (
                        <AntForm.Item name={[index, 'unit_price']} noStyle>
                          <InputNumber size={DOCUMENT_DETAIL_CONTROL_SIZE} style={{ width: '100%' }} min={0} prefix="¥" />
                        </AntForm.Item>
                      ),
                    },
                  ]}
          disabledAdd
          initialValue={{ return_quantity: 1, unit_price: 0 }}
          tableProps={DOCUMENT_DETAIL_TABLE_PROPS}
        />

        <ProFormTextArea name="notes" label={t('app.kuaizhizao.common.fieldNotes')} placeholder={t('app.kuaizhizao.salesReturn.notesPlaceholder')} fieldProps={{ rows: 3 }} />
        <DocumentAttachmentsField category="sales_return_attachments" />
      </FormModalTemplate>

      <UniMaterialBatchPicker
        open={materialPickerOpen}
        onCancel={() => setMaterialPickerOpen(false)}
        onConfirm={appendItemsFromMaterials}
      />

      <UniPullQueryModal<PullSalesOrderCandidate>
        open={pullFromSalesOrderQuery.open}
        title={pullFromSalesOrderAction.label}
        onCancel={pullFromSalesOrderQuery.closeModal}
        onOk={pullFromSalesOrderQuery.handleConfirm}
        rowKey="id"
        columns={pullSalesOrderColumns}
        dataSource={pullFromSalesOrderQuery.dataSource}
        loading={pullFromSalesOrderQuery.loading}
        confirmLoading={pullFromSalesOrderQuery.confirmLoading}
        selectionType={pullFromSalesOrderQuery.selectionType}
        selectedRowKeys={pullFromSalesOrderQuery.selectedRowKeys}
        onSelectedRowKeysChange={pullFromSalesOrderQuery.handleSelectedRowKeysChange}
        searchDraft={pullFromSalesOrderQuery.searchDraft}
        onSearchDraftChange={pullFromSalesOrderQuery.setSearchDraft}
        onSearchApply={pullFromSalesOrderQuery.handleSearchApply}
        onSearchClear={pullFromSalesOrderQuery.handleSearchClear}
        appliedKeyword={pullFromSalesOrderQuery.appliedKeyword}
        searchPlaceholder={t('app.kuaizhizao.salesReturn.pullSearchPlaceholder')}
        page={pullFromSalesOrderQuery.page}
        pageSize={pullFromSalesOrderQuery.pageSize}
        total={pullFromSalesOrderQuery.total}
        onPageChange={pullFromSalesOrderQuery.handlePageChange}
        okText={t('app.kuaizhizao.salesReturn.pullCreateButton')}
        filterExtra={
          <UniWarehouseSelect
            label={t('app.kuaizhizao.salesReturn.returnWarehouse')}
            placeholder={t('app.kuaizhizao.salesReturn.selectReturnWarehouseShort')}
            value={pullWarehouseId}
            onChange={(value, warehouse) => {
              const nextId = Number(value);
              setPullWarehouseId(Number.isFinite(nextId) && nextId > 0 ? nextId : undefined);
              setPullWarehouseName((warehouse as any)?.name ?? '');
            }}
          />
        }
        okButtonProps={{ disabled: !pullWarehouseId || pullWarehouseId <= 0 }}
      />

      <Suspense fallback={null}>
        <LazyUniImport
          visible={importModalVisible}
          onCancel={() => setImportModalVisible(false)}
          onConfirm={handleImport}
          title={t('app.kuaizhizao.salesReturn.importTitle')}
          headers={[
            t('app.kuaizhizao.salesReturn.import.materialCode'),
            t('app.kuaizhizao.salesReturn.import.returnQuantity'),
            t('app.kuaizhizao.salesReturn.import.unitPrice'),
            t('app.kuaizhizao.salesReturn.import.batchNumber'),
            t('app.kuaizhizao.salesReturn.import.location'),
            t('app.kuaizhizao.salesReturn.import.notes'),
          ]}
          exampleRow={[
            'MAT001',
            '10',
            '99.5',
            'B20260117001',
            'A01-01-01',
            t('app.kuaizhizao.salesReturn.import.notesExample'),
          ]}
        />
      </Suspense>

      {/* 详情Drawer */}
      <DetailDrawerTemplate
        title={t('app.kuaizhizao.salesReturn.detailTitle', {
          suffix: returnDetail?.return_code ? ` - ${returnDetail.return_code}` : '',
        })}
        open={detailDrawerVisible}
        zIndex={returnDetailDrawerZIndex}
        onClose={() => {
          setDetailDrawerVisible(false);
          setReturnDetail(null);
          resetSalesReturnDetailFieldValues();
        }}
        width={DRAWER_CONFIG.HALF_WIDTH}
        columns={[]}
        dataSource={returnDetail || undefined}
        extra={
          returnDetail?.id != null &&
          !(
            returnDetail.capabilities?.print?.allowed === false ||
            !salesReturnPerms.canPrint
          ) ? (
            <Space size="small">
              <Button
                icon={<PrinterOutlined />}
                onClick={() => openPrint({ documentType: 'sales_return', documentId: returnDetail.id! })}
              >
                {t('components.uniAction.print')}
              </Button>
            </Space>
          ) : null
        }
        customContent={
          returnDetail ? (
            <div style={{ padding: '16px 0' }}>
              <DetailDrawerSection title={t('app.kuaizhizao.salesReturn.basicInfo')}>
                <Table
                  size="small"
                  pagination={false}
                  columns={[
                    { title: t('app.kuaizhizao.salesReturn.fieldLabel'), dataIndex: 'k', width: 120 },
                    { title: t('app.kuaizhizao.salesReturn.valueLabel'), dataIndex: 'v' },
                  ]}
                  dataSource={[
                    {
                      key: 'return_code',
                      k: t('app.kuaizhizao.salesReturn.colReturnCode'),
                      v: (
                        <Space size={4}>
                          <span>{returnDetail.return_code || '-'}</span>
                          {returnDetail.return_code ? <Button type="link" size="small" icon={<CopyOutlined style={{ fontSize: 12 }} />} onClick={() => handleCopy(returnDetail.return_code)} /> : null}
                        </Space>
                      ),
                    },
                    { key: 'sales_delivery_code', k: t('app.kuaizhizao.salesReturn.colSalesDeliveryCode'), v: returnDetail.sales_delivery_code || '-' },
                    { key: 'sales_order_code', k: t('app.kuaizhizao.salesReturn.colSalesOrderCode'), v: returnDetail.sales_order_code || '-' },
                    { key: 'customer_name', k: t('app.kuaizhizao.salesReturn.customer'), v: returnDetail.customer_name || '-' },
                    { key: 'warehouse_name', k: t('app.kuaizhizao.salesReturn.colWarehouse'), v: returnDetail.warehouse_name || '-' },
                    { key: 'status', k: t('common.status'), v: getReturnStatusLabel(returnDetail.status) },
                    { key: 'return_reason', k: t('app.kuaizhizao.salesReturn.returnReason'), v: returnDetail.return_reason || '-' },
                    { key: 'return_type', k: t('app.kuaizhizao.salesReturn.returnType'), v: returnDetail.return_type || '-' },
                    { key: 'return_time', k: t('app.kuaizhizao.salesReturn.returnTime'), v: returnDetail.return_time || '-' },
                  ]}
                  rowKey="key"
                />
                {hasCustomFieldsDetailContent(salesReturnListCustomFields, salesReturnDetailCustomFieldValues) ? (
                  <div style={{ marginTop: 16 }}>
                    <CustomFieldsDetailSection
                      customFields={salesReturnListCustomFields}
                      customFieldValues={salesReturnDetailCustomFieldValues}
                    />
                  </div>
                ) : null}
                {returnDetail.notes ? (
                  <Table
                    size="small"
                    pagination={false}
                    style={{ marginTop: 16 }}
                    showHeader={false}
                    columns={[
                      { title: t('app.kuaizhizao.salesReturn.fieldLabel'), dataIndex: 'k', width: 120 },
                      { title: t('app.kuaizhizao.salesReturn.valueLabel'), dataIndex: 'v' },
                    ]}
                    dataSource={[{ key: 'notes', k: t('app.kuaizhizao.common.fieldNotes'), v: returnDetail.notes }]}
                    rowKey="key"
                  />
                ) : null}
              </DetailDrawerSection>

              <DetailDrawerSection title={t('app.kuaizhizao.salesOrder.lifecycle')}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {(() => {
                    const lifecycle = getSalesReturnLifecycle(returnDetail as any, t);
                    return (
                      <>
                        {(lifecycle.mainStages ?? []).length > 0 && (
                          <UniLifecycleStepper
                            steps={lifecycle.mainStages ?? []}
                            status={lifecycle.status}
                            showLabels
                            nextStepSuggestions={lifecycle.nextStepSuggestions}
                            hideNextStepSuggestions
                          />
                        )}
                      </>
                    );
                  })()}
                  {returnDetail.id != null ? (
                    <DetailDrawerInlineFullChain
                      documentType="sales_return"
                      documentId={returnDetail.id}
                      active={detailDrawerVisible}
                      selfDocumentId={returnDetail.id}
                      renderBriefActions={(doc) => (
                        <WarehouseTraceBriefPrimaryActions
                          doc={doc}
                          t={t}
                          navigate={navigate}
                          closeDrawer={() => {
                            setDetailDrawerVisible(false);
                            setReturnDetail(null);
                          }}
                        />
                      )}
                    />
                  ) : null}
                </div>
              </DetailDrawerSection>

              <DetailDrawerSection title={t('app.kuaizhizao.salesReturn.itemsInfo')}>
                <style>{`
                  .sales-return-detail-items .ant-table-wrapper .ant-table-body,
                  .sales-return-detail-items .ant-table-wrapper .ant-table-content {
                    overflow: visible !important;
                  }
                  .sales-return-detail-items .ant-table-thead > tr > th {
                    white-space: nowrap !important;
                  }
                `}</style>
                {returnDetail.items && returnDetail.items.length > 0 ? (
                  <div className="sales-return-detail-items" style={{ width: '100%', maxWidth: '100%', overflowX: 'auto', overflowY: 'hidden' }}>
                    <Table
                      size="small"
                      pagination={false}
                      tableLayout="fixed"
                      style={{ minWidth: 860 }}
                      columns={[
                        { title: t('app.kuaizhizao.salesOrder.materialCode'), dataIndex: 'material_code', width: 120 },
                        { title: t('app.kuaizhizao.salesOrder.materialName'), dataIndex: 'material_name', width: 150 },
                        { title: t('app.kuaizhizao.salesReturn.returnQuantity'), dataIndex: 'return_quantity', width: 100, align: 'right' },
                        { title: t('app.kuaizhizao.salesOrder.unitPrice'), dataIndex: 'unit_price', width: 100, align: 'right', render: (text) => `¥${text || 0}` },
                        { title: t('app.kuaizhizao.salesReturn.amount'), dataIndex: 'total_amount', width: 100, align: 'right', render: (text) => `¥${text || 0}` },
                        { title: t('app.kuaizhizao.salesReturn.import.batchNumber'), dataIndex: 'batch_number', width: 120 },
                        { title: t('app.kuaizhizao.salesReturn.location'), dataIndex: 'location_code', width: 100 },
                      ]}
                      dataSource={returnDetail.items}
                      rowKey="id"
                    />
                  </div>
                ) : (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('app.kuaizhizao.salesReturn.emptyItems')} />
                )}
              </DetailDrawerSection>

              <DetailDrawerSection title={t('app.kuaizhizao.salesReturn.operationHistory')}>
                {salesReturnTracking.loading && <Spin />}
                {salesReturnTracking.error && <Typography.Text type="danger">{salesReturnTracking.error}</Typography.Text>}
                {salesReturnTracking.data && <DocumentTrackingTimelineBody data={salesReturnTracking.data} />}
              </DetailDrawerSection>
            </div>
          ) : null
        }
      />
      {PrintModal}
    </>
  );
};

export default SalesReturnsPage;
