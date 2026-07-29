import { renderRowActionsOverflow, rowActionKind } from '../../../../../components/uni-action';
/**
 * 工单委外管理页面
 *
 * 提供工单委外的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 * 发料/收货统一经仓储下推预览后进入录入页。
 *
 * 根据功能点2.1.10：工单委外管理（核心功能，新增）
 *
 * Author: Auto (AI Assistant)
 * Date: 2026-01-16
 * Updated: 2026-01-20（重命名为工单委外）
 */

import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { useInvalidateMenuBadgeCounts } from '../../../../../hooks/useInvalidateMenuBadgeCounts';
import type { DescriptionsProps } from 'antd';
import { useNavigate } from 'react-router-dom';
import { inboundOutsourceEntryPath } from '../../warehouse-management/inbound/inboundPaths';
import { outboundOutsourceEntryPath } from '../../warehouse-management/outbound/outboundPaths';
import {
  ActionType,
  ProColumns,
  ProDescriptionsItemProps,
  ProFormText,
  ProFormSelect,
  ProFormDatePicker,
  ProFormDigit,
  ProFormTextArea,
} from '@ant-design/pro-components';
import {
  App,
  Alert,
  Button,
  Col,
  Form,
  Tag,
  Modal,
  Descriptions,
  Typography,
  Dropdown,
  Empty,
  Spin,
  Space,
  Table,
  Input,
  theme as AntdTheme,
} from 'antd';
import { EditOutlined, EyeOutlined, SendOutlined, StopOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import {
  MaterialStackedCell,
  UniTableStackedPrimaryCell,
  UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
} from '../../../../../components/uni-table/stackedPrimaryColumn';
import CodeField from '../../../../../components/code-field';
import { getDataDictionaryByCode, getDictionaryItemList, type DictionaryItem } from '../../../../../services/dataDictionary';
import { mapSystemDictionaryItemOptions } from '../../../../../utils/systemDictionaryI18n';
import { buildFutureDateShortcutFieldProps } from '../../../../../utils/futureDatePickerShortcuts';
import {
  ListPageTemplate,
  FormModalTemplate,
  DetailDrawerTemplate,
  DetailDrawerSection, DetailDrawerInlineFullChain,
  MODAL_CONFIG,
  DRAWER_CONFIG,
  type StatCard,
} from '../../../../../components/layout-templates';
import { SimpleSparkline } from '../../../../../components';
import { outsourceWorkOrderApi } from '../../../services/production';
import { outsourceMaterialIssueApi, outsourceMaterialReceiptApi } from '../../../services/production';
import { getOutsourceWorkOrderLifecycle, buildOutsourceWorkOrderLifecycleValueEnum, resolveOutsourceWorkOrderListLifecycleParams } from '../../../utils/outsourceWorkOrderLifecycle';
import { UniLifecycle, UniLifecycleStepper } from '../../../../../components/uni-lifecycle';
import { DocumentTrackingTimelineBody, useDocumentTracking } from '../../../../../components/document-tracking-panel';
import { WarehouseTraceBriefPrimaryActions } from '../../warehouse-management/WarehouseTraceBriefFooter';
import { searchReferenceDisplay, resolveReferenceDisplay, formatReferenceDisplayLabel } from '../../../../../utils/referenceDisplay';
import dayjs from 'dayjs';
import { AmountDisplay } from '../../../../../components/permission';
import { KUAIZHIZAO_OUTSOURCE_ORDER_FIELD_RESOURCE as OO } from '../../../constants/fieldPermissionResources';
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
import { resolveKuaizhizaoDocumentAction } from '../../../constants/documentActionRegistry';
import { buildUniPushMenuItems, buildUniPushToolbarDisabledReason, UniPushToolbarButton } from '../../../../../components/uni-push';
import { buildDocumentCreateDraftKey, setDocumentFormDraft } from '../../../../../utils/documentFormDraftCache';
import { outsourceWorkOrderCapabilityReasonMessage } from '../../../../../hooks/useDocumentCapabilities';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';
import type { PushPreviewResponse } from '../../../services/sales-order';
import { formatDateTime, formatQuantity } from '../../../../../utils/format';
import { extractProTableSort } from '../../../../../utils/tableQueryKey';
import { formDateFormItemProps, formDateRangeFormItemProps, toApiDateTimeString } from '../../../../../utils/formDate';
import { alignProColumns, SALES_DOC_LIST_FIELD_RANK } from '../../sales-management/shared/documentFieldAlignment';
import { buildDocumentAuditColumns } from '../../shared/documentAuditColumns';
import { DocumentPushProgressBar, DOCUMENT_PROGRESS_COLUMN_WIDTH } from '../../sales-management/shared/DocumentPushProgressBar';
import { outsourceWorkOrderPushPercent } from '../../sales-management/shared/pushProgress';
import { withSingleNewShortcutHint } from '../../../../../utils/globalNewShortcut';

const OUTSOURCE_WORK_ORDER_CUSTOM_FIELD_TABLE = 'apps_kuaizhizao_outsource_work_orders';
const OUTSOURCE_ORDER_HOST_RESOURCE = 'kuaizhizao:outsource-order';

interface OutsourceWorkOrder {
  id?: number;
  tenantId?: number;
  code?: string;
  name?: string;
  productId?: number;
  productCode?: string;
  productName?: string;
  quantity?: number;
  supplierId?: number;
  supplierCode?: string;
  supplierName?: string;
  outsourceOperation?: string;
  outsourceOperationName?: string;
  unitPrice?: number;
  totalAmount?: number;
  status?: string;
  priority?: string;
  plannedStartDate?: string;
  plannedEndDate?: string;
  actualStartDate?: string;
  actualEndDate?: string;
  receivedQuantity?: number;
  qualifiedQuantity?: number;
  unqualifiedQuantity?: number;
  issuedQuantity?: number;
  isFrozen?: boolean;
  freezeReason?: string;
  frozenAt?: string;
  frozenBy?: number;
  frozenByName?: string;
  remarks?: string;
  attachments?: Array<{ uid?: string; name?: string; url?: string }>;
  createdAt?: string;
  updatedAt?: string;
  /** 后端 snake_case */
  tenant_id?: number;
  product_id?: number;
  product_code?: string;
  product_name?: string;
  supplier_id?: number;
  supplier_code?: string;
  supplier_name?: string;
  outsource_operation?: string;
  outsource_operation_name?: string;
  unit_price?: number;
  total_amount?: number;
  planned_start_date?: string;
  planned_end_date?: string;
  actual_start_date?: string;
  actual_end_date?: string;
  issued_quantity?: number;
  received_quantity?: number;
  qualified_quantity?: number;
  unqualified_quantity?: number;
  updated_at?: string;
  capabilities?: {
    push_outsource_issue?: { allowed?: boolean; reason?: string };
    push_outsource_receipt?: { allowed?: boolean; reason?: string };
    cancel?: { allowed?: boolean; reason?: string };
    close?: { allowed?: boolean; reason?: string };
  };
}


function getOutsourceOperationDisplay(
  record: Pick<
    OutsourceWorkOrder,
    'outsourceOperationName' | 'outsource_operation_name' | 'outsourceOperation' | 'outsource_operation'
  >,
): string {
  return (
    record.outsourceOperationName ||
    record.outsource_operation_name ||
    record.outsourceOperation ||
    record.outsource_operation ||
    '-'
  );
}

const OPERATION_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** 物料 source_config.outsource_operation 存工序 UUID，展示需解析为名称 */
async function resolveOutsourceOperationName(value?: string | null): Promise<string | undefined> {
  const raw = String(value ?? '').trim();
  if (!raw) return undefined;
  if (!OPERATION_UUID_RE.test(raw)) return raw;
  try {
    const items = await resolveReferenceDisplay({
      resource: 'master-data:process:operation',
      recordUuids: [raw],
      hostResource: OUTSOURCE_ORDER_HOST_RESOURCE,
    });
    const op = items[0];
    if (!op) return raw;
    return formatReferenceDisplayLabel(op) || raw;
  } catch {
    return raw;
  }
}

function buildDescriptionItemsFromColumns<T extends Record<string, any>>(
  dataSource: T,
  cols: ProDescriptionsItemProps<T>[]
): NonNullable<DescriptionsProps['items']> {
  return cols.map((col, index) => {
    const dataIndex = col.dataIndex as keyof T | undefined;
    const value = dataIndex != null ? dataSource[dataIndex] : undefined;
    let content: React.ReactNode = value as React.ReactNode;
    if (col.valueType === 'dateTime' && value) {
      content = formatDateTime(value as string, 'YYYY-MM-DD HH:mm:ss');
    } else if (col.valueType === 'date' && value) {
      content = formatDateTime(value as string, 'YYYY-MM-DD');
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

function renderOwoRowActions(nodes: React.ReactNode[], keyPrefix: string): React.ReactNode {
  return renderRowActionsOverflow(nodes, { keyPrefix });
}

/** 委外总金额只读展示：须在 ProForm 内用 Form.useWatch，勿用 ProFormDependency 包 colProps（会打断栅格导致左侧裁切） */
const OutsourceTotalAmountReadonly: React.FC = () => {
  const { token } = AntdTheme.useToken();
  const quantity = Form.useWatch('quantity');
  const unitPrice = Form.useWatch('unitPrice');
  return (
    <div
      style={{
        width: '100%',
        minHeight: 32,
        padding: '4px 11px',
        display: 'flex',
        alignItems: 'center',
        border: `1px solid ${token.colorBorder}`,
        borderRadius: token.borderRadius,
        background: token.colorFillAlter,
      }}
    >
      <AmountDisplay
        resource={OO}
        fieldName="total_amount"
        value={(Number(quantity) || 0) * (Number(unitPrice) || 0)}
      />
    </div>
  );
};

const OWO_STAT_SPARK_1 = [2, 3, 4, 3, 5, 4, 6];
const OWO_STAT_SPARK_2 = [1, 2, 1, 0, 2, 1, 1];
const OWO_STAT_SPARK_3 = [3, 4, 5, 6, 5, 7, 8];


export const OutsourceWorkOrdersTable: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const pushToInboundAction = resolveKuaizhizaoDocumentAction(t, 'inbound.pull_from_outsource_work_order');
  const pushToOutboundAction = resolveKuaizhizaoDocumentAction(t, 'outbound.pull_from_outsource_work_order');
  const { message: messageApi, modal } = App.useApp();
  const { token } = AntdTheme.useToken();
  const outsourceWorkOrderDetailDrawerZIndex = token.zIndexPopupBase;
  const actionRef = useRef<ActionType>(null);
  const tableRowsRef = useRef<OutsourceWorkOrder[]>([]);

  const invalidateMenuBadgeCounts = useInvalidateMenuBadgeCounts();
  const [statsVersion, setStatsVersion] = useState(0);
  const [localStats, setLocalStats] = useState({ total: 0, draft: 0, inProgress: 0 });
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);


  // 产品/供应商列表：仅供新建/编辑弹窗与高级搜索供应商下拉；按需加载，无 master-data 权限时不阻断列表
  const [productList, setProductList] = useState<any[]>([]);
  const [supplierList, setSupplierList] = useState<any[]>([]);
  const formReferenceLoadedRef = useRef(false);
  const [priorityOptions, setPriorityOptions] = useState<Array<{ label: string; value: string }>>([]);
  const [priorityLoading, setPriorityLoading] = useState(false);

  // Modal 相关状态（创建/编辑工单委外）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentWorkOrder, setCurrentWorkOrder] = useState<OutsourceWorkOrder | null>(null);
  const formRef = useRef<any>(null);

  const {
    customFields: owoFormCustomFields,
    customFieldValues: owoFormCustomFieldValues,
    loadFieldValues: loadOwoFormFieldValues,
    extractFormValues: extractOwoFormValues,
    saveCustomFieldValues: saveOwoCustomFieldValues,
    resetFieldValues: resetOwoFormFieldValues,
  } = useCustomFields({
    tableName: OUTSOURCE_WORK_ORDER_CUSTOM_FIELD_TABLE,
    hostResource: OUTSOURCE_ORDER_HOST_RESOURCE,
    loadWhenOpen: true,
    open: modalVisible,
  });

  const {
    customFields: owoListCustomFields,
    generateCustomFieldColumns: generateOwoCustomFieldColumns,
    enrichRecordsWithCustomFields: enrichOwoRecordsWithCustomFields,
    customFieldValues: owoDetailCustomFieldValues,
    loadFieldValuesForDetail: loadOwoFieldValuesForDetail,
    resetDetailFieldValues: resetOwoDetailFieldValues,
  } = useCustomFieldsForList<OutsourceWorkOrder>({
    tableName: OUTSOURCE_WORK_ORDER_CUSTOM_FIELD_TABLE,
    hostResource: OUTSOURCE_ORDER_HOST_RESOURCE,
  });

  useEffect(() => {
    if (owoListCustomFields.length > 0 && actionRef.current) {
      setTimeout(() => actionRef.current?.reload(), 200);
    }
  }, [owoListCustomFields.length]);

  // 详情 Drawer 相关状态
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [workOrderDetail, setWorkOrderDetail] = useState<OutsourceWorkOrder | null>(null);

  const [owoTrackingRefreshKey, setOwoTrackingRefreshKey] = useState(0);

  const outsourceWorkOrderTracking = useDocumentTracking(
    drawerVisible && workOrderDetail?.id ? 'outsource_work_order' : undefined,
    workOrderDetail?.id,
    owoTrackingRefreshKey,
  );

  const refreshLocalStats = useCallback(async () => {
    try {
      const response = await outsourceWorkOrderApi.list({ skip: 0, limit: 1000 });
      const list = response.data ?? [];
      setLocalStats({
        total: list.length,
        draft: list.filter((x: OutsourceWorkOrder) => (x.status || '').trim() === 'draft').length,
        inProgress: list.filter((x: OutsourceWorkOrder) => (x.status || '').trim() === 'in_progress').length,
      });
    } catch {
      setLocalStats({ total: 0, draft: 0, inProgress: 0 });
    }
  }, []);

  useEffect(() => {
    void refreshLocalStats();
  }, [statsVersion, refreshLocalStats]);

  type OutsourcePushPreviewKind = 'outbound_issue' | 'inbound_receipt';
  const [pushPreviewOpen, setPushPreviewOpen] = useState(false);
  const [closeModalOpen, setCloseModalOpen] = useState(false);
  const [closeModalRecord, setCloseModalRecord] = useState<OutsourceWorkOrder | null>(null);
  const [closeReason, setCloseReason] = useState('');
  const [closeSubmitting, setCloseSubmitting] = useState(false);
  const [pushPreviewLoading, setPushPreviewLoading] = useState(false);
  const [pushPreviewKind, setPushPreviewKind] = useState<OutsourcePushPreviewKind | null>(null);
  const [pushPreviewWorkOrderId, setPushPreviewWorkOrderId] = useState<number | null>(null);
  const [pushPreviewData, setPushPreviewData] = useState<PushPreviewResponse | null>(null);
  const [pushPreviewSelectedMaterialIds, setPushPreviewSelectedMaterialIds] = useState<number[]>([]);

  // 当前选中产品的物料来源信息
  const [selectedMaterialSourceInfo, setSelectedMaterialSourceInfo] = useState<{
    sourceType?: string;
    sourceTypeName?: string;
    supplierId?: number;
    supplierCode?: string;
    supplierName?: string;
    /** 物料配置中的工序 UUID（提交仍用此值，后端会规范为名称） */
    outsourceOperation?: string;
    /** 展示用工序名称 */
    outsourceOperationName?: string;
    unitPrice?: number;
    validationErrors?: string[];
    canCreateWorkOrder?: boolean;
  } | null>(null);

  const loadFormReferenceData = useCallback(async () => {
    if (formReferenceLoadedRef.current) return;
    const [productsResult, suppliersResult] = await Promise.allSettled([
      searchReferenceDisplay({
        resource: 'master-data:material',
        hostResource: OUTSOURCE_ORDER_HOST_RESOURCE,
        pageSize: 1000,
        sourceType: 'Outsource',
      }),
      searchReferenceDisplay({
        resource: 'master-data:supply-chain:supplier',
        hostResource: OUTSOURCE_ORDER_HOST_RESOURCE,
        pageSize: 1000,
      }),
    ]);
    let loaded = false;
    if (productsResult.status === 'fulfilled') {
      const outsourceProducts = (productsResult.value.items ?? [])
        .filter((item) => item.id != null)
        .map((item) => ({
          id: item.id,
          uuid: item.uuid,
          code: item.code ?? item.extra?.main_code,
          name: item.name ?? item.label,
          sourceType: item.extra?.source_type,
          source_type: item.extra?.source_type,
        }));
      setProductList(outsourceProducts);
      loaded = true;
    }
    if (suppliersResult.status === 'fulfilled') {
      setSupplierList(
        (suppliersResult.value.items ?? [])
          .filter((item) => item.id != null)
          .map((item) => ({
            id: item.id,
            uuid: item.uuid,
            code: item.code,
            name: item.name ?? item.label,
          })),
      );
      loaded = true;
    }
    if (loaded) {
      formReferenceLoadedRef.current = true;
    }
  }, []);

  useEffect(() => {
    void loadFormReferenceData();
  }, [loadFormReferenceData]);

  useEffect(() => {
    if (modalVisible) {
      void loadFormReferenceData();
    }
  }, [modalVisible, loadFormReferenceData]);

  useEffect(() => {
    const loadPriority = async () => {
      const fallbackItems: Pick<DictionaryItem, 'value' | 'label' | 'is_system_managed' | 'sort_order'>[] = [
        { value: 'low', label: '低', is_system_managed: true, sort_order: 0 },
        { value: 'normal', label: '正常', is_system_managed: true, sort_order: 1 },
        { value: 'high', label: '高', is_system_managed: true, sort_order: 2 },
        { value: 'urgent', label: '紧急', is_system_managed: true, sort_order: 3 },
      ];
      setPriorityLoading(true);
      try {
        const dict = await getDataDictionaryByCode('WORK_ORDER_PRIORITY');
        const items = await getDictionaryItemList(dict.uuid, true);
        const sorted = [...items].sort((a, b) => a.sort_order - b.sort_order);
        setPriorityOptions(mapSystemDictionaryItemOptions('WORK_ORDER_PRIORITY', sorted, t));
      } catch {
        setPriorityOptions(
          mapSystemDictionaryItemOptions('WORK_ORDER_PRIORITY', fallbackItems as DictionaryItem[], t),
        );
      } finally {
        setPriorityLoading(false);
      }
    };
    loadPriority();
  }, [t]);

  const getOwoStatusTag = useCallback(
    (status?: string) => {
      const statusMap: Record<string, { color: string; key: string }> = {
        draft: { color: 'default', key: 'app.kuaizhizao.outsourceWorkOrder.statusDraft' },
        released: { color: 'processing', key: 'app.kuaizhizao.outsourceWorkOrder.statusReleased' },
        in_progress: { color: 'processing', key: 'app.kuaizhizao.outsourceWorkOrder.statusInProgress' },
        completed: { color: 'success', key: 'app.kuaizhizao.outsourceWorkOrder.statusCompleted' },
        cancelled: { color: 'error', key: 'app.kuaizhizao.outsourceWorkOrder.statusCancelled' },
      };
      const s = statusMap[status || 'draft'] || { color: 'default', key: 'app.kuaizhizao.outsourceWorkOrder.statusUnknown' };
      return <Tag color={s.color}>{t(s.key)}</Tag>;
    },
    [t],
  );

  const getOwoPriorityTag = useCallback(
    (priority?: string) => {
      const priorityMap: Record<string, { color: string; key: string }> = {
        low: { color: 'default', key: 'app.kuaizhizao.outsourceWorkOrder.priorityLow' },
        normal: { color: 'blue', key: 'app.kuaizhizao.outsourceWorkOrder.priorityNormal' },
        high: { color: 'orange', key: 'app.kuaizhizao.outsourceWorkOrder.priorityHigh' },
        urgent: { color: 'red', key: 'app.kuaizhizao.outsourceWorkOrder.priorityUrgent' },
      };
      const p = priorityMap[priority || 'normal'] || { color: 'default', key: 'app.kuaizhizao.outsourceWorkOrder.priorityNormal' };
      return <Tag color={p.color}>{t(p.key)}</Tag>;
    },
    [t],
  );

  const getSourceTypeLabel = useCallback(
    (sourceType: string) => {
      const keys: Record<string, string> = {
        Make: 'app.kuaizhizao.outsourceWorkOrder.sourceTypeMake',
        Buy: 'app.kuaizhizao.outsourceWorkOrder.sourceTypeBuy',
        Phantom: 'app.kuaizhizao.outsourceWorkOrder.sourceTypePhantom',
        Outsource: 'app.kuaizhizao.outsourceWorkOrder.sourceTypeOutsource',
        Configure: 'app.kuaizhizao.outsourceWorkOrder.sourceTypeConfigure',
      };
      return keys[sourceType] ? t(keys[sourceType]) : sourceType;
    },
    [t],
  );

  const detailBaseColumns: ProDescriptionsItemProps<OutsourceWorkOrder>[] = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.outsourceWorkOrder.colCode'),
        dataIndex: 'code',
        render: (_, r) => (
          <Typography.Text copyable={{ text: String(r.code ?? '') }}>{r.code ?? '-'}</Typography.Text>
        ),
      },
      { title: t('app.kuaizhizao.outsourceWorkOrder.colName'), dataIndex: 'name' },
      {
        title: t('app.kuaizhizao.outsourceWorkOrder.colProductCode'),
        dataIndex: ['productCode', 'product_code'] as any,
        render: (_, record) => (
          <Typography.Text copyable={{ text: String(record.productCode || record.product_code || '') }}>
            {record.productCode || record.product_code || '-'}
          </Typography.Text>
        ),
      },
      {
        title: t('app.kuaizhizao.outsourceWorkOrder.colProductName'),
        dataIndex: ['productName', 'product_name'] as any,
        render: (_, record) => record.productName || record.product_name || '-',
      },
      {
        title: t('app.kuaizhizao.outsourceWorkOrder.colQuantity'),
        dataIndex: 'quantity',
        render: (_, record) => (formatQuantity(record.quantity)),
      },
      {
        title: t('app.kuaizhizao.outsourceWorkOrder.colSupplier'),
        dataIndex: ['supplierName', 'supplier_name'] as any,
        render: (_, record) => record.supplierName || record.supplier_name || '-',
      },
      {
        title: t('app.kuaizhizao.outsourceWorkOrder.colOperation'),
        dataIndex: ['outsourceOperation', 'outsource_operation'] as any,
        render: (_, record) => getOutsourceOperationDisplay(record),
      },
      {
        title: t('app.kuaizhizao.outsourceWorkOrder.colUnitPrice'),
        dataIndex: ['unitPrice', 'unit_price'] as any,
        render: (_, record) => {
          const price = record.unitPrice || record.unit_price;
          return price != null ? (
            <AmountDisplay resource={OO} fieldName="unit_price" value={Number(price)} />
          ) : (
            '-'
          );
        },
      },
      {
        title: t('app.kuaizhizao.outsourceWorkOrder.colTotalAmount'),
        dataIndex: ['totalAmount', 'total_amount'] as any,
        render: (_, record) => {
          const amount = record.totalAmount || record.total_amount;
          return amount != null ? (
            <AmountDisplay resource={OO} fieldName="total_amount" value={Number(amount)} />
          ) : (
            '-'
          );
        },
      },
      {
        title: t('app.kuaizhizao.outsourceWorkOrder.colStatus'),
        dataIndex: 'status',
        render: (_, record) => getOwoStatusTag(record.status),
      },
      {
        title: t('app.kuaizhizao.outsourceWorkOrder.colPriority'),
        dataIndex: 'priority',
        render: (_, record) => getOwoPriorityTag(record.priority),
      },
      {
        title: t('app.kuaizhizao.outsourceWorkOrder.colIssuedQty'),
        dataIndex: ['issuedQuantity', 'issued_quantity'] as any,
        render: (_, record) => {
          const qty = record.issuedQuantity || record.issued_quantity;
          return formatQuantity(qty);
        },
      },
      {
        title: t('app.kuaizhizao.outsourceWorkOrder.colReceivedQty'),
        dataIndex: ['receivedQuantity', 'received_quantity'] as any,
        render: (_, record) => {
          const qty = record.receivedQuantity || record.received_quantity;
          return formatQuantity(qty);
        },
      },
      {
        title: t('app.kuaizhizao.outsourceWorkOrder.colQualifiedQty'),
        dataIndex: ['qualifiedQuantity', 'qualified_quantity'] as any,
        render: (_, record) => {
          const qty = record.qualifiedQuantity || record.qualified_quantity;
          return formatQuantity(qty);
        },
      },
      {
        title: t('app.kuaizhizao.outsourceWorkOrder.colUnqualifiedQty'),
        dataIndex: ['unqualifiedQuantity', 'unqualified_quantity'] as any,
        render: (_, record) => {
          const qty = record.unqualifiedQuantity || record.unqualified_quantity;
          return formatQuantity(qty);
        },
      },
      {
        title: t('app.kuaizhizao.outsourceWorkOrder.colPlannedStart'),
        dataIndex: ['plannedStartDate', 'planned_start_date'] as any,
        valueType: 'dateTime',
        render: (_, record) => {
          const date = record.plannedStartDate || record.planned_start_date;
          return date ? formatDateTime(date, 'YYYY-MM-DD HH:mm:ss') : '-';
        },
      },
      {
        title: t('app.kuaizhizao.outsourceWorkOrder.colPlannedEnd'),
        dataIndex: ['plannedEndDate', 'planned_end_date'] as any,
        valueType: 'dateTime',
        render: (_, record) => {
          const date = record.plannedEndDate || record.planned_end_date;
          return date ? formatDateTime(date, 'YYYY-MM-DD HH:mm:ss') : '-';
        },
      },
      {
        title: t('app.kuaizhizao.outsourceWorkOrder.colActualStart'),
        dataIndex: ['actualStartDate', 'actual_start_date'] as any,
        valueType: 'dateTime',
        render: (_, record) => {
          const date = record.actualStartDate || record.actual_start_date;
          return date ? formatDateTime(date, 'YYYY-MM-DD HH:mm:ss') : '-';
        },
      },
      {
        title: t('app.kuaizhizao.outsourceWorkOrder.colActualEnd'),
        dataIndex: ['actualEndDate', 'actual_end_date'] as any,
        valueType: 'dateTime',
        render: (_, record) => {
          const date = record.actualEndDate || record.actual_end_date;
          return date ? formatDateTime(date, 'YYYY-MM-DD HH:mm:ss') : '-';
        },
      },
    ],
    [getOwoPriorityTag, getOwoStatusTag, t],
  );

  const detailRemarksColumn: ProDescriptionsItemProps<OutsourceWorkOrder> = useMemo(
    () => ({
      title: t('app.kuaizhizao.common.fieldNotes'),
      dataIndex: 'remarks',
      span: 3,
      render: (text) => text || '-',
    }),
    [t],
  );

  /** 产品选择变更：获取物料来源信息并自动填充 */
  const handleProductChange = async (value: number | undefined) => {
    if (value) {
      const selectedMaterial = productList.find(p => p.id === value);
      if (selectedMaterial) {
        try {
          const items = await resolveReferenceDisplay({
            resource: 'master-data:material',
            recordIds: [Number(selectedMaterial.id)],
            hostResource: OUTSOURCE_ORDER_HOST_RESOURCE,
          });
          const materialDetail = items[0];
          if (!materialDetail) {
            setSelectedMaterialSourceInfo(null);
            return;
          }
          const sourceType = materialDetail.extra?.source_type as string | undefined;
          const sourceConfig = (materialDetail.extra?.source_config ?? {}) as Record<string, unknown>;

          const sourceTypeNames: Record<string, string> = {
            Make: getSourceTypeLabel('Make'),
            Buy: getSourceTypeLabel('Buy'),
            Phantom: getSourceTypeLabel('Phantom'),
            Outsource: getSourceTypeLabel('Outsource'),
            Configure: getSourceTypeLabel('Configure'),
          };

          if (sourceType === 'Outsource') {
            const supplierId = sourceConfig.outsource_supplier_id;
            const supplierCode = sourceConfig.outsource_supplier_code;
            const supplierName = sourceConfig.outsource_supplier_name;
            const outsourceOperation = sourceConfig.outsource_operation;
            const unitPrice = sourceConfig.outsource_price;
            const outsourceOperationName = await resolveOutsourceOperationName(outsourceOperation);

            setSelectedMaterialSourceInfo({
              sourceType,
              sourceTypeName: sourceTypeNames[sourceType] || sourceType,
              supplierId,
              supplierCode,
              supplierName,
              outsourceOperation,
              outsourceOperationName,
              unitPrice,
              canCreateWorkOrder: true,
            });

            if (supplierId) {
              formRef.current?.setFieldsValue({
                supplierId,
                outsourceOperation,
                unitPrice,
              });
            }
          } else {
            const st = String(sourceType ?? '');
            setSelectedMaterialSourceInfo({
              sourceType,
              sourceTypeName: sourceTypeNames[st] || st,
              canCreateWorkOrder: false,
              validationErrors: [t('app.kuaizhizao.outsourceWorkOrder.validationNotOutsource', { type: st })],
            });
          }
        } catch (error) {
          console.error('获取物料详情失败:', error);
          setSelectedMaterialSourceInfo(null);
        }
      } else {
        setSelectedMaterialSourceInfo(null);
      }
    } else {
      setSelectedMaterialSourceInfo(null);
    }
  };

  /** 参考销售订单：先打开弹窗，再让 CodeField 自动生成编号 */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentWorkOrder(null);
    setSelectedMaterialSourceInfo(null);
    resetOwoFormFieldValues();
    setModalVisible(true);
    // FormModalTemplate 设置了 destroyOnHidden，ProForm 每次打开都是全新挂载，无需 setTimeout + resetFields
  };
  useNewShortcut(handleCreate);
  const createButtonLabel = useMemo(
    () => withSingleNewShortcutHint(t('app.kuaizhizao.outsourceWorkOrder.createButton')),
    [t],
  );

  /**
   * 处理编辑工单委外
   */
  const handleEdit = async (record: OutsourceWorkOrder) => {
    try {
      const detail = await outsourceWorkOrderApi.get(record.id!.toString());
      setIsEdit(true);
      setCurrentWorkOrder(detail);
      setModalVisible(true);
      window.setTimeout(() => {
        formRef.current?.setFieldsValue({
          name: detail.name,
          productId: detail.productId || detail.product_id,
          quantity: detail.quantity,
          supplierId: detail.supplierId || detail.supplier_id,
          outsourceOperation: detail.outsourceOperation || detail.outsource_operation,
          unitPrice: detail.unitPrice || detail.unit_price,
          priority: detail.priority,
          plannedStartDate: (detail.plannedStartDate || detail.planned_start_date) ? dayjs(detail.plannedStartDate || detail.planned_start_date) : undefined,
          plannedEndDate: (detail.plannedEndDate || detail.planned_end_date) ? dayjs(detail.plannedEndDate || detail.planned_end_date) : undefined,
          remarks: detail.remarks,
          attachments: mapAttachmentsToUploadList((detail as any).attachments),
        });
        if (detail.id != null) {
          loadOwoFormFieldValues(detail.id).then((fieldFormValues) => {
            formRef.current?.setFieldsValue(fieldFormValues);
          });
        }
      }, 100);
    } catch (error) {
      messageApi.error(t('app.kuaizhizao.outsourceWorkOrder.fetchDetailFailed'));
    }
  };

  /**
   * 下达委外工单（draft → released）
   */
  const handleRelease = async (record: OutsourceWorkOrder) => {
    if (record.id == null) return;
    try {
      const updated = await outsourceWorkOrderApi.release(String(record.id));
      messageApi.success(t('app.kuaizhizao.outsourceWorkOrder.releaseSuccess'));
      setStatsVersion((v) => v + 1);
      invalidateMenuBadgeCounts();
      actionRef.current?.reload();
      if (workOrderDetail?.id === record.id) {
        setWorkOrderDetail(updated);
        setOwoTrackingRefreshKey((k) => k + 1);
      }
    } catch (error: unknown) {
      messageApi.error(getApiErrorMessage(error, t('app.kuaizhizao.outsourceWorkOrder.releaseFailed')));
    }
  };

  const refreshAfterStatusChange = (updated: OutsourceWorkOrder, recordId?: number) => {
    setStatsVersion((v) => v + 1);
    invalidateMenuBadgeCounts();
    actionRef.current?.reload();
    if (workOrderDetail?.id === recordId || workOrderDetail?.id === updated.id) {
      setWorkOrderDetail(updated);
      setOwoTrackingRefreshKey((k) => k + 1);
    }
  };

  const handleCancel = (record: OutsourceWorkOrder) => {
    if (record.id == null) return;
    if (record.capabilities?.cancel?.allowed !== true) {
      const reason = outsourceWorkOrderCapabilityReasonMessage(record.capabilities?.cancel?.reason, t);
      if (reason) messageApi.warning(reason);
      return;
    }
    modal.confirm({
      title: t('app.kuaizhizao.outsourceWorkOrder.actionCancel'),
      content: t('app.kuaizhizao.outsourceWorkOrder.confirmCancel'),
      okType: 'danger',
      onOk: async () => {
        try {
          const updated = await outsourceWorkOrderApi.cancel(String(record.id));
          messageApi.success(t('app.kuaizhizao.outsourceWorkOrder.cancelSuccess'));
          refreshAfterStatusChange(updated, record.id);
        } catch (error: unknown) {
          messageApi.error(getApiErrorMessage(error, t('app.kuaizhizao.outsourceWorkOrder.cancelFailed')));
        }
      },
    });
  };

  const openCloseModal = (record: OutsourceWorkOrder) => {
    if (record.capabilities?.close?.allowed !== true) {
      const reason = outsourceWorkOrderCapabilityReasonMessage(record.capabilities?.close?.reason, t);
      if (reason) messageApi.warning(reason);
      return;
    }
    setCloseModalRecord(record);
    setCloseReason('');
    setCloseModalOpen(true);
  };

  const handleCloseConfirm = async () => {
    const reason = closeReason.trim();
    if (!reason) {
      messageApi.warning(t('app.kuaizhizao.outsourceWorkOrder.closeReasonRequired'));
      return;
    }
    if (closeModalRecord?.id == null) return;
    setCloseSubmitting(true);
    try {
      const updated = await outsourceWorkOrderApi.close(String(closeModalRecord.id), reason);
      messageApi.success(t('app.kuaizhizao.outsourceWorkOrder.closeSuccess'));
      setCloseModalOpen(false);
      setCloseModalRecord(null);
      setCloseReason('');
      refreshAfterStatusChange(updated, closeModalRecord.id);
    } catch (error: unknown) {
      messageApi.error(getApiErrorMessage(error, t('app.kuaizhizao.outsourceWorkOrder.closeFailed')));
    } finally {
      setCloseSubmitting(false);
    }
  };

  /**
   * 处理删除工单委外
   */
  const handleDelete = async (keys: React.Key[]) => {
    if (keys.length === 0) {
      messageApi.warning(t('app.kuaizhizao.outsourceWorkOrder.selectToDelete'));
      return;
    }
    try {
      const ids = keys.map((k) => Number(k));
      for (const id of keys) {
        await outsourceWorkOrderApi.delete(String(id));
      }
      messageApi.success(t('app.kuaizhizao.outsourceWorkOrder.deleteSuccess', { count: keys.length }));
      setSelectedRowKeys([]);
      if (workOrderDetail?.id != null && ids.includes(workOrderDetail.id)) {
        setDrawerVisible(false);
        setWorkOrderDetail(null);
      }
      setStatsVersion((v) => v + 1);
      invalidateMenuBadgeCounts();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('common.deleteFailed'));
    }
  };

  /**
   * 处理查看详情
   */
  const handleDetail = async (record: OutsourceWorkOrder) => {
    try {
      const detail = await outsourceWorkOrderApi.get(record.id!.toString());
      setWorkOrderDetail(detail);
      setDrawerVisible(true);
      setOwoTrackingRefreshKey((k) => k + 1);
      if (detail.id != null) {
        await loadOwoFieldValuesForDetail(detail.id);
      }
    } catch (error) {
      messageApi.error(t('app.kuaizhizao.outsourceWorkOrder.fetchDetailFailed'));
    }
  };

  /**
   * 处理提交表单
   */
  const handleSubmit = async (values: any): Promise<void> => {
    try {
      const { customData, standardValues } = extractOwoFormValues(values);
      Object.keys(values).forEach((key) => {
        if (key.startsWith('custom_')) delete values[key];
      });
      Object.assign(values, standardValues);

      // 物料来源验证
      if (values.productId && selectedMaterialSourceInfo) {
        if (selectedMaterialSourceInfo.canCreateWorkOrder === false) {
          messageApi.error(t('app.kuaizhizao.outsourceWorkOrder.materialSourceNotAllowed'));
          throw new Error(t('app.kuaizhizao.outsourceWorkOrder.materialSourceNotAllowed'));
        }
      }

      // 处理日期格式（转换为下划线命名；兼容 dayjs / 字符串）
      if (values.plannedStartDate) {
        values.planned_start_date = toApiDateTimeString(values.plannedStartDate);
        delete values.plannedStartDate;
      }
      if (values.plannedEndDate) {
        values.planned_end_date = toApiDateTimeString(values.plannedEndDate);
        delete values.plannedEndDate;
      }

      // 处理产品信息（转换为下划线命名）
      if (values.productId) {
        values.product_id = values.productId;
        delete values.productId;
        const selectedProduct = productList.find(p => p.id === values.product_id);
        if (selectedProduct) {
          values.product_code = selectedProduct.code || selectedProduct.mainCode;
          values.product_name = selectedProduct.name;
        }
      }

      // 处理供应商信息（转换为下划线命名）
      if (values.supplierId) {
        values.supplier_id = values.supplierId;
        delete values.supplierId;
        const selectedSupplier = supplierList.find(s => s.id === values.supplier_id);
        if (selectedSupplier) {
          values.supplier_code = selectedSupplier.code;
          values.supplier_name = selectedSupplier.name;
        }
      }

      // 如果从物料来源信息中获取了委外工序和单价，使用它们（转换为下划线命名）
      if (selectedMaterialSourceInfo) {
        if (!values.outsource_operation && selectedMaterialSourceInfo.outsourceOperation) {
          values.outsource_operation = selectedMaterialSourceInfo.outsourceOperation;
        }
        if (!values.unit_price && selectedMaterialSourceInfo.unitPrice) {
          values.unit_price = selectedMaterialSourceInfo.unitPrice;
        }
        if (!values.supplier_id && selectedMaterialSourceInfo.supplierId) {
          values.supplier_id = selectedMaterialSourceInfo.supplierId;
          values.supplier_code = selectedMaterialSourceInfo.supplierCode;
          values.supplier_name = selectedMaterialSourceInfo.supplierName;
        }
      }

      // 处理委外工序（转换为下划线命名）
      if (values.outsourceOperation) {
        values.outsource_operation = values.outsourceOperation;
        delete values.outsourceOperation;
      }

      // 计算总金额（转换为下划线命名）
      if (values.quantity && values.unit_price) {
        values.total_amount = values.quantity * values.unit_price;
      } else if (values.quantity && values.unitPrice) {
        values.unit_price = values.unitPrice;
        delete values.unitPrice;
        values.total_amount = values.quantity * values.unit_price;
      }

      values.attachments = normalizeDocumentAttachments(values.attachments);

      const wid = currentWorkOrder?.id;
      let recordId = wid;

      if (isEdit && wid) {
        await outsourceWorkOrderApi.update(wid.toString(), values);
        messageApi.success(t('app.kuaizhizao.outsourceWorkOrder.updateSuccess'));
      } else {
        const created = await outsourceWorkOrderApi.create(values);
        recordId = created?.id;
        messageApi.success(t('app.kuaizhizao.outsourceWorkOrder.createSuccess'));
      }

      if (recordId != null) {
        await saveOwoCustomFieldValues(recordId, customData);
      }

      setModalVisible(false);
      resetOwoFormFieldValues();
      setSelectedMaterialSourceInfo(null);
      invalidateMenuBadgeCounts();

      actionRef.current?.reload();
      setStatsVersion((v) => v + 1);
      if (recordId && workOrderDetail?.id === recordId) {
        try {
          const fresh = await outsourceWorkOrderApi.get(String(recordId));
          setWorkOrderDetail(fresh);
          setOwoTrackingRefreshKey((k) => k + 1);
          await loadOwoFieldValuesForDetail(recordId);
        } catch {
          /* ignore */
        }
      }
    } catch (error: any) {
      messageApi.error(error.message || t('app.kuaizhizao.outsourceWorkOrder.operationFailed'));
      throw error;
    }
  };

  /**
   * 下推预览：映射委外发料预览为统一 PushPreviewResponse
   */
  const mapOutsourceIssuePreview = useCallback(
    (preview: {
      lines?: Array<{
        material_id?: number;
        material_code?: string;
        material_name?: string;
        required_quantity?: number | string;
        issued_quantity?: number | string;
        pending_quantity?: number | string;
      }>;
      message?: string | null;
      outsource_work_order_code?: string;
    }): PushPreviewResponse => {
      const items = (preview.lines ?? []).map((line) => ({
        item_id: Number(line.material_id),
        material_code: String(line.material_code ?? ''),
        material_name: String(line.material_name ?? ''),
        quantity: Number(line.required_quantity ?? 0),
        pushed_quantity: Number(line.issued_quantity ?? 0),
        max_push_quantity: Number(line.pending_quantity ?? 0),
      }));
      const pushableCount = items.filter((row) => Number(row.max_push_quantity ?? 0) > 0).length;
      let blockingReason: string | null = null;
      if (!items.length || pushableCount === 0) {
        blockingReason = preview.message || t('app.kuaizhizao.warehouseOutbound.pull.osPreviewNoLines');
      }
      return {
        target_type: 'outsource_material_issue',
        summary: t('app.kuaizhizao.warehouseOutbound.pull.osPreviewSummary', {
          code: preview.outsource_work_order_code ?? '',
          pushable: pushableCount,
          total: items.length,
        }),
        items,
        tip: t('app.kuaizhizao.warehouseOutbound.pull.osPreviewTip'),
        has_blocking_issues: !!blockingReason,
        blocking_reason: blockingReason,
      };
    },
    [t],
  );

  const mapOutsourceReceiptPreview = useCallback(
    (preview: {
      lines?: Array<Record<string, unknown>>;
      message?: string | null;
      outsource_work_order_code?: string;
    }): PushPreviewResponse => {
      const items = (preview.lines ?? []).map((line) => ({
        item_id: Number(line.product_id ?? 0),
        material_code: String(line.product_code ?? ''),
        material_name: String(line.product_name ?? ''),
        quantity: Number(line.ordered_quantity ?? 0),
        pushed_quantity: Number(line.received_quantity ?? 0),
        max_push_quantity: Number(line.pending_quantity ?? 0),
      }));
      const pushableCount = items.filter((row) => Number(row.max_push_quantity ?? 0) > 0).length;
      let blockingReason: string | null = null;
      if (!items.length || pushableCount === 0) {
        blockingReason = preview.message || t('app.kuaizhizao.warehouseInbound.pull.outsource.previewNoLines');
      }
      return {
        target_type: 'outsource_receipt',
        summary: t('app.kuaizhizao.warehouseInbound.pull.outsource.receiptPreviewSummary', {
          code: preview.outsource_work_order_code ?? '',
          pushable: pushableCount,
          total: items.length,
        }),
        items,
        tip: t('app.kuaizhizao.warehouseInbound.pull.outsource.previewTip'),
        has_blocking_issues: !!blockingReason,
        blocking_reason: blockingReason,
      };
    },
    [t],
  );

  const resetPushPreview = useCallback(() => {
    setPushPreviewOpen(false);
    setPushPreviewLoading(false);
    setPushPreviewKind(null);
    setPushPreviewWorkOrderId(null);
    setPushPreviewData(null);
    setPushPreviewSelectedMaterialIds([]);
  }, []);

  const openPushPreview = useCallback(
    async (kind: OutsourcePushPreviewKind, record: OutsourceWorkOrder) => {
      if (!record.id) return;
      const capKey = kind === 'outbound_issue' ? 'push_outsource_issue' : 'push_outsource_receipt';
      if (record.capabilities?.[capKey]?.allowed !== true) {
        const reason = outsourceWorkOrderCapabilityReasonMessage(record.capabilities?.[capKey]?.reason, t);
        messageApi.warning(
          reason ||
            (kind === 'outbound_issue'
              ? t('app.kuaizhizao.warehouseOutbound.pull.osPreviewBlocked')
              : t('app.kuaizhizao.warehouseInbound.pull.outsource.previewBlocked')),
        );
        return;
      }
      setPushPreviewOpen(true);
      setPushPreviewLoading(true);
      setPushPreviewKind(kind);
      setPushPreviewWorkOrderId(record.id);
      setPushPreviewData(null);
      setPushPreviewSelectedMaterialIds([]);
      try {
        if (kind === 'outbound_issue') {
          const res = await outsourceMaterialIssueApi.issuePreview(record.id);
          const raw = (res as { data?: unknown })?.data ?? res;
          const mapped = mapOutsourceIssuePreview(raw as Parameters<typeof mapOutsourceIssuePreview>[0]);
          setPushPreviewData(mapped);
          setPushPreviewSelectedMaterialIds(
            (mapped.items || [])
              .filter((row) => Number(row.max_push_quantity ?? 0) > 0)
              .map((row) => Number(row.item_id)),
          );
        } else {
          const res = await outsourceMaterialReceiptApi.receiptPreview(record.id);
          const raw = (res as { data?: unknown })?.data ?? res;
          setPushPreviewData(mapOutsourceReceiptPreview(raw as Parameters<typeof mapOutsourceReceiptPreview>[0]));
        }
      } catch (error: unknown) {
        messageApi.error(
          getApiErrorMessage(
            error,
            kind === 'outbound_issue'
              ? t('app.kuaizhizao.warehouseOutbound.pull.osPreviewFailed')
              : t('app.kuaizhizao.warehouseInbound.pull.outsource.previewFailed'),
          ),
        );
        resetPushPreview();
      } finally {
        setPushPreviewLoading(false);
      }
    },
    [mapOutsourceIssuePreview, mapOutsourceReceiptPreview, messageApi, resetPushPreview, t],
  );

  const handlePushPreviewConfirm = useCallback(() => {
    if (!pushPreviewWorkOrderId || !pushPreviewData || pushPreviewData.has_blocking_issues) return;
    if (pushPreviewKind === 'outbound_issue') {
      const rowById = new Map(
        (pushPreviewData.items || []).map((row) => [Number(row.item_id), row]),
      );
      const selectedIds = pushPreviewSelectedMaterialIds.filter((id) => {
        const row = rowById.get(id);
        return row && Number(row.max_push_quantity ?? 0) > 0;
      });
      if (!selectedIds.length) {
        messageApi.warning(t('app.kuaizhizao.warehouseOutbound.pull.osSelectLinesFirst'));
        return;
      }
      const issueQuantities: Record<number, number> = {};
      selectedIds.forEach((id) => {
        issueQuantities[id] = Number(rowById.get(id)?.max_push_quantity ?? 0);
      });
      const entryPath = outboundOutsourceEntryPath(pushPreviewWorkOrderId);
      const draftKey = buildDocumentCreateDraftKey('kuaizhizao:outbound-outsource-pull', entryPath, '');
      setDocumentFormDraft(draftKey, { issueQuantities });
      resetPushPreview();
      navigate(entryPath);
      return;
    }
    if (pushPreviewKind === 'inbound_receipt') {
      const firstLine = pushPreviewData.items?.[0];
      const qty = Number(firstLine?.max_push_quantity ?? 0);
      const entryPath = inboundOutsourceEntryPath(pushPreviewWorkOrderId, 'outsource_receipt');
      const draftKey = buildDocumentCreateDraftKey('kuaizhizao:inbound-outsource-pull', entryPath, '');
      setDocumentFormDraft(draftKey, {
        receiptLine: {
          receiptQuantity: qty,
          qualifiedQuantity: qty,
          unqualifiedQuantity: 0,
        },
      });
      resetPushPreview();
      navigate(entryPath);
    }
  }, [
    messageApi,
    navigate,
    pushPreviewData,
    pushPreviewKind,
    pushPreviewSelectedMaterialIds,
    pushPreviewWorkOrderId,
    resetPushPreview,
    t,
  ]);

  const handlePushToInboundEntry = (record: OutsourceWorkOrder) => {
    void openPushPreview('inbound_receipt', record);
  };

  const handlePushToOutboundEntry = (record: OutsourceWorkOrder) => {
    void openPushPreview('outbound_issue', record);
  };

  const pushPreviewTitle = useMemo(() => {
    if (pushPreviewKind === 'outbound_issue') return pushToOutboundAction.label;
    if (pushPreviewKind === 'inbound_receipt') return pushToInboundAction.label;
    return t('app.kuaizhizao.salesOrder.pushPreviewTitle');
  }, [pushPreviewKind, pushToInboundAction.label, pushToOutboundAction.label, t]);

  const selectedOwoForToolbar = useMemo(() => {
    if (selectedRowKeys.length !== 1) return null;
    const id = Number(selectedRowKeys[0]);
    if (!Number.isFinite(id) || id <= 0) return null;
    return tableRowsRef.current.find((row) => row.id === id) ?? null;
  }, [selectedRowKeys]);

  const owoPushEligible = !!selectedOwoForToolbar
    && (selectedOwoForToolbar.status === 'released' || selectedOwoForToolbar.status === 'in_progress');
  const canPushOutboundToolbar = owoPushEligible
    && selectedOwoForToolbar?.capabilities?.push_outsource_issue?.allowed === true;
  const canPushInboundToolbar = owoPushEligible
    && selectedOwoForToolbar?.capabilities?.push_outsource_receipt?.allowed === true;

  const toolbarPushDisabledReason = useMemo(() => {
    const base = buildUniPushToolbarDisabledReason(t, {
      selectedCount: selectedRowKeys.length,
      hasSelectedRecord: !!selectedOwoForToolbar,
    });
    if (base) return base;
    if (selectedOwoForToolbar && !canPushOutboundToolbar && !canPushInboundToolbar) {
      return (
        outsourceWorkOrderCapabilityReasonMessage(
          selectedOwoForToolbar.capabilities?.push_outsource_issue?.reason
            || selectedOwoForToolbar.capabilities?.push_outsource_receipt?.reason,
          t,
        ) || t('components.uniPush.disabled.unavailable')
      );
    }
    return undefined;
  }, [canPushInboundToolbar, canPushOutboundToolbar, selectedOwoForToolbar, selectedRowKeys.length, t]);

  const toolbarPushMenuItems = useMemo(
    () =>
      buildUniPushMenuItems([
        {
          key: 'push-outbound',
          label: pushToOutboundAction.label,
          disabled: !selectedOwoForToolbar || !canPushOutboundToolbar,
          title: selectedOwoForToolbar && !canPushOutboundToolbar
            ? outsourceWorkOrderCapabilityReasonMessage(
                selectedOwoForToolbar.capabilities?.push_outsource_issue?.reason,
                t,
              )
            : undefined,
          onClick: () => {
            if (selectedOwoForToolbar && canPushOutboundToolbar) {
              handlePushToOutboundEntry(selectedOwoForToolbar);
            }
          },
        },
        {
          key: 'push-inbound',
          label: pushToInboundAction.label,
          disabled: !selectedOwoForToolbar || !canPushInboundToolbar,
          title: selectedOwoForToolbar && !canPushInboundToolbar
            ? outsourceWorkOrderCapabilityReasonMessage(
                selectedOwoForToolbar.capabilities?.push_outsource_receipt?.reason,
                t,
              )
            : undefined,
          onClick: () => {
            if (selectedOwoForToolbar && canPushInboundToolbar) {
              handlePushToInboundEntry(selectedOwoForToolbar);
            }
          },
        },
      ]),
    [
      canPushInboundToolbar,
      canPushOutboundToolbar,
      pushToInboundAction.label,
      pushToOutboundAction.label,
      selectedOwoForToolbar,
      t,
    ],
  );

  const renderOwoRowActionNodes = (record: OutsourceWorkOrder): React.ReactNode[] => {
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
          void handleEdit(record);
        }}
      >
        {t('common.edit')}
      </Button>
    );
    if (record.status === 'draft') {
      nodes.push(
        <Button
          {...rowActionKind('submit')}
          key="release"
          type="link"
          size="small"
          icon={<SendOutlined />}
          onClick={(e) => {
            e.stopPropagation();
            void handleRelease(record);
          }}
        >
          {t('app.kuaizhizao.outsourceWorkOrder.actionRelease')}
        </Button>,
      );
    }
    if (record.capabilities?.cancel?.allowed === true) {
      nodes.push(
        <Button
          {...rowActionKind('revoke')}
          key="cancel"
          type="link"
          size="small"
          danger
          icon={<CloseCircleOutlined />}
          onClick={(e) => {
            e.stopPropagation();
            handleCancel(record);
          }}
        >
          {t('app.kuaizhizao.outsourceWorkOrder.actionCancel')}
        </Button>,
      );
    }
    if (record.capabilities?.close?.allowed === true) {
      nodes.push(
        <Button
          {...rowActionKind('approve')}
          key="close"
          type="link"
          size="small"
          icon={<StopOutlined />}
          onClick={(e) => {
            e.stopPropagation();
            openCloseModal(record);
          }}
        >
          {t('app.kuaizhizao.outsourceWorkOrder.actionClose')}
        </Button>,
      );
    }
    return nodes;
  };

  const owoCustomFieldColumns = generateOwoCustomFieldColumns();
  const outsourceWorkOrderLifecycleValueEnum = useMemo(
    () => buildOutsourceWorkOrderLifecycleValueEnum(t),
    [t],
  );
  const supplierSearchValueEnum = useMemo(
    () =>
      Object.fromEntries(
        supplierList.map((s: { id: number; name?: string; code?: string }) => [
          String(s.id),
          { text: s.name || s.code || String(s.id) },
        ]),
      ),
    [supplierList],
  );
  const prioritySearchValueEnum = useMemo(
    () => Object.fromEntries(priorityOptions.map((opt) => [opt.value, { text: opt.label }])),
    [priorityOptions],
  );

  const columns: ProColumns<OutsourceWorkOrder>[] = useMemo(
    () => alignProColumns<OutsourceWorkOrder>([
      {
        title: t('app.kuaizhizao.outsourceWorkOrder.colPlannedStart'),
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
        title: t('app.kuaizhizao.outsourceWorkOrder.colCode'),
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
        title: t('app.kuaizhizao.outsourceWorkOrder.colName'),
        dataIndex: 'name',
        width: 200,
        ellipsis: true,
        sorter: true,
        hideInTable: true,
        hideInSearch: false,
      },
      {
        title: t('app.kuaizhizao.outsourceWorkOrder.colProduct'),
        key: 'product_stacked',
        dataIndex: 'product_name',
        ...UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
        sorter: true,
        hideInSearch: true,
        render: (_, record) => (
          <MaterialStackedCell
            material_name={record.productName || record.product_name}
            material_code={record.productCode || record.product_code}
          />
        ),
      },
      {
        title: t('app.kuaizhizao.outsourceWorkOrder.colProductCode'),
        dataIndex: 'product_code',
        width: 128,
        ellipsis: true,
        sorter: true,
        hideInTable: true,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.outsourceWorkOrder.colProductName'),
        dataIndex: 'product_name',
        width: 200,
        ellipsis: true,
        sorter: true,
        hideInTable: true,
        hideInSearch: false,
      },
      {
        title: `${t('app.kuaizhizao.outsourceWorkOrder.colSupplier')} / ${t('app.kuaizhizao.outsourceWorkOrder.colCode')}`,
        key: 'supplier_code_stacked',
        dataIndex: 'supplier_name',
        fixed: 'left',
        minWidth: 180,
        uniTablePrimaryFlex: true,
        resizable: false,
        ellipsis: false,
        hideInSearch: true,
        render: (_, record) => (
          <UniTableStackedPrimaryCell
            primary={String(record.supplierName || record.supplier_name || '').trim() || '-'}
            secondary={String(record.code || '').trim() || '-'}
          />
        ),
      },
      {
        title: t('app.kuaizhizao.outsourceWorkOrder.colSupplier'),
        dataIndex: 'supplier_id',
        width: 150,
        ellipsis: true,
        hideInTable: true,
        hideInSearch: false,
        valueType: 'select',
        valueEnum: supplierSearchValueEnum,
      },
      {
        title: t('app.kuaizhizao.outsourceWorkOrder.colOperation'),
        dataIndex: 'outsource_operation',
        width: 150,
        ellipsis: true,
        sorter: true,
        hideInTable: true,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.outsourceWorkOrder.colQuantity'),
        dataIndex: 'quantity',
        width: 100,
        sorter: true,
        hideInSearch: true,
        render: (_, record) => (formatQuantity(record.quantity)),
      },
      {
        title: t('app.kuaizhizao.outsourceWorkOrder.colUnitPrice'),
        dataIndex: 'unit_price',
        width: 100,
        sorter: true,
        hideInSearch: true,
        render: (_, record) => {
          const price = record.unitPrice || record.unit_price;
          return price != null && !(typeof price === 'string' && price === '') ? (
            <AmountDisplay resource={OO} fieldName="unit_price" value={Number(price)} />
          ) : (
            '-'
          );
        },
      },
      {
        title: t('app.kuaizhizao.outsourceWorkOrder.colTotalAmount'),
        dataIndex: 'total_amount',
        width: 120,
        sorter: true,
        hideInSearch: true,
        render: (_, record) => {
          const amount = record.totalAmount || record.total_amount;
          return amount != null && !(typeof amount === 'string' && amount === '') ? (
            <AmountDisplay resource={OO} fieldName="total_amount" value={Number(amount)} />
          ) : (
            '-'
          );
        },
      },
      {
        title: t('app.kuaizhizao.outsourceWorkOrder.colPriority'),
        dataIndex: 'priority',
        width: 100,
        hideInSearch: false,
        valueType: 'select',
        valueEnum: prioritySearchValueEnum,
        render: (_, record) => getOwoPriorityTag(record.priority),
      },
      {
        title: t('app.kuaizhizao.outsourceWorkOrder.colIssuedQty'),
        dataIndex: ['issuedQuantity', 'issued_quantity'],
        width: 100,
        render: (_, record) => {
          const qty = record.issuedQuantity || record.issued_quantity;
          return formatQuantity(qty);
        },
      },
      {
        title: t('app.kuaizhizao.outsourceWorkOrder.colReceivedQty'),
        dataIndex: ['receivedQuantity', 'received_quantity'],
        width: 100,
        render: (_, record) => {
          const qty = record.receivedQuantity || record.received_quantity;
          return formatQuantity(qty);
        },
      },
      {
        title: t('app.kuaizhizao.outsourceWorkOrder.colQualifiedQty'),
        dataIndex: ['qualifiedQuantity', 'qualified_quantity'],
        width: 100,
        render: (_, record) => {
          const qty = record.qualifiedQuantity || record.qualified_quantity;
          return formatQuantity(qty);
        },
      },
      {
        title: t('app.kuaizhizao.outsourceWorkOrder.colPlannedRange'),
        key: 'planned_range_stacked',
        dataIndex: 'planned_start_date',
        width: 132,
        uniTableKeepWidth: true,
        sorter: true,
        hideInSearch: true,
        render: (_, record) => {
          const start = record.plannedStartDate || record.planned_start_date;
          const end = record.plannedEndDate || record.planned_end_date;
          return (
            <UniTableStackedPrimaryCell
              primary={start ? formatDateTime(start, 'YYYY-MM-DD HH:mm:ss') : '-'}
              secondary={end ? formatDateTime(end, 'YYYY-MM-DD HH:mm:ss') : '-'}
              secondaryCopyable={false}
              uniformText
              primaryBadge={t('common.start')}
              secondaryBadge={t('common.end')}
            />
          );
        },
      },
      {
        title: t('app.kuaizhizao.outsourceWorkOrder.colPlannedStart'),
        dataIndex: 'planned_start_date',
        valueType: 'dateTime',
        width: 132,
        uniTableKeepWidth: true,
        sorter: true,
        hideInTable: true,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.outsourceWorkOrder.colPlannedEnd'),
        dataIndex: 'planned_end_date',
        valueType: 'dateTime',
        width: 132,
        uniTableKeepWidth: true,
        sorter: true,
        hideInTable: true,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.salesManagement.pushProgress.title'),
        dataIndex: 'downstream_push_progress',
        width: DOCUMENT_PROGRESS_COLUMN_WIDTH,
        uniTableKeepWidth: true,
        hideInSearch: true,
        render: (_, record) => {
          const percent = outsourceWorkOrderPushPercent(record);
          return (
            <DocumentPushProgressBar
              percent={percent}
              tooltip={t('app.kuaizhizao.salesManagement.pushProgress.percentOnly', {
                percent: Math.round(percent),
              })}
            />
          );
        },
      },
      ...buildDocumentAuditColumns<OutsourceWorkOrder>(t),
      {
        title: t('app.kuaizhizao.outsourceWorkOrder.colLifecycle'),
        dataIndex: 'status',
        width: 140,
        fixed: 'right',
        hideInSearch: false,
        valueType: 'select',
        valueEnum: outsourceWorkOrderLifecycleValueEnum,
        render: (_, record) => {
          const lifecycle = getOutsourceWorkOrderLifecycle(record as Record<string, unknown>);
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
      ...owoCustomFieldColumns,
      {
        title: t('common.actions'),
        width: 200,
        fixed: 'right',
        hideInSearch: true,
        render: (_, record) =>
          renderOwoRowActions(renderOwoRowActionNodes(record), `owo-${record.id ?? 'row'}`),
      },
    ], SALES_DOC_LIST_FIELD_RANK),
    [getOwoPriorityTag, owoCustomFieldColumns, outsourceWorkOrderLifecycleValueEnum, prioritySearchValueEnum, supplierSearchValueEnum, t],
  );

  const handleWorkOrderListRequest = async (
    params: any,
    sort: Record<string, 'ascend' | 'descend' | null>,
    _filter: Record<string, React.ReactText[] | null>,
    searchFormValues?: Record<string, unknown>,
  ) => {
    try {
      const s = searchFormValues ?? {};
      const lifecycleParams = resolveOutsourceWorkOrderListLifecycleParams(s);
      const { sortBy, sortOrder } = extractProTableSort(sort);
      const orderBy =
        sortBy && sortOrder ? (sortOrder === 'desc' ? `-${sortBy}` : sortBy) : undefined;
      const fuzzyKeyword = typeof s.keyword === 'string' ? s.keyword.trim() : '';

      const apiParams: Parameters<typeof outsourceWorkOrderApi.list>[0] = {
        skip: ((params.current ?? 1) - 1) * (params.pageSize ?? 20),
        limit: params.pageSize ?? 20,
        ...lifecycleParams,
        order_by: orderBy,
        priority: s.priority as string | undefined,
      };

      if (fuzzyKeyword) {
        apiParams.keyword = fuzzyKeyword;
      } else {
        if (s.code != null && String(s.code).trim()) {
          apiParams.code = String(s.code).trim();
        }
        if (s.name != null && String(s.name).trim()) {
          apiParams.name = String(s.name).trim();
        }
        if (s.product_name != null && String(s.product_name).trim()) {
          apiParams.product_name = String(s.product_name).trim();
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

      const response = await outsourceWorkOrderApi.list(apiParams);
      const list = response.data ?? [];
      const enriched = await enrichOwoRecordsWithCustomFields(list);
      tableRowsRef.current = enriched;
      return {
        data: enriched,
        success: response.success,
        total: response.total ?? 0,
      };
    } catch (error) {
      console.error('获取工单委外列表失败:', error);
      messageApi.error(t('app.kuaizhizao.outsourceWorkOrder.fetchListFailed'));
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
        title: t('app.kuaizhizao.outsourceWorkOrder.statTotal'),
        value: localStats.total,
        valueStyle: { color: token.colorPrimary },
        backgroundChart: <SimpleSparkline data={OWO_STAT_SPARK_1} color={token.colorPrimary} />,
      },
      {
        title: t('app.kuaizhizao.outsourceWorkOrder.statDraft'),
        value: localStats.draft,
        valueStyle: { color: token.colorWarning },
        backgroundChart: <SimpleSparkline data={OWO_STAT_SPARK_2} color={token.colorWarning} />,
      },
      {
        title: t('app.kuaizhizao.outsourceWorkOrder.statInProgress'),
        value: localStats.inProgress,
        valueStyle: { color: token.colorSuccess },
        backgroundChart: <SimpleSparkline data={OWO_STAT_SPARK_3} color={token.colorSuccess} />,
      },
    ],
    [localStats.draft, localStats.inProgress, localStats.total, t, token.colorPrimary, token.colorSuccess, token.colorWarning],
  );

  return (
    <>
      <ListPageTemplate statCards={statCards}>
        <UniTable<OutsourceWorkOrder>
          headerTitle={t('app.kuaizhizao.outsourceWorkOrder.title')}
          columnPersistenceId="apps.kuaizhizao.pages.production-execution.outsource-work-orders.v2"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          showAdvancedSearch={true}
          skipFuzzyPinyinClientFilter
          pinnedTabsField="status"
          pinnedTabsValueEnum={outsourceWorkOrderLifecycleValueEnum}
          request={handleWorkOrderListRequest}
          enableRowSelection={true}
          selectedRowKeys={selectedRowKeys}
          onRowSelectionChange={setSelectedRowKeys}
          showCreateButton={true}
          createButtonText={createButtonLabel}
          onCreate={handleCreate}
          toolBarRender={() => [
            <UniPushToolbarButton
              key={`outsource-work-order-push-${selectedOwoForToolbar?.id ?? 'none'}`}
              menuItems={toolbarPushMenuItems}
              disabled={selectedRowKeys.length !== 1 || !selectedOwoForToolbar}
              disabledReason={toolbarPushDisabledReason}
            />,
          ]}
          showDeleteButton={true}
          onDelete={handleDelete}
          deleteConfirmTitle={(count) => t('app.kuaizhizao.outsourceWorkOrder.confirmBatchDelete', { count })}
          scroll={{ x: 2000 }}
        />
      </ListPageTemplate>

      {/* 创建/编辑工单委外：产品+供应商 12+12；数量/单价/金额/优先级 6+6+6+6 */}
      <FormModalTemplate
        title={isEdit ? t('app.kuaizhizao.outsourceWorkOrder.editTitle') : t('app.kuaizhizao.outsourceWorkOrder.createTitle')}
        open={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setCurrentWorkOrder(null);
          setSelectedMaterialSourceInfo(null);
          resetOwoFormFieldValues();
          formRef.current?.resetFields();
        }}
        onFinish={handleSubmit}
        isEdit={isEdit}
        initialValues={isEdit && currentWorkOrder ? { ...currentWorkOrder, productId: currentWorkOrder.productId ?? currentWorkOrder.product_id, supplierId: currentWorkOrder.supplierId ?? currentWorkOrder.supplier_id } : undefined}
        width={MODAL_CONFIG.LARGE_WIDTH}
        grid={true}
        formRef={formRef}
      >
        {!isEdit && (
          <CodeField
            pageCode="kuaizhizao-production-outsource-work-order"
            name="code"
            label={t('app.kuaizhizao.outsourceWorkOrder.fieldCode')}
            autoGenerateOnCreate={true}
            showGenerateButton={false}
            context={{}}
            colProps={{ span: 12 }}
          />
        )}
        <ProFormText
          name="name"
          label={t('app.kuaizhizao.outsourceWorkOrder.fieldName')}
          placeholder={t('app.kuaizhizao.outsourceWorkOrder.placeholderName')}
          disabled={isEdit}
          colProps={{ span: isEdit ? 24 : 12 }}
        />
        <ProFormSelect
          name="productId"
          label={t('app.kuaizhizao.outsourceWorkOrder.fieldProduct')}
          placeholder={t('app.kuaizhizao.outsourceWorkOrder.placeholderProduct')}
          rules={[{ required: true, message: t('app.kuaizhizao.outsourceWorkOrder.ruleSelectProduct') }]}
          colProps={{ span: 12 }}
          options={productList.map((product: any) => ({
            label: `${product.code || product.mainCode || ''} - ${product.name || ''}`.trim() || String(product.id),
            value: product.id,
          }))}
          fieldProps={{
            showSearch: true,
            allowClear: true,
            disabled: isEdit,
            optionFilterProp: 'label',
            onChange: (value) => handleProductChange(value),
            style: { width: '100%' },
          }}
        />
        <ProFormSelect
          name="supplierId"
          label={t('app.kuaizhizao.outsourceWorkOrder.fieldSupplier')}
          placeholder={t('app.kuaizhizao.outsourceWorkOrder.placeholderSupplier')}
          rules={[{ required: true, message: t('app.kuaizhizao.outsourceWorkOrder.ruleSelectSupplier') }]}
          colProps={{ span: 12 }}
          options={supplierList.map((supplier: any) => ({
            label: `${supplier.code ?? supplier.supplier_code ?? ''} - ${supplier.name ?? supplier.supplier_name ?? ''}`.trim() || String(supplier.id),
            value: supplier.id,
          }))}
          fieldProps={{
            showSearch: true,
            allowClear: true,
            disabled: isEdit,
            optionFilterProp: 'label',
            style: { width: '100%' },
          }}
        />
        {selectedMaterialSourceInfo && (
          /* 裸 Col：避免 ProFormItem colProps 与栅格行错位导致左侧裁切 */
          <Col span={24}>
            <div
              style={{
                padding: 12,
                marginBottom: 24,
                background: token.colorFillAlter,
                borderRadius: token.borderRadius,
                border: `1px solid ${token.colorBorderSecondary}`,
              }}
            >
              <div style={{ marginBottom: 8 }}>
                <span style={{ fontWeight: 600 }}>{t('app.kuaizhizao.outsourceWorkOrder.materialSourceType')}</span>
                <Tag color="cyan" style={{ marginInlineStart: 8 }}>
                  {selectedMaterialSourceInfo.sourceTypeName || selectedMaterialSourceInfo.sourceType || t('app.kuaizhizao.outsourceWorkOrder.materialSourceNotConfigured')}
                </Tag>
              </div>
              {selectedMaterialSourceInfo.validationErrors && selectedMaterialSourceInfo.validationErrors.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  {selectedMaterialSourceInfo.validationErrors.map((err, index) => (
                    <div key={index} style={{ color: token.colorError, marginBottom: 4 }}>
                      {'\u00D7 '}{err}
                    </div>
                  ))}
                </div>
              )}
              {selectedMaterialSourceInfo.canCreateWorkOrder === false && (
                <div style={{ marginTop: 8, color: token.colorError, fontWeight: 600 }}>
                  {t('app.kuaizhizao.outsourceWorkOrder.materialSourceNotAllowedHint')}
                </div>
              )}
              {selectedMaterialSourceInfo.canCreateWorkOrder && (
                <div style={{ marginTop: 8, color: token.colorSuccess }}>
                  {t('app.kuaizhizao.outsourceWorkOrder.materialSourceValidationPass')}
                  {selectedMaterialSourceInfo.supplierName && (
                    <span style={{ marginInlineStart: 16 }}>
                      {t('app.kuaizhizao.outsourceWorkOrder.defaultSupplier')}{selectedMaterialSourceInfo.supplierName}
                    </span>
                  )}
                  {selectedMaterialSourceInfo.outsourceOperation && (
                    <span style={{ marginInlineStart: 16 }}>
                      {t('app.kuaizhizao.outsourceWorkOrder.outsourceOperationLabel')}
                      {selectedMaterialSourceInfo.outsourceOperationName
                        || selectedMaterialSourceInfo.outsourceOperation}
                    </span>
                  )}
                  {selectedMaterialSourceInfo.unitPrice != null && (
                    <span style={{ marginInlineStart: 16 }}>
                      {t('app.kuaizhizao.outsourceWorkOrder.fieldUnitPrice')}：
                      <AmountDisplay resource={OO} fieldName="unit_price" value={Number(selectedMaterialSourceInfo.unitPrice)} />
                    </span>
                  )}
                </div>
              )}
            </div>
          </Col>
        )}
        <ProFormDigit
          name="quantity"
          label={t('app.kuaizhizao.outsourceWorkOrder.fieldQuantity')}
          placeholder={t('app.kuaizhizao.outsourceWorkOrder.placeholderQuantity')}
          min={0}
          precision={2}
          rules={[{ required: true, message: t('app.kuaizhizao.outsourceWorkOrder.ruleEnterQuantity') }]}
          fieldProps={{
            style: { width: '100%' },
          }}
          colProps={{ span: 6 }}
        />
        <ProFormDigit
          name="unitPrice"
          label={t('app.kuaizhizao.outsourceWorkOrder.fieldUnitPrice')}
          placeholder={t('app.kuaizhizao.outsourceWorkOrder.placeholderUnitPrice')}
          min={0}
          precision={2}
          fieldProps={{
            style: { width: '100%' },
          }}
          colProps={{ span: 6 }}
        />
        <Col span={6}>
          <Form.Item label={t('app.kuaizhizao.outsourceWorkOrder.fieldTotalAmount')}>
            <OutsourceTotalAmountReadonly />
          </Form.Item>
        </Col>
        <ProFormSelect
          name="priority"
          label={t('app.kuaizhizao.outsourceWorkOrder.fieldPriority')}
          initialValue="normal"
          placeholder={t('app.kuaizhizao.outsourceWorkOrder.placeholderPriority')}
          colProps={{ span: 6 }}
          options={priorityOptions}
          fieldProps={{
            showSearch: true,
            allowClear: true,
            loading: priorityLoading,
            optionFilterProp: 'label',
            style: { width: '100%' },
          }}
        />
        <ProFormDatePicker
          name="plannedStartDate"
          label={t('app.kuaizhizao.outsourceWorkOrder.fieldPlannedStart')}
          placeholder={t('app.kuaizhizao.outsourceWorkOrder.placeholderPlannedStart')}
          formItemProps={formDateFormItemProps}
          fieldProps={{ style: { width: '100%' } }}
          colProps={{ span: 12 }}
        />
        <ProFormDatePicker
          name="plannedEndDate"
          label={t('app.kuaizhizao.outsourceWorkOrder.fieldPlannedEnd')}
          placeholder={t('app.kuaizhizao.outsourceWorkOrder.placeholderPlannedEnd')}
          formItemProps={formDateFormItemProps}
          fieldProps={buildFutureDateShortcutFieldProps({
            getForm: () => formRef.current,
            fieldName: 'plannedEndDate',
            baseFieldName: 'plannedStartDate',
            t,
            fieldProps: { style: { width: '100%' } },
          })}
          colProps={{ span: 12 }}
        />

        <CustomFieldsFormSection
          customFields={owoFormCustomFields}
          customFieldValues={owoFormCustomFieldValues}
          gridColumns={2}
        />

        <DocumentAttachmentsField category="outsource_work_order_attachments" />

        <ProFormTextArea
          name="remarks"
          label={t('app.kuaizhizao.common.fieldNotes')}
          placeholder={t('app.kuaizhizao.outsourceWorkOrder.placeholderRemarks')}
          fieldProps={{
            rows: 4,
          }}
          colProps={{ span: 24 }}
        />
      </FormModalTemplate>

      <DetailDrawerTemplate
        title={`${t('app.kuaizhizao.outsourceWorkOrder.detailTitle')}${workOrderDetail?.code ? ` - ${workOrderDetail.code}` : ''}`}
        open={drawerVisible}
        zIndex={outsourceWorkOrderDetailDrawerZIndex}
        onClose={() => {
          setDrawerVisible(false);
          setWorkOrderDetail(null);
          resetOwoDetailFieldValues();
        }}
        width={DRAWER_CONFIG.HALF_WIDTH}
        columns={[]}
        column={3}
        dataSource={workOrderDetail || undefined}
        extra={
          workOrderDetail ? (
            <Space>
              {workOrderDetail.status === 'draft' ? (
                <Button type="primary" icon={<SendOutlined />} onClick={() => void handleRelease(workOrderDetail)}>
                  {t('app.kuaizhizao.outsourceWorkOrder.actionRelease')}
                </Button>
              ) : null}
              {workOrderDetail.capabilities?.cancel?.allowed === true ? (
                <Button danger icon={<CloseCircleOutlined />} onClick={() => handleCancel(workOrderDetail)}>
                  {t('app.kuaizhizao.outsourceWorkOrder.actionCancel')}
                </Button>
              ) : null}
              {workOrderDetail.capabilities?.close?.allowed === true ? (
                <Button icon={<StopOutlined />} onClick={() => openCloseModal(workOrderDetail)}>
                  {t('app.kuaizhizao.outsourceWorkOrder.actionClose')}
                </Button>
              ) : null}
            </Space>
          ) : null
        }
        customContent={
          workOrderDetail && (
            <>
              <DetailDrawerSection title={t('app.uniDetail.sectionBasic')}>
                <Descriptions
                  column={3}
                  size="small"
                  items={buildDescriptionItemsFromColumns(workOrderDetail, detailBaseColumns)}
                />
                {hasCustomFieldsDetailContent(owoListCustomFields, owoDetailCustomFieldValues) ? (
                  <div style={{ marginTop: 16 }}>
                    <CustomFieldsDetailSection
                      customFields={owoListCustomFields}
                      customFieldValues={owoDetailCustomFieldValues}
                    />
                  </div>
                ) : null}
                <Descriptions
                  column={3}
                  size="small"
                  style={{ marginTop: 16 }}
                  items={buildDescriptionItemsFromColumns(workOrderDetail, [detailRemarksColumn])}
                />
              </DetailDrawerSection>

              <DetailDrawerSection title={t('app.uniDetail.sectionCollaboration')}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {(() => {
                    const lifecycle = getOutsourceWorkOrderLifecycle(workOrderDetail as Record<string, unknown>);
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
                  {workOrderDetail.id != null ? (
                    <DetailDrawerInlineFullChain
                      documentType='outsource_work_order'
                      documentId={workOrderDetail.id}
                      active={drawerVisible}
                      selfDocumentId={workOrderDetail.id}
                      renderBriefActions={(doc) => (
                  <WarehouseTraceBriefPrimaryActions
                    doc={doc}
                    t={t}
                    navigate={navigate}
                    closeDrawer={() => {
                      setDrawerVisible(false);
                      setWorkOrderDetail(null);
                    }}
                  />
                )}
                    />
                  ) : null}
                </div>
              </DetailDrawerSection>

              <DetailDrawerSection title={t('app.uniDetail.sectionLines')}>
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('app.kuaizhizao.outsourceWorkOrder.noLineItems')} />
              </DetailDrawerSection>

              <DetailDrawerSection title={t('app.uniDetail.sectionTimeline')}>
                {outsourceWorkOrderTracking.loading && (
                  <div style={{ textAlign: 'center', padding: 24 }}>
                    <Spin />
                  </div>
                )}
                {outsourceWorkOrderTracking.error && !outsourceWorkOrderTracking.loading && (
                  <Typography.Text type="danger">{outsourceWorkOrderTracking.error}</Typography.Text>
                )}
                {outsourceWorkOrderTracking.data && !outsourceWorkOrderTracking.loading && (
                  <DocumentTrackingTimelineBody data={outsourceWorkOrderTracking.data} />
                )}
                {!outsourceWorkOrderTracking.loading && !outsourceWorkOrderTracking.data && !outsourceWorkOrderTracking.error && (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('components.documentTrackingPanel.noOperations')} />
                )}
              </DetailDrawerSection>
            </>
          )
        }
      />

      <Modal
        title={pushPreviewTitle}
        open={pushPreviewOpen}
        destroyOnClose
        width={MODAL_CONFIG.EXTRA_LARGE_WIDTH}
        onCancel={resetPushPreview}
        okText={t('common.next')}
        cancelText={t('common.cancel')}
        onOk={() => handlePushPreviewConfirm()}
        okButtonProps={{
          disabled:
            pushPreviewLoading ||
            !pushPreviewData ||
            !!pushPreviewData?.has_blocking_issues ||
            !(pushPreviewData?.items || []).some((row) => Number(row.max_push_quantity ?? 0) > 0),
        }}
      >
        {pushPreviewLoading ? (
          <div style={{ minHeight: 120, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <Spin />
            <div style={{ color: 'var(--ant-color-primary)' }}>{t('app.kuaizhizao.salesOrder.loadingPreview')}</div>
          </div>
        ) : pushPreviewData ? (
          <div>
            <p style={{ marginBottom: 12, fontWeight: 500 }}>{pushPreviewData.summary}</p>
            {pushPreviewData.has_blocking_issues && pushPreviewData.blocking_reason ? (
              <Alert
                type="warning"
                showIcon
                style={{ marginBottom: 12 }}
                message={
                  outsourceWorkOrderCapabilityReasonMessage(pushPreviewData.blocking_reason, t) ||
                  pushPreviewData.blocking_reason
                }
              />
            ) : null}
            {pushPreviewData.items?.length > 0 ? (
              <Table
                size="small"
                dataSource={pushPreviewData.items}
                rowKey={(row) => String(row.item_id)}
                pagination={false}
                scroll={{ x: 960 }}
                rowSelection={
                  pushPreviewKind === 'outbound_issue'
                    ? {
                        selectedRowKeys: pushPreviewSelectedMaterialIds.map(String),
                        onChange: (keys) => setPushPreviewSelectedMaterialIds(keys.map((k) => Number(k))),
                        getCheckboxProps: (row) => ({
                          disabled: Number(row.max_push_quantity ?? 0) <= 0,
                        }),
                      }
                    : undefined
                }
                columns={[
                  { title: t('app.kuaizhizao.salesOrder.materialCode'), dataIndex: 'material_code', width: 130, ellipsis: true },
                  { title: t('app.kuaizhizao.salesOrder.materialName'), dataIndex: 'material_name', width: 160, ellipsis: true },
                  { title: t('app.kuaizhizao.salesOrder.quantity'), dataIndex: 'quantity', width: 90, align: 'right', render: formatQuantity },
                  {
                    title:
                      pushPreviewKind === 'outbound_issue'
                        ? t('app.kuaizhizao.warehouseOutbound.pull.colIssuedQty')
                        : t('app.kuaizhizao.salesOrder.colPushedQty'),
                    dataIndex: 'pushed_quantity',
                    width: 90,
                    align: 'right',
                    render: formatQuantity,
                  },
                  {
                    title:
                      pushPreviewKind === 'outbound_issue'
                        ? t('app.kuaizhizao.warehouseOutbound.pull.colPendingIssue')
                        : t('app.kuaizhizao.salesOrder.colPushableQty'),
                    dataIndex: 'max_push_quantity',
                    width: 90,
                    align: 'right',
                    render: formatQuantity,
                  },
                ]}
              />
            ) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  pushPreviewKind === 'outbound_issue'
                    ? t('app.kuaizhizao.warehouseOutbound.pull.osPreviewNoLines')
                    : t('app.kuaizhizao.warehouseInbound.pull.outsource.previewNoLines')
                }
              />
            )}
            {pushPreviewData.tip ? (
              <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>
                {pushPreviewData.tip}
              </Typography.Paragraph>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <Modal
        title={t('app.kuaizhizao.outsourceWorkOrder.actionClose')}
        open={closeModalOpen}
        destroyOnClose
        confirmLoading={closeSubmitting}
        okText={t('app.kuaizhizao.outsourceWorkOrder.actionClose')}
        cancelText={t('common.cancel')}
        onCancel={() => {
          if (closeSubmitting) return;
          setCloseModalOpen(false);
          setCloseModalRecord(null);
          setCloseReason('');
        }}
        onOk={() => void handleCloseConfirm()}
      >
        <Typography.Paragraph>{t('app.kuaizhizao.outsourceWorkOrder.confirmClose')}</Typography.Paragraph>
        <Input.TextArea
          rows={3}
          value={closeReason}
          onChange={(e) => setCloseReason(e.target.value)}
          placeholder={t('app.kuaizhizao.outsourceWorkOrder.closeReasonPlaceholder')}
        />
      </Modal>
    </>
  );
};

const OutsourceWorkOrdersPage: React.FC = () => {
  return <OutsourceWorkOrdersTable />;
};

export default OutsourceWorkOrdersPage;
