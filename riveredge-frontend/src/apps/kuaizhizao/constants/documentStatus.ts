/**
 * 业务单据状态枚举与展示标签
 *
 * 优先从后端 API 缓存读取（单一数据源），缓存未就绪时使用内置 fallback。
 * @author RiverEdge
 * @date 2026-02-20
 */

import { getDocumentStatusCache } from '../../../services/enums';
import { RE_STATUS_BADGE_DRAFT } from '../../../constants/statusBadges';

/** 单据主状态枚举（fallback，与后端 constants.py 对齐） */
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

/** 审核状态枚举（fallback） */
export const ReviewStatusEnum = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;

const ENGLISH_STATUS_ALIASES: Record<string, string> = {
  draft: DocumentStatus.DRAFT,
  pending_review: DocumentStatus.PENDING_REVIEW,
  pending: DocumentStatus.PENDING_REVIEW,
  submitted: DocumentStatus.PENDING_REVIEW,
  audited: DocumentStatus.AUDITED,
  approved: DocumentStatus.AUDITED,
  rejected: DocumentStatus.REJECTED,
  confirmed: DocumentStatus.CONFIRMED,
  cancelled: DocumentStatus.CANCELLED,
  canceled: DocumentStatus.CANCELLED,
  released: DocumentStatus.RELEASED,
  in_progress: DocumentStatus.IN_PROGRESS,
  completed: DocumentStatus.COMPLETED,
  partial_converted: DocumentStatus.PARTIAL_CONVERTED,
  full_converted: DocumentStatus.FULL_CONVERTED,
};

const FALLBACK_STATUS_ALIASES: Record<string, string> = {
  草稿: DocumentStatus.DRAFT,
  待审核: DocumentStatus.PENDING_REVIEW,
  已审核: DocumentStatus.AUDITED,
  已驳回: DocumentStatus.REJECTED,
  已确认: DocumentStatus.CONFIRMED,
  已取消: DocumentStatus.CANCELLED,
  已下达: DocumentStatus.RELEASED,
  执行中: DocumentStatus.IN_PROGRESS,
  进行中: DocumentStatus.IN_PROGRESS,
  已完成: DocumentStatus.COMPLETED,
  部分转单: DocumentStatus.PARTIAL_CONVERTED,
  全部转单: DocumentStatus.FULL_CONVERTED,
  已通过: DocumentStatus.AUDITED,
};

const FALLBACK_REVIEW_ALIASES: Record<string, string> = {
  待审核: ReviewStatusEnum.PENDING,
  审核通过: ReviewStatusEnum.APPROVED,
  审核驳回: ReviewStatusEnum.REJECTED,
  通过: ReviewStatusEnum.APPROVED,
  驳回: ReviewStatusEnum.REJECTED,
  已通过: ReviewStatusEnum.APPROVED,
};

const FALLBACK_STATUS_DISPLAY: Record<string, { text: string; color: string }> = {
  [DocumentStatus.DRAFT]: { text: '草稿', color: RE_STATUS_BADGE_DRAFT },
  [DocumentStatus.PENDING_REVIEW]: { text: '待审核', color: 'warning' },
  [DocumentStatus.AUDITED]: { text: '已审核', color: 'success' },
  [DocumentStatus.REJECTED]: { text: '已驳回', color: 'error' },
  [DocumentStatus.CONFIRMED]: { text: '已确认', color: 'success' },
  [DocumentStatus.CANCELLED]: { text: '已取消', color: 'error' },
  [DocumentStatus.RELEASED]: { text: '已下达', color: 'processing' },
  [DocumentStatus.IN_PROGRESS]: { text: '执行中', color: 'cyan' },
  [DocumentStatus.COMPLETED]: { text: '已完成', color: 'gold' },
  [DocumentStatus.PARTIAL_CONVERTED]: { text: '部分转单', color: 'warning' },
  [DocumentStatus.FULL_CONVERTED]: { text: '全部转单', color: 'success' },
};

