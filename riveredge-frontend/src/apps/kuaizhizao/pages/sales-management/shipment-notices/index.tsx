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
import { useInvalidateMenuBadgeCounts } from '../../../../../hooks/useInvalidateMenuBadgeCounts';
import { useNavigate } from 'react-router-dom';
import { ActionType, ProColumns, ProDescriptionsItemProps, ProForm, ProFormText, ProFormDatePicker, ProFormTextArea, ProFormItem } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Modal, Table, Form as AntForm, Select, InputNumber, Input, Row, Col, Typography, Dropdown, Spin, Empty, Descriptions } from 'antd';
import { PlusOutlined, EyeOutlined, EditOutlined, DeleteOutlined, SendOutlined, AppstoreAddOutlined, ImportOutlined, MoreOutlined, DownOutlined } from '@ant-design/icons';
import { theme as AntdTheme } from 'antd';
import dayjs from 'dayjs';
import { UniTable } from '../../../../../components/uni-table';
import {
  UniTableStackedPrimaryCell,
  UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
} from '../../../../../components/uni-table/stackedPrimaryColumn';
import { UniBatchMenuButton } from '../../../../../components/uni-batch';
import { UniMaterialSelect } from '../../../../../components/uni-material-select';
import { UniMaterialBatchPicker } from '../../../../../components/uni-material-batch-picker';
const LazyUniImport = lazy(() =>
  import('../../../../../components/uni-import').then((m) => ({ default: m.UniImport })),
);
import type { Material } from '../../../../master-data/types/material';
import { UniWarehouseSelect } from '../../../../../components/uni-warehouse-select';
import { ListPageTemplate, DetailDrawerTemplate, DetailDrawerInlineFullChain, FormModalTemplate, DRAWER_CONFIG, MODAL_CONFIG, DetailDrawerSection } from '../../../../../components/layout-templates';
import { UniPullCreateToolbar } from '../../../../../components/uni-pull';
import { UniTableDetail } from '../../../../../components/uni-table-detail';
import { shipmentNoticeApi } from '../../../services/shipment-notice';
import { LinkedOqcPanel } from '../../quality-management/components/LinkedInspectionPanel';
import { getShipmentNoticeLifecycle } from '../../../utils/shipmentNoticeLifecycle';
import { UniLifecycleStepper } from '../../../../../components/uni-lifecycle';
import { LIST_LIFECYCLE_STAGE_FIELD } from '../../../../../utils/listLifecycleStage';
import { ListUniLifecycleCell } from '../shared/ListUniLifecycleCell';
import { DocumentTrackingTimelineBody, useDocumentTracking } from '../../../../../components/document-tracking-panel';
import { WarehouseTraceBriefPrimaryActions } from '../../warehouse-management/WarehouseTraceBriefFooter';
import { customerApi } from '../../../../master-data/services/supply-chain';
import { listSalesOrders, getSalesOrder } from '../../../services/sales-order';
import { generateCode, testGenerateCode, getCodeRulePageConfig } from '../../../../../services/codeRule';
import { isAutoGenerateEnabled, getPageRuleCode } from '../../../../../utils/codeRulePage';
import { useTranslation } from 'react-i18next';
import { buildFactoryImportTemplate } from '../../../../../utils/spreadsheetImportTemplate';
import { buildKuaizhizaoPullCreateMenuItems } from '../../../constants/documentActionRegistry';
import DocumentAttachmentsField from '../../../components/DocumentAttachmentsField';
import { mapAttachmentsToUploadList, normalizeDocumentAttachments } from '../../../utils/documentAttachments';

interface ShipmentNotice {
  id?: number;
  notice_code?: string;
  sales_order_id?: number;
  sales_order_code?: string;
  customer_id?: number;
  customer_name?: string;
  customer_contact?: string;
  customer_phone?: string;
  warehouse_id?: number;
  warehouse_name?: string;
  planned_ship_date?: string;
  shipping_address?: string;
  status?: string;
  notified_at?: string;
  sales_delivery_id?: number;
  sales_delivery_code?: string;
  total_quantity?: number;
  total_amount?: number;
  notes?: string;
  attachments?: Array<{ uid?: string; name?: string; url?: string }>;
  created_at?: string;
}

