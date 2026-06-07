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
import { UniLifecycle, UniLifecycleStepper } from '../../../../../components/uni-lifecycle';
import { DocumentTrackingTimelineBody, useDocumentTracking } from '../../../../../components/document-tracking-panel';
import { WarehouseTraceBriefPrimaryActions } from '../../warehouse-management/WarehouseTraceBriefFooter';
import { customerApi } from '../../../../master-data/services/supply-chain';
import { listSalesOrders, getSalesOrder } from '../../../services/sales-order';
import { generateCode, testGenerateCode, getCodeRulePageConfig } from '../../../../../services/codeRule';
import { isAutoGenerateEnabled, getPageRuleCode } from '../../../../../utils/codeRulePage';
import { renderRowActionsOverflow } from '../../../../../utils/renderRowActionsOverflow';
import { useTranslation } from 'react-i18next';
import { buildFactoryImportTemplate } from '../../../../../utils/spreadsheetImportTemplate';
import { buildKuaizhizaoPullCreateMenuItems, getKuaizhizaoDocumentAction } from '../../../constants/documentActionRegistry';

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

const STATUS_MAP: Record<string, { text: string; color: string }> = {
  待发货: { text: '待发货', color: 'default' },
  已通知: { text: '已通知', color: 'processing' },
  已出库: { text: '已出库', color: 'success' },
};

