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
  // 通用演示字段（会被合并到所有单据类型中）
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

/** 关联业务单据选项，用于新建/编辑模板时选择 */
export const DOCUMENT_TYPE_OPTIONS = Object.entries(PRINT_TEMPLATE_SCHEMAS).map(([value, schema]) => ({
  label: schema.name,
  value,
}));

/** 单据类型到模板代码的映射，与后端 DOCUMENT_TEMPLATE_CODES 一致 */
export const DOCUMENT_TYPE_TO_CODE: Record<string, string> = {
  work_order: 'WORK_ORDER_PRINT',
  material: 'MATERIAL_PRINT',
  production_picking: 'PRODUCTION_PICKING_PRINT',
  finished_goods_receipt: 'FINISHED_GOODS_RECEIPT_PRINT',
  sales_delivery: 'SALES_DELIVERY_PRINT',
  purchase_order: 'PURCHASE_ORDER_PRINT',
  purchase_receipt: 'PURCHASE_RECEIPT_PRINT',
  sales_forecast: 'SALES_FORECAST_PRINT',
  sales_order: 'SALES_ORDER_PRINT',
};

/** 变量项：key 用于插入，label 用于展示 */
export interface TemplateVariableItem {
  key: string;
  label: string;
}

/**
 * 根据字段类型生成预览用示例值
 */
const getSampleValueByType = (type: string, key: string, label?: string): any => {
  const l = label || '';
  const k = key.toLowerCase();

  // 特殊类型处理
  if (k.includes('qrcode')) return 'SAMPLE-QR-001';
  if (k.includes('barcode')) return '1234567890';
  if (type === 'image') return 'https://placehold.co/400x400/f0f2f5/a8b1bd?text=Image';
  if (type === 'signature') return 'https://placehold.co/200x100/f0f2f5/a8b1bd?text=Signature';

  // 语义化匹配：根据 Label 或 Key 判断业务含义
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

  // 基础类型后备
  switch (type) {
    case 'number': return 888;
    case 'boolean': return true;
    default: return `{${label || key}}`;
  }
};

/**
 * 根据单据类型生成预览用示例变量数据，用于设计器预览时替换 {{variable}}
 */
export const getSamplePreviewVariables = (type: string): Record<string, unknown> => {
  const schema = getSchemaByType(type);
  const result: Record<string, unknown> = {};

  // 1. 注入全局内置变量 (用于页眉页脚预览)
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
      // 生成 3 条模拟明细数据
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

/** 表格型数组模板配置：用于生成可插入的表格占位符 */
export interface ArrayTableTemplateConfig {
  arrayKey: string;
  label: string;
  maxRows?: number;
  columns: { key: string; label: string }[];
}

/** 各单据类型下可插入的表格模板 */
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

/**
 * 获取可插入的表格型模板列表
 */
export const getArrayTableTemplates = (type: string): ArrayTableTemplateConfig[] => {
  return ARRAY_TABLE_TEMPLATES[type] || [];
};

/**
 * 生成表格型数据的插入文本（表头 + 变量占位符行）
 */
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

/**
 * 获取可用于模板插入的变量列表（扁平化，支持嵌套如 operations.0.operation_name）
 */
export const getTemplateVariableItems = (type: string): TemplateVariableItem[] => {
  const schema = getSchemaByType(type);
  if (!schema) return [];

  const items: TemplateVariableItem[] = [];
  const commonFields = PRINT_TEMPLATE_SCHEMAS.common.fields;
  const allFields = [...schema.fields, ...commonFields];

  for (const field of allFields) {
    if (field.type === 'array' && field.children?.length) {
      for (const child of field.children) {
        items.push({ 
          key: child.key, 
          label: child.label 
        });
      }
    } else {
      items.push({ 
        key: field.key, 
        label: field.label 
      });
    }
  }
  return items;
};

/**
 * 根据中文标签反查对应的英文变量 Key
 */
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
