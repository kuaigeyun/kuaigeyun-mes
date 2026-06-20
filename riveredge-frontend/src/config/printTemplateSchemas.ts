/**
 * 打印模板数据模式定义
 * 用于在设计器中提示可用变量
 * 字段 key 与 API 返回的 snake_case 保持一致，确保数据绑定正确
 */

import { formatDateTime } from '../utils/format';

export interface FieldSchema {
  key: string;
  label: string;
  type: 'string' | 'number' | 'date' | 'boolean' | 'array' | 'object';
  children?: FieldSchema[]; // 用于对象或数组类型
}

export interface TemplateSchema {
  type: string;
  name: string;
  fields: FieldSchema[];
}

/** 手机端扫描用单据二维码（打印页眉右上角） */
export const DOCUMENT_QRCODE_FIELD: FieldSchema = {
  key: 'document_qrcode',
  label: '单据二维码',
  type: 'string',
};

export const PRINT_TEMPLATE_SCHEMAS: Record<string, TemplateSchema> = {
  work_order: {
    type: 'work_order',
    name: '工单',
    fields: [
      { key: 'code', label: '工单编号', type: 'string' },
      { key: 'work_order_qrcode', label: '工单二维码', type: 'string' },
      { key: 'signature', label: '签名', type: 'string' },
      { key: 'name', label: '工单名称', type: 'string' },
      { key: 'product_code', label: '产品编号', type: 'string' },
      { key: 'product_name', label: '产品名称', type: 'string' },
      { key: 'quantity', label: '生产数量', type: 'number' },
      { key: 'status', label: '状态', type: 'string' },
      { key: 'production_mode', label: '生产模式', type: 'string' },
      { key: 'workshop_name', label: '车间名称', type: 'string' },
      { key: 'work_center_name', label: '工作中心名称', type: 'string' },
      { key: 'planned_start_date', label: '计划开始时间', type: 'date' },
      { key: 'planned_end_date', label: '计划结束时间', type: 'date' },
      { key: 'priority', label: '优先级', type: 'string' },
      { key: 'remarks', label: '备注', type: 'string' },
      { key: 'created_by_name', label: '创建人', type: 'string' },
      { key: 'created_at', label: '创建时间', type: 'date' },
      {
        key: 'operations',
        label: '工序列表',
        type: 'array',
        children: [
          { key: 'operations.0.operation_code', label: '工序编号（第1项）', type: 'string' },
          { key: 'operations.0.operation_name', label: '工序名称（第1项）', type: 'string' },
          { key: 'operations.0.sequence', label: '工序顺序（第1项）', type: 'number' },
          { key: 'operations.0.status', label: '工序状态（第1项）', type: 'string' },
          { key: 'operations.0.work_center_name', label: '工作中心（第1项）', type: 'string' },
          { key: 'operations.1.operation_name', label: '工序名称（第2项）', type: 'string' },
          { key: 'operations.2.operation_name', label: '工序名称（第3项）', type: 'string' },
        ],
      },
    ],
  },
  material: {
    type: 'material',
    name: '物料',
    fields: [
      { key: 'code', label: '物料编号', type: 'string' },
      { key: 'name', label: '物料名称', type: 'string' },
      { key: 'spec', label: '规格型号', type: 'string' },
      { key: 'unit', label: '单位', type: 'string' },
      { key: 'category', label: '分类', type: 'string' },
    ],
  },
  production_picking: {
    type: 'production_picking',
    name: '生产领料单',
    fields: [
      { key: 'code', label: '领料单号', type: 'string' },
      DOCUMENT_QRCODE_FIELD,
      { key: 'work_order_code', label: '工单编号', type: 'string' },
      { key: 'workshop_name', label: '车间名称', type: 'string' },
      { key: 'status', label: '状态', type: 'string' },
      { key: 'picker_name', label: '领料人', type: 'string' },
      { key: 'picking_time', label: '领料时间', type: 'date' },
      { key: 'created_at', label: '创建时间', type: 'date' },
      {
        key: 'items',
        label: '明细列表',
        type: 'array',
        children: [
          { key: 'items.0.material_code', label: '物料编号（第1项）', type: 'string' },
          { key: 'items.0.material_name', label: '物料名称（第1项）', type: 'string' },
          { key: 'items.0.material_spec', label: '规格（第1项）', type: 'string' },
          { key: 'items.0.material_unit', label: '单位（第1项）', type: 'string' },
          { key: 'items.0.required_quantity', label: '需求数量（第1项）', type: 'number' },
          { key: 'items.0.picked_quantity', label: '已领数量（第1项）', type: 'number' },
          { key: 'items.0.remaining_quantity', label: '剩余数量（第1项）', type: 'number' },
          { key: 'items.0.warehouse_name', label: '仓库（第1项）', type: 'string' },
          { key: 'items.0.location_code', label: '库位（第1项）', type: 'string' },
          { key: 'items.0.batch_number', label: '批次号（第1项）', type: 'string' },
          { key: 'items.0.status', label: '行状态（第1项）', type: 'string' },
          { key: 'items.0.notes', label: '行备注（第1项）', type: 'string' },
        ],
      },
    ],
  },
  production_return: {
    type: 'production_return',
    name: '生产退料单',
    fields: [
      { key: 'code', label: '退料单号', type: 'string' },
      DOCUMENT_QRCODE_FIELD,
      { key: 'work_order_code', label: '工单编号', type: 'string' },
      { key: 'picking_code', label: '领料单号', type: 'string' },
      { key: 'workshop_name', label: '车间名称', type: 'string' },
      { key: 'warehouse_name', label: '仓库名称', type: 'string' },
      { key: 'status', label: '状态', type: 'string' },
      { key: 'returner_name', label: '退料人', type: 'string' },
      { key: 'return_time', label: '退料时间', type: 'date' },
      { key: 'created_at', label: '创建时间', type: 'date' },
      {
        key: 'items',
        label: '明细列表',
        type: 'array',
        children: [
          { key: 'items.0.material_code', label: '物料编号（第1项）', type: 'string' },
          { key: 'items.0.material_name', label: '物料名称（第1项）', type: 'string' },
          { key: 'items.0.material_spec', label: '规格（第1项）', type: 'string' },
          { key: 'items.0.material_unit', label: '单位（第1项）', type: 'string' },
          { key: 'items.0.return_quantity', label: '退料数量（第1项）', type: 'number' },
          { key: 'items.0.warehouse_name', label: '仓库（第1项）', type: 'string' },
          { key: 'items.0.location_code', label: '库位（第1项）', type: 'string' },
          { key: 'items.0.batch_number', label: '批次号（第1项）', type: 'string' },
          { key: 'items.0.status', label: '行状态（第1项）', type: 'string' },
          { key: 'items.0.notes', label: '行备注（第1项）', type: 'string' },
        ],
      },
    ],
  },
  other_inbound: {
    type: 'other_inbound',
    name: '其他入库单',
    fields: [
      { key: 'code', label: '入库单号', type: 'string' },
      DOCUMENT_QRCODE_FIELD,
      { key: 'reason_type', label: '原因类型', type: 'string' },
      { key: 'reason_desc', label: '原因说明', type: 'string' },
      { key: 'warehouse_name', label: '仓库名称', type: 'string' },
      { key: 'total_quantity', label: '总数量', type: 'number' },
      { key: 'total_amount', label: '总金额', type: 'number' },
      { key: 'status', label: '状态', type: 'string' },
      { key: 'receiver_name', label: '入库人', type: 'string' },
      { key: 'receipt_time', label: '入库时间', type: 'date' },
      { key: 'notes', label: '备注', type: 'string' },
      { key: 'created_at', label: '创建时间', type: 'date' },
      {
        key: 'items',
        label: '明细列表',
        type: 'array',
        children: [
          { key: 'items.0.material_code', label: '物料编号（第1项）', type: 'string' },
          { key: 'items.0.material_name', label: '物料名称（第1项）', type: 'string' },
          { key: 'items.0.material_unit', label: '单位（第1项）', type: 'string' },
          { key: 'items.0.inbound_quantity', label: '入库数量（第1项）', type: 'number' },
          { key: 'items.0.unit_price', label: '单价（第1项）', type: 'number' },
          { key: 'items.0.total_amount', label: '金额（第1项）', type: 'number' },
          { key: 'items.0.batch_number', label: '批次号（第1项）', type: 'string' },
          { key: 'items.0.notes', label: '行备注（第1项）', type: 'string' },
        ],
      },
    ],
  },
  quotation: {
    type: 'quotation',
    name: '报价单',
    fields: [
      { key: 'code', label: '报价单号', type: 'string' },
      { key: 'quotation_series_code', label: '报价系列号', type: 'string' },
      { key: 'version_no', label: '版本号', type: 'number' },
      { key: 'revision_label', label: '版本标签（如 第1版 / Revision 1）', type: 'string' },
      { key: 'is_latest_in_series', label: '是否系列内最新版', type: 'boolean' },
      { key: 'currency_code', label: '币别', type: 'string' },
      { key: 'review_status', label: '审核状态', type: 'string' },
      { key: 'formal_document_generated_at', label: '正式文档生成时间', type: 'date' },
      { key: 'customer_name', label: '客户名称', type: 'string' },
      { key: 'customer_contact', label: '客户联系人', type: 'string' },
      { key: 'customer_phone', label: '客户电话', type: 'string' },
      { key: 'quotation_date', label: '报价日期', type: 'date' },
      { key: 'valid_until', label: '有效期至', type: 'date' },
      { key: 'delivery_date', label: '预计交货日期', type: 'date' },
      { key: 'total_quantity', label: '总数量', type: 'number' },
      { key: 'total_amount', label: '总金额', type: 'number' },
      { key: 'status', label: '状态', type: 'string' },
      { key: 'salesman_name', label: '销售员', type: 'string' },
      { key: 'shipping_address', label: '收货地址', type: 'string' },
      { key: 'shipping_method', label: '发货方式', type: 'string' },
      { key: 'payment_terms', label: '付款条件', type: 'string' },
      { key: 'notes', label: '备注', type: 'string' },
      { key: 'created_at', label: '创建时间', type: 'date' },
      {
        key: 'items',
        label: '明细列表',
        type: 'array',
        children: [
          { key: 'items.0.chinese_short_name', label: '中文简称（第1项）', type: 'string' },
          { key: 'items.0.model_number', label: '型号（第1项）', type: 'string' },
          { key: 'items.0.image_url', label: '图片（第1项）', type: 'string' },
          { key: 'items.0.material_unit', label: '单位（第1项）', type: 'string' },
          { key: 'items.0.quote_quantity', label: '数量（第1项）', type: 'number' },
          { key: 'items.0.unit_price', label: '单价（含税）（第1项）', type: 'number' },
          { key: 'items.0.total_amount', label: '总价（含税）（第1项）', type: 'number' },
          { key: 'items.0.material_code', label: '物料编号（第1项）', type: 'string' },
          { key: 'items.0.material_name', label: '物料名称（第1项）', type: 'string' },
          { key: 'items.0.material_spec', label: '规格（第1项）', type: 'string' },
          { key: 'items.0.delivery_date', label: '行交货日（第1项）', type: 'date' },
          { key: 'items.0.notes', label: '行备注（第1项）', type: 'string' },
        ],
      },
    ],
  },
  material_borrow: {
    type: 'material_borrow',
    name: '借料单',
    fields: [
      { key: 'borrow_code', label: '借料单号', type: 'string' },
      DOCUMENT_QRCODE_FIELD,
      { key: 'warehouse_name', label: '仓库名称', type: 'string' },
      { key: 'borrower_name', label: '借料人', type: 'string' },
      { key: 'department', label: '部门', type: 'string' },
      { key: 'expected_return_date', label: '预计归还日期', type: 'date' },
      { key: 'status', label: '状态', type: 'string' },
      { key: 'borrow_time', label: '借出时间', type: 'date' },
      { key: 'total_quantity', label: '总数量', type: 'number' },
      { key: 'notes', label: '备注', type: 'string' },
      { key: 'created_at', label: '创建时间', type: 'date' },
      {
        key: 'items',
        label: '明细列表',
        type: 'array',
        children: [
          { key: 'items.0.material_code', label: '物料编号（第1项）', type: 'string' },
          { key: 'items.0.material_name', label: '物料名称（第1项）', type: 'string' },
          { key: 'items.0.material_spec', label: '规格（第1项）', type: 'string' },
          { key: 'items.0.material_unit', label: '单位（第1项）', type: 'string' },
          { key: 'items.0.borrow_quantity', label: '借出数量（第1项）', type: 'number' },
          { key: 'items.0.returned_quantity', label: '已归还数量（第1项）', type: 'number' },
          { key: 'items.0.warehouse_name', label: '仓库（第1项）', type: 'string' },
          { key: 'items.0.notes', label: '行备注（第1项）', type: 'string' },
        ],
      },
    ],
  },
  material_return: {
    type: 'material_return',
    name: '还料单',
    fields: [
      { key: 'return_code', label: '还料单号', type: 'string' },
      DOCUMENT_QRCODE_FIELD,
      { key: 'borrow_code', label: '借料单号', type: 'string' },
      { key: 'warehouse_name', label: '仓库名称', type: 'string' },
      { key: 'returner_name', label: '归还人', type: 'string' },
      { key: 'status', label: '状态', type: 'string' },
      { key: 'return_time', label: '归还时间', type: 'date' },
      { key: 'total_quantity', label: '总数量', type: 'number' },
      { key: 'notes', label: '备注', type: 'string' },
      { key: 'created_at', label: '创建时间', type: 'date' },
      {
        key: 'items',
        label: '明细列表',
        type: 'array',
        children: [
          { key: 'items.0.material_code', label: '物料编号（第1项）', type: 'string' },
          { key: 'items.0.material_name', label: '物料名称（第1项）', type: 'string' },
          { key: 'items.0.material_spec', label: '规格（第1项）', type: 'string' },
          { key: 'items.0.material_unit', label: '单位（第1项）', type: 'string' },
          { key: 'items.0.return_quantity', label: '归还数量（第1项）', type: 'number' },
          { key: 'items.0.warehouse_name', label: '仓库（第1项）', type: 'string' },
          { key: 'items.0.notes', label: '行备注（第1项）', type: 'string' },
        ],
      },
    ],
  },
  other_outbound: {
    type: 'other_outbound',
    name: '其他出库单',
    fields: [
      { key: 'code', label: '出库单号', type: 'string' },
      DOCUMENT_QRCODE_FIELD,
      { key: 'reason_type', label: '原因类型', type: 'string' },
      { key: 'reason_desc', label: '原因说明', type: 'string' },
      { key: 'warehouse_name', label: '仓库名称', type: 'string' },
      { key: 'total_quantity', label: '总数量', type: 'number' },
      { key: 'total_amount', label: '总金额', type: 'number' },
      { key: 'status', label: '状态', type: 'string' },
      { key: 'deliverer_name', label: '出库人', type: 'string' },
      { key: 'delivery_time', label: '出库时间', type: 'date' },
      { key: 'notes', label: '备注', type: 'string' },
      { key: 'created_at', label: '创建时间', type: 'date' },
      {
        key: 'items',
        label: '明细列表',
        type: 'array',
        children: [
          { key: 'items.0.material_code', label: '物料编号（第1项）', type: 'string' },
          { key: 'items.0.material_name', label: '物料名称（第1项）', type: 'string' },
          { key: 'items.0.material_unit', label: '单位（第1项）', type: 'string' },
          { key: 'items.0.outbound_quantity', label: '出库数量（第1项）', type: 'number' },
          { key: 'items.0.unit_price', label: '单价（第1项）', type: 'number' },
          { key: 'items.0.total_amount', label: '金额（第1项）', type: 'number' },
          { key: 'items.0.batch_number', label: '批次号（第1项）', type: 'string' },
          { key: 'items.0.notes', label: '行备注（第1项）', type: 'string' },
        ],
      },
    ],
  },
  finished_goods_receipt: {
    type: 'finished_goods_receipt',
    name: '成品入库单',
    fields: [
      { key: 'code', label: '入库单号', type: 'string' },
      DOCUMENT_QRCODE_FIELD,
      { key: 'work_order_code', label: '工单编号', type: 'string' },
      { key: 'warehouse_name', label: '仓库名称', type: 'string' },
      { key: 'total_quantity', label: '总数量', type: 'number' },
      { key: 'status', label: '状态', type: 'string' },
      { key: 'receiver_name', label: '收货人', type: 'string' },
      { key: 'receipt_time', label: '入库时间', type: 'date' },
      { key: 'created_at', label: '创建时间', type: 'date' },
      {
        key: 'items',
        label: '明细列表',
        type: 'array',
        children: [
          { key: 'items.0.material_code', label: '物料编号（第1项）', type: 'string' },
          { key: 'items.0.material_name', label: '物料名称（第1项）', type: 'string' },
          { key: 'items.0.material_spec', label: '规格（第1项）', type: 'string' },
          { key: 'items.0.material_unit', label: '单位（第1项）', type: 'string' },
          { key: 'items.0.receipt_quantity', label: '入库数量（第1项）', type: 'number' },
          { key: 'items.0.qualified_quantity', label: '合格数量（第1项）', type: 'number' },
          { key: 'items.0.unqualified_quantity', label: '不合格数量（第1项）', type: 'number' },
          { key: 'items.0.location_code', label: '库位（第1项）', type: 'string' },
          { key: 'items.0.batch_number', label: '批次号（第1项）', type: 'string' },
          { key: 'items.0.quality_status', label: '质量状态（第1项）', type: 'string' },
          { key: 'items.0.status', label: '行状态（第1项）', type: 'string' },
          { key: 'items.0.notes', label: '行备注（第1项）', type: 'string' },
        ],
      },
    ],
  },
  semi_finished_goods_receipt: {
    type: 'semi_finished_goods_receipt',
    name: '半成品入库单',
    fields: [
      { key: 'code', label: '入库单号', type: 'string' },
      DOCUMENT_QRCODE_FIELD,
      { key: 'work_order_code', label: '工单编号', type: 'string' },
      { key: 'warehouse_name', label: '仓库名称', type: 'string' },
      { key: 'total_quantity', label: '总数量', type: 'number' },
      { key: 'status', label: '状态', type: 'string' },
      { key: 'receiver_name', label: '收货人', type: 'string' },
      { key: 'receipt_time', label: '入库时间', type: 'date' },
      { key: 'created_at', label: '创建时间', type: 'date' },
      {
        key: 'items',
        label: '明细列表',
        type: 'array',
        children: [
          { key: 'items.0.material_code', label: '物料编号（第1项）', type: 'string' },
          { key: 'items.0.material_name', label: '物料名称（第1项）', type: 'string' },
          { key: 'items.0.material_spec', label: '规格（第1项）', type: 'string' },
          { key: 'items.0.material_unit', label: '单位（第1项）', type: 'string' },
          { key: 'items.0.receipt_quantity', label: '入库数量（第1项）', type: 'number' },
          { key: 'items.0.qualified_quantity', label: '合格数量（第1项）', type: 'number' },
          { key: 'items.0.unqualified_quantity', label: '不合格数量（第1项）', type: 'number' },
          { key: 'items.0.location_code', label: '库位（第1项）', type: 'string' },
          { key: 'items.0.batch_number', label: '批次号（第1项）', type: 'string' },
          { key: 'items.0.quality_status', label: '质量状态（第1项）', type: 'string' },
          { key: 'items.0.status', label: '行状态（第1项）', type: 'string' },
          { key: 'items.0.notes', label: '行备注（第1项）', type: 'string' },
        ],
      },
    ],
  },
  sales_delivery: {
    type: 'sales_delivery',
    name: '销售出库单',
    fields: [
      { key: 'code', label: '出库单号', type: 'string' },
      DOCUMENT_QRCODE_FIELD,
      { key: 'sales_order_code', label: '销售订单号', type: 'string' },
      { key: 'customer_name', label: '客户名称', type: 'string' },
      { key: 'warehouse_name', label: '仓库名称', type: 'string' },
      { key: 'total_quantity', label: '总数量', type: 'number' },
      { key: 'total_amount', label: '总金额', type: 'number' },
      { key: 'status', label: '状态', type: 'string' },
      { key: 'deliverer_name', label: '发货人', type: 'string' },
      { key: 'delivery_time', label: '发货时间', type: 'date' },
      { key: 'created_at', label: '创建时间', type: 'date' },
      {
        key: 'items',
        label: '明细列表',
        type: 'array',
        children: [
          { key: 'items.0.material_code', label: '物料编号（第1项）', type: 'string' },
          { key: 'items.0.material_name', label: '物料名称（第1项）', type: 'string' },
          { key: 'items.0.material_spec', label: '规格（第1项）', type: 'string' },
          { key: 'items.0.material_unit', label: '单位（第1项）', type: 'string' },
          { key: 'items.0.delivery_quantity', label: '出库数量（第1项）', type: 'number' },
          { key: 'items.0.unit_price', label: '单价（第1项）', type: 'number' },
          { key: 'items.0.total_amount', label: '金额（第1项）', type: 'number' },
          { key: 'items.0.location_code', label: '库位（第1项）', type: 'string' },
          { key: 'items.0.batch_number', label: '批次号（第1项）', type: 'string' },
          { key: 'items.0.status', label: '行状态（第1项）', type: 'string' },
          { key: 'items.0.notes', label: '行备注（第1项）', type: 'string' },
        ],
      },
    ],
  },
  purchase_order: {
    type: 'purchase_order',
    name: '采购订单',
    fields: [
      { key: 'code', label: '订单号', type: 'string' },
      { key: 'order_name', label: '订单名称', type: 'string' },
      { key: 'supplier_name', label: '供应商名称', type: 'string' },
      { key: 'order_date', label: '订单日期', type: 'date' },
      { key: 'delivery_date', label: '交货日期', type: 'date' },
      { key: 'total_amount', label: '总金额', type: 'number' },
      { key: 'status', label: '状态', type: 'string' },
      { key: 'created_at', label: '创建时间', type: 'date' },
      {
        key: 'items',
        label: '明细列表',
        type: 'array',
        children: [
          { key: 'items.0.material_code', label: '物料编号（第1项）', type: 'string' },
          { key: 'items.0.material_name', label: '物料名称（第1项）', type: 'string' },
          { key: 'items.0.material_spec', label: '规格（第1项）', type: 'string' },
          { key: 'items.0.material_unit', label: '单位（第1项）', type: 'string' },
          { key: 'items.0.ordered_quantity', label: '采购数量（第1项）', type: 'number' },
          { key: 'items.0.unit_price', label: '单价（第1项）', type: 'number' },
          { key: 'items.0.total_amount', label: '金额（第1项）', type: 'number' },
          { key: 'items.0.received_quantity', label: '已到货数量（第1项）', type: 'number' },
          { key: 'items.0.outstanding_quantity', label: '未到货数量（第1项）', type: 'number' },
          { key: 'items.0.required_date', label: '要求到货日（第1项）', type: 'date' },
          { key: 'items.0.notes', label: '行备注（第1项）', type: 'string' },
        ],
      },
    ],
  },
  purchase_receipt: {
    type: 'purchase_receipt',
    name: '采购入库单',
    fields: [
      { key: 'code', label: '入库单号', type: 'string' },
      DOCUMENT_QRCODE_FIELD,
      { key: 'purchase_order_code', label: '采购订单号', type: 'string' },
      { key: 'supplier_name', label: '供应商名称', type: 'string' },
      { key: 'warehouse_name', label: '仓库名称', type: 'string' },
      { key: 'total_quantity', label: '总数量', type: 'number' },
      { key: 'total_amount', label: '总金额', type: 'number' },
      { key: 'status', label: '状态', type: 'string' },
      { key: 'receiver_name', label: '收货人', type: 'string' },
      { key: 'receipt_time', label: '入库时间', type: 'date' },
      { key: 'created_at', label: '创建时间', type: 'date' },
      {
        key: 'items',
        label: '明细列表',
        type: 'array',
        children: [
          { key: 'items.0.material_code', label: '物料编号（第1项）', type: 'string' },
          { key: 'items.0.material_name', label: '物料名称（第1项）', type: 'string' },
          { key: 'items.0.material_spec', label: '规格（第1项）', type: 'string' },
          { key: 'items.0.material_unit', label: '单位（第1项）', type: 'string' },
          { key: 'items.0.receipt_quantity', label: '入库数量（第1项）', type: 'number' },
          { key: 'items.0.unit_price', label: '单价（第1项）', type: 'number' },
          { key: 'items.0.total_amount', label: '金额（第1项）', type: 'number' },
          { key: 'items.0.qualified_quantity', label: '合格数量（第1项）', type: 'number' },
          { key: 'items.0.unqualified_quantity', label: '不合格数量（第1项）', type: 'number' },
          { key: 'items.0.warehouse_name', label: '行仓库（第1项）', type: 'string' },
          { key: 'items.0.location_code', label: '库位（第1项）', type: 'string' },
          { key: 'items.0.batch_number', label: '批次号（第1项）', type: 'string' },
          { key: 'items.0.quality_status', label: '质量状态（第1项）', type: 'string' },
          { key: 'items.0.status', label: '行状态（第1项）', type: 'string' },
          { key: 'items.0.notes', label: '行备注（第1项）', type: 'string' },
        ],
      },
    ],
  },
  delivery_notice: {
    type: 'delivery_notice',
    name: '送货单',
    fields: [
      { key: 'code', label: '通知单号', type: 'string' },
      DOCUMENT_QRCODE_FIELD,
      { key: 'sales_delivery_code', label: '销售出库单号', type: 'string' },
      { key: 'sales_order_code', label: '销售订单号', type: 'string' },
      { key: 'customer_name', label: '客户名称', type: 'string' },
      { key: 'customer_contact', label: '客户联系人', type: 'string' },
      { key: 'customer_phone', label: '客户电话', type: 'string' },
      { key: 'planned_delivery_date', label: '预计送达日期', type: 'date' },
      { key: 'carrier', label: '承运商/物流方式', type: 'string' },
      { key: 'tracking_number', label: '运单号', type: 'string' },
      { key: 'shipping_address', label: '收货地址', type: 'string' },
      { key: 'status', label: '状态', type: 'string' },
      { key: 'sent_at', label: '发送时间', type: 'date' },
      { key: 'total_quantity', label: '总数量', type: 'number' },
      { key: 'total_amount', label: '总金额', type: 'number' },
      { key: 'notes', label: '备注', type: 'string' },
      { key: 'created_at', label: '创建时间', type: 'date' },
      {
        key: 'items',
        label: '明细列表',
        type: 'array',
        children: [
          { key: 'items.0.material_code', label: '物料编号（第1项）', type: 'string' },
          { key: 'items.0.material_name', label: '物料名称（第1项）', type: 'string' },
          { key: 'items.0.material_spec', label: '规格（第1项）', type: 'string' },
          { key: 'items.0.material_unit', label: '单位（第1项）', type: 'string' },
          { key: 'items.0.notice_quantity', label: '通知数量（第1项）', type: 'number' },
          { key: 'items.0.unit_price', label: '单价（第1项）', type: 'number' },
          { key: 'items.0.total_amount', label: '金额（第1项）', type: 'number' },
          { key: 'items.0.notes', label: '行备注（第1项）', type: 'string' },
        ],
      },
    ],
  },
  sales_order: {
    type: 'sales_order',
    name: '销售订单',
    fields: [
      { key: 'code', label: '订单号', type: 'string' },
      { key: 'order_name', label: '订单名称', type: 'string' },
      { key: 'customer_name', label: '客户名称', type: 'string' },
      { key: 'order_date', label: '订单日期', type: 'date' },
      { key: 'delivery_date', label: '交货日期', type: 'date' },
      { key: 'total_quantity', label: '总数量', type: 'number' },
      { key: 'total_amount', label: '总金额', type: 'number' },
      { key: 'status', label: '状态', type: 'string' },
      { key: 'created_at', label: '创建时间', type: 'date' },
      {
        key: 'items',
        label: '明细列表',
        type: 'array',
        children: [
          { key: 'items.0.chinese_short_name', label: '中文简称（第1项）', type: 'string' },
          { key: 'items.0.model_number', label: '型号（第1项）', type: 'string' },
          { key: 'items.0.image_url', label: '图片（第1项）', type: 'string' },
          { key: 'items.0.material_code', label: '物料编号（第1项）', type: 'string' },
          { key: 'items.0.material_name', label: '物料名称（第1项）', type: 'string' },
          { key: 'items.0.material_spec', label: '规格（第1项）', type: 'string' },
          { key: 'items.0.material_unit', label: '单位（第1项）', type: 'string' },
          { key: 'items.0.order_quantity', label: '订单数量（第1项）', type: 'number' },
          { key: 'items.0.quote_quantity', label: '数量（第1项）', type: 'number' },
          { key: 'items.0.delivered_quantity', label: '已交货数量（第1项）', type: 'number' },
          { key: 'items.0.remaining_quantity', label: '剩余数量（第1项）', type: 'number' },
          { key: 'items.0.unit_price', label: '单价（第1项）', type: 'number' },
          { key: 'items.0.tax_rate', label: '税率（第1项）', type: 'number' },
          { key: 'items.0.total_amount', label: '价税合计（第1项）', type: 'number' },
          { key: 'items.0.delivery_date', label: '行交货日（第1项）', type: 'date' },
          { key: 'items.0.delivery_status', label: '交货状态（第1项）', type: 'string' },
          { key: 'items.0.work_order_code', label: '工单编号（第1项）', type: 'string' },
          { key: 'items.0.notes', label: '行备注（第1项）', type: 'string' },
        ],
      },
    ],
  },
  sales_contract: {
    type: 'sales_contract',
    name: '销售合同',
    fields: [
      { key: 'code', label: '合同编号', type: 'string' },
      { key: 'contract_code', label: '合同编号', type: 'string' },
      { key: 'contract_type', label: '合同类型', type: 'string' },
      { key: 'version_no', label: '版本号', type: 'number' },
      { key: 'review_status', label: '审核状态', type: 'string' },
      { key: 'currency_code', label: '币别', type: 'string' },
      { key: 'customer_name', label: '客户名称', type: 'string' },
      { key: 'customer_contact', label: '客户联系人', type: 'string' },
      { key: 'customer_phone', label: '客户电话', type: 'string' },
      { key: 'contract_date', label: '合同日期', type: 'date' },
      { key: 'valid_from', label: '有效期起', type: 'date' },
      { key: 'valid_to', label: '有效期止', type: 'date' },
      { key: 'total_quantity', label: '总数量', type: 'number' },
      { key: 'total_amount', label: '总金额', type: 'number' },
      { key: 'released_quantity', label: '已释放数量', type: 'number' },
      { key: 'released_amount', label: '已释放金额', type: 'number' },
      { key: 'remaining_quantity', label: '剩余数量', type: 'number' },
      { key: 'remaining_amount', label: '剩余金额', type: 'number' },
      { key: 'salesman_name', label: '销售员', type: 'string' },
      { key: 'shipping_address', label: '收货地址', type: 'string' },
      { key: 'shipping_method', label: '发货方式', type: 'string' },
      { key: 'payment_terms', label: '付款条件', type: 'string' },
      { key: 'quotation_code', label: '报价单号', type: 'string' },
      { key: 'contract_terms', label: '合同条款', type: 'string' },
      { key: 'notes', label: '备注', type: 'string' },
      { key: 'created_at', label: '创建时间', type: 'date' },
      { key: 'print_time', label: '打印时间', type: 'date' },
      {
        key: 'items',
        label: '明细列表',
        type: 'array',
        children: [
          { key: 'items.0.material_code', label: '物料编号（第1项）', type: 'string' },
          { key: 'items.0.material_name', label: '物料名称（第1项）', type: 'string' },
          { key: 'items.0.material_spec', label: '规格（第1项）', type: 'string' },
          { key: 'items.0.material_unit', label: '单位（第1项）', type: 'string' },
          { key: 'items.0.order_quantity', label: '数量（第1项）', type: 'number' },
          { key: 'items.0.unit_price', label: '单价（第1项）', type: 'number' },
          { key: 'items.0.total_amount', label: '金额（第1项）', type: 'number' },
          { key: 'items.0.notes', label: '行备注（第1项）', type: 'string' },
        ],
      },
    ],
  },
  product_quality_certificate: {
    type: 'product_quality_certificate',
    name: '产品合格证',
    fields: [
      { key: 'code', label: '检验单号', type: 'string' },
      { key: 'inspection_code', label: '检验单号', type: 'string' },
      { key: 'release_certificate', label: '证书编号', type: 'string' },
      { key: 'material_code', label: '产品编号', type: 'string' },
      { key: 'material_name', label: '产品名称', type: 'string' },
      { key: 'material_spec', label: '规格型号', type: 'string' },
      { key: 'batch_number', label: '生产批次', type: 'string' },
      { key: 'inspection_quantity', label: '检验数量', type: 'number' },
      { key: 'qualified_quantity', label: '合格数量', type: 'number' },
      { key: 'quality_status', label: '质量状态', type: 'string' },
      { key: 'inspection_result', label: '检验结果', type: 'string' },
      { key: 'inspector_name', label: '检验员', type: 'string' },
      { key: 'inspection_time', label: '检验时间', type: 'date' },
      { key: 'work_order_code', label: '工单编号', type: 'string' },
      { key: 'sales_order_code', label: '销售订单', type: 'string' },
      { key: 'customer_name', label: '客户名称', type: 'string' },
      { key: 'inspection_standard', label: '检验标准', type: 'string' },
      { key: 'notes', label: '备注', type: 'string' },
      { key: 'print_time', label: '打印时间', type: 'date' },
    ],
  },
  equipment_spot_check: {
    type: 'equipment_spot_check',
    name: '设备点检单',
    fields: [
      { key: 'report_title', label: '报告标题', type: 'string' },
      { key: 'sheet_no', label: '点检单号', type: 'string' },
      { key: 'recorded_at', label: '点检时间', type: 'date' },
      { key: 'equipment_asset_code', label: '设备代号', type: 'string' },
      { key: 'equipment_name', label: '设备名称', type: 'string' },
      { key: 'inspection_param_set_label', label: '点检方案', type: 'string' },
      { key: 'abnormal_description', label: '异常说明', type: 'string' },
      { key: 'applied_operational_status_label', label: '调整后运行状态', type: 'string' },
      { key: 'line_count', label: '点检项数', type: 'number' },
      { key: 'abnormal_count', label: '异常项数', type: 'number' },
      {
        key: 'line_items',
        label: '点检明细',
        type: 'array',
        children: [
          { key: 'line_items.0.param_code', label: '点检编号', type: 'string' },
          { key: 'line_items.0.param_name', label: '点检项', type: 'string' },
          { key: 'line_items.0.measured_value', label: '实测值', type: 'string' },
          { key: 'line_items.0.result_label', label: '结果', type: 'string' },
          { key: 'line_items.0.remark', label: '备注', type: 'string' },
        ],
      },
      { key: 'created_at', label: '制单时间', type: 'date' },
      { key: 'print_time', label: '打印时间', type: 'date' },
      { key: 'print_user', label: '打印人', type: 'string' },
      { key: 'company_name', label: '公司名称', type: 'string' },
    ],
  },
  equipment_upkeep_complete: {
    type: 'equipment_upkeep_complete',
    name: '设备维保完成单',
    fields: [
      { key: 'report_title', label: '报告标题', type: 'string' },
      { key: 'sheet_no', label: '完成单号', type: 'string' },
      { key: 'service_type', label: '业务类型', type: 'string' },
      { key: 'source_order_no', label: '来源维保单号', type: 'string' },
      { key: 'equipment_asset_code', label: '设备代号', type: 'string' },
      { key: 'equipment_name', label: '设备名称', type: 'string' },
      { key: 'applicant_name', label: '申请人', type: 'string' },
      { key: 'department_name', label: '申请部门', type: 'string' },
      { key: 'source_description', label: '维保前说明', type: 'string' },
      { key: 'completion_content', label: '保养完成说明', type: 'string' },
      { key: 'repair_content', label: '维修内容', type: 'string' },
      { key: 'repair_result', label: '维修结果', type: 'string' },
      { key: 'created_at', label: '制单时间', type: 'date' },
      { key: 'print_time', label: '打印时间', type: 'date' },
      { key: 'print_user', label: '打印人', type: 'string' },
      { key: 'company_name', label: '公司名称', type: 'string' },
    ],
  },
  mold_maintenance_complete: {
    type: 'mold_maintenance_complete',
    name: '模具维保完成单',
    fields: [
      { key: 'report_title', label: '报告标题', type: 'string' },
      { key: 'sheet_no', label: '完成单号', type: 'string' },
      { key: 'service_type', label: '业务类型', type: 'string' },
      { key: 'source_order_no', label: '来源维保单号', type: 'string' },
      { key: 'applicant_name', label: '申请人', type: 'string' },
      { key: 'department_name', label: '申请部门', type: 'string' },
      {
        key: 'line_items',
        label: '模具明细',
        type: 'array',
        children: [
          { key: 'line_items.0.mold_code', label: '模具代号', type: 'string' },
          { key: 'line_items.0.mold_name', label: '模具名称', type: 'string' },
          { key: 'line_items.0.repair_content', label: '维修内容', type: 'string' },
          { key: 'line_items.0.repair_cost', label: '维修金额', type: 'string' },
          { key: 'line_items.0.upkeep_summary', label: '保养摘要', type: 'string' },
        ],
      },
      { key: 'created_at', label: '制单时间', type: 'date' },
      { key: 'print_time', label: '打印时间', type: 'date' },
    ],
  },
  mold_outsource_maintenance_complete: {
    type: 'mold_outsource_maintenance_complete',
    name: '模具外协维保完成单',
    fields: [
      { key: 'report_title', label: '报告标题', type: 'string' },
      { key: 'sheet_no', label: '完成单号', type: 'string' },
      { key: 'outsourced_unit_name', label: '外协单位', type: 'string' },
      { key: 'sheet_status', label: '审核状态', type: 'string' },
      { key: 'source_order_no', label: '来源外协维保单号', type: 'string' },
      {
        key: 'line_items',
        label: '模具明细',
        type: 'array',
        children: [
          { key: 'line_items.0.mold_code', label: '模具代号', type: 'string' },
          { key: 'line_items.0.repair_content', label: '维修内容', type: 'string' },
          { key: 'line_items.0.repair_cost', label: '维修金额', type: 'string' },
        ],
      },
      { key: 'created_at', label: '制单时间', type: 'date' },
    ],
  },
  common: {
    type: 'common',
    name: '通用',
    fields: [
      { key: 'company_name', label: '公司名称', type: 'string' },
      { key: 'print_user', label: '打印人', type: 'string' },
      { key: 'print_time', label: '打印时间', type: 'date' },
      { key: 'tenant_name', label: '组织名称', type: 'string' },
    ],
  },
};

