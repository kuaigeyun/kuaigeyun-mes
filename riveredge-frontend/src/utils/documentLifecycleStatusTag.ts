/**
 * 单据生命周期阶段 → Ant Design Tag 样式（全局统一）
 *
 * - 草稿：使用全局类名 `re-status-badge-draft`（与 global.less / statusBadges 一致，避免过淡）
 * - 已审核 / 已通过：success（绿）
 * - 待审核 / 已提交：warning（金）
 * - 已驳回：error
 * - 已生效：purple；执行中：cyan；已交货：orange；已完成：gold
 * - 已下推类：geekblue
 */

import type { CSSProperties } from 'react';
import type { TagProps } from 'antd';
import { RE_STATUS_BADGE_DRAFT_CLASS } from '../constants/statusBadges';

const DRAFT_TAG: Pick<TagProps, 'className'> = { className: RE_STATUS_BADGE_DRAFT_CLASS };

const UNKNOWN_STYLE: CSSProperties = {
  color: 'var(--ant-color-text-secondary, #595959)',
  background: 'var(--ant-color-fill-quaternary, #f0f0f0)',
  borderColor: 'var(--ant-color-border-secondary, #d9d9d9)',
};

/** 中文阶段名、展示文案、常见英文码 → Tag 属性 */
const LIFECYCLE_STAGE_TAG_LOOKUP: Record<string, Pick<TagProps, 'color' | 'style' | 'className'>> = {
  // —— 草稿 / 初始 ——
  草稿: DRAFT_TAG,
  DRAFT: DRAFT_TAG,
  draft: DRAFT_TAG,
  计划中: DRAFT_TAG,
  /** 异常单等「待处理」与草稿区分 */
  待处理: { color: 'warning' },

  // —— 待办 / 审核中 ——
  待审核: { color: 'warning' },
  已提交: { color: 'warning' },
  PENDING_REVIEW: { color: 'warning' },
  PENDING: { color: 'warning' },
  SUBMITTED: { color: 'warning' },
  待检验: { color: 'warning' },
  /** 入库/出库待处理：与 Ant processing 对齐（蓝），区别于「待审核」金橙 */
  待入库: { color: 'processing' },
  待出库: { color: 'processing' },
  待退料: { color: 'warning' },
  已退料: { color: 'success' },
  盘点中: { color: 'processing' },
  拆卸中: { color: 'processing' },
  组装中: { color: 'processing' },
  调拨中: { color: 'processing' },
  配料中: { color: 'processing' },

  // —— 审核结果 ——
  已审核: { color: 'success' },
  AUDITED: { color: 'success' },
  APPROVED: { color: 'success' },
  审核通过: { color: 'success' },
  通过: { color: 'success' },
  已通过: { color: 'success' },

  已驳回: { color: 'error' },
  REJECTED: { color: 'error' },
  审核驳回: { color: 'error' },
  驳回: { color: 'error' },

  // —— 生效 / 执行 ——
  已确认: { color: 'purple' },
  CONFIRMED: { color: 'purple' },
  已生效: { color: 'purple' },
  EFFECTIVE: { color: 'purple' },

  已下达: { color: 'processing' },
  RELEASED: { color: 'processing' },

  执行中: { color: 'cyan' },
  IN_PROGRESS: { color: 'cyan' },
  生产中: { color: 'cyan' },

  已交货: { color: 'orange' },
  DELIVERED: { color: 'orange' },

  已完成: { color: 'gold' },
  COMPLETED: { color: 'gold' },

  可发货: { color: 'success' },
  READY_TO_SHIP: { color: 'success' },

  已执行: { color: 'cyan' },
  EXECUTED: { color: 'cyan' },

  // —— 下推 / 计算 ——
  已下推: { color: 'geekblue' },
  已下推计算: { color: 'geekblue' },
  PUSHED: { color: 'geekblue' },
  已下推入库: { color: 'geekblue' },

  进行中: { color: 'processing' },
  计算中: { color: 'processing' },
  处理中: { color: 'processing' },
  已解决: { color: 'success' },
  待借出: { color: 'warning' },
  已借出: { color: 'success' },
  完成: { color: 'success' },
  失败: { color: 'error' },

  // —— 取消 / 关闭 ——
  已取消: { color: 'error' },
  CANCELLED: { color: 'error' },
  已关闭: { color: 'default' },
  CLOSED: { color: 'default' },

  // —— 其它单据 ——
  部分转单: { color: 'warning' },
  全部转单: { color: 'success' },
  PARTIAL_CONVERTED: { color: 'warning' },
  FULL_CONVERTED: { color: 'success' },

  已入库: { color: 'success' },
  已出库: { color: 'success' },
  待领料: { color: 'processing' },
  已领料: { color: 'success' },

  // 报工等：待审核若仅显示中文
  pending: { color: 'warning' },
  approved: { color: 'success' },
  rejected: { color: 'error' },
};

/**
 * 根据生命周期当前阶段名（或状态码）返回 Ant Design Tag 的 color / className / style。
 * 未知阶段使用中等对比灰，避免 `default` 过淡。
 */
export function getDocumentLifecycleStageTagProps(
  stageNameOrCode: string | null | undefined,
): Pick<TagProps, 'color' | 'style' | 'className'> {
  const raw = (stageNameOrCode ?? '').trim();
  if (!raw || raw === '-') {
    return { style: UNKNOWN_STYLE };
  }
  const direct = LIFECYCLE_STAGE_TAG_LOOKUP[raw];
  if (direct) {
    return direct;
  }
  const upper = raw.toUpperCase().replace(/[\s-]+/g, '_');
  const fromUpper = LIFECYCLE_STAGE_TAG_LOOKUP[upper];
  if (fromUpper) {
    return fromUpper;
  }
  return { style: UNKNOWN_STYLE };
}
