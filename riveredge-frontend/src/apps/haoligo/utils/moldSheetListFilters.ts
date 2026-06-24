/** 模具简易审核单据列表：从 UniTable searchParamsRef 解析筛选参数 */

export function pickMoldSheetAuditListFilters(
  searchFormValues?: Record<string, unknown> | null,
): { sheet_status?: string; repair_status?: string; keyword?: string } {
  const s = searchFormValues ?? {};
  const sheet_status =
    typeof s.sheet_status === 'string' && s.sheet_status.trim() ? s.sheet_status.trim() : undefined;
  const repair_status =
    typeof s.repair_status === 'string' && s.repair_status.trim() ? s.repair_status.trim() : undefined;
  const keyword =
    typeof s.keyword === 'string' && s.keyword.trim() ? s.keyword.trim() : undefined;
  return { sheet_status, repair_status, keyword };
}
