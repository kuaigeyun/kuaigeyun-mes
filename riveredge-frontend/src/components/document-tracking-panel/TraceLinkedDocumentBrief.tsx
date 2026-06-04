/**
 * 全链路节点点击后的关联单据简览：基本信息 + 明细表（按需拉取详情接口）
 */

import React, { useMemo } from 'react';
import { Descriptions, Empty, Spin, Table, Typography, Button, Space, Divider, theme } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useRequest } from 'ahooks';
import { useTranslation } from 'react-i18next';
import { getQuotation } from '../../apps/kuaizhizao/services/quotation';
import { getSalesOrder } from '../../apps/kuaizhizao/services/sales-order';
import { getDemand } from '../../apps/kuaizhizao/services/demand';
import { getDemandComputation } from '../../apps/kuaizhizao/services/demand-computation';
import { workOrderApi } from '../../apps/kuaizhizao/services/production';
import { getPurchaseOrder } from '../../apps/kuaizhizao/services/purchase';
import { getPurchaseRequisition } from '../../apps/kuaizhizao/services/purchase-requisition';
import { warehouseApi } from '../../apps/kuaizhizao/services/warehouse-execution';
import { reportingApi } from '../../apps/kuaizhizao/services/reporting';
import { apiRequest } from '../../services/api';
import { receiptService } from '../../apps/kuaicaiwu/services/finance/receipt';
import { receivableService } from '../../apps/kuaicaiwu/services/finance/receivable';
import { payableService } from '../../apps/kuaicaiwu/services/finance/payable';
import { purchaseInvoiceService } from '../../apps/kuaicaiwu/services/finance/purchase-invoice';
import { AmountDisplay } from '../permission';
import {
  KUAIZHIZAO_SALES_ORDER_FIELD_RESOURCE as SO,
  KUAIZHIZAO_QUOTATION_FIELD_RESOURCE as QO,
  KUAIZHIZAO_DEMAND_FIELD_RESOURCE as DEM,
  KUAIZHIZAO_PURCHASE_ORDER_FIELD_RESOURCE as PO,
  KUAIZHIZAO_PURCHASE_REQUISITION_FIELD_RESOURCE as PR,
  KUAICAIWU_RECEIVABLE_FIELD_RESOURCE as AR,
  KUAICAIWU_PAYABLE_FIELD_RESOURCE as AP,
  KUAICAIWU_SALES_INVOICE_FIELD_RESOURCE as SI,
  KUAICAIWU_RECEIPT_FIELD_RESOURCE as RC,
  KUAICAIWU_PURCHASE_INVOICE_FIELD_RESOURCE as PI,
  KUAICAIWU_PAYMENT_FIELD_RESOURCE as PAY,
} from '../../constants/fieldPermissionResources';
import { getMaterialUnitDisplayMapShared, resolveMaterialUnitLabel } from '../../utils/materialUnitDisplay';
import { getStatusLabel } from '../../apps/kuaizhizao/constants/documentStatus';
import { getDemandBusinessModeLabel } from '../../apps/kuaizhizao/utils/businessMode';
import { getDemandTypeLabel } from '../../apps/kuaizhizao/utils/demandType';
import { getDemandComputationLifecycle } from '../../apps/kuaizhizao/utils/demandComputationLifecycle';

const { useToken } = theme;

export interface TraceLinkedDocumentBriefProps {
  documentType?: string;
  documentId?: number;
  /** 在销售订单简览中打开宿主详情抽屉（如报价单页的关联订单抽屉） */
  onOpenSalesOrderDetail?: (id: number) => void;
  /** 嵌入 Modal 时隐藏顶部类型标题与内联「打开销售订单」链式按钮，由外层底部操作区承接 */
  compactChrome?: boolean;
}

interface BriefModel {
  basics: { key: string; label: string; value: React.ReactNode }[];
  columns: ColumnsType<Record<string, unknown>>;
  rows: Record<string, unknown>[];
}

function dash(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  return String(v);
}

/** 主状态码 / 中文态 → 与列表、详情一致的展示文案（依赖 enums 缓存 + fallback） */
function briefDocStatus(raw: unknown): string {
  if (raw === null || raw === undefined || raw === '') return '—';
  const label = getStatusLabel(String(raw).trim());
  return label === '-' ? '—' : label;
}

function briefComputationStatus(c: {
  computation_status?: string;
  lifecycle?: unknown;
}): string {
  const lc = getDemandComputationLifecycle(c);
  const name = (lc.stageName ?? '').trim();
  if (name && name !== '-') return name;
  return briefDocStatus(c.computation_status);
}

function briefMaterialSourceType(raw: unknown): string {
  const map: Record<string, string> = {
    Make: '自制',
    Buy: '采购',
    Phantom: '虚拟',
    Outsource: '委外',
    Configure: '配置',
  };
  const t = String(raw ?? '').trim();
  if (!t) return '—';
  return map[t] ?? t;
}

function briefBusinessMode(raw: unknown): string {
  const s = getDemandBusinessModeLabel(raw === null || raw === undefined ? undefined : String(raw));
  return s === '-' ? '—' : s;
}

function briefAmount(resource: string, fieldName: string, value: unknown): React.ReactNode {
  if (value == null || value === '') return '—';
  return <AmountDisplay resource={resource} fieldName={fieldName} value={Number(value)} />;
}

