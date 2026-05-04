/**
 * 报价单生命周期：前端兜底（无 lifecycle 字段时），与后端 get_quotation_lifecycle / QUOTATION_MAIN_STAGES 对齐。
 * 主轴：草稿 → 已发送 → 已审核 → 客户确认·转订单 → 已转订单（关闭审核时跳过「已审核」）
 */

import type { LifecycleResult, SubStage } from '../../../components/uni-lifecycle/types';
import type { BackendLifecycle } from './backendLifecycle';
import { parseBackendLifecycle } from './backendLifecycle';

function norm(s: string | undefined): string {
  return (s ?? '').trim();
}

const MAIN_STAGE_KEYS = ['draft', 'submitted', 'reviewed', 'send_or_push', 'converted'] as const;
const MAIN_STAGE_LABELS: Record<string, string> = {
  draft: '草稿',
  submitted: '已发送',
  reviewed: '已审核',
  send_or_push: '客户确认·转订单',
  converted: '已转订单',
};

function isPendingRs(rs: string): boolean {
  return !rs || ['PENDING_REVIEW', 'PENDING', '待审核'].includes(rs);
}

function isApprovedRs(rs: string): boolean {
  return ['APPROVED', '审核通过', '通过', '已通过', '已审核'].includes(rs);
}

function isRejectedRs(rs: string): boolean {
  return ['REJECTED', '已驳回', '审核驳回'].includes(rs);
}

function buildMainStages(currentKey: (typeof MAIN_STAGE_KEYS)[number]): SubStage[] {
  const currentIdx = Math.max(
    0,
    MAIN_STAGE_KEYS.indexOf(currentKey as (typeof MAIN_STAGE_KEYS)[number])
  );
  return MAIN_STAGE_KEYS.map((key, i) => {
    let status: SubStage['status'] = 'pending';
    if (currentKey === 'converted' && key === 'converted') {
      status = 'done';
    } else if (i < currentIdx) {
      status = 'done';
    } else if (i === currentIdx) {
      status = 'active';
    } else {
      status = 'pending';
    }
    return { key, label: MAIN_STAGE_LABELS[key] ?? key, status };
  });
}

/** 未启用审核时主轴跳过「已审核」节点：草稿 → 已发送 → 客户确认·转订单 → 已转订单 */
const MAIN_STAGE_KEYS_NO_AUDIT = ['draft', 'submitted', 'send_or_push', 'converted'] as const;

const NO_AUDIT_STAGE_PERCENT: Record<string, number> = {
  draft: 0,
  submitted: 34,
  send_or_push: 67,
  converted: 100,
};

function buildMainStagesNoAudit(currentKey: (typeof MAIN_STAGE_KEYS_NO_AUDIT)[number]): SubStage[] {
  const currentIdx = Math.max(
    0,
    MAIN_STAGE_KEYS_NO_AUDIT.indexOf(currentKey as (typeof MAIN_STAGE_KEYS_NO_AUDIT)[number])
  );
  return MAIN_STAGE_KEYS_NO_AUDIT.map((key, i) => {
    let status: SubStage['status'] = 'pending';
    if (currentKey === 'converted' && key === 'converted') {
      status = 'done';
    } else if (i < currentIdx) {
      status = 'done';
    } else if (i === currentIdx) {
      status = 'active';
    } else {
      status = 'pending';
    }
    return { key, label: MAIN_STAGE_LABELS[key] ?? key, status };
  });
}

function mapQuotationStageKeyWhenNoAudit(key: string): (typeof MAIN_STAGE_KEYS_NO_AUDIT)[number] {
  const k = String(key ?? '').trim();
  if (k === 'reviewed') return 'send_or_push';
  const allowed = MAIN_STAGE_KEYS_NO_AUDIT as readonly string[];
  if (allowed.includes(k)) return k as (typeof MAIN_STAGE_KEYS_NO_AUDIT)[number];
  return 'draft';
}

function resolveQuotationBackendStageKey(record: Record<string, unknown>, base: LifecycleResult): string {
  const lc = record.lifecycle as BackendLifecycle | undefined;
  if (lc?.current_stage_key) return String(lc.current_stage_key);
  const active = base.mainStages?.find((s) => s.status === 'active');
  if (active?.key) return active.key;
  return 'draft';
}

function sanitizeQuotationSuggestionsNoAudit(suggestions: string[]): string[] {
  return suggestions
    .map((s) =>
      String(s)
        .replace(/（进入审核）/g, '')
        .replace(/进入审核/g, '')
        .replace(/再提交审核/g, '再提交')
        .trim()
    )
    .filter(
      (s) =>
        s.length > 0 &&
        !['审核通过', '审核驳回', '撤回审核'].some((w) => s.includes(w)),
    );
}

