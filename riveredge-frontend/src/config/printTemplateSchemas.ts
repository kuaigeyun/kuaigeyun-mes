/**
 * 打印模板数据模式定义
 * 用于在设计器中提示可用变量
 * 字段 key 与 API 返回的 snake_case 保持一致，确保数据绑定正确
 */

import dayjs from 'dayjs';

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

export const PRINT_TEMPLATE_SCHEMAS: Record<string, TemplateSchema> = {
  work_order: {
    type: 'work_order',
    name: '工单',
    fields: [
      { key: 'code', label: '工单编号', type: 'string' },
      { key: 'work_order_qrcode', label: '工单二维码', type: 'string' },
      { key: 'signature', label: '签名', type: 'string' },
      { key: 'name', label: '工单名称', type: 'string' },
      { key: 'product_code', label: '产品编码', type: 'string' },
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
          { key: 'operations.0.operation_code', label: '工序编码（第1项）', type: 'string' },
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
      { key: 'code', label: '物料编码', type: 'string' },
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
      { key: 'work_order_code', label: '工单编号', type: 'string' },
      { key: 'workshop_name', label: '车间名称', type: 'string' },
      { key: 'status', label: '状态', type: 'string' },
      { key: 'picker_name', label: '领料人', type: 'string' },
      { key: 'picking_time', label: '领料时间', type: 'date' },
      { key: 'created_at', label: '创建时间', type: 'date' },
    ],
  },
  production_return: {
    type: 'production_return',
    name: '生产退料单',
    fields: [
      { key: 'code', label: '退料单号', type: 'string' },
      { key: 'work_order_code', label: '工单编号', type: 'string' },
      { key: 'picking_code', label: '领料单号', type: 'string' },
      { key: 'workshop_name', label: '车间名称', type: 'string' },
      { key: 'warehouse_name', label: '仓库名称', type: 'string' },
      { key: 'status', label: '状态', type: 'string' },
      { key: 'returner_name', label: '退料人', type: 'string' },
      { key: 'return_time', label: '退料时间', type: 'date' },
      { key: 'created_at', label: '创建时间', type: 'date' },
    ],
  },
  other_inbound: {
    type: 'other_inbound',
    name: '其他入库单',
    fields: [
      { key: 'code', label: '入库单号', type: 'string' },
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
          { key: 'items.0.material_code', label: '物料编码（第1项）', type: 'string' },
          { key: 'items.0.material_name', label: '物料名称（第1项）', type: 'string' },
          { key: 'items.0.inbound_quantity', label: '入库数量（第1项）', type: 'number' },
          { key: 'items.0.unit_price', label: '单价（第1项）', type: 'number' },
          { key: 'items.0.total_amount', label: '金额（第1项）', type: 'number' },
        ],
      },
    ],
  },
  quotation: {
    type: 'quotation',
    name: '报价单',
    fields: [
      { key: 'code', label: '报价单号', type: 'string' },
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
          { key: 'items.0.material_code', label: '物料编码（第1项）', type: 'string' },
          { key: 'items.0.material_name', label: '物料名称（第1项）', type: 'string' },
          { key: 'items.0.quote_quantity', label: '报价数量（第1项）', type: 'number' },
          { key: 'items.0.unit_price', label: '单价（第1项）', type: 'number' },
          { key: 'items.0.total_amount', label: '金额（第1项）', type: 'number' },
        ],
      },
    ],
  },
  material_borrow: {
    type: 'material_borrow',
    name: '借料单',
    fields: [
      { key: 'borrow_code', label: '借料单号', type: 'string' },
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
          { key: 'items.0.material_code', label: '物料编码（第1项）', type: 'string' },
          { key: 'items.0.material_name', label: '物料名称（第1项）', type: 'string' },
          { key: 'items.0.borrow_quantity', label: '借出数量（第1项）', type: 'number' },
          { key: 'items.0.returned_quantity', label: '已归还数量（第1项）', type: 'number' },
        ],
      },
    ],
  },
  material_return: {
    type: 'material_return',
    name: '还料单',
    fields: [
      { key: 'return_code', label: '还料单号', type: 'string' },
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
          { key: 'items.0.material_code', label: '物料编码（第1项）', type: 'string' },
          { key: 'items.0.material_name', label: '物料名称（第1项）', type: 'string' },
          { key: 'items.0.return_quantity', label: '归还数量（第1项）', type: 'number' },
        ],
      },
    ],
  },
  other_outbound: {
    type: 'other_outbound',
    name: '其他出库单',
    fields: [
      { key: 'code', label: '出库单号', type: 'string' },
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
          { key: 'items.0.material_code', label: '物料编码（第1项）', type: 'string' },
          { key: 'items.0.material_name', label: '物料名称（第1项）', type: 'string' },
          { key: 'items.0.outbound_quantity', label: '出库数量（第1项）', type: 'number' },
          { key: 'items.0.unit_price', label: '单价（第1项）', type: 'number' },
          { key: 'items.0.total_amount', label: '金额（第1项）', type: 'number' },
        ],
      },
    ],
  },
  finished_goods_receipt: {
    type: 'finished_goods_receipt',
    name: '成品入库单',
    fields: [
      { key: 'code', label: '入库单号', type: 'string' },
      { key: 'work_order_code', label: '工单编号', type: 'string' },
      { key: 'warehouse_name', label: '仓库名称', type: 'string' },
      { key: 'total_quantity', label: '总数量', type: 'number' },
      { key: 'status', label: '状态', type: 'string' },
      { key: 'receiver_name', label: '收货人', type: 'string' },
      { key: 'receipt_time', label: '入库时间', type: 'date' },
      { key: 'created_at', label: '创建时间', type: 'date' },
    ],
  },
  sales_delivery: {
    type: 'sales_delivery',
    name: '销售出库单',
    fields: [
      { key: 'code', label: '出库单号', type: 'string' },
      { key: 'sales_order_code', label: '销售订单号', type: 'string' },
      { key: 'customer_name', label: '客户名称', type: 'string' },
      { key: 'warehouse_name', label: '仓库名称', type: 'string' },
      { key: 'total_quantity', label: '总数量', type: 'number' },
      { key: 'total_amount', label: '总金额', type: 'number' },
      { key: 'status', label: '状态', type: 'string' },
      { key: 'deliverer_name', label: '发货人', type: 'string' },
      { key: 'delivery_time', label: '发货时间', type: 'date' },
      { key: 'created_at', label: '创建时间', type: 'date' },
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
    ],
  },
  purchase_receipt: {
    type: 'purchase_receipt',
    name: '采购入库单',
    fields: [
      { key: 'code', label: '入库单号', type: 'string' },
      { key: 'purchase_order_code', label: '采购订单号', type: 'string' },
      { key: 'supplier_name', label: '供应商名称', type: 'string' },
      { key: 'warehouse_name', label: '仓库名称', type: 'string' },
      { key: 'total_quantity', label: '总数量', type: 'number' },
      { key: 'total_amount', label: '总金额', type: 'number' },
      { key: 'status', label: '状态', type: 'string' },
      { key: 'receiver_name', label: '收货人', type: 'string' },
      { key: 'receipt_time', label: '入库时间', type: 'date' },
      { key: 'created_at', label: '创建时间', type: 'date' },
    ],
  },
  delivery_notice: {
    type: 'delivery_notice',
    name: '送货单',
    fields: [
      { key: 'code', label: '通知单号', type: 'string' },
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
          { key: 'items.0.material_code', label: '物料编码（第1项）', type: 'string' },
          { key: 'items.0.material_name', label: '物料名称（第1项）', type: 'string' },
          { key: 'items.0.notice_quantity', label: '通知数量（第1项）', type: 'number' },
          { key: 'items.0.unit_price', label: '单价（第1项）', type: 'number' },
        ],
      },
    ],
  },
  sample_trial: {
    type: 'sample_trial',
    name: '样品试用单',
    fields: [
      { key: 'code', label: '试用单号', type: 'string' },
      { key: 'customer_name', label: '客户名称', type: 'string' },
      { key: 'customer_contact', label: '客户联系人', type: 'string' },
      { key: 'customer_phone', label: '客户电话', type: 'string' },
      { key: 'trial_purpose', label: '试用目的', type: 'string' },
      { key: 'trial_period_start', label: '试用开始日期', type: 'date' },
      { key: 'trial_period_end', label: '试用结束日期', type: 'date' },
      { key: 'sales_order_code', label: '关联销售订单号', type: 'string' },
      { key: 'other_outbound_code', label: '关联其他出库单号', type: 'string' },
      { key: 'status', label: '状态', type: 'string' },
      { key: 'total_quantity', label: '总数量', type: 'number' },
      { key: 'total_amount', label: '总金额', type: 'number' },
      { key: 'notes', label: '备注', type: 'string' },
      { key: 'created_at', label: '创建时间', type: 'date' },
      {
        key: 'items',
        label: '明细列表',
        type: 'array',
        children: [
          { key: 'items.0.material_code', label: '物料编码（第1项）', type: 'string' },
          { key: 'items.0.material_name', label: '物料名称（第1项）', type: 'string' },
          { key: 'items.0.trial_quantity', label: '试用数量（第1项）', type: 'number' },
          { key: 'items.0.unit_price', label: '单价（第1项）', type: 'number' },
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
  sales_delivery: 'SALES_DELIVERY_PRINT',
  purchase_order: 'PURCHASE_ORDER_PRINT',
  purchase_receipt: 'PURCHASE_RECEIPT_PRINT',
  sales_forecast: 'SALES_FORECAST_PRINT',
  sales_order: 'SALES_ORDER_PRINT',
  quotation: 'QUOTATION_PRINT',
  delivery_notice: 'DELIVERY_NOTICE_PRINT',
  sample_trial: 'SAMPLE_TRIAL_PRINT',
};

export interface TemplateVariableItem {
  key: string;
  label: string;
}

const getSampleValueByType = (type: string, key: string, label?: string): unknown => {
  const l = label || '';
  const k = key.toLowerCase();
  if (k.includes('qrcode')) return 'SAMPLE-QR-001';
  if (k.includes('barcode')) return '1234567890';
  if (type === 'image') return 'https://placehold.co/400x400/f0f2f5/a8b1bd?text=Image';
  if (type === 'signature') return 'https://placehold.co/200x100/f0f2f5/a8b1bd?text=Signature';
  if (l.includes('日期') || l.includes('时间') || k.includes('date') || k.includes('time')) {
    return dayjs().format('YYYY-MM-DD HH:mm');
  }
  if (l.includes('数量') || l.includes('额') || k.includes('quantity') || k.includes('amount') || k.includes('price')) {
    return '1,280.00';
  }
  if (l.includes('编号') || l.includes('代码') || k.includes('码') || k.includes('code') || k.includes('no')) {
    return 'SN-20240218-0001';
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
  result['print_time'] = dayjs().format('YYYY-MM-DD HH:mm:ss');
  result['dateTime'] = dayjs().format('YYYY-MM-DD HH:mm:ss');
  result['date'] = dayjs().format('YYYY-MM-DD');
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
        { key: 'operation_code', label: '工序编码' },
        { key: 'operation_name', label: '工序名称' },
        { key: 'status', label: '工序状态' },
        { key: 'work_center_name', label: '工作中心' },
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
      for (const child of field.children) {
        items.push({ key: child.key, label: child.label });
      }
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