export const getSchemaByType = (type: string): TemplateSchema | undefined => {
  return PRINT_TEMPLATE_SCHEMAS[type];
};

export const DOCUMENT_TYPE_OPTIONS = Object.entries(PRINT_TEMPLATE_SCHEMAS).map(([value, schema]) => ({
  label: schema.name,
  value,
}));

export const DOCUMENT_TYPE_TO_CODE: Record<string, string> = {
  work_order: 'WORK_ORDER_PRINT',
  material: 'MATERIAL_PRINT',
  production_picking: 'PRODUCTION_PICKING_PRINT',
  production_return: 'PRODUCTION_RETURN_PRINT',
  other_inbound: 'OTHER_INBOUND_PRINT',
  other_outbound: 'OTHER_OUTBOUND_PRINT',
  material_borrow: 'MATERIAL_BORROW_PRINT',
  material_return: 'MATERIAL_RETURN_PRINT',
  finished_goods_receipt: 'FINISHED_GOODS_RECEIPT_PRINT',
  semi_finished_goods_receipt: 'SEMI_FINISHED_GOODS_RECEIPT_PRINT',
  sales_delivery: 'SALES_DELIVERY_PRINT',
  purchase_order: 'PURCHASE_ORDER_PRINT',
  purchase_receipt: 'PURCHASE_RECEIPT_PRINT',
  sales_forecast: 'SALES_FORECAST_PRINT',
  sales_order: 'SALES_ORDER_PRINT',
  quotation: 'QUOTATION_PRINT',
  sales_contract: 'SALES_CONTRACT_PRINT',
  delivery_notice: 'DELIVERY_NOTICE_PRINT',
  product_quality_certificate: 'PRODUCT_QUALITY_CERTIFICATE_PRINT',
  equipment_spot_check: 'HAOLIGO_EQUIPMENT_SPOT_CHECK_PRINT',
  equipment_upkeep_complete: 'HAOLIGO_EQUIPMENT_UPKEEP_COMPLETE_PRINT',
  mold_maintenance_complete: 'HAOLIGO_MOLD_MAINTENANCE_COMPLETE_PRINT',
  mold_outsource_maintenance_complete: 'HAOLIGO_MOLD_OUTSOURCE_MAINTENANCE_COMPLETE_PRINT',
};

