/**
 * 销售退货单管理页面
 *
 * 提供销售退货单的创建、查看和管理功能
 *
 * @author RiverEdge Team
 * @date 2026-01-17
 */

import React, { useRef, useState, useEffect, lazy, Suspense } from 'react';
import { rowActionKind } from '../../../../../components/uni-action';
import { useNavigate } from 'react-router-dom';
import { useInvalidateMenuBadgeCounts } from '../../../../../hooks/useInvalidateMenuBadgeCounts';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns, ProDescriptionsItemProps, ProForm, ProFormText, ProFormDatePicker, ProFormTextArea, ProFormDigit, ProFormSelect, ProFormInstance } from '@ant-design/pro-components';
import { App, Button, Space, Modal, Table, Row, Col, Form as AntForm, InputNumber, Input, Select, Dropdown, Tag, Card, Typography, Spin, Empty } from 'antd';
import { EyeOutlined, CheckCircleOutlined, PlusOutlined, AppstoreAddOutlined, ImportOutlined, MoreOutlined, CopyOutlined, EditOutlined } from '@ant-design/icons';
import { theme as AntdTheme } from 'antd';
import { UniTable } from '../../../../../components/uni-table';
import {
  UniTableStackedPrimaryCell,
  UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
} from '../../../../../components/uni-table/stackedPrimaryColumn';
import { UniBatchMenuButton } from '../../../../../components/uni-batch';
import { UniPullCreateToolbar } from '../../../../../components/uni-pull';
import { ListPageTemplate, DetailDrawerTemplate, DetailDrawerInlineFullChain, DRAWER_CONFIG, MODAL_CONFIG, FormModalTemplate, DetailDrawerSection } from '../../../../../components/layout-templates';
const LazyUniImport = lazy(() =>
  import('../../../../../components/uni-import').then((m) => ({ default: m.UniImport })),
);
import { UniTableDetail } from '../../../../../components/uni-table-detail';
import { getDictionaryOptions } from '../../../../master-data/services/supply-chain';
import { initializeSystemDictionaries } from '../../../../../services/dataDictionary';
import { UniMaterialSelect } from '../../../../../components/uni-material-select';
import { UniMaterialBatchPicker } from '../../../../../components/uni-material-batch-picker';
import type { Material } from '../../../../master-data/types/material';
import { warehouseApi } from '../../../services/production';
import { customerApi } from '../../../../master-data/services/supply-chain';
import { useWarehouseLocationOptions } from '../../../hooks/useWarehouseLocationOptions';
import { UniWarehouseSelect } from '../../../../../components/uni-warehouse-select';
import dayjs from 'dayjs';
import { UniLifecycle } from '../../../../../components/uni-lifecycle';
import { getSalesReturnLifecycle } from '../../../utils/salesReturnLifecycle';
import { listSalesOrders } from '../../../services/sales-order';
import { UniLifecycleStepper } from '../../../../../components/uni-lifecycle';
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

const SALES_RETURN_CUSTOM_FIELD_TABLE = 'apps_kuaizhizao_sales_returns';

// 销售退货单接口定义
interface SalesReturn {
  id?: number;
  tenant_id?: number;
  return_code?: string;
  sales_delivery_id?: number;
  sales_delivery_code?: string;
  sales_order_id?: number;
  sales_order_code?: string;
  customer_id?: number;
  customer_name?: string;
  warehouse_id?: number;
  warehouse_name?: string;
  return_time?: string;
  returner_id?: number;
  returner_name?: string;
  reviewer_id?: number;
  reviewer_name?: string;
  review_time?: string;
  review_status?: string;
  review_remarks?: string;
  return_reason?: string;
  return_type?: string;
  status?: string;
  total_quantity?: number;
  total_amount?: number;
  shipping_method?: string;
  tracking_number?: string;
  shipping_address?: string;
  notes?: string;
  created_at?: string;
}

interface SalesReturnDetail extends SalesReturn {
  items?: SalesReturnItem[];
}

