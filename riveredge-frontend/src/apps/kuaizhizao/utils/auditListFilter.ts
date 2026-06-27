/**
 * 列表筛选：lifecycle 字段中的审核阶段名映射为 status / review_status（与审核列分离后仍支持统计卡跳转）
 */

export function mapAuditLifecycleStageToApiParams(
  stage: string,
): { status?: string; review_status?: string } | null {
  const normalized = stage.trim();
  switch (normalized) {
    case '待审核':
      return { status: 'PENDING_REVIEW' };
    case '已审核':
      return { status: 'AUDITED', review_status: 'APPROVED' };
    default:
      return null;
  }
}

/** 合并 lifecycle 筛选：审核阶段走 status/review_status，其余走 lifecycle_stage */
export function resolveLifecycleSearchWithAuditSplit(
  stage: string | undefined | null,
  toLifecycleApiParams: (stage: string) => Record<string, unknown>,
): Record<string, unknown> {
  if (!stage) return {};
  const auditParams = mapAuditLifecycleStageToApiParams(stage);
  if (auditParams) return auditParams;
  return toLifecycleApiParams(stage);
}
