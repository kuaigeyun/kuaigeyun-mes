
/**
 * 打印模板数据模式定义
 * 用于在设计器中提示可用变量
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
  'work_order': {
    type: 'work_order',
    name: '工单',
    fields: [
      { key: 'code', label: '工单编号', type: 'string' },
      { key: 'name', label: '工单名称', type: 'string' },
      { key: 'productName', label: '产品名称', type: 'string' },
      { key: 'quantity', label: '生产数量', type: 'number' },
      { key: 'unit', label: '单位', type: 'string' },
      { key: 'status', label: '状态', type: 'string' },
      { key: 'productionMode', label: '生产模式', type: 'string' },
      { key: 'startDate', label: '计划开始时间', type: 'date' },
      { key: 'endDate', label: '计划结束时间', type: 'date' },
      { key: 'priority', label: '优先级', type: 'number' },
      { key: 'remarks', label: '备注', type: 'string' },
      { key: 'creator', label: '创建人', type: 'string' },
      { key: 'createTime', label: '创建时间', type: 'date' },
    ]
  },
  'material': {
    type: 'material',
    name: '物料',
    fields: [
      { key: 'code', label: '物料编码', type: 'string' },
      { key: 'name', label: '物料名称', type: 'string' },
      { key: 'spec', label: '规格型号', type: 'string' },
      { key: 'unit', label: '单位', type: 'string' },
      { key: 'category', label: '分类', type: 'string' },
    ]
  }
};

export const getSchemaByType = (type: string): TemplateSchema | undefined => {
  return PRINT_TEMPLATE_SCHEMAS[type];
};