async function loadBrief(documentType: string, documentId: number): Promise<BriefModel> {
  const unitMap = await getMaterialUnitDisplayMapShared();
  const unitCell = (code: unknown) => {
    const s = resolveMaterialUnitLabel(code, unitMap);
    return s === '' ? '—' : s;
  };

  switch (documentType) {
    case 'quotation': {
      const q = await getQuotation(documentId, true);
      const basics: BriefModel['basics'] = [
        { key: 'code', label: '单据编号', value: dash(q.quotation_code) },
        { key: 'customer', label: '客户', value: dash(q.customer_name) },
        { key: 'status', label: '状态', value: briefDocStatus(q.status) },
        { key: 'date', label: '报价日期', value: dash(q.quotation_date) },
        { key: 'amount', label: '总金额', value: briefAmount(QO, 'total_amount', q.total_amount) },
      ];
      const rows = (q.items ?? []).map((it, i) => ({
        key: String(it.id ?? i),
        material_code: it.material_code,
        material_name: it.material_name,
        material_spec: it.material_spec,
        qty: it.quote_quantity,
        unit: unitCell(it.material_unit),
        unit_price: it.unit_price,
        amount: it.total_amount ?? (Number(it.quote_quantity || 0) * Number(it.unit_price || 0) || undefined),
        delivery_date: it.delivery_date,
      }));
      const columns: BriefModel['columns'] = [
        { title: '物料编码', dataIndex: 'material_code', ellipsis: true },
        { title: '物料名称', dataIndex: 'material_name', ellipsis: true },
        { title: '规格', dataIndex: 'material_spec', ellipsis: true },
        {
          title: '数量',
          dataIndex: 'qty',
          width: 88,
          render: (v: number) => (v != null ? Number(v).toFixed(4).replace(/\.?0+$/, '') : '—'),
        },
        { title: '单位', dataIndex: 'unit', width: 64 },
        {
          title: '单价',
          dataIndex: 'unit_price',
          width: 96,
          render: (v: number) => briefAmount(QO, 'unit_price', v),
        },
        {
          title: '金额',
          dataIndex: 'amount',
          width: 104,
          render: (v: number) => briefAmount(QO, 'amount', v),
        },
        { title: '交期', dataIndex: 'delivery_date', width: 108, render: (v: string) => dash(v) },
      ];
      return { basics, columns, rows };
    }
    case 'sales_order': {
      const o = await getSalesOrder(documentId, true, false);
      const basics: BriefModel['basics'] = [
        { key: 'code', label: '单据编号', value: dash(o.order_code) },
        { key: 'customer', label: '客户', value: dash(o.customer_name) },
        { key: 'status', label: '状态', value: briefDocStatus(o.status) },
        { key: 'date', label: '订单日期', value: dash(o.order_date) },
        { key: 'amount', label: '总金额', value: briefAmount(SO, 'total_amount', o.total_amount) },
      ];
      const rows = (o.items ?? []).map((it, i) => ({
        key: String(it.id ?? i),
        material_code: it.material_code,
        material_name: it.material_name,
        material_spec: it.material_spec,
        qty: it.required_quantity,
        unit: unitCell(it.material_unit),
        unit_price: it.unit_price,
        amount: it.item_amount,
        delivery_date: it.delivery_date,
      }));
      const columns: BriefModel['columns'] = [
        { title: '物料编码', dataIndex: 'material_code', ellipsis: true },
        { title: '物料名称', dataIndex: 'material_name', ellipsis: true },
        { title: '规格', dataIndex: 'material_spec', ellipsis: true },
        {
          title: '数量',
          dataIndex: 'qty',
          width: 88,
          render: (v: number) => (v != null ? Number(v).toFixed(4).replace(/\.?0+$/, '') : '—'),
        },
        { title: '单位', dataIndex: 'unit', width: 64 },
        {
          title: '单价',
          dataIndex: 'unit_price',
          width: 96,
          render: (v: number) => briefAmount(SO, 'unit_price', v),
        },
        {
          title: '金额',
          dataIndex: 'amount',
          width: 104,
          render: (v: number) => briefAmount(SO, 'amount_with_tax', v),
        },
        { title: '交期', dataIndex: 'delivery_date', width: 108, render: (v: string) => dash(v) },
      ];
      return { basics, columns, rows };
    }
    case 'demand': {
      const d = await getDemand(documentId, true, false);
      const basics: BriefModel['basics'] = [
        { key: 'code', label: '单据编号', value: dash(d.demand_code) },
        { key: 'type', label: '需求类型', value: dash(getDemandTypeLabel(d.demand_type)) },
        { key: 'customer', label: '客户', value: dash(d.customer_name) },
        { key: 'status', label: '状态', value: briefDocStatus(d.status) },
        { key: 'delivery', label: '交期', value: dash(d.delivery_date) },
      ];
      const rows = (d.items ?? []).map((it, i) => ({
        key: String(it.id ?? i),
        material_code: it.material_code,
        material_name: it.material_name,
        material_spec: it.material_spec,
        qty: it.required_quantity,
        unit: unitCell(it.material_unit),
        unit_price: it.unit_price,
        amount: it.item_amount,
        delivery_date: it.delivery_date,
      }));
      const columns: BriefModel['columns'] = [
        { title: '物料编码', dataIndex: 'material_code', ellipsis: true },
        { title: '物料名称', dataIndex: 'material_name', ellipsis: true },
        { title: '规格', dataIndex: 'material_spec', ellipsis: true },
        {
          title: '数量',
          dataIndex: 'qty',
          width: 88,
          render: (v: number) => (v != null ? Number(v).toFixed(4).replace(/\.?0+$/, '') : '—'),
        },
        { title: '单位', dataIndex: 'unit', width: 64 },
        {
          title: '单价',
          dataIndex: 'unit_price',
          width: 96,
          render: (v: number) => briefAmount(DEM, 'unit_price', v),
        },
        {
          title: '金额',
          dataIndex: 'amount',
          width: 104,
          render: (v: number) => briefAmount(DEM, 'amount_with_tax', v),
        },
        { title: '交期', dataIndex: 'delivery_date', width: 108, render: (v: string) => dash(v) },
      ];
      return { basics, columns, rows };
    }
    case 'demand_computation': {
      const c = await getDemandComputation(documentId, true);
      const basics: BriefModel['basics'] = [
        { key: 'code', label: '计算单号', value: dash(c.computation_code) },
        { key: 'demand', label: '需求', value: dash(c.demand_code) },
        { key: 'status', label: '状态', value: briefComputationStatus(c) },
        { key: 'mode', label: '业务模式', value: briefBusinessMode(c.business_mode) },
      ];
      const rows = (c.items ?? []).map((it, i) => ({
        key: String(it.id ?? i),
        material_code: it.material_code,
        material_name: it.material_name,
        material_spec: it.material_spec,
        net_requirement: it.net_requirement,
        unit: unitCell(it.material_unit),
        source: briefMaterialSourceType(it.material_source_type),
        delivery_date: it.delivery_date,
      }));
      const columns: BriefModel['columns'] = [
        { title: '物料编码', dataIndex: 'material_code', ellipsis: true },
        { title: '物料名称', dataIndex: 'material_name', ellipsis: true },
        { title: '规格', dataIndex: 'material_spec', ellipsis: true },
        {
          title: '净需求',
          dataIndex: 'net_requirement',
          width: 96,
          render: (v: number) => (v != null ? Number(v).toFixed(4).replace(/\.?0+$/, '') : '—'),
        },
        { title: '单位', dataIndex: 'unit', width: 64 },
        { title: '来源', dataIndex: 'source', width: 88 },
        { title: '交期', dataIndex: 'delivery_date', width: 108, render: (v: string) => dash(v) },
      ];
      return { basics, columns, rows };
    }
    case 'work_order': {
      const w = await workOrderApi.get(String(documentId));
      const basics: BriefModel['basics'] = [
        { key: 'code', label: '工单号', value: dash(w.code) },
        { key: 'name', label: '名称', value: dash(w.name) },
        { key: 'product', label: '产品', value: dash(w.product_name ?? w.product_code) },
        { key: 'status', label: '状态', value: briefDocStatus(w.status) },
        { key: 'qty', label: '数量', value: w.quantity != null ? String(w.quantity) : '—' },
        { key: 'so', label: '销售订单', value: dash(w.sales_order_code) },
      ];
      const rows = [
        {
          key: 'wo-product',
          material_code: w.product_code,
          material_name: w.product_name,
          qty: w.quantity,
        },
      ];
      const columns: BriefModel['columns'] = [
        { title: '产品编码', dataIndex: 'material_code', ellipsis: true },
        { title: '产品名称', dataIndex: 'material_name', ellipsis: true },
        {
          title: '数量',
          dataIndex: 'qty',
          width: 120,
          render: (v: number) => (v != null ? Number(v).toFixed(4).replace(/\.?0+$/, '') : '—'),
        },
      ];
      return { basics, columns, rows };
    }
    case 'purchase_order': {
      const p = await getPurchaseOrder(documentId);
      const basics: BriefModel['basics'] = [
        { key: 'code', label: '单据编号', value: dash(p.order_code) },
        { key: 'supplier', label: '供应商', value: dash(p.supplier_name) },
        { key: 'status', label: '状态', value: briefDocStatus(p.status) },
        { key: 'date', label: '订单日期', value: dash(p.order_date) },
        {
          key: 'amount',
          label: '总金额',
          value: briefAmount(PO, 'total_amount', p.total_amount),
        },
      ];
      const rows = (p.items ?? []).map((it, i) => ({
        key: String(it.id ?? i),
        material_code: it.material_code,
        material_name: it.material_name,
        material_spec: it.material_spec,
        qty: it.ordered_quantity,
        unit: unitCell(it.unit),
        unit_price: it.unit_price,
        amount: it.total_price,
        required_date: it.required_date,
      }));
      const columns: BriefModel['columns'] = [
        { title: '物料编码', dataIndex: 'material_code', ellipsis: true },
        { title: '物料名称', dataIndex: 'material_name', ellipsis: true },
        { title: '规格', dataIndex: 'material_spec', ellipsis: true },
        {
          title: '数量',
          dataIndex: 'qty',
          width: 88,
          render: (v: number) => (v != null ? Number(v).toFixed(4).replace(/\.?0+$/, '') : '—'),
        },
        { title: '单位', dataIndex: 'unit', width: 64 },
        {
          title: '单价',
          dataIndex: 'unit_price',
          width: 96,
          render: (v: number) => briefAmount(PO, 'unit_price', v),
        },
        {
          title: '金额',
          dataIndex: 'amount',
          width: 104,
          render: (v: number) => briefAmount(PO, 'amount', v),
        },
        { title: '要求到货', dataIndex: 'required_date', width: 108, render: (v: string) => dash(v) },
      ];
      return { basics, columns, rows };
    }
    case 'purchase_requisition': {
      const r = await getPurchaseRequisition(documentId);
      const basics: BriefModel['basics'] = [
        { key: 'code', label: '申请单号', value: dash(r.requisition_code) },
        { key: 'name', label: '主题', value: dash(r.requisition_name) },
        { key: 'status', label: '状态', value: briefDocStatus(r.status) },
        { key: 'date', label: '申请日期', value: dash(r.requisition_date) },
        { key: 'required', label: '要求到货', value: dash(r.required_date) },
        { key: 'applicant', label: '申请人', value: dash(r.applicant_name) },
        { key: 'source', label: '来源', value: dash(r.source_code || r.source_type) },
      ];
      const rows = (r.items ?? []).map((it, i) => ({
        key: String(it.id ?? i),
        material_code: it.material_code,
        material_name: it.material_name,
        material_spec: it.material_spec,
        qty: it.quantity,
        unit: unitCell(it.unit),
        unit_price: it.suggested_unit_price,
        required_date: it.required_date,
      }));
      const columns: BriefModel['columns'] = [
        { title: '物料编码', dataIndex: 'material_code', ellipsis: true },
        { title: '物料名称', dataIndex: 'material_name', ellipsis: true },
        { title: '规格', dataIndex: 'material_spec', ellipsis: true },
        {
          title: '数量',
          dataIndex: 'qty',
          width: 88,
          render: (v: number) => (v != null ? Number(v).toFixed(4).replace(/\.?0+$/, '') : '—'),
        },
        { title: '单位', dataIndex: 'unit', width: 64 },
        {
          title: '参考单价',
          dataIndex: 'unit_price',
          width: 96,
          render: (v: number) => briefAmount(PR, 'unit_price', v),
        },
        { title: '要求到货', dataIndex: 'required_date', width: 108, render: (v: string) => dash(v) },
      ];
      return { basics, columns, rows };
    }
    case 'production_picking': {
      const p = (await warehouseApi.productionPicking.get(String(documentId))) as Record<string, unknown>;
      const basics: BriefModel['basics'] = [
        { key: 'code', label: '领料单号', value: dash(p.picking_code) },
        { key: 'wo', label: '工单', value: dash(p.work_order_code) },
        { key: 'workshop', label: '车间', value: dash(p.workshop_name) },
        { key: 'status', label: '状态', value: briefDocStatus(p.status) },
        { key: 'picker', label: '领料人', value: dash(p.picker_name) },
        { key: 'review', label: '审核状态', value: briefDocStatus(p.review_status) },
      ];
      const itemArr = (Array.isArray(p.items) ? p.items : []) as Record<string, unknown>[];
      const rows = itemArr.map((it, i) => ({
        key: String(it.id ?? i),
        material_code: it.material_code,
        material_name: it.material_name,
        material_spec: it.material_spec,
        required_quantity: it.required_quantity,
        picked_quantity: it.picked_quantity,
        unit: unitCell(it.material_unit),
        warehouse_name: it.warehouse_name,
        batch_number: it.batch_number,
      }));
      const columns: BriefModel['columns'] = [
        { title: '物料编码', dataIndex: 'material_code', ellipsis: true },
        { title: '物料名称', dataIndex: 'material_name', ellipsis: true },
        { title: '规格', dataIndex: 'material_spec', ellipsis: true },
        {
          title: '需求数量',
          dataIndex: 'required_quantity',
          width: 88,
          render: (v: number) => (v != null ? Number(v).toFixed(4).replace(/\.?0+$/, '') : '—'),
        },
        {
          title: '已领数量',
          dataIndex: 'picked_quantity',
          width: 88,
          render: (v: number) => (v != null ? Number(v).toFixed(4).replace(/\.?0+$/, '') : '—'),
        },
        { title: '单位', dataIndex: 'unit', width: 64 },
        { title: '仓库', dataIndex: 'warehouse_name', width: 100, ellipsis: true },
        { title: '批号', dataIndex: 'batch_number', width: 96, render: (v: string) => dash(v) },
      ];
      return { basics, columns, rows };
    }
    case 'finished_goods_receipt': {
      const rec = (await warehouseApi.finishedGoodsReceipt.get(String(documentId))) as Record<string, unknown>;
      const basics: BriefModel['basics'] = [
        { key: 'code', label: '入库单号', value: dash(rec.receipt_code) },
        { key: 'wo', label: '工单', value: dash(rec.work_order_code) },
        { key: 'so', label: '销售订单', value: dash(rec.sales_order_code) },
        { key: 'wh', label: '仓库', value: dash(rec.warehouse_name) },
        { key: 'status', label: '状态', value: briefDocStatus(rec.status) },
        { key: 'receiver', label: '入库人', value: dash(rec.receiver_name) },
        { key: 'total', label: '总数量', value: rec.total_quantity != null ? String(rec.total_quantity) : '—' },
      ];
      const itemArr = (Array.isArray(rec.items) ? rec.items : []) as Record<string, unknown>[];
      const rows = itemArr.map((it, i) => ({
        key: String(it.id ?? i),
        material_code: it.material_code,
        material_name: it.material_name,
        material_spec: it.material_spec,
        receipt_quantity: it.receipt_quantity,
        qualified_quantity: it.qualified_quantity,
        unit: unitCell(it.material_unit),
        batch_number: it.batch_number,
        quality_status: it.quality_status,
      }));
      const columns: BriefModel['columns'] = [
        { title: '物料编码', dataIndex: 'material_code', ellipsis: true },
        { title: '物料名称', dataIndex: 'material_name', ellipsis: true },
        { title: '规格', dataIndex: 'material_spec', ellipsis: true },
        {
          title: '入库数量',
          dataIndex: 'receipt_quantity',
          width: 88,
          render: (v: number) => (v != null ? Number(v).toFixed(4).replace(/\.?0+$/, '') : '—'),
        },
        {
          title: '合格数',
          dataIndex: 'qualified_quantity',
          width: 80,
          render: (v: number) => (v != null ? Number(v).toFixed(4).replace(/\.?0+$/, '') : '—'),
        },
        { title: '单位', dataIndex: 'unit', width: 64 },
        { title: '批号', dataIndex: 'batch_number', width: 96, render: (v: string) => dash(v) },
        { title: '质量状态', dataIndex: 'quality_status', width: 88, render: (v: string) => dash(v) },
      ];
      return { basics, columns, rows };
    }
    case 'semi_finished_goods_receipt': {
      const rec = (await warehouseApi.semiFinishedGoodsReceipt.get(String(documentId))) as Record<string, unknown>;
      const basics: BriefModel['basics'] = [
        { key: 'code', label: '入库单号', value: dash(rec.receipt_code) },
        { key: 'wo', label: '工单', value: dash(rec.work_order_code) },
        { key: 'so', label: '销售订单', value: dash(rec.sales_order_code) },
        { key: 'wh', label: '仓库', value: dash(rec.warehouse_name) },
        { key: 'status', label: '状态', value: briefDocStatus(rec.status) },
        { key: 'receiver', label: '入库人', value: dash(rec.receiver_name) },
        { key: 'total', label: '总数量', value: rec.total_quantity != null ? String(rec.total_quantity) : '—' },
      ];
      const itemArr = (Array.isArray(rec.items) ? rec.items : []) as Record<string, unknown>[];
      const rows = itemArr.map((it, i) => ({
        key: String(it.id ?? i),
        material_code: it.material_code,
        material_name: it.material_name,
        material_spec: it.material_spec,
        receipt_quantity: it.receipt_quantity,
        qualified_quantity: it.qualified_quantity,
        unit: unitCell(it.material_unit),
        batch_number: it.batch_number,
        quality_status: it.quality_status,
      }));
      const columns: BriefModel['columns'] = [
        { title: '物料编码', dataIndex: 'material_code', ellipsis: true },
        { title: '物料名称', dataIndex: 'material_name', ellipsis: true },
        { title: '规格', dataIndex: 'material_spec', ellipsis: true },
        {
          title: '入库数量',
          dataIndex: 'receipt_quantity',
          width: 88,
          render: (v: number) => (v != null ? Number(v).toFixed(4).replace(/\.?0+$/, '') : '—'),
        },
        {
          title: '合格数',
          dataIndex: 'qualified_quantity',
          width: 80,
          render: (v: number) => (v != null ? Number(v).toFixed(4).replace(/\.?0+$/, '') : '—'),
        },
        { title: '单位', dataIndex: 'unit', width: 64 },
        { title: '批号', dataIndex: 'batch_number', width: 96, render: (v: string) => dash(v) },
        { title: '质量状态', dataIndex: 'quality_status', width: 88, render: (v: string) => dash(v) },
      ];
      return { basics, columns, rows };
    }
    case 'sales_delivery': {
      const d = (await warehouseApi.salesDelivery.get(String(documentId))) as Record<string, unknown>;
      const basics: BriefModel['basics'] = [
        { key: 'code', label: '出库单号', value: dash(d.delivery_code) },
        { key: 'customer', label: '客户', value: dash(d.customer_name) },
        { key: 'so', label: '销售订单', value: dash(d.sales_order_code) },
        { key: 'wh', label: '仓库', value: dash(d.warehouse_name) },
        { key: 'status', label: '状态', value: briefDocStatus(d.status) },
        {
          key: 'amount',
          label: '总金额',
          value: briefAmount(SO, 'total_amount', d.total_amount),
        },
        { key: 'ship', label: '物流单号', value: dash(d.tracking_number) },
      ];
      const itemArr = (Array.isArray(d.items) ? d.items : []) as Record<string, unknown>[];
      const rows = itemArr.map((it, i) => ({
        key: String(it.id ?? i),
        material_code: it.material_code,
        material_name: it.material_name,
        material_spec: it.material_spec,
        delivery_quantity: it.delivery_quantity,
        unit: unitCell(it.material_unit),
        unit_price: it.unit_price,
        amount: it.total_amount,
        batch_number: it.batch_number,
      }));
      const columns: BriefModel['columns'] = [
        { title: '物料编码', dataIndex: 'material_code', ellipsis: true },
        { title: '物料名称', dataIndex: 'material_name', ellipsis: true },
        { title: '规格', dataIndex: 'material_spec', ellipsis: true },
        {
          title: '出库数量',
          dataIndex: 'delivery_quantity',
          width: 88,
          render: (v: number) => (v != null ? Number(v).toFixed(4).replace(/\.?0+$/, '') : '—'),
        },
        { title: '单位', dataIndex: 'unit', width: 64 },
        {
          title: '单价',
          dataIndex: 'unit_price',
          width: 96,
          render: (v: number) => briefAmount(SO, 'unit_price', v),
        },
        {
          title: '金额',
          dataIndex: 'amount',
          width: 104,
          render: (v: number) => briefAmount(SO, 'amount', v),
        },
        { title: '批号', dataIndex: 'batch_number', width: 96, render: (v: string) => dash(v) },
      ];
      return { basics, columns, rows };
    }
    case 'purchase_receipt': {
      const pr = (await warehouseApi.purchaseReceipt.get(String(documentId))) as Record<string, unknown>;
      const basics: BriefModel['basics'] = [
        { key: 'code', label: '入库单号', value: dash(pr.receipt_code) },
        { key: 'po', label: '采购订单', value: dash(pr.purchase_order_code) },
        { key: 'supplier', label: '供应商', value: dash(pr.supplier_name) },
        { key: 'wh', label: '仓库', value: dash(pr.warehouse_name) },
        { key: 'status', label: '状态', value: briefDocStatus(pr.status) },
        {
          key: 'amount',
          label: '总金额',
          value: briefAmount(PO, 'total_amount', pr.total_amount),
        },
        { key: 'delivery_note', label: '送货单号', value: dash(pr.delivery_note) },
      ];
      const itemArr = (Array.isArray(pr.items) ? pr.items : []) as Record<string, unknown>[];
      const rows = itemArr.map((it, i) => ({
        key: String(it.id ?? i),
        material_code: it.material_code,
        material_name: it.material_name,
        material_spec: it.material_spec,
        receipt_quantity: it.receipt_quantity,
        unit: unitCell(it.material_unit),
        unit_price: it.unit_price,
        amount: it.total_amount,
        batch_number: it.batch_number,
        qualified_quantity: it.qualified_quantity,
      }));
      const columns: BriefModel['columns'] = [
        { title: '物料编码', dataIndex: 'material_code', ellipsis: true },
        { title: '物料名称', dataIndex: 'material_name', ellipsis: true },
        { title: '规格', dataIndex: 'material_spec', ellipsis: true },
        {
          title: '入库数量',
          dataIndex: 'receipt_quantity',
          width: 88,
          render: (v: number) => (v != null ? Number(v).toFixed(4).replace(/\.?0+$/, '') : '—'),
        },
        {
          title: '合格数',
          dataIndex: 'qualified_quantity',
          width: 80,
          render: (v: number) => (v != null ? Number(v).toFixed(4).replace(/\.?0+$/, '') : '—'),
        },
        { title: '单位', dataIndex: 'unit', width: 64 },
        {
          title: '单价',
          dataIndex: 'unit_price',
          width: 96,
          render: (v: number) => briefAmount(PO, 'unit_price', v),
        },
        {
          title: '金额',
          dataIndex: 'amount',
          width: 104,
          render: (v: number) => briefAmount(PO, 'amount', v),
        },
        { title: '批号', dataIndex: 'batch_number', width: 96, render: (v: string) => dash(v) },
      ];
      return { basics, columns, rows };
    }
    case 'reporting_timeline': {
      const woId = -documentId;
      if (!Number.isFinite(woId) || woId <= 0) {
        throw new Error('unsupported:reporting_timeline');
      }
      const wo = (await workOrderApi.get(String(woId))) as Record<string, unknown>;
      const woCode = String(wo.code ?? '').trim();
      if (!woCode) {
        throw new Error('unsupported:reporting_timeline');
      }
      const rawList = await reportingApi.list({
        work_order_code: woCode,
        skip: 0,
        limit: 200,
      });
      const arr = Array.isArray(rawList) ? rawList : (rawList as { items?: unknown[] })?.items ?? [];
      let list = (arr as Record<string, unknown>[]).filter(
        (r) => String(r.work_order_code ?? '').trim() === woCode
      );
      if (list.length === 0) {
        list = arr as Record<string, unknown>[];
      }
      list = [...list].sort((a, b) => {
        const ta = new Date(String(a.reported_at ?? a.created_at ?? 0)).getTime();
        const tb = new Date(String(b.reported_at ?? b.created_at ?? 0)).getTime();
        return ta - tb;
      });
      const basics: BriefModel['basics'] = [
        { key: 'wo', label: '工单', value: dash(wo.code) },
        { key: 'won', label: '工单名称', value: dash(wo.name ?? wo.product_name) },
        { key: 'cnt', label: '报工条数', value: String(list.length) },
      ];
      const qtyFmt = (v: unknown) =>
        v != null && v !== '' && Number.isFinite(Number(v))
          ? Number(v).toFixed(4).replace(/\.?0+$/, '')
          : '—';
      const columns: BriefModel['columns'] = [
        {
          title: '工序',
          dataIndex: 'operation_name',
          width: 120,
          ellipsis: true,
          render: (v: unknown) => dash(v),
        },
        {
          title: '报工时间',
          dataIndex: 'reported_at',
          width: 172,
          render: (_: unknown, row: Record<string, unknown>) =>
            row.reported_at != null && row.reported_at !== ''
              ? String(row.reported_at)
              : dash(row.created_at),
        },
        { title: '状态', dataIndex: 'status', width: 88, render: (v: unknown) => briefDocStatus(v) },
        { title: '生产人员', dataIndex: 'worker_name', width: 96, render: (v: unknown) => dash(v) },
        {
          title: '合格数量',
          dataIndex: 'qualified_quantity',
          width: 96,
          render: (v: unknown) => qtyFmt(v),
        },
      ];
      const rows = list.map((r, i) => ({
        ...r,
        key: String(r.id ?? `row-${i}`),
      }));
      return { basics, columns, rows };
    }
    case 'receivable': {
      const ar = await receivableService.getReceivable(documentId);
      const basics: BriefModel['basics'] = [
        { key: 'code', label: '应收单号', value: dash(ar.receivable_code) },
        { key: 'customer', label: '客户', value: dash(ar.customer_name) },
        { key: 'status', label: '状态', value: briefDocStatus(ar.status) },
        { key: 'total', label: '应收总额', value: briefAmount(AR, 'total_amount', ar.total_amount) },
        { key: 'remain', label: '剩余', value: briefAmount(AR, 'amount', ar.remaining_amount) },
        { key: 'due', label: '到期日', value: dash(ar.due_date) },
      ];
      return { basics, columns: [], rows: [] };
    }
    case 'payable': {
      const py = await payableService.getPayable(documentId);
      const basics: BriefModel['basics'] = [
        { key: 'code', label: '应付单号', value: dash(py.payable_code) },
        { key: 'supplier', label: '供应商', value: dash(py.supplier_name) },
        { key: 'status', label: '状态', value: briefDocStatus(py.status) },
        { key: 'total', label: '应付总额', value: briefAmount(AP, 'total_amount', py.total_amount) },
        { key: 'remain', label: '剩余', value: briefAmount(AP, 'amount', py.remaining_amount) },
        { key: 'due', label: '到期日', value: dash(py.due_date) },
      ];
      return { basics, columns: [], rows: [] };
    }
    case 'sales_invoice': {
      const inv = await apiRequest<Record<string, unknown>>(`/apps/kuaicaiwu/sales-invoices/${documentId}`, {
        method: 'GET',
      });
      const basics: BriefModel['basics'] = [
        { key: 'code', label: '发票编号', value: dash(inv.invoice_code) },
        { key: 'cust', label: '客户', value: dash(inv.customer_name) },
        { key: 'status', label: '状态', value: briefDocStatus(inv.status) },
        { key: 'date', label: '开票日期', value: dash(inv.invoice_date) },
        {
          key: 'amt',
          label: '价税合计',
          value:
            briefAmount(SI, 'total_amount', inv.total_amount),
        },
      ];
      const itemArr = (Array.isArray(inv.items) ? inv.items : []) as Record<string, unknown>[];
      const rows = itemArr.map((it, i) => ({
        key: String(it.id ?? i),
        item_name: it.item_name,
        spec_model: it.spec_model,
        qty: it.quantity,
        unit: it.unit,
        amount: it.amount,
        tax_amount: it.tax_amount,
      }));
      const columns: BriefModel['columns'] = [
        { title: '名称', dataIndex: 'item_name', ellipsis: true },
        { title: '规格', dataIndex: 'spec_model', width: 100, ellipsis: true, render: (v: string) => dash(v) },
        {
          title: '数量',
          dataIndex: 'qty',
          width: 80,
          render: (v: number) => (v != null ? Number(v).toFixed(4).replace(/\.?0+$/, '') : '—'),
        },
        { title: '单位', dataIndex: 'unit', width: 56, render: (v: string) => dash(v) },
        {
          title: '金额(不含税)',
          dataIndex: 'amount',
          width: 112,
          render: (v: number) => briefAmount(SI, 'amount_without_tax', v),
        },
        {
          title: '税额',
          dataIndex: 'tax_amount',
          width: 96,
          render: (v: number) => briefAmount(SI, 'tax_amount', v),
        },
      ];
      return { basics, columns, rows };
    }
    case 'receipt': {
      const rc = await receiptService.getReceipt(documentId);
      const basics: BriefModel['basics'] = [
        { key: 'code', label: '收款单号', value: dash(rc.receipt_code) },
        { key: 'customer', label: '客户', value: dash(rc.customer_name) },
        { key: 'status', label: '状态', value: briefDocStatus(rc.status) },
        { key: 'date', label: '收款日期', value: dash(rc.receipt_date) },
        {
          key: 'total',
          label: '收款总额',
          value: briefAmount(RC, 'total_amount', rc.total_amount),
        },
        {
          key: 'settled',
          label: '已核销',
          value: briefAmount(RC, 'amount', rc.settled_amount),
        },
        {
          key: 'unsettled',
          label: '待核销',
          value: briefAmount(RC, 'amount', rc.unsettled_amount),
        },
        { key: 'method', label: '收款方式', value: dash(rc.payment_method) },
      ];
      return { basics, columns: [], rows: [] };
    }
    case 'purchase_invoice': {
      const pi = await purchaseInvoiceService.get(documentId);
      const basics: BriefModel['basics'] = [
        { key: 'code', label: '发票编码', value: dash(pi.invoice_code) },
        { key: 'po', label: '采购订单', value: dash(pi.purchase_order_code) },
        { key: 'supplier', label: '供应商', value: dash(pi.supplier_name) },
        { key: 'status', label: '状态', value: briefDocStatus(pi.status) },
        { key: 'review', label: '审核', value: briefDocStatus(pi.review_status) },
        { key: 'date', label: '发票日期', value: dash(pi.invoice_date) },
        {
          key: 'amt',
          label: '价税合计',
          value:
            briefAmount(PI, 'total_amount', pi.total_amount),
        },
      ];
      return { basics, columns: [], rows: [] };
    }
    case 'payment': {
      const pm = await apiRequest<Record<string, unknown>>(`/apps/kuaicaiwu/payments/${documentId}`, {
        method: 'GET',
      });
      const basics: BriefModel['basics'] = [
        { key: 'code', label: '付款单号', value: dash(pm.payment_code) },
        { key: 'supplier', label: '供应商', value: dash(pm.supplier_name) },
        { key: 'status', label: '状态', value: briefDocStatus(pm.status) },
        { key: 'date', label: '付款日期', value: dash(pm.payment_date) },
        {
          key: 'total',
          label: '付款总额',
          value: briefAmount(PAY, 'total_amount', pm.total_amount),
        },
        {
          key: 'settled',
          label: '已核销',
          value: briefAmount(PAY, 'amount', pm.settled_amount),
        },
        {
          key: 'unsettled',
          label: '待核销',
          value: briefAmount(PAY, 'amount', pm.unsettled_amount),
        },
        { key: 'method', label: '付款方式', value: dash(pm.payment_method) },
      ];
      return { basics, columns: [], rows: [] };
    }
    case 'reporting_record': {
      const r = (await reportingApi.get(String(documentId))) as Record<string, unknown>;
      const oc = dash(r.operation_code);
      const on = dash(r.operation_name);
      const opDisplay =
        oc !== '—' && on !== '—'
          ? `${oc} ${on}`.trim()
          : oc !== '—'
            ? oc
            : on;
      const basics: BriefModel['basics'] = [
        { key: 'wo', label: '工单', value: dash(r.work_order_code) },
        { key: 'won', label: '工单名称', value: dash(r.work_order_name) },
        { key: 'op', label: '工序', value: opDisplay },
        { key: 'worker', label: '生产人员', value: dash(r.worker_name) },
        { key: 'recorder', label: '记录人', value: dash(r.recorded_by_name) },
        { key: 'status', label: '状态', value: briefDocStatus(r.status) },
        {
          key: 'reported_at',
          label: '报工时间',
          value: r.reported_at != null && r.reported_at !== '' ? String(r.reported_at) : '—',
        },
        {
          key: 'hours',
          label: '工时(小时)',
          value: r.work_hours != null && r.work_hours !== '' ? String(r.work_hours) : '—',
        },
        { key: 'remarks', label: '备注', value: dash(r.remarks) },
        ...(r.approved_by_name || r.approved_at
          ? ([
              { key: 'approver', label: '审核人', value: dash(r.approved_by_name) },
              {
                key: 'approved_at',
                label: '审核时间',
                value: r.approved_at != null && r.approved_at !== '' ? String(r.approved_at) : '—',
              },
            ] as BriefModel['basics'])
          : []),
        ...(r.rejection_reason
          ? ([{ key: 'reject', label: '驳回原因', value: dash(r.rejection_reason) }] as BriefModel['basics'])
          : []),
      ];
      const qtyFmt = (v: unknown) =>
        v != null && v !== '' && Number.isFinite(Number(v))
          ? Number(v).toFixed(4).replace(/\.?0+$/, '')
          : '—';
      const rows = [
        {
          key: 'report-qty',
          reported_quantity: r.reported_quantity,
          qualified_quantity: r.qualified_quantity,
          unqualified_quantity: r.unqualified_quantity,
        },
      ];
      const columns: BriefModel['columns'] = [
        {
          title: '报工数量',
          dataIndex: 'reported_quantity',
          width: 96,
          render: (v: unknown) => qtyFmt(v),
        },
        {
          title: '合格数量',
          dataIndex: 'qualified_quantity',
          width: 96,
          render: (v: unknown) => qtyFmt(v),
        },
        {
          title: '不合格数量',
          dataIndex: 'unqualified_quantity',
          width: 96,
          render: (v: unknown) => qtyFmt(v),
        },
      ];
      return { basics, columns, rows };
    }
    default:
      throw new Error(`unsupported:${documentType}`);
  }
}

