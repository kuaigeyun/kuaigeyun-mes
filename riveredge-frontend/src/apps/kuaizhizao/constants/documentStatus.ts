/**
 * 业务单据状态枚举与展示标签
 *
 * 统一管理 status/review_status，以枚举为 canonical，存量中文通过别名归一化。
 * @author RiverEdge
 * @date 2026-02-20
 */

/** 单据主状态枚举 */
export const DocumentStatus = {
  DRAFT: 'DRAFT',
  PENDING_REVIEW: 'PENDING_REVIEW',
  AUDITED: 'AUDITED',
  REJECTED: 'REJECTED',
  CONFIRMED: 'CONFIRMED',
  CANCELLED: 'CANCELLED',
  RELEASED: 'RELEASED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  PARTIAL_CONVERTED: 'PARTIAL_CONVERTED',
  FULL_CONVERTED: 'FULL_CONVERTED',
} as const;

/** 审核状态枚举 */
export const ReviewStatusEnum = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;

// ========== 存量中文 -> 枚举（统一归一化入口） ==========
const STATUS_ALIASES: Record<string, string> = {
  草稿: DocumentStatus.DRAFT,
  待审核: DocumentStatus.PENDING_REVIEW,
  已审核: DocumentStatus.AUDITED,
  已驳回: DocumentStatus.REJECTED,
  已确认: DocumentStatus.CONFIRMED,
  已取消: DocumentStatus.CANCELLED,
  已下达: DocumentStatus.RELEASED,
  执行中: DocumentStatus.IN_PROGRESS,
  已完成: DocumentStatus.COMPLETED,
  部分转单: DocumentStatus.PARTIAL_CONVERTED,
  全部转单: DocumentStatus.FULL_CONVERTED,
};

const REVIEW_STATUS_ALIASES: Record<string, string> = {
  待审核: ReviewStatusEnum.PENDING,
  审核通过: ReviewStatusEnum.APPROVED,
  审核驳回: ReviewStatusEnum.REJECTED,
  通过: ReviewStatusEnum.APPROVED,
  驳回: ReviewStatusEnum.REJECTED,
  已通过: ReviewStatusEnum.APPROVED,
};

function normalizeStatus(status: string): string {
  return STATUS_ALIASES[status] ?? status;
}

function normalizeReviewStatus(status: string): string {
  return REVIEW_STATUS_ALIASES[status] ?? status;
}

// ========== 枚举 -> 展示配置（唯一数据源） ==========
const STATUS_DISPLAY: Record<string, { text: string; color: string }> = {
  [DocumentStatus.DRAFT]: { text: '草稿', color: 'default' },
  [DocumentStatus.PENDING_REVIEW]: { text: '待审核', color: 'processing' },
  [DocumentStatus.AUDITED]: { text: '已审核', color: 'processing' },
  [DocumentStatus.REJECTED]: { text: '已驳回', color: 'error' },
  [DocumentStatus.CONFIRMED]: { text: '已确认', color: 'success' },
  [DocumentStatus.CANCELLED]: { text: '已取消', color: 'error' },
  [DocumentStatus.RELEASED]: { text: '已下达', color: 'processing' },
  [DocumentStatus.IN_PROGRESS]: { text: '执行中', color: 'processing' },
  [DocumentStatus.COMPLETED]: { text: '已完成', color: 'success' },
  [DocumentStatus.PARTIAL_CONVERTED]: { text: '部分转单', color: 'warning' },
  [DocumentStatus.FULL_CONVERTED]: { text: '全部转单', color: 'success' },
};

const REVIEW_STATUS_DISPLAY: Record<string, { text: string; color: string }> = {
  [ReviewStatusEnum.PENDING]: { text: '待审核', color: 'default' },
  [ReviewStatusEnum.APPROVED]: { text: '审核通过', color: 'success' },
  [ReviewStatusEnum.REJECTED]: { text: '审核驳回', color: 'error' },
};

/** 判断是否为草稿状态 */
export function isDraftStatus(status: string | undefined): boolean {
  if (!status) return false;
  return normalizeStatus(String(status).trim()) === DocumentStatus.DRAFT;
}

/** 判断是否为待审核状态 */
export function isPendingReviewStatus(status: string | undefined): boolean {
  if (!status) return false;
  return normalizeStatus(String(status).trim()) === DocumentStatus.PENDING_REVIEW;
}

/** 判断是否为已审核/已确认状态 */
export function isAuditedStatus(status: string | undefined): boolean {
  if (!status) return false;
  const n = normalizeStatus(String(status).trim());
  return n === DocumentStatus.AUDITED || n === DocumentStatus.CONFIRMED;
}

/** 获取 status 展示文本 */
export function getStatusLabel(status: string | undefined): string {
  if (!status) return '-';
  const config = STATUS_DISPLAY[normalizeStatus(String(status).trim())];
  return config?.text ?? status;
}

/** 获取 review_status 展示文本 */
export function getReviewStatusLabel(status: string | undefined): string {
  if (!status) return '-';
  const config = REVIEW_STATUS_DISPLAY[normalizeReviewStatus(String(status).trim())];
  return config?.text ?? status;
}

/** 获取 status 展示配置（用于 Tag） */
export function getStatusDisplay(status: string | undefined): { text: string; color: string } {
  if (!status) return { text: '-', color: 'default' };
  return STATUS_DISPLAY[normalizeStatus(String(status).trim())] ?? { text: status, color: 'default' };
}

/** 获取 review_status 展示配置 */
export function getReviewStatusDisplay(status: string | undefined): { text: string; color: string } {
  if (!status) return { text: '-', color: 'default' };
  return REVIEW_STATUS_DISPLAY[normalizeReviewStatus(String(status).trim())] ?? { text: status, color: 'default' };
}
