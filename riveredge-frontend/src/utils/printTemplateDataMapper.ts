/**
 * 打印模板数据映射工具
 *
 * 将业务 API 返回的数据转换为模板变量格式，支持扁平字段和嵌套路径（如 operations.0.operation_name）
 */

import dayjs from 'dayjs';

const DATE_FORMAT = 'YYYY-MM-DD';
const DATETIME_FORMAT = 'YYYY-MM-DD HH:mm';

/**
 * 从嵌套对象中按点号路径取值，如 "operations.0.operation_name"
 */
function resolveValue(key: string, vars: Record<string, unknown>): unknown {
  const keys = key.split('.');
  let val: unknown = vars;
  for (const k of keys) {
    if (val === undefined || val === null) return '';
    if (typeof val === 'object' && !Array.isArray(val) && k in (val as object)) {
      val = (val as Record<string, unknown>)[k];
    } else if (Array.isArray(val) && /^\d+$/.test(k)) {
      val = val[parseInt(k, 10)];
    } else {
      return '';
    }
  }
  return val !== undefined && val !== null ? val : '';
}

/**
 * 格式化日期/时间值
 */
function formatDateValue(val: unknown): string {
  if (val == null) return '';
  if (typeof val === 'string') {
    const d = dayjs(val);
    return d.isValid() ? (val.length > 10 ? d.format(DATETIME_FORMAT) : d.format(DATE_FORMAT)) : String(val);
  }
  if (val instanceof Date) {
    return dayjs(val).format(DATETIME_FORMAT);
  }
  return String(val);
}

/**
 * 工单 API 返回的详情结构（与 workOrderApi.get 一致）
 */
export interface WorkOrderDetail {
  id?: number;
  uuid?: string;
  code?: string;
  name?: string;
  product_id?: number;
  product_code?: string;
  product_name?: string;
  quantity?: number | string;
  status?: string;
  production_mode?: string;
  workshop_name?: string;
  work_center_name?: string;
  planned_start_date?: string;
  planned_end_date?: string;
  priority?: string;
  remarks?: string;
  created_by_name?: string;
  created_at?: string;
  [key: string]: unknown;
}

/**
 * 工单工序结构（与 workOrderApi.getOperations 一致）
 */
export interface WorkOrderOperation {
  id?: number;
  uuid?: string;
  work_order_code?: string;
  operation_code?: string;
  operation_name?: string;
  sequence?: number;
  status?: string;
  workshop_name?: string;
  work_center_name?: string;
  planned_start_date?: string;
  planned_end_date?: string;
  actual_start_date?: string;
  actual_end_date?: string;
  completed_quantity?: number | string;
  qualified_quantity?: number | string;
  unqualified_quantity?: number | string;
  assigned_worker_name?: string;
  assigned_equipment_name?: string;
  remarks?: string;
  [key: string]: unknown;
}

/**
 * 将工单详情和工序列表转换为模板变量
 * 输出格式与后端 _format_work_order_data 及 Schema 的 key 保持一致
 */
export function mapWorkOrderToTemplateVariables(
  detail: WorkOrderDetail,
  operations: WorkOrderOperation[] = []
): Record<string, unknown> {
  const vars: Record<string, unknown> = {
    code: detail.code ?? '',
    name: detail.name ?? '',
    product_code: detail.product_code ?? '',
    product_name: detail.product_name ?? '',
    quantity: detail.quantity != null ? String(detail.quantity) : '',
    status: detail.status ?? '',
    production_mode: detail.production_mode ?? '',
    workshop_name: detail.workshop_name ?? '',
    work_center_name: detail.work_center_name ?? '',
    planned_start_date: detail.planned_start_date
      ? formatDateValue(detail.planned_start_date)
      : '',
    planned_end_date: detail.planned_end_date ? formatDateValue(detail.planned_end_date) : '',
    priority: detail.priority ?? '',
    remarks: detail.remarks ?? '',
    created_by_name: detail.created_by_name ?? '',
    created_at: detail.created_at ? formatDateValue(detail.created_at) : '',
  };

  // 添加 operations 数组，支持 operations.0.operation_name 等路径
  const opsFormatted = operations.map((op) => ({
    operation_code: op.operation_code ?? '',
    operation_name: op.operation_name ?? '',
    sequence: op.sequence ?? 0,
    status: op.status ?? '',
    workshop_name: op.workshop_name ?? '',
    work_center_name: op.work_center_name ?? '',
    planned_start_date: op.planned_start_date ? formatDateValue(op.planned_start_date) : '',
    planned_end_date: op.planned_end_date ? formatDateValue(op.planned_end_date) : '',
    actual_start_date: op.actual_start_date ? formatDateValue(op.actual_start_date) : '',
    actual_end_date: op.actual_end_date ? formatDateValue(op.actual_end_date) : '',
    completed_quantity: op.completed_quantity != null ? String(op.completed_quantity) : '',
    qualified_quantity: op.qualified_quantity != null ? String(op.qualified_quantity) : '',
    unqualified_quantity: op.unqualified_quantity != null ? String(op.unqualified_quantity) : '',
    assigned_worker_name: op.assigned_worker_name ?? '',
    assigned_equipment_name: op.assigned_equipment_name ?? '',
    remarks: op.remarks ?? '',
  }));

  vars.operations = opsFormatted;

  return vars;
}

/**
 * 通用：按点号路径从变量中取值并转为字符串
 * 供 UniverDocPreview 等组件使用
 */
export function getTemplateVariableValue(
  key: string,
  variables: Record<string, unknown>
): string {
  const val = resolveValue(key, variables);
  if (val == null) return '';
  if (typeof val === 'object' && !(val instanceof Date)) return JSON.stringify(val);
  return String(val);
}
