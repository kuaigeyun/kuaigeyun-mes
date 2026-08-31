/**
 * 单据执行状态 / 审核状态 — 全局统一配色（唯一真源）
 *
 * 原则：
 * - 同样语义同样色；不同语义不同色
 * - 色板收敛为 6 档，禁止紫/青/橙/金/极客蓝等「五花八门」旁路
 * - 生命周期列、审核列、取单状态、单据枚举 fallback 均须经本模块解析
 *
 * | 语义 | Token | 含义 |
 * |------|-------|------|
 * | draft | RE_STATUS_BADGE_DRAFT | 草稿 / 计划中 / 初始 |
 * | pending | warning | 待审核 / 已提交 / 待决（等人） |
 * | active | processing | 进行中 / 执行中 / 评审中 / 已生效（业务进行中） |
 * | success | success | 通过 / 已完成 / 终态结案 |
 * | danger | error | 驳回 / 取消 / 失败 / 不合格 |
 * | muted | default | 关闭 / 无 / 停用 |
 */

import { RE_STATUS_BADGE_DRAFT } from './statusBadges';

export type DocumentStatusSemantic =
  | 'draft'
  | 'pending'
  | 'active'
  | 'success'
  | 'danger'
  | 'muted';

/** Ant Design Tag color / 草稿占位符 */
export type DocumentStatusTagColor = string;

export const DOCUMENT_STATUS_SEMANTIC_COLOR: Record<DocumentStatusSemantic, DocumentStatusTagColor> = {
  draft: RE_STATUS_BADGE_DRAFT,
  pending: 'warning',
  active: 'processing',
  success: 'success',
  danger: 'error',
  muted: 'default',
};

/**
 * 原始状态码 / 中文阶段名 → 语义档。
 * 增别名只加本表；禁止页面再写 STATUS_COLORS。
 */
const STATUS_SEMANTIC_ALIASES: Record<string, DocumentStatusSemantic> = {
  // —— draft ——
  草稿: 'draft',
  DRAFT: 'draft',
  draft: 'draft',
  计划中: 'draft',

  // —— pending（待办 / 待审）——
  待审核: 'pending',
  已提交: 'pending',
  PENDING_REVIEW: 'pending',
  PENDING: 'pending',
  SUBMITTED: 'pending',
  pending: 'pending',
  pending_review: 'pending',
  submitted: 'pending',
  open: 'pending',
  todo: 'pending',
  待办: 'pending',
  待处理: 'pending',
  暂停: 'pending',
  paused: 'pending',
  待检验: 'pending',
  待点检: 'pending',
  待退料: 'pending',
  待借出: 'pending',
  待派工: 'pending',
  待接单: 'pending',
  待验收: 'pending',
  待回访: 'pending',
  部分转单: 'pending',
  PARTIAL_CONVERTED: 'pending',
  partial_converted: 'pending',
  partial: 'pending',
  已到期: 'pending',
  arrived: 'pending',
  maintenance: 'pending',

  // —— active（进行中）——
  评审中: 'active',
  reviewing: 'active',
  执行中: 'active',
  IN_PROGRESS: 'active',
  in_progress: 'active',
  生产中: 'active',
  进行中: 'active',
  processing: 'active',
  计算中: 'active',
  处理中: 'active',
  盘点中: 'active',
  拆卸中: 'active',
  组装中: 'active',
  调拨中: 'active',
  配料中: 'active',
  领用中: 'active',
  维修中: 'active',
  已下达: 'active',
  RELEASED: 'active',
  released: 'active',
  已发布: 'active',
  published: 'active',
  待入库: 'active',
  待出库: 'active',
  待收货: 'active',
  待领料: 'active',
  已通知: 'active',
  通知仓库: 'active',
  接单理货: 'active',
  收货通知: 'active',
  已下推: 'active',
  已下推计算: 'active',
  已下推入库: 'active',
  PUSHED: 'active',
  已接单: 'active',
  到场: 'active',
  picking: 'active',
  scheduled: 'active',
  shipped: 'active',
  in_transit: 'active',

  // —— success ——
  已审核: 'success',
  AUDITED: 'success',
  APPROVED: 'success',
  approved: 'success',
  审核通过: 'success',
  通过: 'success',
  已通过: 'success',
  passed: 'success',
  已确认: 'success',
  CONFIRMED: 'success',
  confirmed: 'success',
  已生效: 'active',
  EFFECTIVE: 'active',
  effective: 'active',
  已完成: 'success',
  COMPLETED: 'success',
  completed: 'success',
  完成: 'success',
  done: 'success',
  已解决: 'success',
  resolved: 'success',
  已检验: 'success',
  已退料: 'success',
  已借出: 'success',
  已归还: 'success',
  已入库: 'success',
  上架入库: 'success',
  成品入库: 'success',
  采购入库: 'success',
  退货入库: 'success',
  已出库: 'success',
  已领料: 'success',
  已交货: 'success',
  DELIVERED: 'success',
  可发货: 'success',
  READY_TO_SHIP: 'success',
  已执行: 'success',
  EXECUTED: 'success',
  全部转单: 'success',
  FULL_CONVERTED: 'success',
  full_converted: 'success',
  合格: 'success',
  完工: 'success',
  在用: 'success',
  success: 'success',
  processed: 'success',
  signed: 'success',
  idle: 'success',

  // —— danger ——
  已驳回: 'danger',
  REJECTED: 'danger',
  rejected: 'danger',
  审核驳回: 'danger',
  驳回: 'danger',
  已取消: 'danger',
  CANCELLED: 'danger',
  cancelled: 'danger',
  canceled: 'danger',
  失败: 'danger',
  failed: 'danger',
  不合格: 'danger',
  报废: 'danger',
  overdue: 'danger',
  逾期: 'danger',

  // —— muted ——
  已关闭: 'muted',
  CLOSED: 'muted',
  closed: 'muted',
  停用: 'muted',
  none: 'muted',
  无: 'muted',
  not_started: 'muted',
  未开始: 'muted',
  disabled: 'muted',
};

