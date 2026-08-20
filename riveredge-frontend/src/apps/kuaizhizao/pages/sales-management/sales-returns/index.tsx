/**
 * 销售退货单管理页面
 *
 * 提供销售退货单的创建、查看和管理功能
 *
 * @author RiverEdge Team
 * @date 2026-01-17
 */

import React, { useRef, useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react';
import type { TFunction } from 'i18next';
import { rowActionKind } from '../../../../../components/uni-action';
import { useNavigate } from 'react-router-dom';
import { useInvalidateMenuBadgeCounts } from '../../../../../hooks/useInvalidateMenuBadgeCounts';
import { LinkedDocumentCode } from '../../../../../components/linked-document-code';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import {
  salesReturnBatchConfirmAllowed,
  salesReturnBatchWithdrawAllowed,
} from '../../../../../hooks/useDocumentCapabilities';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns, ProDescriptionsItemProps, ProForm, ProFormText, ProFormDatePicker, ProFormTextArea, ProFormDigit, ProFormSelect, ProFormInstance } from '@ant-design/pro-components';
import { App, Button, Space, Table, Row, Col, Form as AntForm, InputNumber, Input, Select, Dropdown, Typography, Spin, Empty, List, Descriptions } from 'antd';
import { EyeOutlined, CheckCircleOutlined, PlusOutlined, AppstoreAddOutlined, ImportOutlined, MoreOutlined, CopyOutlined, EditOutlined, PrinterOutlined } from '@ant-design/icons';
import { theme as AntdTheme } from 'antd';
import { UniTable, readPersistedUniTableViewType, type UniTableRequestMeta} from '../../../../../components/uni-table';
import {
  UniTableStackedPrimaryCell,
  UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
  MaterialStackedCell,
} from '../../../../../components/uni-table/stackedPrimaryColumn';
import { UniCapabilityBatchButton, UniAuditBatchMenuButton, createUniAuditBatchHandlers } from '../../../../../components/uni-batch';
import { UniPullCreateToolbar } from '../../../../../components/uni-pull';
import {
  UniPullQueryModal,
  isPullableScope,
  renderPullCapabilityTag,
  renderPullQueryDocStatus,
  useUniPullQuery,
} from '../../../../../components/uni-pull-query';
import { ListPageTemplate, DetailDrawerTemplate, DRAWER_CONFIG, MODAL_CONFIG, FormModalTemplate,   useDetailDrawerDescriptionItems } from '../../../../../components/layout-templates';
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
import type { SalesReturn, SalesReturnItem, SalesReturnListParams } from '../../../services/sales-return';
import { customerApi } from '../../../../master-data/services/supply-chain';
import { useWarehouseLocationOptions } from '../../../hooks/useWarehouseLocationOptions';
import { UniWarehouseSelect } from '../../../../../components/uni-warehouse-select';
import dayjs from 'dayjs';
import { UniLifecycleStepper } from '../../../../../components/uni-lifecycle';
import { getSalesReturnLifecycle, buildSalesReturnLifecycleValueEnum, resolveSalesReturnListLifecycleParams } from '../../../utils/salesReturnLifecycle';
import { createListAuditPhaseColumn } from '../shared/listAuditPhaseColumn';
import { alignProColumns, alignDescriptionColumns, SALES_DOC_LIST_FIELD_RANK } from '../shared/documentFieldAlignment';
import { useAuditRequired } from '../../../../../hooks/useAuditRequired';
import { UniWorkflowActions } from '../../../../../components/uni-workflow-actions';
import { isManualAuditEnabled } from '../../../../../utils/auditMode';
import { listSalesOrders } from '../../../services/sales-order';
import { LIST_LIFECYCLE_STAGE_FIELD } from '../../../../../utils/listLifecycleStage';
import { ListUniLifecycleCell } from '../shared/ListUniLifecycleCell';
import { buildDocumentAuditColumns } from '../../shared/documentAuditColumns';
import { flattenDocumentDetailRows, resolveDetailTableViewMode } from '../../shared/detailTableFlatRows';
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
import { buildKuaizhizaoPullCreateMenuItems, resolveKuaizhizaoDocumentAction } from '../../../constants/documentActionRegistry';
import { useKuaizhizaoPrintModal } from '../../../hooks/useKuaizhizaoPrintModal';
import { formatBusinessDateOnly, formatDateTime, formatQuantity } from '../../../../../utils/format';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';
import type { SalesReturnDeliveryPullLine, SalesReturnOrderPullLine } from '../../../services/warehouse-execution';
import { QuantityWithUnitDisplay } from '../../../../../components/quantity-with-unit';
import { extractProTableSort } from '../../../../../utils/tableQueryKey';
import { formDateRangeFormItemProps } from '../../../../../utils/formDate';
import { useImportDictionaryOptions } from '../../../../../hooks/useImportDictionaryOptions';
import { pickImportExampleValue } from '../../../../../utils/loadImportDictionaryValues';
import { importInChunksViaPerItemCreate } from '../../../../../utils/chunkedBulkImport';
import { materialApi } from '../../../../master-data/services/material';
import { warehouseApi as masterWarehouseApi } from '../../../../master-data/services/warehouse';
import { useImportMaterialUnitOptions } from '../../../../master-data/hooks/useImportMaterialUnitOptions';
import {
  buildDocumentReturnListImportTemplate,
  parseDocumentReturnListImport,
} from '../../shared/documentReturnListImport';
import {
  referenceDisplayToIdOptions,
  searchReferenceDisplay,
} from '../../../../../utils/referenceDisplay';
import { getAntdModal } from '../../../../../utils/antdAppApis';

const SALES_RETURN_RESOURCE = 'kuaizhizao:sales-return';
const SALES_RETURN_LIST_PERSISTENCE_ID =
  'apps.kuaizhizao.pages.sales-management.sales-returns.v2';
const SALES_RETURN_CUSTOM_FIELD_TABLE = 'apps_kuaizhizao_sales_returns';

type SalesReturnItemRow = SalesReturnItem & {
  _rowKey: string;
  return_id: number;
  return_code?: string;
  customer_name?: string;
  sales_delivery_code?: string;
  sales_order_code?: string;
  warehouse_name?: string;
  return_time?: string;
  status?: string;
  review_status?: string;
  lifecycle?: Record<string, unknown>;
  capabilities?: SalesReturn['capabilities'];
  audit?: SalesReturn['audit'];
};

/** 与后端 review_status / status 对齐，供 UniWorkflowActions 识别 */
const SR_WORKFLOW_DRAFT_STATUSES = ['草稿', 'draft'];
const SR_WORKFLOW_PENDING_STATUSES = ['待审核', 'pending_review', 'pending_approval', 'PENDING'];
const SR_WORKFLOW_APPROVED_STATUSES = ['审核通过', '已通过', 'approved', 'APPROVED'];
const SR_WORKFLOW_REJECTED_STATUSES = ['审核驳回', '已驳回', 'rejected', 'REJECTED'];

interface SalesReturnDetail extends SalesReturn {
  items?: SalesReturnItem[];
}

type CustomerOutboundBatchOption = {
  batch_number?: string | null;
  sales_delivery_id: number;
  sales_delivery_code: string;
  sales_delivery_item_id: number;
  material_id: number;
  material_code?: string;
  material_name?: string;
  returnable_quantity: number;
};

