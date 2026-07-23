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
import { renderRowActionsOverflow, rowActionKind } from '../../../../../components/uni-action';
import { UniWorkflowActions } from '../../../../../components/uni-workflow-actions';
import { DetailLifecycleCollaborationBlock } from '../../../../../components/uni-audit/DetailAuditPhaseRow';
import { createListAuditPhaseColumn } from '../shared/listAuditPhaseColumn';
import { useAuditRequired } from '../../../../../hooks/useAuditRequired';
import { useInvalidateMenuBadgeCounts } from '../../../../../hooks/useInvalidateMenuBadgeCounts';
import { useNavigate } from 'react-router-dom';
import { ActionType, ProColumns, ProDescriptionsItemProps, ProForm, ProFormText, ProFormDatePicker, ProFormTextArea, ProFormItem, ProFormInstance } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Modal, Table, Form as AntForm, Select, InputNumber, Input, Row, Col, Typography, Dropdown, Spin, Empty, Descriptions, Switch, Alert } from 'antd';
import { PlusOutlined, EyeOutlined, EditOutlined, DeleteOutlined, SendOutlined, AppstoreAddOutlined, ImportOutlined, MoreOutlined, DownOutlined, PrinterOutlined } from '@ant-design/icons';
import { theme as AntdTheme } from 'antd';
import dayjs from 'dayjs';
import { UniTable } from '../../../../../components/uni-table';
import {
  UniTableStackedPrimaryCell,
  UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
} from '../../../../../components/uni-table/stackedPrimaryColumn';
import { UniCapabilityBatchButton, UniAuditBatchMenuButton, createUniAuditBatchHandlers } from '../../../../../components/uni-batch';
import { UniMaterialSelect } from '../../../../../components/uni-material-select';
import { warehouseApi as masterWarehouseApi } from '../../../../master-data/services/warehouse';
import { UniMaterialBatchPicker } from '../../../../../components/uni-material-batch-picker';
import { ThemedSegmented } from '../../../../../components/themed-segmented';
const LazyUniImport = lazy(() =>
  import('../../../../../components/uni-import').then((m) => ({ default: m.UniImport })),
);
import type { Material } from '../../../../master-data/types/material';
import { DocumentAmountSummaryWatch } from '../../../components/document-amount-summary/DocumentAmountSummary';
import { UniWarehouseSelect } from '../../../../../components/uni-warehouse-select';
import { ListPageTemplate, DetailDrawerTemplate, DetailDrawerInlineFullChain, FormModalTemplate, DRAWER_CONFIG, MODAL_CONFIG, DetailDrawerSection } from '../../../../../components/layout-templates';
import { UniPullCreateToolbar } from '../../../../../components/uni-pull';
import { UniPullQueryModal, useUniPullQuery } from '../../../../../components/uni-pull-query';
import { UniTableDetail } from '../../../../../components/uni-table-detail';
import { shipmentNoticeApi, type ShipmentNotice, type ShipmentNoticeItem, type ShipmentNoticeNotifyPreviewResponse, type ShipmentNoticeListParams } from '../../../services/shipment-notice';
import {
  previewPushSalesOrderToShipmentNotice,
  pushSalesOrderToShipmentNotice,
  listSalesOrders,
  listSalesOrders as listSalesOrdersForPull,
  getSalesOrder,
} from '../../../services/sales-order';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import {
  shipmentNoticeBatchWithdrawAllowed,
  shipmentNoticeCapabilityReasonMessage,
  salesOrderCapabilityReasonMessage,
} from '../../../../../hooks/useDocumentCapabilities';
import { LinkedOqcPanel } from '../../quality-management/components/LinkedInspectionPanel';
import { getShipmentNoticeLifecycle, buildShipmentNoticeLifecycleValueEnum, resolveShipmentNoticeListLifecycleParams } from '../../../utils/shipmentNoticeLifecycle';
import { UniLifecycleStepper } from '../../../../../components/uni-lifecycle';
import { LIST_LIFECYCLE_STAGE_FIELD } from '../../../../../utils/listLifecycleStage';
import { ListUniLifecycleCell } from '../shared/ListUniLifecycleCell';
import { DocumentPushProgressBar, DOCUMENT_PROGRESS_COLUMN_WIDTH } from '../shared/DocumentPushProgressBar';
import { shipmentNoticeOutboundPushPercent } from '../shared/pushProgress';
import { alignProColumns, SALES_DOC_LIST_FIELD_RANK } from '../shared/documentFieldAlignment';
import { buildDocumentAuditColumns } from '../../shared/documentAuditColumns';
import { DocumentTrackingTimelineBody, useDocumentTracking } from '../../../../../components/document-tracking-panel';
import { WarehouseTraceBriefPrimaryActions } from '../../warehouse-management/WarehouseTraceBriefFooter';
import { customerApi } from '../../../../master-data/services/supply-chain';
import { generateCode, testGenerateCode, getCodeRulePageConfig } from '../../../../../services/codeRule';
import { isAutoGenerateEnabled, getPageRuleCode } from '../../../../../utils/codeRulePage';
import { useTranslation } from 'react-i18next';
import { buildFactoryImportTemplate } from '../../../../../utils/spreadsheetImportTemplate';
import { buildFutureDateShortcutFieldProps } from '../../../../../utils/futureDatePickerShortcuts';
import { buildKuaizhizaoPullCreateMenuItems, resolveKuaizhizaoDocumentAction } from '../../../constants/documentActionRegistry';
import DocumentAttachmentsField from '../../../components/DocumentAttachmentsField';
import { mapAttachmentsToUploadList, normalizeDocumentAttachments } from '../../../utils/documentAttachments';
import { useKuaizhizaoPrintModal } from '../../../hooks/useKuaizhizaoPrintModal';
import { formatDateTime, formatQuantity } from '../../../../../utils/format';
import { extractProTableSort } from '../../../../../utils/tableQueryKey';
import { formDateRangeFormItemProps } from '../../../../../utils/formDate';

