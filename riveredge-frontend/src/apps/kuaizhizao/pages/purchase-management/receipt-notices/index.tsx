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
import { renderRowActionsOverflow, rowActionKind } from '../../../../../components/uni-action';
import { useInvalidateMenuBadgeCounts } from '../../../../../hooks/useInvalidateMenuBadgeCounts';
import { useNavigate } from 'react-router-dom';
import { ActionType, ProColumns, ProDescriptionsItemProps, ProForm, ProFormText, ProFormDatePicker, ProFormTextArea, ProFormItem } from '@ant-design/pro-components';
import type { DescriptionsProps } from 'antd';
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
} from 'antd';
import { PlusOutlined, EyeOutlined, EditOutlined, DeleteOutlined, SendOutlined, AppstoreAddOutlined, ImportOutlined, DownOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { UniTable } from '../../../../../components/uni-table';
import { UniCapabilityBatchButton } from '../../../../../components/uni-batch';
import {
  UniTableStackedPrimaryCell,
  UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
} from '../../../../../components/uni-table/stackedPrimaryColumn';
import { UniMaterialSelect } from '../../../../../components/uni-material-select';
import { UniMaterialBatchPicker } from '../../../../../components/uni-material-batch-picker';
import type { Material } from '../../../../master-data/types/material';
import { UniWarehouseSelect } from '../../../../../components/uni-warehouse-select';
import { UniTableDetail } from '../../../../../components/uni-table-detail';
import {
  ListPageTemplate,
  DetailDrawerTemplate,
  DetailDrawerSection, DetailDrawerInlineFullChain,
  DetailDrawerActions,
  FormModalTemplate,
  DRAWER_CONFIG,
  MODAL_CONFIG,
  type StatCard,
} from '../../../../../components/layout-templates';
import { UniPullCreateToolbar } from '../../../../../components/uni-pull';
import { UniPullQueryModal, useUniPullQuery } from '../../../../../components/uni-pull-query';
import { SimpleSparkline } from '../../../../../components';
import { UniLifecycle, UniLifecycleStepper } from '../../../../../components/uni-lifecycle';
import { DocumentTrackingTimelineBody, useDocumentTracking } from '../../../../../components/document-tracking-panel';
import { WarehouseTraceBriefPrimaryActions } from '../../warehouse-management/WarehouseTraceBriefFooter';
import { receiptNoticeApi, type ReceiptNotice } from '../../../services/receipt-notice';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import {
  receiptNoticeBatchNotifyAllowed,
  receiptNoticeBatchWithdrawAllowed,
} from '../../../../../hooks/useDocumentCapabilities';
import { getReceiptNoticeLifecycle } from '../../../utils/receiptNoticeLifecycle';
import { listPurchaseOrders, getPurchaseOrder } from '../../../services/purchase';
import { testGenerateCode, generateCode, getCodeRulePageConfig } from '../../../../../services/codeRule';
import { isAutoGenerateEnabled, getPageRuleCode } from '../../../../../utils/codeRulePage';
import { buildFutureDateShortcutFieldProps } from '../../../../../utils/futureDatePickerShortcuts';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { useTranslation } from 'react-i18next';
import { ROUTES } from '../../../constants/routes';
import { inboundReceiptNoticeEntryPath } from '../../warehouse-management/inbound/inboundPaths';
import { buildKuaizhizaoPullCreateMenuItems, resolveKuaizhizaoDocumentAction } from '../../../constants/documentActionRegistry';
import DocumentAttachmentsField from '../../../components/DocumentAttachmentsField';
import { mapAttachmentsToUploadList, normalizeDocumentAttachments } from '../../../utils/documentAttachments';
import { formatDateTime } from '../../../../../utils/format';
import { withSingleNewShortcutHint } from '../../../../../utils/globalNewShortcut';

interface ReceiptNoticeDetail extends ReceiptNotice {
  items?: { id?: number; material_code: string; material_name: string; material_unit: string; notice_quantity: number; unit_price?: number; total_amount?: number }[];
}

type PullPurchaseOrderCandidate = {
  id: number;
  order_code?: string;
  supplier_id?: number;
  supplier_name?: string;
  status?: string;
  order_date?: string;
  updated_at?: string;
  notice_id?: number;
  converted?: boolean;
};

const RN_STAT_SPARK_1 = [10, 12, 11, 13, 14, 15, 16];
const RN_STAT_SPARK_2 = [6, 8, 7, 9, 8, 10, 9];
const RN_STAT_SPARK_3 = [4, 3, 5, 4, 6, 5, 7];
const RN_STAT_SPARK_4 = [18, 20, 22, 24, 26, 28, 30];

const RN_DETAIL_ITEMS_MIN_WIDTH = 960;

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

function renderReceiptNoticeRowActions(nodes: React.ReactNode[], keyPrefix: string): React.ReactNode {
  return renderRowActionsOverflow(nodes, { keyPrefix });
}

const RECEIPT_NOTICE_RESOURCE = 'kuaizhizao:receipt-notice';

const ReceiptNoticesPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { token } = theme.useToken();
  const receiptNoticeDetailDrawerZIndex = token.zIndexPopupBase;
  const { message: messageApi } = App.useApp();
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
  const tableRowsRef = useRef<ReceiptNotice[]>([]);
  const receiptNoticePerms = useResourcePermissions(RECEIPT_NOTICE_RESOURCE);
  const invalidateMenuBadgeCounts = useInvalidateMenuBadgeCounts();
  const [statsVersion, setStatsVersion] = useState(0);
  const [localStats, setLocalStats] = useState({ total: 0, pending: 0, notified: 0, received: 0 });

  const refreshLocalStats = useCallback(async () => {
    try {
      const response = await receiptNoticeApi.list({ skip: 0, limit: 5000 });
      const data = Array.isArray(response) ? response : (response as any)?.items || (response as any)?.data || [];
      const arr = Array.isArray(data) ? data : [];
      setLocalStats({
        total: (response as any)?.total ?? arr.length,
        pending: arr.filter((x: ReceiptNotice) => (x.status || '').trim() === '待收货').length,
        notified: arr.filter((x: ReceiptNotice) => (x.status || '').trim() === '已通知').length,
        received: arr.filter((x: ReceiptNotice) => (x.status || '').trim() === '已入库').length,
      });
    } catch {
      setLocalStats({ total: 0, pending: 0, notified: 0, received: 0 });
    }
  }, []);

  useEffect(() => {
    refreshLocalStats();
  }, [statsVersion, refreshLocalStats]);
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [noticeDetail, setNoticeDetail] = useState<ReceiptNoticeDetail | null>(null);
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

  const handleNotify = (record: ReceiptNotice) => {
    Modal.confirm({
      title: t('app.kuaizhizao.shipmentNotice.notifyWarehouse'),
      content: t('app.kuaizhizao.receiptNotice.notifyConfirmContent', { code: record.notice_code }),
      onOk: async () => {
        try {
          const res = (await receiptNoticeApi.notify(record.id!.toString())) as ReceiptNotice;
          messageApi.success(
            res?.purchase_receipt_code
              ? t('app.kuaizhizao.receiptNotice.notifySuccessWithDraft', { receiptCode: res.purchase_receipt_code })
              : t('app.kuaizhizao.shipmentNotice.notifySuccess'),
          );
          setStatsVersion((v) => v + 1);
          if (noticeDetail?.id === record.id) {
            const fresh = await receiptNoticeApi.get(record.id!.toString());
            setNoticeDetail(fresh as ReceiptNoticeDetail);
          }
          invalidateMenuBadgeCounts();

          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || t('app.kuaizhizao.shipmentNotice.notifyFailed'));
        }
      },
    });
  };

  const handleWithdraw = (record: ReceiptNotice) => {
    Modal.confirm({
      title: t('app.kuaizhizao.shipmentNotice.withdrawNotify'),
      content: t('app.kuaizhizao.receiptNotice.withdrawConfirmContent', { code: record.notice_code }),
      onOk: async () => {
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
      },
    });
  };

  const handlePushToInboundEntry = (record: ReceiptNotice) => {
    if (!record.id) return;
    navigate(inboundReceiptNoticeEntryPath(record.id));
  };

  const handleDelete = (record: ReceiptNotice) => {
    Modal.confirm({
      title: t('app.kuaizhizao.receiptNotice.deleteModalTitle'),
      content: t('app.kuaizhizao.shipmentNotice.deleteConfirmContent', { code: record.notice_code }),
      onOk: async () => {
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
      },
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
    () => [
      {
        title: t('app.kuaizhizao.receiptNotice.colSupplierNotice'),
        key: 'notice_code',
        dataIndex: 'notice_code',
        ...UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
        fixed: 'left',
        render: (_, r) => (
          <UniTableStackedPrimaryCell
            primary={String(r.supplier_name ?? '')}
            secondary={String(r.notice_code ?? '')}
          />
        ),
      },
      { title: t('app.kuaizhizao.shipmentNotice.noticeCode'), dataIndex: 'notice_code', hideInTable: true },
      { title: t('app.kuaizhizao.receiptNotice.supplier'), dataIndex: 'supplier_name', hideInTable: true },
      {
        title: t('app.kuaizhizao.receiptNotice.purchaseOrderCode'),
        dataIndex: 'purchase_order_code',
        width: 148,
        ellipsis: true,
        render: (_, r) => (
          <Typography.Text copyable={{ text: String(r.purchase_order_code ?? '') }} ellipsis>
            {r.purchase_order_code ?? '-'}
          </Typography.Text>
        ),
      },
      { title: t('app.kuaizhizao.receiptNotice.inboundWarehouse'), dataIndex: 'warehouse_name', width: 120 },
      { title: t('app.kuaizhizao.receiptNotice.plannedReceiptDate'), dataIndex: 'planned_receipt_date', valueType: 'date', width: 120 },
      {
        title: t('app.kuaizhizao.receiptNotice.receiptConversion'),
        dataIndex: 'purchase_receipt_code',
        width: 220,
        hideInSearch: true,
        render: (_, r) => {
          if (r.purchase_receipt_id) {
            return (
              <Space size={6}>
                <Tag color="success">{t('app.kuaizhizao.receiptNotice.pulledToInbound')}</Tag>
                <Typography.Text copyable={{ text: String(r.purchase_receipt_code || r.purchase_receipt_id) }} ellipsis>
                  {r.purchase_receipt_code || `#${r.purchase_receipt_id}`}
                </Typography.Text>
              </Space>
            );
          }
          return <Tag color="default">{t('app.kuaizhizao.receiptNotice.notPulled')}</Tag>;
        },
      },
      { title: t('app.kuaizhizao.shipmentNotice.notifiedAt'), dataIndex: 'notified_at', valueType: 'dateTime', width: 160 },
      {
        title: t('common.updatedAt'),
        dataIndex: 'updated_at',
        valueType: 'dateTime',
        width: 168,
        hideInSearch: true,
        defaultSortOrder: 'descend',
      },
      {
        title: t('app.kuaizhizao.salesOrder.lifecycle'),
        dataIndex: 'lifecycle_stage',
        fixed: 'right',
        align: 'left',
        hideInSearch: true,
        render: (_, record) => {
          const lifecycle = getReceiptNoticeLifecycle(record as unknown as Record<string, unknown>);
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
        title: t('common.actions'),
        width: 220,
        fixed: 'right',
        hideInSearch: true,
        render: (_, record) => {
          const parts: React.ReactNode[] = [
            <Button {...rowActionKind('read')}
              key="d"
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                handleDetail(record);
              }}
            >
              {t('common.detail')}
            </Button>,
          ];
          if (record.status === '待收货') {
            parts.push(
              <Button {...rowActionKind('update')}
                key="e"
                type="link"
                size="small"
                icon={<EditOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  handleEdit(record);
                }}
              >
                {t('common.edit')}
              </Button>
            );
            parts.push(
              <Button {...rowActionKind('dispatch')}
                key="n"
                type="link"
                size="small"
                icon={<SendOutlined />}
                style={{ color: '#1890ff' }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleNotify(record);
                }}
              >
                {t('app.kuaizhizao.shipmentNotice.notifyWarehouse')}
              </Button>
            );
            parts.push(
              <Button {...rowActionKind('delete')}
                key="del"
                type="link"
                size="small"
                danger
                icon={<DeleteOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(record);
                }}
              >
                {t('common.delete')}
              </Button>
            );
          }
          if (record.status === '已通知') {
            parts.push(
              <Button {...rowActionKind('skip')}
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
            if (!record.purchase_receipt_id) {
              parts.push(
                <Button
                  {...rowActionKind('audit')}
                  key="push-inbound"
                  type="link"
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePushToInboundEntry(record);
                  }}
                >
                  {pushToPurchaseReceiptAction.label}
                </Button>
              );
            }
          }
          if (record.purchase_receipt_id) {
            parts.push(
              <Button {...rowActionKind('read')}
                key="to-pr"
                type="link"
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(ROUTES.WM_INBOUND);
                }}
              >
                {t('app.kuaizhizao.receiptNotice.viewInboundReceipt')}
              </Button>
            );
          }
          return renderReceiptNoticeRowActions(parts, `receipt-notice-actions-${record.id ?? 'row'}`);
        },
      },
    ],
    [handleDelete, handleDetail, handleEdit, handleNotify, handlePushToInboundEntry, handleWithdraw, navigate, t, i18n.language],
  );

  const pullPurchaseOrderColumns = useMemo(
    () => [
      { title: t('app.kuaizhizao.receiptNotice.purchaseOrderCode'), dataIndex: 'order_code', width: 190, ellipsis: true },
      { title: t('app.kuaizhizao.receiptNotice.supplier'), dataIndex: 'supplier_name', width: 220, ellipsis: true },
      { title: t('app.kuaizhizao.shipmentNotice.orderStatus'), dataIndex: 'status', width: 120, align: 'center' as const },
      { title: t('app.kuaizhizao.receiptNotice.orderDate'), dataIndex: 'order_date', width: 130, render: (v: string) => (v ? formatDateTime(v, 'YYYY-MM-DD') : '-') },
      { title: t('common.updatedAt'), dataIndex: 'updated_at', width: 180, render: (v: string) => (v ? formatDateTime(v, 'YYYY-MM-DD HH:mm:ss') : '-') },
      {
        title: t('app.kuaizhizao.shipmentNotice.convertStatus'),
        key: 'convert_status',
        width: 150,
        align: 'center' as const,
        render: (_: unknown, r: PullPurchaseOrderCandidate) => (
          r.converted
            ? <Tag color="gold">{t('app.kuaizhizao.shipmentNotice.alreadyCreated', { target: pullFromPurchaseOrderAction.targetLabel })}</Tag>
            : <Tag color="success">{t('app.kuaizhizao.shipmentNotice.canCreate')}</Tag>
        ),
      },
    ],
    [pullFromPurchaseOrderAction.targetLabel, t, i18n.language],
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
                />
              );
            }}
          </AntForm.Item>
        ),
      },
      {
        title: t('app.kuaizhizao.shipmentNotice.import.unit'),
        dataIndex: 'material_unit',
        width: 80,
        render: (_: any, __: any, index: number) => (
          <AntForm.Item name={[index, 'material_unit']} style={{ margin: 0 }}>
            <Input placeholder={t('app.kuaizhizao.shipmentNotice.import.unit')} size="small" />
          </AntForm.Item>
        ),
      },
      {
        title: t('app.kuaizhizao.shipmentNotice.import.quantity'),
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
            <InputNumber placeholder={t('app.kuaizhizao.shipmentNotice.import.quantity')} min={0} precision={2} style={{ width: '100%' }} size="small" />
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
            <InputNumber placeholder="0" min={0} precision={2} style={{ width: '100%' }} size="small" />
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
      { title: t('app.kuaizhizao.shipmentNotice.import.unit'), dataIndex: 'material_unit', width: 60 },
      { title: t('app.kuaizhizao.shipmentNotice.import.quantity'), dataIndex: 'notice_quantity', width: 90, align: 'right' as const },
      { title: t('app.kuaizhizao.shipmentNotice.import.unitPrice'), dataIndex: 'unit_price', width: 90, align: 'right' as const },
    ],
    [t, i18n.language],
  );

  const detailItemColumns = useMemo(
    () => [
      { title: t('app.kuaizhizao.shipmentNotice.import.materialCode'), dataIndex: 'material_code', width: 120, ellipsis: true },
      { title: t('app.kuaizhizao.shipmentNotice.import.materialName'), dataIndex: 'material_name', width: 150, ellipsis: true },
      { title: t('app.kuaizhizao.shipmentNotice.import.unit'), dataIndex: 'material_unit', width: 60 },
      { title: t('app.kuaizhizao.shipmentNotice.import.quantity'), dataIndex: 'notice_quantity', width: 90, align: 'right' as const },
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

  const pullFromPurchaseOrderQuery = useUniPullQuery<PullPurchaseOrderCandidate>({
    rowKey: 'id',
    selectionType: 'radio',
    loadData: async ({ keyword, page, pageSize }) => {
      try {
        const kw = keyword.trim();
        const [poRes, noticeRes] = await Promise.all([
          listPurchaseOrders({ skip: 0, limit: 200, keyword: kw || undefined }),
          receiptNoticeApi.list({ skip: 0, limit: 5000 }),
        ]);
        const orders = poRes?.data || [];
        const notices = Array.isArray(noticeRes) ? noticeRes : (noticeRes as any)?.data ?? (noticeRes as any)?.items ?? [];
        const noticeByOrderId = new Map<number, any>();
        notices.forEach((n: any) => {
          if (n?.purchase_order_id != null && !noticeByOrderId.has(Number(n.purchase_order_id))) {
            noticeByOrderId.set(Number(n.purchase_order_id), n);
          }
        });
        const candidates: PullPurchaseOrderCandidate[] = (orders as any[]).map((o: any) => {
          const linked = noticeByOrderId.get(Number(o.id));
          return {
            id: Number(o.id),
            order_code: o.order_code ?? o.purchase_order_code,
            supplier_id: o.supplier_id,
            supplier_name: o.supplier_name,
            status: o.status,
            order_date: o.order_date,
            updated_at: o.updated_at,
            notice_id: linked?.id,
            converted: !!linked,
          };
        });
        const start = (page - 1) * pageSize;
        return { data: candidates.slice(start, start + pageSize), total: candidates.length };
      } catch (e: any) {
        messageApi.error(e?.message || t('app.kuaizhizao.receiptNotice.loadPurchaseOrdersFailed'));
        return { data: [], total: 0 };
      }
    },
    isRowDisabled: (record) => !!record.converted,
    onConfirm: async (keys, rows) => {
      const selectedId = Number(keys[0]);
      if (!selectedId) {
        messageApi.warning(t('app.kuaizhizao.shipmentNotice.selectSource', { source: pullFromPurchaseOrderAction.sourceLabel }));
        return;
      }
      const selected = rows[0];
      if (selected?.converted) {
        messageApi.warning(t('app.kuaizhizao.shipmentNotice.sourceAlreadyConverted', {
          source: pullFromPurchaseOrderAction.sourceLabel,
          target: pullFromPurchaseOrderAction.targetLabel,
        }));
        return;
      }
      try {
        const detail: any = await getPurchaseOrder(selectedId);
        const itemRows = Array.isArray(detail?.items) ? detail.items : [];
        const validItems = itemRows
          .filter((it: any) => (Number(it.ordered_quantity ?? it.quantity ?? 0) || 0) > 0)
          .map((it: any) => ({
            material_id: it.material_id ?? it.materialId,
            material_code: it.material_code ?? it.materialCode ?? '',
            material_name: it.material_name ?? it.materialName ?? '',
            material_unit: it.unit ?? it.material_unit ?? it.materialUnit ?? defaultUnit,
            notice_quantity: Number(it.ordered_quantity ?? it.quantity ?? 0) || 0,
            unit_price: Number(it.unit_price ?? it.unitPrice ?? 0) || 0,
          }));
        if (validItems.length === 0) {
          throw new Error(t('app.kuaizhizao.receiptNotice.sourceMissingItems', {
            source: pullFromPurchaseOrderAction.sourceLabel,
            target: pullFromPurchaseOrderAction.targetLabel,
          }));
        }
        await receiptNoticeApi.create({
          purchase_order_id: detail.id ?? selectedId,
          purchase_order_code: detail.order_code ?? selected?.order_code,
          supplier_id: detail.supplier_id ?? selected?.supplier_id,
          supplier_name: detail.supplier_name ?? selected?.supplier_name,
          supplier_contact: detail.supplier_contact,
          supplier_phone: detail.supplier_phone,
          planned_receipt_date: detail.delivery_date,
          items: validItems,
        });
        messageApi.success(t('app.kuaizhizao.shipmentNotice.createFromSourceSuccess', {
          source: pullFromPurchaseOrderAction.sourceLabel,
          target: pullFromPurchaseOrderAction.targetLabel,
        }));
        setStatsVersion((v) => v + 1);
        invalidateMenuBadgeCounts();
        actionRef.current?.reload();
        pullFromPurchaseOrderQuery.closeModal();
      } catch (e: any) {
        messageApi.error(e?.response?.data?.detail || e?.message || t('app.kuaizhizao.shipmentNotice.createFromSourceFailed', {
          source: pullFromPurchaseOrderAction.sourceLabel,
          target: pullFromPurchaseOrderAction.targetLabel,
        }));
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
      messageApi.error(error.message || t('app.kuaizhizao.receiptNotice.createFailed'));
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
      messageApi.error(error.message || t('app.kuaizhizao.receiptNotice.updateFailed'));
      throw error;
    }
  };

  const detailColumns: ProDescriptionsItemProps<ReceiptNoticeDetail>[] = useMemo(
    () => [
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
        render: (_, entity) => (
          <Typography.Text copyable={{ text: String(entity.purchase_order_code ?? '') }}>{entity.purchase_order_code ?? '-'}</Typography.Text>
        ),
      },
      { title: t('app.kuaizhizao.receiptNotice.supplier'), dataIndex: 'supplier_name' },
      { title: t('field.supplier.contactPerson'), dataIndex: 'supplier_contact' },
      { title: t('field.supplier.phone'), dataIndex: 'supplier_phone' },
      { title: t('app.kuaizhizao.receiptNotice.inboundWarehouse'), dataIndex: 'warehouse_name' },
      { title: t('app.kuaizhizao.receiptNotice.plannedReceiptDate'), dataIndex: 'planned_receipt_date', valueType: 'date' },
      {
        title: t('common.status'),
        dataIndex: 'status',
        render: (s) => {
          const c = statusMap[(s as string) || ''] || { text: (s as string) || '-', color: 'default' };
          return <Tag color={c.color}>{c.text}</Tag>;
        },
      },
      { title: t('app.kuaizhizao.shipmentNotice.notifiedAt'), dataIndex: 'notified_at', valueType: 'dateTime' },
      {
        title: t('app.kuaizhizao.receiptNotice.linkedInboundReceipt'),
        dataIndex: 'purchase_receipt_code',
        render: (v) => v || '-',
      },
      { title: t('app.kuaizhizao.common.fieldNotes'), dataIndex: 'notes', span: 3, render: (text) => text || '-' },
    ],
    [statusMap, t, i18n.language],
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
      <ProFormTextArea name="notes" label={t('app.kuaizhizao.common.fieldNotes')} placeholder={t('app.kuaizhizao.common.fieldNotes')} fieldProps={{ rows: 2 }} colProps={{ span: 24 }} />
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
      <ProFormTextArea name="notes" label={t('app.kuaizhizao.common.fieldNotes')} placeholder={t('app.kuaizhizao.common.fieldNotes')} fieldProps={{ rows: 2 }} colProps={{ span: 24 }} />
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

  return (
    <>
      <ListPageTemplate statCards={statCards}>
        <UniTable
          headerTitle={t('app.kuaizhizao.receiptNotice.title')}
          columnPersistenceId="apps.kuaizhizao.pages.purchase-management.receipt-notices"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          showAdvancedSearch={true}
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
          ]}
          enableRowSelection
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
              size="middle"
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
              icon={<AppstoreAddOutlined />}
              size="middle"
              color="orange"
              variant="solid"
            />,
          ]}
          onTableDataChange={(rows) => {
            tableRowsRef.current = rows;
          }}
          request={async (params) => {
            try {
              const response = await receiptNoticeApi.list({
                skip: ((params.current || 1) - 1) * (params.pageSize || 20),
                limit: params.pageSize || 20,
                status: params.status,
                supplier_id: params.supplier_id,
                purchase_order_id: params.purchase_order_id,
                keyword: params.keyword,
              });
              const data = Array.isArray(response) ? response : response?.items || response?.data || [];
              const total = Array.isArray(response) ? response.length : response?.total ?? data.length;
              return { data, success: true, total };
            } catch {
              messageApi.error(t('app.kuaizhizao.shipmentNotice.listFailed'));
              return { data: [], success: false, total: 0 };
            }
          }}
          scroll={{ x: 1400 }}
          onRow={(record) => ({
            onClick: () => handleDetail(record),
            style: { cursor: 'pointer' },
          })}
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
        onSelectedRowKeysChange={pullFromPurchaseOrderQuery.handleSelectedRowKeysChange}
        isRowDisabled={pullFromPurchaseOrderQuery.isRowDisabled}
        searchDraft={pullFromPurchaseOrderQuery.searchDraft}
        onSearchDraftChange={pullFromPurchaseOrderQuery.setSearchDraft}
        onSearchApply={pullFromPurchaseOrderQuery.handleSearchApply}
        onSearchClear={pullFromPurchaseOrderQuery.handleSearchClear}
        appliedKeyword={pullFromPurchaseOrderQuery.appliedKeyword}
        searchPlaceholder={t('app.kuaizhizao.receiptNotice.pullSearchPlaceholder')}
        page={pullFromPurchaseOrderQuery.page}
        pageSize={pullFromPurchaseOrderQuery.pageSize}
        total={pullFromPurchaseOrderQuery.total}
        onPageChange={pullFromPurchaseOrderQuery.handlePageChange}
        okText={t('app.kuaizhizao.shipmentNotice.createTarget', { target: pullFromPurchaseOrderAction.targetLabel })}
        width={MODAL_CONFIG.EXTRA_LARGE_WIDTH}
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
        width={DRAWER_CONFIG.HALF_WIDTH}
        columns={[]}
        column={3}
        dataSource={noticeDetail || undefined}
        extra={
          noticeDetail && (
            <DetailDrawerActions
              items={[
                {
                  key: 'edit',
                  visible: noticeDetail.status === '待收货',
                  render: () => (
                    <Button
                      {...rowActionKind('update')}
                      size="small"
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
                  key: 'notify',
                  visible: noticeDetail.status === '待收货',
                  render: () => (
                    <Button
                      {...rowActionKind('submit')}
                      size="small"
                      onClick={() => handleNotify(noticeDetail)}
                    >
                      {t('app.kuaizhizao.shipmentNotice.notifyWarehouse')}
                    </Button>
                  ),
                },
                {
                  key: 'withdraw',
                  visible: noticeDetail.status === '已通知',
                  render: () => (
                    <Button {...rowActionKind('revoke')} size="small" onClick={() => handleWithdraw(noticeDetail)}>
                      {t('app.kuaizhizao.shipmentNotice.withdrawNotify')}
                    </Button>
                  ),
                },
                {
                  key: 'delete',
                  visible: noticeDetail.status === '待收货',
                  render: () => (
                    <Button {...rowActionKind('delete')} size="small" onClick={() => handleDelete(noticeDetail)}>
                      {t('common.delete')}
                    </Button>
                  ),
                },
              ]}
            />
          )
        }
        customContent={
          noticeDetail && (
            <>
              <DetailDrawerSection title={t('app.uniDetail.sectionBasic')}>
                <Descriptions
                  column={3}
                  size="small"
                  items={buildDescriptionItemsFromColumns(noticeDetail, detailColumns)}
                />
              </DetailDrawerSection>

              <DetailDrawerSection title={t('app.uniDetail.sectionCollaboration')}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {(() => {
                    const lifecycle = getReceiptNoticeLifecycle(noticeDetail as unknown as Record<string, unknown>);
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
                  {noticeDetail.id != null ? (
                    <DetailDrawerInlineFullChain
                      documentType='receipt_notice'
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

              <DetailDrawerSection title={t('app.uniDetail.sectionLines')}>
                <style>{`
                  .receipt-notice-detail-items .ant-table-wrapper .ant-table-body,
                  .receipt-notice-detail-items .ant-table-wrapper .ant-table-content {
                    overflow: visible !important;
                  }
                `}</style>
                {noticeDetail.items && noticeDetail.items.length > 0 ? (
                  <div
                    className="receipt-notice-detail-items"
                    style={{ width: '100%', maxWidth: '100%', overflowX: 'auto', overflowY: 'hidden' }}
                  >
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
                  </div>
                ) : (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('app.kuaizhizao.shipmentNotice.noDetailItems')} />
                )}
              </DetailDrawerSection>

              <DetailDrawerSection title={t('app.uniDetail.sectionTimeline')}>
                {receiptNoticeTracking.loading && (
                  <div style={{ textAlign: 'center', padding: 24 }}>
                    <Spin />
                  </div>
                )}
                {receiptNoticeTracking.error && !receiptNoticeTracking.loading && (
                  <Typography.Text type="danger">{receiptNoticeTracking.error}</Typography.Text>
                )}
                {receiptNoticeTracking.data && !receiptNoticeTracking.loading && (
                  <DocumentTrackingTimelineBody data={receiptNoticeTracking.data} />
                )}
                {!receiptNoticeTracking.loading && !receiptNoticeTracking.data && !receiptNoticeTracking.error && (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('app.kuaizhizao.shipmentNotice.noOperationRecords')} />
                )}
              </DetailDrawerSection>
            </>
          )
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
    </>
  );
};

export default ReceiptNoticesPage;