/** 关闭报价审核后：移除「已审核」节点并重映射进度 */
function adaptQuotationLifecycleForNoAudit(
  base: LifecycleResult,
  record: Record<string, unknown>,
): LifecycleResult {
  const backendKey = resolveQuotationBackendStageKey(record, base);
  const pipelineKey = mapQuotationStageKeyWhenNoAudit(backendKey);
  const mainStages = buildMainStagesNoAudit(pipelineKey);
  const percent = NO_AUDIT_STAGE_PERCENT[pipelineKey] ?? base.percent;

  let stageName = base.stageName;
  if (stageName === '已审核' || stageName === '待审核') {
    const active = mainStages.find((s) => s.status === 'active');
    stageName = active?.label ?? stageName;
  }

  const nextStepSuggestions = sanitizeQuotationSuggestionsNoAudit(base.nextStepSuggestions ?? []);

  return {
    ...base,
    percent,
    stageName,
    mainStages,
    nextStepSuggestions,
  };
}

function buildFallbackLifecycle(record: Record<string, unknown>): BackendLifecycle {
  const status = norm(record?.status as string);
  const rs = norm(record?.review_status as string);
  const convMissing = record?.conversion_downstream_missing === true;

  if (convMissing && status === '已转订单') {
    return {
      current_stage_key: 'converted',
      current_stage_name: '已转订单（下游销售订单已删除）',
      status: 'normal',
      main_stages: buildMainStages('converted'),
      next_step_suggestions: [
        '可点击「撤回下推」解除与已删订单的关联并回到已接受',
        '或直接重新下推转销售订单（系统将自动解除无效关联）',
      ],
    };
  }

  if (status === '已拒绝' || isRejectedRs(rs)) {
    return {
      current_stage_key: 'submitted',
      current_stage_name: '已驳回',
      status: 'exception',
      main_stages: buildMainStages('submitted'),
      next_step_suggestions: ['修改报价单后点击「重新编辑」回到草稿，再提交审核'],
    };
  }

  if (status === '草稿' || status === 'draft') {
    return {
      current_stage_key: 'draft',
      current_stage_name: '草稿',
      status: 'normal',
      main_stages: buildMainStages('draft'),
      next_step_suggestions: ['提交报价单（进入审核）'],
    };
  }

  if (status === '已转订单') {
    return {
      current_stage_key: 'converted',
      current_stage_name: '已转订单',
      status: 'success',
      main_stages: buildMainStages('converted'),
      next_step_suggestions: [],
    };
  }

  if (status === '已接受') {
    return {
      current_stage_key: 'send_or_push',
      current_stage_name: '客户已确认（待下推）',
      status: 'normal',
      main_stages: buildMainStages('send_or_push'),
      next_step_suggestions: ['转销售订单（下推）'],
    };
  }

  if (status === '已发送') {
    if (isPendingRs(rs)) {
      return {
        current_stage_key: 'submitted',
        current_stage_name: '待审核',
        status: 'normal',
        main_stages: buildMainStages('submitted'),
        next_step_suggestions: ['审核通过', '审核驳回', '撤回提交（整单回草稿）'],
      };
    }
    if (isApprovedRs(rs)) {
      return {
        current_stage_key: 'reviewed',
        current_stage_name: '已审核',
        status: 'normal',
        main_stages: buildMainStages('reviewed'),
        next_step_suggestions: [
          '客户确认（标记已接受）',
          '转销售订单（下推）',
          '撤回审核（回到待审核）',
        ],
      };
    }
    return {
      current_stage_key: 'submitted',
      current_stage_name: '待审核',
      status: 'normal',
      main_stages: buildMainStages('submitted'),
      next_step_suggestions: ['审核通过', '审核驳回', '撤回提交（整单回草稿）'],
    };
  }

  return {
    current_stage_key: 'draft',
    current_stage_name: status || '草稿',
    status: 'normal',
    main_stages: buildMainStages('draft'),
    next_step_suggestions: [],
  };
}

export interface QuotationLike {
  status?: string;
  review_status?: string;
  lifecycle?: unknown;
  conversion_downstream_missing?: boolean;
}

export function getQuotationLifecycle(
  record: QuotationLike | Record<string, unknown> | null | undefined,
  auditRequired = true,
): LifecycleResult {
  if (!record) return { percent: 0, stageName: '-', mainStages: [] };
  const raw = record as Record<string, unknown>;
  const backend = (record?.lifecycle ?? raw.lifecycle) as BackendLifecycle | undefined;
  const base = backend?.main_stages?.length
    ? parseBackendLifecycle(backend)
    : parseBackendLifecycle(buildFallbackLifecycle(raw));
  if (auditRequired) return base;
  return adaptQuotationLifecycleForNoAudit(base, raw);
}
