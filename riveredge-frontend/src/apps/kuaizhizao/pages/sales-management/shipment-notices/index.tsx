/**
 * 发货通知单管理页面
 *
 * 销售通知仓库发货，不直接动库存。来源为销售订单。
 * 参考销售订单排版布局，支持单据编号自动生成。
 *
 * @author RiverEdge Team
 * @date 2026-02-22
 */

import React, { useRef, useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import { rowActionKind } from '../../../../../components/uni-action';
import { UniWorkflowActions } from '../../../../../components/uni-workflow-actions';
import { createListAuditPhaseColumn } from '../shared/listAuditPhaseColumn';
import { useAuditRequired } from '../../../../../hooks/useAuditRequired';
import { useInvalidateMenuBadgeCounts } from '../../../../../hooks/useInvalidateMenuBadgeCounts';
import { useNavigate } from 'react-router-dom';
import { LinkedDocumentCode } from '../../../../../components/linked-document-code';
import { ActionType, ProColumns, ProDescriptionsItemProps, ProForm, ProFormText, ProFormDatePicker, ProFormTextArea, ProFormItem, ProFormInstance } from '@ant-design/pro-components';
import { App, Button, Space, Modal, Table, Form as AntForm, Select, InputNumber, Input, Row, Col, Typography, Dropdown, Spin, Empty, Descriptions, Alert } from 'antd';
import { PlusOutlined, EyeOutlined, EditOutlined, DeleteOutlined, SendOutlined, AppstoreAddOutlined, ImportOutlined, MoreOutlined, DownOutlined, PrinterOutlined } from '@ant-design/icons';
import { theme as AntdTheme } from 'antd';
import dayjs from 'dayjs';
import { UniTable, readPersistedUniTableViewType } from '../../../../../components/uni-table';
import {
  UniTableStackedPrimaryCell,
  UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
  MaterialStackedCell,
} from '../../../../../components/uni-table/stackedPrimaryColumn';
import { UniCapabilityBatchButton, UniAuditBatchMenuButton, createUniAuditBatchHandlers } from '../../../../../components/uni-batch';
import { UniMaterialSelect } from '../../../../../components/uni-material-select';
import { UniMaterialBatchPicker } from '../../../../../components/uni-material-batch-picker';
import { ThemedSegmented } from '../../../../../components/themed-segmented';
const LazyUniImport = lazy(() =>
  import('../../../../../components/uni-import').then((m) => ({ default: m.UniImport })),
);
import type { Material } from '../../../../master-data/types/material';
import { DocumentAmountSummaryWatch } from '../../../components/document-amount-summary/DocumentAmountSummary';
import { UniWarehouseSelect } from '../../../../../components/uni-warehouse-select';
import { ListPageTemplate, DetailDrawerTemplate, FormModalTemplate, DRAWER_CONFIG, MODAL_CONFIG,   useDetailDrawerDescriptionItems } from '../../../../../components/layout-templates';
import { UniPullCreateToolbar } from '../../../../../components/uni-pull';
import {
  UniPullQueryModal,
  isPullableScope,
  renderPullCapabilityTag,
  useUniPullQuery,
} from '../../../../../components/uni-pull-query';
import { UniTableDetail } from '../../../../../components/uni-table-detail';
import { shipmentNoticeApi, type ShipmentNotice, type ShipmentNoticeItem, type ShipmentNoticeNotifyPreviewResponse, type ShipmentNoticeListParams } from '../../../services/shipment-notice';
import {
  listSalesOrders,
  getSalesOrder,
  listSalesOrderShipmentNoticePullLines,
  pullShipmentNoticesFromSalesOrderItems,
  type SalesOrderShipmentPullLine,
} from '../../../services/sales-order';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import {
  shipmentNoticeBatchWithdrawAllowed,
  shipmentNoticeCapabilityReasonMessage,
} from '../../../../../hooks/useDocumentCapabilities';
import { LinkedOqcPanel } from '../../quality-management/components/LinkedInspectionPanel';
import { getShipmentNoticeLifecycle, buildShipmentNoticeLifecycleValueEnum, resolveShipmentNoticeListLifecycleParams } from '../../../utils/shipmentNoticeLifecycle';
import { UniLifecycleStepper } from '../../../../../components/uni-lifecycle';
import { LIST_LIFECYCLE_STAGE_FIELD } from '../../../../../utils/listLifecycleStage';
import { ListUniLifecycleCell } from '../shared/ListUniLifecycleCell';
import { DocumentPushProgressBar, DOCUMENT_PROGRESS_COLUMN_DEFAULTS, DETAIL_TABLE_PROGRESS_COLUMN_DEFAULTS } from '../shared/DocumentPushProgressBar';
import {
  collectShipmentOutboundPushDocuments,
  shipmentNoticeOutboundPushPercent,
} from '../shared/pushProgress';
import { alignProColumns, alignDescriptionColumns, SALES_DOC_LIST_FIELD_RANK } from '../shared/documentFieldAlignment';
import { buildDocumentAuditColumns } from '../../shared/documentAuditColumns';
import { flattenDocumentDetailRows, resolveDetailTableViewMode } from '../../shared/detailTableFlatRows';
import { DocumentTrackingTimelineBody, useDocumentTracking } from '../../../../../components/document-tracking-panel';
import { WarehouseTraceBriefPrimaryActions } from '../../warehouse-management/WarehouseTraceBriefFooter';
import { customerApi } from '../../../../master-data/services/supply-chain';
import { generateCode, testGenerateCode, getCodeRulePageConfig } from '../../../../../services/codeRule';
import { isAutoGenerateEnabled, getPageRuleCode } from '../../../../../utils/codeRulePage';
import { useTranslation } from 'react-i18next';
import { buildFactoryImportTemplate } from '../../../../../utils/spreadsheetImportTemplate';
import { useImportMaterialUnitOptions } from '../../../../master-data/hooks/useImportMaterialUnitOptions';
import { pickImportExampleValue } from '../../../../../utils/loadImportDictionaryValues';
import { buildFutureDateShortcutFieldProps } from '../../../../../utils/futureDatePickerShortcuts';
import { buildKuaizhizaoPullCreateMenuItems, resolveKuaizhizaoDocumentAction } from '../../../constants/documentActionRegistry';
import DocumentAttachmentsField from '../../../components/DocumentAttachmentsField';
import { mapAttachmentsToUploadList, normalizeDocumentAttachments } from '../../../utils/documentAttachments';
import { useKuaizhizaoPrintModal } from '../../../hooks/useKuaizhizaoPrintModal';
import { formatBusinessDateOnly, formatDateTime, formatQuantity, todaySiteDateString } from '../../../../../utils/format';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';
import { QuantityWithUnitDisplay } from '../../../../../components/quantity-with-unit';
import { extractProTableSort } from '../../../../../utils/tableQueryKey';
import { formDateRangeFormItemProps } from '../../../../../utils/formDate';
import { fetchAllListItems } from '../../../../../utils/fetchAllListPages';
import { downloadRecordsAsXlsx } from '../../../../../utils/exportRecordsXlsx';
import {
  referenceDisplayToIdOptions,
  searchReferenceDisplay,
} from '../../../../../utils/referenceDisplay';
import { getAntdModal } from '../../../../../utils/antdAppApis';

const SHIPMENT_NOTICE_RESOURCE = 'kuaizhizao:shipment-notice';

interface ShipmentNoticeDetail extends ShipmentNotice {
  items?: { id?: number; material_id?: number; material_code: string; material_name: string; material_unit: string; notice_quantity: number; unit_price?: number; total_amount?: number }[];
}

type ShipmentNoticeItemRow = ShipmentNoticeItem & {
  _rowKey: string;
  notice_id: number;
  notice_code?: string;
  customer_name?: string;
  sales_order_code?: string;
  warehouse_name?: string;
  planned_ship_date?: string;
  notified_at?: string;
  status?: string;
  sales_delivery_id?: number;
  lifecycle?: Record<string, unknown>;
};

const SHIPMENT_NOTICE_LIST_PERSISTENCE_ID =
  'apps.kuaizhizao.pages.sales-management.shipment-notices.list-v3';

type PullSalesOrderCandidate = SalesOrderShipmentPullLine;

const ShipmentNoticesPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { openPrint, PrintModal } = useKuaizhizaoPrintModal();
  const pullFromSalesOrderAction = resolveKuaizhizaoDocumentAction(t, 'shipment_notice.pull_from_sales_order');

  const materialUnitImport = useImportMaterialUnitOptions();
  const materialUnitImportOptions = materialUnitImport.options;

  const noticeItemImportTemplate = useMemo(
    () =>
      buildFactoryImportTemplate(
        t,
        [
          { field: 'material', labelKey: 'app.kuaizhizao.shipmentNotice.import.materialCode', aliases: ['产品编号'] },
          { field: 'quantity', labelKey: 'common.quantity', aliases: ['数量'] },
          { field: 'unitPrice', labelKey: 'app.kuaizhizao.shipmentNotice.import.unitPrice', aliases: ['单价'] },
          { field: 'name', labelKey: 'app.kuaizhizao.shipmentNotice.import.materialName', aliases: ['产品名称'] },
          { field: 'specification', labelKey: 'app.kuaizhizao.shipmentNotice.import.specification', aliases: ['规格'] },
          { field: 'unit', labelKey: 'common.unit', aliases: ['单位'], options: materialUnitImportOptions },
        ],
        [
          t('app.kuaizhizao.shipmentNotice.importExample.materialCode'),
          t('app.kuaizhizao.shipmentNotice.importExample.quantity'),
          t('app.kuaizhizao.shipmentNotice.importExample.unitPrice'),
          t('app.kuaizhizao.shipmentNotice.importExample.materialName'),
          t('app.kuaizhizao.shipmentNotice.importExample.specification'),
          pickImportExampleValue(materialUnitImportOptions, t('app.kuaizhizao.shipmentNotice.importExample.unit')),
        ],
      ),
    [t, i18n.language, materialUnitImportOptions],
  );
  const navigate = useNavigate();
  const salesOrderEntityName = t('app.kuaizhizao.salesOrder.entityName');
  const shipmentNoticeEntityName = t('app.kuaizhizao.shipmentNotice.entityName');
  const statusMap = useMemo(
    () => ({
      待审核: { text: t('app.kuaizhizao.salesContract.statusPending'), color: 'processing' },
      已驳回: { text: t('app.kuaizhizao.productionPlan.statusRejected'), color: 'error' },
      待发货: { text: t('app.kuaizhizao.shipmentNotice.statusPending'), color: 'default' },
      已通知: { text: t('app.kuaizhizao.shipmentNotice.statusNotified'), color: 'processing' },
      已出库: { text: t('app.kuaizhizao.shipmentNotice.statusShipped'), color: 'success' },
    }),
    [t, i18n.language],
  );
  const shipmentNoticeAuditEnabled = useAuditRequired('shipment_notice', false);
  const shipmentNoticeAuditColumn = useMemo(
    () => createListAuditPhaseColumn<ShipmentNotice>({ t, auditEnabled: shipmentNoticeAuditEnabled }),
    [t, shipmentNoticeAuditEnabled],
  );
  const defaultUnit = t('app.kuaizhizao.shipmentNotice.defaultUnit');
  const defaultNoticeItem = useMemo(
    () => ({
      material_id: undefined,
      material_code: '',
      material_name: '',
      material_spec: '',
      material_unit: defaultUnit,
      notice_quantity: 1,
      unit_price: 0,
    }),
    [defaultUnit],
  );
  const actionRef = useRef<ActionType>(null);
  const [viewTypeState, setViewTypeState] = useState<'table' | 'detailTable' | 'help'>(() =>
    readPersistedUniTableViewType(SHIPMENT_NOTICE_LIST_PERSISTENCE_ID, 'table', [
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
  const { message: messageApi } = App.useApp();
  const { token } = AntdTheme.useToken();
  const noticeDetailDrawerZIndex = token.zIndexPopupBase;
  const invalidateMenuBadgeCounts = useInvalidateMenuBadgeCounts();
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [noticeDetail, setNoticeDetail] = useState<ShipmentNoticeDetail | null>(null);
  const shipmentNoticePerms = useResourcePermissions(SHIPMENT_NOTICE_RESOURCE);
  const [trackingRefreshKey, setTrackingRefreshKey] = useState(0);

  const shipmentTracking = useDocumentTracking(
    detailDrawerVisible && noticeDetail?.id ? 'shipment_notice' : undefined,
    noticeDetail?.id,
    trackingRefreshKey,
  );

  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const createFormRef = useRef<any>(null);
  const editFormRef = useRef<any>(null);
  const [pendingEditFormValues, setPendingEditFormValues] = useState<Record<string, any> | null>(null);
  const [materialPickerOpen, setMaterialPickerOpen] = useState(false);
  const [productScope, setProductScope] = useState<'make' | 'all'>('make');
  const [customerList, setCustomerList] = useState<any[]>([]);
  const shipmentNoticeLifecycleValueEnum = useMemo(
    () => buildShipmentNoticeLifecycleValueEnum(t),
    [t],
  );
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

  const [salesOrderList, setSalesOrderList] = useState<any[]>([]);
  const [previewCode, setPreviewCode] = useState<string | null>(null);
  const [effectiveRuleCode, setEffectiveRuleCode] = useState<string | null>(null);
  const [importVisible, setImportVisible] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const tableRowsRef = useRef<ShipmentNotice[]>([]);

  const pullSourceOrderIdRef = useRef<number | undefined>(undefined);
  const [pullSourceOrderId, setPullSourceOrderId] = useState<number | undefined>();
  const [pullSourceOrderOptions, setPullSourceOrderOptions] = useState<Array<{ value: number; label: string }>>([]);

  const [notifyPreviewOpen, setNotifyPreviewOpen] = useState(false);
  const [notifyPreviewLoading, setNotifyPreviewLoading] = useState(false);
  const [notifyPreviewConfirming, setNotifyPreviewConfirming] = useState(false);
  const [notifyPreviewData, setNotifyPreviewData] = useState<ShipmentNoticeNotifyPreviewResponse | null>(null);
  const [notifyPreviewTarget, setNotifyPreviewTarget] = useState<ShipmentNotice | null>(null);
  const [notifyPreviewWarehouseId, setNotifyPreviewWarehouseId] = useState<number | undefined>();
  const [notifyPreviewWarehouseName, setNotifyPreviewWarehouseName] = useState('');
  const notifyPreviewWarehouseFormRef = useRef<ProFormInstance>();

  const selectedNoticesForBatch = useMemo(
    () =>
      selectedRowKeys
        .map((key) => tableRowsRef.current.find((row) => String(row.id) === String(key)))
        .filter((row): row is ShipmentNotice => row != null),
    [selectedRowKeys],
  );

  const shipmentNoticeAuditBatchHandlers = useMemo(
    () => createUniAuditBatchHandlers('shipment_notice'),
    [],
  );

  const handleShipmentNoticeAuditBatchSuccess = useCallback(() => {
    setSelectedRowKeys([]);
    invalidateMenuBadgeCounts();
    actionRef.current?.reload();
  }, [invalidateMenuBadgeCounts]);

  const isFormPage = createModalVisible || editModalVisible;

  useEffect(() => {
    if (!isFormPage) return;
    let cancelled = false;
    const load = async () => {
      try {
        const [cust, ordersRes] = await Promise.all([
          customerApi.list({ limit: 200, isActive: true }),
          listSalesOrders({ limit: 200, view: 'options' }).catch(() => ({
            data: [],
            total: 0,
            success: false,
          })),
        ]);
        if (cancelled) return;
        setCustomerList(Array.isArray(cust) ? cust : (cust as any)?.data || (cust as any)?.items || []);
        setSalesOrderList(ordersRes?.data || []);
      } catch (e) {
        if (!cancelled) {
          console.error(t('app.kuaizhizao.shipmentNotice.loadCustomersFailed'), e);
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [isFormPage, t]);

  const appendShipmentNoticeItemsFromMaterials = useCallback(
    (selected: Material[]) => {
      const current = createFormRef.current?.getFieldValue('items') ?? [];
      const newRows = selected.map((m) => ({
        material_id: m.id,
        material_code: m.mainCode ?? m.code ?? '',
        material_name: m.name ?? '',
        material_spec: m.specification ?? '',
        material_unit: m.baseUnit ?? defaultUnit,
        notice_quantity: 1,
        unit_price: (m as any).defaults?.defaultSalePrice ?? (m as any).defaults?.default_sale_price ?? 0,
      }));
      // 如果当前只有一行且未选择产品，则替换该行
      if (current.length === 1 && !current[0].material_id && !current[0].material_code) {
        createFormRef.current?.setFieldsValue({ items: newRows });
      } else {
        createFormRef.current?.setFieldsValue({ items: [...current, ...newRows] });
      }
      messageApi.success(t('app.kuaizhizao.common.materialBatchAdded', { count: selected.length }));
    },
    [defaultUnit, messageApi, t]
  );

  /**
   * 发货通知单明细汇总组件
   */
  const ShipmentNoticeFormSummary: React.FC = () => (
    <DocumentAmountSummaryWatch variant="basic" quantityField="notice_quantity" />
  );

  const columns: ProColumns<ShipmentNotice>[] = useMemo(
    () => alignProColumns<ShipmentNotice>([
    {
      title: t('app.kuaizhizao.shipmentNotice.colCustomerNotice'),
      key: 'notice_code',
      dataIndex: 'notice_code',
      ...UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
      fixed: 'left',
      sorter: true,
      fieldProps: { placeholder: t('app.kuaizhizao.shipmentNotice.colNoticeCode') },
      render: (_, record) => (
        <UniTableStackedPrimaryCell
          primary={String(record.customer_name ?? '')}
          secondary={String(record.notice_code ?? '')}
        />
      ),
    },
    {
      title: t('app.kuaizhizao.quotation.form.customer'),
      dataIndex: 'customer_id',
      hideInTable: true,
      valueType: 'select',
      fieldProps: {
        showSearch: true,
        filterOption: false,
        placeholder: t('app.kuaizhizao.quotation.form.customer'),
      },
      debounceTime: 300,
      request: async ({ keyWords }) => {
        const res = await searchReferenceDisplay({
          resource: 'master-data:supply-chain:customer',
          hostResource: 'kuaizhizao:shipment-notice',
          keyword: typeof keyWords === 'string' ? keyWords.trim() : undefined,
          pageSize: 20,
        });
        return referenceDisplayToIdOptions(res.items);
      },
    },
    {
      title: t('app.kuaizhizao.shipmentNotice.outboundWarehouse'),
      key: 'outbound_warehouse',
      dataIndex: 'warehouse_name',
      width: 140,
      ellipsis: true,
      uniTableKeepWidth: true,
      sorter: true,
      hideInSearch: true,
    },
    {
      title: t('app.kuaizhizao.shipmentNotice.salesOrderCode'),
      key: 'shipment_sales_order_code',
      dataIndex: 'sales_order_code',
      width: 180,
      minWidth: 180,
      uniTableKeepWidth: true,
      resizable: false,
      ellipsis: false,
      sorter: true,
      fieldProps: { placeholder: t('app.kuaizhizao.shipmentNotice.salesOrderCode') },
      render: (_, record) => (
        <LinkedDocumentCode
          documentType="sales_order"
          documentId={record.sales_order_id}
          code={record.sales_order_code}
        />
      ),
    },
    {
      title: t('app.kuaizhizao.shipmentNotice.deliveryConversion'),
      key: 'shipment_outbound_conversion',
      dataIndex: 'sales_delivery_code',
      width: 180,
      hideInSearch: true,
      render: (_, record) => {
        if (record.sales_delivery_id) {
          return (
            <UniTableStackedPrimaryCell
                record={record as Record<string, unknown>}
                secondaryKeys={['sales_delivery_code']}
                primary={t('app.kuaizhizao.shipmentNotice.pulledToOutbound')}
                secondary={String(record.sales_delivery_code || `#${record.sales_delivery_id}`)}
              />
          );
        }
        return (
          <UniTableStackedPrimaryCell
            primary={t('app.kuaizhizao.shipmentNotice.notPulledOutbound')}
            secondary="-"
            secondaryCopyable={false}
          />
        );
      },
    },
    {
      title: t('app.kuaizhizao.shipmentNotice.plannedShipDate'),
      dataIndex: 'planned_ship_date',
      width: 132,
      uniTableKeepWidth: true,
      sorter: true,
      hideInSearch: true,
      render: (_, record) =>
        record.planned_ship_date ? formatDateTime(record.planned_ship_date, 'YYYY-MM-DD') : '-',
    },
    {
      title: t('app.kuaizhizao.shipmentNotice.plannedShipDate'),
      dataIndex: 'planned_ship_date_range',
      valueType: 'dateRange',
      hideInTable: true,
      fieldProps: {
        placeholder: [t('app.kuaizhizao.quotation.dateRangeStart'), t('app.kuaizhizao.quotation.dateRangeEnd')],
      },
      formItemProps: formDateRangeFormItemProps,
    },
    {
      title: t('app.kuaizhizao.shipmentNotice.notifiedAt'),
      dataIndex: 'notified_at',
      width: 132,
      uniTableKeepWidth: true,
      sorter: true,
      hideInSearch: true,
      render: (_, record) =>
        record.notified_at ? formatDateTime(record.notified_at, 'YYYY-MM-DD HH:mm') : '-',
    },
    {
      title: t('app.kuaizhizao.salesManagement.pushProgress.title'),
      dataIndex: 'outbound_push_progress',
      ...DOCUMENT_PROGRESS_COLUMN_DEFAULTS,
      render: (_, record) => {
        const percent = shipmentNoticeOutboundPushPercent(record);
        return (
          <DocumentPushProgressBar
            percent={percent}
            tooltip={t('app.kuaizhizao.salesManagement.pushProgress.outboundTooltip', {
              percent,
              status: percent >= 100
                ? t('app.kuaizhizao.salesManagement.pushProgress.pushed')
                : t('app.kuaizhizao.salesManagement.pushProgress.notPushed'),
            })}
            documents={collectShipmentOutboundPushDocuments(
              record,
              t('components.documentTrackingPanel.docType.sales_delivery'),
            )}
            formatMoreDocs={(count) =>
              t('app.kuaizhizao.salesManagement.pushProgress.moreDocs', { count })
            }
          />
        );
      },
    },
    ...buildDocumentAuditColumns<ShipmentNotice>(t),
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
    shipmentNoticeAuditColumn,
    {
      title: t('app.kuaizhizao.salesOrder.lifecycle'),
      dataIndex: LIST_LIFECYCLE_STAGE_FIELD,
      fixed: 'right',
      valueType: 'select',
      valueEnum: shipmentNoticeLifecycleValueEnum,
      render: (_, record) => (
        <ListUniLifecycleCell lifecycle={getShipmentNoticeLifecycle(record as any, t)} />
      ),
    },
    {
      title: t('common.actions'),
      fixed: 'right',
      hideInSearch: true,
      render: (_, record) => [
        <Button {...rowActionKind('read')} key="detail" onClick={() => handleDetail(record)}>{t('common.detail')}</Button>,
        record.capabilities?.update?.allowed && shipmentNoticePerms.canUpdate ? (
          <Button {...rowActionKind('update')} key="edit" onClick={() => handleEdit(record)}>{t('common.edit')}</Button>
        ) : null,
        record.capabilities?.notify?.allowed && shipmentNoticePerms.canUpdate ? (
          <Button {...rowActionKind('dispatch')} key="notify" icon={<SendOutlined />} onClick={() => handleNotify(record as ShipmentNotice)}>
            {t('app.kuaizhizao.shipmentNotice.notifyWarehouse')}
          </Button>
        ) : null,
        record.capabilities?.delete?.allowed && shipmentNoticePerms.canDelete ? (
          <Button {...rowActionKind('delete')} key="delete" onClick={() => handleDelete(record as ShipmentNotice)}>{t('common.delete')}</Button>
        ) : null,
        record.capabilities?.withdraw?.allowed && shipmentNoticePerms.canAction?.('revoke') ? (
          <Button {...rowActionKind('revoke')} key="withdraw" onClick={() => handleWithdraw(record as ShipmentNotice)}>{t('app.kuaizhizao.shipmentNotice.withdrawNotify')}</Button>
        ) : null,
      ].filter(Boolean),
    },
  ], SALES_DOC_LIST_FIELD_RANK),
    [
      t,
      shipmentNoticeAuditColumn,
      shipmentNoticeLifecycleValueEnum,
      shipmentNoticePerms.canDelete,
      shipmentNoticePerms.canUpdate,
      shipmentNoticePerms,
    ],
  );

  const detailTableColumns: ProColumns<ShipmentNoticeItemRow>[] = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.shipmentNotice.colCustomerNotice'),
        key: 'notice_code',
        dataIndex: 'notice_code',
        ...UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
        fixed: 'left',
        hideInSearch: false,
        fieldProps: { placeholder: t('app.kuaizhizao.shipmentNotice.colNoticeCode') },
        render: (_, record) => (
          <UniTableStackedPrimaryCell
            primary={String(record.customer_name ?? '')}
            secondary={String(record.notice_code ?? '')}
          />
        ),
      },
      {
        title: t('app.kuaizhizao.shipmentNotice.colNoticeCode'),
        dataIndex: 'notice_code',
        hideInTable: true,
      },
      {
        title: t('app.kuaizhizao.shipmentNotice.import.materialName'),
        key: 'material_display',
        dataIndex: 'material_name',
        ...UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
        render: (_, record) => (
          <MaterialStackedCell
            material_name={record.material_name}
            material_code={record.material_code}
            material_spec={record.material_spec}
          />
        ),
      },
      {
        title: t('app.kuaizhizao.shipmentNotice.import.materialCode'),
        dataIndex: 'material_code',
        hideInTable: true,
      },
      {
        title: t('common.quantity'),
        dataIndex: 'notice_quantity',
        width: 120,
        align: 'right',
        render: (val: unknown, record) => (
          <QuantityWithUnitDisplay quantity={val} unit={record.material_unit} />
        ),
      },
      {
        title: t('app.kuaizhizao.shipmentNotice.import.unitPrice'),
        dataIndex: 'unit_price',
        width: 100,
        align: 'right',
        render: (text: unknown) => (text != null ? Number(text).toFixed(2) : '-'),
      },
      {
        title: t('app.kuaizhizao.shipmentNotice.amount'),
        dataIndex: 'total_amount',
        width: 110,
        align: 'right',
        render: (text: unknown) => (text != null ? Number(text).toFixed(2) : '-'),
      },
      {
        title: t('app.kuaizhizao.shipmentNotice.plannedShipDate'),
        dataIndex: 'planned_ship_date',
        width: 132,
        uniTableKeepWidth: true,
        hideInSearch: true,
        render: (_: unknown, row) =>
          row.planned_ship_date ? formatDateTime(row.planned_ship_date, 'YYYY-MM-DD') : '-',
      },
      {
        title: t('app.kuaizhizao.shipmentNotice.notifiedAt'),
        dataIndex: 'notified_at',
        width: 132,
        uniTableKeepWidth: true,
        hideInSearch: true,
        render: (_: unknown, row) =>
          row.notified_at ? formatDateTime(row.notified_at, 'YYYY-MM-DD HH:mm') : '-',
      },
      {
        title: t('app.kuaizhizao.salesManagement.pushProgress.title'),
        key: 'line_outbound_progress',
        ...DETAIL_TABLE_PROGRESS_COLUMN_DEFAULTS,
        render: (_: unknown, record) => {
          const percent = shipmentNoticeOutboundPushPercent(record);
          return (
            <DocumentPushProgressBar
              percent={percent}
              tooltip={t('app.kuaizhizao.salesManagement.pushProgress.outboundTooltip', {
                percent,
                status: percent >= 100
                  ? t('app.kuaizhizao.salesManagement.pushProgress.pushed')
                  : t('app.kuaizhizao.salesManagement.pushProgress.notPushed'),
              })}
              documents={collectShipmentOutboundPushDocuments(
                record,
                t('components.documentTrackingPanel.docType.sales_delivery'),
              )}
              formatMoreDocs={(count) =>
                t('app.kuaizhizao.salesManagement.pushProgress.moreDocs', { count })
              }
            />
          );
        },
      },
      {
        title: t('app.kuaizhizao.salesOrder.lifecycle'),
        dataIndex: LIST_LIFECYCLE_STAGE_FIELD,
        fixed: 'right',
        hideInSearch: false,
        valueEnum: shipmentNoticeLifecycleValueEnum,
        render: (_, record) => (
          <ListUniLifecycleCell
            lifecycle={getShipmentNoticeLifecycle(record as Record<string, unknown>, t)}
          />
        ),
      },
    ],
    [shipmentNoticeLifecycleValueEnum, t],
  );

  const handleDetail = async (record: ShipmentNotice) => {
    try {
      const detail = await shipmentNoticeApi.get(record.id!.toString());
      setNoticeDetail(detail as ShipmentNoticeDetail);
      setDetailDrawerVisible(true);
      setTrackingRefreshKey((k) => k + 1);
    } catch {
      messageApi.error(t('app.kuaizhizao.shipmentNotice.detailFailed'));
    }
  };

  const handleEdit = async (record: ShipmentNotice) => {
    try {
      const detail = await shipmentNoticeApi.get(record.id!.toString()) as ShipmentNoticeDetail;
      const itemsForm = (detail.items || []).map((it: any) => ({
        material_id: it.material_id,
        material_code: it.material_code || '',
        material_name: it.material_name || '',
        material_spec: it.material_spec || '',
        material_unit: it.material_unit || '',
        notice_quantity: Number(it.notice_quantity) || 0,
        unit_price: Number(it.unit_price) || 0,
      }));
      setPendingEditFormValues({
        sales_order_id: detail.sales_order_id,
        sales_order_code: detail.sales_order_code,
        customer_id: detail.customer_id,
        customer_name: detail.customer_name,
        customer_contact: detail.customer_contact,
        customer_phone: detail.customer_phone,
        warehouse_id: detail.warehouse_id,
        warehouse_name: detail.warehouse_name,
        planned_ship_date: detail.planned_ship_date ? dayjs(detail.planned_ship_date) : undefined,
        shipping_address: detail.shipping_address,
        notes: detail.notes,
        attachments: mapAttachmentsToUploadList(detail.attachments),
        items: itemsForm.length ? itemsForm : [defaultNoticeItem],
      });
      setEditingId(record.id!);
      setEditModalVisible(true);
    } catch {
      messageApi.error(t('app.kuaizhizao.shipmentNotice.loadDetailFailed'));
    }
  };

  const executeNotify = useCallback(async (
    record: ShipmentNotice,
    warehouse?: { warehouse_id: number; warehouse_name?: string },
  ) => {
    const res = (await shipmentNoticeApi.notify(record.id!.toString(), warehouse)) as ShipmentNotice;
    messageApi.success(
      res?.sales_delivery_code
        ? t('app.kuaizhizao.shipmentNotice.notifySuccessWithDelivery', { deliveryCode: res.sales_delivery_code })
        : t('app.kuaizhizao.shipmentNotice.notifySuccess'),
    );
    if (noticeDetail?.id === record.id) {
      const fresh = await shipmentNoticeApi.get(record.id!.toString());
      setNoticeDetail(fresh as ShipmentNoticeDetail);
    }
    invalidateMenuBadgeCounts();
    actionRef.current?.reload();
  }, [invalidateMenuBadgeCounts, messageApi, noticeDetail?.id, t]);

  const resetNotifyPreviewModal = useCallback(() => {
    setNotifyPreviewOpen(false);
    setNotifyPreviewData(null);
    setNotifyPreviewTarget(null);
    setNotifyPreviewWarehouseId(undefined);
    setNotifyPreviewWarehouseName('');
  }, []);

  const loadNotifyPreview = useCallback(
    async (record: ShipmentNotice, warehouseId?: number) => {
      setNotifyPreviewLoading(true);
      try {
        const res = await shipmentNoticeApi.previewNotify(record.id!.toString(), {
          warehouse_id: warehouseId,
        });
        setNotifyPreviewData(res);
      } catch (error: any) {
        messageApi.error(error?.message || error?.detail || t('app.kuaizhizao.shipmentNotice.notifyPreviewFailed'));
        resetNotifyPreviewModal();
      } finally {
        setNotifyPreviewLoading(false);
      }
    },
    [messageApi, resetNotifyPreviewModal, t],
  );

  const handleNotify = useCallback(
    (record: ShipmentNotice) => {
      setNotifyPreviewOpen(true);
      setNotifyPreviewConfirming(false);
      setNotifyPreviewData(null);
      setNotifyPreviewTarget(record);
      const whId = record.warehouse_id ? Number(record.warehouse_id) : undefined;
      setNotifyPreviewWarehouseId(whId);
      setNotifyPreviewWarehouseName(record.warehouse_name || '');
      setTimeout(() => {
        notifyPreviewWarehouseFormRef.current?.setFieldsValue({
          warehouse_id: whId,
          warehouse_name: record.warehouse_name || '',
        });
      }, 0);
      void loadNotifyPreview(record, whId);
    },
    [loadNotifyPreview],
  );

  const handleNotifyPreviewWarehouseChange = useCallback(
    (warehouseId: number | undefined, warehouseName?: string) => {
      if (!notifyPreviewTarget?.id) return;
      setNotifyPreviewWarehouseId(warehouseId);
      setNotifyPreviewWarehouseName(warehouseName || '');
      notifyPreviewWarehouseFormRef.current?.setFieldsValue({
        warehouse_name: warehouseName || '',
      });
      if (warehouseId && warehouseId > 0) {
        void loadNotifyPreview(notifyPreviewTarget, warehouseId);
      }
    },
    [loadNotifyPreview, notifyPreviewTarget],
  );

  const handleNotifyPreviewConfirm = useCallback(async () => {
    if (!notifyPreviewTarget?.id || !notifyPreviewData) return;
    if (notifyPreviewData.has_blocking_issues) return;
    const warehouseId = notifyPreviewWarehouseId ?? notifyPreviewData.warehouse_id ?? notifyPreviewTarget.warehouse_id;
    if (!warehouseId || Number(warehouseId) <= 0) {
      messageApi.warning(t('app.kuaizhizao.shipmentNotice.selectOutboundWarehouse'));
      return;
    }
    setNotifyPreviewConfirming(true);
    try {
      await executeNotify(notifyPreviewTarget, {
        warehouse_id: Number(warehouseId),
        warehouse_name: notifyPreviewWarehouseName || notifyPreviewTarget.warehouse_name || undefined,
      });
      resetNotifyPreviewModal();
      setSelectedRowKeys([]);
    } catch (error: any) {
      messageApi.error(error?.message || t('app.kuaizhizao.shipmentNotice.notifyFailed'));
    } finally {
      setNotifyPreviewConfirming(false);
    }
  }, [
    executeNotify,
    messageApi,
    notifyPreviewData,
    notifyPreviewTarget,
    notifyPreviewWarehouseId,
    notifyPreviewWarehouseName,
    resetNotifyPreviewModal,
    t,
  ]);

  const handleWithdraw = (record: ShipmentNotice) => {
    getAntdModal().confirm({
      title: t('app.kuaizhizao.shipmentNotice.withdrawNotify'),
      content: t('app.kuaizhizao.shipmentNotice.withdrawConfirmContent', { code: record.notice_code }),
      onOk: async () => {
        try {
          await shipmentNoticeApi.withdraw(record.id!.toString());
          messageApi.success(t('app.kuaizhizao.shipmentNotice.withdrawSuccess'));
          invalidateMenuBadgeCounts();

          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || t('app.kuaizhizao.shipmentNotice.withdrawFailed'));
        }
      },
    });
  };

  const handleDelete = (record: ShipmentNotice) => {
    getAntdModal().confirm({
      title: t('app.kuaizhizao.shipmentNotice.deleteModalTitle'),
      content: t('app.kuaizhizao.shipmentNotice.deleteConfirmContent', { code: record.notice_code }),
      onOk: async () => {
        try {
          await shipmentNoticeApi.delete(record.id!.toString());
          messageApi.success(t('common.deleteSuccess'));
          invalidateMenuBadgeCounts();

          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || t('common.deleteFailed'));
        }
      },
    });
  };

  const handleBatchDelete = async (keys: React.Key[]) => {
    if (keys.length === 0) return;
    try {
      for (const k of keys) {
        await shipmentNoticeApi.delete(String(k));
      }
      messageApi.success(t('app.kuaizhizao.shipmentNotice.batchDeleteSuccess', { count: keys.length }));
      invalidateMenuBadgeCounts();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error?.message || t('common.batchDeleteFailed'));
    }
  };

  const handleCreate = async () => {
    setPreviewCode(null);
    setEffectiveRuleCode(null);
    setEditingId(null);
    setCreateModalVisible(true);
    setTimeout(() => {
      createFormRef.current?.setFieldsValue({ items: [defaultNoticeItem] });
    }, 100);
    let ruleCode = getPageRuleCode('kuaizhizao-shipment-notice');
    let autoGenerate = isAutoGenerateEnabled('kuaizhizao-shipment-notice');
    try {
      const pageConfig = await getCodeRulePageConfig('kuaizhizao-shipment-notice');
      if (pageConfig?.ruleCode) {
        ruleCode = pageConfig.ruleCode;
        autoGenerate = !!pageConfig.autoGenerate;
      }
    } catch {}
    if (autoGenerate && ruleCode) {
      setEffectiveRuleCode(ruleCode);
      testGenerateCode({ rule_code: ruleCode })
        .then((res) => {
          const preview = res.code;
          setPreviewCode(preview ?? null);
          setTimeout(() => {
            createFormRef.current?.setFieldsValue({ notice_code: preview ?? '', items: [defaultNoticeItem] });
          }, 100);
        })
        .catch((e) => {
          console.warn(t('app.kuaizhizao.shipmentNotice.codePreviewFailed'), e);
          setPreviewCode(null);
        });
    } else {
      setPreviewCode(null);
    }
  };

  const isPullLineSelectable = useCallback(
    (record: { remaining_quantity?: number }) => Number(record.remaining_quantity ?? 0) > 0,
    [],
  );

  const pullFromSalesOrderScopeOptions = useMemo(
    () => [
      { label: t('components.uniPullQuery.scopePullable'), value: 'pullable' },
      { label: t('components.uniPullQuery.scopeAll'), value: 'all' },
    ],
    [t],
  );

  const pullSalesOrderColumns = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.shipmentNotice.salesOrderCode'),
        dataIndex: 'order_code',
        width: 168,
        ellipsis: true,
      },
      {
        title: t('app.kuaizhizao.salesOrder.materialName'),
        dataIndex: 'material_name',
        ellipsis: true,
        render: (_: unknown, record: PullSalesOrderCandidate) => (
          <MaterialStackedCell
            material_name={record.material_name}
            material_code={record.material_code}
            material_spec={record.material_spec}
          />
        ),
      },
      {
        title: t('common.quantity'),
        dataIndex: 'suggested_quantity',
        width: 100,
        align: 'right' as const,
        render: (v: number) => formatQuantity(v),
      },
      {
        title: t('app.kuaizhizao.salesOrder.colShippedQty'),
        dataIndex: 'pushed_quantity',
        width: 100,
        align: 'right' as const,
        render: (v: number) => formatQuantity(v),
      },
      {
        title: t('app.kuaizhizao.salesOrder.colShippableQty'),
        dataIndex: 'remaining_quantity',
        width: 100,
        align: 'right' as const,
        render: (v: number) => formatQuantity(v),
      },
      {
        title: t('app.kuaizhizao.quotation.form.customer'),
        dataIndex: 'customer_name',
        width: 140,
        ellipsis: true,
      },
      {
        title: t('app.kuaizhizao.salesOrder.deliveryDate'),
        dataIndex: 'required_date',
        width: 112,
        render: (v: string) => (v ? formatBusinessDateOnly(v) : '-'),
      },
      {
        title: t('app.kuaizhizao.shipmentNotice.convertStatus'),
        key: 'convert_status',
        width: 100,
        align: 'center' as const,
        render: (_: unknown, record: PullSalesOrderCandidate) =>
          renderPullCapabilityTag(
            Number(record.remaining_quantity ?? 0) > 0,
            t('app.kuaizhizao.shipmentNotice.canCreate'),
            t('app.kuaizhizao.purchaseRequisition.pull.cannotCreate'),
          ),
      },
    ],
    [t],
  );

  const pullFromSalesOrderQuery = useUniPullQuery<PullSalesOrderCandidate>({
    rowKey: 'id',
    selectionType: 'checkbox',
    scopeOptions: pullFromSalesOrderScopeOptions,
    defaultScope: 'pullable',
    onOpen: () => {
      pullSourceOrderIdRef.current = undefined;
      setPullSourceOrderId(undefined);
      void listSalesOrders({ skip: 0, limit: 100, view: 'options' })
        .then((res) => {
          setPullSourceOrderOptions(
            (res?.data ?? [])
              .filter((row) => row.id != null && row.order_code)
              .map((row) => ({ value: row.id!, label: String(row.order_code) })),
          );
        })
        .catch((error: unknown) => {
          messageApi.error(getApiErrorMessage(error, t('app.kuaizhizao.shipmentNotice.pull.loadSourceFailed')));
          setPullSourceOrderOptions([]);
        });
    },
    loadData: async ({ keyword, page, pageSize, scope }) => {
      try {
        const listRes = await listSalesOrderShipmentNoticePullLines({
          skip: (page - 1) * pageSize,
          limit: pageSize,
          keyword: keyword.trim() || undefined,
          sales_order_id: pullSourceOrderIdRef.current,
          pullable_only: isPullableScope(scope),
        });
        return { data: listRes?.data ?? [], total: listRes?.total ?? 0 };
      } catch (error: unknown) {
        messageApi.error(getApiErrorMessage(error, t('app.kuaizhizao.salesOrder.listFailed')));
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
        messageApi.warning(t('app.kuaizhizao.shipmentNotice.pull.selectLinesFirst'));
        return;
      }
      try {
        const res = await pullShipmentNoticesFromSalesOrderItems(selectedIds);
        messageApi.success(
          res.message ||
            t('app.kuaizhizao.shipmentNotice.createFromSourceSuccess', {
              source: pullFromSalesOrderAction.sourceLabel,
              target: pullFromSalesOrderAction.targetLabel,
            }),
        );
        pullFromSalesOrderQuery.closeModal();
        invalidateMenuBadgeCounts();
        actionRef.current?.reload();
      } catch (error: unknown) {
        messageApi.error(
          getApiErrorMessage(
            error,
            t('app.kuaizhizao.shipmentNotice.createFromSourceFailed', {
              source: pullFromSalesOrderAction.sourceLabel,
              target: pullFromSalesOrderAction.targetLabel,
            }),
          ),
        );
      }
    },
  });

  const onSalesOrderSelect = async (orderId: number) => {
    let order = salesOrderList.find((o: any) => (o.id ?? o.sales_order_id) === orderId);
    if (!order) return;
    try {
      const detail = await getSalesOrder(orderId, true, false, { view: 'options' });
      order = detail;
    } catch {
      // use list data
    }
    const code = order.order_code || order.sales_order_code || order.code;
    const custId = order.customer_id ?? order.customerId;
    const cust = customerList.find((c: any) => (c.id ?? c.customer_id) === custId);
    const custName = cust?.name || cust?.customer_name || order.customer_name || order.customerName || '';
    createFormRef.current?.setFieldsValue({
      sales_order_code: code,
      customer_id: custId,
      customer_name: custName,
      customer_contact: order.customer_contact || cust?.contactPerson || (cust as any)?.contact,
      customer_phone: order.customer_phone || cust?.phone,
      shipping_address: order.shipping_address || cust?.address,
    });
    if (order.items && order.items.length > 0) {
      const items = order.items
        .map((it: any, index: number) => ({
          material_id: it.material_id ?? it.materialId,
          material_code: it.material_code || it.materialCode || '',
          material_name: it.material_name || it.materialName || '',
          material_spec: it.material_spec || '',
          material_unit: it.material_unit || it.materialUnit || defaultUnit,
          notice_quantity: Number(it.required_quantity ?? it.quantity ?? it.order_quantity) || 0,
          unit_price: Number((it.unit_price ?? it.unitPrice) || (order.items && order.items[index]?.unit_price)) || 0,
          sales_order_item_id: it.id ?? it.sales_order_item_id,
        }))
        .filter((it: any) => Number(it.material_id) > 0 && Number(it.notice_quantity) > 0);
      createFormRef.current?.setFieldsValue({ items: items.length ? items : [defaultNoticeItem] });
      if (!items.length) {
        messageApi.warning(t('app.kuaizhizao.shipmentNotice.noMaterialItemsFromSource', { source: salesOrderEntityName }));
      }
    }
  };

  const handleCreateSubmit = async (values: any) => {
    const validItems = (values.items ?? []).filter((it: any) => it.material_id && (Number(it.notice_quantity) || 0) > 0);
    if (!validItems.length) {
      messageApi.error(t('app.kuaizhizao.shipmentNotice.itemsRequired'));
      throw new Error(t('app.kuaizhizao.shipmentNotice.itemsRequired'));
    }
    if (!values.sales_order_id || !values.sales_order_code) {
      messageApi.error(t('app.kuaizhizao.salesOrderChange.selectSalesOrder'));
      throw new Error(t('app.kuaizhizao.salesOrderChange.selectSalesOrder'));
    }
    const cust =
      customerList.find((c: any) => Number(c.id ?? c.customer_id) === Number(values.customer_id)) ||
      { name: values.customer_name };
    const customerName = String(cust.name || cust.customer_name || values.customer_name || '').trim();
    if (!values.customer_id || !customerName) {
      messageApi.error(t('app.kuaizhizao.quotation.form.selectCustomer'));
      throw new Error(t('app.kuaizhizao.quotation.form.selectCustomer'));
    }
    const payloadItems = validItems.map((it: any) => ({
      material_id: Number(it.material_id),
      material_code: String(it.material_code || '').trim(),
      material_name: String(it.material_name || '').trim(),
      material_spec: it.material_spec != null && String(it.material_spec).trim()
        ? String(it.material_spec).trim()
        : undefined,
      material_unit: String(it.material_unit || defaultUnit).trim() || defaultUnit,
      notice_quantity: Number(it.notice_quantity) || 0,
      unit_price: Number(it.unit_price) || 0,
      ...(it.sales_order_item_id != null && Number(it.sales_order_item_id) > 0
        ? { sales_order_item_id: Number(it.sales_order_item_id) }
        : {}),
    }));
    const incompleteItem = payloadItems.find(
      (it) => !it.material_id || !it.material_code || !it.material_name || !it.material_unit,
    );
    if (incompleteItem) {
      messageApi.error(t('app.kuaizhizao.shipmentNotice.itemMaterialIncomplete'));
      throw new Error(t('app.kuaizhizao.shipmentNotice.itemMaterialIncomplete'));
    }
    let noticeCode = values.notice_code;
    const ruleCodeToUse = effectiveRuleCode || getPageRuleCode('kuaizhizao-shipment-notice');
    if (
      ruleCodeToUse &&
      (isAutoGenerateEnabled('kuaizhizao-shipment-notice') || effectiveRuleCode) &&
      (noticeCode === previewCode || !noticeCode)
    ) {
      try {
        const res = await generateCode({ rule_code: ruleCodeToUse });
        noticeCode = res.code;
      } catch (e) {
        console.warn(t('app.kuaizhizao.shipmentNotice.codeGenerateFailed'), e);
      }
    }
    try {
      await shipmentNoticeApi.create({
        notice_code: noticeCode || undefined,
        sales_order_id: Number(values.sales_order_id),
        sales_order_code: String(values.sales_order_code),
        customer_id: Number(values.customer_id),
        customer_name: customerName,
        customer_contact: values.customer_contact,
        customer_phone: values.customer_phone,
        warehouse_id: values.warehouse_id != null && values.warehouse_id !== ''
          ? Number(values.warehouse_id)
          : undefined,
        warehouse_name: values.warehouse_name || undefined,
        planned_ship_date: values.planned_ship_date ? formatDateTime(values.planned_ship_date, 'YYYY-MM-DD') : undefined,
        shipping_address: values.shipping_address,
        notes: values.notes,
        attachments: normalizeDocumentAttachments(values.attachments),
        items: payloadItems,
      });
      messageApi.success(t('common.createSuccess'));
      setCreateModalVisible(false);
      setEffectiveRuleCode(null);
      invalidateMenuBadgeCounts();

      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('common.createFailed'));
      throw error;
    }
  };

  const handleEditSubmit = async (values: any) => {
    if (!editingId) return;
    const cust = customerList.find((c: any) => (c.id ?? c.customer_id) === values.customer_id);
    try {
      await shipmentNoticeApi.update(editingId.toString(), {
        customer_id: values.customer_id,
        customer_name: cust?.name || cust?.customer_name || values.customer_name,
        customer_contact: values.customer_contact,
        customer_phone: values.customer_phone,
        warehouse_id: values.warehouse_id,
        warehouse_name: values.warehouse_name,
        planned_ship_date: values.planned_ship_date ? formatDateTime(values.planned_ship_date, 'YYYY-MM-DD') : undefined,
        shipping_address: values.shipping_address,
        notes: values.notes,
        attachments: normalizeDocumentAttachments(values.attachments),
      });
      messageApi.success(t('common.updateSuccess'));
      setEditModalVisible(false);
      invalidateMenuBadgeCounts();

      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('common.updateFailed'));
      throw error;
    }
  };

  const detailColumns: ProDescriptionsItemProps<ShipmentNoticeDetail>[] = alignDescriptionColumns([
    { title: t('app.kuaizhizao.shipmentNotice.noticeCode'), dataIndex: 'notice_code' },
    { title: t('app.kuaizhizao.shipmentNotice.salesOrderCode'), dataIndex: 'sales_order_code' },
    { title: t('app.kuaizhizao.quotation.form.customer'), dataIndex: 'customer_name' },
    { title: t('field.customer.contactPerson'), dataIndex: 'customer_contact' },
    { title: t('field.customer.phone'), dataIndex: 'customer_phone' },
    { title: t('app.kuaizhizao.shipmentNotice.outboundWarehouse'), dataIndex: 'warehouse_name' },
    { title: t('app.kuaizhizao.shipmentNotice.plannedShipDate'), dataIndex: 'planned_ship_date', valueType: 'date' },
    { title: t('app.kuaizhizao.salesOrder.shippingAddress'), dataIndex: 'shipping_address', span: 3 },
    { title: t('app.kuaizhizao.shipmentNotice.notifiedAt'), dataIndex: 'notified_at', valueType: 'dateTime' },
    { title: t('common.remark'), dataIndex: 'notes', span: 3 },
  ]);

  /** 将 Excel 行写入当前表单「通知明细」（新建弹窗内导入或列表工具栏导入共用） */
  const applyExcelRowsToNoticeForm = (data: any[][]) => {
    if (data.length <= 1) return;
    const items = data.slice(1).filter((row) => row[0]).map((row) => {
      const unitRaw = String(row[5] || '').trim();
      const material_unit = unitRaw
        ? materialUnitImport.parse(unitRaw) ?? unitRaw
        : defaultUnit;
      return {
      material_code: String(row[0] || ''),
      notice_quantity: Number(row[1]) || 1,
      unit_price: Number(row[2]) || 0,
      material_name: String(row[3] || ''),
      material_spec: String(row[4] || ''),
      material_unit,
    };});

    if (items.length === 0) {
      messageApi.warning(t('app.kuaizhizao.shipmentNotice.importNoValidData'));
      return;
    }

    const currentItems = createFormRef.current?.getFieldValue('items') || [];
    const filteredCurrent = currentItems.filter((it: any) => it.material_id || it.material_code);
    createFormRef.current?.setFieldsValue({
      items: [...filteredCurrent, ...items],
    });
    messageApi.success(t('app.kuaizhizao.shipmentNotice.importSuccessCount', { count: items.length }));
  };

  const handleFormLineImport = (data: any[][]) => {
    applyExcelRowsToNoticeForm(data);
  };

  /** 列表工具栏导入：打开新建弹窗并写入明细（与 UniTable 内置导入弹窗配合） */
  const handleListToolbarImport = (data: any[][]) => {
    if (editModalVisible) {
      messageApi.warning(t('app.kuaizhizao.shipmentNotice.closeEditBeforeImport'));
      return;
    }
    setCreateModalVisible(true);
    setTimeout(() => applyExcelRowsToNoticeForm(data), 150);
  };

  const renderCreateForm = () => (
    <>
      <Row gutter={16}>
        <Col span={8}>
          <ProFormText
            name="notice_code"
            label={t('app.kuaizhizao.shipmentNotice.noticeCode')}
            placeholder={isAutoGenerateEnabled('kuaizhizao-shipment-notice') ? t('app.kuaizhizao.quotation.form.codeAutoGenerate') : t('app.kuaizhizao.shipmentNotice.codeRequired')}
            rules={[{ required: true, message: t('app.kuaizhizao.shipmentNotice.codeRequired') }]}
          />
        </Col>
        <Col span={8}>
          <ProForm.Item name="sales_order_id" label={t('app.kuaizhizao.salesOrderChange.salesOrderLabel')} rules={[{ required: true, message: t('app.kuaizhizao.salesOrderChange.selectSalesOrder') }]}>
            <Select
              placeholder={t('app.kuaizhizao.salesOrderChange.selectSalesOrder')}
              showSearch
              optionFilterProp="label"
              options={salesOrderList.map((o: any) => ({
                value: o.id ?? o.sales_order_id,
                label: `${o.order_code || o.sales_order_code || o.code || ''} - ${o.customer_name || o.customerName || ''}`.trim(),
              }))}
              onChange={onSalesOrderSelect}
            />
          </ProForm.Item>
        </Col>
        <Col span={8}>
          <ProForm.Item name="customer_id" label={t('app.kuaizhizao.quotation.form.customer')} rules={[{ required: true, message: t('app.kuaizhizao.quotation.form.selectCustomer') }]}>
            <Select
              placeholder={t('app.kuaizhizao.quotation.form.selectCustomer')}
              showSearch
              optionFilterProp="label"
              options={customerList.map((c: any) => ({ value: c.id ?? c.customer_id, label: c.name || c.customer_name || c.code }))}
              onChange={(v) => {
                const cust = customerList.find((x: any) => (x.id ?? x.customer_id) === v);
                if (cust) createFormRef.current?.setFieldsValue({
                  customer_name: cust.name || cust.customer_name,
                  customer_contact: cust.contactPerson ?? (cust as any)?.contact,
                  customer_phone: cust.phone,
                  shipping_address: cust.address,
                });
              }}
            />
          </ProForm.Item>
        </Col>
      </Row>
      <ProFormText name="sales_order_code" hidden />
      <ProFormText name="customer_name" hidden />
      <Row gutter={16}>
        <Col span={8}>
          <ProFormText name="customer_contact" label={t('field.customer.contactPerson')} placeholder={t('field.customer.contactPersonPlaceholder')} />
        </Col>
        <Col span={8}>
          <ProFormText name="customer_phone" label={t('field.customer.phone')} placeholder={t('field.customer.phonePlaceholder')} />
        </Col>
        <Col span={8}>
          <UniWarehouseSelect
            name="warehouse_id"
            label={t('app.kuaizhizao.shipmentNotice.outboundWarehouse')}
            placeholder={t('app.kuaizhizao.shipmentNotice.selectOutboundWarehouse')}
            onChange={(_, wh) => createFormRef.current?.setFieldsValue({ warehouse_name: wh?.name ?? '' })}
          />
        </Col>
      </Row>
      <ProFormText name="warehouse_name" hidden />
      <Row gutter={16}>
        <Col span={8}>
          <ProFormDatePicker name="planned_ship_date" label={t('app.kuaizhizao.shipmentNotice.plannedShipDate')} fieldProps={buildFutureDateShortcutFieldProps({ getForm: () => createFormRef.current, fieldName: 'planned_ship_date', t })} />
        </Col>
      </Row>
      <ProFormTextArea name="shipping_address" label={t('app.kuaizhizao.salesOrder.shippingAddress')} placeholder={t('app.kuaizhizao.quotation.form.shippingAddressPlaceholder')} fieldProps={{ rows: 2 }} />
      <UniTableDetail
        name="items"
        title={t('app.kuaizhizao.shipmentNotice.noticeItems')}
        required
        requiredMessage={t('app.kuaizhizao.shipmentNotice.noticeItemsRequired')}
        headerExtra={(
          <Space size={8}>
            <Button
              type="default"
              icon={<ImportOutlined />}
              onClick={() => setImportVisible(true)}
            >
              {t('common.importDetail')}
            </Button>
            <Button
              type="default"
              icon={<PlusOutlined />}
              onClick={() => {
                const items = [...(createFormRef.current?.getFieldValue('items') ?? [])];
                items.push({ ...defaultNoticeItem });
                createFormRef.current?.setFieldsValue({ items });
              }}
            >
              {t('app.kuaizhizao.salesOrder.addItem')}
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
                  width: 220,
                  render: (_: any, __: any, index: number) => (
                    <AntForm.Item noStyle shouldUpdate={(prev: any, curr: any) => prev?.items?.[index] !== curr?.items?.[index]}>
                      {({ getFieldValue }: any) => {
                        const row = getFieldValue('items')?.[index];
                        const mid = row?.material_id ? Number(row.material_id) : null;
                        const fallback = mid && (row?.material_code || row?.material_name)
                          ? { value: mid, label: `${row.material_code || ''} - ${row.material_name || ''}`.trim() || String(mid) }
                          : undefined;
                        return (
                          <div className="uni-detail-material-cell">
                            {/* 注册明细必填字段，避免 setFieldsValue 写入后 onFinish 丢失导致后端 422 Field required */}
                            <AntForm.Item name={[index, 'material_code']} hidden>
                              <Input />
                            </AntForm.Item>
                            <AntForm.Item name={[index, 'material_name']} hidden>
                              <Input />
                            </AntForm.Item>
                            <AntForm.Item name={[index, 'sales_order_item_id']} hidden>
                              <Input />
                            </AntForm.Item>
                            <UniMaterialSelect
                              name={[index, 'material_id']}
                              label=""
                              placeholder={t('app.kuaizhizao.quotation.form.selectMaterial')}
                              required
                              size="small"
                              listFieldKey={index}
                              listFieldName="items"
                              fillMapping={{
                                material_code: 'mainCode',
                                material_name: 'name',
                                material_spec: 'specification',
                                material_unit: 'baseUnit',
                                unit_price: 'defaults.defaultSalePrice' as any,
                              }}
                              fallbackOption={fallback}
                              formItemProps={{ style: { margin: 0 } }}
                              showQuickCreate
                              showAdvancedSearch
                              skipFuzzyPinyinClientFilter
                              sourceType={materialSourceType}
                            />
                          </div>
                        );
                      }}
                    </AntForm.Item>
                  ),
                },
                {
                  title: t('app.kuaizhizao.shipmentNotice.import.specification'),
                  dataIndex: 'material_spec',
                  width: 120,
                  render: (_: any, __: any, index: number) => (
                    <AntForm.Item name={[index, 'material_spec']} style={{ margin: 0 }}>
                      <Input placeholder={t('app.kuaizhizao.shipmentNotice.import.specification')} size="small" />
                    </AntForm.Item>
                  ),
                },
                {
                  title: t('common.unit'),
                  dataIndex: 'material_unit',
                  width: 80,
                  render: (_: any, __: any, index: number) => (
                    <AntForm.Item name={[index, 'material_unit']} style={{ margin: 0 }}>
                      <Input placeholder={t('common.unit')} size="small" />
                    </AntForm.Item>
                  ),
                },
                {
                  title: t('common.quantity'),
                  dataIndex: 'notice_quantity',
                  width: 100,
                  align: 'right' as const,
                  render: (_: any, __: any, index: number) => (
                    <AntForm.Item name={[index, 'notice_quantity']} rules={[{ required: true, message: t('common.required') }, { type: 'number', min: 0.01, message: t('app.kuaizhizao.shipmentNotice.quantityPositive') }]} style={{ margin: 0 }}>
                      <InputNumber placeholder={t('common.quantity')} min={0} precision={2} style={{ width: '100%' }} size="small" />
                    </AntForm.Item>
                  ),
                },
                {
                  title: t('app.kuaizhizao.salesOrder.unitPrice'),
                  dataIndex: 'unit_price',
                  width: 100,
                  align: 'right' as const,
                  render: (_: any, __: any, index: number) => (
                    <AntForm.Item name={[index, 'unit_price']} style={{ margin: 0 }}>
                      <InputNumber placeholder="0" min={0} precision={2} style={{ width: '100%' }} size="small" />
                    </AntForm.Item>
                  ),
                },
              ]}
        disabledAdd
        minRows={1}
        initialValue={{ ...defaultNoticeItem }}
        tableProps={{
          size: 'small',
          style: { width: '100%', margin: 0 },
        }}
      />
      <ShipmentNoticeFormSummary />
      <ProFormTextArea name="notes" label={t('common.remark')} placeholder={t('common.remark')} fieldProps={{ rows: 2 }} colProps={{ span: 24 }} />
      <DocumentAttachmentsField category="shipment_notice_attachments" />
    </>
  );

  const renderEditForm = () => (
    <>
      <Row gutter={16}>
        <Col span={8}>
          <ProFormText name="sales_order_code" label={t('app.kuaizhizao.shipmentNotice.salesOrderCode')} disabled />
        </Col>
        <Col span={8}>
          <ProForm.Item name="customer_id" label={t('app.kuaizhizao.quotation.form.customer')} rules={[{ required: true, message: t('app.kuaizhizao.quotation.form.selectCustomer') }]}>
            <Select
              placeholder={t('app.kuaizhizao.quotation.form.selectCustomer')}
              showSearch
              optionFilterProp="label"
              options={customerList.map((c: any) => ({ value: c.id ?? c.customer_id, label: c.name || c.customer_name || c.code }))}
              onChange={(v) => {
                const cust = customerList.find((x: any) => (x.id ?? x.customer_id) === v);
                if (cust) editFormRef.current?.setFieldsValue({
                  customer_name: cust.name || cust.customer_name,
                  customer_contact: cust.contactPerson ?? (cust as any)?.contact,
                  customer_phone: cust.phone,
                });
              }}
            />
          </ProForm.Item>
        </Col>
        <Col span={8}>
          <ProFormText name="customer_contact" label={t('field.customer.contactPerson')} placeholder={t('field.customer.contactPersonPlaceholder')} />
        </Col>
      </Row>
      <Row gutter={16}>
        <Col span={8}>
          <ProFormText name="customer_phone" label={t('field.customer.phone')} placeholder={t('field.customer.phonePlaceholder')} />
        </Col>
        <Col span={8}>
          <UniWarehouseSelect
            name="warehouse_id"
            label={t('app.kuaizhizao.shipmentNotice.outboundWarehouse')}
            placeholder={t('app.kuaizhizao.shipmentNotice.selectOutboundWarehouse')}
            onChange={(_, wh) => editFormRef.current?.setFieldsValue({ warehouse_name: wh?.name ?? '' })}
          />
        </Col>
        <Col span={8}>
          <ProFormDatePicker name="planned_ship_date" label={t('app.kuaizhizao.shipmentNotice.plannedShipDate')} fieldProps={buildFutureDateShortcutFieldProps({ getForm: () => editFormRef.current, fieldName: 'planned_ship_date', t })} />
        </Col>
      </Row>
      <ProFormText name="warehouse_name" hidden />
      <ProFormText name="customer_name" hidden />
      <ProFormTextArea name="shipping_address" label={t('app.kuaizhizao.salesOrder.shippingAddress')} placeholder={t('app.kuaizhizao.quotation.form.shippingAddressPlaceholder')} fieldProps={{ rows: 2 }} />
      <ProFormItem label={t('app.kuaizhizao.shipmentNotice.noticeItems')}>
        <AntForm.Item noStyle shouldUpdate={(prev: any, curr: any) => prev?.items !== curr?.items}>
          {({ getFieldValue }: any) => {
            const items = getFieldValue('items') ?? [];
            return (
              <Table
                size="small"
                dataSource={items.map((it: any, i: number) => ({ ...it, key: i }))}
                rowKey="key"
                pagination={false}
                columns={[
                  { title: t('app.kuaizhizao.salesOrder.materialCode'), dataIndex: 'material_code', width: 120 },
                  { title: t('app.kuaizhizao.salesOrder.materialName'), dataIndex: 'material_name', width: 150 },
                  { title: t('common.unit'), dataIndex: 'material_unit', width: 60 },
                  { title: t('common.quantity'), dataIndex: 'notice_quantity', width: 90, align: 'right', render: formatQuantity },
                  { title: t('app.kuaizhizao.salesOrder.unitPrice'), dataIndex: 'unit_price', width: 90, align: 'right' },
                ]}
              />
            );
          }}
        </AntForm.Item>
        <ShipmentNoticeFormSummary />
      </ProFormItem>
      <ProFormTextArea name="notes" label={t('common.remark')} placeholder={t('common.remark')} fieldProps={{ rows: 2 }} colProps={{ span: 24 }} />
      <DocumentAttachmentsField category="shipment_notice_attachments" />
    </>
  );

  const timeconfigBasicItems = useDetailDrawerDescriptionItems(
    detailColumns, noticeDetail,
    'shipment_notice',
  );

  return (
    <>
      <ListPageTemplate>
        <UniTable
          columnPersistenceId={SHIPMENT_NOTICE_LIST_PERSISTENCE_ID}
          headerTitle={t('app.kuaizhizao.shipmentNotice.title')}
          actionRef={actionRef}
          rowKey={dataViewMode === 'detail' ? '_rowKey' : 'id'}
          columns={columns}
          viewTypes={['table', 'detailTable', 'help']}
          defaultViewType={viewTypeState === 'help' ? 'table' : viewTypeState}
          helpViewConfig={{
            content: (
              <div style={{ lineHeight: 1.8 }}>
                <p>
                  <strong>{t('components.uniTable.viewTable')}</strong>
                  {t('app.kuaizhizao.shipmentNotice.helpTableView')}
                </p>
                <p>
                  <strong>{t('components.uniTable.viewDetailTable')}</strong>
                  {t('app.kuaizhizao.shipmentNotice.helpDetailTableView')}
                </p>
              </div>
            ),
          }}
          onViewTypeChange={(v) => {
            dataViewModeRef.current = resolveDetailTableViewMode(v as 'table' | 'detailTable' | 'help');
            setViewTypeState(v as 'table' | 'detailTable' | 'help');
            setTimeout(() => actionRef.current?.reload(), 0);
          }}
          detailTableColumns={detailTableColumns}
          onTableDataChange={(rows) => {
            if (dataViewModeRef.current === 'order') {
              tableRowsRef.current = rows as ShipmentNotice[];
            }
          }}
          pinnedTabsField={LIST_LIFECYCLE_STAGE_FIELD}
          pinnedTabsValueEnum={shipmentNoticeLifecycleValueEnum}
          showAdvancedSearch
          skipFuzzyPinyinClientFilter
          showCreateButton={false}
          createButtonText={t('app.kuaizhizao.shipmentNotice.create')}
          onCreate={handleCreate}
          toolBarRender={() => [
            <UniPullCreateToolbar
              compactKey="create-shipment-notice-with-pull"
              createIcon={<PlusOutlined />}
              createLabel={t('app.kuaizhizao.shipmentNotice.create')}
              onCreate={() => {
                void handleCreate();
              }}
              menuItems={buildKuaizhizaoPullCreateMenuItems(t, [
                {
                  key: 'pull-from-sales-order',
                  actionKey: 'shipment_notice.pull_from_sales_order',
                  onClick: () => {
                    pullFromSalesOrderQuery.openModal();
                  },
                },
              ])}
            />,
          ]}
          enableRowSelection={viewTypeState !== 'detailTable'}
          selectedRowKeys={selectedRowKeys}
          onRowSelectionChange={setSelectedRowKeys}
          showDeleteButton
          onDelete={handleBatchDelete}
          deleteConfirmTitle={(count) => t('app.kuaizhizao.shipmentNotice.confirmBatchDelete', { count })}
          toolBarActionsAfterDelete={[
            <UniAuditBatchMenuButton
              key="shipment-notice-batch-menu"
              selectedRowKeys={selectedRowKeys}
              selectedRecords={selectedNoticesForBatch}
              auditEnabled={shipmentNoticeAuditEnabled}
              permGates={shipmentNoticePerms}
              handlers={shipmentNoticeAuditBatchHandlers}
              onSuccess={handleShipmentNoticeAuditBatchSuccess}
              toolBarButtonSize="middle"
            />,
          ]}
          toolBarActionsAfterBatch={[
            <UniCapabilityBatchButton
              key="shipment-notice-withdraw"
              selectedRowKeys={selectedRowKeys}
              selectedRecords={selectedNoticesForBatch}
              capabilityKey="withdraw"
              permAllowed={shipmentNoticePerms.canAction?.('revoke') ?? false}
              batchAllowed={shipmentNoticeBatchWithdrawAllowed}
              onRun={(id) => shipmentNoticeApi.withdraw(String(id))}
              notAllowedMessage={t('app.kuaizhizao.shipmentNotice.batchWithdrawNotAllowed')}
              onSuccess={() => {
                setSelectedRowKeys([]);
                invalidateMenuBadgeCounts();
                actionRef.current?.reload();
              }}
              requireConfirm
              labels={{
                single: t('app.kuaizhizao.shipmentNotice.withdrawNotify'),
                batch: t('app.kuaizhizao.shipmentNotice.batchWithdrawNotify'),
              }}
              icon={<AppstoreAddOutlined />}
              size="middle"
              color="orange"
              variant="solid"
            />,
            <UniCapabilityBatchButton
              key="shipment-notice-print"
              selectedRowKeys={selectedRowKeys}
              selectedRecords={selectedNoticesForBatch}
              capabilityKey="print"
              permAllowed={shipmentNoticePerms.canPrint}
              batchAllowed={(records, perm) =>
                Boolean(perm) && records.some((record) => record.capabilities?.print?.allowed === true)
              }
              singleOnly
              onRun={async (id) => {
                openPrint({ documentType: 'shipment_notice', documentId: id });
              }}
              labels={{
                single: t('components.uniAction.print'),
                batch: t('components.uniAction.print'),
              }}
              icon={<PrinterOutlined />}
              size="middle"
            />,
          ]}
          importHeaders={noticeItemImportTemplate.importHeaders}
          importExampleRow={noticeItemImportTemplate.importExampleRow}
          importColumnOptions={noticeItemImportTemplate.importColumnOptions}
          importFieldMap={noticeItemImportTemplate.importHeaderMap}
          onImport={handleListToolbarImport}
          showExportButton
          onExport={async (type, keys, pageData) => {
            try {
              let items: ShipmentNotice[] =
                type === 'currentPage' && pageData?.length
                  ? (pageData as ShipmentNotice[])
                  : await fetchAllListItems((p) => shipmentNoticeApi.list(p));
              if (type === 'selected' && keys?.length) {
                items = items.filter((d: ShipmentNotice) => d.id != null && keys.includes(d.id));
              }
              if (items.length === 0) {
                messageApi.warning(t('common.exportNoData'));
                return;
              }
              await downloadRecordsAsXlsx(
                items as Array<Record<string, unknown>>,
                `shipment-notices-${todaySiteDateString()}.xlsx`,
              );
              messageApi.success(t('common.exportCountSuccess', { count: items.length }));
            } catch (error: any) {
              messageApi.error(error?.message || t('common.exportFailed'));
            }
          }}
          request={async (params, sort, _filter, searchFormValues) => {
            try {
              const sf = searchFormValues ?? {};
              const lifecycleParams = resolveShipmentNoticeListLifecycleParams(sf, params);
              const { sortBy, sortOrder } = extractProTableSort(sort);
              const orderBy =
                sortBy && sortOrder ? (sortOrder === 'desc' ? `-${sortBy}` : sortBy) : undefined;
              const fuzzyKeyword =
                typeof sf.keyword === 'string' ? sf.keyword.trim() : '';
              const noticeCode = sf.notice_code != null ? String(sf.notice_code).trim() : '';
              const apiParams: ShipmentNoticeListParams = {
                skip: ((params.current || 1) - 1) * (params.pageSize || 20),
                limit: params.pageSize || 20,
                ...lifecycleParams,
                order_by: orderBy,
                include_items: dataViewModeRef.current === 'detail',
              };
              if (fuzzyKeyword) {
                apiParams.keyword = fuzzyKeyword;
              } else if (noticeCode) {
                apiParams.notice_code = noticeCode;
              }
              if (sf.customer_id != null && sf.customer_id !== '') {
                apiParams.customer_id = Number(sf.customer_id);
              }
              const salesOrderCode =
                sf.sales_order_code != null ? String(sf.sales_order_code).trim() : '';
              if (salesOrderCode) apiParams.sales_order_code = salesOrderCode;
              const plannedRange = sf.planned_ship_date_range as [unknown, unknown] | undefined;
              if (plannedRange && Array.isArray(plannedRange) && plannedRange[0]) {
                apiParams.planned_start_date = formatDateTime(plannedRange[0] as string | Date, 'YYYY-MM-DD');
                apiParams.planned_end_date = plannedRange[1]
                  ? formatDateTime(plannedRange[1] as string | Date, 'YYYY-MM-DD')
                  : apiParams.planned_start_date;
              }
              const createdRange = sf.created_at_range as [unknown, unknown] | undefined;
              if (createdRange && Array.isArray(createdRange) && createdRange[0]) {
                apiParams.created_start_date = formatDateTime(createdRange[0] as string | Date, 'YYYY-MM-DD');
                apiParams.created_end_date = createdRange[1]
                  ? formatDateTime(createdRange[1] as string | Date, 'YYYY-MM-DD')
                  : apiParams.created_start_date;
              }
              const response = await shipmentNoticeApi.list(apiParams);
              const notices = response?.data ?? [];
              const total = response?.total ?? notices.length;
              // 行缓存唯一真源：onTableDataChange（prefetch 会走本 request，禁止在此覆盖）
              if (dataViewModeRef.current === 'order') {
                return { data: notices, success: true, total };
              }
              const flatRows = flattenDocumentDetailRows<ShipmentNotice, ShipmentNoticeItem>({
                headers: notices,
                getHeaderId: (h) => h.id,
                getItems: (h) => h.items,
                buildRowKey: (h, item, index) =>
                  item?.id ? `sn-${h.id}-item-${item.id}` : `sn-${h.id}-idx-${index}`,
                mapItemRow: (h, item) => ({
                  ...item,
                  notice_id: h.id ?? 0,
                  notice_code: h.notice_code,
                  customer_name: h.customer_name,
                  sales_order_code: h.sales_order_code,
                  warehouse_name: h.warehouse_name,
                  planned_ship_date: h.planned_ship_date,
                  notified_at: h.notified_at,
                  status: h.status,
                  sales_delivery_id: h.sales_delivery_id,
                  sales_delivery_code: h.sales_delivery_code,
                  lifecycle: h.lifecycle,
                }),
                mapEmptyHeaderRow: (h) => ({
                  notice_id: h.id ?? 0,
                  notice_code: h.notice_code,
                  customer_name: h.customer_name,
                  material_code: '-',
                  material_name: '-',
                  material_unit: '',
                  notice_quantity: 0,
                  status: h.status,
                  sales_delivery_id: h.sales_delivery_id,
                  sales_delivery_code: h.sales_delivery_code,
                  lifecycle: h.lifecycle,
                  planned_ship_date: h.planned_ship_date,
                  notified_at: h.notified_at,
                }),
              }) as ShipmentNoticeItemRow[];
              return { data: flatRows, success: true, total };
            } catch {
              messageApi.error(t('app.kuaizhizao.shipmentNotice.listFailed'));
              return { data: [], success: false, total: 0 };
            }
          }}
        />
      </ListPageTemplate>

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
        selectedRows={pullFromSalesOrderQuery.selectedRows}
        onSelectedRowKeysChange={pullFromSalesOrderQuery.handleSelectedRowKeysChange}
        isRowDisabled={pullFromSalesOrderQuery.isRowDisabled}
        searchDraft={pullFromSalesOrderQuery.searchDraft}
        onSearchDraftChange={pullFromSalesOrderQuery.setSearchDraft}
        onSearchApply={pullFromSalesOrderQuery.handleSearchApply}
        onSearchClear={pullFromSalesOrderQuery.handleSearchClear}
        appliedKeyword={pullFromSalesOrderQuery.appliedKeyword}
        searchPlaceholder={t('app.kuaizhizao.shipmentNotice.pull.searchPlaceholder')}
        filterExtra={(
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder={t('app.kuaizhizao.shipmentNotice.pull.sourceDocPlaceholder')}
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
        scopeOptions={pullFromSalesOrderQuery.scopeOptions}
        scope={pullFromSalesOrderQuery.scope}
        onScopeChange={pullFromSalesOrderQuery.handleScopeChange}
        okText={t('app.kuaizhizao.shipmentNotice.pull.ok')}
      />

      <DetailDrawerTemplate
        title={`${t('app.kuaizhizao.shipmentNotice.detailTitle')}${noticeDetail?.notice_code ? ` - ${noticeDetail.notice_code}` : ''}`}
        open={detailDrawerVisible}
        zIndex={noticeDetailDrawerZIndex}
        onClose={() => {
          setDetailDrawerVisible(false);
          setNoticeDetail(null);
        }}
        width={DRAWER_CONFIG.HALF_WIDTH}
        extra={
          noticeDetail?.id != null ? (
            <Space size="small">
              {noticeDetail.capabilities?.notify?.allowed && shipmentNoticePerms.canUpdate ? (
                <Button
                  {...rowActionKind('dispatch')}
                  icon={<SendOutlined />}
                  onClick={() => handleNotify(noticeDetail)}
                >
                  {t('app.kuaizhizao.shipmentNotice.notifyWarehouse')}
                </Button>
              ) : null}
              {noticeDetail.capabilities?.withdraw?.allowed && shipmentNoticePerms.canAction?.('revoke') ? (
                <Button {...rowActionKind('revoke')} onClick={() => handleWithdraw(noticeDetail)}>
                  {t('app.kuaizhizao.shipmentNotice.withdrawNotify')}
                </Button>
              ) : null}
              <UniWorkflowActions {...rowActionKind('skip')}
                record={noticeDetail}
                entityName={shipmentNoticeEntityName}
                auditNodeKey="shipment_notice"
                resourcePrefix={SHIPMENT_NOTICE_RESOURCE}
                statusField="status"
                draftStatuses={['草稿', 'draft']}
                pendingStatuses={['待审核', 'pending_review', 'pending_approval']}
                approvedStatuses={['待发货', '已通知', '已出库']}
                rejectedStatuses={['已驳回', 'rejected', 'REJECTED']}
                onSuccess={async () => {
                  actionRef.current?.reload();
                  invalidateMenuBadgeCounts();
                  setTrackingRefreshKey((k) => k + 1);
                  if (noticeDetail?.id) {
                    const updated = await shipmentNoticeApi.get(String(noticeDetail.id));
                    setNoticeDetail(updated as ShipmentNoticeDetail);
                  }
                }}
              />
              {!(
                noticeDetail.capabilities?.print?.allowed === false ||
                !shipmentNoticePerms.canPrint
              ) ? (
                <Button
                  icon={<PrinterOutlined />}
                  onClick={() => openPrint({ documentType: 'shipment_notice', documentId: noticeDetail.id! })}
                >
                  {t('components.uniAction.print')}
                </Button>
              ) : null}
            </Space>
          ) : null
        }
        basic={
          noticeDetail ? (
            <Descriptions
              column={3}
              size="small"
              items={timeconfigBasicItems}
            />
          ) : undefined
        }
        collaboration={
          noticeDetail
            ? (() => {
                const lc = getShipmentNoticeLifecycle(noticeDetail as Record<string, unknown>, t);
                const mainStages = lc.mainStages ?? [];
                if (mainStages.length === 0) return null;
                return (
                  <UniLifecycleStepper
                    steps={mainStages}
                    showLabels
                    status={lc.status}
                    nextStepSuggestions={lc.nextStepSuggestions}
                    hideNextStepSuggestions
                  />
                );
              })()
            : undefined
        }
        collaborationAuditRecord={noticeDetail}
        supplementaryTitle={t('app.kuaizhizao.shipmentNotice.oqcSection')}
        supplementary={
          noticeDetail?.id != null ? (
            <LinkedOqcPanel
              shipmentNoticeId={noticeDetail.id}
              active={detailDrawerVisible}
              onNavigate={(path) => {
                setDetailDrawerVisible(false);
                setNoticeDetail(null);
                navigate(path);
              }}
            />
          ) : undefined
        }
        lines={
          noticeDetail ? (
            noticeDetail.items && noticeDetail.items.length > 0 ? (
              <Table
                size="small"
                rowKey={(record: any) => record.id || record.material_code}
                columns={[
                  { title: t('app.kuaizhizao.salesOrder.materialCode'), dataIndex: 'material_code', width: 120 },
                  { title: t('app.kuaizhizao.salesOrder.materialName'), dataIndex: 'material_name', width: 150 },
                  { title: t('common.unit'), dataIndex: 'material_unit', width: 60 },
                  { title: t('common.quantity'), dataIndex: 'notice_quantity', width: 90, align: 'right', render: formatQuantity },
                  { title: t('app.kuaizhizao.salesOrder.unitPrice'), dataIndex: 'unit_price', width: 90, align: 'right' },
                  { title: t('app.kuaizhizao.shipmentNotice.amount'), dataIndex: 'total_amount', width: 100, align: 'right' },
                ]}
                dataSource={noticeDetail.items}
                pagination={false}
              />
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('app.kuaizhizao.shipmentNotice.noDetailItems')} />
            )
          ) : undefined
        }
        timeline={
          noticeDetail ? (
            <>
              {shipmentTracking.loading && (
                <div style={{ textAlign: 'center', padding: 24 }}>
                  <Spin />
                </div>
              )}
              {shipmentTracking.error && !shipmentTracking.loading && (
                <Typography.Text type="danger">{shipmentTracking.error}</Typography.Text>
              )}
              {shipmentTracking.data && !shipmentTracking.loading && (
                <DocumentTrackingTimelineBody data={shipmentTracking.data} />
              )}
              {!shipmentTracking.loading && !shipmentTracking.data && !shipmentTracking.error && (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('app.kuaizhizao.shipmentNotice.noOperationRecords')} />
              )}
            </>
          ) : undefined
        }
        traceDocument={
          noticeDetail?.id != null
            ? {
                documentType: 'shipment_notice',
                documentId: noticeDetail.id,
                selfDocumentId: noticeDetail.id,
                renderBriefActions: (doc) => (
                  <WarehouseTraceBriefPrimaryActions
                    doc={doc}
                    t={t}
                    navigate={navigate}
                    closeDrawer={() => {
                      setDetailDrawerVisible(false);
                      setNoticeDetail(null);
                    }}
                  />
                ),
              }
            : undefined
        }
      />

      <FormModalTemplate
        title={t('app.kuaizhizao.shipmentNotice.create')}
        open={createModalVisible}
        onClose={() => { setCreateModalVisible(false); setEffectiveRuleCode(null); }}
        formRef={createFormRef}
        onFinish={handleCreateSubmit}
        width={MODAL_CONFIG.LARGE_WIDTH}
        grid={false}
        initialValues={{ items: [defaultNoticeItem] }}
      >
        {renderCreateForm()}
      </FormModalTemplate>

      <FormModalTemplate
        title={t('app.kuaizhizao.shipmentNotice.edit')}
        open={editModalVisible}
        onClose={() => setEditModalVisible(false)}
        afterOpenChange={(open) => {
          if (open && pendingEditFormValues) {
            editFormRef.current?.setFieldsValue(pendingEditFormValues);
            return;
          }
          if (!open) {
            setPendingEditFormValues(null);
            editFormRef.current?.resetFields?.();
          }
        }}
        formRef={editFormRef}
        onFinish={handleEditSubmit}
        width={MODAL_CONFIG.LARGE_WIDTH}
        grid={false}
      >
        {renderEditForm()}
      </FormModalTemplate>

      <Modal
        title={t('app.kuaizhizao.shipmentNotice.notifyWarehouse')}
        open={notifyPreviewOpen}
        width={1100}
        onCancel={resetNotifyPreviewModal}
        okText={t('app.kuaizhizao.shipmentNotice.notifyWarehouse')}
        cancelText={t('common.cancel')}
        confirmLoading={notifyPreviewConfirming}
        onOk={() => void handleNotifyPreviewConfirm()}
        okButtonProps={{ disabled: notifyPreviewLoading || !notifyPreviewData || !!notifyPreviewData?.has_blocking_issues }}
      >
        {notifyPreviewLoading ? (
          <div style={{ minHeight: 120, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <Spin />
            <div style={{ color: 'var(--ant-color-primary)' }}>{t('app.kuaizhizao.salesOrder.loadingPreview')}</div>
          </div>
        ) : notifyPreviewData ? (
          <div>
            <p style={{ marginBottom: 12, fontWeight: 500 }}>{notifyPreviewData.summary}</p>
            {notifyPreviewData.has_blocking_issues ? (
              <Alert
                type="warning"
                showIcon
                style={{ marginBottom: 12 }}
                message={
                  (notifyPreviewData.line_blocking_issues && notifyPreviewData.line_blocking_issues.length > 0
                    ? notifyPreviewData.line_blocking_issues.join('；')
                    : null) ||
                  shipmentNoticeCapabilityReasonMessage(notifyPreviewData.blocking_reason, t) ||
                  t('app.kuaizhizao.shipmentNotice.notifyPreviewBlocked')
                }
              />
            ) : null}
            {notifyPreviewData.warehouse_required || !notifyPreviewTarget?.warehouse_id ? (
              <div style={{ marginBottom: 16 }}>
                <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
                  {t('app.kuaizhizao.shipmentNotice.notifyWarehouseSelectContent', {
                    code: notifyPreviewTarget?.notice_code ?? notifyPreviewData.notice_code ?? '',
                  })}
                </Typography.Text>
                <ProForm formRef={notifyPreviewWarehouseFormRef} submitter={false} layout="vertical">
                  <UniWarehouseSelect
                    name="warehouse_id"
                    label={t('app.kuaizhizao.shipmentNotice.outboundWarehouse')}
                    required
                    onChange={(val, wh) => handleNotifyPreviewWarehouseChange(Number(val), wh?.name)}
                  />
                  <ProFormText name="warehouse_name" hidden />
                </ProForm>
              </div>
            ) : null}
            {notifyPreviewData.items?.length > 0 ? (
              <Table
                size="small"
                dataSource={notifyPreviewData.items}
                rowKey={(row) => String(row.item_id)}
                pagination={false}
                scroll={{ x: 960 }}
                columns={[
                  { title: t('app.kuaizhizao.salesOrder.materialCode'), dataIndex: 'material_code', width: 130, ellipsis: true },
                  { title: t('app.kuaizhizao.salesOrder.materialName'), dataIndex: 'material_name', width: 160, ellipsis: true },
                  { title: t('common.quantity'), dataIndex: 'quantity', width: 90, align: 'right', render: formatQuantity },
                  { title: t('app.kuaizhizao.salesOrder.colShipQty'), dataIndex: 'notice_quantity', width: 90, align: 'right', render: formatQuantity },
                  { title: t('app.kuaizhizao.salesOrder.colShippedQty'), dataIndex: 'pushed_quantity', width: 90, align: 'right', render: formatQuantity },
                  { title: t('app.kuaizhizao.salesOrder.colShippableQty'), dataIndex: 'max_push_quantity', width: 90, align: 'right', render: formatQuantity },
                ]}
              />
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('app.kuaizhizao.shipmentNotice.notifyPreviewNoLines')} />
            )}
            {notifyPreviewData.tip ? (
              <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>
                {notifyPreviewData.tip}
              </Typography.Paragraph>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <UniMaterialBatchPicker
        open={materialPickerOpen}
        onCancel={() => setMaterialPickerOpen(false)}
        onConfirm={(selected) => {
          appendShipmentNoticeItemsFromMaterials(selected);
          setMaterialPickerOpen(false);
        }}
      />

      <Suspense fallback={null}>
        <LazyUniImport
          visible={importVisible}
          onCancel={() => setImportVisible(false)}
          onConfirm={handleFormLineImport}
          title={t('app.kuaizhizao.shipmentNotice.importItemsTitle')}
          headers={noticeItemImportTemplate.importHeaders}
          exampleRow={noticeItemImportTemplate.importExampleRow}
        columnOptions={noticeItemImportTemplate.importColumnOptions}
        />
      </Suspense>
      {PrintModal}
    </>
  );
};

export default ShipmentNoticesPage;
