/** 节点执行记录意见：去掉流程配置内部码，仅保留业务可读文案 */

const INTERNAL_ONLY_COMMENTS = new Set(['invalidated_by_config']);

/** 括号内形如 emptyApproverPolicy=auto_pass 的配置说明 */
const INTERNAL_PAREN_RE =
  /\s*[（(][^（）()]*(?:Policy|policy|_config|Approver)[^（）()]*[）)]/g;

export function formatApprovalExecutionComment(
  raw: string | null | undefined,
): string | undefined {
  const trimmed = (raw ?? '').trim();
  if (!trimmed || INTERNAL_ONLY_COMMENTS.has(trimmed)) {
    return undefined;
  }
  const cleaned = trimmed.replace(INTERNAL_PAREN_RE, '').trim();
  return cleaned || undefined;
}