/** 手工建退货：按客户+物料加载已出库可退批号 */
const SalesReturnOutboundBatchSelect: React.FC<{
  customerId?: number;
  materialId?: number;
  deliveryItemId?: number;
  value?: string;
  onChange?: (value: string | undefined) => void;
  onPick?: (option: CustomerOutboundBatchOption | null) => void;
  size?: 'small' | 'middle' | 'large';
}> = ({ customerId, materialId, deliveryItemId, value, onChange, onPick, size }) => {
  const { t } = useTranslation();
  const [options, setOptions] = useState<CustomerOutboundBatchOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const cid = Number(customerId);
    const mid = Number(materialId);
    if (!Number.isFinite(cid) || cid <= 0 || !Number.isFinite(mid) || mid <= 0) {
      setOptions([]);
      return;
    }
    setLoading(true);
    void warehouseApi.salesReturn
      .listCustomerOutboundBatches({ customer_id: cid, material_id: mid })
      .then((res) => {
        if (cancelled) return;
        const rows = Array.isArray(res) ? res : [];
        setOptions(rows as CustomerOutboundBatchOption[]);
      })
      .catch(() => {
        if (!cancelled) setOptions([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [customerId, materialId]);

  const selectOptions = options.map((row) => {
    const batch = String(row.batch_number || '').trim();
    const label = batch
      ? `${batch} (${row.sales_delivery_code})`
      : `${row.sales_delivery_code}#${row.sales_delivery_item_id}`;
    return {
      label,
      value: String(row.sales_delivery_item_id),
      row,
    };
  });

  const selectedValue = (() => {
    const itemId = Number(deliveryItemId);
    if (Number.isFinite(itemId) && itemId > 0) {
      return String(itemId);
    }
    if (!value) return undefined;
    const matched = options.find((row) => String(row.batch_number || '').trim() === String(value).trim());
    return matched ? String(matched.sales_delivery_item_id) : undefined;
  })();

  const disabled = !Number(customerId) || !Number(materialId);

  return (
    <Select
      size={size}
      style={{ width: '100%' }}
      loading={loading}
      disabled={disabled}
      allowClear
      showSearch
      optionFilterProp="label"
      placeholder={
        disabled
          ? t('app.kuaizhizao.salesReturn.selectCustomerFirstForBatch')
          : options.length
            ? t('app.kuaizhizao.salesReturn.selectOutboundBatch')
            : t('app.kuaizhizao.salesReturn.noOutboundBatchForCustomer')
      }
      value={selectedValue}
      options={selectOptions}
      onChange={(next) => {
        const itemId = Number(next);
        const picked = options.find((row) => Number(row.sales_delivery_item_id) === itemId) || null;
        onChange?.(picked?.batch_number ? String(picked.batch_number) : undefined);
        onPick?.(picked);
      }}
    />
  );
};

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
  const { t, i18n } = useTranslation();
  const { openPrint, PrintModal } = useKuaizhizaoPrintModal();
  const pullFromSalesOrderAction = resolveKuaizhizaoDocumentAction(t, 'sales_return.pull_from_sales_order');
  const pullFromSalesDeliveryAction = resolveKuaizhizaoDocumentAction(t, 'sales_return.pull_from_sales_delivery');
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

  // 创建/编辑相关状态
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingDetail, setEditingDetail] = useState<SalesReturnDetail | null>(null);
  const [pendingFormValues, setPendingFormValues] = useState<Record<string, any> | null>(null);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const tableRowsRef = useRef<SalesReturn[]>([]);
  const [viewTypeState, setViewTypeState] = useState<'table' | 'detailTable' | 'help'>(() =>
    readPersistedUniTableViewType(SALES_RETURN_LIST_PERSISTENCE_ID, 'table', [
      'table',
      'detailTable',
      'help',
    ]) as 'table' | 'detailTable' | 'help',
  );
  const dataViewMode = resolveDetailTableViewMode(viewTypeState);
  const dataViewModeRef = useRef(dataViewMode);
  useEffect(() => {
    dataViewModeRef.current = dataViewMode;
  }, [dataViewMode]);
  const [customerList, setCustomerList] = useState<any[]>([]);
  const salesReturnLifecycleValueEnum = useMemo(
    () => buildSalesReturnLifecycleValueEnum(t),
    [t],
  );
  const salesReturnAuditEnabled = useAuditRequired('sales_return', false);
  const salesReturnAuditColumn = useMemo(
    () => createListAuditPhaseColumn<SalesReturn>({ t, auditEnabled: salesReturnAuditEnabled }),
    [t, salesReturnAuditEnabled],
  );

  const handleSalesReturnAuditSuccess = async () => {
    invalidateMenuBadgeCounts();
    actionRef.current?.reload();
    if (returnDetail?.id != null) {
      try {
        const updated = await warehouseApi.salesReturn.get(String(returnDetail.id));
        setReturnDetail(updated as SalesReturnDetail);
        setTrackingRefreshKey((k) => k + 1);
      } catch {
        /* 详情刷新失败不影响列表 */
      }
    }
  };

  const salesReturnAuditBatchHandlers = useMemo(
    () => createUniAuditBatchHandlers('sales_return'),
    [],
  );

  useEffect(() => {
    if (!modalVisible) return;
    let cancelled = false;
    customerApi
      .list({ limit: 200, isActive: true })
      .then((res) => {
        if (!cancelled) {
          setCustomerList(Array.isArray(res) ? res : (res as any)?.data || (res as any)?.items || []);
        }
      })
      .catch(() => {
        if (!cancelled) setCustomerList([]);
      });
    return () => {
      cancelled = true;
    };
  }, [modalVisible]);

  const selectedReturnsForBatch = useMemo(
    () =>
      selectedRowKeys
        .map((key) => tableRowsRef.current.find((row) => String(row.id) === String(key)))
        .filter((row): row is SalesReturn => row != null),
    [selectedRowKeys],
  );
  const [materialPickerOpen, setMaterialPickerOpen] = useState(false);
  const [productScope, setProductScope] = useState<'make' | 'all'>('make');
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

  const pullSourceOrderIdRef = useRef<number | undefined>(undefined);
  const [pullSourceOrderId, setPullSourceOrderId] = useState<number | undefined>();
  const [pullSourceOrderOptions, setPullSourceOrderOptions] = useState<Array<{ value: number; label: string }>>([]);
  const pullSourceDeliveryIdRef = useRef<number | undefined>(undefined);
  const [pullSourceDeliveryId, setPullSourceDeliveryId] = useState<number | undefined>();
  const [pullSourceDeliveryOptions, setPullSourceDeliveryOptions] = useState<Array<{ value: number; label: string }>>([]);
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
  const materialUnitImport = useImportMaterialUnitOptions();
  const salesReturnImportDict = useImportDictionaryOptions([
    'RETURN_REASON',
    'RETURN_TYPE',
    'SHIPPING_METHOD',
  ]);
  const salesReturnLineUnitOptions = materialUnitImport.options;
  const salesReturnImportDictBag = useMemo(
    () => ({
      ...salesReturnImportDict,
      MATERIAL_UNIT: materialUnitImport.options,
      parseDict: (code: string, raw?: string | null) =>
        code === 'MATERIAL_UNIT'
          ? materialUnitImport.parse(raw)
          : salesReturnImportDict.parseDict(code, raw),
    }),
    [salesReturnImportDict, materialUnitImport.options, materialUnitImport.parse],
  );
  const salesReturnLineImportColumnOptions = useMemo(
    () => [
      undefined,
      salesReturnLineUnitOptions,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
    ],
    [salesReturnLineUnitOptions],
  );
  const salesReturnListImportTemplate = useMemo(
    () =>
      buildDocumentReturnListImportTemplate(t, salesReturnImportDictBag, {
        partnerField: 'customer',
        codeLabelKey: 'app.kuaizhizao.salesReturn.colReturnCode',
        partnerLabelKey: 'app.kuaizhizao.salesReturn.customer',
        partnerAliases: ['客户', '客户名称'],
        materialLabelKey: 'app.kuaizhizao.salesReturn.import.materialCode',
        unitLabelKey: 'app.kuaizhizao.salesReturn.import.unit',
        qtyLabelKey: 'app.kuaizhizao.salesReturn.import.returnQuantity',
        unitPriceLabelKey: 'app.kuaizhizao.salesReturn.import.unitPrice',
        batchLabelKey: 'app.kuaizhizao.salesReturn.import.batchNumber',
        locationLabelKey: 'app.kuaizhizao.salesReturn.import.location',
        notesLabelKey: 'app.kuaizhizao.salesReturn.import.notes',
        defaultUnit: t('app.kuaizhizao.salesReturn.defaultUnit'),
        examplePartner: t('app.kuaizhizao.quotation.importExample.customerName'),
        exampleMaterial: 'MAT001',
        exampleWarehouse: t('app.kuaizhizao.salesReturn.listImport.exampleWarehouse'),
      }),
    [t, i18n.language, salesReturnImportDictBag],
  );

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

  const salesReturnCustomFieldColumns = generateSalesReturnCustomFieldColumns();

  const columns: ProColumns<SalesReturn>[] = useMemo(
    () => alignProColumns<SalesReturn>([
    {
      title: t('app.kuaizhizao.salesReturn.colCustomerReturnCode'),
      key: 'return_code',
      dataIndex: 'return_code',
      ...UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
      fixed: 'left',
      sorter: true,
      fieldProps: { placeholder: t('app.kuaizhizao.salesReturn.colReturnCode') },
      render: (_, record) => (
        <UniTableStackedPrimaryCell
          primary={String(record.customer_name ?? '')}
          secondary={String(record.return_code ?? '')}
        />
      ),
    },
    {
      title: t('app.kuaizhizao.salesReturn.customer'),
      dataIndex: 'customer_id',
      hideInTable: true,
      valueType: 'select',
      fieldProps: {
        showSearch: true,
        filterOption: false,
        placeholder: t('app.kuaizhizao.salesReturn.customer'),
      },
      debounceTime: 300,
      request: async ({ keyWords }) => {
        const res = await searchReferenceDisplay({
          resource: 'master-data:supply-chain:customer',
          hostResource: SALES_RETURN_RESOURCE,
          keyword: typeof keyWords === 'string' ? keyWords.trim() : undefined,
          pageSize: 20,
        });
        return referenceDisplayToIdOptions(res.items);
      },
    },
    {
      title: t('app.kuaizhizao.salesReturn.colWarehouse'),
      key: 'sales_return_warehouse',
      dataIndex: 'warehouse_name',
      width: 140,
      ellipsis: true,
      uniTableKeepWidth: true,
      sorter: true,
      hideInSearch: true,
    },
    {
      title: t('app.kuaizhizao.salesReturn.colRelatedDocs'),
      key: 'sales_return_related_docs',
      dataIndex: 'sales_order_code',
      width: 140,
      uniTableKeepWidth: true,
      ellipsis: true,
      hideInSearch: true,
      render: (_, record) => {
        // 退货来源一般为销售订单或销售出库单二选一，不会同时作为主来源
        const delivery = String(record.sales_delivery_code ?? '').trim();
        const order = String(record.sales_order_code ?? '').trim();
        if (delivery && record.sales_delivery_id) {
          return (
            <LinkedDocumentCode
              documentType="sales_delivery"
              documentId={record.sales_delivery_id}
              code={delivery}
            />
          );
        }
        if (order && record.sales_order_id) {
          return (
            <LinkedDocumentCode
              documentType="sales_order"
              documentId={record.sales_order_id}
              code={order}
            />
          );
        }
        return delivery || order || '-';
      },
    },
    {
      title: t('app.kuaizhizao.salesReturn.colSalesOrderCode'),
      dataIndex: 'sales_order_code',
      hideInTable: true,
      fieldProps: { placeholder: t('app.kuaizhizao.salesReturn.colSalesOrderCode') },
    },
    {
      title: t('app.kuaizhizao.salesReturn.colSalesDeliveryCode'),
      dataIndex: 'sales_delivery_code',
      hideInTable: true,
      fieldProps: { placeholder: t('app.kuaizhizao.salesReturn.colSalesDeliveryCode') },
    },
    {
      title: t('app.kuaizhizao.salesReturn.totalQuantity'),
      dataIndex: 'total_quantity',
      width: 100,
      align: 'right',
      sorter: true,
      hideInSearch: true,
      render: formatQuantity,
    },
    {
      title: t('app.kuaizhizao.salesReturn.totalAmount'),
      dataIndex: 'total_amount',
      width: 120,
      align: 'right',
      sorter: true,
      hideInSearch: true,
      render: (text: any) => `¥${Number(text || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    },
    {
      title: t('app.kuaizhizao.salesReturn.returnTime'),
      dataIndex: 'return_time',
      width: 132,
      uniTableKeepWidth: true,
      sorter: true,
      hideInSearch: true,
      render: (_, record) =>
        record.return_time ? formatDateTime(record.return_time, 'YYYY-MM-DD HH:mm') : '-',
    },
    {
      title: t('app.kuaizhizao.salesReturn.returnTime'),
      dataIndex: 'return_time_range',
      valueType: 'dateRange',
      hideInTable: true,
      fieldProps: {
        placeholder: [t('app.kuaizhizao.quotation.dateRangeStart'), t('app.kuaizhizao.quotation.dateRangeEnd')],
      },
      formItemProps: formDateRangeFormItemProps,
    },
    ...buildDocumentAuditColumns<SalesReturn>(t),
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
    ...(salesReturnAuditColumn ? [salesReturnAuditColumn] : []),
    {
      title: t('app.kuaizhizao.salesReturn.colLifecycle'),
      dataIndex: LIST_LIFECYCLE_STAGE_FIELD,
      fixed: 'right',
      valueType: 'select',
      valueEnum: salesReturnLifecycleValueEnum,
      render: (_, record) => (
        <ListUniLifecycleCell lifecycle={getSalesReturnLifecycle(record as any, t)} />
      ),
    },
    ...salesReturnCustomFieldColumns,
    {
      title: t('common.actions'),
      fixed: 'right',
      hideInSearch: true,
      render: (_, record) => [
        <Button {...rowActionKind('read')} key="detail" onClick={() => handleDetail(record)}>{t('common.detail')}</Button>,
        record.capabilities?.update?.allowed && salesReturnPerms.canUpdate ? (
          <Button {...rowActionKind('update')} key="edit" onClick={() => void handleEdit(record)}>{t('common.edit')}</Button>
        ) : null,
        <UniWorkflowActions {...rowActionKind('skip')}
          key="workflow-actions"
          record={record}
          entityName={t('app.kuaizhizao.salesReturn.entityName')}
          entityType="sales_return"
          auditNodeKey="sales_return"
          unifiedAudit
          resourcePrefix={SALES_RETURN_RESOURCE}
          statusField="status"
          reviewStatusField="review_status"
          draftStatuses={SR_WORKFLOW_DRAFT_STATUSES}
          pendingStatuses={SR_WORKFLOW_PENDING_STATUSES}
          approvedStatuses={SR_WORKFLOW_APPROVED_STATUSES}
          rejectedStatuses={SR_WORKFLOW_REJECTED_STATUSES}
          theme="link"
          size="small"
          onSuccess={() => { void handleSalesReturnAuditSuccess(); }}
          confirmMessages={{
            submit: isManualAuditEnabled(record.audit)
              ? t('app.kuaizhizao.salesReturn.submitConfirmAudit')
              : t('app.kuaizhizao.salesReturn.submitConfirmAuto'),
          }}
        />,
      ].filter(Boolean),
    },
  ], SALES_DOC_LIST_FIELD_RANK),
    [
      t,
      salesReturnCustomFieldColumns,
      salesReturnLifecycleValueEnum,
      salesReturnAuditColumn,
      salesReturnPerms.canUpdate,
    ],
  );

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

  const isPullLineSelectable = useCallback(
    (record: { remaining_quantity?: number }) => Number(record.remaining_quantity ?? 0) > 0,
    [],
  );

  const pullDocumentScopeOptions = useMemo(
    () => [
      { label: t('components.uniPullQuery.scopePullable'), value: 'pullable' },
      { label: t('components.uniPullQuery.scopeAll'), value: 'all' },
    ],
    [t],
  );

  const pullSalesOrderColumns: ProColumns<SalesReturnOrderPullLine>[] = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.salesReturn.salesOrderNo'),
        dataIndex: 'order_code',
        width: 168,
        ellipsis: true,
      },
      {
        title: t('app.kuaizhizao.salesOrder.materialName'),
        dataIndex: 'material_name',
        ellipsis: true,
        render: (_: unknown, record: SalesReturnOrderPullLine) => (
          <MaterialStackedCell
            material_name={record.material_name}
            material_code={record.material_code}
            material_spec={record.material_spec}
          />
        ),
      },
      {
        title: t('app.kuaizhizao.salesOrder.quantity'),
        dataIndex: 'suggested_quantity',
        width: 100,
        align: 'right',
        render: (v) => formatQuantity(v),
      },
      {
        title: t('app.kuaizhizao.salesOrder.colShippedQty'),
        dataIndex: 'pushed_quantity',
        width: 100,
        align: 'right',
        render: (v) => formatQuantity(v),
      },
      {
        title: t('app.kuaizhizao.salesOrder.colShippableQty'),
        dataIndex: 'remaining_quantity',
        width: 100,
        align: 'right',
        render: (v) => formatQuantity(v),
      },
      {
        title: t('app.kuaizhizao.salesReturn.customer'),
        dataIndex: 'customer_name',
        width: 140,
        ellipsis: true,
      },
      {
        title: t('app.kuaizhizao.salesReturn.deliveryDate'),
        dataIndex: 'required_date',
        width: 112,
        render: (v) => (v ? formatBusinessDateOnly(String(v)) : '-'),
      },
      {
        title: t('app.kuaizhizao.salesReturn.pull.gateStatus'),
        key: 'convert_status',
        width: 100,
        align: 'center',
        render: (_: unknown, record: SalesReturnOrderPullLine) =>
          renderPullCapabilityTag(
            Number(record.remaining_quantity ?? 0) > 0,
            t('app.kuaizhizao.salesReturn.pull.canCreate'),
            t('app.kuaizhizao.purchaseRequisition.pull.cannotCreate'),
          ),
      },
    ],
    [t],
  );

  const pullSalesDeliveryColumns: ProColumns<SalesReturnDeliveryPullLine>[] = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.salesReturn.colSalesDeliveryCode'),
        dataIndex: 'delivery_code',
        width: 168,
        ellipsis: true,
      },
      {
        title: t('app.kuaizhizao.salesOrder.materialName'),
        dataIndex: 'material_name',
        ellipsis: true,
        render: (_: unknown, record: SalesReturnDeliveryPullLine) => (
          <MaterialStackedCell
            material_name={record.material_name}
            material_code={record.material_code}
            material_spec={record.material_spec}
          />
        ),
      },
      {
        title: t('app.kuaizhizao.salesOrder.quantity'),
        dataIndex: 'suggested_quantity',
        width: 100,
        align: 'right',
        render: (v) => formatQuantity(v),
      },
      {
        title: t('app.kuaizhizao.salesOrder.colShippedQty'),
        dataIndex: 'pushed_quantity',
        width: 100,
        align: 'right',
        render: (v) => formatQuantity(v),
      },
      {
        title: t('app.kuaizhizao.salesOrder.colShippableQty'),
        dataIndex: 'remaining_quantity',
        width: 100,
        align: 'right',
        render: (v) => formatQuantity(v),
      },
      {
        title: t('app.kuaizhizao.salesReturn.customer'),
        dataIndex: 'customer_name',
        width: 140,
        ellipsis: true,
      },
      {
        title: t('app.kuaizhizao.warehouseOutbound.pull.colOutboundDate'),
        dataIndex: 'required_date',
        width: 112,
        render: (v) => (v ? formatBusinessDateOnly(String(v)) : '-'),
      },
      {
        title: t('app.kuaizhizao.salesReturn.pull.gateStatus'),
        key: 'convert_status',
        width: 100,
        align: 'center',
        render: (_: unknown, record: SalesReturnDeliveryPullLine) =>
          renderPullCapabilityTag(
            Number(record.remaining_quantity ?? 0) > 0,
            t('app.kuaizhizao.salesReturn.pull.canCreate'),
            t('app.kuaizhizao.purchaseRequisition.pull.cannotCreate'),
          ),
      },
    ],
    [t],
  );

  const pullFromSalesOrderQuery = useUniPullQuery<SalesReturnOrderPullLine>({
    rowKey: 'id',
    selectionType: 'checkbox',
    scopeOptions: pullDocumentScopeOptions,
    defaultScope: 'pullable',
    onOpen: () => {
      pullSourceOrderIdRef.current = undefined;
      setPullSourceOrderId(undefined);
      void listSalesOrders({ skip: 0, limit: 100 })
        .then((res) => {
          const rows = Array.isArray((res as { data?: Array<{ id?: number; order_code?: string }> })?.data)
            ? (res as { data: Array<{ id?: number; order_code?: string }> }).data
            : [];
          setPullSourceOrderOptions(
            rows
              .filter((row) => row.id != null && row.order_code)
              .map((row) => ({ value: row.id!, label: String(row.order_code) })),
          );
        })
        .catch((error: unknown) => {
          messageApi.error(getApiErrorMessage(error, t('app.kuaizhizao.salesReturn.pull.loadSourceFailed')));
          setPullSourceOrderOptions([]);
        });
    },
    loadData: async ({ keyword, page, pageSize, scope }) => {
      try {
        const listRes = await warehouseApi.salesReturn.listSalesOrderPullLines({
          skip: (page - 1) * pageSize,
          limit: pageSize,
          keyword: keyword.trim() || undefined,
          sales_order_id: pullSourceOrderIdRef.current,
          pullable_only: isPullableScope(scope),
        });
        return { data: listRes?.data ?? [], total: listRes?.total ?? 0 };
      } catch (error: unknown) {
        messageApi.error(getApiErrorMessage(error, t('app.kuaizhizao.salesReturn.loadSalesOrdersFailed')));
        return { data: [], total: 0 };
      }
    },
    isRowDisabled: (record) => !isPullLineSelectable(record),
    onConfirm: async (_keys, rows) => {
      const selectedIds = rows
        .filter((row) => isPullLineSelectable(row))
        .map((row) => Number(row.id))
        .filter((id) => id > 0);
      if (!selectedIds.length) {
        messageApi.warning(t('app.kuaizhizao.salesReturn.pull.selectLinesFirst'));
        return;
      }
      try {
        const res = await warehouseApi.salesReturn.pullFromSalesOrderItems(selectedIds);
        messageApi.success(res.message || t('app.kuaizhizao.salesReturn.pullSuccess'));
        pullFromSalesOrderQuery.closeModal();
        invalidateMenuBadgeCounts();
        actionRef.current?.reload();
      } catch (error: unknown) {
        messageApi.error(getApiErrorMessage(error, t('app.kuaizhizao.salesReturn.pullFailed')));
      }
    },
  });

  const pullFromSalesDeliveryQuery = useUniPullQuery<SalesReturnDeliveryPullLine>({
    rowKey: 'id',
    selectionType: 'checkbox',
    scopeOptions: pullDocumentScopeOptions,
    defaultScope: 'pullable',
    onOpen: () => {
      pullSourceDeliveryIdRef.current = undefined;
      setPullSourceDeliveryId(undefined);
      void warehouseApi.salesDelivery.list({ skip: 0, limit: 100 })
        .then((res: { items?: Array<{ id?: number; delivery_code?: string }>; data?: Array<{ id?: number; delivery_code?: string }> }) => {
          const rows = res?.items ?? res?.data ?? [];
          setPullSourceDeliveryOptions(
            rows
              .filter((row) => row.id != null && row.delivery_code)
              .map((row) => ({ value: row.id!, label: String(row.delivery_code) })),
          );
        })
        .catch((error: unknown) => {
          messageApi.error(getApiErrorMessage(error, t('app.kuaizhizao.salesReturn.pull.loadSourceFailed')));
          setPullSourceDeliveryOptions([]);
        });
    },
    loadData: async ({ keyword, page, pageSize, scope }) => {
      try {
        const listRes = await warehouseApi.salesReturn.listSalesDeliveryPullLines({
          skip: (page - 1) * pageSize,
          limit: pageSize,
          keyword: keyword.trim() || undefined,
          sales_delivery_id: pullSourceDeliveryIdRef.current,
          pullable_only: isPullableScope(scope),
        });
        return { data: listRes?.data ?? [], total: listRes?.total ?? 0 };
      } catch (error: unknown) {
        messageApi.error(getApiErrorMessage(error, t('app.kuaizhizao.salesReturn.loadSalesDeliveriesFailed')));
        return { data: [], total: 0 };
      }
    },
    isRowDisabled: (record) => !isPullLineSelectable(record),
    onConfirm: async (_keys, rows) => {
      const selectedIds = rows
        .filter((row) => isPullLineSelectable(row))
        .map((row) => Number(row.id))
        .filter((id) => id > 0);
      if (!selectedIds.length) {
        messageApi.warning(t('app.kuaizhizao.salesReturn.pull.selectLinesFirst'));
        return;
      }
      try {
        const res = await warehouseApi.salesReturn.pullFromSalesDeliveryItems(selectedIds);
        messageApi.success(res.message || t('app.kuaizhizao.salesReturn.pullSuccess'));
        pullFromSalesDeliveryQuery.closeModal();
        invalidateMenuBadgeCounts();
        actionRef.current?.reload();
      } catch (error: unknown) {
        messageApi.error(getApiErrorMessage(error, t('app.kuaizhizao.salesReturn.pullFailed')));
      }
    },
  });

  const openPullFromSalesOrder = () => {
    pullFromSalesOrderQuery.openModal();
  };

  const openPullFromSalesDelivery = () => {
    pullFromSalesDeliveryQuery.openModal();
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

  const handleListImport = async (data: any[][]) => {
    if (!data || data.length < 2) {
      messageApi.warning(t('app.kuaizhizao.quotation.importDataInvalid'));
      return;
    }
    const rows = (data.slice(2) as any[][]).filter((row) =>
      row?.some((c) => c != null && String(c).trim() !== ''),
    );
    if (rows.length === 0) {
      messageApi.warning(t('app.kuaizhizao.quotation.noImportRows'));
      return;
    }

    try {
      const [materialsRes, warehousesRes] = await Promise.all([
        materialApi.list({ limit: 1000, isActive: true }),
        masterWarehouseApi.list({ limit: 1000, is_active: true }),
      ]);
      const materials = materialsRes?.items ?? [];
      const warehouses = (warehousesRes as any)?.items ?? (Array.isArray(warehousesRes) ? warehousesRes : []);

      const { errors, items: toImport } = parseDocumentReturnListImport(data, {
        t,
        importHeaderMap: salesReturnListImportTemplate.importHeaderMap,
        partnerField: 'customer',
        partners: customerList,
        warehouses,
        materials,
        defaultUnit: t('app.kuaizhizao.salesReturn.defaultUnit'),
        defaultReturnType: 'OTHER',
        parseDict: salesReturnImportDictBag.parseDict,
      });

      if (errors.length > 0) {
        getAntdModal().warning({
          title: t('app.kuaizhizao.quotation.validationFailed'),
          width: 600,
          content: (
            <div>
              <p>{t('app.master-data.validationFailedIntro')}</p>
              <List
                size="small"
                dataSource={errors}
                renderItem={(item) => (
                  <List.Item>
                    <Typography.Text type="danger">
                      {t('app.kuaizhizao.quotation.importRowError', {
                        row: item.row,
                        message: item.message,
                      })}
                    </Typography.Text>
                  </List.Item>
                )}
              />
            </div>
          ),
        });
        return;
      }

      if (toImport.length === 0) {
        messageApi.warning(t('app.kuaizhizao.quotation.noImportData'));
        return;
      }

      const result = await importInChunksViaPerItemCreate({
        items: toImport,
        createOne: async (item, _index) =>
          warehouseApi.salesReturn.create({
            return_code: item.return_code,
            customer_id: item.partner_id,
            customer_name: item.partner_name,
            warehouse_id: item.warehouse_id,
            warehouse_name: item.warehouse_name,
            return_time: item.return_time,
            return_reason: item.return_reason,
            return_type: item.return_type,
            shipping_method: item.shipping_method,
            notes: item.notes,
            items: item.items,
          }),
        title: t('app.kuaizhizao.salesReturn.listImport.importing'),
        chunkSize: 100,
        concurrency: 4,
      });

      if (result.failureCount > 0) {
        getAntdModal().warning({
          title: t('app.kuaizhizao.quotation.importPartialTitle'),
          width: 600,
          content: (
            <div>
              <p>
                <strong>
                  {t('app.kuaizhizao.quotation.importResult', {
                    success: result.successCount,
                    failed: result.failureCount,
                  })}
                </strong>
              </p>
              {result.errors.length > 0 && (
                <List
                  size="small"
                  dataSource={result.errors}
                  renderItem={(e) => (
                    <List.Item>
                      <Typography.Text type="danger">
                        {t('app.kuaizhizao.quotation.importRowError', {
                          row: e.row,
                          message: e.error,
                        })}
                      </Typography.Text>
                    </List.Item>
                  )}
                />
              )}
            </div>
          ),
        });
      } else {
        messageApi.success(
          t('app.kuaizhizao.quotation.importSuccess', { count: result.successCount }),
        );
      }
      if (result.successCount > 0) {
        invalidateMenuBadgeCounts();
        actionRef.current?.reload();
      }
    } catch (error: any) {
      messageApi.error(error?.message || t('common.importFailed'));
    }
  };

  // Excel导入处理
  const handleImport = (data: any[]) => {
    const materialCodeKeys = [
      t('app.kuaizhizao.salesReturn.import.materialCode'),
      t('app.kuaizhizao.salesOrder.materialCode'),
      '产品编号',
    ];
    const unitKeys = [
      t('app.kuaizhizao.salesReturn.import.unit'),
      t('app.kuaizhizao.salesOrder.unit'),
      '单位',
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
      material_unit:
        getImportRowValue(row, unitKeys) || t('app.kuaizhizao.salesReturn.defaultUnit'),
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

  const detailBasicColumns = useMemo<ProDescriptionsItemProps<SalesReturnDetail>[]>(
    () =>
      alignDescriptionColumns([
      {
        title: t('app.kuaizhizao.salesReturn.colReturnCode'),
        dataIndex: 'return_code',
        render: (_, record) =>
          record.return_code ? (
            <Typography.Text copyable={{ text: record.return_code }}>{record.return_code}</Typography.Text>
          ) : (
            '-'
          ),
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
        render: (_, record) => formatQuantity(record.total_quantity),
      },
      {
        title: t('app.kuaizhizao.salesReturn.totalAmount'),
        dataIndex: 'total_amount',
        render: (_, record) => `¥${Number(record.total_amount ?? 0).toLocaleString()}`,
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
      {
        title: t('app.kuaizhizao.common.fieldNotes'),
        dataIndex: 'notes',
        span: 3,
      },
    ] as ProDescriptionsItemProps<SalesReturnDetail>[]),
    [t],
  );

  const detailCollaboration = useMemo(() => {
    if (!returnDetail) return undefined;
    const lifecycle = getSalesReturnLifecycle(returnDetail as any, t);
    const mainStages = lifecycle.mainStages ?? [];
    if (!mainStages.length) return undefined;
    return (
      <UniLifecycleStepper
        steps={mainStages}
        status={lifecycle.status}
        showLabels
        nextStepSuggestions={lifecycle.nextStepSuggestions}
        hideNextStepSuggestions
      />
    );
  }, [returnDetail, t]);

  const detailTableColumns: ProColumns<SalesReturnItemRow>[] = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.salesReturn.colCustomerReturnCode'),
        key: 'return_code',
        dataIndex: 'return_code',
        ...UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
        fixed: 'left',
        hideInSearch: false,
        fieldProps: { placeholder: t('app.kuaizhizao.salesReturn.colReturnCode') },
        render: (_, record) => (
          <UniTableStackedPrimaryCell
            primary={String(record.customer_name ?? '')}
            secondary={String(record.return_code ?? '')}
          />
        ),
      },
      {
        title: t('app.kuaizhizao.salesReturn.colReturnCode'),
        dataIndex: 'return_code',
        hideInTable: true,
      },
      {
        title: t('app.kuaizhizao.salesReturn.customer'),
        dataIndex: 'customer_id',
        hideInTable: true,
        valueType: 'select',
        fieldProps: {
          showSearch: true,
          filterOption: false,
          placeholder: t('app.kuaizhizao.salesReturn.customer'),
        },
        debounceTime: 300,
        request: async ({ keyWords }) => {
          const res = await searchReferenceDisplay({
            resource: 'master-data:supply-chain:customer',
            hostResource: SALES_RETURN_RESOURCE,
            keyword: typeof keyWords === 'string' ? keyWords.trim() : undefined,
            pageSize: 20,
          });
          return referenceDisplayToIdOptions(res.items);
        },
      },
      {
        title: t('app.kuaizhizao.salesOrder.materialName'),
        key: 'material_display',
        dataIndex: 'material_name',
        ...UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
        hideInSearch: true,
        render: (_, record) => (
          <MaterialStackedCell
            material_name={record.material_name}
            material_code={record.material_code}
            material_spec={record.material_spec}
          />
        ),
      },
      {
        title: t('app.kuaizhizao.salesOrder.materialCode'),
        dataIndex: 'material_code',
        hideInTable: true,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.salesReturn.returnQuantity'),
        dataIndex: 'return_quantity',
        width: 100,
        align: 'right',
        hideInSearch: true,
        render: (val: unknown, record) => (
          <QuantityWithUnitDisplay quantity={val} unit={record.material_unit} />
        ),
      },
      {
        title: t('app.kuaizhizao.salesReturn.unitPrice'),
        dataIndex: 'unit_price',
        width: 100,
        align: 'right',
        hideInSearch: true,
        render: (text: unknown) =>
          `¥${Number(text || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      },
      {
        title: t('app.kuaizhizao.salesReturn.totalAmount'),
        dataIndex: 'total_amount',
        width: 120,
        align: 'right',
        hideInSearch: true,
        render: (text: unknown) =>
          `¥${Number(text || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      },
      {
        title: t('app.kuaizhizao.salesReturn.batchNumber'),
        dataIndex: 'batch_number',
        width: 120,
        hideInSearch: true,
        ellipsis: true,
      },
      {
        title: t('app.kuaizhizao.salesReturn.location'),
        dataIndex: 'location_code',
        width: 100,
        hideInSearch: true,
        ellipsis: true,
      },
      {
        title: t('app.kuaizhizao.salesReturn.colWarehouse'),
        dataIndex: 'warehouse_name',
        width: 140,
        ellipsis: true,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.salesReturn.returnTime'),
        dataIndex: 'return_time',
        width: 132,
        uniTableKeepWidth: true,
        hideInSearch: true,
        render: (_, record) =>
          record.return_time ? formatDateTime(record.return_time, 'YYYY-MM-DD HH:mm') : '-',
      },
      {
        title: t('app.kuaizhizao.salesReturn.colLifecycle'),
        dataIndex: LIST_LIFECYCLE_STAGE_FIELD,
        fixed: 'right',
        hideInSearch: false,
        valueType: 'select',
        valueEnum: salesReturnLifecycleValueEnum,
        render: (_, record) => (
          <ListUniLifecycleCell lifecycle={getSalesReturnLifecycle(record as SalesReturn, t)} />
        ),
      },
    ],
    [salesReturnLifecycleValueEnum, t],
  );

  const salesReturnTraceDocument = useMemo(() => {
    if (returnDetail?.id == null) return null;
    return {
      documentType: 'sales_return',
      documentId: returnDetail.id,
      selfDocumentId: returnDetail.id,
      renderBriefActions: (doc: Parameters<typeof WarehouseTraceBriefPrimaryActions>[0]['doc']) => (
        <WarehouseTraceBriefPrimaryActions
          doc={doc}
          t={t}
          navigate={navigate}
          closeDrawer={() => {
            setDetailDrawerVisible(false);
            setReturnDetail(null);
          }}
        />
      ),
    };
  }, [navigate, returnDetail?.id, t]);

  const timeconfigBasicItems = useDetailDrawerDescriptionItems(
    detailBasicColumns.filter((col) => {
                    if (col.dataIndex !== 'notes') return true;
                    return String(returnDetail?.notes ?? '').trim().length > 0;
                  }),
                  returnDetail,
    'sales_return',
  );

  return (
    <>
      <ListPageTemplate>
        <UniTable
          columnPersistenceId={SALES_RETURN_LIST_PERSISTENCE_ID}
          headerTitle={t('app.kuaizhizao.salesReturn.title')}
          actionRef={actionRef}
          viewTypes={['table', 'detailTable', 'help']}
          defaultViewType={viewTypeState === 'help' ? 'table' : viewTypeState}
          onViewTypeChange={(v) => {
            dataViewModeRef.current = resolveDetailTableViewMode(v as 'table' | 'detailTable' | 'help');
            setViewTypeState(v as 'table' | 'detailTable' | 'help');
            setSelectedRowKeys([]);
            setTimeout(() => actionRef.current?.reload(), 0);
          }}
          detailTableColumns={detailTableColumns}
          helpViewConfig={{
            content: (
              <div style={{ lineHeight: 1.8 }}>
                <p>
                  <strong>{t('components.uniTable.viewTable')}</strong>
                  {t('app.kuaizhizao.salesReturn.title')}
                </p>
                <p>
                  <strong>{t('components.uniTable.viewDetailTable')}</strong>
                  {t('app.kuaizhizao.salesReturn.title')}
                </p>
              </div>
            ),
          }}
          rowKey={dataViewMode === 'detail' ? '_rowKey' : 'id'}
          columns={columns}
          onTableDataChange={(rows) => {
            if (dataViewModeRef.current === 'order') {
              tableRowsRef.current = rows as SalesReturn[];
            }
          }}
          selectedRowKeys={selectedRowKeys}
          onRowSelectionChange={setSelectedRowKeys}
          showAdvancedSearch={true}
          skipFuzzyPinyinClientFilter
          pinnedTabsField={LIST_LIFECYCLE_STAGE_FIELD}
          pinnedTabsValueEnum={salesReturnLifecycleValueEnum}
          showCreateButton={false}
          createButtonText={t('app.kuaizhizao.salesReturn.create')}
          onCreate={handleCreate}
          showImportButton={salesReturnPerms.canCreate}
          onImport={handleListImport}
          importHeaders={salesReturnListImportTemplate.importHeaders}
          importExampleRow={salesReturnListImportTemplate.importExampleRow}
          importColumnOptions={salesReturnListImportTemplate.importColumnOptions}
          importFieldMap={salesReturnListImportTemplate.importHeaderMap}
          toolBarRender={() => [
            <UniPullCreateToolbar
              compactKey="create-sales-return-with-pull"
              createIcon={<PlusOutlined />}
              createLabel={t('app.kuaizhizao.salesReturn.create')}
              onCreate={handleCreate}
              menuItems={buildKuaizhizaoPullCreateMenuItems(t, [
                {
                  key: 'pull-from-sales-delivery',
                  actionKey: 'sales_return.pull_from_sales_delivery',
                  onClick: openPullFromSalesDelivery,
                },
                {
                  key: 'pull-from-sales-order',
                  actionKey: 'sales_return.pull_from_sales_order',
                  onClick: openPullFromSalesOrder,
                },
              ])}
            />,
          ]}
          request={async (params, sort, _filter, searchFormValues, meta?: UniTableRequestMeta) => {
            try {
              const sf = searchFormValues ?? {};
              const lifecycleParams = resolveSalesReturnListLifecycleParams(sf, params);
              const { sortBy, sortOrder } = extractProTableSort(sort);
              const orderBy =
                sortBy && sortOrder ? (sortOrder === 'desc' ? `-${sortBy}` : sortBy) : undefined;
              const fuzzyKeyword =
                typeof sf.keyword === 'string' ? sf.keyword.trim() : '';
              const returnCode = sf.return_code != null ? String(sf.return_code).trim() : '';
              const apiParams: SalesReturnListParams = {
                skip: ((params.current || 1) - 1) * (params.pageSize || 20),
                limit: params.pageSize || 20,
                ...lifecycleParams,
                order_by: orderBy,
                include_items: dataViewModeRef.current === 'detail',
              };
              if (fuzzyKeyword) {
                apiParams.keyword = fuzzyKeyword;
              } else if (returnCode) {
                apiParams.return_code = returnCode;
              }
              if (sf.customer_id != null && sf.customer_id !== '') {
                apiParams.customer_id = Number(sf.customer_id);
              }
              const deliveryCode =
                sf.sales_delivery_code != null ? String(sf.sales_delivery_code).trim() : '';
              if (deliveryCode) apiParams.sales_delivery_code = deliveryCode;
              const orderCode =
                sf.sales_order_code != null ? String(sf.sales_order_code).trim() : '';
              if (orderCode) apiParams.sales_order_code = orderCode;
              const returnRange = sf.return_time_range as [unknown, unknown] | undefined;
              if (returnRange && Array.isArray(returnRange) && returnRange[0]) {
                apiParams.return_start_date = formatDateTime(returnRange[0] as string | Date, 'YYYY-MM-DD');
                apiParams.return_end_date = returnRange[1]
                  ? formatDateTime(returnRange[1] as string | Date, 'YYYY-MM-DD')
                  : apiParams.return_start_date;
              }
              const createdRange = sf.created_at_range as [unknown, unknown] | undefined;
              if (createdRange && Array.isArray(createdRange) && createdRange[0]) {
                apiParams.created_start_date = formatDateTime(createdRange[0] as string | Date, 'YYYY-MM-DD');
                apiParams.created_end_date = createdRange[1]
                  ? formatDateTime(createdRange[1] as string | Date, 'YYYY-MM-DD')
                  : apiParams.created_start_date;
              }
              const response = await warehouseApi.salesReturn.list(apiParams);
              const list = response?.data ?? [];
              const enriched = meta?.purpose === 'prefetch'
                ? list
                : await enrichSalesReturnRecordsWithCustomFields(list);
              // 行缓存唯一真源：onTableDataChange（prefetch 会走本 request，禁止在此覆盖）
              if (dataViewModeRef.current === 'order') {
                return {
                  data: enriched,
                  success: true,
                  total: response?.total ?? enriched.length,
                };
              }
              const flatRows = flattenDocumentDetailRows<SalesReturn, SalesReturnItem>({
                headers: enriched,
                getHeaderId: (h) => h.id,
                getItems: (h) => h.items,
                buildRowKey: (h, item, index) =>
                  item?.id
                    ? `return-${h.id}-item-${item.id}`
                    : `return-${h.id}-idx-${index}`,
                mapItemRow: (h, item) => ({
                  ...item,
                  return_id: h.id ?? 0,
                  return_code: h.return_code,
                  customer_name: h.customer_name,
                  sales_delivery_code: h.sales_delivery_code,
                  sales_order_code: h.sales_order_code,
                  warehouse_name: h.warehouse_name,
                  return_time: h.return_time,
                  status: h.status,
                  review_status: h.review_status,
                  lifecycle: h.lifecycle,
                  capabilities: h.capabilities,
                  audit: h.audit,
                }),
                mapEmptyHeaderRow: (h) => ({
                  return_id: h.id ?? 0,
                  return_code: h.return_code,
                  customer_name: h.customer_name,
                  sales_delivery_code: h.sales_delivery_code,
                  sales_order_code: h.sales_order_code,
                  warehouse_name: h.warehouse_name,
                  return_time: h.return_time,
                  status: h.status,
                  review_status: h.review_status,
                  lifecycle: h.lifecycle,
                  capabilities: h.capabilities,
                  audit: h.audit,
                  material_code: '-',
                  material_name: '-',
                  return_quantity: 0,
                  unit_price: 0,
                  total_amount: 0,
                }),
              }) as SalesReturnItemRow[];
              return {
                data: flatRows,
                success: true,
                total: response?.total ?? enriched.length,
              };
            } catch {
              messageApi.error(t('app.kuaizhizao.salesReturn.listFailed'));
              return {
                data: [],
                success: false,
                total: 0,
              };
            }
          }}
          enableRowSelection={viewTypeState !== 'detailTable'}
          showDeleteButton={viewTypeState !== 'detailTable'}
          onDelete={handleDelete}
          deleteConfirmTitle={(count) => t('app.kuaizhizao.salesReturn.confirmBatchDelete', { count })}
          toolBarActionsAfterDelete={[
            <UniAuditBatchMenuButton
              key="sales-return-batch-menu"
              selectedRowKeys={selectedRowKeys}
              selectedRecords={selectedReturnsForBatch}
              auditEnabled={salesReturnAuditEnabled}
              permGates={salesReturnPerms}
              handlers={salesReturnAuditBatchHandlers}
              onSuccess={() => {
                setSelectedRowKeys([]);
                void handleSalesReturnAuditSuccess();
              }}
              toolBarButtonSize="middle"
            />,
          ]}
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
              request={async ({ keyWords }) => {
                const res = await searchReferenceDisplay({
                  resource: 'master-data:supply-chain:customer',
                  hostResource: SALES_RETURN_RESOURCE,
                  keyword: typeof keyWords === 'string' ? keyWords.trim() : undefined,
                  pageSize: 20,
                });
                return referenceDisplayToIdOptions(res.items);
              }}
              debounceTime={300}
              fieldProps={{
                showSearch: true,
                filterOption: false,
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
                        skipFuzzyPinyinClientFilter
                        />
                      ),
                    },
                    {
                      title: t('app.kuaizhizao.salesReturn.batchNumber'),
                      dataIndex: 'batch_number',
                      width: 200,
                      ...DOCUMENT_DETAIL_TEXT_COL,
                      render: (_: unknown, __: unknown, index: number) => (
                        <AntForm.Item
                          noStyle
                          shouldUpdate={(prev, cur) =>
                            prev?.customer_id !== cur?.customer_id ||
                            prev?.items?.[index]?.material_id !== cur?.items?.[index]?.material_id
                          }
                        >
                          {() => {
                            const customerId = formRef.current?.getFieldValue('customer_id');
                            const materialId = formRef.current?.getFieldValue(['items', index, 'material_id']);
                            const deliveryItemId = formRef.current?.getFieldValue([
                              'items',
                              index,
                              'sales_delivery_item_id',
                            ]);
                            return (
                              <>
                                <AntForm.Item name={[index, 'batch_number']} noStyle>
                                  <SalesReturnOutboundBatchSelect
                                    customerId={customerId}
                                    materialId={materialId}
                                    deliveryItemId={deliveryItemId}
                                    size={DOCUMENT_DETAIL_CONTROL_SIZE}
                                    onPick={(picked) => {
                                      const items = [...(formRef.current?.getFieldValue('items') ?? [])];
                                      const row = { ...(items[index] || {}) };
                                      row.batch_number = picked?.batch_number
                                        ? String(picked.batch_number)
                                        : undefined;
                                      row.sales_delivery_item_id = picked?.sales_delivery_item_id;
                                      items[index] = row;
                                      formRef.current?.setFieldsValue({ items });
                                    }}
                                  />
                                </AntForm.Item>
                                <AntForm.Item name={[index, 'sales_delivery_item_id']} hidden>
                                  <Input />
                                </AntForm.Item>
                              </>
                            );
                          }}
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

      <UniPullQueryModal<SalesReturnOrderPullLine>
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
        selectedRows={pullFromSalesOrderQuery.selectedRows}
        onSelectedRowKeysChange={pullFromSalesOrderQuery.handleSelectedRowKeysChange}
        searchDraft={pullFromSalesOrderQuery.searchDraft}
        onSearchDraftChange={pullFromSalesOrderQuery.setSearchDraft}
        onSearchApply={pullFromSalesOrderQuery.handleSearchApply}
        onSearchClear={pullFromSalesOrderQuery.handleSearchClear}
        appliedKeyword={pullFromSalesOrderQuery.appliedKeyword}
        searchPlaceholder={t('app.kuaizhizao.salesReturn.pull.searchPlaceholder')}
        filterExtra={(
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder={t('app.kuaizhizao.salesReturn.pull.sourceDocPlaceholder')}
            style={{ width: 220, flexShrink: 0 }}
            value={pullSourceOrderId}
            options={pullSourceOrderOptions}
            onChange={(value) => {
              const nextId = Number(value);
              const next = Number.isFinite(nextId) && nextId > 0 ? nextId : undefined;
              pullSourceOrderIdRef.current = next;
              setPullSourceOrderId(next);
              pullFromSalesOrderQuery.handleSelectedRowKeysChange([], []);
              pullFromSalesOrderQuery.handleSearchApply(pullFromSalesOrderQuery.appliedKeyword);
            }}
          />
        )}
        getRowLabel={(row) =>
          [row.order_code, row.material_code].filter(Boolean).join(' ')
        }
        page={pullFromSalesOrderQuery.page}
        pageSize={pullFromSalesOrderQuery.pageSize}
        total={pullFromSalesOrderQuery.total}
        onPageChange={pullFromSalesOrderQuery.handlePageChange}
        isRowDisabled={pullFromSalesOrderQuery.isRowDisabled}
        scopeOptions={pullFromSalesOrderQuery.scopeOptions}
        scope={pullFromSalesOrderQuery.scope}
        onScopeChange={pullFromSalesOrderQuery.handleScopeChange}
        okText={t('app.kuaizhizao.salesReturn.pull.ok')}
      />

      <UniPullQueryModal<SalesReturnDeliveryPullLine>
        open={pullFromSalesDeliveryQuery.open}
        title={pullFromSalesDeliveryAction.label}
        onCancel={pullFromSalesDeliveryQuery.closeModal}
        onOk={pullFromSalesDeliveryQuery.handleConfirm}
        rowKey="id"
        columns={pullSalesDeliveryColumns}
        dataSource={pullFromSalesDeliveryQuery.dataSource}
        loading={pullFromSalesDeliveryQuery.loading}
        confirmLoading={pullFromSalesDeliveryQuery.confirmLoading}
        selectionType={pullFromSalesDeliveryQuery.selectionType}
        selectedRowKeys={pullFromSalesDeliveryQuery.selectedRowKeys}
        selectedRows={pullFromSalesDeliveryQuery.selectedRows}
        onSelectedRowKeysChange={pullFromSalesDeliveryQuery.handleSelectedRowKeysChange}
        searchDraft={pullFromSalesDeliveryQuery.searchDraft}
        onSearchDraftChange={pullFromSalesDeliveryQuery.setSearchDraft}
        onSearchApply={pullFromSalesDeliveryQuery.handleSearchApply}
        onSearchClear={pullFromSalesDeliveryQuery.handleSearchClear}
        appliedKeyword={pullFromSalesDeliveryQuery.appliedKeyword}
        searchPlaceholder={t('app.kuaizhizao.salesReturn.pull.searchPlaceholder')}
        filterExtra={(
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder={t('app.kuaizhizao.salesReturn.pull.sourceDocPlaceholder')}
            style={{ width: 220, flexShrink: 0 }}
            value={pullSourceDeliveryId}
            options={pullSourceDeliveryOptions}
            onChange={(value) => {
              const nextId = Number(value);
              const next = Number.isFinite(nextId) && nextId > 0 ? nextId : undefined;
              pullSourceDeliveryIdRef.current = next;
              setPullSourceDeliveryId(next);
              pullFromSalesDeliveryQuery.handleSelectedRowKeysChange([], []);
              pullFromSalesDeliveryQuery.handleSearchApply(pullFromSalesDeliveryQuery.appliedKeyword);
            }}
          />
        )}
        getRowLabel={(row) =>
          [row.delivery_code, row.material_code].filter(Boolean).join(' ')
        }
        page={pullFromSalesDeliveryQuery.page}
        pageSize={pullFromSalesDeliveryQuery.pageSize}
        total={pullFromSalesDeliveryQuery.total}
        onPageChange={pullFromSalesDeliveryQuery.handlePageChange}
        isRowDisabled={pullFromSalesDeliveryQuery.isRowDisabled}
        scopeOptions={pullFromSalesDeliveryQuery.scopeOptions}
        scope={pullFromSalesDeliveryQuery.scope}
        onScopeChange={pullFromSalesDeliveryQuery.handleScopeChange}
        okText={t('app.kuaizhizao.salesReturn.pull.ok')}
      />


      <Suspense fallback={null}>
        <LazyUniImport
          visible={importModalVisible}
          onCancel={() => setImportModalVisible(false)}
          onConfirm={handleImport}
          title={t('app.kuaizhizao.salesReturn.importTitle')}
          headers={[
            t('app.kuaizhizao.salesReturn.import.materialCode'),
            t('app.kuaizhizao.salesReturn.import.unit'),
            t('app.kuaizhizao.salesReturn.import.returnQuantity'),
            t('app.kuaizhizao.salesReturn.import.unitPrice'),
            t('app.kuaizhizao.salesReturn.import.batchNumber'),
            t('app.kuaizhizao.salesReturn.import.location'),
            t('app.kuaizhizao.salesReturn.import.notes'),
          ]}
          exampleRow={[
            'MAT001',
            pickImportExampleValue(
              salesReturnLineUnitOptions,
              t('app.kuaizhizao.salesReturn.defaultUnit'),
            ),
            '10',
            '99.5',
            'B20260117001',
            'A01-01-01',
            t('app.kuaizhizao.salesReturn.import.notesExample'),
          ]}
          columnOptions={salesReturnLineImportColumnOptions}
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
        extra={
          returnDetail?.id != null ? (
            <Space size="small">
              <UniWorkflowActions {...rowActionKind('skip')}
                record={returnDetail}
                entityName={t('app.kuaizhizao.salesReturn.entityName')}
                entityType="sales_return"
                auditNodeKey="sales_return"
                unifiedAudit
                resourcePrefix={SALES_RETURN_RESOURCE}
                statusField="status"
                reviewStatusField="review_status"
                draftStatuses={SR_WORKFLOW_DRAFT_STATUSES}
                pendingStatuses={SR_WORKFLOW_PENDING_STATUSES}
                approvedStatuses={SR_WORKFLOW_APPROVED_STATUSES}
                rejectedStatuses={SR_WORKFLOW_REJECTED_STATUSES}
                onSuccess={() => { void handleSalesReturnAuditSuccess(); }}
                confirmMessages={{
                  submit: isManualAuditEnabled(returnDetail.audit)
                    ? t('app.kuaizhizao.salesReturn.submitConfirmAudit')
                    : t('app.kuaizhizao.salesReturn.submitConfirmAuto'),
                }}
              />
              {!(
                returnDetail.capabilities?.print?.allowed === false ||
                !salesReturnPerms.canPrint
              ) ? (
                <Button
                  icon={<PrinterOutlined />}
                  onClick={() => openPrint({ documentType: 'sales_return', documentId: returnDetail.id! })}
                >
                  {t('components.uniAction.print')}
                </Button>
              ) : null}
            </Space>
          ) : null
        }
        basic={
          returnDetail ? (
            <>
              <Descriptions
                column={3}
                size="small"
                items={timeconfigBasicItems}
              />
              {hasCustomFieldsDetailContent(salesReturnListCustomFields, salesReturnDetailCustomFieldValues) ? (
                <div style={{ marginTop: 16 }}>
                  <CustomFieldsDetailSection
                    customFields={salesReturnListCustomFields}
                    customFieldValues={salesReturnDetailCustomFieldValues}
                  />
                </div>
              ) : null}
            </>
          ) : undefined
        }
        collaboration={detailCollaboration}
        collaborationTitle={t('app.kuaizhizao.salesOrder.lifecycle')}
        collaborationAuditRecord={returnDetail}
        traceDocument={salesReturnTraceDocument}
        linesTitle={t('app.kuaizhizao.salesReturn.itemsInfo')}
        lines={
          returnDetail ? (
            <>
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
                      { title: t('app.kuaizhizao.salesReturn.returnQuantity'), dataIndex: 'return_quantity', width: 100, align: 'right', render: formatQuantity },
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
            </>
          ) : undefined
        }
        timelineTitle={t('app.kuaizhizao.salesReturn.operationHistory')}
        timeline={
          returnDetail ? (
            <>
              {salesReturnTracking.loading && <Spin />}
              {salesReturnTracking.error && <Typography.Text type="danger">{salesReturnTracking.error}</Typography.Text>}
              {salesReturnTracking.data && <DocumentTrackingTimelineBody data={salesReturnTracking.data} />}
            </>
          ) : undefined
        }
      />
      {PrintModal}
    </>
  );
};

export default SalesReturnsPage;
