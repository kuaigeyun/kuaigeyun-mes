/**
 * 工单列表行展开工序卡：TanStack 缓存键与写穿刷新。
 * 派工 / 开工 / 报工后必须 sync，避免 staleTime 内复开仍显示旧人名等字段。
 */
import type { QueryClient } from '@tanstack/react-query'
import { workOrderApi } from '../../../services/production'
import type { WorkOrderOperationStep } from './workOrderOperationSteps'

export const WORK_ORDER_ROW_EXPAND_QK = 'workOrderRowExpand' as const

/** 复开短缓存；变更后走 syncWorkOrderRowExpand 写穿，不依赖仅 invalidate */
export const WORK_ORDER_ROW_EXPAND_STALE_MS = 5_000

export type WorkOrderOperationsBundle = {
  manufacturing_mode: string
  operations: any[]
  status?: string
  downstream_push_progress?: number
  operation_steps?: WorkOrderOperationStep[]
}

export function workOrderRowExpandQueryKey(
  panelWorkOrderId: number | string,
  operationSourceId: number | string,
) {
  return [WORK_ORDER_ROW_EXPAND_QK, Number(panelWorkOrderId), Number(operationSourceId)] as const
}

export function parseWorkOrderOperationsBundle(
  res: unknown,
  fallbackManufacturingMode = 'fabrication',
): WorkOrderOperationsBundle {
  if (
    res &&
    typeof res === 'object' &&
    !Array.isArray(res) &&
    Array.isArray((res as { operations?: unknown }).operations)
  ) {
    const r = res as {
      manufacturing_mode?: string
      operations: any[]
      status?: string
      downstream_push_progress?: number
      operation_steps?: WorkOrderOperationStep[]
    }
    return {
      manufacturing_mode: r.manufacturing_mode || fallbackManufacturingMode,
      operations: r.operations || [],
      status: r.status,
      downstream_push_progress: r.downstream_push_progress,
      operation_steps: r.operation_steps,
    }
  }
  return {
    manufacturing_mode: fallbackManufacturingMode,
    operations: Array.isArray(res) ? res : [],
  }
}

/**
 * 强制拉取工序展开数据并写穿缓存（取消进行中的旧请求，避免旧响应回盖）。
 */
export async function syncWorkOrderRowExpand(
  queryClient: QueryClient,
  panelWorkOrderId: number,
  operationSourceId: number,
  fallbackManufacturingMode = 'fabrication',
): Promise<WorkOrderOperationsBundle> {
  const queryKey = workOrderRowExpandQueryKey(panelWorkOrderId, operationSourceId)
  await queryClient.cancelQueries({ queryKey: [WORK_ORDER_ROW_EXPAND_QK, Number(panelWorkOrderId)] })
  const res = await workOrderApi.getOperations(String(operationSourceId), { includeMeta: true })
  const bundle = parseWorkOrderOperationsBundle(res, fallbackManufacturingMode)
  queryClient.setQueryData(queryKey, bundle)
  return bundle
}

/** 用单条工序响应立刻补丁展开缓存（派工返回后先上屏，再 sync 全量）。 */
export function patchWorkOrderRowExpandOperation(
  queryClient: QueryClient,
  panelWorkOrderId: number,
  operationSourceId: number,
  updatedOperation: { id?: number | string; [key: string]: unknown },
): void {
  const opId = Number(updatedOperation?.id)
  if (!Number.isFinite(opId) || opId <= 0) return
  const queryKey = workOrderRowExpandQueryKey(panelWorkOrderId, operationSourceId)
  const cached = queryClient.getQueryData(queryKey) as WorkOrderOperationsBundle | undefined
  if (!cached?.operations?.length) return
  queryClient.setQueryData(queryKey, {
    ...cached,
    operations: cached.operations.map((op) =>
      Number(op?.id) === opId ? { ...op, ...updatedOperation } : op,
    ),
  })
}