const FALLBACK_REVIEW_DISPLAY: Record<string, { text: string; color: string }> = {
  [ReviewStatusEnum.PENDING]: { text: '待审核', color: 'warning' },
  [ReviewStatusEnum.APPROVED]: { text: '审核通过', color: 'success' },
  [ReviewStatusEnum.REJECTED]: { text: '审核驳回', color: 'error' },
};

function normalizeStatus(status: string): string {
  const trimmed = String(status).trim();
  if (!trimmed) return trimmed;
  const cache = getDocumentStatusCache();
  const aliases = cache?.documentStatus?.aliases ?? FALLBACK_STATUS_ALIASES;
  if (aliases[trimmed]) return aliases[trimmed];
  const upper = trimmed.toUpperCase().replace(/[\s-]+/g, '_');
  if ((cache?.documentStatus?.display ?? FALLBACK_STATUS_DISPLAY)[upper]) {
    return upper;
  }
  const lower = trimmed.toLowerCase().replace(/[\s-]+/g, '_');
  if (ENGLISH_STATUS_ALIASES[lower]) return ENGLISH_STATUS_ALIASES[lower];
  return trimmed;
}

function normalizeReviewStatus(status: string): string {
  const cache = getDocumentStatusCache();
  const aliases = cache?.reviewStatus?.aliases ?? FALLBACK_REVIEW_ALIASES;
  return aliases[status] ?? status;
}

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

/** 是否已确认/已生效（提交免审直达等） */
export function isConfirmedStatus(status: string | undefined): boolean {
  if (!status) return false;
  const s = String(status).trim();
  const n = normalizeStatus(s);
  return n === DocumentStatus.CONFIRMED || s === '已确认' || s === '已生效';
}

/** 是否已审核（不含已确认/已生效） */
export function isStrictlyAuditedStatus(status: string | undefined): boolean {
  if (!status) return false;
  if (isConfirmedStatus(status)) return false;
  const s = String(status).trim();
  const n = normalizeStatus(s);
  return n === DocumentStatus.AUDITED || s === '已审核';
}

/** 撤回提交：待审核，或免审提交后的已确认/已生效 */
export function canWithdrawSubmittedOrder(status: string | undefined): boolean {
  return isPendingReviewStatus(status) || isConfirmedStatus(status);
}

/** 获取 status 展示文本 */
export function getStatusLabel(status: string | undefined): string {
  if (!status) return '-';
  const cache = getDocumentStatusCache();
  const display = cache?.documentStatus?.display ?? FALLBACK_STATUS_DISPLAY;
  const config = display[normalizeStatus(String(status).trim())];
  return config?.text ?? status;
}

/** 获取 review_status 展示文本 */
export function getReviewStatusLabel(status: string | undefined): string {
  if (!status) return '-';
  const cache = getDocumentStatusCache();
  const display = cache?.reviewStatus?.display ?? FALLBACK_REVIEW_DISPLAY;
  const config = display[normalizeReviewStatus(String(status).trim())];
  return config?.text ?? status;
}

/** 获取 status 展示配置（用于 Tag） */
export function getStatusDisplay(status: string | undefined): { text: string; color: string } {
  if (!status) return { text: '-', color: 'default' };
  const cache = getDocumentStatusCache();
  const display = cache?.documentStatus?.display ?? FALLBACK_STATUS_DISPLAY;
  return display[normalizeStatus(String(status).trim())] ?? { text: status, color: 'default' };
}

/** 获取 review_status 展示配置 */
export function getReviewStatusDisplay(status: string | undefined): { text: string; color: string } {
  if (!status) return { text: '-', color: 'default' };
  const cache = getDocumentStatusCache();
  const display = cache?.reviewStatus?.display ?? FALLBACK_REVIEW_DISPLAY;
  return display[normalizeReviewStatus(String(status).trim())] ?? { text: status, color: 'default' };
}