interface ShipmentNoticeDetail extends ShipmentNotice {
  items?: { id?: number; material_id?: number; material_code: string; material_name: string; material_unit: string; notice_quantity: number; unit_price?: number; total_amount?: number }[];
}

type PullSalesOrderCandidate = {
  id: number;
  order_code?: string;
  customer_name?: string;
  status?: string;
  delivery_date?: string;
  updated_at?: string;
  notice_id?: number;
  converted?: boolean;
};

const ShipmentNoticesPage: React.FC = () => {
  const { t, i18n } = useTranslation();

  const noticeItemImportTemplate = useMemo(
    () =>
      buildFactoryImportTemplate(
        t,
        [
          { field: 'material', labelKey: 'app.kuaizhizao.shipmentNotice.import.materialCode', aliases: ['物料编号'] },
          { field: 'quantity', labelKey: 'app.kuaizhizao.shipmentNotice.import.quantity', aliases: ['数量'] },
          { field: 'unitPrice', labelKey: 'app.kuaizhizao.shipmentNotice.import.unitPrice', aliases: ['单价'] },
          { field: 'name', labelKey: 'app.kuaizhizao.shipmentNotice.import.materialName', aliases: ['物料名称'] },
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
      待发货: { text: t('app.kuaizhizao.shipmentNotice.statusPending'), color: 'default' },
      已通知: { text: t('app.kuaizhizao.shipmentNotice.statusNotified'), color: 'processing' },
      已出库: { text: t('app.kuaizhizao.shipmentNotice.statusShipped'), color: 'success' },
    }),
    [t, i18n.language],
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
  const [trackingRefreshKey, setTrackingRefreshKey] = useState(0);

  const shipmentTracking = useDocumentTracking(
    detailDrawerVisible && noticeDetail?.id ? 'shipment_notice' : undefined,
    noticeDetail?.id,
    trackingRefreshKey,
  );

  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [pullFromSalesOrderVisible, setPullFromSalesOrderVisible] = useState(false);
  const [pullSalesOrderLoading, setPullSalesOrderLoading] = useState(false);
  const [pullSalesOrderSubmitting, setPullSalesOrderSubmitting] = useState(false);
  const [pullSalesOrderKeyword, setPullSalesOrderKeyword] = useState('');
  const [pullSalesOrderCandidates, setPullSalesOrderCandidates] = useState<PullSalesOrderCandidate[]>([]);
  const [selectedPullSalesOrderId, setSelectedPullSalesOrderId] = useState<number | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const createFormRef = useRef<any>(null);
  const editFormRef = useRef<any>(null);
  const [pendingEditFormValues, setPendingEditFormValues] = useState<Record<string, any> | null>(null);
  const [materialPickerOpen, setMaterialPickerOpen] = useState(false);
  const [customerList, setCustomerList] = useState<any[]>([]);
  const [salesOrderList, setSalesOrderList] = useState<any[]>([]);
  const [previewCode, setPreviewCode] = useState<string | null>(null);
  const [effectiveRuleCode, setEffectiveRuleCode] = useState<string | null>(null);
  const [importVisible, setImportVisible] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const [cust, ordersRes] = await Promise.all([
          customerApi.list({ limit: 1000, isActive: true }),
          listSalesOrders({ limit: 500 }).catch(() => ({ data: [], total: 0, success: false })),
        ]);
        setCustomerList(Array.isArray(cust) ? cust : (cust as any)?.data || (cust as any)?.items || []);
        setSalesOrderList(ordersRes?.data || []);
      } catch (e) {
        console.error(t('app.kuaizhizao.shipmentNotice.loadCustomersFailed'), e);
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
      // 如果当前只有一行且未选择物料，则替换该行
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
  const ShipmentNoticeFormSummary: React.FC = () => {
    const items = AntForm.useWatch('items');
    const totalQuantity = items?.reduce((sum: number, it: any) => sum + (Number(it?.notice_quantity) || 0), 0) || 0;
    const totalAmount = items?.reduce((sum: number, it: any) => sum + (Number(it?.notice_quantity) * Number(it?.unit_price || 0) || 0), 0) || 0;

    return (
      <div style={{ marginTop: 12, padding: '12px', background: '#fafafa', borderRadius: '4px', display: 'flex', justifyContent: 'flex-end', gap: 24 }}>
        <span>{t('app.kuaizhizao.shipmentNotice.totalQuantity')}: <Typography.Text strong>{totalQuantity}</Typography.Text></span>
        <span>{t('app.kuaizhizao.shipmentNotice.totalAmount')}: <Typography.Text strong>¥{totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Typography.Text></span>
      </div>
    );
  };

  const renderShipmentNoticeRowActions = (actions: React.ReactNode[]) => {
    return actions;
  };

  const columns: ProColumns<ShipmentNotice>[] = [
    {
      title: t('app.kuaizhizao.shipmentNotice.colCustomerNotice'),
      key: 'notice_code',
      dataIndex: 'notice_code',
      ...UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
      fixed: 'left',
      render: (_, record) => (
        <UniTableStackedPrimaryCell
          primary={String(record.customer_name ?? '')}
          secondary={String(record.notice_code ?? '')}
        />
      ),
    },
    { title: t('app.kuaizhizao.shipmentNotice.colNoticeCode'), dataIndex: 'notice_code', hideInTable: true },
    { title: t('app.kuaizhizao.quotation.form.customer'), dataIndex: 'customer_name', hideInTable: true },
    { title: t('app.kuaizhizao.shipmentNotice.salesOrderCode'), dataIndex: 'sales_order_code', width: 140, ellipsis: true },
    { title: t('app.kuaizhizao.shipmentNotice.outboundWarehouse'), dataIndex: 'warehouse_name', width: 120 },
    { title: t('app.kuaizhizao.shipmentNotice.plannedShipDate'), dataIndex: 'planned_ship_date', valueType: 'date', width: 120 },
    { title: t('app.kuaizhizao.shipmentNotice.notifiedAt'), dataIndex: 'notified_at', valueType: 'dateTime', width: 160 },
    { title: t('common.createdAt'), dataIndex: 'created_at', valueType: 'dateTime', width: 160 },
    {
      title: t('app.kuaizhizao.salesOrder.lifecycle'),
      dataIndex: LIST_LIFECYCLE_STAGE_FIELD,
      align: 'center',
      fixed: 'right',
      render: (_, record) => (
        <ListUniLifecycleCell lifecycle={getShipmentNoticeLifecycle(record as any, t)} />
      ),
    },
    {
      title: t('common.actions'),
      width: 200,
      fixed: 'right',
      render: (_, record) => renderShipmentNoticeRowActions([
        <Button {...rowActionKind('read')} key="detail" onClick={() => handleDetail(record)}>{t('common.detail')}</Button>,
        ...(record.status === '待发货'
          ? [
              <Button {...rowActionKind('update')} key="edit" onClick={() => handleEdit(record)}>{t('common.edit')}</Button>,
              <Button {...rowActionKind('dispatch')} key="notify" onClick={() => handleNotify(record as any)}>{t('app.kuaizhizao.shipmentNotice.notifyWarehouse')}</Button>,
              <Button {...rowActionKind('delete')} key="delete" onClick={() => handleDelete(record as any)}>{t('common.delete')}</Button>,
            ]
          : []),
        ...(record.status === '已通知'
          ? [
              <Button {...rowActionKind('revoke')} key="withdraw" onClick={() => handleWithdraw(record as any)}>{t('app.kuaizhizao.shipmentNotice.withdrawNotify')}</Button>,
            ]
          : []),
      ]),
    },
  ];

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

  const handleNotify = (record: ShipmentNotice) => {
    Modal.confirm({
      title: t('app.kuaizhizao.shipmentNotice.notifyWarehouse'),
      content: t('app.kuaizhizao.shipmentNotice.notifyConfirmContent', { code: record.notice_code }),
      onOk: async () => {
        try {
          await shipmentNoticeApi.notify(record.id!.toString());
          messageApi.success(t('app.kuaizhizao.shipmentNotice.notifySuccess'));
          invalidateMenuBadgeCounts();

          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || t('app.kuaizhizao.shipmentNotice.notifyFailed'));
        }
      },
    });
  };

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

  const handleBatchNotify = async (keys: React.Key[]) => {
    if (!keys || keys.length === 0) {
      messageApi.warning(t('app.kuaizhizao.shipmentNotice.selectNoticeFirst'));
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
        await shipmentNoticeApi.notify(String(id));
        success += 1;
      } catch {
        failed += 1;
      }
    }
    if (success > 0) messageApi.success(t('app.kuaizhizao.shipmentNotice.batchNotifySuccess', { count: success }));
    if (failed > 0) messageApi.warning(t('app.kuaizhizao.shipmentNotice.batchNotifyPartial', { count: failed }));
    setSelectedRowKeys([]);
    invalidateMenuBadgeCounts();
    actionRef.current?.reload();
  };

  const handleBatchWithdraw = async (keys: React.Key[]) => {
    if (!keys || keys.length === 0) {
      messageApi.warning(t('app.kuaizhizao.shipmentNotice.selectNoticeFirst'));
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
        await shipmentNoticeApi.withdraw(String(id));
        success += 1;
      } catch {
        failed += 1;
      }
    }
    if (success > 0) messageApi.success(t('app.kuaizhizao.shipmentNotice.batchWithdrawSuccess', { count: success }));
    if (failed > 0) messageApi.warning(t('app.kuaizhizao.shipmentNotice.batchWithdrawPartial', { count: failed }));
    setSelectedRowKeys([]);
    invalidateMenuBadgeCounts();
    actionRef.current?.reload();
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

  const loadPullSalesOrderCandidates = useCallback(async (keyword: string = '') => {
    setPullSalesOrderLoading(true);
    try {
      const kw = keyword.trim();
      const [ordersRes, noticeRes] = await Promise.all([
        listSalesOrders({ limit: 200, skip: 0, keyword: kw || undefined }).catch(() => ({ data: [] })),
        shipmentNoticeApi.list({ skip: 0, limit: 5000 }),
      ]);
      const orders = ordersRes?.data || [];
      const notices = Array.isArray(noticeRes) ? noticeRes : (noticeRes as any)?.data ?? (noticeRes as any)?.items ?? [];
      const noticeByOrderId = new Map<number, any>();
      notices.forEach((n: any) => {
        if (n?.sales_order_id != null && !noticeByOrderId.has(Number(n.sales_order_id))) {
          noticeByOrderId.set(Number(n.sales_order_id), n);
        }
      });
      const candidates: PullSalesOrderCandidate[] = (orders as any[]).map((o: any) => {
        const linked = noticeByOrderId.get(Number(o.id));
        return {
          id: Number(o.id),
          order_code: o.order_code ?? o.sales_order_code,
          customer_name: o.customer_name ?? o.customerName,
          status: o.status,
          delivery_date: o.delivery_date,
          updated_at: o.updated_at,
          notice_id: linked?.id,
          converted: !!linked,
        };
      });
      setPullSalesOrderCandidates(candidates);
    } finally {
      setPullSalesOrderLoading(false);
    }
  }, []);

  const handlePullFromSalesOrder = useCallback(async () => {
    setPullFromSalesOrderVisible(true);
    setPullSalesOrderKeyword('');
    setSelectedPullSalesOrderId(null);
    await loadPullSalesOrderCandidates('');
  }, [loadPullSalesOrderCandidates]);

  const handlePullFromSalesOrderConfirm = useCallback(async () => {
    if (!selectedPullSalesOrderId) {
      messageApi.warning(t('app.kuaizhizao.shipmentNotice.selectSource', { source: salesOrderEntityName }));
      return;
    }
    const selected = pullSalesOrderCandidates.find((i) => i.id === selectedPullSalesOrderId);
    if (selected?.converted) {
      messageApi.warning(t('app.kuaizhizao.shipmentNotice.sourceAlreadyConverted', {
        source: salesOrderEntityName,
        target: shipmentNoticeEntityName,
      }));
      return;
    }
    setPullSalesOrderSubmitting(true);
    try {
      const detail: any = await getSalesOrder(selectedPullSalesOrderId, true);
      const custId = detail.customer_id ?? detail.customerId;
      const cust = customerList.find((c: any) => (c.id ?? c.customer_id) === custId);
      const validItems = (detail.items || [])
        .filter((it: any) => (Number(it.required_quantity ?? it.quantity ?? it.order_quantity) || 0) > 0)
        .map((it: any, index: number) => ({
          material_id: it.material_id ?? it.materialId,
          material_code: it.material_code || it.materialCode || '',
          material_name: it.material_name || it.materialName || '',
          material_spec: it.material_spec || '',
          material_unit: it.material_unit || it.materialUnit || defaultUnit,
          notice_quantity: Number(it.required_quantity ?? it.quantity ?? it.order_quantity) || 0,
          unit_price: Number((it.unit_price ?? it.unitPrice) || detail.items?.[index]?.unit_price || 0),
        }));
      if (!custId || validItems.length === 0) {
        throw new Error(t('app.kuaizhizao.shipmentNotice.sourceMissingData', {
          source: salesOrderEntityName,
          target: shipmentNoticeEntityName,
        }));
      }
      await shipmentNoticeApi.create({
        sales_order_id: detail.id ?? selectedPullSalesOrderId,
        sales_order_code: detail.order_code ?? selected?.order_code,
        customer_id: custId,
        customer_name: cust?.name || cust?.customer_name || detail.customer_name || detail.customerName || '',
        customer_contact: detail.customer_contact || cust?.contactPerson || (cust as any)?.contact,
        customer_phone: detail.customer_phone || cust?.phone,
        shipping_address: detail.shipping_address || cust?.address,
        planned_ship_date: detail.delivery_date,
        items: validItems,
      });
      messageApi.success(t('app.kuaizhizao.shipmentNotice.createFromSourceSuccess', {
        source: salesOrderEntityName,
        target: shipmentNoticeEntityName,
      }));
      setPullFromSalesOrderVisible(false);
      setSelectedPullSalesOrderId(null);
      invalidateMenuBadgeCounts();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error?.message || t('app.kuaizhizao.shipmentNotice.createFromSourceFailed', {
        source: salesOrderEntityName,
        target: shipmentNoticeEntityName,
      }));
    } finally {
      setPullSalesOrderSubmitting(false);
    }
  }, [
    actionRef,
    customerList,
    defaultUnit,
    invalidateMenuBadgeCounts,
    messageApi,
    pullSalesOrderCandidates,
    salesOrderEntityName,
    selectedPullSalesOrderId,
    shipmentNoticeEntityName,
    t,
  ]);

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
        planned_ship_date: values.planned_ship_date ? dayjs(values.planned_ship_date).format('YYYY-MM-DD') : undefined,
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
        planned_ship_date: values.planned_ship_date ? dayjs(values.planned_ship_date).format('YYYY-MM-DD') : undefined,
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
          <ProFormDatePicker name="planned_ship_date" label={t('app.kuaizhizao.shipmentNotice.plannedShipDate')} fieldProps={{ style: { width: '100%' } }} />
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
              type="dashed"
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
              {t('app.kuaizhizao.common.materialBatchSelect')}
            </Button>
          </Space>
        )}
        columns={[
                {
                  title: t('app.kuaizhizao.salesOrder.material'),
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
          <ProFormDatePicker name="planned_ship_date" label={t('app.kuaizhizao.shipmentNotice.plannedShipDate')} fieldProps={{ style: { width: '100%' } }} />
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
                  { title: t('app.kuaizhizao.salesOrder.quantity'), dataIndex: 'notice_quantity', width: 90, align: 'right' },
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
          showAdvancedSearch={true}
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
              menuItems={buildKuaizhizaoPullCreateMenuItems([
                {
                  key: 'pull-from-sales-order',
                  actionKey: 'shipment_notice.pull_from_sales_order',
                  onClick: () => {
                    void handlePullFromSalesOrder();
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
            <UniBatchMenuButton
              key="shipment-notice-batch-menu"
              selectedRowKeys={selectedRowKeys}
              menuItems={[
                {
                  key: 'notify',
                  label: t('app.kuaizhizao.shipmentNotice.batchNotifyWarehouse'),
                  icon: <SendOutlined />,
                  onClick: handleBatchNotify,
                },
                {
                  key: 'withdraw',
                  label: t('app.kuaizhizao.shipmentNotice.batchWithdrawNotify'),
                  icon: <AppstoreAddOutlined />,
                  onClick: handleBatchWithdraw,
                },
              ]}
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
              const rawData = Array.isArray(response) ? response : response?.items || response?.data || [];
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
          request={async (params) => {
            try {
              const response = await shipmentNoticeApi.list({
                skip: ((params.current || 1) - 1) * (params.pageSize || 20),
                limit: params.pageSize || 20,
                status: params.status,
                customer_id: params.customer_id,
                sales_order_id: params.sales_order_id,
              });
              const data = Array.isArray(response) ? response : response?.items || response?.data || [];
              const total = Array.isArray(response) ? response.length : response?.total ?? data.length;
              return { data, success: true, total };
            } catch {
              messageApi.error(t('app.kuaizhizao.shipmentNotice.listFailed'));
              return { data: [], success: false, total: 0 };
            }
          }}
          scroll={{ x: 1200 }}
        />
      </ListPageTemplate>

      <Modal
        title={t('app.kuaizhizao.shipmentNotice.pullFromSalesOrder')}
        open={pullFromSalesOrderVisible}
        width={MODAL_CONFIG.LARGE_WIDTH}
        onCancel={() => {
          if (pullSalesOrderSubmitting) return;
          setPullFromSalesOrderVisible(false);
          setSelectedPullSalesOrderId(null);
        }}
        onOk={() => {
          void handlePullFromSalesOrderConfirm();
        }}
        okText={t('app.kuaizhizao.shipmentNotice.createTarget', { target: shipmentNoticeEntityName })}
        confirmLoading={pullSalesOrderSubmitting}
        destroyOnHidden
      >
        <Space orientation="vertical" size={12} style={{ width: '100%' }}>
          <Input.Search
            allowClear
            placeholder={t('app.kuaizhizao.shipmentNotice.pullSearchPlaceholder')}
            value={pullSalesOrderKeyword}
            onChange={(e) => setPullSalesOrderKeyword(e.target.value)}
            onSearch={(value) => {
              setPullSalesOrderKeyword(value);
              void loadPullSalesOrderCandidates(value);
            }}
            enterButton={t('components.uniQuery.search')}
          />
          <Table<PullSalesOrderCandidate>
            rowKey="id"
            loading={pullSalesOrderLoading}
            dataSource={pullSalesOrderCandidates}
            pagination={false}
            scroll={{ x: 1080, y: 360 }}
            rowSelection={{
              type: 'radio',
              selectedRowKeys: selectedPullSalesOrderId ? [selectedPullSalesOrderId] : [],
              onChange: (keys) => {
                const next = Number(keys?.[0]);
                if (Number.isFinite(next)) setSelectedPullSalesOrderId(next);
                else setSelectedPullSalesOrderId(null);
              },
              getCheckboxProps: (record) => ({ disabled: !!record.converted }),
            }}
            onRow={(record) => ({
              onClick: () => {
                if (record.converted) return;
                setSelectedPullSalesOrderId(record.id);
              },
            })}
            columns={[
              { title: t('app.kuaizhizao.shipmentNotice.salesOrderCode'), dataIndex: 'order_code', width: 190, ellipsis: true },
              { title: t('app.kuaizhizao.quotation.form.customer'), dataIndex: 'customer_name', width: 220, ellipsis: true },
              { title: t('app.kuaizhizao.shipmentNotice.orderStatus'), dataIndex: 'status', width: 130, align: 'center' },
              { title: t('app.kuaizhizao.salesOrder.deliveryDate'), dataIndex: 'delivery_date', width: 130, render: (v) => (v ? dayjs(v).format('YYYY-MM-DD') : '-') },
              { title: t('common.updatedAt'), dataIndex: 'updated_at', width: 180, render: (v) => (v ? dayjs(v).format('YYYY-MM-DD HH:mm:ss') : '-') },
              {
                title: t('app.kuaizhizao.shipmentNotice.convertStatus'),
                key: 'convert_status',
                width: 150,
                align: 'center',
                render: (_, r) => (r.converted ? <Tag color="gold">{t('app.kuaizhizao.shipmentNotice.alreadyCreated', { target: shipmentNoticeEntityName })}</Tag> : <Tag color="success">{t('app.kuaizhizao.shipmentNotice.canCreate')}</Tag>),
              },
            ]}
          />
        </Space>
      </Modal>

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
                      content = dayjs(value as string).format('YYYY-MM-DD HH:mm:ss');
                    } else if (col.valueType === 'date' && value) {
                      content = dayjs(value as string).format('YYYY-MM-DD');
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
                      <UniLifecycleStepper
                        steps={mainStages}
                        showLabels
                        status={lc.status}
                        nextStepSuggestions={lc.nextStepSuggestions}
                        hideNextStepSuggestions
                      />
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
                      { title: t('app.kuaizhizao.salesOrder.quantity'), dataIndex: 'notice_quantity', width: 90, align: 'right' },
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
    </>
  );
};

export default ShipmentNoticesPage;