interface SalesReturnItem {
  id?: number;
  sales_delivery_item_id?: number;
  material_id?: number;
  material_code?: string;
  material_name?: string;
  return_quantity?: number;
  unit_price?: number;
  total_amount?: number;
  batch_number?: string;
  expiry_date?: string;
  location_code?: string;
  serial_numbers?: string[];
  notes?: string;
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
const FALLBACK_RETURN_REASON: { label: string; value: string }[] = [
  { label: '质量问题', value: 'QUALITY_ISSUE' },
  { label: '规格不符', value: 'SPEC_MISMATCH' },
  { label: '数量错误', value: 'QTY_ERROR' },
  { label: '包装破损', value: 'PACKAGE_DAMAGE' },
  { label: '错发漏发', value: 'WRONG_OR_MISSING' },
  { label: '客户取消', value: 'CUSTOMER_CANCEL' },
  { label: '其他', value: 'OTHER' },
];

const FALLBACK_RETURN_TYPE: { label: string; value: string }[] = [
  { label: '换货', value: 'EXCHANGE' },
  { label: '退款', value: 'REFUND' },
  { label: '返修', value: 'REWORK' },
  { label: '报废退货', value: 'SCRAP_RETURN' },
  { label: '其他', value: 'OTHER' },
];

const FALLBACK_SHIPPING_METHOD: { label: string; value: string }[] = [
  { label: '快递', value: 'EXPRESS' },
  { label: '物流', value: 'LOGISTICS' },
  { label: '自提', value: 'SELF_PICKUP' },
  { label: '专车配送', value: 'DEDICATED' },
  { label: '空运', value: 'AIR' },
  { label: '海运', value: 'SEA' },
];

const SalesReturnsPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const { token } = AntdTheme.useToken();
  const returnDetailDrawerZIndex = token.zIndexPopupBase;