export interface TemplateVariableItem {
  key: string;
  label: string;
  /** 侧栏展示为「整块明细表」，点击插入结构化表格（绑定 items / operations 数组） */
  kind?: 'detailTable';
}

const getSampleValueByType = (type: string, key: string, label?: string): unknown => {
  const l = label || '';
  const k = key.toLowerCase();
  if (k.includes('qrcode')) return 'SAMPLE-QR-001';
  if (k.includes('barcode')) return '1234567890';
  if (k.includes('image_url') || (k.includes('image') && k.includes('url'))) {
    return 'https://placehold.co/120x80/f0f2f5/a8b1bd?text=IMG';
  }
  if (type === 'image') return 'https://placehold.co/400x400/f0f2f5/a8b1bd?text=Image';
  if (type === 'signature') return 'https://placehold.co/200x100/f0f2f5/a8b1bd?text=Signature';
  if (l.includes('日期') || l.includes('时间') || k.includes('date') || k.includes('time')) {
    return formatDateTime(new Date(), 'YYYY-MM-DD HH:mm');
  }
  if (l.includes('数量') || l.includes('额') || k.includes('quantity') || k.includes('amount') || k.includes('price')) {
    return '1,280.00';
  }
  if (l.includes('编号') || l.includes('代码') || k.includes('码') || k.includes('code') || k.includes('no')) {
    return 'SN-20240218-0001';
  }
  if (l.includes('简称') || k.includes('chinese_short_name') || k.includes('short_name')) {
    return 'M6-壳体';
  }
  if (l.includes('型号') || k.includes('model_number')) {
    return 'WL-2024-A';
  }
  if (l.includes('名称') || l.includes('规格') || k.includes('name')) {
    return `测试${l || '数据'}`;
  }
  if (l.includes('人') || l.includes('员') || k.includes('user') || k.includes('creator')) {
    return '管理员';
  }
  if (l.includes('状态') || k.includes('status')) {
    return '进行中';
  }
  if (l.includes('备注') || k.includes('remark')) {
    return '无';
  }
  switch (type) {
    case 'number': return 888;
    case 'boolean': return true;
    default: return `{${label || key}}`;
  }
};