const defaultNoticeItem = { material_id: undefined, material_code: '', material_name: '', material_spec: '', material_unit: '件', notice_quantity: 1, unit_price: 0 };

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
  const { message: messageApi } = App.useApp();
  const pullFromSalesOrderAction = getKuaizhizaoDocumentAction('shipment_notice.pull_from_sales_order');
  const actionRef = useRef<ActionType>(null);
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
  const formRef = useRef<any>(null);
  const [materialPickerOpen, setMaterialPickerOpen] = useState(false);
  const [customerList, setCustomerList] = useState<any[]>([]);
  const [salesOrderList, setSalesOrderList] = useState<any[]>([]);
  const [previewCode, setPreviewCode] = useState<string | null>(null);
  const [effectiveRuleCode, setEffectiveRuleCode] = useState<string | null>(null);
  const [importVisible, setImportVisible] = useState(false);

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
        console.error('加载客户/销售订单失败', e);
      }
    };
    load();
  }, []);

  const appendShipmentNoticeItemsFromMaterials = useCallback(
    (selected: Material[]) => {
      const current = formRef.current?.getFieldValue('items') ?? [];
      const newRows = selected.map((m) => ({
        material_id: m.id,
        material_code: m.mainCode ?? m.code ?? '',
        material_name: m.name ?? '',
        material_spec: m.specification ?? '',
        material_unit: m.baseUnit ?? '件',
        notice_quantity: 1,
        unit_price: (m as any).defaults?.defaultSalePrice ?? (m as any).defaults?.default_sale_price ?? 0,
      }));
      // 如果当前只有一行且未选择物料，则替换该行
      if (current.length === 1 && !current[0].material_id && !current[0].material_code) {
        formRef.current?.setFieldsValue({ items: newRows });
      } else {
        formRef.current?.setFieldsValue({ items: [...current, ...newRows] });
      }
      messageApi.success(t('app.kuaizhizao.common.materialBatchAdded', { count: selected.length }));
    },
    [messageApi, t]
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
        <span>{t('app.kuaizhizao.shipmentNotice.totalQuantity') || '总通知数量'}: <Typography.Text strong>{totalQuantity}</Typography.Text></span>
        <span>{t('app.kuaizhizao.shipmentNotice.totalAmount') || '总预计金额'}: <Typography.Text strong>¥{totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Typography.Text></span>
      </div>
    );
  };

  const renderShipmentNoticeRowActions = (actions: React.ReactNode[]) => {
    return renderRowActionsOverflow(actions, 'shipment-notice');
  };

  const columns: ProColumns<ShipmentNotice>[] = [
    {
      title: '客户 / 通知单号',
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
    { title: '通知单号', dataIndex: 'notice_code', hideInTable: true },
    { title: '客户', dataIndex: 'customer_name', hideInTable: true },
    { title: '销售订单号', dataIndex: 'sales_order_code', width: 140, ellipsis: true },
    { title: '出库仓库', dataIndex: 'warehouse_name', width: 120 },
    { title: '计划发货日期', dataIndex: 'planned_ship_date', valueType: 'date', width: 120 },
    { title: '通知时间', dataIndex: 'notified_at', valueType: 'dateTime', width: 160 },
    { title: '创建时间', dataIndex: 'created_at', valueType: 'dateTime', width: 160 },
    {
      title: '生命周期',
      dataIndex: 'lifecycle_stage',
      align: 'center',
      fixed: 'right',
      render: (_, record) => (
        <UniLifecycle
          {...getShipmentNoticeLifecycle(record as any)}
          showLabel
          showCircleTooltip={false}
          size="small"
        />
      ),
    },
    {
      title: '操作',
      width: 200,
      fixed: 'right',
      render: (_, record) => renderShipmentNoticeRowActions([
        <Button key="detail" type="link" size="small" icon={<EyeOutlined />} onClick={() => handleDetail(record)}>详情</Button>,
        ...(record.status === '待发货'
          ? [
              <Button key="edit" type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>编辑</Button>,
              <Button key="notify" type="link" size="small" icon={<SendOutlined />} onClick={() => handleNotify(record as any)}>通知仓库</Button>,
              <Button key="delete" type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record as any)}>删除</Button>,
            ]
          : []),
        ...(record.status === '已通知'
          ? [
              <Button key="withdraw" type="link" size="small" onClick={() => handleWithdraw(record as any)}>撤回通知</Button>,
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
      messageApi.error('获取发货通知单详情失败');
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
      formRef.current?.setFieldsValue({
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
        items: itemsForm.length ? itemsForm : [defaultNoticeItem],
      });
      setEditingId(record.id!);
      setEditModalVisible(true);
    } catch {
      messageApi.error('获取详情失败');
    }
  };

  const handleNotify = (record: ShipmentNotice) => {
    Modal.confirm({
      title: '通知仓库',
      content: `确定要通知仓库发货 "${record.notice_code}" 吗？`,
      onOk: async () => {
        try {
          await shipmentNoticeApi.notify(record.id!.toString());
          messageApi.success('已通知仓库');
          invalidateMenuBadgeCounts();

          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '通知失败');
        }
      },
    });
  };

  const handleWithdraw = (record: ShipmentNotice) => {
    Modal.confirm({
      title: '撤回通知',
      content: `确定将 "${record.notice_code}" 撤回到待发货吗？`,
      onOk: async () => {
        try {
          await shipmentNoticeApi.withdraw(record.id!.toString());
          messageApi.success('已撤回到待发货');
          invalidateMenuBadgeCounts();

          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '撤回失败');
        }
      },
    });
  };

  const handleDelete = (record: ShipmentNotice) => {
    Modal.confirm({
      title: '删除发货通知单',
      content: `确定要删除 "${record.notice_code}" 吗？`,
      onOk: async () => {
        try {
          await shipmentNoticeApi.delete(record.id!.toString());
          messageApi.success('删除成功');
          invalidateMenuBadgeCounts();

          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '删除失败');
        }
      },
    });
  };

  const handleBatchDelete = async (keys: React.Key[]) => {
    if (keys.length === 0) return;
    Modal.confirm({
      title: '批量删除',
      content: `确定要删除选中的 ${keys.length} 条发货通知单吗？`,
      onOk: async () => {
        try {
          for (const k of keys) {
            await shipmentNoticeApi.delete(String(k));
          }
          messageApi.success(`已删除 ${keys.length} 条发货通知单`);
          invalidateMenuBadgeCounts();

          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error?.message || '批量删除失败');
        }
      },
    });
  };

  const handleCreate = async () => {
    setPreviewCode(null);
    setEffectiveRuleCode(null);
    setEditingId(null);
    setCreateModalVisible(true);
    setTimeout(() => {
      formRef.current?.setFieldsValue({ items: [defaultNoticeItem] });
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
            formRef.current?.setFieldsValue({ notice_code: preview ?? '', items: [defaultNoticeItem] });
          }, 100);
        })
        .catch((e) => {
          console.warn('发货通知单编号预生成失败:', e);
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
      messageApi.warning(`请选择${pullFromSalesOrderAction.sourceLabel}`);
      return;
    }
    const selected = pullSalesOrderCandidates.find((i) => i.id === selectedPullSalesOrderId);
    if (selected?.converted) {
      messageApi.warning(`该${pullFromSalesOrderAction.sourceLabel}已创建${pullFromSalesOrderAction.targetLabel}，请勿重复创建`);
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
          material_unit: it.material_unit || it.materialUnit || '件',
          notice_quantity: Number(it.required_quantity ?? it.quantity ?? it.order_quantity) || 0,
          unit_price: Number((it.unit_price ?? it.unitPrice) || detail.items?.[index]?.unit_price || 0),
        }));
      if (!custId || validItems.length === 0) {
        throw new Error(`该${pullFromSalesOrderAction.sourceLabel}缺少客户或有效明细，无法创建${pullFromSalesOrderAction.targetLabel}`);
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
      messageApi.success(`已从${pullFromSalesOrderAction.sourceLabel}创建${pullFromSalesOrderAction.targetLabel}`);
      setPullFromSalesOrderVisible(false);
      setSelectedPullSalesOrderId(null);
      invalidateMenuBadgeCounts();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error?.message || `从${pullFromSalesOrderAction.sourceLabel}创建${pullFromSalesOrderAction.targetLabel}失败`);
    } finally {
      setPullSalesOrderSubmitting(false);
    }
  }, [actionRef, customerList, invalidateMenuBadgeCounts, messageApi, pullSalesOrderCandidates, selectedPullSalesOrderId]);

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
    formRef.current?.setFieldsValue({
      sales_order_code: code,
      customer_id: custId,
      customer_name: custName,
      customer_contact: order.customer_contact || cust?.contactPerson || (cust as any)?.contact,
      customer_phone: order.customer_phone || cust?.phone,
      shipping_address: order.shipping_address || cust?.address,
    });
    if (order.items && order.items.length > 0) {
      const items = order.items.map((it: any, index: number) => ({
        material_id: it.material_id ?? it.materialId,
        material_code: it.material_code || it.materialCode || '',
        material_name: it.material_name || it.materialName || '',
        material_spec: it.material_spec || '',
        material_unit: it.material_unit || it.materialUnit || '件',
        notice_quantity: Number(it.required_quantity ?? it.quantity ?? it.order_quantity) || 0,
        unit_price: Number((it.unit_price ?? it.unitPrice) || (order.items && order.items[index]?.unit_price)) || 0,
      }));
      formRef.current?.setFieldsValue({ items });
    }
  };

  const handleCreateSubmit = async (values: any) => {
    const validItems = (values.items ?? []).filter((it: any) => it.material_id && (Number(it.notice_quantity) || 0) > 0);
    if (!validItems.length) {
      messageApi.error('请至少添加一条有效明细');
      throw new Error('请至少添加一条有效明细');
    }
    if (!values.sales_order_id || !values.sales_order_code) {
      messageApi.error('请选择销售订单');
      throw new Error('请选择销售订单');
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
        console.warn('发货通知单编号正式生成失败，使用当前值:', e);
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
        items: validItems.map((it: any) => ({
          material_id: it.material_id,
          material_code: it.material_code,
          material_name: it.material_name,
          material_spec: it.material_spec,
          material_unit: it.material_unit || '件',
          notice_quantity: Number(it.notice_quantity) || 0,
          unit_price: Number(it.unit_price) || 0,
        })),
      });
      messageApi.success('创建成功');
      setCreateModalVisible(false);
      setEffectiveRuleCode(null);
      invalidateMenuBadgeCounts();

      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '创建失败');
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
      });
      messageApi.success('更新成功');
      setEditModalVisible(false);
      invalidateMenuBadgeCounts();

      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '更新失败');
      throw error;
    }
  };

  const detailColumns: ProDescriptionsItemProps<ShipmentNoticeDetail>[] = [
    { title: '通知单号', dataIndex: 'notice_code' },
    { title: '销售订单号', dataIndex: 'sales_order_code' },
    { title: '客户', dataIndex: 'customer_name' },
    { title: '联系人', dataIndex: 'customer_contact' },
    { title: '电话', dataIndex: 'customer_phone' },
    { title: '出库仓库', dataIndex: 'warehouse_name' },
    { title: '计划发货日期', dataIndex: 'planned_ship_date', valueType: 'date' },
    { title: '收货地址', dataIndex: 'shipping_address', span: 2 },
    {
      title: '状态',
      dataIndex: 'status',
      render: (s) => {
        const c = STATUS_MAP[(s as string) || ''] || { text: (s as string) || '-', color: 'default' };
        return <Tag color={c.color}>{c.text}</Tag>;
      },
    },
    { title: '通知时间', dataIndex: 'notified_at', valueType: 'dateTime' },
    { title: '备注', dataIndex: 'notes', span: 2 },
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
      material_unit: String(row[5] || '件'),
    }));

    if (items.length === 0) {
      messageApi.warning('未发现有效数据');
      return;
    }

    const currentItems = formRef.current?.getFieldValue('items') || [];
    const filteredCurrent = currentItems.filter((it: any) => it.material_id || it.material_code);
    formRef.current?.setFieldsValue({
      items: [...filteredCurrent, ...items],
    });
    messageApi.success(`成功导入 ${items.length} 条数据`);
  };

  const handleFormLineImport = (data: any[][]) => {
    applyExcelRowsToNoticeForm(data);
  };

  /** 列表工具栏导入：打开新建弹窗并写入明细（与 UniTable 内置导入弹窗配合） */
  const handleListToolbarImport = (data: any[][]) => {
    if (editModalVisible) {
      messageApi.warning('请先关闭编辑窗口，或在「新建发货通知单」弹窗内使用「导入明细」');
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
            label="通知单号"
            placeholder={isAutoGenerateEnabled('kuaizhizao-shipment-notice') ? '编号将根据编号规则自动生成，可修改' : '请输入通知单号'}
            rules={[{ required: true, message: '请输入通知单号' }]}
          />
        </Col>
        <Col span={8}>
          <ProForm.Item name="sales_order_id" label="销售订单" rules={[{ required: true, message: '请选择销售订单' }]}>
            <Select
              placeholder="请选择销售订单"
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
          <ProForm.Item name="customer_id" label="客户" rules={[{ required: true, message: '请选择客户' }]}>
            <Select
              placeholder="请选择客户"
              showSearch
              optionFilterProp="label"
              options={customerList.map((c: any) => ({ value: c.id ?? c.customer_id, label: c.name || c.customer_name || c.code }))}
              onChange={(v) => {
                const cust = customerList.find((x: any) => (x.id ?? x.customer_id) === v);
                if (cust) formRef.current?.setFieldsValue({
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
          <ProFormText name="customer_contact" label="联系人" placeholder="联系人" />
        </Col>
        <Col span={8}>
          <ProFormText name="customer_phone" label="电话" placeholder="电话" />
        </Col>
        <Col span={8}>
          <UniWarehouseSelect
            name="warehouse_id"
            label="出库仓库"
            placeholder="请选择出库仓库"
            onChange={(_, wh) => formRef.current?.setFieldsValue({ warehouse_name: wh?.name ?? '' })}
          />
        </Col>
      </Row>
      <ProFormText name="warehouse_name" hidden />
      <Row gutter={16}>
        <Col span={8}>
          <ProFormDatePicker name="planned_ship_date" label="计划发货日期" fieldProps={{ style: { width: '100%' } }} />
        </Col>
      </Row>
      <ProFormTextArea name="shipping_address" label="收货地址" placeholder="收货地址" fieldProps={{ rows: 2 }} />
      <UniTableDetail
        name="items"
        title="通知明细"
        required
        requiredMessage="请至少添加一条通知明细"
        headerExtra={(
          <Space size={8}>
            <Button
              type="default"
              icon={<ImportOutlined />}
              onClick={() => setImportVisible(true)}
            >
              导入明细
            </Button>
            <Button
              type="dashed"
              icon={<PlusOutlined />}
              onClick={() => {
                const items = [...(formRef.current?.getFieldValue('items') ?? [])];
                items.push({ ...defaultNoticeItem });
                formRef.current?.setFieldsValue({ items });
              }}
            >
              添加明细
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
                  title: '物料',
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
                              placeholder="请选择物料"
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
                  title: '规格',
                  dataIndex: 'material_spec',
                  width: 120,
                  render: (_: any, __: any, index: number) => (
                    <AntForm.Item name={[index, 'material_spec']} style={{ margin: 0 }}>
                      <Input placeholder="规格" size="small" />
                    </AntForm.Item>
                  ),
                },
                {
                  title: '单位',
                  dataIndex: 'material_unit',
                  width: 80,
                  render: (_: any, __: any, index: number) => (
                    <AntForm.Item name={[index, 'material_unit']} style={{ margin: 0 }}>
                      <Input placeholder="单位" size="small" />
                    </AntForm.Item>
                  ),
                },
                {
                  title: '数量',
                  dataIndex: 'notice_quantity',
                  width: 100,
                  align: 'right' as const,
                  render: (_: any, __: any, index: number) => (
                    <AntForm.Item name={[index, 'notice_quantity']} rules={[{ required: true, message: '必填' }, { type: 'number', min: 0.01, message: '>0' }]} style={{ margin: 0 }}>
                      <InputNumber placeholder="数量" min={0} precision={2} style={{ width: '100%' }} size="small" />
                    </AntForm.Item>
                  ),
                },
                {
                  title: '单价',
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
      <ProFormTextArea name="notes" label="备注" placeholder="备注" fieldProps={{ rows: 2 }} colProps={{ span: 24 }} />
    </>
  );

  const renderEditForm = () => (
    <>
      <Row gutter={16}>
        <Col span={8}>
          <ProFormText name="sales_order_code" label="销售订单号" disabled />
        </Col>
        <Col span={8}>
          <ProForm.Item name="customer_id" label="客户" rules={[{ required: true, message: '请选择客户' }]}>
            <Select
              placeholder="请选择客户"
              showSearch
              optionFilterProp="label"
              options={customerList.map((c: any) => ({ value: c.id ?? c.customer_id, label: c.name || c.customer_name || c.code }))}
              onChange={(v) => {
                const cust = customerList.find((x: any) => (x.id ?? x.customer_id) === v);
                if (cust) formRef.current?.setFieldsValue({
                  customer_name: cust.name || cust.customer_name,
                  customer_contact: cust.contactPerson ?? (cust as any)?.contact,
                  customer_phone: cust.phone,
                });
              }}
            />
          </ProForm.Item>
        </Col>
        <Col span={8}>
          <ProFormText name="customer_contact" label="联系人" placeholder="联系人" />
        </Col>
      </Row>
      <Row gutter={16}>
        <Col span={8}>
          <ProFormText name="customer_phone" label="电话" placeholder="电话" />
        </Col>
        <Col span={8}>
          <UniWarehouseSelect
            name="warehouse_id"
            label="出库仓库"
            placeholder="请选择出库仓库"
            onChange={(_, wh) => formRef.current?.setFieldsValue({ warehouse_name: wh?.name ?? '' })}
          />
        </Col>
        <Col span={8}>
          <ProFormDatePicker name="planned_ship_date" label="计划发货日期" fieldProps={{ style: { width: '100%' } }} />
        </Col>
      </Row>
      <ProFormText name="warehouse_name" hidden />
      <ProFormText name="customer_name" hidden />
      <ProFormTextArea name="shipping_address" label="收货地址" placeholder="收货地址" fieldProps={{ rows: 2 }} />
      <ProFormItem label="通知明细">
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
                  { title: '物料编号', dataIndex: 'material_code', width: 120 },
                  { title: '物料名称', dataIndex: 'material_name', width: 150 },
                  { title: '单位', dataIndex: 'material_unit', width: 60 },
                  { title: '数量', dataIndex: 'notice_quantity', width: 90, align: 'right' },
                  { title: '单价', dataIndex: 'unit_price', width: 90, align: 'right' },
                ]}
              />
            );
          }}
        </AntForm.Item>
        <ShipmentNoticeFormSummary />
      </ProFormItem>
      <ProFormTextArea name="notes" label="备注" placeholder="备注" fieldProps={{ rows: 2 }} colProps={{ span: 24 }} />
    </>
  );

  return (
    <>
      <ListPageTemplate>
        <UniTable
          columnPersistenceId="apps.kuaizhizao.pages.sales-management.shipment-notices"
          headerTitle="发货通知单"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          showAdvancedSearch={true}
          showCreateButton={false}
          createButtonText="新建发货通知单"
          onCreate={handleCreate}
          toolBarRender={() => [
            <UniPullCreateToolbar
              compactKey="create-shipment-notice-with-pull"
              createIcon={<PlusOutlined />}
              createLabel="新建发货通知单"
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
          showDeleteButton
          onDelete={handleBatchDelete}
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
                messageApi.warning('暂无数据可导出');
                return;
              }
              const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `shipment-notices-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              URL.revokeObjectURL(url);
              messageApi.success(`已导出 ${items.length} 条记录`);
            } catch (error: any) {
              messageApi.error(error?.message || '导出失败');
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
              messageApi.error('获取列表失败');
              return { data: [], success: false, total: 0 };
            }
          }}
          scroll={{ x: 1200 }}
        />
      </ListPageTemplate>

      <Modal
        title={pullFromSalesOrderAction.label}
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
        okText={`创建${pullFromSalesOrderAction.targetLabel}`}
        confirmLoading={pullSalesOrderSubmitting}
        destroyOnHidden
      >
        <Space orientation="vertical" size={12} style={{ width: '100%' }}>
          <Input.Search
            allowClear
            placeholder="按销售订单号/客户搜索"
            value={pullSalesOrderKeyword}
            onChange={(e) => setPullSalesOrderKeyword(e.target.value)}
            onSearch={(value) => {
              setPullSalesOrderKeyword(value);
              void loadPullSalesOrderCandidates(value);
            }}
            enterButton="搜索"
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
              { title: '销售订单号', dataIndex: 'order_code', width: 190, ellipsis: true },
              { title: '客户', dataIndex: 'customer_name', width: 220, ellipsis: true },
              { title: '订单状态', dataIndex: 'status', width: 130, align: 'center' },
              { title: '交期', dataIndex: 'delivery_date', width: 130, render: (v) => (v ? dayjs(v).format('YYYY-MM-DD') : '-') },
              { title: '更新时间', dataIndex: 'updated_at', width: 180, render: (v) => (v ? dayjs(v).format('YYYY-MM-DD HH:mm:ss') : '-') },
              {
                title: '转单状态',
                key: 'convert_status',
                width: 150,
                align: 'center',
                render: (_, r) => (r.converted ? <Tag color="gold">{`已创建${pullFromSalesOrderAction.targetLabel}`}</Tag> : <Tag color="success">可创建</Tag>),
              },
            ]}
          />
        </Space>
      </Modal>

      <DetailDrawerTemplate
        title={`发货通知单详情${noticeDetail?.notice_code ? ` - ${noticeDetail.notice_code}` : ''}`}
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
              <DetailDrawerSection title="基本信息">
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

              <DetailDrawerSection title="生命周期">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {(() => {
                    const lc = getShipmentNoticeLifecycle(noticeDetail as Record<string, unknown>);
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
                <DetailDrawerSection title="出货检验 (OQC)">
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

              <DetailDrawerSection title="明细信息">
                {noticeDetail.items && noticeDetail.items.length > 0 ? (
                  <Table
                    size="small"
                    rowKey={(record: any) => record.id || record.material_code}
                    columns={[
                      { title: '物料编号', dataIndex: 'material_code', width: 120 },
                      { title: '物料名称', dataIndex: 'material_name', width: 150 },
                      { title: '单位', dataIndex: 'material_unit', width: 60 },
                      { title: '数量', dataIndex: 'notice_quantity', width: 90, align: 'right' },
                      { title: '单价', dataIndex: 'unit_price', width: 90, align: 'right' },
                      { title: '金额', dataIndex: 'total_amount', width: 100, align: 'right' },
                    ]}
                    dataSource={noticeDetail.items}
                    pagination={false}
                  />
                ) : (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无明细" />
                )}
              </DetailDrawerSection>

              <DetailDrawerSection title="操作记录">
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
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无操作记录" />
                )}
              </DetailDrawerSection>
            </>
          ) : null
        }
      />

      <FormModalTemplate
        title="新建发货通知单"
        open={createModalVisible}
        onClose={() => { setCreateModalVisible(false); setEffectiveRuleCode(null); }}
        formRef={formRef}
        onFinish={handleCreateSubmit}
        width={MODAL_CONFIG.LARGE_WIDTH}
        grid={false}
        initialValues={{ items: [defaultNoticeItem] }}
      >
        {renderCreateForm()}
      </FormModalTemplate>

      <FormModalTemplate
        title="编辑发货通知单"
        open={editModalVisible}
        onClose={() => setEditModalVisible(false)}
        formRef={formRef}
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
          title="导入通知明细"
          headers={noticeItemImportTemplate.importHeaders}
          exampleRow={noticeItemImportTemplate.importExampleRow}
        />
      </Suspense>
    </>
  );
};

export default ShipmentNoticesPage;
