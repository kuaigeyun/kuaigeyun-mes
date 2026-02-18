/**
 * pdfme 模板工具
 *
 * 检测模板格式、将业务变量转换为 pdfme inputs、预加载字段到模板
 */

import type { Template } from '@pdfme/common';

/** 单变量项 */
export interface TemplateVariableItem {
  key: string;
  label: string;
}

/** 表格型模板配置 */
export interface ArrayTableTemplateConfig {
  arrayKey: string;
  label: string;
  maxRows?: number;
  columns: { key: string; label: string }[];
}

/**
 * 将业务字段预加载到 pdfme 模板
 * 空模板时调用，在「字段列表」中生成可编辑的 schema
 */
export function buildTemplateWithFields(
  template: Template,
  variableItems: TemplateVariableItem[],
  arrayTableConfigs: ArrayTableTemplateConfig[] = []
): Template {
  const pageSchemas: any[] = [];
  let y = 10;

  const arrayKeys = new Set(arrayTableConfigs.map((c) => c.arrayKey));
  // 单变量：添加 text 或 qrcode schema（跳过数组子项如 operations.0.xxx）
  for (const item of variableItems) {
    const parts = item.key.split('.');
    if (parts.length >= 3 && /^\d+$/.test(parts[1]) && arrayKeys.has(parts[0])) {
      continue; // 跳过 operations.0.xxx 这类，由表格覆盖
    }
    if (item.key.endsWith('_qrcode')) {
      pageSchemas.push({
        name: item.key,
        type: 'qrcode',
        position: { x: 10, y },
        width: 30,
        height: 30,
        content: 'WO-SAMPLE-001', // 设计器预览用，实际渲染由 inputs 提供
        backgroundColor: '#ffffff',
        barColor: '#000000',
      });
      y += 36;
    } else if (item.key === 'signature') {
      pageSchemas.push({
        name: item.key,
        type: 'signature',
        position: { x: 10, y },
        width: 80,
        height: 40,
        content: '',
        rotate: 0,
        opacity: 1,
      });
      y += 46;
    } else {
      pageSchemas.push({
        name: item.key,
        type: 'text',
        position: { x: 10, y },
        width: 80,
        height: 8,
        content: `{${item.key}}`,
        readOnly: true,
      });
      y += 12;
    }
  }

  // 表格型：添加 table schema
  for (const config of arrayTableConfigs) {
    const rowCount = Math.min(3, config.maxRows ?? 5);
    const sampleRows = Array.from({ length: rowCount }, (_, i) =>
      config.columns.map((_, j) => `示例${i + 1}-${j + 1}`)
    );
    pageSchemas.push({
      name: config.arrayKey,
      type: 'table',
      position: { x: 10, y },
      width: 170,
      height: 50,
      showHead: true,
      head: config.columns.map((c) => c.label),
      headWidthPercentages: config.columns.map(() => 100 / config.columns.length),
      content: JSON.stringify(sampleRows),
      tableStyles: { borderWidth: 0.3, borderColor: '#000000' },
      headStyles: {
        fontSize: 10,
        alignment: 'center',
        verticalAlignment: 'middle',
        backgroundColor: '#f0f0f0',
      },
      bodyStyles: { fontSize: 9, alignment: 'left', verticalAlignment: 'middle' },
    });
    y += 60;
  }

  const newTemplate = JSON.parse(JSON.stringify(template)) as Template;
  newTemplate.schemas = [[...pageSchemas]];
  return newTemplate;
}

/** 
 * 为现有模板中的字段增加中文标签：将 "code" 转换为 "工单编号 (code)"
 * 仅在加载模板时调用，提升可读性而不破坏数据绑定
 */
export function enhanceTemplateWithLabels(
  template: Template,
  variableItems: TemplateVariableItem[]
): Template {
  if (!template.schemas) return template;
  
  const keyToLabelMap = new Map(variableItems.map(item => [item.key, item.label]));
  const next = JSON.parse(JSON.stringify(template)) as Template;
  
  // 遍历所有页面和所有 schema 项
  next.schemas = next.schemas.map((page: any[]) => {
    if (!Array.isArray(page)) return page;
    return page.map((schema: any) => {
      const currentName = schema.name;
      if (!currentName) return schema;

      // 如果能在变量字典中找到对应的中文 label，则进行替换
      const label = keyToLabelMap.get(currentName);
      if (label) {
        return { ...schema, name: label };
      }
      return schema;
    });
  });

  return next;
}

/** 检测 content 是否为 pdfme 模板格式 */
export function isPdfmeTemplate(content: string): boolean {
  try {
    const obj = JSON.parse(content);
    return (
      typeof obj === 'object' &&
      obj !== null &&
      (obj.basePdf !== undefined || obj.schemas !== undefined)
    );
  } catch {
    return false;
  }
}

/** 从嵌套对象按点号路径取值 */
function resolveValue(key: string, vars: Record<string, unknown>): unknown {
  const keys = key.split('.');
  let val: unknown = vars;
  for (const k of keys) {
    if (val === undefined || val === null) return undefined;
    if (typeof val === 'object' && !Array.isArray(val) && k in (val as object)) {
      val = (val as Record<string, unknown>)[k];
    } else if (Array.isArray(val) && /^\d+$/.test(k)) {
      val = val[parseInt(k, 10)];
    } else {
      return undefined;
    }
  }
  return val;
}

function formatValue(val: unknown): string {
  if (val == null) return '';
  if (typeof val === 'object' && !(val instanceof Date)) return JSON.stringify(val);
  return String(val);
}

/** 工序列表转 pdfme 表格 2D 数组 */
const OPERATIONS_TABLE_COLUMNS = [
  'sequence',
  'operation_code',
  'operation_name',
  'status',
  'work_center_name',
] as const;

function operationsToTableRows(operations: unknown[]): string[][] {
  return operations.map((op: any) =>
    OPERATIONS_TABLE_COLUMNS.map((col) => formatValue(op?.[col] ?? ''))
  );
}

/**
 * 将业务变量转换为 pdfme inputs 格式
 * - 文本 schema：inputs[schemaName] = 变量值
 * - 表格 schema：inputs[schemaName] = [[col1,col2,...], ...]
 * - 合并所有变量到 inputs，支持 Expression 表达式如 {code}、{code + " - " + name}
 */
export function variablesToPdfmeInputs(
  template: Template,
  variables: Record<string, unknown>
): Record<string, unknown>[] {
  const schemaInputs: Record<string, unknown> = {};
  const schemas = template.schemas?.[0] ?? [];

  for (const schema of schemas) {
    const name = (schema as any).name;
    const type = (schema as any).type;
    if (!name) continue;

    if (type === 'table') {
      const arrData = variables[name] ?? resolveValue(name, variables);
      if (Array.isArray(arrData)) {
        if (name === 'operations') {
          schemaInputs[name] = operationsToTableRows(arrData);
        } else {
          schemaInputs[name] = arrData.map((item) =>
            typeof item === 'object' && item !== null
              ? Object.values(item)
              : [formatValue(item)]
          );
        }
      } else {
        schemaInputs[name] = [];
      }
    } else {
      const val = variables[name] ?? resolveValue(name, variables);
      if (val !== undefined && val !== null) {
        schemaInputs[name] = formatValue(val);
      }
    }
  }

  // 合并所有变量到 inputs，供 Expression 表达式使用（如 {code}、{code + " - " + name}）
  const variableContext: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(variables)) {
    if (Array.isArray(v)) continue;
    variableContext[k] = formatValue(v);
  }
  const inputs = { ...variableContext, ...schemaInputs };
  return [inputs];
}
