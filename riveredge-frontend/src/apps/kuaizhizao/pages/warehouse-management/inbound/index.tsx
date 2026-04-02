/**
 * 入库管理页面
 *
 * 提供入库单的管理功能，支持多种入库类型：采购入库、成品入库（产品入库）、生产退料等。
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { ActionType, ProColumns, ProFormSelect, ProFormText, ProFormDatePicker, ProFormItem } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Modal, Card, Table, Row, Col, Form as AntForm, InputNumber, Input } from 'antd';
import { PlusOutlined, EyeOutlined, CheckCircleOutlined, DeleteOutlined, InboxOutlined, ShoppingOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { UniMaterialSelect } from '../../../../../components/uni-material-select';
import { MaterialBatchPickerModal } from '../../../../../components/material-batch-picker-modal';
import { MaterialUnitSelect } from '../../../../../components/material-unit-select';
import { DictionaryLabel } from '../../../../../components/dictionary-label';
import type { Material } from '../../../../master-data/types/material';
import { useTranslation } from 'react-i18next';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { NEW_SHORTCUT_HINT } from '../../../../../utils/globalNewShortcut';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, DetailDrawerSection, MODAL_CONFIG, DRAWER_CONFIG, WAREHOUSE_DETAIL_TABLE_STYLES } from '../../../../../components/layout-templates';
import DocumentTrackingPanel from '../../../../../components/document-tracking-panel';
import CodeField from '../../../../../components/code-field';
import { warehouseApi, workOrderApi } from '../../../services/production';
import { getInboundLifecycle } from '../../../utils/inboundLifecycle';
import { getDocumentLifecycleStageTagProps } from '../../../../../utils/documentLifecycleStatusTag';
import { warehouseApi as masterWarehouseApi } from '../../../../master-data/services/warehouse';
import { supplierApi } from '../../../../master-data/services/supply-chain';
import { getPurchaseOrder, listPurchaseOrders, pushPurchaseOrderToReceipt } from '../../../services/purchase';
import { receiptNoticeApi } from '../../../services/receipt-notice';
import { UniLifecycleStepper } from '../../../../../components/uni-lifecycle';

// 统一的入库单接口（结合采购入库、成品入库、生产退料）
interface InboundOrder {
  id?: number;
  tenant_id?: number;
  receipt_code?: string;
  return_code?: string;
  receipt_type?: 'purchase' | 'finished_goods' | 'production_return';
  status?: string;
  receipt_date?: string;
  return_time?: string;
  supplier_id?: number;
  supplier_name?: string;
  work_order_id?: number;
  work_order_code?: string;
  picking_code?: string;
  warehouse_id?: number;
  warehouse_name?: string;
  workshop_name?: string;
  received_by?: string;
  returner_name?: string;
  total_quantity?: number;
  total_items?: number;
  notes?: string;
  review_status?: string;
  purchase_order_id?: number;
  purchase_order_code?: string;
  created_at?: string;
  updated_at?: string;
  items?: InboundOrderItem[];
  [key: string]: any;
}

interface InboundOrderItem {
  id?: number;
  tenant_id?: number;
  receipt_id?: number;
  material_id?: number;
  material_code?: string;
  material_name?: string;
  material_spec?: string;
  material_unit?: string;
  purchase_order_item_id?: number;
  receipt_quantity?: number;
  unit_price?: number;
  total_amount?: number;
  qualified_quantity?: number;
  unqualified_quantity?: number;
  batch_number?: string;
  status?: string;
  quantity?: number;
  unit?: string;
  notes?: string;
}

const InboundPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  // Modal 相关状态（创建入库单）
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const formRef = useRef<any>(null);
  const [inboundType, setInboundType] = useState<string>('purchase');

  // Drawer 相关状态（详情查看）
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<InboundOrder | null>(null);
  const [editableReceiptQuantities, setEditableReceiptQuantities] = useState<Record<number, number>>({});
  const [savingPurchaseReceipt, setSavingPurchaseReceipt] = useState(false);

  // 批量入库 Modal
  const [batchModalVisible, setBatchModalVisible] = useState(false);
  const [batchForm] = AntForm.useForm();
  const [batchInboundType, setBatchInboundType] = useState<'finished_goods' | 'purchase'>('finished_goods');
  const [workOrderOptions, setWorkOrderOptions] = useState<{ label: string; value: number }[]>([]);
  const [purchaseOrderOptions, setPurchaseOrderOptions] = useState<{ label: string; value: number }[]>([]);
  const [warehouseOptions, setWarehouseOptions] = useState<{ label: string; value: number; name: string }[]>([]);
  const [batchSubmitting, setBatchSubmitting] = useState(false);

  // 新建入库单：仓库、供应商选项
  const [createWarehouseOptions, setCreateWarehouseOptions] = useState<{ label: string; value: number; name: string }[]>([]);
  const [supplierOptions, setSupplierOptions] = useState<{ label: string; value: number; name: string }[]>([]);
  const [purchaseSourceType, setPurchaseSourceType] = useState<'purchase_order' | 'receipt_notice'>('purchase_order');
  const [purchaseSourceOptions, setPurchaseSourceOptions] = useState<{ label: string; value: number }[]>([]);
  const [sourceLoading, setSourceLoading] = useState(false);
  const [materialPickerOpen, setMaterialPickerOpen] = useState(false);

  const defaultPurchaseItem = {
    purchase_order_item_id: 0,
    material_id: undefined,
    material_code: '',
    material_name: '',
    material_unit: '',
    receipt_quantity: 1,
    unit_price: 0,
    qualified_quantity: 1,
    unqualified_quantity: 0,
  };

  const appendPurchaseInboundItemsFromMaterials = useCallback(
    (selected: Material[]) => {
      const current = formRef.current?.getFieldValue('items') ?? [];
      const newRows = selected.map((m) => ({
        ...defaultPurchaseItem,
        material_id: m.id,
        material_code: m.mainCode ?? m.code ?? '',
        material_name: m.name ?? '',
        material_unit: m.baseUnit ?? '',
      }));
      formRef.current?.setFieldsValue({ items: [...current, ...newRows] });
      messageApi.success(t('app.kuaizhizao.common.materialBatchAdded', { count: selected.length }));
    },
    [messageApi, t]
  );

  const handleCreate = () => {
    setInboundType('purchase');
    setCreateModalVisible(true);
  };

  useNewShortcut(handleCreate);

  /** 新建入库单：加载仓库、供应商 */
  useEffect(() => {
    if (!createModalVisible) return;
    const load = async () => {
      try {
        const [whRes, supRes] = await Promise.all([
          masterWarehouseApi.list({ isActive: true, limit: 500 }),
          supplierApi.list({ limit: 500 }),
        ]);
        const whList = Array.isArray(whRes) ? whRes : (whRes as any)?.data ?? (whRes as any)?.items ?? whRes ?? [];
        setCreateWarehouseOptions(
          (Array.isArray(whList) ? whList : []).map((w: any) => ({
            label: `${w.code || ''} ${w.name || ''}`.trim() || String(w.id),
            value: w.id,
            name: w.name || '',
          }))
        );
        const supList = Array.isArray(supRes) ? supRes : (supRes as any)?.data ?? (supRes as any)?.items ?? supRes ?? [];
        setSupplierOptions(
          (Array.isArray(supList) ? supList : []).map((s: any) => ({
            label: `${s.code || ''} ${s.name || ''}`.trim() || String(s.id ?? s.uuid),
            value: s.id,
            name: s.name || '',
          }))
        );
      } catch {
        setCreateWarehouseOptions([]);
        setSupplierOptions([]);
      }
    };
    load();
  }, [createModalVisible]);

  useEffect(() => {
    if (!createModalVisible || inboundType !== 'purchase') return;
    const loadSources = async () => {
      try {
        setSourceLoading(true);
        if (purchaseSourceType === 'purchase_order') {
          const poRes = await listPurchaseOrders({ skip: 0, limit: 500 });
          const poData = (poRes as any)?.data ?? (poRes as any)?.items ?? poRes ?? [];
          const poList = Array.isArray(poData) ? poData : [];
          const eligible = poList.filter((po: any) => ['已审核', '已确认', 'AUDITED', 'CONFIRMED'].includes(po.status));
          setPurchaseSourceOptions(
            eligible.map((po: any) => ({
              value: Number(po.id),
              label: `${po.order_code || po.code || po.id} - ${po.supplier_name || '-'}`,
            }))
          );
        } else {
          const rnRes = await receiptNoticeApi.list({ skip: 0, limit: 500 });
          const rnData = (rnRes as any)?.data ?? (rnRes as any)?.items ?? rnRes ?? [];
          const rnList = Array.isArray(rnData) ? rnData : [];
          const eligible = rnList.filter((n: any) => ['待收货', '已通知'].includes(n.status));
          setPurchaseSourceOptions(
            eligible.map((n: any) => ({
              value: Number(n.id),
              label: `${n.notice_code || n.id} - ${n.supplier_name || '-'}`,
            }))
          );
        }
      } catch {
        setPurchaseSourceOptions([]);
      } finally {
        setSourceLoading(false);
      }
    };
    loadSources();
  }, [createModalVisible, inboundType, purchaseSourceType]);

  const loadPurchaseBySource = async () => {
    if (inboundType !== 'purchase') return;
    const sourceId = formRef.current?.getFieldValue?.('source_id');
    if (!sourceId) {
      messageApi.warning('请先选择源单据');
      return;
    }
    try {
      setSourceLoading(true);
      if (purchaseSourceType === 'purchase_order') {
        const detail: any = await getPurchaseOrder(Number(sourceId));
        const mappedItems = (detail.items || [])
          .filter((it: any) => Number(it.outstanding_quantity ?? it.ordered_quantity ?? 0) > 0)
          .map((it: any) => ({
            purchase_order_item_id: Number(it.id || 0),
            material_id: Number(it.material_id),
            material_code: it.material_code || '',
            material_name: it.material_name || '',
            material_spec: it.material_spec || '',
            material_unit: it.unit || '个',
            receipt_quantity: Number(it.outstanding_quantity ?? it.ordered_quantity ?? 0),
            unit_price: Number(it.unit_price ?? 0),
            qualified_quantity: Number(it.outstanding_quantity ?? it.ordered_quantity ?? 0),
            unqualified_quantity: 0,
          }));
        if (!mappedItems.length) {
          messageApi.warning('该采购单暂无可入库明细');
          return;
        }
        formRef.current?.setFieldsValue?.({
          purchase_order_id: Number(detail.id || 0),
          purchase_order_code: detail.order_code || '',
          supplier_id: detail.supplier_id,
          items: mappedItems,
          notes: detail.notes || undefined,
        });
      } else {
        const detail: any = await receiptNoticeApi.get(String(sourceId));
        const mappedItems = (detail.items || [])
          .filter((it: any) => Number(it.notice_quantity ?? 0) > 0)
          .map((it: any) => ({
            purchase_order_item_id: Number(it.purchase_order_item_id || 0),
            material_id: Number(it.material_id),
            material_code: it.material_code || '',
            material_name: it.material_name || '',
            material_spec: it.material_spec || '',
            material_unit: it.material_unit || '个',
            receipt_quantity: Number(it.notice_quantity ?? 0),
            unit_price: Number(it.unit_price ?? 0),
            qualified_quantity: Number(it.notice_quantity ?? 0),
            unqualified_quantity: 0,
          }));
        if (!mappedItems.length) {
          messageApi.warning('该收货通知单暂无可入库明细');
          return;
        }
        formRef.current?.setFieldsValue?.({
          purchase_order_id: Number(detail.purchase_order_id || 0),
          purchase_order_code: detail.purchase_order_code || '',
          warehouse_id: detail.warehouse_id || undefined,
          supplier_id: detail.supplier_id,
          items: mappedItems,
          notes: detail.notes || undefined,
        });
      }
      messageApi.success('已按源单据载入入库明细');
    } catch (e: any) {
      messageApi.error(e?.message || e?.response?.data?.detail || '载入源单据失败');
    } finally {
      setSourceLoading(false);
    }
  };

  /** 批量入库：加载工单、采购订单、仓库 */
  useEffect(() => {
    if (!batchModalVisible) return;
    const load = async () => {
      try {
        const [woRes, poRes, whRes] = await Promise.all([
          workOrderApi.list({ skip: 0, limit: 500 }),
          listPurchaseOrders({ skip: 0, limit: 500 }),
          masterWarehouseApi.list({ isActive: true }),
        ]);
        const woList = Array.isArray(woRes) ? woRes : (woRes as any)?.data ?? (woRes as any)?.items ?? [];
        const eligibleWo = woList.filter(
          (wo: any) => ['进行中', '已完成', 'in_progress', 'completed'].includes(wo.status)
        );
        setWorkOrderOptions(
          eligibleWo.map((wo: any) => ({
            label: `${wo.code || wo.id} - ${wo.product_name || wo.name || '-'}`,
            value: wo.id,
          }))
        );
        const poData = (poRes as any)?.data ?? (poRes as any)?.items ?? poRes ?? [];
        const poList = Array.isArray(poData) ? poData : [];
        const eligiblePo = poList.filter(
          (po: any) => ['已审核', '已确认', 'AUDITED', 'CONFIRMED'].includes(po.status)
        );
        setPurchaseOrderOptions(
          eligiblePo.map((po: any) => ({
            label: `${po.order_code || po.code || po.id} - ${po.supplier_name || '-'}`,
            value: po.id,
          }))
        );
        const whList = Array.isArray(whRes) ? whRes : (whRes as any)?.data ?? (whRes as any)?.items ?? whRes ?? [];
        setWarehouseOptions(
          (Array.isArray(whList) ? whList : []).map((w: any) => ({
            label: `${w.code || ''} ${w.name || ''}`.trim() || String(w.id),
            value: w.id,
            name: w.name || '',
          }))
        );
      } catch {
        setWorkOrderOptions([]);
        setPurchaseOrderOptions([]);
        setWarehouseOptions([]);
      }
    };
    load();
  }, [batchModalVisible]);

  /** 批量入库提交 */
  const handleBatchSubmit = async () => {
    try {
      const values = await batchForm.validateFields();
      const type = values.batch_inbound_type || batchInboundType;
      setBatchSubmitting(true);

      if (type === 'purchase') {
        const orderIds = values.purchase_order_ids as number[];
        if (!orderIds?.length) {
          messageApi.warning('请选择至少一个采购订单');
          return;
        }
        let success = 0;
        for (const id of orderIds) {
          try {
            await pushPurchaseOrderToReceipt(id);
            success++;
          } catch (e: any) {
            messageApi.warning(`采购订单 ${id} 下推失败：${e?.message || e?.response?.data?.detail || '未知错误'}`);
          }
        }
        messageApi.success(`批量采购入库成功，共创建 ${success} 张采购入库单`);
      } else {
        const workOrderIds = values.work_order_ids as number[];
        const warehouseId = values.warehouse_id as number;
        const wh = warehouseOptions.find((w) => w.value === warehouseId);
        if (!workOrderIds?.length) {
          messageApi.warning('请选择至少一个工单');
          return;
        }
        if (!warehouseId) {
          messageApi.warning('请选择入库仓库');
          return;
        }
        const result = await warehouseApi.finishedGoodsReceipt.batchReceipt({
          work_order_ids: workOrderIds,
          warehouse_id: warehouseId,
          warehouse_name: wh?.name,
        });
        const list = Array.isArray(result) ? result : (result as any)?.data ?? (result as any)?.items ?? [];
        messageApi.success(`批量成品入库成功，共创建 ${list.length} 张成品入库单`);
      }
      setBatchModalVisible(false);
      batchForm.resetFields();
      actionRef.current?.reload();
    } catch (e: any) {
      messageApi.error(e?.message || e?.response?.data?.detail || '批量入库失败');
    } finally {
      setBatchSubmitting(false);
    }
  };

  /**
   * 处理查看详情
   */
  const handleDetail = async (record: InboundOrder) => {
    try {
      let detailData: any;
      if (record.receipt_type === 'purchase') {
        detailData = await warehouseApi.purchaseReceipt.get(record.id!.toString());
      } else if (record.receipt_type === 'finished_goods') {
        detailData = await warehouseApi.finishedGoodsReceipt.get(record.id!.toString());
      } else if (record.receipt_type === 'production_return') {
        detailData = await warehouseApi.productionReturn.get(record.id!.toString());
      }
      if (detailData) {
        if (record.receipt_type === 'purchase') {
          const quantities: Record<number, number> = {};
          (detailData.items || []).forEach((it: any) => {
            if (it?.id != null) quantities[it.id] = Number(it.receipt_quantity ?? 0);
          });
          setEditableReceiptQuantities(quantities);
        } else {
          setEditableReceiptQuantities({});
        }
        setCurrentOrder({ ...detailData, receipt_type: record.receipt_type });
        setDetailDrawerVisible(true);
      }
    } catch (error) {
      messageApi.error('获取入库单详情失败');
    }
  };

  const isEditablePurchaseReceipt = (order?: InboundOrder | null) =>
    order?.receipt_type === 'purchase' && ['草稿', 'draft', 'DRAFT', '待入库'].includes(String(order?.status || ''));

  const handleSavePurchaseReceiptQuantities = async () => {
    if (!currentOrder?.id || currentOrder.receipt_type !== 'purchase') return;
    const items = (currentOrder.items || []) as InboundOrderItem[];
    if (!items.length) {
      messageApi.warning('暂无可编辑明细');
      return;
    }
    const mappedItems = items
      .filter((it) => it.material_id != null)
      .map((it) => {
        const rowId = Number(it.id);
        const qty = Number(editableReceiptQuantities[rowId] ?? it.receipt_quantity ?? 0);
        if (!(qty > 0)) {
          throw new Error(`物料 ${it.material_code || it.material_name || '-'} 的实际数量必须大于 0`);
        }
        const unitPrice = Number(it.unit_price ?? 0);
        const qualified = Number(it.qualified_quantity ?? it.receipt_quantity ?? qty);
        const unqualified = Number(it.unqualified_quantity ?? 0);
        return {
          purchase_order_item_id: Number(it.purchase_order_item_id ?? 0),
          material_id: Number(it.material_id),
          material_code: it.material_code || '',
          material_name: it.material_name || '',
          material_spec: it.material_spec || undefined,
          material_unit: it.material_unit || it.unit || '个',
          receipt_quantity: qty,
          unit_price: unitPrice,
          total_amount: Number((qty * unitPrice).toFixed(2)),
          qualified_quantity: Number((qualified + unqualified > qty ? qty : qualified).toFixed(2)),
          unqualified_quantity: Number((qualified + unqualified > qty ? 0 : unqualified).toFixed(2)),
          batch_number: it.batch_number || undefined,
          status: it.status || currentOrder.status || '草稿',
          notes: it.notes || undefined,
        };
      });

    setSavingPurchaseReceipt(true);
    try {
      await warehouseApi.purchaseReceipt.update(String(currentOrder.id), {
        purchase_order_id: Number(currentOrder.purchase_order_id || 0),
        purchase_order_code: currentOrder.purchase_order_code || '',
        supplier_id: Number(currentOrder.supplier_id || 0),
        supplier_name: currentOrder.supplier_name || '',
        warehouse_id: Number(currentOrder.warehouse_id || 0),
        warehouse_name: currentOrder.warehouse_name || '',
        status: currentOrder.status || '草稿',
        review_status: currentOrder.review_status || '待审核',
        notes: currentOrder.notes || undefined,
        items: mappedItems,
      });
      const detail = await warehouseApi.purchaseReceipt.get(String(currentOrder.id));
      setCurrentOrder({ ...detail, receipt_type: 'purchase' });
      const quantities: Record<number, number> = {};
      ((detail as any).items || []).forEach((it: any) => {
        if (it?.id != null) quantities[it.id] = Number(it.receipt_quantity ?? 0);
      });
      setEditableReceiptQuantities(quantities);
      messageApi.success('实际数量已保存');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error?.message || error?.response?.data?.detail || '保存失败');
    } finally {
      setSavingPurchaseReceipt(false);
    }
  };

  /**
   * 处理确认入库/退料
   */
  const handleConfirm = async (record: InboundOrder) => {
    const code = record.receipt_code || record.return_code || '';
    const title = record.receipt_type === 'production_return' ? '确认退料' : '确认入库';
    const content = record.receipt_type === 'production_return'
      ? `确定要确认退料单 "${code}" 吗？确认后将更新库存。`
      : `确定要确认入库单 "${code}" 吗？确认后将更新库存。`;
    Modal.confirm({
      title,
      content,
      onOk: async () => {
        try {
          if (record.receipt_type === 'purchase') {
            await warehouseApi.purchaseReceipt.confirm(record.id!.toString());
          } else if (record.receipt_type === 'finished_goods') {
            await warehouseApi.finishedGoodsReceipt.confirm(record.id!.toString());
          } else if (record.receipt_type === 'production_return') {
            await warehouseApi.productionReturn.confirm(record.id!.toString());
          }
          messageApi.success(record.receipt_type === 'production_return' ? '退料确认成功' : '入库确认成功，库存已更新');
          actionRef.current?.reload();
          if (currentOrder?.id === record.id) {
            try {
              let detailData: any;
              if (record.receipt_type === 'purchase') {
                detailData = await warehouseApi.purchaseReceipt.get(record.id!.toString());
              } else if (record.receipt_type === 'finished_goods') {
                detailData = await warehouseApi.finishedGoodsReceipt.get(record.id!.toString());
              } else if (record.receipt_type === 'production_return') {
                detailData = await warehouseApi.productionReturn.get(record.id!.toString());
              }
              if (detailData) {
                setCurrentOrder({ ...detailData, receipt_type: record.receipt_type });
              }
            } catch { /* ignore */ }
          }
        } catch (error) {
          messageApi.error(record.receipt_type === 'production_return' ? '退料确认失败' : '入库确认失败');
        }
      },
    });
  };

  /**
   * 处理删除（仅生产退料支持）
   */
  const handleDelete = async (record: InboundOrder) => {
    if (record.receipt_type !== 'production_return') return;
    const code = record.return_code || record.receipt_code || '';
    Modal.confirm({
      title: '删除退料单',
      content: `确定要删除退料单 "${code}" 吗？`,
      onOk: async () => {
        try {
          await warehouseApi.productionReturn.delete(record.id!.toString());
          messageApi.success('删除成功');
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '删除失败');
        }
      },
    });
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<InboundOrder>[] = [
    {
      title: '单号',
      dataIndex: ['receipt_code', 'return_code'],
      width: 140,
      ellipsis: true,
      fixed: 'left',
      render: (_, record) => record.receipt_code || record.return_code,
    },
    {
      title: '入库类型',
      dataIndex: 'receipt_type',
      width: 100,
      valueEnum: {
        purchase: { text: '采购入库', status: 'processing' },
        finished_goods: { text: '成品入库', status: 'success' },
        production_return: { text: '生产退料', status: 'warning' },
      },
    },
    {
      title: '生命周期',
      dataIndex: 'lifecycle',
      width: 100,
      render: (_, record) => {
        const lifecycle = getInboundLifecycle(record);
        const stageName = lifecycle.stageName ?? record.status ?? '草稿';
        return <Tag {...getDocumentLifecycleStageTagProps(stageName)}>{stageName}</Tag>;
      },
    },
    {
      title: '供应商',
      dataIndex: 'supplier_name',
      width: 120,
      ellipsis: true,
    },
    {
      title: '工单/领料单',
      dataIndex: ['work_order_code', 'picking_code'],
      width: 140,
      ellipsis: true,
      render: (_, record) => [record.work_order_code, record.picking_code].filter(Boolean).join(' / ') || '-',
    },
    {
      title: '入库数量',
      dataIndex: 'total_quantity',
      width: 100,
      align: 'right',
    },
    {
      title: '入库品种',
      dataIndex: 'total_items',
      width: 100,
      align: 'right',
    },
    {
      title: '入库仓库',
      dataIndex: 'warehouse_name',
      width: 120,
      ellipsis: true,
    },
    {
      title: '操作员',
      dataIndex: ['received_by', 'returner_name'],
      width: 100,
      ellipsis: true,
      render: (_, record) => record.received_by || record.returner_name || '-',
    },
    {
      title: '日期',
      dataIndex: ['receipt_date', 'return_time'],
      width: 160,
      render: (_, record) => record.receipt_date || record.return_time || '-',
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      valueType: 'dateTime',
      width: 160,
    },
    {
      title: '操作',
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleDetail(record)}
          >
            详情
          </Button>
          {(record.status === 'draft' || record.status === '草稿' || record.status === '待入库' || record.status === '待退料') && (
            <>
              <Button
                type="link"
                size="small"
                icon={<CheckCircleOutlined />}
                onClick={() => handleConfirm(record)}
                style={{ color: '#52c41a' }}
              >
                {record.receipt_type === 'production_return' ? '确认退料' : '确认入库'}
              </Button>
              {record.receipt_type === 'production_return' && (
                <Button
                  type="link"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => handleDelete(record)}
                >
                  删除
                </Button>
              )}
            </>
          )}
        </Space>
      ),
    },
  ];

  const handleFormFinish = async (values: any) => {
    try {
      if (values.type === 'purchase' || inboundType === 'purchase') {
        const items = (values.items ?? []).filter(
          (it: any) => it.material_id && (Number(it.receipt_quantity) || 0) > 0
        );
        if (items.length === 0) {
          messageApi.warning('请至少添加一条有效物料明细');
          throw new Error('请至少添加一条有效物料明细');
        }
        const wh = createWarehouseOptions.find((w) => w.value === values.warehouse_id);
        const sup = supplierOptions.find((s) => s.value === values.supplier_id);
        if (!wh || !sup) {
          messageApi.warning('请选择入库仓库和供应商');
          throw new Error('请选择入库仓库和供应商');
        }
        const payload = {
          receipt_code: values.receipt_code || undefined,
          purchase_order_id: values.purchase_order_id ?? 0,
          purchase_order_code: values.purchase_order_code || '手动',
          supplier_id: sup.value,
          supplier_name: sup.name,
          warehouse_id: wh.value,
          warehouse_name: wh.name,
          notes: values.notes,
          items: items.map((it: any) => ({
            purchase_order_item_id: it.purchase_order_item_id ?? 0,
            material_id: it.material_id,
            material_code: it.material_code,
            material_name: it.material_name,
            material_spec: it.material_spec || undefined,
            material_unit: it.material_unit || '个',
            receipt_quantity: Number(it.receipt_quantity) || 0,
            unit_price: Number(it.unit_price) || 0,
            qualified_quantity: Number(it.qualified_quantity) ?? Number(it.receipt_quantity) ?? 0,
            unqualified_quantity: Number(it.unqualified_quantity) ?? 0,
          })),
        };
        await warehouseApi.purchaseReceipt.create(payload);
      }
      messageApi.success('入库单创建成功');
      setCreateModalVisible(false);
      formRef.current?.resetFields();
      actionRef.current?.reload();
    } catch (error: any) {
      if (error?.message !== '请至少添加一条有效物料明细') {
        messageApi.error(error?.message || error?.response?.data?.detail || '操作失败');
      }
      throw error;
    }
  };

  return (
    <ListPageTemplate>
      <UniTable
        headerTitle="入库管理"
        actionRef={actionRef}
        rowKey={(record) => `${record.receipt_type}::${record.id}`}
        columns={columns}
        showAdvancedSearch={true}
        request={async (params) => {
          try {
            const skip = ((params.current || 1) - 1) * (params.pageSize || 20);
            const limit = params.pageSize || 20;
            const listParams = { skip, limit, ...params };

            // 并行获取采购入库单、成品入库单、生产退料单
            const [purchaseRes, finishedRes, returnRes] = await Promise.all([
              warehouseApi.purchaseReceipt.list(listParams),
              warehouseApi.finishedGoodsReceipt.list(listParams),
              warehouseApi.productionReturn.list(listParams),
            ]);

            // 后端可能直接返回数组，或 { data/items: [] } 格式
            const toList = (r: any) => (Array.isArray(r) ? r : r?.data ?? r?.items ?? []);
            const purchaseData = toList(purchaseRes).map((item: any) => ({
              ...item,
              receipt_type: 'purchase' as const,
            }));
            const finishedData = toList(finishedRes).map((item: any) => ({
              ...item,
              receipt_type: 'finished_goods' as const,
            }));
            const returnData = toList(returnRes).map((item: any) => ({
              ...item,
              receipt_type: 'production_return' as const,
              receipt_code: item.return_code,
            }));

            const combinedData = [...purchaseData, ...finishedData, ...returnData];
            combinedData.sort((a, b) => new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime());

            const total =
              (typeof purchaseRes?.total === 'number' ? purchaseRes.total : purchaseData.length) +
              (typeof finishedRes?.total === 'number' ? finishedRes.total : finishedData.length) +
              (typeof returnRes?.total === 'number' ? returnRes.total : returnData.length);

            return {
              data: combinedData,
              success: true,
              total,
            };
          } catch (error) {
            messageApi.error('获取入库单列表失败');
            return { data: [], success: false, total: 0 };
          }
        }}
        enableRowSelection={true}
        showDeleteButton={true}
        onDelete={async (keys) => {
          Modal.confirm({
            title: '确认批量删除',
            content: `确定要删除选中的 ${keys.length} 条入库单吗？`,
            onOk: async () => {
              try {
                for (const key of keys) {
                  const [type, id] = String(key).split('::');
                  if (type === 'purchase') {
                    await warehouseApi.purchaseReceipt.delete(id);
                  } else if (type === 'finished_goods') {
                    await warehouseApi.finishedGoodsReceipt.delete(id);
                  } else if (type === 'production_return') {
                    await warehouseApi.productionReturn.delete(id);
                  }
                }
                messageApi.success(`成功删除 ${keys.length} 条记录`);
                actionRef.current?.reload();
              } catch (error: any) {
                messageApi.error(error?.message || '删除失败');
              }
            },
          });
        }}
        toolBarRender={() => [
          <Button
            key="create"
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreate}
          >
            {'新建入库单' + NEW_SHORTCUT_HINT}
          </Button>,
          <Button
            key="batch"
            icon={<InboxOutlined />}
            onClick={() => {
              batchForm.resetFields();
              setBatchInboundType('finished_goods');
              setBatchModalVisible(true);
            }}
          >
            批量入库
          </Button>,
        ]}
      />

      <FormModalTemplate
        title="新建入库单"
        open={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        onFinish={handleFormFinish}
        isEdit={false}
        initialValues={{ type: 'purchase' }}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        formRef={formRef}
        grid={false}
      >
        <Row gutter={16}>
          <Col span={12}>
            {inboundType === 'purchase' && (
              <CodeField
                pageCode="kuaizhizao-purchase-receipt"
                name="receipt_code"
                label="采购入库单编号"
                required={true}
                autoGenerateOnCreate={true}
                showGenerateButton={false}
                context={{}}
              />
            )}
            {(inboundType === 'production' || inboundType === 'initial') && (
              <CodeField
                pageCode="kuaizhizao-warehouse-finished-goods-inbound"
                name="receipt_code"
                label="成品入库单编号"
                required={true}
                autoGenerateOnCreate={true}
                showGenerateButton={false}
                context={{}}
              />
            )}
          </Col>
          <Col span={12}>
            <ProFormSelect
              name="type"
              label="入库类型"
              placeholder="请选择入库类型"
              rules={[{ required: true, message: '请选择入库类型' }]}
              options={[
                { label: '采购入库', value: 'purchase' },
                { label: '生产入库', value: 'production' },
                { label: '退货入库', value: 'return' },
                { label: '初始入库', value: 'initial' },
              ]}
              fieldProps={{
                onChange: (value: string) => setInboundType(value),
              }}
            />
          </Col>
        </Row>
        {inboundType === 'purchase' && (
          <>
            <Row gutter={16}>
              <Col span={8}>
                <ProFormSelect
                  name="source_type"
                  label="源单据类型"
                  initialValue="purchase_order"
                  options={[
                    { label: '采购单', value: 'purchase_order' },
                    { label: '收货通知单', value: 'receipt_notice' },
                  ]}
                  fieldProps={{
                    onChange: (v: 'purchase_order' | 'receipt_notice') => {
                      setPurchaseSourceType(v);
                      formRef.current?.setFieldsValue?.({ source_id: undefined });
                    },
                  }}
                />
              </Col>
              <Col span={10}>
                <ProFormSelect
                  name="source_id"
                  label="选择源单据"
                  placeholder={purchaseSourceType === 'purchase_order' ? '请选择采购单' : '请选择收货通知单'}
                  options={purchaseSourceOptions}
                  fieldProps={{
                    loading: sourceLoading,
                    showSearch: true,
                    filterOption: (i: any, o: any) => (o?.label ?? '').toString().toLowerCase().includes((i ?? '').toLowerCase()),
                  }}
                />
              </Col>
              <Col span={6}>
                <ProFormItem label=" " style={{ marginBottom: 0 }}>
                  <Button onClick={loadPurchaseBySource} loading={sourceLoading} style={{ width: '100%' }}>
                    载入源单据
                  </Button>
                </ProFormItem>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={12}>
                <ProFormSelect
                  name="warehouse_id"
                  label="入库仓库"
                  placeholder="请选择入库仓库"
                  rules={[{ required: true, message: '请选择入库仓库' }]}
                  options={createWarehouseOptions}
                  fieldProps={{ showSearch: true, filterOption: (i: any, o: any) => (o?.label ?? '').toString().toLowerCase().includes((i ?? '').toLowerCase()) }}
                />
              </Col>
              <Col span={12}>
                <ProFormSelect
                  name="supplier_id"
                  label="供应商"
                  placeholder="请选择供应商"
                  rules={[{ required: true, message: '请选择供应商' }]}
                  options={supplierOptions}
                  fieldProps={{ showSearch: true, filterOption: (i: any, o: any) => (o?.label ?? '').toString().toLowerCase().includes((i ?? '').toLowerCase()) }}
                />
              </Col>
            </Row>
            <ProFormItem label="入库明细" required style={{ width: '100%' }}>
              <AntForm.List name="items" initialValue={[defaultPurchaseItem]}>
                {(fields, { add, remove }) => (
                    <div>
                      <Table
                        size="small"
                        pagination={false}
                        scroll={{ x: 700 }}
                        dataSource={fields}
                        rowKey={(field) => field.key}
                        columns={[
                          {
                            title: '物料',
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
                            title: '单位',
                            dataIndex: 'material_unit',
                            width: 100,
                            render: (_: any, __: any, index: number) => (
                              <AntForm.Item noStyle shouldUpdate={(prev, curr) => prev?.items?.[index]?.material_id !== curr?.items?.[index]?.material_id}>
                                {({ getFieldValue }) => {
                                  const materialId = getFieldValue(['items', index, 'material_id']);
                                  return (
                                    <AntForm.Item name={[index, 'material_unit']} style={{ margin: 0 }}>
                                      <MaterialUnitSelect 
                                        materialId={materialId} 
                                        size="small" 
                                        noStyle 
                                      />
                                    </AntForm.Item>
                                  );
                                }}
                              </AntForm.Item>
                            ),
                          },
                          {
                            title: '数量',
                            dataIndex: 'receipt_quantity',
                            width: 100,
                            render: (_: any, __: any, index: number) => (
                              <AntForm.Item noStyle name={[index, 'receipt_quantity']} rules={[{ required: true, message: '必填' }, { type: 'number', min: 0.01, message: '>0' }]}>
                                <InputNumber placeholder="数量" min={0} precision={2} style={{ width: '100%' }} size="small" />
                              </AntForm.Item>
                            ),
                          },
                          {
                            title: '单价',
                            dataIndex: 'unit_price',
                            width: 100,
                            render: (_: any, __: any, index: number) => (
                              <AntForm.Item noStyle name={[index, 'unit_price']}>
                                <InputNumber placeholder="0" min={0} precision={2} style={{ width: '100%' }} size="small" />
                              </AntForm.Item>
                            ),
                          },
                          {
                            title: '操作',
                            width: 60,
                            render: (_: any, __: any, index: number) => (
                              <Button type="link" danger size="small" icon={<DeleteOutlined />} onClick={() => remove(index)} disabled={fields.length <= 1} />
                            ),
                          },
                        ]}
                      />
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', width: '100%', marginTop: 8 }}>
                        <Button type="dashed" icon={<PlusOutlined />} style={{ flex: 1, minWidth: 120 }} onClick={() => add(defaultPurchaseItem)}>
                          添加明细
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
                    </div>
                  )}
                </AntForm.List>
              </ProFormItem>
            <ProFormItem name="notes" label="备注">
              <Input.TextArea rows={2} placeholder="可选" />
            </ProFormItem>
          </>
        )}
        {(inboundType === 'production' || inboundType === 'initial' || inboundType === 'return') && (
          <>
            <Row gutter={16}>
              <Col span={12}>
                <ProFormSelect
                  name="warehouse"
                  label="入库仓库"
                  placeholder="请选择入库仓库"
                  rules={[{ required: true, message: '请选择入库仓库' }]}
                  options={[
                    { label: '原材料仓库', value: 'raw-materials' },
                    { label: '半成品仓库', value: 'semi-finished' },
                    { label: '成品仓库', value: 'finished-goods' },
                  ]}
                />
              </Col>
              <Col span={12}>
                <ProFormText name="supplier" label="供应商" placeholder="选择供应商" />
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={12}>
                <ProFormText name="workOrder" label="关联工单" placeholder="选择工单" />
              </Col>
              <Col span={12}>
                <ProFormText
                  name="batch_number"
                  label="批号"
                  placeholder="请输入批号（批号管理物料必填）"
                  tooltip="如果所选物料启用了批号管理，此字段为必填"
                />
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={12}>
                <ProFormDatePicker
                  name="expiry_date"
                  label="有效期"
                  placeholder="请选择有效期"
                  tooltip="有保质期要求的物料需要填写有效期"
                />
              </Col>
              <Col span={12} />
            </Row>
          </>
        )}
      </FormModalTemplate>

      <MaterialBatchPickerModal
        open={materialPickerOpen}
        onCancel={() => setMaterialPickerOpen(false)}
        onConfirm={appendPurchaseInboundItemsFromMaterials}
      />

      <Modal
        title="批量入库"
        open={batchModalVisible}
        onCancel={() => setBatchModalVisible(false)}
        onOk={handleBatchSubmit}
        confirmLoading={batchSubmitting}
        width={520}
        okText="确认入库"
      >
        <p style={{ marginBottom: 16, color: '#666' }}>
          根据上游单据批量创建入库单。成品入库：从工单下推；采购入库：从采购订单下推。
        </p>
        <AntForm form={batchForm} layout="vertical" initialValues={{ batch_inbound_type: 'finished_goods' }}>
          <AntForm.Item
            name="batch_inbound_type"
            label="入库类型"
            rules={[{ required: true }]}
          >
            <ProFormSelect
              options={[
                { label: '成品入库（从工单）', value: 'finished_goods' },
                { label: '采购入库（从采购订单）', value: 'purchase' },
              ]}
              fieldProps={{
                onChange: (v: string) => setBatchInboundType(v as 'finished_goods' | 'purchase'),
              }}
            />
          </AntForm.Item>
          {batchInboundType === 'finished_goods' && (
            <>
              <AntForm.Item
                name="work_order_ids"
                label="选择工单"
                rules={[{ required: true, message: '请选择至少一个工单' }]}
              >
                <ProFormSelect
                  mode="multiple"
                  placeholder="请选择工单（进行中/已完成且有报工）"
                  options={workOrderOptions}
                  fieldProps={{ showSearch: true, filterOption: (input, opt) => (opt?.label ?? '').toString().toLowerCase().includes(input.toLowerCase()) }}
                />
              </AntForm.Item>
              <AntForm.Item
                name="warehouse_id"
                label="入库仓库"
                rules={[{ required: true, message: '请选择入库仓库' }]}
              >
                <ProFormSelect
                  placeholder="请选择仓库"
                  options={warehouseOptions}
                  fieldProps={{ showSearch: true, filterOption: (input, opt) => (opt?.label ?? '').toString().toLowerCase().includes(input.toLowerCase()) }}
                />
              </AntForm.Item>
            </>
          )}
          {batchInboundType === 'purchase' && (
            <AntForm.Item
              name="purchase_order_ids"
              label="选择采购订单"
              rules={[{ required: true, message: '请选择至少一个采购订单' }]}
            >
              <ProFormSelect
                mode="multiple"
                placeholder="请选择采购订单（已审核/已确认且有未入库数量）"
                options={purchaseOrderOptions}
                fieldProps={{ showSearch: true, filterOption: (input, opt) => (opt?.label ?? '').toString().toLowerCase().includes(input.toLowerCase()) }}
              />
            </AntForm.Item>
          )}
        </AntForm>
      </Modal>

      <DetailDrawerTemplate
        title={`${currentOrder?.receipt_type === 'production_return' ? '生产退料单' : '入库单'}详情 - ${currentOrder?.receipt_code || currentOrder?.return_code || ''}`}
        open={detailDrawerVisible}
        onClose={() => {
          setDetailDrawerVisible(false);
          setEditableReceiptQuantities({});
        }}
        width={DRAWER_CONFIG.HALF_WIDTH}
        columns={[]}
        extra={
          currentOrder && (currentOrder.status === 'draft' || currentOrder.status === '待退料' || currentOrder.status === '草稿' || currentOrder.status === '待入库') && (
            <Space>
              {isEditablePurchaseReceipt(currentOrder) && (
                <Button onClick={handleSavePurchaseReceiptQuantities} loading={savingPurchaseReceipt}>
                  保存实际数量
                </Button>
              )}
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                onClick={() => handleConfirm(currentOrder)}
              >
                {currentOrder.receipt_type === 'production_return' ? '确认退料' : '确认入库'}
              </Button>
            </Space>
          )
        }
        customContent={
          currentOrder ? (
            <div style={{ padding: '16px 0' }}>
              <Card title="基本信息" style={{ marginBottom: 16 }}>
                <p><strong>单号：</strong>{currentOrder.receipt_code || currentOrder.return_code}</p>
                <p><strong>类型：</strong>
                  <Tag color={
                    currentOrder.receipt_type === 'purchase' ? 'processing' :
                      currentOrder.receipt_type === 'finished_goods' ? 'success' : 'warning'
                  }>
                    {currentOrder.receipt_type === 'purchase' ? '采购入库' : currentOrder.receipt_type === 'finished_goods' ? '成品入库' : '生产退料'}
                  </Tag>
                </p>
                <p><strong>状态：</strong>
                  <Tag color={
                    (currentOrder.status === '已完成' || currentOrder.status === '已退料') ? 'success' :
                      (currentOrder.status === '已确认' || currentOrder.status === '待退料') ? 'processing' :
                        currentOrder.status === '已取消' ? 'error' : 'default'
                  }>
                    {currentOrder.status}
                  </Tag>
                </p>
                {currentOrder.supplier_name && (
                  <p><strong>供应商：</strong>{currentOrder.supplier_name}</p>
                )}
                {currentOrder.work_order_code && (
                  <p><strong>工单号：</strong>{currentOrder.work_order_code}</p>
                )}
                {currentOrder.picking_code && (
                  <p><strong>领料单号：</strong>{currentOrder.picking_code}</p>
                )}
                {currentOrder.workshop_name && (
                  <p><strong>车间：</strong>{currentOrder.workshop_name}</p>
                )}
                <p><strong>仓库：</strong>{currentOrder.warehouse_name}</p>
                <p><strong>日期：</strong>{currentOrder.receipt_date || currentOrder.return_time}</p>
                <p><strong>操作员：</strong>{currentOrder.received_by || currentOrder.returner_name}</p>
                {currentOrder.notes && (
                  <p><strong>备注：</strong>{currentOrder.notes}</p>
                )}
              </Card>

              {/* 生命周期 */}
              <DetailDrawerSection title="生命周期">
                {(() => {
                  const lifecycle = getInboundLifecycle(currentOrder);
                  const mainStages = lifecycle.mainStages ?? [];
                  if (mainStages.length === 0) return null;
                  return (
                    <UniLifecycleStepper
                      steps={mainStages}
                      status={lifecycle.status}
                      showLabels
                      nextStepSuggestions={lifecycle.nextStepSuggestions}
                    />
                  );
                })()}
              </DetailDrawerSection>

              {/* 入库/退料明细 - 始终显示，有数据时展示表格，无数据时展示空状态 */}
              <Card title={currentOrder.receipt_type === 'production_return' ? '退料明细' : '入库明细'}>
                {currentOrder.items && currentOrder.items.length > 0 ? (
                  <>
                    <style>{WAREHOUSE_DETAIL_TABLE_STYLES}</style>
                    <Table
                      className="warehouse-detail-table"
                      size="small"
                      rowKey={(r) => r.id ?? r.material_id ?? Math.random()}
                      pagination={false}
                      columns={currentOrder.receipt_type === 'production_return'
                        ? [
                            { title: '物料编号', dataIndex: 'material_code', width: 120 },
                            { title: '物料名称', dataIndex: 'material_name', width: 150 },
                            { title: '单位', dataIndex: 'material_unit', width: 60, render: (val) => <DictionaryLabel dictionaryCode="unit" value={val} /> },
                            { title: '退料数量', dataIndex: 'return_quantity', width: 100, align: 'right' as const },
                            { title: '仓库', dataIndex: 'warehouse_name', width: 120 },
                            { title: '批次号', dataIndex: 'batch_number', width: 100 },
                          ]
                        : currentOrder.receipt_type === 'purchase'
                          ? [
                              { title: '物料编号', dataIndex: 'material_code', width: 120 },
                              { title: '物料名称', dataIndex: 'material_name', width: 150 },
                              {
                                title: '实际数量',
                                dataIndex: 'receipt_quantity',
                                width: 140,
                                align: 'right' as const,
                                render: (_: any, row: InboundOrderItem) => {
                                  const editable = isEditablePurchaseReceipt(currentOrder) && row.id != null;
                                  if (!editable) return Number(row.receipt_quantity ?? 0);
                                  const rid = Number(row.id);
                                  return (
                                    <InputNumber
                                      min={0.01}
                                      precision={2}
                                      value={editableReceiptQuantities[rid] ?? Number(row.receipt_quantity ?? 0)}
                                      onChange={(v) => setEditableReceiptQuantities((prev) => ({ ...prev, [rid]: Number(v) || 0 }))}
                                      style={{ width: 110 }}
                                      size="small"
                                    />
                                  );
                                },
                              },
                              { title: '单位', dataIndex: 'material_unit', width: 60, render: (val: any) => <DictionaryLabel dictionaryCode="unit" value={val} /> },
                              { title: '单价', dataIndex: 'unit_price', width: 90, align: 'right' as const },
                              { title: '金额', dataIndex: 'total_amount', width: 100, align: 'right' as const },
                              { title: '批次号', dataIndex: 'batch_number', width: 100 },
                            ]
                          : [
                              { title: '物料编号', dataIndex: 'material_code', width: 120 },
                              { title: '物料名称', dataIndex: 'material_name', width: 150 },
                              { title: '数量', dataIndex: 'receipt_quantity', width: 100, align: 'right' as const },
                              { title: '单位', dataIndex: 'material_unit', width: 60 },
                              { title: '批次号', dataIndex: 'batch_number', width: 100 },
                            ]
                      }
                      dataSource={currentOrder.items}
                    />
                  </>
                ) : (
                  <div style={{ padding: '24px 0', color: '#999', textAlign: 'center' }}>暂无物料明细</div>
                )}
              </Card>

              {/* 操作记录 */}
              {currentOrder?.id && (
                <DetailDrawerSection title="操作记录">
                  <DocumentTrackingPanel
                    documentType={
                      currentOrder.receipt_type === 'purchase'
                        ? 'purchase_receipt'
                        : currentOrder.receipt_type === 'finished_goods'
                          ? 'finished_goods_receipt'
                          : 'production_return'
                    }
                    documentId={currentOrder.id}
                  />
                </DetailDrawerSection>
              )}
            </div>
          ) : null
        }
      />
    </ListPageTemplate>
  );
};

export default InboundPage;