export const getSamplePreviewVariables = (type: string): Record<string, unknown> => {
  const schema = getSchemaByType(type);
  const result: Record<string, unknown> = {};
  result['print_user'] = '系统管理员';
  result['print_time'] = formatDateTime(new Date(), 'YYYY-MM-DD HH:mm:ss');
  result['dateTime'] = formatDateTime(new Date(), 'YYYY-MM-DD HH:mm:ss');
  result['date'] = formatDateTime(new Date(), 'YYYY-MM-DD');
  result['company_name'] = 'RiverEdge 智能制造演示环境';
  result['document_type_label'] = type;
  if (!schema) return result;
  const commonFields = PRINT_TEMPLATE_SCHEMAS.common.fields;
  const allFields = [...schema.fields, ...commonFields];
  for (const field of allFields) {
    if (field.type === 'array' && field.children?.length) {
      const arrKey = field.key;
      const sampleItems: Record<string, unknown>[] = [];
      for (let i = 0; i < 3; i++) {
        const item: Record<string, unknown> = {};
        for (const child of field.children) {
          const prop = child.key.split('.').pop() || '';
          item[prop] = getSampleValueByType(child.type, prop, child.label);
        }
        sampleItems.push(item);
      }
      result[arrKey] = sampleItems;
    } else {
      result[field.key] = getSampleValueByType(field.type, field.key, field.label);
    }
  }
  return result;
};

