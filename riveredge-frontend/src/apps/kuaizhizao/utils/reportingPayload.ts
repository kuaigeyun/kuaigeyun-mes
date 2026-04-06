/**
 * 创建报工记录 POST body 与 ReportingRecordCreate 对齐。
 * 工单 name 等字段在后端可为 null，直接序列化会得到 JSON null，Pydantic str 校验报「Input should be a valid string」。
 *
 * @param workOrder 可选；当 payload 未带 product_name 时，用其补全 work_order_name 回退链
 */
export function coerceReportingCreateStrings(
  payload: Record<string, any>,
  workOrder?: Record<string, any>
): Record<string, any> {
  const p = { ...payload };
  const wo = workOrder ?? {};
  p.work_order_code = String(p.work_order_code ?? wo.code ?? '');
  const explicitName = p.work_order_name != null && p.work_order_name !== '';
  p.work_order_name = explicitName
    ? String(p.work_order_name)
    : String(p.product_name ?? wo.product_name ?? p.work_order_code ?? wo.code ?? '');
  p.operation_code = String(p.operation_code ?? p.operationCode ?? '');
  p.operation_name = String(p.operation_name ?? p.operationName ?? '');
  p.worker_name = String(p.worker_name ?? '');
  if (p.remarks == null || p.remarks === '') {
    delete p.remarks;
  } else {
    p.remarks = String(p.remarks);
  }
  delete p.operationCode;
  delete p.operationName;
  delete p.product_name;
  return p;
}