export const TraceLinkedDocumentBrief: React.FC<TraceLinkedDocumentBriefProps> = ({
  documentType,
  documentId,
  onOpenSalesOrderDetail,
  compactChrome = false,
}) => {
  const { t } = useTranslation();
  const { token } = useToken();

  const ready = Boolean(
    documentType && documentId != null && !Number.isNaN(Number(documentId))
  );

  const { data, loading, error } = useRequest(() => loadBrief(documentType!, documentId!), {
    ready,
    refreshDeps: [documentType, documentId],
  });

  const typeTitle = useMemo(() => {
    if (!documentType) return '';
    return t(`components.documentTrackingPanel.docType.${documentType}`, {
      defaultValue: documentType,
    });
  }, [documentType, t]);

  if (!ready) {
    return (
      <div
        style={{
          height: '100%',
          minHeight: 120,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px 12px',
          boxSizing: 'border-box',
        }}
      >
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('components.documentTrackingPanel.traceBriefSelectNode')} />
      </div>
    );
  }

  const unsupported =
    error && typeof (error as Error)?.message === 'string' && (error as Error).message.startsWith('unsupported:');

  if (unsupported || (error && !loading && !data)) {
    return (
      <div style={{ padding: '16px 0' }}>
        <Empty
          description={
            unsupported
              ? t('components.documentTrackingPanel.traceBriefUnsupported', { type: typeTitle })
              : t('components.documentTrackingPanel.traceBriefLoadFailed')
          }
        />
      </div>
    );
  }

  return (
    <div style={{ paddingTop: compactChrome ? 0 : 8 }}>
      {!compactChrome ? (
        <Space align="center" style={{ marginBottom: 8, width: '100%', justifyContent: 'space-between' }} wrap>
          <Typography.Text strong style={{ fontSize: 13, color: token.colorText }}>
            {typeTitle}
            <Typography.Text type="secondary" style={{ marginLeft: 8 }}>
              #
              {documentType === 'reporting_timeline' && documentId != null
                ? -documentId
                : documentId}
            </Typography.Text>
          </Typography.Text>
          {documentType === 'sales_order' && onOpenSalesOrderDetail ? (
            <Button type="link" size="small" style={{ padding: 0 }} onClick={() => onOpenSalesOrderDetail(documentId!)}>
              {t('components.documentTrackingPanel.traceBriefOpenSalesOrder')}
            </Button>
          ) : null}
        </Space>
      ) : null}

      {loading ? (
        <div style={{ padding: 32, textAlign: 'center' }}>
          <Spin />
        </div>
      ) : data ? (
        <>
          <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
            {t('components.documentTrackingPanel.traceBriefBasic')}
          </Typography.Text>
          <Descriptions size="small" column={2} bordered styles={{ label: { width: 96 } }}>
            {data.basics.map((row) => (
              <Descriptions.Item key={row.key} label={row.label}>
                {row.value}
              </Descriptions.Item>
            ))}
          </Descriptions>

          {data.columns.length > 0 || data.rows.length > 0 ? (
            <>
              <Divider style={{ margin: '12px 0' }} />

              <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
                {t('components.documentTrackingPanel.traceBriefItems')}
              </Typography.Text>
              <Table<Record<string, unknown>>
                size="small"
                rowKey="key"
                pagination={false}
                scroll={{ x: 'max-content' }}
                columns={data.columns}
                dataSource={data.rows}
                locale={{ emptyText: t('components.documentTrackingPanel.traceBriefNoItems') }}
              />
            </>
          ) : null}
        </>
      ) : null}
    </div>
  );
};