const SHIPMENT_NOTICE_RESOURCE = 'kuaizhizao:shipment-notice';

interface ShipmentNoticeDetail extends ShipmentNotice {
  items?: { id?: number; material_id?: number; material_code: string; material_name: string; material_unit: string; notice_quantity: number; unit_price?: number; total_amount?: number }[];
}

type PullSalesOrderCandidate = {
  id: number;
  order_code?: string;
  customer_name?: string;
  status?: string;
  review_status?: string;
  delivery_date?: string;
  updated_at?: string;
  capabilities?: {
    push_shipment_notice?: { allowed?: boolean; reason?: string | null };
  };
};

const ShipmentNoticesPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { openPrint, PrintModal } = useKuaizhizaoPrintModal();
  const pullFromSalesOrderAction = resolveKuaizhizaoDocumentAction(t, 'shipment_notice.pull_from_sales_order');

  const noticeItemImportTemplate = useMemo(
    () =>
      buildFactoryImportTemplate(
        t,
        [
          { field: 'material', labelKey: 'app.kuaizhizao.shipmentNotice.import.materialCode', aliases: ['产品编号'] },
          { field: 'quantity', labelKey: 'app.kuaizhizao.shipmentNotice.import.quantity', aliases: ['数量'] },
          { field: 'unitPrice', labelKey: 'app.kuaizhizao.shipmentNotice.import.unitPrice', aliases: ['单价'] },
          { field: 'name', labelKey: 'app.kuaizhizao.shipmentNotice.import.materialName', aliases: ['产品名称'] },
          { field: 'specification', labelKey: 'app.kuaizhizao.shipmentNotice.import.specification', aliases: ['规格'] },
          { field: 'unit', labelKey: 'app.kuaizhizao.shipmentNotice.import.unit', aliases: ['单位'] },
        ],
        [
          t('app.kuaizhizao.shipmentNotice.importExample.materialCode'),
          t('app.kuaizhizao.shipmentNotice.importExample.quantity'),
          t('app.kuaizhizao.shipmentNotice.importExample.unitPrice'),
          t('app.kuaizhizao.shipmentNotice.importExample.materialName'),
          t('app.kuaizhizao.shipmentNotice.importExample.specification'),
          t('app.kuaizhizao.shipmentNotice.importExample.unit'),
        ],
      ),
    [t, i18n.language],
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
  const [customersLoading, setCustomersLoading] = useState(false);
  const shipmentNoticeCustomerSearchOptions = useMemo(
    () =>
      customerList.map((c: { id?: number; customer_id?: number; name?: string; customer_name?: string; code?: string }) => ({
        value: Number(c.id ?? c.customer_id),
        label: String(c.name ?? c.customer_name ?? c.code ?? ''),
      })),
    [customerList],
  );
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

  const [pullPreviewOpen, setPullPreviewOpen] = useState(false);
  const [pullPreviewLoading, setPullPreviewLoading] = useState(false);
  const [pullPreviewConfirming, setPullPreviewConfirming] = useState(false);
  const [pullPreviewData, setPullPreviewData] = useState<Awaited<ReturnType<typeof previewPushSalesOrderToShipmentNotice>> | null>(null);
  const [pullPreviewSalesOrderId, setPullPreviewSalesOrderId] = useState<number | null>(null);
  const [pullSelectedItemIds, setPullSelectedItemIds] = useState<number[]>([]);
  const [pullQuantities, setPullQuantities] = useState<Record<number, number>>({});
  const [pullPreviewWarehouseOptions, setPullPreviewWarehouseOptions] = useState<Array<{ label: string; value: number }>>([]);
  const [pullPreviewLineWh, setPullPreviewLineWh] = useState<Record<number, number>>({});

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

  useEffect(() => {
    const load = async () => {
      setCustomersLoading(true);
      try {
        const [cust, ordersRes] = await Promise.all([
          customerApi.list({ limit: 1000, isActive: true }),
          listSalesOrders({ limit: 500 }).catch(() => ({ data: [], total: 0, success: false })),
        ]);
        setCustomerList(Array.isArray(cust) ? cust : (cust as any)?.data || (cust as any)?.items || []);
        setSalesOrderList(ordersRes?.data || []);
      } catch (e) {
        console.error(t('app.kuaizhizao.shipmentNotice.loadCustomersFailed'), e);
      } finally {
        setCustomersLoading(false);
      }
    };
    load();
  }, []);

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

  const renderShipmentNoticeRowActions = (actions: React.ReactNode[], keyPrefix: string) => {
    return renderRowActionsOverflow(actions, keyPrefix);
  };

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
        optionFilterProp: 'label',
        loading: customersLoading,
        options: shipmentNoticeCustomerSearchOptions,
        placeholder: t('app.kuaizhizao.quotation.form.customer'),
      },
    },
    {
      title: t('app.kuaizhizao.shipmentNotice.salesOrderCode'),
      dataIndex: 'sales_order_code',
      width: 140,
      ellipsis: true,
      sorter: true,
      fieldProps: { placeholder: t('app.kuaizhizao.shipmentNotice.salesOrderCode') },
    },
    {
      title: t('app.kuaizhizao.shipmentNotice.outboundWarehouse'),
      dataIndex: 'warehouse_name',
      width: 140,
      ellipsis: true,
      uniTableKeepWidth: true,
      sorter: true,
      hideInSearch: true,
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
      width: DOCUMENT_PROGRESS_COLUMN_WIDTH,
      uniTableKeepWidth: true,
      hideInSearch: true,
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
      align: 'center',
      fixed: 'right',
      valueType: 'select',
      valueEnum: shipmentNoticeLifecycleValueEnum,
      render: (_, record) => (
        <ListUniLifecycleCell lifecycle={getShipmentNoticeLifecycle(record as any, t)} />
      ),
    },
    {
      title: t('common.actions'),
      width: 240,
      fixed: 'right',
      hideInSearch: true,
      render: (_, record) => renderShipmentNoticeRowActions([
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
      ].filter(Boolean), `sn-${record.id ?? 'row'}`),
    },
  ], SALES_DOC_LIST_FIELD_RANK),
    [
      t,
      customersLoading,
      shipmentNoticeAuditColumn,
      shipmentNoticeCustomerSearchOptions,
      shipmentNoticeLifecycleValueEnum,
      shipmentNoticePerms.canDelete,
      shipmentNoticePerms.canUpdate,
      shipmentNoticePerms,
    ],
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

  const resetPullPreviewModal = useCallback(() => {
    setPullPreviewOpen(false);
    setPullPreviewData(null);
    setPullPreviewSalesOrderId(null);
    setPullSelectedItemIds([]);
    setPullQuantities({});
    setPullPreviewWarehouseOptions([]);
    setPullPreviewLineWh({});
  }, []);

  const showPullCreatePreview = useCallback(
    (salesOrderId: number) => {
      setPullPreviewOpen(true);
      setPullPreviewLoading(true);
      setPullPreviewConfirming(false);
      setPullPreviewData(null);
      setPullPreviewSalesOrderId(salesOrderId);
      setPullSelectedItemIds([]);
      setPullQuantities({});
      setPullPreviewWarehouseOptions([]);
      setPullPreviewLineWh({});
      Promise.all([
        previewPushSalesOrderToShipmentNotice(salesOrderId),
        masterWarehouseApi.list({ is_active: true, limit: 500 }),
      ])
        .then(([res, whRes]) => {
          setPullPreviewData(res);
          const whList = Array.isArray(whRes) ? whRes : (whRes as { items?: unknown[] })?.items ?? [];
          const warehouseOptions = (Array.isArray(whList) ? whList : []).map((w) => {
            const row = w as { id: number; code?: string; name?: string };
            const label = `${row.code || ''} ${row.name || ''}`.trim() || String(row.id);
            return { label, value: row.id };
          });
          setPullPreviewWarehouseOptions(warehouseOptions);
          const ids: number[] = [];
          const qtyMap: Record<number, number> = {};
          const lineWh: Record<number, number> = {};
          (res.items || []).forEach((row) => {
            const itemId = Number(row.item_id);
            const maxQty = Number(row.max_push_quantity ?? 0);
            if (!Number.isFinite(itemId) || itemId <= 0 || maxQty <= 0) return;
            ids.push(itemId);
            qtyMap[itemId] = maxQty;
            const whId = Number(row.warehouse_id);
            if (Number.isFinite(whId) && whId > 0) {
              lineWh[itemId] = whId;
            }
          });
          setPullSelectedItemIds(ids);
          setPullQuantities(qtyMap);
          setPullPreviewLineWh(lineWh);
        })
        .catch((error: any) => {
          messageApi.error(error?.message || error?.detail || t('app.kuaizhizao.shipmentNotice.pullPreviewFailed'));
          resetPullPreviewModal();
        })
        .finally(() => setPullPreviewLoading(false));
    },
    [messageApi, resetPullPreviewModal, t],
  );

  const handlePullPreviewConfirm = useCallback(async () => {
    if (!pullPreviewSalesOrderId || !pullPreviewData) return;
    if (pullPreviewData.has_blocking_issues && pullPreviewData.blocking_reason) {
      messageApi.warning(
        salesOrderCapabilityReasonMessage(pullPreviewData.blocking_reason, t) ||
          t('app.kuaizhizao.salesOrder.pushFailed'),
      );
      return;
    }
    if (!pullPreviewWarehouseOptions.length) {
      messageApi.warning(t('app.kuaizhizao.salesOrder.pushShipmentNoWarehouse'));
      return;
    }
    const rows = (pullPreviewData.items || []).filter((row) => Number(row.item_id) > 0);
    const rowById = new Map(rows.map((row) => [Number(row.item_id), row]));
    const selectedIds = pullSelectedItemIds.filter((id) => rowById.has(id));
    if (!selectedIds.length) {
      const hasPushable = rows.some((row) => Number(row.max_push_quantity ?? 0) > 0);
      messageApi.warning(
        hasPushable
          ? t('app.kuaizhizao.salesOrder.selectAtLeastOneLine')
          : t('app.kuaizhizao.salesOrder.shippableQtyFullyUsed'),
      );
      return;
    }
    const selectedQuantities: Record<number, number> = {};
    const lineWarehouses: Record<number, number> = {};
    for (const id of selectedIds) {
      const row = rowById.get(id);
      const qty = Number(pullQuantities[id] ?? 0);
      const maxQty = Number(row?.max_push_quantity ?? row?.quantity ?? 0);
      if (!Number.isFinite(qty) || qty <= 0) {
        messageApi.warning(t('app.kuaizhizao.salesOrder.pushQtyInvalid', { code: row?.material_code || id }));
        return;
      }
      if (Number.isFinite(maxQty) && maxQty > 0 && qty > maxQty) {
        messageApi.warning(t('app.kuaizhizao.salesOrder.pushQtyExceedsShippable', { code: row?.material_code || id }));
        return;
      }
      const lineWh = pullPreviewLineWh[id];
      if (lineWh == null || !(lineWh > 0)) {
        messageApi.warning(
          t('app.kuaizhizao.salesOrder.pushShipmentSelectLineWarehouse', {
            material: row?.material_code || row?.material_name || id,
          }),
        );
        return;
      }
      selectedQuantities[id] = qty;
      lineWarehouses[id] = lineWh;
    }
    setPullPreviewConfirming(true);
    try {
      const res = await pushSalesOrderToShipmentNotice(pullPreviewSalesOrderId, {
        selected_item_ids: selectedIds,
        selected_quantities: selectedQuantities,
        line_warehouses: lineWarehouses,
      });
      messageApi.success(res?.message || t('app.kuaizhizao.salesOrder.shipmentNoticeCreated'));
      invalidateMenuBadgeCounts();
      actionRef.current?.reload();
      resetPullPreviewModal();
    } catch (error: any) {
      messageApi.error(
        error?.message ||
          error?.response?.data?.detail ||
          t('app.kuaizhizao.shipmentNotice.createFromSourceFailed', {
            source: salesOrderEntityName,
            target: shipmentNoticeEntityName,
          }),
      );
    } finally {
      setPullPreviewConfirming(false);
    }
  }, [
    invalidateMenuBadgeCounts,
    messageApi,
    pullPreviewData,
    pullPreviewSalesOrderId,
    pullQuantities,
    pullSelectedItemIds,
    pullPreviewLineWh,
    pullPreviewWarehouseOptions,
    resetPullPreviewModal,
    salesOrderEntityName,
    shipmentNoticeEntityName,
    t,
  ]);

  const handleWithdraw = (record: ShipmentNotice) => {
    Modal.confirm({
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
    Modal.confirm({
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

  const pullFromSalesOrderQuery = useUniPullQuery<PullSalesOrderCandidate>({
    rowKey: 'id',
    selectionType: 'radio',
    loadData: async ({ keyword, page, pageSize }) => {
      try {
        const result = await listSalesOrdersForPull({
          skip: (page - 1) * pageSize,
          limit: pageSize,
          keyword: keyword.trim() || undefined,
        });
        const rows = Array.isArray(result) ? result : (result.data ?? []);
        const candidates = rows.map((row: any) => ({
          id: Number(row.id),
          order_code: row.order_code ?? row.sales_order_code,
          customer_name: row.customer_name ?? row.customerName,
          status: row.status,
          review_status: row.review_status,
          delivery_date: row.delivery_date,
          updated_at: row.updated_at,
          capabilities: row.capabilities,
        }));
        return {
          data: candidates,
          total: Array.isArray(result) ? candidates.length : (result.total ?? candidates.length),
        };
      } catch (e: any) {
        messageApi.error(e?.message || t('app.kuaizhizao.salesOrder.listFailed'));
        return { data: [], total: 0 };
      }
    },
    isRowDisabled: (record) => record.capabilities?.push_shipment_notice?.allowed === false,
    onConfirm: async (keys, rows) => {
      const selectedId = Number(keys[0]);
      if (!selectedId) {
        messageApi.warning(t('app.kuaizhizao.shipmentNotice.selectSource', { source: salesOrderEntityName }));
        return;
      }
      const selected = rows[0];
      if (selected?.capabilities?.push_shipment_notice?.allowed === false) {
        messageApi.warning(
          salesOrderCapabilityReasonMessage(selected.capabilities?.push_shipment_notice?.reason, t) ||
            t('app.kuaizhizao.shipmentNotice.sourceAlreadyConverted', {
              source: salesOrderEntityName,
              target: shipmentNoticeEntityName,
            }),
        );
        return;
      }
      pullFromSalesOrderQuery.closeModal();
      showPullCreatePreview(selectedId);
    },
  });

  const onSalesOrderSelect = async (orderId: number) => {
    let order = salesOrderList.find((o: any) => (o.id ?? o.sales_order_id) === orderId);
    if (!order) return;
    try {
      const detail = await getSalesOrder(orderId, true);
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
    const cust = customerList.find((c: any) => (c.id ?? c.customer_id) === values.customer_id) || { name: values.customer_name };
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
        sales_order_id: values.sales_order_id,
        sales_order_code: values.sales_order_code,
        customer_id: values.customer_id,
        customer_name: cust.name || cust.customer_name || values.customer_name,
        customer_contact: values.customer_contact,
        customer_phone: values.customer_phone,
        warehouse_id: values.warehouse_id,
        warehouse_name: values.warehouse_name,
        planned_ship_date: values.planned_ship_date ? formatDateTime(values.planned_ship_date, 'YYYY-MM-DD') : undefined,
        shipping_address: values.shipping_address,
        notes: values.notes,
        attachments: normalizeDocumentAttachments(values.attachments),
        items: validItems.map((it: any) => ({
          material_id: it.material_id,
          material_code: it.material_code,
          material_name: it.material_name,
          material_spec: it.material_spec,
          material_unit: it.material_unit || defaultUnit,
          notice_quantity: Number(it.notice_quantity) || 0,
          unit_price: Number(it.unit_price) || 0,
        })),
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

  const detailColumns: ProDescriptionsItemProps<ShipmentNoticeDetail>[] = [
    { title: t('app.kuaizhizao.shipmentNotice.noticeCode'), dataIndex: 'notice_code' },
    { title: t('app.kuaizhizao.shipmentNotice.salesOrderCode'), dataIndex: 'sales_order_code' },
    { title: t('app.kuaizhizao.quotation.form.customer'), dataIndex: 'customer_name' },
    { title: t('field.customer.contactPerson'), dataIndex: 'customer_contact' },
    { title: t('field.customer.phone'), dataIndex: 'customer_phone' },
    { title: t('app.kuaizhizao.shipmentNotice.outboundWarehouse'), dataIndex: 'warehouse_name' },
    { title: t('app.kuaizhizao.shipmentNotice.plannedShipDate'), dataIndex: 'planned_ship_date', valueType: 'date' },
    { title: t('app.kuaizhizao.salesOrder.shippingAddress'), dataIndex: 'shipping_address', span: 2 },
    {
      title: t('common.status'),
      dataIndex: 'status',
      render: (s) => {
        const c = statusMap[(s as string) || ''] || { text: (s as string) || '-', color: 'default' };
        return <Tag color={c.color}>{c.text}</Tag>;
      },
    },
    { title: t('app.kuaizhizao.shipmentNotice.notifiedAt'), dataIndex: 'notified_at', valueType: 'dateTime' },
    { title: t('app.kuaizhizao.common.fieldNotes'), dataIndex: 'notes', span: 2 },
  ];

  /** 将 Excel 行写入当前表单「通知明细」（新建弹窗内导入或列表工具栏导入共用） */
  const applyExcelRowsToNoticeForm = (data: any[][]) => {
    if (data.length <= 1) return;
    const items = data.slice(1).filter((row) => row[0]).map((row) => ({
      material_code: String(row[0] || ''),
      notice_quantity: Number(row[1]) || 1,
      unit_price: Number(row[2]) || 0,
      material_name: String(row[3] || ''),
      material_spec: String(row[4] || ''),
      material_unit: String(row[5] || defaultUnit),
    }));

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
                  title: t('app.kuaizhizao.salesOrder.unit'),
                  dataIndex: 'material_unit',
                  width: 80,
                  render: (_: any, __: any, index: number) => (
                    <AntForm.Item name={[index, 'material_unit']} style={{ margin: 0 }}>
                      <Input placeholder={t('app.kuaizhizao.salesOrder.unit')} size="small" />
                    </AntForm.Item>
                  ),
                },
                {
                  title: t('app.kuaizhizao.salesOrder.quantity'),
                  dataIndex: 'notice_quantity',
                  width: 100,
                  align: 'right' as const,
                  render: (_: any, __: any, index: number) => (
                    <AntForm.Item name={[index, 'notice_quantity']} rules={[{ required: true, message: t('common.required') }, { type: 'number', min: 0.01, message: t('app.kuaizhizao.shipmentNotice.quantityPositive') }]} style={{ margin: 0 }}>
                      <InputNumber placeholder={t('app.kuaizhizao.salesOrder.quantity')} min={0} precision={2} style={{ width: '100%' }} size="small" />
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
      <ProFormTextArea name="notes" label={t('app.kuaizhizao.common.fieldNotes')} placeholder={t('app.kuaizhizao.common.fieldNotes')} fieldProps={{ rows: 2 }} colProps={{ span: 24 }} />
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
                  { title: t('app.kuaizhizao.salesOrder.unit'), dataIndex: 'material_unit', width: 60 },
                  { title: t('app.kuaizhizao.salesOrder.quantity'), dataIndex: 'notice_quantity', width: 90, align: 'right', render: formatQuantity },
                  { title: t('app.kuaizhizao.salesOrder.unitPrice'), dataIndex: 'unit_price', width: 90, align: 'right' },
                ]}
              />
            );
          }}
        </AntForm.Item>
        <ShipmentNoticeFormSummary />
      </ProFormItem>
      <ProFormTextArea name="notes" label={t('app.kuaizhizao.common.fieldNotes')} placeholder={t('app.kuaizhizao.common.fieldNotes')} fieldProps={{ rows: 2 }} colProps={{ span: 24 }} />
      <DocumentAttachmentsField category="shipment_notice_attachments" />
    </>
  );

  return (
    <>
      <ListPageTemplate>
        <UniTable
          columnPersistenceId="apps.kuaizhizao.pages.sales-management.shipment-notices"
          headerTitle={t('app.kuaizhizao.shipmentNotice.title')}
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          onTableDataChange={(rows) => {
            tableRowsRef.current = rows;
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
          enableRowSelection
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
          importFieldMap={noticeItemImportTemplate.importHeaderMap}
          onImport={handleListToolbarImport}
          showExportButton
          onExport={async (type, keys, pageData) => {
            try {
              const response = await shipmentNoticeApi.list({ skip: 0, limit: 10000 });
              const rawData = response?.data ?? [];
              let items: ShipmentNotice[] = rawData;
              if (type === 'currentPage' && pageData?.length) {
                items = pageData as ShipmentNotice[];
              } else if (type === 'selected' && keys?.length) {
                items = rawData.filter((d: ShipmentNotice) => d.id != null && keys.includes(d.id));
              }
              if (items.length === 0) {
                messageApi.warning(t('common.exportNoData'));
                return;
              }
              const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `shipment-notices-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              URL.revokeObjectURL(url);
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
              const data = response?.data ?? [];
              const total = response?.total ?? data.length;
              return { data, success: true, total };
            } catch {
              messageApi.error(t('app.kuaizhizao.shipmentNotice.listFailed'));
              return { data: [], success: false, total: 0 };
            }
          }}
          scroll={{ x: 1200 }}
        />
      </ListPageTemplate>

      <UniPullQueryModal<PullSalesOrderCandidate>
        open={pullFromSalesOrderQuery.open}
        title={pullFromSalesOrderAction.label}
        onCancel={pullFromSalesOrderQuery.closeModal}
        onOk={pullFromSalesOrderQuery.handleConfirm}
        rowKey="id"
        columns={[
          { title: t('app.kuaizhizao.shipmentNotice.salesOrderCode'), dataIndex: 'order_code', width: 190, ellipsis: true },
          { title: t('app.kuaizhizao.quotation.form.customer'), dataIndex: 'customer_name', width: 220, ellipsis: true },
          { title: t('app.kuaizhizao.shipmentNotice.orderStatus'), dataIndex: 'status', width: 130, align: 'center' },
          { title: t('app.kuaizhizao.salesOrder.reviewStatus'), dataIndex: 'review_status', width: 120, align: 'center' },
          { title: t('app.kuaizhizao.salesOrder.deliveryDate'), dataIndex: 'delivery_date', width: 130, render: (v) => (v ? formatDateTime(v, 'YYYY-MM-DD') : '-') },
          { title: t('common.updatedAt'), dataIndex: 'updated_at', width: 180, render: (v) => (v ? formatDateTime(v, 'YYYY-MM-DD HH:mm:ss') : '-') },
          {
            title: t('app.kuaizhizao.shipmentNotice.convertStatus'),
            key: 'convert_status',
            width: 180,
            align: 'center',
            render: (_, r) =>
              r.capabilities?.push_shipment_notice?.allowed === false ? (
                <Tag color="gold">
                  {salesOrderCapabilityReasonMessage(r.capabilities?.push_shipment_notice?.reason, t) ||
                    t('app.kuaizhizao.workOrder.tagCannotCreate')}
                </Tag>
              ) : (
                <Tag color="success">{t('app.kuaizhizao.shipmentNotice.canCreate')}</Tag>
              ),
          },
        ]}
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
        searchPlaceholder={t('app.kuaizhizao.shipmentNotice.pullSearchPlaceholder')}
        page={pullFromSalesOrderQuery.page}
        pageSize={pullFromSalesOrderQuery.pageSize}
        total={pullFromSalesOrderQuery.total}
        onPageChange={pullFromSalesOrderQuery.handlePageChange}
        okText={t('app.kuaizhizao.shipmentNotice.createTarget', { target: shipmentNoticeEntityName })}
        width={MODAL_CONFIG.EXTRA_LARGE_WIDTH}
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
        columns={[]}
        column={3}
        dataSource={noticeDetail || undefined}
        extra={
          noticeDetail?.id != null ? (
            <Space size="small">
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
        customContent={
          noticeDetail ? (
            <>
              <DetailDrawerSection title={t('app.uniDetail.sectionBasic')}>
                <Descriptions
                  column={3}
                  size="small"
                  items={detailColumns.map((col, index) => {
                    const value = col.dataIndex
                      ? (noticeDetail as Record<string, unknown>)[col.dataIndex as string]
                      : undefined;
                    let content: React.ReactNode = value as React.ReactNode;
                    if (col.valueType === 'dateTime' && value) {
                      content = formatDateTime(value as string, 'YYYY-MM-DD HH:mm:ss');
                    } else if (col.valueType === 'date' && value) {
                      content = formatDateTime(value as string, 'YYYY-MM-DD');
                    }
                    if (col.render && noticeDetail != null) {
                      content = col.render(content, noticeDetail, index, undefined as any, col as any) as React.ReactNode;
                    }
                    return {
                      key: String(col.key ?? col.dataIndex ?? index),
                      label: col.title as React.ReactNode,
                      children: content !== undefined && content !== null ? content : '-',
                      span: col.span ?? 1,
                    };
                  })}
                />
              </DetailDrawerSection>

              <DetailDrawerSection title={t('app.uniDetail.sectionCollaboration')}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {(() => {
                    const lc = getShipmentNoticeLifecycle(noticeDetail as Record<string, unknown>, t);
                    const mainStages = lc.mainStages ?? [];
                    if (mainStages.length === 0) return null;
                    return (
                      <DetailLifecycleCollaborationBlock record={noticeDetail} auditEnabled={shipmentNoticeAuditEnabled}>
                        <UniLifecycleStepper
                          steps={mainStages}
                          showLabels
                          status={lc.status}
                          nextStepSuggestions={lc.nextStepSuggestions}
                          hideNextStepSuggestions
                        />
                      </DetailLifecycleCollaborationBlock>
                    );
                  })()}
                  {noticeDetail.id != null ? (
                    <DetailDrawerInlineFullChain
                      documentType="shipment_notice"
                      documentId={noticeDetail.id}
                      active={detailDrawerVisible}
                      selfDocumentId={noticeDetail.id}
                      renderBriefActions={(doc) => (
                        <WarehouseTraceBriefPrimaryActions
                          doc={doc}
                          t={t}
                          navigate={navigate}
                          closeDrawer={() => {
                            setDetailDrawerVisible(false);
                            setNoticeDetail(null);
                          }}
                        />
                      )}
                    />
                  ) : null}
                </div>
              </DetailDrawerSection>

              {noticeDetail.id != null ? (
                <DetailDrawerSection title={t('app.kuaizhizao.shipmentNotice.oqcSection')}>
                  <LinkedOqcPanel
                    shipmentNoticeId={noticeDetail.id}
                    active={detailDrawerVisible}
                    onNavigate={(path) => {
                      setDetailDrawerVisible(false);
                      setNoticeDetail(null);
                      navigate(path);
                    }}
                  />
                </DetailDrawerSection>
              ) : null}

              <DetailDrawerSection title={t('app.uniDetail.sectionLines')}>
                {noticeDetail.items && noticeDetail.items.length > 0 ? (
                  <Table
                    size="small"
                    rowKey={(record: any) => record.id || record.material_code}
                    columns={[
                      { title: t('app.kuaizhizao.salesOrder.materialCode'), dataIndex: 'material_code', width: 120 },
                      { title: t('app.kuaizhizao.salesOrder.materialName'), dataIndex: 'material_name', width: 150 },
                      { title: t('app.kuaizhizao.salesOrder.unit'), dataIndex: 'material_unit', width: 60 },
                      { title: t('app.kuaizhizao.salesOrder.quantity'), dataIndex: 'notice_quantity', width: 90, align: 'right', render: formatQuantity },
                      { title: t('app.kuaizhizao.salesOrder.unitPrice'), dataIndex: 'unit_price', width: 90, align: 'right' },
                      { title: t('app.kuaizhizao.shipmentNotice.amount'), dataIndex: 'total_amount', width: 100, align: 'right' },
                    ]}
                    dataSource={noticeDetail.items}
                    pagination={false}
                  />
                ) : (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('app.kuaizhizao.shipmentNotice.noDetailItems')} />
                )}
              </DetailDrawerSection>

              <DetailDrawerSection title={t('app.uniDetail.sectionTimeline')}>
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
              </DetailDrawerSection>
            </>
          ) : null
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
        title={t('app.kuaizhizao.salesOrder.pushPreviewTitle')}
        open={pullPreviewOpen}
        destroyOnClose
        width={1100}
        onCancel={resetPullPreviewModal}
        okText={t('app.kuaizhizao.shipmentNotice.createTarget', { target: shipmentNoticeEntityName })}
        cancelText={t('common.cancel')}
        confirmLoading={pullPreviewConfirming}
        onOk={() => void handlePullPreviewConfirm()}
        okButtonProps={{
          disabled:
            pullPreviewLoading ||
            !pullPreviewData ||
            (!!pullPreviewData?.has_blocking_issues && !!pullPreviewData?.blocking_reason),
        }}
      >
        {pullPreviewLoading ? (
          <div style={{ minHeight: 120, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <Spin />
            <div style={{ color: 'var(--ant-color-primary)' }}>{t('app.kuaizhizao.salesOrder.loadingPreview')}</div>
          </div>
        ) : pullPreviewData ? (
          <div>
            <p style={{ marginBottom: 12, fontWeight: 500 }}>{pullPreviewData.summary}</p>
            {pullPreviewData.has_blocking_issues && pullPreviewData.blocking_reason ? (
              <Alert
                type="warning"
                showIcon
                style={{ marginBottom: 12 }}
                message={
                  salesOrderCapabilityReasonMessage(pullPreviewData.blocking_reason, t) ||
                    t('app.kuaizhizao.salesOrder.pushFailed')
                }
              />
            ) : null}
            {pullPreviewData.items?.length > 0 ? (
              <Table
                size="small"
                dataSource={pullPreviewData.items}
                rowKey={(row) => String(row.item_id)}
                pagination={false}
                scroll={{ x: 1180 }}
                columns={[
                  {
                    title: t('common.select'),
                    dataIndex: 'item_id',
                    width: 64,
                    render: (_: unknown, row) => {
                      const itemId = Number(row.item_id);
                      const maxQty = Number(row.max_push_quantity ?? 0);
                      const disabled = !Number.isFinite(maxQty) || maxQty <= 0;
                      return (
                        <Switch
                          size="small"
                          disabled={disabled}
                          checked={pullSelectedItemIds.includes(itemId)}
                          onChange={(checked) => {
                            setPullSelectedItemIds((prev) =>
                              checked ? Array.from(new Set([...prev, itemId])) : prev.filter((id) => id !== itemId),
                            );
                          }}
                        />
                      );
                    },
                  },
                  { title: t('app.kuaizhizao.salesOrder.materialCode'), dataIndex: 'material_code', width: 130, ellipsis: true },
                  { title: t('app.kuaizhizao.salesOrder.materialName'), dataIndex: 'material_name', width: 160, ellipsis: true },
                  { title: t('app.kuaizhizao.salesOrder.quantity'), dataIndex: 'quantity', width: 90, align: 'right', render: formatQuantity },
                  { title: t('app.kuaizhizao.salesOrder.colShippedQty'), dataIndex: 'pushed_quantity', width: 90, align: 'right', render: formatQuantity },
                  { title: t('app.kuaizhizao.salesOrder.colShippableQty'), dataIndex: 'max_push_quantity', width: 90, align: 'right', render: formatQuantity },
                  {
                    title: (
                      <>
                        {t('app.kuaizhizao.salesOrder.pushShipmentLineWarehouse')}
                        <Typography.Text type="danger"> *</Typography.Text>
                      </>
                    ),
                    width: 160,
                    render: (_: unknown, row) => {
                      const itemId = Number(row.item_id);
                      const selected = pullSelectedItemIds.includes(itemId);
                      return (
                        <Select
                          style={{ width: '100%', minWidth: 140 }}
                          placeholder={t('app.kuaizhizao.shipmentNotice.selectOutboundWarehouse')}
                          showSearch
                          optionFilterProp="label"
                          disabled={!selected}
                          value={pullPreviewLineWh[itemId]}
                          options={pullPreviewWarehouseOptions}
                          onChange={(nv) => {
                            setPullPreviewLineWh((prev) => ({ ...prev, [itemId]: Number(nv) }));
                          }}
                        />
                      );
                    },
                  },
                  {
                    title: t('app.kuaizhizao.salesOrder.colShipQty'),
                    dataIndex: 'push_quantity',
                    width: 130,
                    render: (_: unknown, row) => {
                      const itemId = Number(row.item_id);
                      const maxQty = Number(row.max_push_quantity ?? 0);
                      return (
                        <InputNumber
                          min={0}
                          max={maxQty > 0 ? maxQty : undefined}
                          precision={2}
                          style={{ width: '100%' }}
                          disabled={!pullSelectedItemIds.includes(itemId) || maxQty <= 0}
                          value={pullQuantities[itemId]}
                          onChange={(val) => {
                            setPullQuantities((prev) => ({ ...prev, [itemId]: Number(val ?? 0) }));
                          }}
                        />
                      );
                    },
                  },
                ]}
              />
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('app.kuaizhizao.shipmentNotice.pullPreviewNoLines')} />
            )}
            {pullPreviewData.tip ? (
              <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>
                {pullPreviewData.tip}
              </Typography.Paragraph>
            ) : null}
          </div>
        ) : null}
      </Modal>

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
                  { title: t('app.kuaizhizao.salesOrder.quantity'), dataIndex: 'quantity', width: 90, align: 'right', render: formatQuantity },
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
        />
      </Suspense>
      {PrintModal}
    </>
  );
};

export default ShipmentNoticesPage;
