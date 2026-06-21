/**
 * 送货单管理页面
 *
 * 在销售出库前/后向客户发送发货通知，记录物流信息。
 * 归属仓储管理-出库组（与 manifest 一致）。
 *
 * @author RiverEdge Team
 * @date 2026-02-19
 */

import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { useInvalidateMenuBadgeCounts } from '../../../../../hooks/useInvalidateMenuBadgeCounts';
import {
  ActionType,
  ProColumns,
  ProDescriptionsItemProps,
  ProFormItem,
  ProFormTextArea,
  ProFormSelect,
  ProFormText,
} from '@ant-design/pro-components';
import { App, Button, Tag, Space, Modal, Table, Form as AntForm, Select, InputNumber, Input, DatePicker, Dropdown, Row, Col, Typography, Spin, Empty, Descriptions } from 'antd';
import { PlusOutlined, EyeOutlined, EditOutlined, DeleteOutlined, SendOutlined, PrinterOutlined, MoreOutlined, ShoppingOutlined, DownOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { UniTable } from '../../../../../components/uni-table';
import {
  UniTableStackedPrimaryCell,
  UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
} from '../../../../../components/uni-table/stackedPrimaryColumn';
import SyncFromDatasetModal from '../../../../../components/sync-from-dataset-modal';
import { ListPageTemplate, DetailDrawerTemplate, FormModalTemplate, DRAWER_CONFIG, MODAL_CONFIG, WAREHOUSE_DETAIL_TABLE_STYLES, DetailDrawerSection } from '../../../../../components/layout-templates';
import { UniPullCreateToolbar } from '../../../../../components/uni-pull';
import { UniPullQueryModal, useUniPullQuery } from '../../../../../components/uni-pull-query';
import { UniTableDetailHeader } from '../../../../../components/uni-table-detail/UniTableDetail';
import { deliveryNoticeApi } from '../../../services/delivery-notice';
import { getDeliveryNoticeLifecycle } from '../../../utils/deliveryNoticeLifecycle';
import { useTranslation } from 'react-i18next';
import { FutureDatePicker } from '../../../../../utils/futureDatePickerShortcuts';
import { warehouseApi } from '../../../services/production';
import { listSalesOrders, getSalesOrder } from '../../../services/sales-order';
import { UniLifecycle, UniLifecycleStepper } from '../../../../../components/uni-lifecycle';
import { DocumentTrackingTimelineBody, useDocumentTracking } from '../../../../../components/document-tracking-panel';
import { customerApi } from '../../../../master-data/services/supply-chain';
import { UniMaterialSelect } from '../../../../../components/uni-material-select';
import { UniMaterialBatchPicker } from '../../../../../components/uni-material-batch-picker';
import type { Material } from '../../../../master-data/types/material';
import { buildKuaizhizaoPullCreateMenuItems, resolveKuaizhizaoDocumentAction } from '../../../constants/documentActionRegistry';
import DocumentAttachmentsField from '../../../components/DocumentAttachmentsField';
import { mapAttachmentsToUploadList, normalizeDocumentAttachments } from '../../../utils/documentAttachments';
import { rowActionKind, rowActionLabelKeep } from '../../../../../components/uni-action';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { useKuaizhizaoPrintModal } from '../../../hooks/useKuaizhizaoPrintModal';
import { resolveDeliveryNoticeQualityCertificates } from '../../../services/print';
import { SafetyCertificateOutlined } from '@ant-design/icons';
import { formatDateTime } from '../../../../../utils/format';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { withSingleNewShortcutHint } from '../../../../../utils/globalNewShortcut';

interface DeliveryNotice {
  id?: number;
  notice_code?: string;
  sales_delivery_id?: number;
  sales_delivery_code?: string;
  sales_order_id?: number;
  sales_order_code?: string;
  customer_id?: number;
  customer_name?: string;
  customer_contact?: string;
  customer_phone?: string;
  planned_delivery_date?: string;
  carrier?: string;
  tracking_number?: string;
  shipping_address?: string;
  status?: string;
  sent_at?: string;
  total_quantity?: number;
  total_amount?: number;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

interface DeliveryNoticeDetail extends DeliveryNotice {
  items?: { id?: number; material_code: string; material_name: string; material_unit: string; notice_quantity: number; unit_price?: number; total_amount?: number }[];
}

type PullSalesDeliveryCandidate = {
  id: number;
  delivery_code?: string;
  sales_order_id?: number;
  sales_order_code?: string;
  customer_id?: number;
  customer_name?: string;
  status?: string;
  delivery_date?: string;
  updated_at?: string;
  notice_id?: number;
  converted?: boolean;
};

const STATUS_MAP: Record<string, { text: string; color: string }> = {
  待发送: { text: '待发送', color: 'default' },
  已发送: { text: '已发送', color: 'processing' },
  已签收: { text: '已签收', color: 'success' },
};

const DeliveryNotesPage: React.FC = () => {
  const { t } = useTranslation();
  const { openPrint, PrintModal } = useKuaizhizaoPrintModal();
  const pullFromSalesDeliveryAction = resolveKuaizhizaoDocumentAction(t, 'delivery_note.pull_from_sales_delivery');
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const invalidateMenuBadgeCounts = useInvalidateMenuBadgeCounts();
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [noticeDetail, setNoticeDetail] = useState<DeliveryNoticeDetail | null>(null);

  const deliveryTracking = useDocumentTracking(
    detailDrawerVisible && noticeDetail?.id ? 'delivery_notice' : undefined,
    noticeDetail?.id
  );

  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [syncModalVisible, setSyncModalVisible] = useState(false);
  const { canPrint: canPrintQualityCertificate } = useResourcePermissions(
    'kuaizhizao:quality-management-finished-goods-inspection',
  );
  const formRef = useRef<any>(null);
  const [materialPickerOpen, setMaterialPickerOpen] = useState(false);
  const [customerList, setCustomerList] = useState<any[]>([]);
  const defaultDeliveryItem = { material_id: undefined, material_code: '', material_name: '', material_unit: '', notice_quantity: 1, unit_price: 0 };

  useEffect(() => {
    const load = async () => {
      try {
        const cust = await customerApi.list({ limit: 1000, isActive: true });
        setCustomerList(Array.isArray(cust) ? cust : cust?.data ?? []);
      } catch (e) {
        console.error('加载客户失败', e);
      }
    };
    load();
  }, []);

  const appendDeliveryNoteItemsFromMaterials = useCallback(
    (selected: Material[]) => {
      const current = formRef.current?.getFieldValue('items') ?? [];
      const newRows = selected.map((m) => ({
        material_id: m.id,
        material_code: m.mainCode ?? m.code ?? '',
        material_name: m.name ?? '',
        material_unit: m.baseUnit ?? '',
        notice_quantity: 1,
        unit_price: 0,
      }));
      formRef.current?.setFieldsValue({ items: [...current, ...newRows] });
      messageApi.success(t('app.kuaizhizao.common.materialBatchAdded', { count: selected.length }));
    },
    [messageApi, t]
  );

  const columns: ProColumns<DeliveryNotice>[] = useMemo(() => [
    {
      title: t('app.kuaizhizao.deliveryNote.col.customerNotice'),
      key: 'notice_code',
      dataIndex: 'notice_code',
      ...UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
      fixed: 'left',
      render: (_, r) => (
        <UniTableStackedPrimaryCell
          primary={String(r.customer_name ?? '')}
          secondary={String(r.notice_code ?? '')}
        />
      ),
    },
    { title: t('app.kuaizhizao.deliveryNote.col.noticeCode'), dataIndex: 'notice_code', hideInTable: true },
    { title: t('app.kuaizhizao.deliveryNote.field.customer'), dataIndex: 'customer_name', hideInTable: true },
    {
      title: t('app.kuaizhizao.deliveryNote.col.salesDeliveryCode'),
      dataIndex: 'sales_delivery_code',
      width: 140,
      ellipsis: true,
      render: (_, r) => (
        <Typography.Text copyable={{ text: String(r.sales_delivery_code ?? '') }} ellipsis>
          {r.sales_delivery_code ?? '-'}
        </Typography.Text>
      ),
    },
    { title: t('app.kuaizhizao.deliveryNote.col.carrier'), dataIndex: 'carrier', width: 100 },
    { title: t('app.kuaizhizao.deliveryNote.col.trackingNumber'), dataIndex: 'tracking_number', width: 120, ellipsis: true },
    { title: t('app.kuaizhizao.deliveryNote.col.plannedDelivery'), dataIndex: 'planned_delivery_date', valueType: 'date', width: 110 },
    { title: t('app.kuaizhizao.deliveryNote.col.sentAt'), dataIndex: 'sent_at', valueType: 'dateTime', width: 160 },
    {
      title: t('app.kuaizhizao.warehouseOutbound.col.updatedAt'),
      dataIndex: 'updated_at',
      width: 168,
      hideInSearch: true,
      defaultSortOrder: 'descend',
      render: (_, r) => (r.updated_at ? formatDateTime(r.updated_at, 'YYYY-MM-DD HH:mm:ss') : '-'),
    },
    {
      title: t('app.kuaizhizao.warehouseOutbound.col.lifecycle'),
      dataIndex: 'lifecycle_stage',
      align: 'left',
      fixed: 'right',
      hideInSearch: true,
      render: (_, record) => {
        const lc = getDeliveryNoticeLifecycle(record as Record<string, unknown>);
        return (
          <UniLifecycle
            percent={lc.percent}
            stageName={lc.stageName}
            status={lc.status}
            subStages={lc.subStages}
            showLabel
            showCircleTooltip={false}
            size="small"
          />
        );
      },
    },
    {
      title: t('app.kuaizhizao.warehouseOutbound.col.actions'),
      width: 200,
      fixed: 'right',
      render: (_, record) => {
        const moreItems = [
          ...(record.status === '待发送'
            ? [{ key: 'send', label: t('app.kuaizhizao.deliveryNote.action.send'), icon: <SendOutlined />, onClick: () => handleSend(record) }]
            : []),
          { key: 'print', label: t('app.kuaizhizao.materialBorrow.action.print'), icon: <PrinterOutlined />, onClick: () => handlePrint(record) },
          ...(canPrintQualityCertificate
            ? [{
                key: 'print-certificate',
                label: t('app.kuaizhizao.deliveryNote.action.printCertificate'),
                icon: <SafetyCertificateOutlined />,
                onClick: () => void handlePrintCertificate(record),
              }]
            : []),
        ]
        return (
          <Space>
            <Button {...rowActionKind('read')} onClick={() => handleDetail(record)} />
            {record.status === '待发送' && (
              <>
                <Button {...rowActionKind('update')} onClick={() => handleEdit(record)} />
                <Button {...rowActionKind('delete')} onClick={() => handleDelete(record)} />
              </>
            )}
            <Dropdown menu={{ items: moreItems }} trigger={['click']}>
              <Button {...rowActionKind('display')} {...rowActionLabelKeep()} icon={<MoreOutlined />}>
                {t('app.kuaizhizao.deliveryNote.action.more')}
              </Button>
            </Dropdown>
          </Space>
        )
      },
    },
  ], [t, canPrintQualityCertificate]);

  const handleDetail = async (record: DeliveryNotice) => {
    try {
      const detail = await deliveryNoticeApi.get(record.id!.toString());
      setNoticeDetail(detail as DeliveryNoticeDetail);
      setDetailDrawerVisible(true);
    } catch {
      messageApi.error(t('app.kuaizhizao.deliveryNote.msg.loadDetailFailed'));
    }
  };

  const handleEdit = async (record: DeliveryNotice) => {
    try {
      const detail = await deliveryNoticeApi.get(record.id!.toString()) as DeliveryNoticeDetail;
      const items = (detail.items || []).map((it: any) => ({
        material_id: it.material_id,
        material_code: it.material_code || '',
        material_name: it.material_name || '',
        material_unit: it.material_unit || '',
        notice_quantity: Number(it.notice_quantity) || 0,
        unit_price: Number(it.unit_price) || 0,
      }));
      formRef.current?.setFieldsValue({
        sales_delivery_id: detail.sales_delivery_id,
        sales_delivery_code: detail.sales_delivery_code,
        sales_order_id: detail.sales_order_id,
        sales_order_code: detail.sales_order_code,
        customer_id: detail.customer_id,
        customer_name: detail.customer_name,
        customer_contact: detail.customer_contact,
        customer_phone: detail.customer_phone,
        planned_delivery_date: detail.planned_delivery_date ? dayjs(detail.planned_delivery_date) : undefined,
        carrier: detail.carrier,
        tracking_number: detail.tracking_number,
        shipping_address: detail.shipping_address,
        notes: detail.notes,
        attachments: mapAttachmentsToUploadList(detail.attachments),
        items: items.length > 0 ? items : [defaultDeliveryItem],
      });
      setEditingId(record.id!);
      setEditModalVisible(true);
    } catch {
      messageApi.error(t('app.kuaizhizao.deliveryNote.msg.loadEditFailed'));
    }
  };

  const handleSend = (record: DeliveryNotice) => {
    Modal.confirm({
      title: t('app.kuaizhizao.deliveryNote.msg.sendTitle'),
      content: t('app.kuaizhizao.deliveryNote.msg.sendContent', { code: record.notice_code }),
      onOk: async () => {
        try {
          await deliveryNoticeApi.send(record.id!.toString());
          messageApi.success(t('app.kuaizhizao.deliveryNote.msg.sendSuccess'));
          invalidateMenuBadgeCounts();

          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || t('app.kuaizhizao.deliveryNote.msg.sendFailed'));
        }
      },
    });
  };

  const handleDelete = (record: DeliveryNotice) => {
    Modal.confirm({
      title: t('app.kuaizhizao.deliveryNote.msg.deleteTitle'),
      content: t('app.kuaizhizao.deliveryNote.msg.deleteContent', { code: record.notice_code }),
      onOk: async () => {
        try {
          await deliveryNoticeApi.delete(record.id!.toString());
          messageApi.success(t('app.kuaizhizao.deliveryNote.msg.deleteSuccess'));
          invalidateMenuBadgeCounts();

          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || t('app.kuaizhizao.deliveryNote.msg.deleteFailed'));
        }
      },
    });
  };

  const handleBatchDelete = async (keys: React.Key[]) => {
    if (keys.length === 0) return;
    try {
      for (const k of keys) {
        await deliveryNoticeApi.delete(String(k));
      }
      messageApi.success(t('app.kuaizhizao.deliveryNote.msg.batchDeleteSuccess', { count: keys.length }));
      setSelectedRowKeys([]);
      invalidateMenuBadgeCounts();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error?.message || t('app.kuaizhizao.deliveryNote.msg.batchDeleteFailed'));
    }
  };

  const handleSyncConfirm = async (rows: Record<string, any>[]) => {
    try {
      let successCount = 0;
      for (const row of rows) {
        const payload = {
          customer_id: row.customer_id ?? row.customerId,
          customer_name: row.customer_name || row.customerName,
          planned_delivery_date: row.planned_delivery_date || row.plannedDeliveryDate,
          status: row.status || '待发送',
          items: Array.isArray(row.items) ? row.items : [],
        };
        await deliveryNoticeApi.create(payload);
        successCount += 1;
      }
      messageApi.success(t('app.kuaizhizao.deliveryNote.msg.syncSuccess', { count: successCount }));
      invalidateMenuBadgeCounts();

      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error?.message || t('app.kuaizhizao.deliveryNote.msg.syncFailed'));
    }
  };

  const handlePrintCertificate = async (record: DeliveryNotice) => {
    if (!record.id) return;
    try {
      const res = await resolveDeliveryNoticeQualityCertificates(record.id);
      const certs = res?.certificates ?? [];
      if (!certs.length) {
        messageApi.warning(t('app.kuaizhizao.deliveryNote.msg.noCertificate'));
        return;
      }
      const first = certs[0];
      openPrint({
        documentType: 'product_quality_certificate',
        documentId: first.inspection_id,
        title: t('app.kuaizhizao.deliveryNote.msg.printCertificateTitle'),
      });
      if (certs.length > 1) {
        messageApi.info(
          t('app.kuaizhizao.deliveryNote.msg.multipleCertificates', {
            count: certs.length,
            name: first.material_name || first.release_certificate || '',
          }),
        );
      }
    } catch (e: any) {
      messageApi.error(e?.message || t('app.kuaizhizao.deliveryNote.msg.resolveCertificateFailed'));
    }
  };

  const handlePrint = (record: DeliveryNotice) => {
    if (!record.id) return;
    openPrint({ documentType: 'delivery_notice', documentId: record.id });
  };

  /** 参考销售订单：先打开弹窗，再执行其他逻辑 */
  const handleCreate = () => {
    setCreateModalVisible(true);
    setEditingId(null);
    setTimeout(() => {
      formRef.current?.resetFields();
      formRef.current?.setFieldsValue({ items: [defaultDeliveryItem] });
    }, 0);
  };
  useNewShortcut(handleCreate);
  const createButtonLabel = useMemo(
    () => withSingleNewShortcutHint(t('app.kuaizhizao.deliveryNote.create')),
    [t],
  );

  const pullFromSalesDeliveryQuery = useUniPullQuery<PullSalesDeliveryCandidate>({
    rowKey: 'id',
    selectionType: 'radio',
    loadData: async ({ keyword, page, pageSize }) => {
      try {
        const kw = keyword.trim();
        const [deliveryRes, noticeRes] = await Promise.all([
          warehouseApi.salesDelivery.list({
            skip: 0,
            limit: 200,
            keyword: kw || undefined,
          }),
          (async () => {
            const chunkSize = 100;
            const maxRows = 5000;
            const rows: any[] = [];
            let skip = 0;
            while (rows.length < maxRows) {
              const res = await deliveryNoticeApi.list({ skip, limit: chunkSize });
              const chunk = Array.isArray(res) ? res : (res as any)?.data ?? (res as any)?.items ?? [];
              if (!Array.isArray(chunk) || chunk.length === 0) break;
              rows.push(...chunk);
              if (chunk.length < chunkSize) break;
              skip += chunkSize;
            }
            return rows.slice(0, maxRows);
          })(),
        ]);
        const deliveries = Array.isArray(deliveryRes) ? deliveryRes : (deliveryRes as any)?.data ?? [];
        const notices = Array.isArray(noticeRes) ? noticeRes : (noticeRes as any)?.data ?? (noticeRes as any)?.items ?? [];
        const noticeByDeliveryId = new Map<number, any>();
        notices.forEach((n: any) => {
          if (n?.sales_delivery_id != null && !noticeByDeliveryId.has(Number(n.sales_delivery_id))) {
            noticeByDeliveryId.set(Number(n.sales_delivery_id), n);
          }
        });
        const filtered = (deliveries as any[]).filter((d: any) => {
          if (!kw) return true;
          const text = `${d.delivery_code || ''} ${d.sales_order_code || ''} ${d.customer_name || ''}`.toLowerCase();
          return text.includes(kw.toLowerCase());
        });
        const candidates: PullSalesDeliveryCandidate[] = filtered.map((d: any) => {
          const linked = noticeByDeliveryId.get(Number(d.id));
          return {
            id: Number(d.id),
            delivery_code: d.delivery_code,
            sales_order_id: d.sales_order_id,
            sales_order_code: d.sales_order_code,
            customer_id: d.customer_id,
            customer_name: d.customer_name,
            status: d.status,
            delivery_date: d.delivery_date,
            updated_at: d.updated_at,
            notice_id: linked?.id,
            converted: !!linked,
          };
        });
        const start = (page - 1) * pageSize;
        return { data: candidates.slice(start, start + pageSize), total: candidates.length };
      } catch {
        messageApi.error(t('app.kuaizhizao.deliveryNote.msg.loadListFailed'));
        return { data: [], total: 0 };
      }
    },
    isRowDisabled: (record) => !!record.converted,
    onConfirm: async (keys, rows) => {
      const selectedId = Number(keys[0]);
      if (!selectedId) {
        messageApi.warning(t('app.kuaizhizao.deliveryNote.msg.selectSource', { label: pullFromSalesDeliveryAction.sourceLabel }));
        return;
      }
      const selected = rows[0];
      if (selected?.converted) {
        messageApi.warning(
          t('app.kuaizhizao.deliveryNote.msg.alreadyCreated', {
            source: pullFromSalesDeliveryAction.sourceLabel,
            target: pullFromSalesDeliveryAction.targetLabel,
          }),
        );
        return;
      }
      try {
        const detail: any = await warehouseApi.salesDelivery.get(String(selectedId));
        const itemRows = Array.isArray(detail?.items) ? detail.items : [];
        const validItems = itemRows
          .filter((it: any) => (Number(it.delivery_quantity ?? it.quantity ?? 0) || 0) > 0)
          .map((it: any) => ({
            material_id: it.material_id ?? it.materialId,
            material_code: it.material_code ?? it.materialCode ?? '',
            material_name: it.material_name ?? it.materialName ?? '',
            material_unit: it.unit ?? it.material_unit ?? it.materialUnit ?? '',
            notice_quantity: Number(it.delivery_quantity ?? it.quantity ?? 0) || 0,
            unit_price: Number(it.unit_price ?? it.unitPrice ?? 0) || 0,
          }));
        if (!detail?.customer_id || validItems.length === 0) {
          throw new Error(t('app.kuaizhizao.deliveryNote.msg.missingCustomerOrLines'));
        }
        await deliveryNoticeApi.create({
          customer_id: detail.customer_id,
          customer_name: detail.customer_name,
          customer_contact: detail.customer_contact,
          customer_phone: detail.customer_phone,
          sales_delivery_id: detail.id ?? selectedId,
          sales_delivery_code: detail.delivery_code ?? selected?.delivery_code,
          sales_order_id: detail.sales_order_id ?? selected?.sales_order_id,
          sales_order_code: detail.sales_order_code ?? selected?.sales_order_code,
          planned_delivery_date: detail.delivery_date,
          shipping_address: detail.shipping_address,
          items: validItems,
        });
        messageApi.success(
          t('app.kuaizhizao.deliveryNote.msg.pullCreateSuccess', {
            source: pullFromSalesDeliveryAction.sourceLabel,
            target: pullFromSalesDeliveryAction.targetLabel,
          }),
        );
        invalidateMenuBadgeCounts();
        actionRef.current?.reload();
        pullFromSalesDeliveryQuery.closeModal();
      } catch (e: any) {
        messageApi.error(
          e?.response?.data?.detail
            || e?.message
            || t('app.kuaizhizao.deliveryNote.msg.pullCreateFailed', {
              source: pullFromSalesDeliveryAction.sourceLabel,
              target: pullFromSalesDeliveryAction.targetLabel,
            }),
        );
      }
    },
  });

  const handleCreateSubmit = async (values: any) => {
    const validItems = (values.items ?? []).filter((it: any) => it.material_id && (Number(it.notice_quantity) || 0) > 0);
    if (!validItems.length) {
      messageApi.error(t('app.kuaizhizao.deliveryNote.msg.needValidLines'));
      throw new Error(t('app.kuaizhizao.deliveryNote.msg.needValidLines'));
    }
    const cust = customerList.find((c: any) => (c.id ?? c.customer_id) === values.customer_id);
    if (!cust) {
      messageApi.error(t('app.kuaizhizao.deliveryNote.msg.selectCustomer'));
      throw new Error(t('app.kuaizhizao.deliveryNote.msg.selectCustomer'));
    }
    try {
      await deliveryNoticeApi.create({
        customer_id: values.customer_id,
        customer_name: cust.name || cust.customer_name || cust.code,
        customer_contact: values.customer_contact,
        customer_phone: values.customer_phone,
        sales_delivery_id: values.sales_delivery_id,
        sales_delivery_code: values.sales_delivery_code,
        sales_order_id: values.sales_order_id,
        sales_order_code: values.sales_order_code,
        planned_delivery_date: values.planned_delivery_date ? formatDateTime(values.planned_delivery_date, 'YYYY-MM-DD') : undefined,
        carrier: values.carrier,
        tracking_number: values.tracking_number,
        shipping_address: values.shipping_address,
        notes: values.notes,
        attachments: normalizeDocumentAttachments(values.attachments),
        items: validItems.map((it: any) => ({
          material_id: it.material_id,
          material_code: it.material_code || '',
          material_name: it.material_name || '',
          material_unit: it.material_unit || '',
          notice_quantity: Number(it.notice_quantity) || 0,
          unit_price: Number(it.unit_price) || 0,
        })),
      });
      messageApi.success(t('app.kuaizhizao.deliveryNote.msg.createSuccess'));
      setCreateModalVisible(false);
      invalidateMenuBadgeCounts();

      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('app.kuaizhizao.deliveryNote.msg.createFailed'));
      throw error;
    }
  };

  const handleEditSubmit = async (values: any) => {
    if (!editingId) return;
    const validItems = (values.items ?? []).filter((it: any) => it.material_id && (Number(it.notice_quantity) || 0) > 0);
    if (!validItems.length) {
      messageApi.error(t('app.kuaizhizao.deliveryNote.msg.needValidLines'));
      throw new Error(t('app.kuaizhizao.deliveryNote.msg.needValidLines'));
    }
    const cust = customerList.find((c: any) => (c.id ?? c.customer_id) === values.customer_id);
    try {
      await deliveryNoticeApi.update(editingId.toString(), {
        customer_id: values.customer_id,
        customer_name: cust?.name || cust?.customer_name || values.customer_name,
        customer_contact: values.customer_contact,
        customer_phone: values.customer_phone,
        sales_delivery_id: values.sales_delivery_id,
        sales_delivery_code: values.sales_delivery_code,
        sales_order_id: values.sales_order_id,
        sales_order_code: values.sales_order_code,
        planned_delivery_date: values.planned_delivery_date ? formatDateTime(values.planned_delivery_date, 'YYYY-MM-DD') : undefined,
        carrier: values.carrier,
        tracking_number: values.tracking_number,
        shipping_address: values.shipping_address,
        notes: values.notes,
        attachments: normalizeDocumentAttachments(values.attachments),
        items: validItems.map((it: any) => ({
          material_id: it.material_id,
          material_code: it.material_code || '',
          material_name: it.material_name || '',
          material_unit: it.material_unit || '',
          notice_quantity: Number(it.notice_quantity) || 0,
          unit_price: Number(it.unit_price) || 0,
        })),
      });
      messageApi.success(t('app.kuaizhizao.deliveryNote.msg.updateSuccess'));
      setEditModalVisible(false);
      invalidateMenuBadgeCounts();

      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('app.kuaizhizao.deliveryNote.msg.updateFailed'));
      throw error;
    }
  };

  const detailColumns: ProDescriptionsItemProps<DeliveryNoticeDetail>[] = useMemo(() => [
    { title: t('app.kuaizhizao.deliveryNote.col.noticeCode'), dataIndex: 'notice_code' },
    { title: t('app.kuaizhizao.deliveryNote.col.salesDeliveryCode'), dataIndex: 'sales_delivery_code' },
    { title: t('app.kuaizhizao.deliveryNote.col.salesOrderCode'), dataIndex: 'sales_order_code' },
    { title: t('app.kuaizhizao.deliveryNote.field.customer'), dataIndex: 'customer_name' },
    { title: t('app.kuaizhizao.deliveryNote.field.contact'), dataIndex: 'customer_contact' },
    { title: t('app.kuaizhizao.deliveryNote.field.phone'), dataIndex: 'customer_phone' },
    { title: t('app.kuaizhizao.deliveryNote.col.plannedDelivery'), dataIndex: 'planned_delivery_date', valueType: 'date' },
    { title: t('app.kuaizhizao.deliveryNote.col.carrier'), dataIndex: 'carrier' },
    { title: t('app.kuaizhizao.deliveryNote.col.trackingNumber'), dataIndex: 'tracking_number' },
    { title: t('app.kuaizhizao.deliveryNote.field.shippingAddress'), dataIndex: 'shipping_address', span: 2 },
    {
      title: t('app.kuaizhizao.warehouseOutbound.col.status'),
      dataIndex: 'status',
      render: (s) => {
        const c = STATUS_MAP[(s as string) || ''] || { text: (s as string) || '-', color: 'default' };
        return <Tag color={c.color}>{c.text}</Tag>;
      },
    },
    { title: t('app.kuaizhizao.deliveryNote.col.sentAt'), dataIndex: 'sent_at', valueType: 'dateTime' },
    { title: t('app.kuaizhizao.common.fieldNotes'), dataIndex: 'notes', span: 2 },
  ], [t]);

  const detailItemColumns = useMemo(
    () => [
      { title: t('app.kuaizhizao.warehouseOutbound.col.materialCode'), dataIndex: 'material_code', width: 120 },
      { title: t('app.kuaizhizao.warehouseOutbound.col.materialName'), dataIndex: 'material_name', width: 150 },
      { title: t('app.kuaizhizao.warehouseOutbound.col.unit'), dataIndex: 'material_unit', width: 60 },
      { title: t('app.kuaizhizao.warehouseOutbound.field.quantity'), dataIndex: 'notice_quantity', width: 90, align: 'right' as const },
      { title: t('app.kuaizhizao.warehouseOutbound.field.unitPrice'), dataIndex: 'unit_price', width: 90, align: 'right' as const },
      { title: t('app.kuaizhizao.warehouseOutbound.field.amount'), dataIndex: 'total_amount', width: 100, align: 'right' as const },
    ],
    [t],
  );

  const pullModalColumns = useMemo(
    () => [
      { title: t('app.kuaizhizao.deliveryNote.col.salesDeliveryCode'), dataIndex: 'delivery_code', width: 180, ellipsis: true },
      { title: t('app.kuaizhizao.deliveryNote.col.salesOrderCode'), dataIndex: 'sales_order_code', width: 180, ellipsis: true },
      { title: t('app.kuaizhizao.deliveryNote.field.customer'), dataIndex: 'customer_name', width: 180, ellipsis: true },
      { title: t('app.kuaizhizao.warehouseOutbound.pull.colOutboundStatus'), dataIndex: 'status', width: 120, align: 'center' as const },
      { title: t('app.kuaizhizao.warehouseOutbound.pull.colOutboundDate'), dataIndex: 'delivery_date', width: 130, render: (v: string) => (v ? formatDateTime(v, 'YYYY-MM-DD') : '-') },
      { title: t('app.kuaizhizao.warehouseOutbound.col.updatedAt'), dataIndex: 'updated_at', width: 180, render: (v: string) => (v ? formatDateTime(v, 'YYYY-MM-DD HH:mm:ss') : '-') },
      {
        title: t('app.kuaizhizao.warehouseOutbound.pull.convertStatus'),
        key: 'convert_status',
        width: 150,
        align: 'center' as const,
        render: (_: unknown, r: PullSalesDeliveryCandidate) =>
          r.converted ? (
            <Tag color="gold">{t('app.kuaizhizao.warehouseOutbound.pull.alreadyCreatedDelivery', { label: pullFromSalesDeliveryAction.targetLabel })}</Tag>
          ) : (
            <Tag color="success">{t('app.kuaizhizao.warehouseOutbound.pull.canCreate')}</Tag>
          ),
      },
    ],
    [pullFromSalesDeliveryAction.targetLabel, t],
  );

  const renderForm = (onFinish: (values: any) => Promise<void>) => (
    <>
      <Row gutter={16}>
        <Col span={12}>
          <ProFormItem name="customer_id" label={t('app.kuaizhizao.deliveryNote.field.customer')} rules={[{ required: true }]}>
            <Select
              placeholder={t('app.kuaizhizao.deliveryNote.field.selectCustomer')}
              options={customerList.map((c: any) => ({ value: c.id ?? c.customer_id, label: c.name || c.customer_name || c.code }))}
              onChange={(v) => {
                const cust = customerList.find((x: any) => (x.id ?? x.customer_id) === v);
                if (cust) formRef.current?.setFieldsValue({ customer_name: cust.name || cust.customer_name, customer_contact: cust.contact, customer_phone: cust.phone });
              }}
            />
          </ProFormItem>
        </Col>
        <Col span={12}>
          <ProFormItem name="customer_contact" label={t('app.kuaizhizao.deliveryNote.field.contact')}>
            <Input placeholder={t('app.kuaizhizao.deliveryNote.field.contact')} />
          </ProFormItem>
        </Col>
      </Row>
      <Row gutter={16}>
        <Col span={12}>
          <ProFormItem name="customer_phone" label={t('app.kuaizhizao.deliveryNote.field.phone')}>
            <Input placeholder={t('app.kuaizhizao.deliveryNote.field.phone')} />
          </ProFormItem>
        </Col>
        <Col span={12} />
      </Row>
      <Row gutter={16}>
        <Col span={12}>
          <ProFormSelect
            name="sales_delivery_id"
            label={t('app.kuaizhizao.deliveryNote.field.linkedSalesDelivery')}
            placeholder={t('app.kuaizhizao.deliveryNote.field.linkedSalesDeliveryPlaceholder')}
            allowClear
            showSearch
            debounceTime={300}
            fieldProps={{ optionFilterProp: 'label' }}
            request={async () => {
              try {
                const res = await warehouseApi.salesDelivery.list({ limit: 200, skip: 0 });
                const list = Array.isArray(res) ? res : ((res as any)?.data ?? []);
                return (list as any[]).map((d: any) => ({
                  label: `${d.delivery_code || d.code || '#' + d.id}${d.customer_name ? ' · ' + d.customer_name : ''}`,
                  value: d.id,
                }));
              } catch {
                return [];
              }
            }}
            onChange={async (val) => {
              if (val == null || val === '') {
                formRef.current?.setFieldsValue({
                  sales_delivery_code: undefined,
                });
                return;
              }
              try {
                const d: any = await warehouseApi.salesDelivery.get(String(val));
                formRef.current?.setFieldsValue({
                  sales_delivery_code: d.delivery_code ?? d.code,
                  sales_order_id: d.sales_order_id,
                  sales_order_code: d.sales_order_code,
                });
              } catch {
                /* ignore */
              }
            }}
          />
        </Col>
        <Col span={12}>
          <ProFormSelect
            name="sales_order_id"
            label={t('app.kuaizhizao.deliveryNote.field.linkedSalesOrder')}
            placeholder={t('app.kuaizhizao.deliveryNote.field.linkedSalesOrderPlaceholder')}
            allowClear
            showSearch
            debounceTime={300}
            fieldProps={{ optionFilterProp: 'label' }}
            request={async ({ keyWords }) => {
              try {
                const r = await listSalesOrders({
                  limit: 100,
                  skip: 0,
                  keyword: keyWords || undefined,
                });
                return (r.data || []).map((o: any) => ({
                  label: `${o.order_code || o.id}${o.customer_name ? ' · ' + o.customer_name : ''}`,
                  value: o.id,
                }));
              } catch {
                return [];
              }
            }}
            onChange={async (val) => {
              if (val == null || val === '') {
                formRef.current?.setFieldsValue({ sales_order_code: undefined });
                return;
              }
              try {
                const o = await getSalesOrder(Number(val), false, false);
                formRef.current?.setFieldsValue({ sales_order_code: o.order_code });
              } catch {
                /* ignore */
              }
            }}
          />
        </Col>
      </Row>
      <ProFormText name="sales_delivery_code" hidden />
      <ProFormText name="sales_order_code" hidden />
      <Row gutter={16}>
        <Col span={12}>
          <ProFormItem name="planned_delivery_date" label={t('app.kuaizhizao.deliveryNote.field.plannedDeliveryDate')}>
            <FutureDatePicker getForm={() => formRef.current} t={t} style={{ width: '100%' }} />
          </ProFormItem>
        </Col>
        <Col span={12}>
          <ProFormItem name="carrier" label={t('app.kuaizhizao.deliveryNote.field.carrier')}>
            <Input placeholder={t('app.kuaizhizao.deliveryNote.field.carrierPlaceholder')} />
          </ProFormItem>
        </Col>
      </Row>
      <Row gutter={16}>
        <Col span={12}>
          <ProFormItem name="tracking_number" label={t('app.kuaizhizao.deliveryNote.field.trackingNumber')}>
            <Input placeholder={t('app.kuaizhizao.deliveryNote.field.trackingPlaceholder')} />
          </ProFormItem>
        </Col>
        <Col span={12} />
      </Row>
      <Row gutter={16}>
        <Col span={12}>
          <ProFormItem name="shipping_address" label={t('app.kuaizhizao.deliveryNote.field.shippingAddress')}>
            <Input.TextArea rows={2} placeholder={t('app.kuaizhizao.deliveryNote.field.shippingAddress')} />
          </ProFormItem>
        </Col>
        <Col span={12} />
      </Row>
      <div className="uni-table-detail" style={{ width: '100%' }}>
        <UniTableDetailHeader title={t('app.kuaizhizao.warehouseOutbound.section.lines')} required />
        <AntForm.Item name="items" noStyle rules={[{ type: 'array', min: 1, message: t('app.kuaizhizao.deliveryNote.msg.needValidLines') }]}>
          <AntForm.List name="items">
            {(fields, { add, remove }) => {
              const cols = [
                {
                  title: t('app.kuaizhizao.warehouseOutbound.field.material'),
                  dataIndex: 'material_id',
                  width: 260,
                  render: (_: any, __: any, index: number) => (
                    <AntForm.Item noStyle shouldUpdate={(prev: any, curr: any) => prev?.items?.[index] !== curr?.items?.[index]}>
                      {({ getFieldValue }: any) => {
                        const row = getFieldValue('items')?.[index];
                        const mid = row?.material_id ? Number(row.material_id) : null;
                        const fallback = mid && (row?.material_code || row?.material_name)
                          ? { value: mid, label: `${row.material_code || ''} - ${row.material_name || ''}`.trim() || String(mid) }
                          : undefined;
                        return (
                          <div className="warehouse-detail-material-cell">
                            <UniMaterialSelect
                              name={[index, 'material_id']}
                              label=""
                              placeholder={t('app.kuaizhizao.warehouseOutbound.field.selectMaterial')}
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
                          </div>
                        );
                      }}
                    </AntForm.Item>
                  ),
                },
                {
                  title: t('app.kuaizhizao.warehouseOutbound.col.unit'),
                  dataIndex: 'material_unit',
                  width: 80,
                  render: (_: any, __: any, index: number) => (
                    <AntForm.Item name={[index, 'material_unit']} style={{ margin: 0 }}>
                      <Input placeholder={t('app.kuaizhizao.warehouseOutbound.col.unit')} size="small" />
                    </AntForm.Item>
                  ),
                },
                {
                  title: t('app.kuaizhizao.warehouseOutbound.field.quantity'),
                  dataIndex: 'notice_quantity',
                  width: 100,
                  align: 'right' as const,
                  render: (_: any, __: any, index: number) => (
                    <AntForm.Item name={[index, 'notice_quantity']} rules={[{ required: true, message: t('app.kuaizhizao.warehouseOutbound.field.required') }, { type: 'number', min: 0.01, message: '>0' }]} style={{ margin: 0 }}>
                      <InputNumber placeholder={t('app.kuaizhizao.warehouseOutbound.field.quantity')} min={0} precision={2} style={{ width: '100%' }} size="small" />
                    </AntForm.Item>
                  ),
                },
                {
                  title: t('app.kuaizhizao.warehouseOutbound.field.unitPrice'),
                  dataIndex: 'unit_price',
                  width: 100,
                  align: 'right' as const,
                  render: (_: any, __: any, index: number) => (
                    <AntForm.Item name={[index, 'unit_price']} style={{ margin: 0 }}>
                      <InputNumber placeholder="0" min={0} precision={2} style={{ width: '100%' }} size="small" />
                    </AntForm.Item>
                  ),
                },
                {
                  title: t('app.kuaizhizao.warehouseOutbound.col.actions'),
                  width: 60,
                  render: (_: any, __: any, index: number) => (
                    <Button type="link" danger size="small" icon={<DeleteOutlined />} onClick={() => remove(index)} disabled={fields.length <= 1} />
                  ),
                },
              ];
              const totalWidth = cols.reduce((s, c) => s + (c.width as number || 0), 0);
              return (
                <div style={{ width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
                  <style>{WAREHOUSE_DETAIL_TABLE_STYLES}</style>
                  <div style={{ width: '100%', overflowX: 'auto' }}>
                    <Table
                      className="warehouse-detail-table"
                      size="small"
                      dataSource={fields.map((f, i) => ({ ...f, key: f.key ?? i }))}
                      rowKey="key"
                      pagination={false}
                      columns={cols}
                      scroll={fields.length > 0 ? { x: totalWidth } : undefined}
                      style={{ width: '100%', margin: 0 }}
                      footer={() => (
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', width: '100%' }}>
                          <Button type="dashed" icon={<PlusOutlined />} style={{ flex: 1, minWidth: 120 }} onClick={() => add(defaultDeliveryItem)}>
                            {t('app.kuaizhizao.warehouseOutbound.action.addLine')}
                          </Button>
                          <Button
                            type="default"
                            icon={<ShoppingOutlined />}
                            style={{ flex: 1, minWidth: 120 }}
                            onClick={() => setMaterialPickerOpen(true)}
                          >
                            {t('app.kuaizhizao.common.materialBatchSelect')}
                          </Button>
                        </div>
                      )}
                    />
                  </div>
                </div>
              );
            }}
          </AntForm.List>
        </AntForm.Item>
      </div>
      <DocumentAttachmentsField category="delivery_notice_attachments" />
      <ProFormTextArea name="notes" label={t('app.kuaizhizao.common.fieldNotes')} placeholder={t('app.kuaizhizao.warehouseOutbound.field.optional')} fieldProps={{ rows: 2 }} />
    </>
  );

  return (
    <>
      <ListPageTemplate>
        <UniTable
          headerTitle={t('app.kuaizhizao.deliveryNote.title')}
          columnPersistenceId="apps.kuaizhizao.pages.warehouse-management.delivery-notes"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          showAdvancedSearch={true}
          showCreateButton={false}
          createButtonText={createButtonLabel}
          onCreate={handleCreate}
          toolBarRender={() => [
            <UniPullCreateToolbar
              compactKey="create-delivery-note-with-pull"
              createIcon={<PlusOutlined />}
              createLabel={createButtonLabel}
              onCreate={handleCreate}
              menuItems={buildKuaizhizaoPullCreateMenuItems(t, [
                {
                  key: 'pull-from-sales-delivery',
                  actionKey: 'delivery_note.pull_from_sales_delivery',
                  onClick: () => {
                    pullFromSalesDeliveryQuery.openModal();
                  },
                },
              ])}
            />,
          ]}
          enableRowSelection
          onRowSelectionChange={setSelectedRowKeys}
          showDeleteButton
          onDelete={handleBatchDelete}
          deleteConfirmTitle={(count) => t('app.kuaizhizao.deliveryNote.msg.deleteConfirm', { count })}
          showImportButton={false}
          showExportButton
          onExport={async (type, keys, pageData) => {
            try {
              const chunkSize = 100;
              const maxRows = 10000;
              const rawData: DeliveryNotice[] = [];
              let skip = 0;
              while (rawData.length < maxRows) {
                const response = await deliveryNoticeApi.list({ skip, limit: chunkSize });
                const chunk = Array.isArray(response) ? response : response?.items || response?.data || [];
                if (!Array.isArray(chunk) || chunk.length === 0) break;
                rawData.push(...chunk);
                if (chunk.length < chunkSize) break;
                skip += chunkSize;
              }
              let items = rawData;
              if (type === 'currentPage' && pageData?.length) {
                items = pageData;
              } else if (type === 'selected' && keys?.length) {
                items = rawData.filter((d: DeliveryNotice) => d.id != null && keys.includes(d.id));
              }
              if (items.length === 0) {
                messageApi.warning(t('app.kuaizhizao.deliveryNote.msg.noExportData'));
                return;
              }
              const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `delivery-notes-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              URL.revokeObjectURL(url);
              messageApi.success(t('app.kuaizhizao.deliveryNote.msg.exportSuccess', { count: items.length }));
            } catch (error: any) {
              messageApi.error(error?.message || t('app.kuaizhizao.deliveryNote.msg.exportFailed'));
            }
          }}
          showSyncButton
          onSync={() => setSyncModalVisible(true)}
          request={async (params) => {
            try {
              const response = await deliveryNoticeApi.list({
                skip: ((params.current || 1) - 1) * (params.pageSize || 20),
                limit: params.pageSize || 20,
                status: params.status,
                customer_id: params.customer_id,
                keyword: (params as any).keyword,
              });
              const data = Array.isArray(response) ? response : response?.items || response?.data || [];
              const total = Array.isArray(response) ? response.length : response?.total ?? data.length;
              return { data, success: true, total };
            } catch {
              messageApi.error(t('app.kuaizhizao.deliveryNote.msg.loadListFailed'));
              return { data: [], success: false, total: 0 };
            }
          }}
          scroll={{ x: 1300 }}
        />
      </ListPageTemplate>

      <UniPullQueryModal<PullSalesDeliveryCandidate>
        open={pullFromSalesDeliveryQuery.open}
        title={pullFromSalesDeliveryAction.label}
        onCancel={pullFromSalesDeliveryQuery.closeModal}
        onOk={pullFromSalesDeliveryQuery.handleConfirm}
        rowKey="id"
        columns={pullModalColumns}
        dataSource={pullFromSalesDeliveryQuery.dataSource}
        loading={pullFromSalesDeliveryQuery.loading}
        confirmLoading={pullFromSalesDeliveryQuery.confirmLoading}
        selectionType={pullFromSalesDeliveryQuery.selectionType}
        selectedRowKeys={pullFromSalesDeliveryQuery.selectedRowKeys}
        onSelectedRowKeysChange={pullFromSalesDeliveryQuery.handleSelectedRowKeysChange}
        isRowDisabled={pullFromSalesDeliveryQuery.isRowDisabled}
        searchDraft={pullFromSalesDeliveryQuery.searchDraft}
        onSearchDraftChange={pullFromSalesDeliveryQuery.setSearchDraft}
        onSearchApply={pullFromSalesDeliveryQuery.handleSearchApply}
        onSearchClear={pullFromSalesDeliveryQuery.handleSearchClear}
        appliedKeyword={pullFromSalesDeliveryQuery.appliedKeyword}
        searchPlaceholder={t('app.kuaizhizao.deliveryNote.pull.searchPlaceholder')}
        page={pullFromSalesDeliveryQuery.page}
        pageSize={pullFromSalesDeliveryQuery.pageSize}
        total={pullFromSalesDeliveryQuery.total}
        onPageChange={pullFromSalesDeliveryQuery.handlePageChange}
        okText={t('app.kuaizhizao.deliveryNote.action.createFromPull')}
        width={MODAL_CONFIG.EXTRA_LARGE_WIDTH}
      />

      <DetailDrawerTemplate
        title={`${t('app.kuaizhizao.deliveryNote.detailTitle')}${noticeDetail?.notice_code ? ` - ${noticeDetail.notice_code}` : ''}`}
        open={detailDrawerVisible}
        onClose={() => { setDetailDrawerVisible(false); setNoticeDetail(null); }}
        width={DRAWER_CONFIG.HALF_WIDTH}
        columns={[]}
        column={3}
        customContent={
          noticeDetail ? (
            <>
              <DetailDrawerSection title={t('app.kuaizhizao.deliveryNote.section.basicInfo')}>
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

              <DetailDrawerSection title={t('app.kuaizhizao.warehouseOutbound.section.lifecycle')}>
                {(() => {
                  const lc = getDeliveryNoticeLifecycle(noticeDetail as Record<string, unknown>);
                  const mainStages = lc.mainStages ?? [];
                  if (mainStages.length === 0) return null;
                  return (
                    <UniLifecycleStepper
                      steps={mainStages}
                      showLabels
                      status={lc.status}
                      nextStepSuggestions={lc.nextStepSuggestions}
                    />
                  );
                })()}
              </DetailDrawerSection>

              <DetailDrawerSection title={t('app.kuaizhizao.deliveryNote.section.lineDetails')}>
                {noticeDetail.items && noticeDetail.items.length > 0 ? (
                  <>
                    <style>{WAREHOUSE_DETAIL_TABLE_STYLES}</style>
                    <Table
                      className="warehouse-detail-table"
                      size="small"
                      rowKey={(row: Record<string, unknown>, idx = 0) =>
                        String((row as { id?: React.Key }).id ?? `${noticeDetail?.id ?? 'dn'}-${idx}`)
                      }
                      columns={detailItemColumns}
                      dataSource={noticeDetail.items}
                      pagination={false}
                    />
                  </>
                ) : (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('app.kuaizhizao.deliveryNote.msg.noLineDetails')} />
                )}
              </DetailDrawerSection>

              <DetailDrawerSection title={t('app.kuaizhizao.deliveryNote.section.operationLog')}>
                {deliveryTracking.loading && (
                  <div style={{ textAlign: 'center', padding: 24 }}>
                    <Spin />
                  </div>
                )}
                {deliveryTracking.error && !deliveryTracking.loading && (
                  <Typography.Text type="danger">{deliveryTracking.error}</Typography.Text>
                )}
                {deliveryTracking.data && !deliveryTracking.loading && (
                  <DocumentTrackingTimelineBody data={deliveryTracking.data} />
                )}
                {!deliveryTracking.loading && !deliveryTracking.data && !deliveryTracking.error && (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('app.kuaizhizao.deliveryNote.msg.noOperationLog')} />
                )}
              </DetailDrawerSection>
            </>
          ) : null
        }
      />

      <FormModalTemplate
        title={t('app.kuaizhizao.deliveryNote.create')}
        open={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        formRef={formRef}
        onFinish={handleCreateSubmit}
        width={MODAL_CONFIG.LARGE_WIDTH}
        grid={false}
      >
        {renderForm(handleCreateSubmit)}
      </FormModalTemplate>

      <FormModalTemplate
        title={t('app.kuaizhizao.deliveryNote.edit')}
        open={editModalVisible}
        onClose={() => setEditModalVisible(false)}
        formRef={formRef}
        onFinish={handleEditSubmit}
        width={MODAL_CONFIG.LARGE_WIDTH}
        grid={false}
      >
        {renderForm(handleEditSubmit)}
      </FormModalTemplate>

      <UniMaterialBatchPicker
        open={materialPickerOpen}
        onCancel={() => setMaterialPickerOpen(false)}
        onConfirm={appendDeliveryNoteItemsFromMaterials}
      />

      <SyncFromDatasetModal
        open={syncModalVisible}
        onClose={() => setSyncModalVisible(false)}
        onConfirm={handleSyncConfirm}
        title={t('app.kuaizhizao.deliveryNote.syncTitle')}
      />

      {PrintModal}
    </>
  );
};

export default DeliveryNotesPage;