export interface ArrayTableTemplateConfig {
  arrayKey: string;
  label: string;
  maxRows?: number;
  columns: { key: string; label: string }[];
}

const ARRAY_TABLE_TEMPLATES: Record<string, ArrayTableTemplateConfig[]> = {
  work_order: [
    {
      arrayKey: 'operations',
      label: '工序列表',
      maxRows: 10,
      columns: [
        { key: 'sequence', label: '序号' },
        { key: 'operation_code', label: '工序编号' },
        { key: 'operation_name', label: '工序名称' },
        { key: 'status', label: '工序状态' },
        { key: 'workshop_name', label: '车间' },
        { key: 'work_center_name', label: '工作中心' },
        { key: 'completed_quantity', label: '完成数量' },
        { key: 'qualified_quantity', label: '合格数量' },
        { key: 'unqualified_quantity', label: '不合格数量' },
        { key: 'planned_start_date', label: '计划开始' },
        { key: 'planned_end_date', label: '计划结束' },
        { key: 'remarks', label: '备注' },
      ],
    },
  ],
  quotation: [
    {
      arrayKey: 'items',
      label: '明细列表',
      maxRows: 12,
      columns: [
        { key: 'chinese_short_name', label: '中文简称' },
        { key: 'model_number', label: '型号' },
        { key: 'image_url', label: '图片' },
        { key: 'material_unit', label: '单位' },
        { key: 'quote_quantity', label: '数量' },
        { key: 'unit_price', label: '单价（含税）' },
        { key: 'total_amount', label: '总价（含税）' },
        { key: 'material_code', label: '物料编号' },
        { key: 'material_name', label: '物料名称' },
        { key: 'material_spec', label: '规格' },
        { key: 'delivery_date', label: '行交货日' },
        { key: 'notes', label: '备注' },
      ],
    },
  ],
  other_inbound: [
    {
      arrayKey: 'items',
      label: '明细列表',
      maxRows: 12,
      columns: [
        { key: 'material_code', label: '物料编号' },
        { key: 'material_name', label: '物料名称' },
        { key: 'material_unit', label: '单位' },
        { key: 'inbound_quantity', label: '数量' },
        { key: 'unit_price', label: '单价' },
        { key: 'total_amount', label: '金额' },
        { key: 'batch_number', label: '批次号' },
        { key: 'notes', label: '备注' },
      ],
    },
  ],
  other_outbound: [
    {
      arrayKey: 'items',
      label: '明细列表',
      maxRows: 12,
      columns: [
        { key: 'material_code', label: '物料编号' },
        { key: 'material_name', label: '物料名称' },
        { key: 'material_unit', label: '单位' },
        { key: 'outbound_quantity', label: '数量' },
        { key: 'unit_price', label: '单价' },
        { key: 'total_amount', label: '金额' },
        { key: 'batch_number', label: '批次号' },
        { key: 'notes', label: '备注' },
      ],
    },
  ],
  material_borrow: [
    {
      arrayKey: 'items',
      label: '明细列表',
      maxRows: 12,
      columns: [
        { key: 'material_code', label: '物料编号' },
        { key: 'material_name', label: '物料名称' },
        { key: 'material_spec', label: '规格' },
        { key: 'material_unit', label: '单位' },
        { key: 'borrow_quantity', label: '借出数量' },
        { key: 'returned_quantity', label: '已归还' },
        { key: 'warehouse_name', label: '仓库' },
        { key: 'notes', label: '备注' },
      ],
    },
  ],
  material_return: [
    {
      arrayKey: 'items',
      label: '明细列表',
      maxRows: 12,
      columns: [
        { key: 'material_code', label: '物料编号' },
        { key: 'material_name', label: '物料名称' },
        { key: 'material_spec', label: '规格' },
        { key: 'material_unit', label: '单位' },
        { key: 'return_quantity', label: '归还数量' },
        { key: 'warehouse_name', label: '仓库' },
        { key: 'notes', label: '备注' },
      ],
    },
  ],
  delivery_notice: [
    {
      arrayKey: 'items',
      label: '明细列表',
      maxRows: 12,
      columns: [
        { key: 'material_code', label: '物料编号' },
        { key: 'material_name', label: '物料名称' },
        { key: 'material_spec', label: '规格' },
        { key: 'material_unit', label: '单位' },
        { key: 'notice_quantity', label: '通知数量' },
        { key: 'unit_price', label: '单价' },
        { key: 'total_amount', label: '金额' },
        { key: 'notes', label: '备注' },
      ],
    },
  ],
  production_picking: [
    {
      arrayKey: 'items',
      label: '明细列表',
      maxRows: 15,
      columns: [
        { key: 'material_code', label: '物料编号' },
        { key: 'material_name', label: '物料名称' },
        { key: 'material_spec', label: '规格' },
        { key: 'material_unit', label: '单位' },
        { key: 'required_quantity', label: '需求数量' },
        { key: 'picked_quantity', label: '已领数量' },
        { key: 'remaining_quantity', label: '剩余数量' },
        { key: 'warehouse_name', label: '仓库' },
        { key: 'location_code', label: '库位' },
        { key: 'batch_number', label: '批次号' },
        { key: 'status', label: '状态' },
        { key: 'notes', label: '备注' },
      ],
    },
  ],
  production_return: [
    {
      arrayKey: 'items',
      label: '明细列表',
      maxRows: 15,
      columns: [
        { key: 'material_code', label: '物料编号' },
        { key: 'material_name', label: '物料名称' },
        { key: 'material_spec', label: '规格' },
        { key: 'material_unit', label: '单位' },
        { key: 'return_quantity', label: '退料数量' },
        { key: 'warehouse_name', label: '仓库' },
        { key: 'location_code', label: '库位' },
        { key: 'batch_number', label: '批次号' },
        { key: 'status', label: '状态' },
        { key: 'notes', label: '备注' },
      ],
    },
  ],
  finished_goods_receipt: [
    {
      arrayKey: 'items',
      label: '明细列表',
      maxRows: 15,
      columns: [
        { key: 'material_code', label: '物料编号' },
        { key: 'material_name', label: '物料名称' },
        { key: 'material_spec', label: '规格' },
        { key: 'material_unit', label: '单位' },
        { key: 'receipt_quantity', label: '入库数量' },
        { key: 'qualified_quantity', label: '合格数量' },
        { key: 'unqualified_quantity', label: '不合格数量' },
        { key: 'location_code', label: '库位' },
        { key: 'batch_number', label: '批次号' },
        { key: 'quality_status', label: '质量状态' },
        { key: 'status', label: '状态' },
        { key: 'notes', label: '备注' },
      ],
    },
  ],
  semi_finished_goods_receipt: [
    {
      arrayKey: 'items',
      label: '明细列表',
      maxRows: 15,
      columns: [
        { key: 'material_code', label: '物料编号' },
        { key: 'material_name', label: '物料名称' },
        { key: 'material_spec', label: '规格' },
        { key: 'material_unit', label: '单位' },
        { key: 'receipt_quantity', label: '入库数量' },
        { key: 'qualified_quantity', label: '合格数量' },
        { key: 'unqualified_quantity', label: '不合格数量' },
        { key: 'location_code', label: '库位' },
        { key: 'batch_number', label: '批次号' },
        { key: 'quality_status', label: '质量状态' },
        { key: 'status', label: '状态' },
        { key: 'notes', label: '备注' },
      ],
    },
  ],
  sales_delivery: [
    {
      arrayKey: 'items',
      label: '明细列表',
      maxRows: 15,
      columns: [
        { key: 'material_code', label: '物料编号' },
        { key: 'material_name', label: '物料名称' },
        { key: 'material_spec', label: '规格' },
        { key: 'material_unit', label: '单位' },
        { key: 'delivery_quantity', label: '出库数量' },
        { key: 'unit_price', label: '单价' },
        { key: 'total_amount', label: '金额' },
        { key: 'location_code', label: '库位' },
        { key: 'batch_number', label: '批次号' },
        { key: 'status', label: '状态' },
        { key: 'notes', label: '备注' },
      ],
    },
  ],
  purchase_order: [
    {
      arrayKey: 'items',
      label: '明细列表',
      maxRows: 15,
      columns: [
        { key: 'material_code', label: '物料编号' },
        { key: 'material_name', label: '物料名称' },
        { key: 'material_spec', label: '规格' },
        { key: 'material_unit', label: '单位' },
        { key: 'ordered_quantity', label: '采购数量' },
        { key: 'unit_price', label: '单价' },
        { key: 'total_amount', label: '金额' },
        { key: 'received_quantity', label: '已到货' },
        { key: 'outstanding_quantity', label: '未到货' },
        { key: 'required_date', label: '要求到货日' },
        { key: 'notes', label: '备注' },
      ],
    },
  ],
  purchase_receipt: [
    {
      arrayKey: 'items',
      label: '明细列表',
      maxRows: 15,
      columns: [
        { key: 'material_code', label: '物料编号' },
        { key: 'material_name', label: '物料名称' },
        { key: 'material_spec', label: '规格' },
        { key: 'material_unit', label: '单位' },
        { key: 'receipt_quantity', label: '入库数量' },
        { key: 'unit_price', label: '单价' },
        { key: 'total_amount', label: '金额' },
        { key: 'qualified_quantity', label: '合格数量' },
        { key: 'unqualified_quantity', label: '不合格数量' },
        { key: 'warehouse_name', label: '行仓库' },
        { key: 'location_code', label: '库位' },
        { key: 'batch_number', label: '批次号' },
        { key: 'quality_status', label: '质量状态' },
        { key: 'status', label: '状态' },
        { key: 'notes', label: '备注' },
      ],
    },
  ],
  sales_order: [
    {
      arrayKey: 'items',
      label: '明细列表',
      maxRows: 15,
      columns: [
        { key: 'chinese_short_name', label: '中文简称' },
        { key: 'model_number', label: '型号' },
        { key: 'image_url', label: '图片' },
        { key: 'material_code', label: '物料编号' },
        { key: 'material_name', label: '物料名称' },
        { key: 'material_spec', label: '规格' },
        { key: 'material_unit', label: '单位' },
        { key: 'order_quantity', label: '订单数量' },
        { key: 'quote_quantity', label: '数量' },
        { key: 'delivered_quantity', label: '已交货' },
        { key: 'remaining_quantity', label: '剩余数量' },
        { key: 'unit_price', label: '单价' },
        { key: 'tax_rate', label: '税率' },
        { key: 'total_amount', label: '价税合计' },
        { key: 'delivery_date', label: '行交货日' },
        { key: 'delivery_status', label: '交货状态' },
        { key: 'work_order_code', label: '工单' },
        { key: 'notes', label: '备注' },
      ],
    },
  ],
};

