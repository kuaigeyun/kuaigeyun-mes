/**
 * 收货通知单管理页面
 *
 * 采购通知仓库收货，不直接动库存。来源为采购订单。
 * 行为与发货通知单对齐：ProForm、Row/Col、Form.List、编号规则、UniWarehouseSelect、UniMaterialSelect。
 *
 * @author RiverEdge Team
 * @date 2026-02-22
 */

import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { rowActionKind } from '../../../../../components/uni-action';
import { ActionConfirmPopconfirm } from '../../../../../components/action-confirm';
import { useInvalidateMenuBadgeCounts } from '../../../../../hooks/useInvalidateMenuBadgeCounts';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { LinkedDocumentCode } from '../../../../../components/linked-document-code';
import { ActionType, ProColumns, ProDescriptionsItemProps, ProForm, ProFormText, ProFormDatePicker, ProFormTextArea, ProFormItem } from '@ant-design/pro-components';
import {
  App,
  Button,
  Tag,
  Space,
  Modal,
  Table,
  Form as AntForm,
  Select,
  InputNumber,
  Input,
  Row,
  Col,
  Typography,
  Descriptions,
  Empty,
  Dropdown,
  Spin,
  theme,
  Alert,
} from 'antd';
import { PlusOutlined, SendOutlined, AppstoreAddOutlined, ImportOutlined, DownOutlined, RollbackOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { UniTable, readPersistedUniTableViewType } from '../../../../../components/uni-table';
import { buildDocumentListHelpViewConfig, DOCUMENT_LIST_HELP_KEYS } from '../../../../../components/page-help-wiki';
import { UniCapabilityBatchButton } from '../../../../../components/uni-batch';
import {
  UniTableStackedPrimaryCell,
  UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
  MaterialStackedCell,
} from '../../../../../components/uni-table/stackedPrimaryColumn';
import {
  DOCUMENT_LINE_MATERIALS_COLUMN_WIDTH_FLAGS,
  renderDocumentLineMaterialsPreview,
} from '../../sales-management/shared/documentLineMaterialsPreview';
import { UniMaterialSelect } from '../../../../../components/uni-material-select';
import { UniMaterialBatchPicker } from '../../../../../components/uni-material-batch-picker';
import type { Material } from '../../../../master-data/types/material';
import { UniWarehouseSelect } from '../../../../../components/uni-warehouse-select';
import { UniTableDetail } from '../../../../../components/uni-table-detail';
import {
  ListPageTemplate,
  DetailDrawerTemplate,
  DetailDrawerActions,
  FormModalTemplate,
  DRAWER_CONFIG,
  MODAL_CONFIG,
  useDetailDrawerDescriptionItems,
  type StatCard,
} from '../../../../../components/layout-templates';
import { UniPullCreateToolbar } from '../../../../../components/uni-pull';
import {
  UniPullQueryModal,
  isPullableScope,
  renderPullCapabilityTag,
  useUniPullQuery,
} from '../../../../../components/uni-pull-query';
import { SimpleSparkline } from '../../../../../components';
import { UniLifecycle, UniLifecycleStepper } from '../../../../../components/uni-lifecycle';
import { DocumentTrackingTimelineBody, useDocumentTracking } from '../../../../../components/document-tracking-panel';
import { WarehouseTraceBriefPrimaryActions } from '../../warehouse-management/WarehouseTraceBriefFooter';
import { receiptNoticeApi, type ReceiptNotice, type ReceiptNoticeNotifyPreviewResponse } from '../../../services/receipt-notice';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import {
  receiptNoticeBatchNotifyAllowed,
  receiptNoticeBatchWithdrawAllowed,
  receiptNoticeCapabilityReasonMessage,
} from '../../../../../hooks/useDocumentCapabilities';
import {
  buildReceiptNoticeLifecycleValueEnum,
  getReceiptNoticeLifecycle,
  LIST_LIFECYCLE_STAGE_FIELD,
  resolveReceiptNoticeListLifecycleParams,
} from '../../../utils/receiptNoticeLifecycle';
import { ListUniLifecycleCell } from '../../sales-management/shared/ListUniLifecycleCell';
import { alignProColumns, alignDescriptionColumns, SALES_DOC_LIST_FIELD_RANK } from '../../sales-management/shared/documentFieldAlignment';
import { DocumentPushProgressBar, DOCUMENT_PROGRESS_COLUMN_DEFAULTS, DETAIL_TABLE_PROGRESS_COLUMN_DEFAULTS } from '../../sales-management/shared/DocumentPushProgressBar';
import {
  collectReceiptInboundPushDocuments,
  receiptNoticeInboundPushPercent,
} from '../../sales-management/shared/pushProgress';
import { buildDocumentAuditColumns } from '../../shared/documentAuditColumns';
import { flattenDocumentDetailRows, resolveDetailTableViewMode } from '../../shared/detailTableFlatRows';
import {
  KUAIZHIZAO_DOC_HOST,
  loadSupplierFormReferenceList,
} from '../../../../../utils/documentFormReferenceLoad';
import { extractProTableSort } from '../../../../../utils/tableQueryKey';
import { formDateRangeFormItemProps } from '../../../../../utils/formDate';
import type { ReceiptNoticeListParams } from '../../../services/receipt-notice';
import {
  listPurchaseOrders,
  getPurchaseOrder,
  listPurchaseOrderReceiptNoticePullLines,
  pullReceiptNoticesFromPurchaseOrderItems,
  type PurchaseOrder,
  type PurchaseOrderReceiptPullLine,
} from '../../../services/purchase';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';
import { testGenerateCode, generateCode, getCodeRulePageConfig } from '../../../../../services/codeRule';
import { isAutoGenerateEnabled, getPageRuleCode } from '../../../../../utils/codeRulePage';
import { buildFutureDateShortcutFieldProps } from '../../../../../utils/futureDatePickerShortcuts';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { useTranslation } from 'react-i18next';
import { useNumericPrecision } from '../../../../../hooks/useNumericPrecision';
import { ROUTES } from '../../../constants/routes';
import { inboundReceiptNoticeEntryPath } from '../../warehouse-management/inbound/inboundPaths';
import { buildKuaizhizaoPullCreateMenuItems, resolveKuaizhizaoDocumentAction } from '../../../constants/documentActionRegistry';
import { buildUniPushMenuItems, buildUniPushToolbarDisabledReason, UniPushToolbarButton } from '../../../../../components/uni-push';
import DocumentAttachmentsField from '../../../components/DocumentAttachmentsField';
import {
  DocumentAttachmentsReadonly,
  documentAttachmentsFromRecord,
  hasDocumentAttachments,
} from '../../../components/DocumentAttachmentsReadonly';
import { mapAttachmentsToUploadList, normalizeDocumentAttachments } from '../../../utils/documentAttachments';
import { formatBusinessDateOnly, formatDateTime, formatQuantity } from '../../../../../utils/format';
import { QuantityWithUnitDisplay } from '../../../../../components/quantity-with-unit';
import { withSingleNewShortcutHint } from '../../../../../utils/globalNewShortcut';
interface ReceiptNoticeDetail extends ReceiptNotice {
  items?: { id?: number; material_code: string; material_name: string; material_unit: string; notice_quantity: number; unit_price?: number; total_amount?: number }[];
}

type ReceiptNoticeItemRow = {
  _rowKey: string;
  id?: number;
  notice_id: number;
  notice_code?: string;
  supplier_name?: string;
  purchase_order_code?: string;
  warehouse_name?: string;
  planned_receipt_date?: string;
  notified_at?: string;
  status?: string;
  purchase_receipt_id?: number;
  lifecycle?: Record<string, unknown>;
  material_code?: string;
  material_name?: string;
  material_unit?: string;
  notice_quantity?: number;
  unit_price?: number;
  total_amount?: number;
};

const RECEIPT_NOTICE_LIST_PERSISTENCE_ID =
  'apps.kuaizhizao.pages.purchase-management.receipt-notices-width-v1';

type PullPurchaseOrderCandidate = PurchaseOrderReceiptPullLine;

const RN_STAT_SPARK_1 = [10, 12, 11, 13, 14, 15, 16];
const RN_STAT_SPARK_2 = [6, 8, 7, 9, 8, 10, 9];
const RN_STAT_SPARK_3 = [4, 3, 5, 4, 6, 5, 7];
const RN_STAT_SPARK_4 = [18, 20, 22, 24, 26, 28, 30];

const RN_DETAIL_ITEMS_MIN_WIDTH = 960;

const RECEIPT_NOTICE_RESOURCE = 'kuaizhizao:receipt-notice';

const ReceiptNoticesPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { quantity: quantityDecimals, price: priceDecimals } = useNumericPrecision();
  const navigate = useNavigate();
  const { token } = theme.useToken();
  const receiptNoticeDetailDrawerZIndex = token.zIndexPopupBase;
  const { message: messageApi, modal: modalApi } = App.useApp();
  const pullFromPurchaseOrderAction = resolveKuaizhizaoDocumentAction(t, 'receipt_notice.pull_from_purchase_order');
  const pushToPurchaseReceiptAction = resolveKuaizhizaoDocumentAction(t, 'purchase_receipt.pull_from_receipt_notice');
  const defaultUnit = t('app.kuaizhizao.shipmentNotice.defaultUnit');
  const defaultReceiptItem = useMemo(
    () => ({
      material_id: undefined,
      material_code: '',
      material_name: '',
      material_unit: defaultUnit,
      notice_quantity: 1,
      unit_price: 0,
    }),
    [defaultUnit],
  );
  const statusMap = useMemo(
    () => ({
      待收货: { text: t('app.kuaizhizao.receiptNotice.statusPendingReceipt'), color: 'default' },
      已通知: { text: t('app.kuaizhizao.shipmentNotice.statusNotified'), color: 'processing' },
      已入库: { text: t('app.kuaizhizao.receiptNotice.statusReceived'), color: 'success' },
    }),
    [t, i18n.language],
  );
  const actionRef = useRef<ActionType>(null);
  const [searchParams] = useSearchParams();
  const highlightOpenedRef = useRef(false);
  const tableRowsRef = useRef<ReceiptNotice[]>([]);
  const [viewTypeState, setViewTypeState] = useState<'table' | 'detailTable' | 'help'>(() =>
    readPersistedUniTableViewType(RECEIPT_NOTICE_LIST_PERSISTENCE_ID, 'table', [
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
  const receiptNoticeLifecycleValueEnum = useMemo(() => buildReceiptNoticeLifecycleValueEnum(t), [t]);
  const [supplierList, setSupplierList] = useState<Array<{ id: number; name?: string; code?: string }>>([]);

  useEffect(() => {
    void loadSupplierFormReferenceList(KUAIZHIZAO_DOC_HOST.receiptNotice).then(setSupplierList);
  }, []);

  const receiptNoticeSupplierSearchOptions = useMemo(
    () =>
      supplierList.map((s) => ({
        value: Number(s.id),
        label: [s.name, s.code].filter(Boolean).join(' - ') || String(s.id),
      })),
    [supplierList],
  );

  const receiptNoticePerms = useResourcePermissions(RECEIPT_NOTICE_RESOURCE);
  const invalidateMenuBadgeCounts = useInvalidateMenuBadgeCounts();
  const [statsVersion, setStatsVersion] = useState(0);
  const [localStats, setLocalStats] = useState({ total: 0, pending: 0, notified: 0, received: 0 });

  const refreshLocalStats = useCallback(async () => {
    const stats = await receiptNoticeApi.statistics();
    setLocalStats({
      total: stats.total,
      pending: stats.pending,
      notified: stats.notified,
      received: stats.received,
    });
  }, []);

  useEffect(() => {
    refreshLocalStats();
  }, [statsVersion, refreshLocalStats]);
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [noticeDetail, setNoticeDetail] = useState<ReceiptNoticeDetail | null>(null);
  const receiptNoticeLifecycle = useMemo(
    () => (noticeDetail ? getReceiptNoticeLifecycle(noticeDetail as unknown as Record<string, unknown>, t) : null),
    [noticeDetail, t],
  );

  const pullSourceOrderIdRef = useRef<number | undefined>(undefined);
  const [pullSourceOrderId, setPullSourceOrderId] = useState<number | undefined>();
  const [pullSourceOrderOptions, setPullSourceOrderOptions] = useState<Array<{ value: number; label: string }>>([]);

  const [notifyPreviewOpen, setNotifyPreviewOpen] = useState(false);
  const [notifyPreviewLoading, setNotifyPreviewLoading] = useState(false);
  const [notifyPreviewConfirming, setNotifyPreviewConfirming] = useState(false);
  const [notifyPreviewData, setNotifyPreviewData] = useState<ReceiptNoticeNotifyPreviewResponse | null>(null);
  const [notifyPreviewTarget, setNotifyPreviewTarget] = useState<ReceiptNotice | null>(null);
  const [rnTrackingRefreshKey, setRnTrackingRefreshKey] = useState(0);
  const receiptNoticeTracking = useDocumentTracking(
    detailDrawerVisible && noticeDetail?.id ? 'receipt_notice' : undefined,
    noticeDetail?.id,
    rnTrackingRefreshKey,
  );

  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const selectedNoticesForBatch = useMemo(
    () =>
      selectedRowKeys
        .map((key) => tableRowsRef.current.find((row) => String(row.id) === String(key)))
        .filter((row): row is ReceiptNotice => row != null),
    [selectedRowKeys],
  );

  const selectedNoticeForToolbar = useMemo(() => {
    if (selectedRowKeys.length !== 1) return null;
    const id = Number(selectedRowKeys[0]);
    if (!Number.isFinite(id) || id <= 0) return null;
    return tableRowsRef.current.find((row) => row.id === id) ?? null;
  }, [selectedRowKeys]);

  const canPushPurchaseReceiptToolbar = !!selectedNoticeForToolbar
    && selectedNoticeForToolbar.capabilities?.withdraw?.allowed === true
    && !selectedNoticeForToolbar.purchase_receipt_id;

  const toolbarPushDisabledReason = useMemo(() => {
    const base = buildUniPushToolbarDisabledReason(t, {
      selectedCount: selectedRowKeys.length,
      hasSelectedRecord: !!selectedNoticeForToolbar,
    });
    if (base) return base;
    if (selectedNoticeForToolbar && !canPushPurchaseReceiptToolbar) {
      if (selectedNoticeForToolbar.purchase_receipt_id) {
        return t('app.kuaizhizao.receiptNotice.capability.notify.already_notified', {
          defaultValue: '该收货通知单已关联采购入库单',
        });
      }
      return receiptNoticeCapabilityReasonMessage(
        selectedNoticeForToolbar.capabilities?.withdraw?.reason,
        t,
      ) || t('components.uniPush.disabled.unavailable');
    }
    return undefined;
  }, [canPushPurchaseReceiptToolbar, selectedNoticeForToolbar, selectedRowKeys.length, t]);

  const toolbarPushMenuItems = useMemo(() => {
    const pushBlockedReason = selectedNoticeForToolbar && !canPushPurchaseReceiptToolbar
      ? (selectedNoticeForToolbar.purchase_receipt_id
        ? t('app.kuaizhizao.receiptNotice.capability.notify.already_notified', {
          defaultValue: '该收货通知单已关联采购入库单',
        })
        : receiptNoticeCapabilityReasonMessage(
            selectedNoticeForToolbar.capabilities?.withdraw?.reason,
            t,
          ))
      : undefined;
    return buildUniPushMenuItems([
      {
        key: 'push-purchase-receipt',
        label: pushToPurchaseReceiptAction.label,
        disabled: !selectedNoticeForToolbar || !canPushPurchaseReceiptToolbar,
        title: pushBlockedReason,
        onClick: () => {
          if (selectedNoticeForToolbar && canPushPurchaseReceiptToolbar) {
            handlePushToInboundEntry(selectedNoticeForToolbar);
          }
        },
      },
    ]);
  }, [canPushPurchaseReceiptToolbar, pushToPurchaseReceiptAction.label, selectedNoticeForToolbar, t]);

  const createFormRef = useRef<any>(null);
  const editFormRef = useRef<any>(null);
  const [pendingEditFormValues, setPendingEditFormValues] = useState<Record<string, any> | null>(null);
  const [materialPickerOpen, setMaterialPickerOpen] = useState(false);
  const [purchaseOrderList, setPurchaseOrderList] = useState<any[]>([]);
  const [previewCode, setPreviewCode] = useState<string | null>(null);
  const [effectiveRuleCode, setEffectiveRuleCode] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const ordersRes = await listPurchaseOrders({ limit: 500 }).catch(() => ({ data: [], total: 0 }));
        setPurchaseOrderList(ordersRes?.data || []);
      } catch (e) {
        window.console.error(t('app.kuaizhizao.receiptNotice.loadPurchaseOrdersFailed'), e);
      }
    };
    load();
  }, []);

  const appendReceiptNoticeItemsFromMaterials = useCallback(
    (selected: Material[]) => {
      const current = createFormRef.current?.getFieldValue('items') ?? [];
      const newRows = selected.map((m) => ({
        material_id: m.id,
        material_code: m.mainCode ?? m.code ?? '',
        material_name: m.name ?? '',
        material_unit: m.baseUnit ?? defaultUnit,
        notice_quantity: 1,
        unit_price: 0,
      }));
      createFormRef.current?.setFieldsValue({ items: [...current, ...newRows] });
      messageApi.success(t('app.kuaizhizao.common.materialBatchAdded', { count: selected.length }));
    },
    [defaultUnit, messageApi, t]
  );

  const handleDetail = async (record: ReceiptNotice) => {
    try {
      const detail = await receiptNoticeApi.get(record.id!.toString());
      setNoticeDetail(detail as ReceiptNoticeDetail);
      setDetailDrawerVisible(true);
      setRnTrackingRefreshKey((k) => k + 1);
    } catch {
      messageApi.error(t('app.kuaizhizao.receiptNotice.detailFailed'));
    }
  };

  useEffect(() => {
    const highlightRaw = searchParams.get('highlight')?.trim();
    if (!highlightRaw) {
      highlightOpenedRef.current = false;
      actionRef.current?.reload();
      return;
    }
    if (highlightOpenedRef.current) {
      actionRef.current?.reload();
      return;
    }
    highlightOpenedRef.current = true;
    void (async () => {
      try {
        const id = Number(highlightRaw);
        if (Number.isFinite(id) && id > 0) {
          await handleDetail({ id });
        }
      } catch {
        messageApi.error(t('app.kuaizhizao.receiptNotice.detailFailed'));
      } finally {
    actionRef.current?.reload();
      }
    })();
  }, [searchParams, messageApi, t]);

  const handleEdit = async (record: ReceiptNotice) => {
    try {
      const detail = await receiptNoticeApi.get(record.id!.toString()) as ReceiptNoticeDetail;
      const itemsForm = (detail.items || []).map((it: any) => ({
        material_id: it.material_id,
        material_code: it.material_code || '',
        material_name: it.material_name || '',
        material_unit: it.material_unit || defaultUnit,
        notice_quantity: Number(it.notice_quantity) || 0,
        unit_price: Number(it.unit_price) || 0,
      }));
      setPendingEditFormValues({
        purchase_order_id: detail.purchase_order_id,
        purchase_order_code: detail.purchase_order_code,
        supplier_id: detail.supplier_id,
        supplier_name: detail.supplier_name,
        supplier_contact: detail.supplier_contact,
        supplier_phone: detail.supplier_phone,
        warehouse_id: detail.warehouse_id,
        warehouse_name: detail.warehouse_name,
        planned_receipt_date: detail.planned_receipt_date ? dayjs(detail.planned_receipt_date) : undefined,
        notes: detail.notes,
        attachments: mapAttachmentsToUploadList(detail.attachments),
        items: itemsForm.length ? itemsForm : [defaultReceiptItem],
      });
      setEditingId(record.id!);
      setEditModalVisible(true);
    } catch {
      messageApi.error(t('app.kuaizhizao.shipmentNotice.loadDetailFailed'));
    }
  };

  const resetNotifyPreviewModal = useCallback(() => {
    setNotifyPreviewOpen(false);
    setNotifyPreviewData(null);
    setNotifyPreviewTarget(null);
  }, []);

  const executeNotify = useCallback(
    async (record: ReceiptNotice) => {
      const res = (await receiptNoticeApi.notify(record.id!.toString())) as ReceiptNotice;
      messageApi.success(
        res?.purchase_receipt_code
          ? t('app.kuaizhizao.receiptNotice.notifySuccessWithDraft', { receiptCode: res.purchase_receipt_code })
          : t('app.kuaizhizao.receiptNotice.notifySuccess'),
      );
      setStatsVersion((v) => v + 1);
      if (noticeDetail?.id === record.id) {
        const fresh = await receiptNoticeApi.get(record.id!.toString());
        setNoticeDetail(fresh as ReceiptNoticeDetail);
      }
      invalidateMenuBadgeCounts();
      actionRef.current?.reload();
    },
    [invalidateMenuBadgeCounts, messageApi, noticeDetail?.id, t],
  );

  const loadNotifyPreview = useCallback(
    async (record: ReceiptNotice) => {
      setNotifyPreviewLoading(true);
      try {
        const res = await receiptNoticeApi.previewNotify(record.id!.toString());
        setNotifyPreviewData(res);
      } catch (error: unknown) {
        messageApi.error(getApiErrorMessage(error, t('app.kuaizhizao.receiptNotice.notifyPreviewFailed')));
        resetNotifyPreviewModal();
      } finally {
        setNotifyPreviewLoading(false);
      }
    },
    [messageApi, resetNotifyPreviewModal, t],
  );

  const handleNotify = useCallback(
    (record: ReceiptNotice) => {
      setNotifyPreviewOpen(true);
      setNotifyPreviewConfirming(false);
      setNotifyPreviewData(null);
      setNotifyPreviewTarget(record);
      void loadNotifyPreview(record);
    },
    [loadNotifyPreview],
  );

  const handleNotifyPreviewConfirm = useCallback(async () => {
    if (!notifyPreviewTarget?.id || !notifyPreviewData) return;
    if (notifyPreviewData.has_blocking_issues) return;
    setNotifyPreviewConfirming(true);
    try {
      await executeNotify(notifyPreviewTarget);
      resetNotifyPreviewModal();
    } catch (error: unknown) {
      messageApi.error(getApiErrorMessage(error, t('app.kuaizhizao.shipmentNotice.notifyFailed')));
    } finally {
      setNotifyPreviewConfirming(false);
    }
  }, [executeNotify, messageApi, notifyPreviewData, notifyPreviewTarget, resetNotifyPreviewModal, t]);

  const executeWithdraw = async (record: ReceiptNotice) => {
    try {
          await receiptNoticeApi.withdraw(record.id!.toString());
          messageApi.success(t('app.kuaizhizao.receiptNotice.withdrawSuccess'));
          setStatsVersion((v) => v + 1);
          if (noticeDetail?.id === record.id) {
            const fresh = await receiptNoticeApi.get(record.id!.toString());
            setNoticeDetail(fresh as ReceiptNoticeDetail);
          }
          invalidateMenuBadgeCounts();
    actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || t('app.kuaizhizao.shipmentNotice.withdrawFailed'));
        }
  };

  const handleWithdraw = (record: ReceiptNotice) => {
    modalApi.confirm({
      title: t('app.kuaizhizao.shipmentNotice.withdrawNotify'),
      content: t('app.kuaizhizao.receiptNotice.withdrawConfirmContent', { code: record.notice_code }),
      onOk: () => executeWithdraw(record),
    });
  };

  const handlePushToInboundEntry = (record: ReceiptNotice) => {
    if (!record.id) return;
    navigate(inboundReceiptNoticeEntryPath(record.id));
  };

  const executeDelete = async (record: ReceiptNotice) => {
    try {
          await receiptNoticeApi.delete(record.id!.toString());
          messageApi.success(t('common.deleteSuccess'));
          if (noticeDetail?.id === record.id) {
            setNoticeDetail(null);
            setDetailDrawerVisible(false);
          }
          setStatsVersion((v) => v + 1);
          invalidateMenuBadgeCounts();
    actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || t('common.deleteFailed'));
        }
  };

  const handleDelete = (record: ReceiptNotice) => {
    modalApi.confirm({
      title: t('app.kuaizhizao.receiptNotice.deleteModalTitle'),
      content: t('app.kuaizhizao.shipmentNotice.deleteConfirmContent', { code: record.notice_code }),
      onOk: () => executeDelete(record),
    });
  };

  const handleBatchDelete = async (keys: React.Key[]) => {
    if (keys.length === 0) return;
    try {
      for (const k of keys) {
        await receiptNoticeApi.delete(String(k));
      }
      messageApi.success(t('app.kuaizhizao.receiptNotice.batchDeleteSuccess', { count: keys.length }));
      setSelectedRowKeys([]);
      setStatsVersion((v) => v + 1);
      invalidateMenuBadgeCounts();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error?.message || t('common.batchDeleteFailed'));
    }
  };

  const columns: ProColumns<ReceiptNotice>[] = useMemo(
    () => alignProColumns<ReceiptNotice>([
      {
        title: t('app.kuaizhizao.receiptNotice.plannedReceiptDate'),
        dataIndex: 'planned_receipt_date_range',
        valueType: 'dateRange',
        hideInTable: true,
        fieldProps: {
          placeholder: [t('app.kuaizhizao.quotation.dateRangeStart'), t('app.kuaizhizao.quotation.dateRangeEnd')],
        },
        formItemProps: formDateRangeFormItemProps,
      },
      {
        title: t('app.kuaizhizao.receiptNotice.colSupplierNotice'),
        key: 'notice_code',
        dataIndex: 'notice_code',
        width: 240,
        minWidth: 240,
        uniTableKeepWidth: true,
        uniTablePrimaryFlex: false,
        resizable: false,
        fixed: 'left',
        sorter: true,
        render: (_, r) => (
          <UniTableStackedPrimaryCell
            primary={String(r.supplier_name ?? '')}
            secondary={String(r.notice_code ?? '')}
          />
        ),
      },
      { title: t('app.kuaizhizao.shipmentNotice.noticeCode'), dataIndex: 'notice_code', hideInTable: true, hideInSearch: false },
      {
        title: t('app.kuaizhizao.receiptNotice.supplier'),
        dataIndex: 'supplier_id',
        hideInTable: true,
        valueType: 'select',
        fieldProps: {
          showSearch: true,
          optionFilterProp: 'label',
          options: receiptNoticeSupplierSearchOptions,
          placeholder: t('app.kuaizhizao.receiptNotice.supplier'),
        },
      },
      { title: t('app.kuaizhizao.receiptNotice.supplier'), dataIndex: 'supplier_name', hideInTable: true, hideInSearch: true },
      {
        title: t('app.kuaizhizao.common.colLineMaterials'),
        ...DOCUMENT_LINE_MATERIALS_COLUMN_WIDTH_FLAGS,
        // 收货通知专用段位：主标识后、入库仓库前
        key: 'receipt_line_materials',
        dataIndex: 'receipt_line_materials',
        render: (_, r) => renderDocumentLineMaterialsPreview(r.items, t),
      },
      {
        title: t('app.kuaizhizao.receiptNotice.inboundWarehouse'),
        key: 'inbound_warehouse',
        dataIndex: 'warehouse_name',
        width: 140,
        minWidth: 140,
        uniTableKeepWidth: true,
        resizable: false,
        ellipsis: true,
        sorter: true,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.receiptNotice.purchaseOrderCode'),
        key: 'receipt_purchase_order_code',
        dataIndex: 'purchase_order_code',
        width: 180,
        minWidth: 180,
        uniTableKeepWidth: true,
        resizable: false,
        sorter: true,
        hideInSearch: false,
        // 单号由 LinkedDocumentCode 自行省略；列上 ellipsis 会与链接量宽冲突导致「完全折叠」
        ellipsis: false,
        render: (_, r) => (
          <LinkedDocumentCode
            documentType="purchase_order"
            documentId={r.purchase_order_id}
            code={r.purchase_order_code}
          />
        ),
      },
      {
        title: t('app.kuaizhizao.receiptNotice.receiptConversion'),
        key: 'receipt_inbound_conversion',
        dataIndex: 'purchase_receipt_code',
        width: 180,
        minWidth: 180,
        uniTableKeepWidth: true,
        resizable: false,
        hideInSearch: true,
        render: (_, r) => {
          if (r.purchase_receipt_id) {
            return (
              <UniTableStackedPrimaryCell
                record={r as Record<string, unknown>}
                secondaryKeys={['purchase_receipt_code']}
                primary={t('app.kuaizhizao.receiptNotice.pulledToInbound')}
                secondary={String(r.purchase_receipt_code || `#${r.purchase_receipt_id}`)}
              />
            );
          }
          return (
            <UniTableStackedPrimaryCell
              primary={t('app.kuaizhizao.receiptNotice.notPulled')}
              secondary="-"
              secondaryCopyable={false}
            />
          );
        },
      },
      {
        title: t('app.kuaizhizao.salesManagement.pushProgress.title'),
        dataIndex: 'inbound_push_progress',
        ...DOCUMENT_PROGRESS_COLUMN_DEFAULTS,
        render: (_, r) => {
          const percent = receiptNoticeInboundPushPercent(r);
          return (
            <DocumentPushProgressBar
              percent={percent}
              tooltip={t('app.kuaizhizao.salesManagement.pushProgress.outboundTooltip', {
                percent,
                status: percent >= 100
                  ? t('app.kuaizhizao.salesManagement.pushProgress.pushed')
                  : t('app.kuaizhizao.salesManagement.pushProgress.notPushed'),
              })}
              documents={collectReceiptInboundPushDocuments(
                r,
                t('components.documentTrackingPanel.docType.purchase_receipt'),
              )}
              formatMoreDocs={(count) =>
                t('app.kuaizhizao.salesManagement.pushProgress.moreDocs', { count })
              }
            />
          );
        },
      },
      {
        title: t('app.kuaizhizao.receiptNotice.plannedReceiptDate'),
        dataIndex: 'planned_receipt_date',
        valueType: 'date',
        width: 132,
        minWidth: 132,
        uniTableKeepWidth: true,
        resizable: false,
        sorter: true,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.shipmentNotice.notifiedAt'),
        dataIndex: 'notified_at',
        width: 160,
        minWidth: 160,
        uniTableKeepWidth: true,
        resizable: false,
        sorter: true,
        hideInSearch: true,
        render: (_, r) => (r.notified_at ? formatDateTime(r.notified_at, 'YYYY-MM-DD HH:mm') : '-'),
      },
      ...buildDocumentAuditColumns<ReceiptNotice>(t),
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
        title: t('app.kuaizhizao.salesOrder.lifecycle'),
        key: 'lifecycle',
        dataIndex: LIST_LIFECYCLE_STAGE_FIELD,
        fixed: 'right',
        valueType: 'select',
        valueEnum: receiptNoticeLifecycleValueEnum,
        render: (_, record) => (
          <ListUniLifecycleCell lifecycle={getReceiptNoticeLifecycle(record as unknown as Record<string, unknown>, t)} />
        ),
      },
      {
        title: t('common.actions'),
        key: 'option',
        valueType: 'option',
        fixed: 'right',
        hideInSearch: true,
        render: (_, record) => {
          const parts: React.ReactNode[] = [
            <Button {...rowActionKind('read')}
              key="d"
              type="link"
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                handleDetail(record);
              }}
            >
              {t('common.detail')}
            </Button>,
          ];
          if (record.capabilities?.update?.allowed === true) {
            parts.push(
              <Button {...rowActionKind('update')}
                key="e"
                type="link"
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  handleEdit(record);
                }}
              >
                {t('common.edit')}
              </Button>
            );
          }
          if (record.capabilities?.notify?.allowed === true) {
            parts.push(
              <Button {...rowActionKind('dispatch')}
                key="n"
                type="link"
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  handleNotify(record);
                }}
              >
                {t('app.kuaizhizao.shipmentNotice.notifyWarehouse')}
              </Button>
            );
          }
          if (record.capabilities?.delete?.allowed === true) {
            parts.push(
              <Button {...rowActionKind('delete')}
                key="del"
                type="link"
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(record);
                }}
              >
                {t('common.delete')}
              </Button>
            );
          }
          if (record.capabilities?.withdraw?.allowed === true) {
            parts.push(
              <Button {...rowActionKind('revoke')}
                key="w"
                type="link"
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  handleWithdraw(record);
                }}
              >
                {t('app.kuaizhizao.shipmentNotice.withdrawNotify')}
              </Button>
            );
          }
          if (record.purchase_receipt_id) {
            parts.push(
              <Button {...rowActionKind('read')}
                key="to-pr"
                type="link"
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`${ROUTES.WM_INBOUND}?receipt_type=purchase&receipt_id=${record.purchase_receipt_id}`);
                }}
              >
                {t('app.kuaizhizao.receiptNotice.viewInboundReceipt')}
              </Button>
            );
          }
          return parts;
        },
      },
    ], SALES_DOC_LIST_FIELD_RANK),
    [handleDelete, handleDetail, handleEdit, handleNotify, handleWithdraw, navigate, receiptNoticeLifecycleValueEnum, receiptNoticeSupplierSearchOptions, t, i18n.language],
  );

  const detailTableColumns: ProColumns<ReceiptNoticeItemRow>[] = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.receiptNotice.colSupplierNotice'),
        key: 'notice_code',
        dataIndex: 'notice_code',
        ...UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
        fixed: 'left',
        hideInSearch: false,
        fieldProps: { placeholder: t('app.kuaizhizao.shipmentNotice.noticeCode') },
        render: (_, record) => (
          <UniTableStackedPrimaryCell
            primary={String(record.supplier_name ?? '')}
            secondary={String(record.notice_code ?? '')}
          />
        ),
      },
      {
        title: t('app.kuaizhizao.shipmentNotice.noticeCode'),
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
        title: t('app.kuaizhizao.receiptNotice.plannedReceiptDate'),
        dataIndex: 'planned_receipt_date',
        width: 132,
        uniTableKeepWidth: true,
        hideInSearch: true,
        render: (_: unknown, row) =>
          row.planned_receipt_date ? formatDateTime(row.planned_receipt_date, 'YYYY-MM-DD') : '-',
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
        key: 'line_inbound_progress',
        ...DETAIL_TABLE_PROGRESS_COLUMN_DEFAULTS,
        render: (_: unknown, record) => {
          const percent = receiptNoticeInboundPushPercent(record);
          return (
            <DocumentPushProgressBar
              percent={percent}
              tooltip={t('app.kuaizhizao.salesManagement.pushProgress.outboundTooltip', {
                percent,
                status: percent >= 100
                  ? t('app.kuaizhizao.salesManagement.pushProgress.pushed')
                  : t('app.kuaizhizao.salesManagement.pushProgress.notPushed'),
              })}
              documents={collectReceiptInboundPushDocuments(
                record,
                t('components.documentTrackingPanel.docType.purchase_receipt'),
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
        valueEnum: receiptNoticeLifecycleValueEnum,
        render: (_, record) => (
          <ListUniLifecycleCell
            lifecycle={getReceiptNoticeLifecycle(record as unknown as Record<string, unknown>, t)}
          />
        ),
      },
    ],
    [receiptNoticeLifecycleValueEnum, t],
  );

  const pullPurchaseOrderColumns = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.receiptNotice.purchaseOrderCode'),
        dataIndex: 'order_code',
        width: 168,
        ellipsis: true,
      },
      {
        title: t('app.kuaizhizao.salesOrder.materialName'),
        dataIndex: 'material_name',
        ellipsis: true,
        render: (_: unknown, record: PullPurchaseOrderCandidate) => (
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
        title: t('app.kuaizhizao.receiptNotice.supplier'),
        dataIndex: 'supplier_name',
        width: 140,
        ellipsis: true,
      },
      {
        title: t('app.kuaizhizao.purchaseRequisition.pull.convertStatus'),
        key: 'convert_status',
        width: 100,
        align: 'center' as const,
        render: (_: unknown, record: PullPurchaseOrderCandidate) =>
          renderPullCapabilityTag(
            Number(record.remaining_quantity ?? 0) > 0,
            t('app.kuaizhizao.purchaseRequisition.pull.canCreate'),
            t('app.kuaizhizao.purchaseRequisition.pull.cannotCreate'),
          ),
      },
    ],
    [t],
  );

  const createItemColumns = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.shipmentNotice.import.materialName'),
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
                <UniMaterialSelect
                  name={[index, 'material_id']}
                  label=""
                  placeholder={t('common.selectMaterial')}
                  required
                  size="small"
                  listFieldKey={index}
                  listFieldName="items"
                  fillMapping={{
                    material_code: 'mainCode',
                    material_name: 'name',
                    material_unit: 'baseUnit',
                  }}
                  fallbackOption={fallback}
                  formItemProps={{ style: { margin: 0 } }}
                  showQuickCreate
                  showAdvancedSearch
                skipFuzzyPinyinClientFilter
                />
              );
            }}
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
          <AntForm.Item
            name={[index, 'notice_quantity']}
            rules={[
              { required: true, message: t('common.required') },
              { type: 'number', min: 0.01, message: t('app.kuaizhizao.shipmentNotice.quantityPositive') },
            ]}
            style={{ margin: 0 }}
          >
            <InputNumber placeholder={t('common.quantity')} min={0} precision={quantityDecimals} style={{ width: '100%' }} size="small" />
          </AntForm.Item>
        ),
      },
      {
        title: t('app.kuaizhizao.shipmentNotice.import.unitPrice'),
        dataIndex: 'unit_price',
        width: 100,
        align: 'right' as const,
        render: (_: any, __: any, index: number) => (
          <AntForm.Item name={[index, 'unit_price']} style={{ margin: 0 }}>
            <InputNumber placeholder="0" min={0} precision={priceDecimals} style={{ width: '100%' }} size="small" />
          </AntForm.Item>
        ),
      },
    ],
    [t, i18n.language],
  );

  const editItemColumns = useMemo(
    () => [
      { title: t('app.kuaizhizao.shipmentNotice.import.materialCode'), dataIndex: 'material_code', width: 120 },
      { title: t('app.kuaizhizao.shipmentNotice.import.materialName'), dataIndex: 'material_name', width: 150 },
      { title: t('common.unit'), dataIndex: 'material_unit', width: 60 },
      { title: t('common.quantity'), dataIndex: 'notice_quantity', width: 90, align: 'right' as const, render: formatQuantity },
      { title: t('app.kuaizhizao.shipmentNotice.import.unitPrice'), dataIndex: 'unit_price', width: 90, align: 'right' as const },
    ],
    [t, i18n.language],
  );

  const detailItemColumns = useMemo(
    () => [
      { title: t('app.kuaizhizao.shipmentNotice.import.materialCode'), dataIndex: 'material_code', width: 120, ellipsis: true },
      { title: t('app.kuaizhizao.shipmentNotice.import.materialName'), dataIndex: 'material_name', width: 150, ellipsis: true },
      { title: t('common.unit'), dataIndex: 'material_unit', width: 60 },
      { title: t('common.quantity'), dataIndex: 'notice_quantity', width: 90, align: 'right' as const, render: formatQuantity },
      { title: t('app.kuaizhizao.shipmentNotice.import.unitPrice'), dataIndex: 'unit_price', width: 90, align: 'right' as const },
      { title: t('app.kuaizhizao.shipmentNotice.amount'), dataIndex: 'total_amount', width: 100, align: 'right' as const },
    ],
    [t, i18n.language],
  );

  const handleCreate = async () => {
    setPreviewCode(null);
    setEffectiveRuleCode(null);
    setEditingId(null);
    setCreateModalVisible(true);
    window.setTimeout(() => {
      createFormRef.current?.setFieldsValue({ items: [defaultReceiptItem] });
    }, 100);
    let ruleCode = getPageRuleCode('kuaizhizao-receipt-notice');
    let autoGenerate = isAutoGenerateEnabled('kuaizhizao-receipt-notice');
    try {
      const pageConfig = await getCodeRulePageConfig('kuaizhizao-receipt-notice');
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
          window.setTimeout(() => {
            createFormRef.current?.setFieldsValue({ notice_code: preview ?? '', items: [defaultReceiptItem] });
          }, 100);
        })
        .catch((e) => {
          window.console.warn(t('app.kuaizhizao.receiptNotice.codePreviewFailed'), e);
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

  const pullFromPurchaseOrderScopeOptions = useMemo(
    () => [
      { label: t('components.uniPullQuery.scopePullable'), value: 'pullable' },
      { label: t('components.uniPullQuery.scopeAll'), value: 'all' },
    ],
    [t],
  );

  const pullFromPurchaseOrderQuery = useUniPullQuery<PullPurchaseOrderCandidate>({
    rowKey: 'id',
    selectionType: 'checkbox',
    scopeOptions: pullFromPurchaseOrderScopeOptions,
    defaultScope: 'pullable',
    onOpen: () => {
      pullSourceOrderIdRef.current = undefined;
      setPullSourceOrderId(undefined);
      void listPurchaseOrders({ skip: 0, limit: 100 })
        .then((res) => {
          setPullSourceOrderOptions(
            (res?.data ?? [])
              .filter((row) => row.id != null && row.order_code)
              .map((row) => ({ value: row.id!, label: String(row.order_code) })),
          );
        })
        .catch((error: unknown) => {
          messageApi.error(getApiErrorMessage(error, t('app.kuaizhizao.receiptNotice.pull.loadSourceFailed')));
          setPullSourceOrderOptions([]);
        });
    },
    loadData: async ({ keyword, page, pageSize, scope }) => {
      try {
        const listRes = await listPurchaseOrderReceiptNoticePullLines({
          skip: (page - 1) * pageSize,
          limit: pageSize,
          keyword: keyword.trim() || undefined,
          order_id: pullSourceOrderIdRef.current,
          pullable_only: isPullableScope(scope),
        });
        return { data: listRes?.data ?? [], total: listRes?.total ?? 0 };
      } catch (error: unknown) {
        messageApi.error(getApiErrorMessage(error, t('app.kuaizhizao.receiptNotice.loadPurchaseOrdersFailed')));
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
        messageApi.warning(t('app.kuaizhizao.receiptNotice.pull.selectLinesFirst'));
        return;
      }
      try {
        const res = await pullReceiptNoticesFromPurchaseOrderItems(selectedIds);
        messageApi.success(
          res.message ||
            t('app.kuaizhizao.shipmentNotice.createFromSourceSuccess', {
              source: pullFromPurchaseOrderAction.sourceLabel,
              target: pullFromPurchaseOrderAction.targetLabel,
            }),
        );
        pullFromPurchaseOrderQuery.closeModal();
        setStatsVersion((v) => v + 1);
        invalidateMenuBadgeCounts();
    actionRef.current?.reload();
      } catch (error: unknown) {
        messageApi.error(
          getApiErrorMessage(
            error,
            t('app.kuaizhizao.shipmentNotice.createFromSourceFailed', {
              source: pullFromPurchaseOrderAction.sourceLabel,
              target: pullFromPurchaseOrderAction.targetLabel,
            }),
          ),
        );
      }
    },
  });

  const onPurchaseOrderSelect = async (orderId: number) => {
    let order = purchaseOrderList.find((o: any) => (o.id ?? o.purchase_order_id) === orderId);
    if (!order) return;
    try {
      const detail = await getPurchaseOrder(orderId);
      order = detail;
    } catch {
      // use list data
    }
    const code = order.order_code || order.purchase_order_code || order.code;
    createFormRef.current?.setFieldsValue({
      purchase_order_code: code,
      supplier_id: order.supplier_id,
      supplier_name: order.supplier_name,
      supplier_contact: order.supplier_contact,
      supplier_phone: order.supplier_phone,
    });
    if (order.items && order.items.length > 0) {
      const items = order.items.map((it: any) => ({
        material_id: it.material_id ?? it.materialId,
        material_code: it.material_code || it.materialCode || '',
        material_name: it.material_name || it.materialName || '',
        material_unit: it.unit || it.material_unit || it.materialUnit || defaultUnit,
        notice_quantity: Number(it.ordered_quantity ?? it.quantity) || 0,
        unit_price: Number(it.unit_price ?? it.unitPrice) || 0,
      }));
      createFormRef.current?.setFieldsValue({ items });
    }
  };
  useNewShortcut(handleCreate);
  const createButtonLabel = useMemo(
    () => withSingleNewShortcutHint(t('app.kuaizhizao.receiptNotice.create')),
    [t],
  );

  const handleCreateSubmit = async (values: any) => {
    const validItems = (values.items ?? []).filter((it: any) => it.material_id && (Number(it.notice_quantity) || 0) > 0);
    if (!validItems.length) {
      messageApi.error(t('app.kuaizhizao.shipmentNotice.itemsRequired'));
      throw new Error(t('app.kuaizhizao.shipmentNotice.itemsRequired'));
    }
    if (!values.purchase_order_id || !values.purchase_order_code) {
      messageApi.error(t('app.kuaizhizao.receiptNotice.selectPurchaseOrder'));
      throw new Error(t('app.kuaizhizao.receiptNotice.selectPurchaseOrder'));
    }
    const supplier = purchaseOrderList.find((o: any) => (o.id ?? o.purchase_order_id) === values.purchase_order_id) || {};
    let noticeCode = values.notice_code;
    const ruleCodeToUse = effectiveRuleCode || getPageRuleCode('kuaizhizao-receipt-notice');
    if (
      ruleCodeToUse &&
      (isAutoGenerateEnabled('kuaizhizao-receipt-notice') || effectiveRuleCode) &&
      (noticeCode === previewCode || !noticeCode)
    ) {
      try {
        const res = await generateCode({ rule_code: ruleCodeToUse });
        noticeCode = res.code;
      } catch (e) {
        window.console.warn(t('app.kuaizhizao.receiptNotice.codeGenerateFailed'), e);
      }
    }
    try {
      await receiptNoticeApi.create({
        notice_code: noticeCode || undefined,
        purchase_order_id: values.purchase_order_id,
        purchase_order_code: values.purchase_order_code,
        supplier_id: values.supplier_id ?? supplier.supplier_id,
        supplier_name: values.supplier_name ?? supplier.supplier_name,
        supplier_contact: values.supplier_contact,
        supplier_phone: values.supplier_phone,
        warehouse_id: values.warehouse_id,
        warehouse_name: values.warehouse_name,
        planned_receipt_date: values.planned_receipt_date ? formatDateTime(values.planned_receipt_date, 'YYYY-MM-DD') : undefined,
        notes: values.notes,
        attachments: normalizeDocumentAttachments(values.attachments),
        items: validItems.map((it: any) => ({
          material_id: it.material_id,
          material_code: it.material_code,
          material_name: it.material_name,
          material_unit: it.material_unit || defaultUnit,
          notice_quantity: Number(it.notice_quantity) || 0,
          unit_price: it.unit_price || 0,
        })),
      });
      messageApi.success(t('common.createSuccess'));
      setCreateModalVisible(false);
      setEffectiveRuleCode(null);
      setStatsVersion((v) => v + 1);
      invalidateMenuBadgeCounts();

      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('common.createFailed'));
      throw error;
    }
  };

  const handleEditSubmit = async (values: any) => {
    if (!editingId) return;
    try {
      await receiptNoticeApi.update(editingId.toString(), {
        supplier_contact: values.supplier_contact,
        supplier_phone: values.supplier_phone,
        warehouse_id: values.warehouse_id,
        warehouse_name: values.warehouse_name,
        planned_receipt_date: values.planned_receipt_date ? formatDateTime(values.planned_receipt_date, 'YYYY-MM-DD') : undefined,
        notes: values.notes,
        attachments: normalizeDocumentAttachments(values.attachments),
      });
      messageApi.success(t('common.updateSuccess'));
      setEditModalVisible(false);
      if (noticeDetail?.id === editingId) {
        const fresh = await receiptNoticeApi.get(editingId.toString());
        setNoticeDetail(fresh as ReceiptNoticeDetail);
      }
      invalidateMenuBadgeCounts();

      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('common.updateFailed'));
      throw error;
    }
  };

  const detailColumns: ProDescriptionsItemProps<ReceiptNoticeDetail>[] = useMemo(
    () =>
      alignDescriptionColumns([
        {
          title: t('app.kuaizhizao.shipmentNotice.noticeCode'),
          dataIndex: 'notice_code',
          render: (_, entity) => (
            <Typography.Text copyable={{ text: String(entity.notice_code ?? '') }}>{entity.notice_code ?? '-'}</Typography.Text>
          ),
        },
        {
          title: t('app.kuaizhizao.receiptNotice.purchaseOrderCode'),
          dataIndex: 'purchase_order_code',
        },
        { title: t('app.kuaizhizao.receiptNotice.supplier'), dataIndex: 'supplier_name' },
        { title: t('field.supplier.contactPerson'), dataIndex: 'supplier_contact' },
        { title: t('field.supplier.phone'), dataIndex: 'supplier_phone' },
        { title: t('app.kuaizhizao.receiptNotice.inboundWarehouse'), dataIndex: 'warehouse_name' },
        { title: t('app.kuaizhizao.receiptNotice.plannedReceiptDate'), dataIndex: 'planned_receipt_date', valueType: 'date' },
        { title: t('app.kuaizhizao.shipmentNotice.notifiedAt'), dataIndex: 'notified_at', valueType: 'dateTime' },
        {
          title: t('app.kuaizhizao.receiptNotice.linkedInboundReceipt'),
          dataIndex: 'purchase_receipt_code',
        },
        { title: t('common.remark'), dataIndex: 'notes', span: 3 },
      ] as ProDescriptionsItemProps<ReceiptNoticeDetail>[]),
    [t, i18n.language],
  );

  const renderCreateForm = () => (
    <>
      <Row gutter={16}>
        <Col span={8}>
          <ProFormText
            name="notice_code"
            label={t('app.kuaizhizao.shipmentNotice.noticeCode')}
            placeholder={isAutoGenerateEnabled('kuaizhizao-receipt-notice') ? t('app.kuaizhizao.receiptNotice.codeAutoPlaceholder') : t('app.kuaizhizao.receiptNotice.codeManualPlaceholder')}
            rules={[{ required: true, message: t('app.kuaizhizao.shipmentNotice.codeRequired') }]}
          />
        </Col>
        <Col span={8}>
          <ProForm.Item name="purchase_order_id" label={t('app.kuaizhizao.receiptNotice.purchaseOrder')} rules={[{ required: true, message: t('app.kuaizhizao.receiptNotice.selectPurchaseOrder') }]}>
            <Select
              placeholder={t('app.kuaizhizao.receiptNotice.selectPurchaseOrder')}
              showSearch
              optionFilterProp="label"
              options={purchaseOrderList.map((o: any) => ({
                value: o.id ?? o.purchase_order_id,
                label: `${o.order_code || o.purchase_order_code || o.code || ''} - ${o.supplier_name || ''}`,
              }))}
              onChange={onPurchaseOrderSelect}
            />
          </ProForm.Item>
        </Col>
        <Col span={8}>
          <ProFormText name="supplier_name" label={t('app.kuaizhizao.receiptNotice.supplier')} placeholder={t('app.kuaizhizao.receiptNotice.supplierPlaceholder')} rules={[{ required: true, message: t('app.kuaizhizao.receiptNotice.supplierRequired') }]} />
        </Col>
      </Row>
      <ProFormText name="purchase_order_code" hidden />
      <ProFormText name="supplier_id" hidden />
      <Row gutter={16}>
        <Col span={8}>
          <ProFormText name="supplier_contact" label={t('field.supplier.contactPerson')} placeholder={t('field.supplier.contactPersonPlaceholder')} />
        </Col>
        <Col span={8}>
          <ProFormText name="supplier_phone" label={t('field.supplier.phone')} placeholder={t('field.supplier.phonePlaceholder')} />
        </Col>
        <Col span={8}>
          <UniWarehouseSelect
            name="warehouse_id"
            label={t('app.kuaizhizao.receiptNotice.inboundWarehouse')}
            placeholder={t('app.kuaizhizao.receiptNotice.selectInboundWarehouse')}
            onChange={(val, wh) => createFormRef.current?.setFieldsValue({ warehouse_name: wh?.name ?? '' })}
          />
        </Col>
      </Row>
      <ProFormText name="warehouse_name" hidden />
      <Row gutter={16}>
        <Col span={8}>
          <ProFormDatePicker name="planned_receipt_date" label={t('app.kuaizhizao.receiptNotice.plannedReceiptDate')} fieldProps={buildFutureDateShortcutFieldProps({ getForm: () => createFormRef.current, fieldName: 'planned_receipt_date', t })} />
        </Col>
        <Col span={8} />
        <Col span={8} />
      </Row>
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
                items.push({ ...defaultReceiptItem });
                createFormRef.current?.setFieldsValue({ items });
              }}
            >
              {t('common.addDetail')}
            </Button>
            <Button
              type="default"
              icon={<AppstoreAddOutlined />}
              onClick={() => setMaterialPickerOpen(true)}
            >
              {t('app.kuaizhizao.common.materialBatchSelect')}
            </Button>
          </Space>
        )}
        columns={createItemColumns}
        disabledAdd
        minRows={1}
        initialValue={{ ...defaultReceiptItem }}
        tableProps={{
          size: 'small',
          style: { width: '100%', margin: 0 },
        }}
      />
      <ProFormTextArea name="notes" label={t('common.remark')} placeholder={t('common.remark')} fieldProps={{ rows: 2 }} colProps={{ span: 24 }} />
      <DocumentAttachmentsField category="receipt_notice_attachments" />
    </>
  );

  const renderEditForm = () => (
    <>
      <Row gutter={16}>
        <Col span={8}>
          <ProFormText name="purchase_order_code" label={t('app.kuaizhizao.receiptNotice.purchaseOrderCode')} disabled />
        </Col>
        <Col span={8}>
          <ProFormText name="supplier_name" label={t('app.kuaizhizao.receiptNotice.supplier')} disabled />
        </Col>
        <Col span={8}>
          <ProFormText name="supplier_contact" label={t('field.supplier.contactPerson')} placeholder={t('field.supplier.contactPersonPlaceholder')} />
        </Col>
      </Row>
      <Row gutter={16}>
        <Col span={8}>
          <ProFormText name="supplier_phone" label={t('field.supplier.phone')} placeholder={t('field.supplier.phonePlaceholder')} />
        </Col>
        <Col span={8}>
          <UniWarehouseSelect
            name="warehouse_id"
            label={t('app.kuaizhizao.receiptNotice.inboundWarehouse')}
            placeholder={t('app.kuaizhizao.receiptNotice.selectInboundWarehouse')}
            onChange={(val, wh) => editFormRef.current?.setFieldsValue({ warehouse_name: wh?.name ?? '' })}
          />
        </Col>
        <Col span={8}>
          <ProFormDatePicker name="planned_receipt_date" label={t('app.kuaizhizao.receiptNotice.plannedReceiptDate')} fieldProps={buildFutureDateShortcutFieldProps({ getForm: () => editFormRef.current, fieldName: 'planned_receipt_date', t })} />
        </Col>
      </Row>
      <ProFormText name="warehouse_name" hidden />
      <div className="uni-table-detail" style={{ width: '100%' }}>
        <div style={{ fontWeight: 500, marginBottom: 8 }}>{t('app.kuaizhizao.shipmentNotice.noticeItems')}</div>
        <AntForm.Item noStyle shouldUpdate={(prev: any, curr: any) => prev?.items !== curr?.items}>
          {({ getFieldValue }: any) => {
            const items = getFieldValue('items') ?? [];
            return (
              <Table
                size="small"
                dataSource={items.map((it: any, i: number) => ({ ...it, key: i }))}
                rowKey="key"
                pagination={false}
                columns={editItemColumns}
              />
            );
          }}
        </AntForm.Item>
      </div>
      <ProFormTextArea name="notes" label={t('common.remark')} placeholder={t('common.remark')} fieldProps={{ rows: 2 }} colProps={{ span: 24 }} />
      <DocumentAttachmentsField category="receipt_notice_attachments" />
    </>
  );

  const statCards: StatCard[] = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.receiptNotice.statTotal'),
        value: localStats.total,
        valueStyle: { color: token.colorPrimary },
        backgroundChart: <SimpleSparkline data={RN_STAT_SPARK_1} color={token.colorPrimary} />,
      },
      {
        title: t('app.kuaizhizao.receiptNotice.statusPendingReceipt'),
        value: localStats.pending,
        valueStyle: { color: token.colorWarning },
        backgroundChart: <SimpleSparkline data={RN_STAT_SPARK_2} color={token.colorWarning} />,
      },
      {
        title: t('app.kuaizhizao.shipmentNotice.statusNotified'),
        value: localStats.notified,
        valueStyle: { color: token.colorInfo },
        backgroundChart: <SimpleSparkline data={RN_STAT_SPARK_3} color={token.colorInfo} />,
      },
      {
        title: t('app.kuaizhizao.receiptNotice.statusReceived'),
        value: localStats.received,
        valueStyle: { color: token.colorSuccess },
        backgroundChart: <SimpleSparkline data={RN_STAT_SPARK_4} color={token.colorSuccess} />,
      },
    ],
    [localStats, t, token, i18n.language],
  );

  const timeconfigBasicItems = useDetailDrawerDescriptionItems(
    detailColumns, noticeDetail as unknown as Record<string, unknown>,
    'receipt_notice',
  );

  const receiptNoticeAttachments = documentAttachmentsFromRecord(noticeDetail);
  const showReceiptNoticeAttachments =
    Boolean(noticeDetail) && hasDocumentAttachments(receiptNoticeAttachments);

  return (
    <>
      <ListPageTemplate statCards={statCards}>
        <UniTable
          headerTitle={t('app.kuaizhizao.receiptNotice.title')}
          columnPersistenceId={RECEIPT_NOTICE_LIST_PERSISTENCE_ID}
          actionRef={actionRef}
          rowKey={dataViewMode === 'detail' ? '_rowKey' : 'id'}
          columns={columns}
          viewTypes={['table', 'detailTable', 'help']}
          defaultViewType={viewTypeState === 'help' ? 'table' : viewTypeState}
          helpViewConfig={buildDocumentListHelpViewConfig(DOCUMENT_LIST_HELP_KEYS.receiptNotice)}
          onViewTypeChange={(v) => {
            dataViewModeRef.current = resolveDetailTableViewMode(v as 'table' | 'detailTable' | 'help');
            setViewTypeState(v as 'table' | 'detailTable' | 'help');
            setTimeout(() => actionRef.current?.reload(), 0);
          }}
          detailTableColumns={detailTableColumns}
          showAdvancedSearch={true}
          skipFuzzyPinyinClientFilter
          pinnedTabsField={LIST_LIFECYCLE_STAGE_FIELD}
          pinnedTabsValueEnum={receiptNoticeLifecycleValueEnum}
          showCreateButton={false}
          createButtonText={createButtonLabel}
          onCreate={handleCreate}
          toolBarRender={() => [
            <UniPullCreateToolbar
              compactKey="create-receipt-notice-with-pull"
              createIcon={<PlusOutlined />}
              createLabel={createButtonLabel}
              onCreate={handleCreate}
              menuItems={buildKuaizhizaoPullCreateMenuItems(t, [
                {
                  key: 'pull-from-purchase-order',
                  actionKey: 'receipt_notice.pull_from_purchase_order',
                  onClick: () => {
                    pullFromPurchaseOrderQuery.openModal();
                  },
                },
              ])}
            />,
            <UniPushToolbarButton
              key={`receipt-notice-push-${selectedNoticeForToolbar?.id ?? 'none'}`}
              menuItems={toolbarPushMenuItems}
              disabled={selectedRowKeys.length !== 1 || !selectedNoticeForToolbar}
              disabledReason={toolbarPushDisabledReason}
            />,
          ]}
          enableRowSelection={viewTypeState !== 'detailTable'}
          selectedRowKeys={selectedRowKeys}
          onRowSelectionChange={setSelectedRowKeys}
          showDeleteButton
          onDelete={handleBatchDelete}
          deleteConfirmTitle={(count) => t('app.kuaizhizao.receiptNotice.confirmBatchDelete', { count })}
          toolBarActionsAfterBatch={[
            <UniCapabilityBatchButton
              key="receipt-notice-notify"
              selectedRowKeys={selectedRowKeys}
              selectedRecords={selectedNoticesForBatch}
              capabilityKey="notify"
              permAllowed={receiptNoticePerms.canAction?.('submit') ?? false}
              batchAllowed={receiptNoticeBatchNotifyAllowed}
              onRun={(id) => receiptNoticeApi.notify(String(id))}
              notAllowedMessage={t('app.kuaizhizao.shipmentNotice.batchNotifyNotAllowed')}
              onSuccess={() => {
                setSelectedRowKeys([]);
                setStatsVersion((v) => v + 1);
                invalidateMenuBadgeCounts();
    actionRef.current?.reload();
              }}
              requireConfirm
              labels={{
                single: t('app.kuaizhizao.receiptNotice.notifyWarehouse'),
                batch: t('app.kuaizhizao.shipmentNotice.batchNotifyWarehouse'),
              }}
              icon={<SendOutlined />}
              size="medium"
              color="green"
              variant="solid"
            />,
            <UniCapabilityBatchButton
              key="receipt-notice-withdraw"
              selectedRowKeys={selectedRowKeys}
              selectedRecords={selectedNoticesForBatch}
              capabilityKey="withdraw"
              permAllowed={receiptNoticePerms.canAction?.('revoke') ?? false}
              batchAllowed={receiptNoticeBatchWithdrawAllowed}
              onRun={(id) => receiptNoticeApi.withdraw(String(id))}
              notAllowedMessage={t('app.kuaizhizao.shipmentNotice.batchWithdrawNotAllowed')}
              onSuccess={() => {
                setSelectedRowKeys([]);
                setStatsVersion((v) => v + 1);
                invalidateMenuBadgeCounts();
    actionRef.current?.reload();
              }}
              requireConfirm
              labels={{
                single: t('app.kuaizhizao.shipmentNotice.withdrawNotify'),
                batch: t('app.kuaizhizao.shipmentNotice.batchWithdrawNotify'),
              }}
              icon={<RollbackOutlined />}
              size="medium"
              color="orange"
              variant="solid"
            />,
          ]}
          onTableDataChange={(rows) => {
            if (dataViewModeRef.current === 'order') {
              tableRowsRef.current = rows as ReceiptNotice[];
            }
          }}
          request={async (params, sort, _filter, searchFormValues) => {
            try {
              const sf = searchFormValues ?? {};
              const lifecycleParams = resolveReceiptNoticeListLifecycleParams(sf, params);
              const { sortBy, sortOrder } = extractProTableSort(sort);
              const orderBy =
                sortBy && sortOrder ? (sortOrder === 'desc' ? `-${sortBy}` : sortBy) : undefined;
              const fuzzyKeyword = typeof sf.keyword === 'string' ? sf.keyword.trim() : '';
              const apiParams: ReceiptNoticeListParams = {
                skip: ((params.current || 1) - 1) * (params.pageSize || 20),
                limit: params.pageSize || 20,
                ...lifecycleParams,
                order_by: orderBy,
                include_items: true,
              };
              if (fuzzyKeyword) {
                apiParams.keyword = fuzzyKeyword;
              } else if (sf.notice_code != null && String(sf.notice_code).trim()) {
                apiParams.notice_code = String(sf.notice_code).trim();
              }
              if (sf.supplier_id != null && sf.supplier_id !== '') {
                apiParams.supplier_id = Number(sf.supplier_id);
              }
              const orderCode =
                sf.purchase_order_code != null ? String(sf.purchase_order_code).trim() : '';
              if (orderCode) apiParams.purchase_order_code = orderCode;
              const plannedRange = sf.planned_receipt_date_range as [unknown, unknown] | undefined;
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
              const response = await receiptNoticeApi.list(apiParams);
              const notices = response?.data ?? [];
              const total = response?.total ?? notices.length;
              // 行缓存唯一真源：onTableDataChange（prefetch 会走本 request，禁止在此覆盖）
              if (dataViewModeRef.current === 'order') {
                return { data: notices, success: true, total };
              }
              const flatRows = flattenDocumentDetailRows<
                ReceiptNotice,
                NonNullable<ReceiptNoticeDetail['items']>[number]
              >({
                headers: notices,
                getHeaderId: (h) => h.id,
                getItems: (h) => (h as ReceiptNoticeDetail).items,
                buildRowKey: (h, item, index) =>
                  item?.id ? `rn-${h.id}-item-${item.id}` : `rn-${h.id}-idx-${index}`,
                mapItemRow: (h, item) => ({
                  ...item,
                  notice_id: h.id ?? 0,
                  notice_code: h.notice_code,
                  supplier_name: h.supplier_name,
                  purchase_order_code: h.purchase_order_code,
                  warehouse_name: h.warehouse_name,
                  planned_receipt_date: h.planned_receipt_date,
                  notified_at: h.notified_at,
                  status: h.status,
                  purchase_receipt_id: h.purchase_receipt_id,
                  purchase_receipt_code: h.purchase_receipt_code,
                  lifecycle: h.lifecycle,
                }),
                mapEmptyHeaderRow: (h) => ({
                  notice_id: h.id ?? 0,
                  notice_code: h.notice_code,
                  supplier_name: h.supplier_name,
                  material_code: '-',
                  material_name: '-',
                  material_unit: '',
                  notice_quantity: 0,
                  status: h.status,
                  purchase_receipt_id: h.purchase_receipt_id,
                  purchase_receipt_code: h.purchase_receipt_code,
                  lifecycle: h.lifecycle,
                  planned_receipt_date: h.planned_receipt_date,
                  notified_at: h.notified_at,
                }),
              }) as ReceiptNoticeItemRow[];
              return { data: flatRows, success: true, total };
            } catch {
              messageApi.error(t('app.kuaizhizao.shipmentNotice.listFailed'));
              return { data: [], success: false, total: 0 };
            }
          }}
        />
      </ListPageTemplate>

      <UniPullQueryModal<PullPurchaseOrderCandidate>
        open={pullFromPurchaseOrderQuery.open}
        title={pullFromPurchaseOrderAction.label}
        onCancel={pullFromPurchaseOrderQuery.closeModal}
        onOk={pullFromPurchaseOrderQuery.handleConfirm}
        rowKey="id"
        columns={pullPurchaseOrderColumns}
        dataSource={pullFromPurchaseOrderQuery.dataSource}
        loading={pullFromPurchaseOrderQuery.loading}
        confirmLoading={pullFromPurchaseOrderQuery.confirmLoading}
        selectionType={pullFromPurchaseOrderQuery.selectionType}
        selectedRowKeys={pullFromPurchaseOrderQuery.selectedRowKeys}
        selectedRows={pullFromPurchaseOrderQuery.selectedRows}
        onSelectedRowKeysChange={pullFromPurchaseOrderQuery.handleSelectedRowKeysChange}
        isRowDisabled={pullFromPurchaseOrderQuery.isRowDisabled}
        searchDraft={pullFromPurchaseOrderQuery.searchDraft}
        onSearchDraftChange={pullFromPurchaseOrderQuery.setSearchDraft}
        onSearchApply={pullFromPurchaseOrderQuery.handleSearchApply}
        onSearchClear={pullFromPurchaseOrderQuery.handleSearchClear}
        appliedKeyword={pullFromPurchaseOrderQuery.appliedKeyword}
        searchPlaceholder={t('app.kuaizhizao.receiptNotice.pull.searchPlaceholder')}
        filterExtra={(
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder={t('app.kuaizhizao.receiptNotice.pull.sourceDocPlaceholder')}
            style={{ width: 220, flexShrink: 0 }}
            value={pullSourceOrderId}
            options={pullSourceOrderOptions}
            onChange={(value) => {
              const nextId = Number(value);
              const next = Number.isFinite(nextId) && nextId > 0 ? nextId : undefined;
              pullSourceOrderIdRef.current = next;
              setPullSourceOrderId(next);
              pullFromPurchaseOrderQuery.handleSelectedRowKeysChange([], []);
              pullFromPurchaseOrderQuery.handleSearchApply(pullFromPurchaseOrderQuery.appliedKeyword);
            }}
          />
        )}
        getRowLabel={(row) =>
          [row.order_code, row.material_code].filter(Boolean).join(' ')
        }
        page={pullFromPurchaseOrderQuery.page}
        pageSize={pullFromPurchaseOrderQuery.pageSize}
        total={pullFromPurchaseOrderQuery.total}
        onPageChange={pullFromPurchaseOrderQuery.handlePageChange}
        scopeOptions={pullFromPurchaseOrderQuery.scopeOptions}
        scope={pullFromPurchaseOrderQuery.scope}
        onScopeChange={pullFromPurchaseOrderQuery.handleScopeChange}
        okText={t('app.kuaizhizao.receiptNotice.pull.ok')}
      />

      <DetailDrawerTemplate
        title={t('app.kuaizhizao.receiptNotice.detailTitle', {
          suffix: noticeDetail?.notice_code ? ` - ${noticeDetail.notice_code}` : '',
        })}
        open={detailDrawerVisible}
        zIndex={receiptNoticeDetailDrawerZIndex}
        onClose={() => {
          setDetailDrawerVisible(false);
          setNoticeDetail(null);
        }}
        size={DRAWER_CONFIG.HALF_WIDTH}
        extra={
          noticeDetail ? (
            <DetailDrawerActions
              items={[
                {
                  key: 'notify',
                  visible: noticeDetail.capabilities?.notify?.allowed === true,
                  render: () => (
                    <Button {...rowActionKind('submit')} onClick={() => handleNotify(noticeDetail)}>
                      {t('app.kuaizhizao.shipmentNotice.notifyWarehouse')}
                    </Button>
                  ),
                },
                {
                  key: 'withdraw',
                  visible: noticeDetail.capabilities?.withdraw?.allowed === true,
                  render: () => (
                    <ActionConfirmPopconfirm title={t('app.kuaizhizao.shipmentNotice.withdrawNotify')} description={t('app.kuaizhizao.receiptNotice.withdrawConfirmContent', { code: record.notice_code })} onConfirm={() => executeWithdraw(noticeDetail)}>
              <Button {...rowActionKind('revoke')} onClick={(e) => e.stopPropagation()}>
                      {t('app.kuaizhizao.shipmentNotice.withdrawNotify')}
                    </Button>
            </ActionConfirmPopconfirm>
                  ),
                },
                {
                  key: 'edit',
                  visible: noticeDetail.capabilities?.update?.allowed === true,
                  render: () => (
                    <Button
                      {...rowActionKind('update')}
                      onClick={() => {
                        setDetailDrawerVisible(false);
                        handleEdit(noticeDetail);
                      }}
                    >
                      {t('common.edit')}
                    </Button>
                  ),
                },
                {
                  key: 'delete',
                  visible: noticeDetail.capabilities?.delete?.allowed === true,
                  render: () => (
                    <ActionConfirmPopconfirm title={t('app.kuaizhizao.receiptNotice.deleteModalTitle')} description={t('app.kuaizhizao.shipmentNotice.deleteConfirmContent', { code: record.notice_code })} onConfirm={() => executeDelete(noticeDetail)}>
              <Button {...rowActionKind('delete')} onClick={(e) => e.stopPropagation()}>
                      {t('common.delete')}
                    </Button>
            </ActionConfirmPopconfirm>
                  ),
                },
              ]}
            />
          ) : null
        }
        collaborationTitleSuffix={
          receiptNoticeLifecycle?.nextStepSuggestions?.length ? (
            <Typography.Text type="secondary" style={{ fontSize: 13, fontWeight: 400 }}>
              {t('common.next')}：
              {receiptNoticeLifecycle.nextStepSuggestions.join(t('components.uniLifecycle.nextStepSeparator'))}
            </Typography.Text>
          ) : undefined
        }
        collaborationAuditRecord={noticeDetail}
        basic={
          noticeDetail ? (
            <Descriptions
              column={3}
              size="small"
              items={timeconfigBasicItems}
            />
          ) : null
        }
        collaboration={
          receiptNoticeLifecycle && (receiptNoticeLifecycle.mainStages ?? []).length > 0 ? (
            <UniLifecycleStepper
              steps={receiptNoticeLifecycle.mainStages ?? []}
              status={receiptNoticeLifecycle.status}
              showLabels
              nextStepSuggestions={receiptNoticeLifecycle.nextStepSuggestions}
              hideNextStepSuggestions={Boolean(receiptNoticeLifecycle.nextStepSuggestions?.length)}
            />
          ) : null
        }
        supplementary={
          showReceiptNoticeAttachments ? (
            <DocumentAttachmentsReadonly attachments={receiptNoticeAttachments} />
          ) : undefined
        }
        supplementaryTitle={
          showReceiptNoticeAttachments ? t('app.uniDetail.sectionAttachments') : undefined
        }
        supplementaryVisible={showReceiptNoticeAttachments}
        lines={
          noticeDetail ? (
            noticeDetail.items && noticeDetail.items.length > 0 ? (
              <Table
                size="small"
                tableLayout="fixed"
                style={{ minWidth: RN_DETAIL_ITEMS_MIN_WIDTH }}
                rowKey={(record: any, idx?: number) => record?.id ?? idx}
                columns={detailItemColumns}
                dataSource={noticeDetail.items}
                pagination={false}
                bordered
              />
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('app.kuaizhizao.shipmentNotice.noDetailItems')} />
            )
          ) : null
        }
        timeline={
          noticeDetail ? (
            receiptNoticeTracking.data && !receiptNoticeTracking.loading ? (
              <DocumentTrackingTimelineBody data={receiptNoticeTracking.data} />
            ) : receiptNoticeTracking.error ? (
              <Typography.Text type="danger">{receiptNoticeTracking.error}</Typography.Text>
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('app.kuaizhizao.shipmentNotice.noOperationRecords')} />
            )
          ) : null
        }
        traceDocument={
          noticeDetail?.id != null
            ? {
                documentType: 'receipt_notice',
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
        title={t('app.kuaizhizao.receiptNotice.create')}
        open={createModalVisible}
        onClose={() => { setCreateModalVisible(false); setEffectiveRuleCode(null); }}
        formRef={createFormRef}
        onFinish={handleCreateSubmit}
        width={MODAL_CONFIG.LARGE_WIDTH}
        grid={false}
        initialValues={{ items: [defaultReceiptItem] }}
      >
        {renderCreateForm()}
      </FormModalTemplate>

      <FormModalTemplate
        title={t('app.kuaizhizao.receiptNotice.edit')}
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

      <UniMaterialBatchPicker
        open={materialPickerOpen}
        onCancel={() => setMaterialPickerOpen(false)}
        onConfirm={appendReceiptNoticeItemsFromMaterials}
      />

      <Modal
        title={t('app.kuaizhizao.shipmentNotice.notifyWarehouse')}
        open={notifyPreviewOpen}
        width={1100}
        onCancel={resetNotifyPreviewModal}
        okText={t('app.kuaizhizao.shipmentNotice.notifyWarehouse')}
        cancelText={t('common.cancel')}
        confirmLoading={notifyPreviewConfirming}
        onOk={() => void handleNotifyPreviewConfirm()}
        okButtonProps={{
          disabled: notifyPreviewLoading || !notifyPreviewData || !!notifyPreviewData?.has_blocking_issues,
        }}
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
                title={
                  (notifyPreviewData.line_blocking_issues && notifyPreviewData.line_blocking_issues.length > 0
                    ? notifyPreviewData.line_blocking_issues.join('；')
                    : null) ||
                  receiptNoticeCapabilityReasonMessage(notifyPreviewData.blocking_reason, t) ||
                  t('app.kuaizhizao.receiptNotice.notifyPreviewBlocked')
                }
              />
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
                  { title: t('app.kuaizhizao.purchaseOrder.col.noticeQty'), dataIndex: 'notice_quantity', width: 90, align: 'right', render: formatQuantity },
                  { title: t('app.kuaizhizao.salesOrder.colShippedQty'), dataIndex: 'pushed_quantity', width: 90, align: 'right', render: formatQuantity },
                  { title: t('app.kuaizhizao.salesOrder.colShippableQty'), dataIndex: 'max_push_quantity', width: 90, align: 'right', render: formatQuantity },
                ]}
              />
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('app.kuaizhizao.receiptNotice.notifyPreviewNoLines')} />
            )}
            {notifyPreviewData.tip ? (
              <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>
                {notifyPreviewData.tip}
              </Typography.Paragraph>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </>
  );
};

export default ReceiptNoticesPage;
