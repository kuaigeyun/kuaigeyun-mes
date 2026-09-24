/** 新建工单：将表单工序选择转为创建 API 载荷 */
export function buildOperationsForCreatePayload(
  values: { operations?: number[]; allow_operation_jump?: boolean },
  selectedOperations: Array<Record<string, unknown>>,
  operationList: Array<{
    id: number
    code: string
    name: string
    reportingType?: string
    reporting_type?: string
    overReportMode?: string
    over_report_mode?: string
    overReportValue?: number
    over_report_value?: number
  }>,
): Array<Record<string, unknown>> | undefined {
  const woAllowJump = Boolean(values.allow_operation_jump)
  if (values.operations && Array.isArray(values.operations) && values.operations.length > 0) {
    return values.operations.map((opId: number, index: number) => {
      const operationDetail = operationList.find((op) => op.id === opId)
      if (!operationDetail) {
        throw new Error(`工序ID ${opId} 不存在`)
      }
      const so = selectedOperations.find((o) => o.operation_id === opId)
      const isNode = Boolean(so?.is_node_operation)
      return {
        operation_id: opId,
        operation_code: operationDetail.code,
        operation_name: operationDetail.name,
        sequence: index + 1,
        reporting_type:
          so?.reporting_type ??
          operationDetail.reportingType ??
          operationDetail.reporting_type ??
          'quantity',
        allow_jump: woAllowJump && !isNode,
        is_node_operation: isNode,
        over_report_mode:
          so?.over_report_mode ??
          operationDetail.overReportMode ??
          operationDetail.over_report_mode ??
          'none',
        over_report_value:
          Number(
            so?.over_report_value ??
              operationDetail.overReportValue ??
              operationDetail.over_report_value ??
              0,
          ) || 0,
      }
    })
  }
  if (selectedOperations.length > 0) {
    return selectedOperations.map((op, i) => ({
      operation_id: op.operation_id,
      operation_code: op.operation_code,
      operation_name: op.operation_name,
      sequence: op.sequence ?? i + 1,
      reporting_type: op.reporting_type ?? 'quantity',
      allow_jump: woAllowJump && !Boolean(op.is_node_operation),
      is_node_operation: op.is_node_operation ?? false,
      over_report_mode: op.over_report_mode ?? 'none',
      over_report_value: Number(op.over_report_value ?? 0) || 0,
      ...(Array.isArray(op.assigned_worker_ids) && (op.assigned_worker_ids as unknown[]).length
        ? { assigned_worker_ids: op.assigned_worker_ids }
        : {}),
      ...(op.assigned_worker_id != null ? { assigned_worker_id: op.assigned_worker_id } : {}),
      ...(op.assigned_team_id != null ? { assigned_team_id: op.assigned_team_id } : {}),
      ...(op.assigned_equipment_id != null
        ? { assigned_equipment_id: op.assigned_equipment_id }
        : {}),
      ...(op.workshop_id != null ? { workshop_id: op.workshop_id } : {}),
    }))
  }
  return undefined
}