/** 审核相位 → 语义（与待审核 / 已通过 / 已驳回同色） */
const AUDIT_PHASE_SEMANTIC: Record<string, DocumentStatusSemantic> = {
  draft: 'draft',
  pending: 'pending',
  approved: 'success',
  rejected: 'danger',
  none: 'muted',
};

function normalizeStatusKey(raw: string): string {
  return raw.trim();
}

export function resolveDocumentStatusSemantic(
  stageNameOrCode: string | null | undefined,
): DocumentStatusSemantic | null {
  const raw = normalizeStatusKey(stageNameOrCode ?? '');
  if (!raw || raw === '-' || raw === '—') return null;

  const direct = STATUS_SEMANTIC_ALIASES[raw];
  if (direct) return direct;

  const upper = raw.toUpperCase().replace(/[\s-]+/g, '_');
  if (STATUS_SEMANTIC_ALIASES[upper]) return STATUS_SEMANTIC_ALIASES[upper];

  const lower = raw.toLowerCase().replace(/[\s-]+/g, '_');
  if (STATUS_SEMANTIC_ALIASES[lower]) return STATUS_SEMANTIC_ALIASES[lower];

  return null;
}

/** 解析为 Ant Tag color（含草稿占位符）；未知 → muted */
export function resolveDocumentStatusTagColor(
  stageNameOrCode: string | null | undefined,
): DocumentStatusTagColor {
  const semantic = resolveDocumentStatusSemantic(stageNameOrCode) ?? 'muted';
  return DOCUMENT_STATUS_SEMANTIC_COLOR[semantic];
}

export function resolveAuditPhaseTagColor(phase: string | null | undefined): DocumentStatusTagColor {
  const key = String(phase ?? 'none').trim().toLowerCase();
  const semantic = AUDIT_PHASE_SEMANTIC[key] ?? 'muted';
  return DOCUMENT_STATUS_SEMANTIC_COLOR[semantic];
}