export const getArrayTableTemplates = (type: string): ArrayTableTemplateConfig[] => {
  return ARRAY_TABLE_TEMPLATES[type] || [];
};

export const getArrayTableInsertText = (config: ArrayTableTemplateConfig): string => {
  const sep = ' | ';
  const header = config.columns.map((c) => c.label).join(sep);
  const lines: string[] = [header];
  const n = config.maxRows ?? 5;
  for (let i = 0; i < n; i++) {
    const cells = config.columns.map((c) => {
      const fullKey = `${config.arrayKey}.${i}.${c.key}`;
      return `{{${fullKey}}}`;
    });
    lines.push(cells.join(sep));
  }
  return lines.join('\r\n') + '\r\n';
};

export const getTemplateVariableItems = (type: string): TemplateVariableItem[] => {
  const schema = getSchemaByType(type);
  if (!schema) return [];
  const items: TemplateVariableItem[] = [];
  const commonFields = PRINT_TEMPLATE_SCHEMAS.common.fields;
  const allFields = [...schema.fields, ...commonFields];
  for (const field of allFields) {
    if (field.type === 'array' && field.children?.length) {
      items.push({ key: field.key, label: field.label, kind: 'detailTable' });
    } else {
      items.push({ key: field.key, label: field.label });
    }
  }
  return items;
};

export const getKeyByLabel = (label: string): string | undefined => {
  for (const group of Object.values(PRINT_TEMPLATE_SCHEMAS)) {
    for (const field of group.fields) {
      if (field.label === label) return field.key;
      if (field.type === 'array' && field.children) {
        for (const child of field.children) {
          if (child.label === label) return child.key;
        }
      }
    }
  }
  return undefined;
};
