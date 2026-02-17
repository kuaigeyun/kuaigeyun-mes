/**
 * 打印模板数据模式定义
 * 用于在设计器中提示可用变量
 * 字段 key 与 API 返回的 snake_case 保持一致，确保数据绑定正确
 */

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
};

export const getSchemaByType = (type: string): TemplateSchema | undefined => {
  return PRINT_TEMPLATE_SCHEMAS[type];
};

/** 关联业务单据选项，用于新建/编辑模板时选择 */
export const DOCUMENT_TYPE_OPTIONS = Object.entries(PRINT_TEMPLATE_SCHEMAS).map(([value, schema]) => ({
  label: schema.name,
  value,
}));

/** 变量项：key 用于插入，label 用于展示 */
export interface TemplateVariableItem {
  key: string;
  label: string;
}

/**
 * 获取可用于模板插入的变量列表（扁平化，支持嵌套如 operations.0.operation_name）
 */
export const getTemplateVariableItems = (type: string): TemplateVariableItem[] => {
  const schema = getSchemaByType(type);
  if (!schema) return [];

  const items: TemplateVariableItem[] = [];
  for (const field of schema.fields) {
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