  const invalidateMenuBadgeCounts = useInvalidateMenuBadgeCounts();
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
      messageApi.success('复制成功');
    } catch {
      messageApi.error('复制失败');
    }
  };

  
  // 创建/编辑相关状态
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingDetail, setEditingDetail] = useState<SalesReturnDetail | null>(null);
  const [pendingFormValues, setPendingFormValues] = useState<Record<string, any> | null>(null);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [materialPickerOpen, setMaterialPickerOpen] = useState(false);
  const [pullFromSalesOrderVisible, setPullFromSalesOrderVisible] = useState(false);
  const [pullSalesOrderLoading, setPullSalesOrderLoading] = useState(false);
  const [pullSalesOrderSubmitting, setPullSalesOrderSubmitting] = useState(false);
  const [pullSalesOrderKeyword, setPullSalesOrderKeyword] = useState('');
  const [pullSalesOrderCandidates, setPullSalesOrderCandidates] = useState<PullSalesOrderCandidate[]>([]);
  const [selectedPullSalesOrderId, setSelectedPullSalesOrderId] = useState<number | null>(null);
  const [pullWarehouseId, setPullWarehouseId] = useState<number | undefined>(undefined);
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
  const [returnReasonOptions, setReturnReasonOptions] = useState(FALLBACK_RETURN_REASON);
  const [returnTypeOptions, setReturnTypeOptions] = useState(FALLBACK_RETURN_TYPE);
  const [shippingMethodOptions, setShippingMethodOptions] = useState(FALLBACK_SHIPPING_METHOD);
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
          setReturnReasonOptions(reason.length ? reason : FALLBACK_RETURN_REASON);
          setReturnTypeOptions(rtype.length ? rtype : FALLBACK_RETURN_TYPE);
          setShippingMethodOptions(ship.length ? ship : FALLBACK_SHIPPING_METHOD);
        }
      } finally {
        if (!cancelled) setDictOptionsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [modalVisible]);

  const renderSalesReturnRowActions = (actions: React.ReactNode[]) => {
    return actions;
  };

  const salesReturnCustomFieldColumns = generateSalesReturnCustomFieldColumns();

  // 表格列定义
  const columns: ProColumns<SalesReturn>[] = [
    {
      title: '客户 / 退货单号',
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
    { title: '退货单编号', dataIndex: 'return_code', hideInTable: true },
    { title: '客户', dataIndex: 'customer_name', hideInTable: true },
    {
      title: '销售出库单编号',
      dataIndex: 'sales_delivery_code',
      width: 140,
      ellipsis: true,
    },
    {
      title: '销售订单编号',
      dataIndex: 'sales_order_code',
      width: 140,
      ellipsis: true,
    },
    {
      title: '仓库',
      dataIndex: 'warehouse_name',
      width: 120,
      ellipsis: true,
    },
    {
      title: t('app.kuaizhizao.salesReturn.totalQuantity') || '总数量',
      dataIndex: 'total_quantity',
      width: 100,
      align: 'right',
    },
    {
      title: t('app.kuaizhizao.salesReturn.totalAmount') || '总金额',
      dataIndex: 'total_amount',
      width: 120,
      align: 'right',
      render: (text: any) => `¥${Number(text || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    },
    {
      title: t('app.kuaizhizao.salesReturn.returnTime') || '退货时间',
      dataIndex: 'return_time',
      valueType: 'dateTime',
      width: 160,
    },
    {
      title: t('common.createdAt') || '创建时间',
      dataIndex: 'created_at',
      valueType: 'dateTime',
      width: 160,
    },
    {
      title: '生命周期',
      dataIndex: 'lifecycle_stage',
      align: 'center',
      fixed: 'right',
      render: (_, record) => (
        <UniLifecycle
          {...getSalesReturnLifecycle(record as any)}
          showLabel
          showCircleTooltip={false}
          size="small"
        />
      ),
    },
    ...salesReturnCustomFieldColumns,
    {
      title: '操作',
      width: 220,
      fixed: 'right',
      render: (_, record) => renderSalesReturnRowActions([
        <Button {...rowActionKind('read')} key="detail" onClick={() => handleDetail(record)}>详情</Button>,
        ...(record.status === '待退货' || record.status === '草稿' ? [
          <Button {...rowActionKind('update')} key="edit" onClick={() => void handleEdit(record)}>编辑</Button>,
        ] : []),
        ...(record.status === '待退货' ? [
          <Button {...rowActionKind('audit')} key="confirm" onClick={() => handleConfirm(record)}>确认退货</Button>,
        ] : []),
        ...(record.status === '已退货' ? [
          <Button {...rowActionKind('revoke')} key="withdraw" onClick={() => handleWithdraw(record)}>撤回确认</Button>,
        ] : []),
      ]),
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
      messageApi.error('获取销售退货单详情失败');
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
        material_unit: it.material_unit || '件',
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

  const loadPullSalesOrderCandidates = async (keyword: string = '') => {
    setPullSalesOrderLoading(true);
    try {
      const res = await listSalesOrders({
        skip: 0,
        limit: 200,
        keyword: keyword.trim() || undefined,
      });
      const orders = Array.isArray((res as any)?.data) ? (res as any).data : [];
      setPullSalesOrderCandidates(
        orders.map((order: any) => ({
          id: Number(order.id),
          order_code: order.order_code,
          customer_name: order.customer_name,
          status: order.status,
          delivery_date: order.delivery_date,
          updated_at: order.updated_at,
        })),
      );
    } catch {
      setPullSalesOrderCandidates([]);
      messageApi.error('加载销售订单失败');
    } finally {
      setPullSalesOrderLoading(false);
    }
  };

  const openPullFromSalesOrder = () => {
    setPullFromSalesOrderVisible(true);
    setPullSalesOrderKeyword('');
    setSelectedPullSalesOrderId(null);
    setPullWarehouseId(undefined);
    setPullWarehouseName('');
    void loadPullSalesOrderCandidates('');
  };

  const handlePullFromSalesOrderConfirm = async () => {
    if (!selectedPullSalesOrderId) {
      messageApi.warning('请选择销售订单');
      return;
    }
    if (!pullWarehouseId || pullWarehouseId <= 0) {
      messageApi.warning('请选择退入仓库');
      return;
    }
    setPullSalesOrderSubmitting(true);
    try {
      await warehouseApi.salesReturn.pullFromSalesOrder({
        sales_order_id: selectedPullSalesOrderId,
        warehouse_id: pullWarehouseId,
        warehouse_name: pullWarehouseName || undefined,
      });
      messageApi.success('下推成功，已生成销售退货单');
      invalidateMenuBadgeCounts();
      setPullFromSalesOrderVisible(false);
      setSelectedPullSalesOrderId(null);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error?.message || '下推失败');
    } finally {
      setPullSalesOrderSubmitting(false);
    }
  };

  const handleEdit = async (record: SalesReturn) => {
    if (record.status !== '待退货' && record.status !== '草稿') {
      messageApi.warning('仅「待退货」或「草稿」状态可编辑');
      return;
    }
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
          material_unit: (it as any).material_unit ?? '件',
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
      messageApi.error('加载退货单失败');
    }
  };

  // 处理确认退货
  const handleConfirm = async (record: SalesReturn) => {
    Modal.confirm({
      title: '确认销售退货',
      content: `确定要确认销售退货单 "${record.return_code}" 吗？确认后将自动更新库存。`,
      onOk: async () => {
        try {
          await warehouseApi.salesReturn.confirm(record.id!.toString());
          messageApi.success('销售退货确认成功');
          invalidateMenuBadgeCounts();

          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '销售退货确认失败');
        }
      },
    });
  };

  const handleWithdraw = async (record: SalesReturn) => {
    Modal.confirm({
      title: '撤回退货确认',
      content: `确定要撤回销售退货单 "${record.return_code}" 的确认状态吗？`,
      onOk: async () => {
        try {
          await warehouseApi.salesReturn.withdraw(record.id!.toString());
          messageApi.success('已撤回到待退货');
          invalidateMenuBadgeCounts();

          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '撤回失败');
        }
      },
    });
  };

  // 处理批量删除
  const handleDelete = async (keys: React.Key[]) => {
    if (!keys || keys.length === 0) return;
    try {
      for (const id of keys) {
        await warehouseApi.salesReturn.delete(String(id));
      }
      messageApi.success(`成功删除 ${keys.length} 条记录`);
      invalidateMenuBadgeCounts();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  const handleBatchConfirm = async (keys: React.Key[]) => {
    if (!keys || keys.length === 0) {
      messageApi.warning('请先选择销售退货单');
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
        await warehouseApi.salesReturn.confirm(String(id));
        success += 1;
      } catch {
        failed += 1;
      }
    }
    if (success > 0) messageApi.success(`已确认 ${success} 条销售退货单`);
    if (failed > 0) messageApi.warning(`${failed} 条确认失败（仅待退货状态可确认）`);
    setSelectedRowKeys([]);
    invalidateMenuBadgeCounts();
    actionRef.current?.reload();
  };

  const handleBatchWithdraw = async (keys: React.Key[]) => {
    if (!keys || keys.length === 0) {
      messageApi.warning('请先选择销售退货单');
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
        await warehouseApi.salesReturn.withdraw(String(id));
        success += 1;
      } catch {
        failed += 1;
      }
    }
    if (success > 0) messageApi.success(`已撤回 ${success} 条销售退货单`);
    if (failed > 0) messageApi.warning(`${failed} 条撤回失败（仅已退货状态可撤回）`);
    setSelectedRowKeys([]);
    invalidateMenuBadgeCounts();
    actionRef.current?.reload();
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
        if (!detail || (detail.status !== '待退货' && detail.status !== '草稿')) {
          messageApi.warning('当前状态不允许编辑');
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
          sales_delivery_id: detail.sales_delivery_id ?? null,
          sales_delivery_code: detail.sales_delivery_code ?? null,
          sales_order_id: detail.sales_order_id ?? null,
          sales_order_code: detail.sales_order_code ?? null,
          status: detail.status,
          items: itemsPayload,
        });
        recordId = editingId;
        messageApi.success('销售退货单已更新');
      } else {
        const created = await warehouseApi.salesReturn.create({
          ...standardValues,
          return_time: returnTime,
          items: itemsPayload,
        });
        recordId = (created as any)?.id;
        messageApi.success('销售退货单创建成功');
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
      messageApi.error(error.message || '操作失败');
    }
  };

  // 物料选择器追加明细
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
    const currentItems = formRef.current?.getFieldValue('items') || [];
    const newItems = data.map(row => ({
      material_code: row['物料编号'],
      return_quantity: Number(row['退货数量'] || 1),
      unit_price: Number(row['单价'] || 0),
      batch_number: row['批次号'],
      location_code: row['库位'],
      notes: row['备注'],
    }));
    formRef.current?.setFieldsValue({
      items: [...currentItems, ...newItems]
    });
    setImportModalVisible(false);
  };

  // 详情列 definition
  const detailColumns: ProDescriptionsItemProps<SalesReturnDetail>[] = [
    {
      title: '退货单编号',
      dataIndex: 'return_code',
    },
    {
      title: '销售出库单编号',
      dataIndex: 'sales_delivery_code',
    },
    {
      title: '销售订单编号',
      dataIndex: 'sales_order_code',
    },
    {
      title: '客户',
      dataIndex: 'customer_name',
    },
    {
      title: '仓库',
      dataIndex: 'warehouse_name',
    },
    {
      title: '退货状态',
      dataIndex: 'status',
      render: (status) => {
        const statusMap: Record<string, { text: string; color: string }> = {
          '待退货': { text: '待退货', color: 'default' },
          '已退货': { text: '已退货', color: 'success' },
          '已取消': { text: '已取消', color: 'error' },
        };
        const config = statusMap[(status as any) || ''] || { text: (status as any) || '-', color: 'default' };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '退货原因',
      dataIndex: 'return_reason',
    },
    {
      title: '退货类型',
      dataIndex: 'return_type',
    },
    {
      title: '总数量',
      dataIndex: 'total_quantity',
    },
    {
      title: '总金额',
      dataIndex: 'total_amount',
      render: (text) => `¥${text?.toLocaleString() || 0}`,
    },
    {
      title: '退货时间',
      dataIndex: 'return_time',
      valueType: 'dateTime',
    },
    {
      title: '退货人',
      dataIndex: 'returner_name',
    },
  ];

  return (
    <>
      <ListPageTemplate>
        <UniTable
          columnPersistenceId="apps.kuaizhizao.pages.sales-management.sales-returns"
          headerTitle="销售退货"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          selectedRowKeys={selectedRowKeys}
          onRowSelectionChange={setSelectedRowKeys}
          showAdvancedSearch={true}
          showCreateButton={false}
          createButtonText="新建销售退货单"
          onCreate={handleCreate}
          toolBarRender={() => [
            <UniPullCreateToolbar
              compactKey="create-sales-return-with-pull"
              createIcon={<PlusOutlined />}
              createLabel="新建销售退货单"
              onCreate={handleCreate}
              menuItems={[
                {
                  key: 'pull-from-sales-order',
                  label: '下推销售订单',
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
              messageApi.error('获取销售退货单列表失败');
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
          deleteConfirmTitle={(count) => `确认删除选中的 ${count} 条销售退货单？`}
          toolBarActionsAfterDelete={[
            <UniBatchMenuButton
              key="sales-return-batch-menu"
              selectedRowKeys={selectedRowKeys}
              menuItems={[
                {
                  key: 'confirm',
                  label: '批量确认退货',
                  icon: <CheckCircleOutlined />,
                  onClick: handleBatchConfirm,
                },
                {
                  key: 'withdraw',
                  label: '批量撤回确认',
                  icon: <CopyOutlined />,
                  onClick: handleBatchWithdraw,
                },
              ]}
            />,
          ]}
          scroll={{ x: 1200 }}
        />
      </ListPageTemplate>

      <FormModalTemplate
        title={editingId ? '编辑销售退货单' : '新增销售退货单'}
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
              label="客户"
              placeholder="请选择客户"
              required
              request={async () => {
                const res = await customerApi.list({ limit: 1000, isActive: true });
                const list = Array.isArray(res) ? res : (res as any)?.data || (res as any)?.items || [];
                return list.map((c: any) => ({
                  label: c.name || c.customer_name || c.code || `客户${c.id}`,
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
              rules={[{ required: true, message: '请选择客户' }]}
            />
            <ProFormText name="customer_name" hidden />
          </Col>
          <Col span={8}>
            <UniWarehouseSelect
              name="warehouse_id"
              label="退入仓库"
              placeholder="请选择仓库"
              required
              onChange={(value, wh) => {
                formRef.current?.setFieldsValue({ warehouse_name: (wh as any)?.name ?? '' });
                updateSelectedWarehouseId(value);
              }}
              rules={[{ required: true, message: '请选择仓库' }]}
            />
            <ProFormText name="warehouse_name" hidden />
          </Col>
          <Col span={8}>
            <ProFormDatePicker
              name="return_time"
              label="退货日期"
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
              label="退货原因"
              placeholder="请选择退货原因"
              options={returnReasonOptions}
              fieldProps={{ showSearch: true, allowClear: true, loading: dictOptionsLoading }}
            />
          </Col>
          <Col span={8}>
            <ProFormSelect
              name="return_type"
              label="退货类型"
              placeholder="请选择退货类型"
              options={returnTypeOptions}
              fieldProps={{ showSearch: true, allowClear: true, loading: dictOptionsLoading }}
            />
          </Col>
          <Col span={8}>
            <ProFormSelect
              name="shipping_method"
              label="发货方式"
              placeholder="请选择发货方式"
              options={shippingMethodOptions}
              fieldProps={{ showSearch: true, allowClear: true, loading: dictOptionsLoading }}
            />
          </Col>
        </Row>

        <CustomFieldsFormSection
          customFields={salesReturnFormCustomFields}
          customFieldValues={salesReturnFormCustomFieldValues}
          gridColumns={3}
        />

        <UniTableDetail
          name="items"
          title="退货明细"
          required
          requiredMessage="请添加至少一项明细"
          headerExtra={(
            <Space size={8}>
              <Button
                type="default"
                icon={<ImportOutlined />}
                onClick={() => setImportModalVisible(true)}
              >
                导入明细
              </Button>
              <Button
                type="dashed"
                icon={<PlusOutlined />}
                onClick={() => {
                  const items = [...(formRef.current?.getFieldValue('items') ?? [])];
                  items.push({ return_quantity: 1, unit_price: 0 });
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
                      width: 260,
                      render: (_: unknown, __: unknown, index: number) => (
                        <UniMaterialSelect
                          name={[index, 'material_id']}
                          label=""
                          placeholder="选择物料"
                          required
                          size="small"
                          listFieldKey={index}
                          listFieldName="items"
                          fillMapping={{
                            material_code: 'mainCode',
                            material_name: 'name',
                            material_spec: 'specification',
                            material_unit: 'baseUnit',
                          }}
                          showAdvancedSearch
                        />
                      ),
                    },
                    {
                      title: '批号',
                      dataIndex: 'batch_number',
                      width: 150,
                      render: (_: unknown, __: unknown, index: number) => (
                        <AntForm.Item name={[index, 'batch_number']} noStyle>
                          <Input size="small" placeholder="请输入批号" />
                        </AntForm.Item>
                      ),
                    },
                    {
                      title: '库位',
                      dataIndex: 'location_code',
                      width: 180,
                      render: (_: unknown, __: unknown, index: number) => (
                        <AntForm.Item name={[index, 'location_code']} noStyle>
                          <Select
                            options={locationOptions}
                            placeholder={selectedWarehouseId ? '请选择库位' : '请先选择仓库'}
                            style={{ width: '100%' }}
                            size="small"
                            showSearch
                            optionFilterProp="label"
                            allowClear
                            disabled={!selectedWarehouseId}
                          />
                        </AntForm.Item>
                      ),
                    },
                    {
                      title: '退货数量',
                      dataIndex: 'return_quantity',
                      width: 120,
                      align: 'right' as const,
                      render: (_: unknown, __: unknown, index: number) => (
                        <AntForm.Item name={[index, 'return_quantity']} noStyle>
                          <InputNumber size="small" style={{ width: '100%' }} min={1} />
                        </AntForm.Item>
                      ),
                    },
                    {
                      title: '单价',
                      dataIndex: 'unit_price',
                      width: 120,
                      align: 'right' as const,
                      render: (_: unknown, __: unknown, index: number) => (
                        <AntForm.Item name={[index, 'unit_price']} noStyle>
                          <InputNumber size="small" style={{ width: '100%' }} min={0} prefix="¥" />
                        </AntForm.Item>
                      ),
                    },
                  ]}
          disabledAdd
          initialValue={{ return_quantity: 1, unit_price: 0 }}
          tableProps={{
            size: 'small',
            style: { width: '100%', margin: 0 },
          }}
        />

        <ProFormTextArea name="notes" label="备注" placeholder="请输入备注说明" fieldProps={{ rows: 3 }} />
      </FormModalTemplate>

      <UniMaterialBatchPicker
        open={materialPickerOpen}
        onCancel={() => setMaterialPickerOpen(false)}
        onConfirm={appendItemsFromMaterials}
      />

      <Modal
        title="从销售订单下推"
        open={pullFromSalesOrderVisible}
        onCancel={() => {
          if (pullSalesOrderSubmitting) return;
          setPullFromSalesOrderVisible(false);
          setSelectedPullSalesOrderId(null);
        }}
        onOk={() => {
          void handlePullFromSalesOrderConfirm();
        }}
        okText="创建销售退货单"
        confirmLoading={pullSalesOrderSubmitting}
        destroyOnHidden
      >
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
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
          <UniWarehouseSelect
            label="退入仓库"
            placeholder="请选择退入仓库"
            value={pullWarehouseId}
            onChange={(value, warehouse) => {
              const nextId = Number(value);
              setPullWarehouseId(Number.isFinite(nextId) && nextId > 0 ? nextId : undefined);
              setPullWarehouseName((warehouse as any)?.name ?? '');
            }}
          />
          <Table<PullSalesOrderCandidate>
            rowKey="id"
            loading={pullSalesOrderLoading}
            dataSource={pullSalesOrderCandidates}
            pagination={false}
            scroll={{ x: 900, y: 340 }}
            rowSelection={{
              type: 'radio',
              selectedRowKeys: selectedPullSalesOrderId ? [selectedPullSalesOrderId] : [],
              onChange: (keys) => {
                const next = Number(keys?.[0]);
                if (Number.isFinite(next)) setSelectedPullSalesOrderId(next);
                else setSelectedPullSalesOrderId(null);
              },
            }}
            onRow={(record) => ({
              onClick: () => {
                setSelectedPullSalesOrderId(record.id);
              },
            })}
            columns={[
              { title: '销售订单号', dataIndex: 'order_code', width: 180, ellipsis: true },
              { title: '客户', dataIndex: 'customer_name', width: 220, ellipsis: true },
              { title: '订单状态', dataIndex: 'status', width: 130, align: 'center' },
              { title: '交期', dataIndex: 'delivery_date', width: 130, render: (v) => (v ? dayjs(v).format('YYYY-MM-DD') : '-') },
              { title: '更新时间', dataIndex: 'updated_at', width: 180, render: (v) => (v ? dayjs(v).format('YYYY-MM-DD HH:mm:ss') : '-') },
            ]}
          />
        </Space>
      </Modal>

      <Suspense fallback={null}>
        <LazyUniImport
          visible={importModalVisible}
          onCancel={() => setImportModalVisible(false)}
          onConfirm={handleImport}
          title="导入销售退货明细"
          headers={['物料编号', '退货数量', '单价', '批次号', '库位', '备注']}
          exampleRow={['MAT001', '10', '99.5', 'B20260117001', 'A01-01-01', '备注说明']}
        />
      </Suspense>

      {/* 详情Drawer */}
      <DetailDrawerTemplate
        title={`销售退货单详情${returnDetail?.return_code ? ` - ${returnDetail.return_code}` : ''}`}
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
        customContent={
          returnDetail ? (
            <div style={{ padding: '16px 0' }}>
              <DetailDrawerSection title="基本信息">
                <Table
                  size="small"
                  pagination={false}
                  columns={[
                    { title: '字段', dataIndex: 'k', width: 120 },
                    { title: '值', dataIndex: 'v' },
                  ]}
                  dataSource={[
                    {
                      key: 'return_code',
                      k: '退货单编号',
                      v: (
                        <Space size={4}>
                          <span>{returnDetail.return_code || '-'}</span>
                          {returnDetail.return_code ? <Button type="link" size="small" icon={<CopyOutlined style={{ fontSize: 12 }} />} onClick={() => handleCopy(returnDetail.return_code)} /> : null}
                        </Space>
                      ),
                    },
                    { key: 'sales_delivery_code', k: '销售出库单编号', v: returnDetail.sales_delivery_code || '-' },
                    { key: 'sales_order_code', k: '销售订单编号', v: returnDetail.sales_order_code || '-' },
                    { key: 'customer_name', k: '客户', v: returnDetail.customer_name || '-' },
                    { key: 'warehouse_name', k: '仓库', v: returnDetail.warehouse_name || '-' },
                    { key: 'status', k: '状态', v: returnDetail.status || '-' },
                    { key: 'return_reason', k: '退货原因', v: returnDetail.return_reason || '-' },
                    { key: 'return_type', k: '退货类型', v: returnDetail.return_type || '-' },
                    { key: 'return_time', k: '退货时间', v: returnDetail.return_time || '-' },
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
                      { title: '字段', dataIndex: 'k', width: 120 },
                      { title: '值', dataIndex: 'v' },
                    ]}
                    dataSource={[{ key: 'notes', k: '备注', v: returnDetail.notes }]}
                    rowKey="key"
                  />
                ) : null}
              </DetailDrawerSection>

              <DetailDrawerSection title="生命周期">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {(() => {
                    const lifecycle = getSalesReturnLifecycle(returnDetail as any);
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

              <DetailDrawerSection title="明细信息">
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
                        { title: '物料编号', dataIndex: 'material_code', width: 120 },
                        { title: '物料名称', dataIndex: 'material_name', width: 150 },
                        { title: '退货数量', dataIndex: 'return_quantity', width: 100, align: 'right' },
                        { title: '单价', dataIndex: 'unit_price', width: 100, align: 'right', render: (text) => `¥${text || 0}` },
                        { title: '金额', dataIndex: 'total_amount', width: 100, align: 'right', render: (text) => `¥${text || 0}` },
                        { title: '批次号', dataIndex: 'batch_number', width: 120 },
                        { title: '库位', dataIndex: 'location_code', width: 100 },
                      ]}
                      dataSource={returnDetail.items}
                      rowKey="id"
                    />
                  </div>
                ) : (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无明细" />
                )}
              </DetailDrawerSection>

              <DetailDrawerSection title="操作记录">
                {salesReturnTracking.loading && <Spin />}
                {salesReturnTracking.error && <Typography.Text type="danger">{salesReturnTracking.error}</Typography.Text>}
                {salesReturnTracking.data && <DocumentTrackingTimelineBody data={salesReturnTracking.data} />}
              </DetailDrawerSection>
            </div>
          ) : null
        }
      />
    </>
  );
};

export default SalesReturnsPage;
