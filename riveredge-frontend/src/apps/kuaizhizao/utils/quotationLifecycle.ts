/**
 * 报价单生命周期：前端兜底（无 lifecycle 字段时），与后端 get_quotation_lifecycle 对齐。
 * 启用审核：草稿 → 待审核 → 已报价 → 客户确认 → 已转订单
 * 关闭审核：草稿 → 已报价 → 客户确认 → 已转订单
 */

import type { LifecycleResult, SubStage } from '../../../components/uni-lifecycle/types';
import type { BackendLifecycle } from './backendLifecycle';
import { parseBackendLifecycle } from './backendLifecycle';
import { applyLifecycleI18n, type LifecycleTranslateFn } from './lifecycleI18n';

function norm(s: string | undefined): string {
  return (s ?? '').trim();
}

const MAIN_STAGE_KEYS_AUDIT = [
  'draft',
  'pending_review',
  'generated',
  'customer_confirmed',
  'converted',
] as const;

const MAIN_STAGE_KEYS_NO_AUDIT = [
  'draft',
  'generated',
  'customer_confirmed',
  'converted',
] as const;

const MAIN_STAGE_LABELS: Record<string, string> = {
  draft: '草稿',
  pending_review: '待审核',
  generated: '已报价',
  customer_confirmed: '客户确认',
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

function buildMainStages(
  keys: readonly string[],
  currentKey: string,
): SubStage[] {
  const currentIdx = Math.max(0, keys.indexOf(currentKey as (typeof keys)[number]));
  return keys.map((key, i) => {
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

const NO_AUDIT_STAGE_PERCENT: Record<string, number> = {
  draft: 0,
  generated: 33,
  customer_confirmed: 67,
  converted: 100,
};

const AUDIT_STAGE_PERCENT: Record<string, number> = {
  draft: 0,
  pending_review: 25,
  generated: 50,
  customer_confirmed: 75,
  converted: 100,
};

function mapQuotationStageKeyWhenNoAudit(key: string): (typeof MAIN_STAGE_KEYS_NO_AUDIT)[number] {
  const k = String(key ?? '').trim();
  if (k === 'sent_pending_confirm' || k === 'pending_review') return 'generated';
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
        .trim(),
    )
    .filter(
      (s) =>
        s.length > 0 &&
        !['审核通过', '审核驳回', '撤回审核'].some((w) => s.includes(w)),
    );
}

/** 关闭报价审核后：移除审核相关引导文案与待审核节点 */
function adaptQuotationLifecycleForNoAudit(
  base: LifecycleResult,
  record: Record<string, unknown>,
): LifecycleResult {
  const backendKey = resolveQuotationBackendStageKey(record, base);
  const pipelineKey = mapQuotationStageKeyWhenNoAudit(backendKey);
  const mainStages = buildMainStages(MAIN_STAGE_KEYS_NO_AUDIT, pipelineKey);
  const percent = NO_AUDIT_STAGE_PERCENT[pipelineKey] ?? base.percent;

  let stageName = base.stageName;
  if (stageName === '已报价（待审核）' || stageName === '已生成（待审核）' || stageName === '待审核') {
    stageName = '已报价';
  }
  if (stageName === '已发送待确认') {
    stageName = '已报价';
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

function buildFallbackLifecycle(record: Record<string, unknown>, auditRequired = true): BackendLifecycle {
  const status = norm(record?.status as string);
  const rs = norm(record?.review_status as string);
  const convMissing = record?.conversion_downstream_missing === true;
  const stageKeys = auditRequired ? MAIN_STAGE_KEYS_AUDIT : MAIN_STAGE_KEYS_NO_AUDIT;

  if (convMissing && status === '已转订单') {
    return {
      current_stage_key: 'converted',
      current_stage_name: '下推单据已删除',
      status: 'warning',
      main_stages: buildMainStages(stageKeys, 'converted'),
      next_step_suggestions: [
        '可点击「撤回下推」解除与已删订单的关联并回到已接受',
        '或直接重新下推转销售订单（系统将自动解除无效关联）',
      ],
    };
  }

  if (status === '已拒绝' || isRejectedRs(rs)) {
    const rejectKey = auditRequired ? 'pending_review' : 'generated';
    return {
      current_stage_key: rejectKey,
      current_stage_name: '已驳回',
      status: 'exception',
      main_stages: buildMainStages(stageKeys, rejectKey),
      next_step_suggestions: ['修改报价单后点击「重新编辑」回到草稿，再提交审核'],
    };
  }

  if (status === '草稿' || status === 'draft') {
    return {
      current_stage_key: 'draft',
      current_stage_name: '草稿',
      status: 'normal',
      main_stages: buildMainStages(stageKeys, 'draft'),
      next_step_suggestions: ['提交报价单'],
    };
  }

  if (status === '已转订单') {
    return {
      current_stage_key: 'converted',
      current_stage_name: '已转订单',
      status: 'success',
      main_stages: buildMainStages(stageKeys, 'converted'),
      next_step_suggestions: [],
    };
  }

  if (status === '已接受') {
    return {
      current_stage_key: 'customer_confirmed',
      current_stage_name: '客户确认',
      status: 'normal',
      main_stages: buildMainStages(stageKeys, 'customer_confirmed'),
      next_step_suggestions: ['转销售订单（下推）'],
    };
  }

  if (status === '已发送') {
    if (auditRequired && isPendingRs(rs)) {
      return {
        current_stage_key: 'pending_review',
        current_stage_name: '待审核',
        status: 'normal',
        main_stages: buildMainStages(stageKeys, 'pending_review'),
        next_step_suggestions: ['审核通过', '审核驳回', '撤回提交（整单回草稿）'],
      };
    }
    return {
      current_stage_key: 'generated',
      current_stage_name: '已报价',
      status: 'normal',
      main_stages: buildMainStages(stageKeys, 'generated'),
      next_step_suggestions: auditRequired
        ? [
            '客户确认（标记已接受）',
            '转销售订单（下推）',
            '生成正式报价 PDF',
            '撤回审核（回到待审核）',
          ]
        : ['客户确认（标记已接受）', '转销售订单（下推）', '生成正式报价 PDF'],
    };
  }

  return {
    current_stage_key: 'draft',
    current_stage_name: status || '草稿',
    status: 'normal',
    main_stages: buildMainStages(stageKeys, 'draft'),
    next_step_suggestions: [],
  };
}

export interface QuotationLike {
  status?: string;
  review_status?: string;
  lifecycle?: unknown;
  conversion_downstream_missing?: boolean;
}

const QUOTATION_STAGE_I18N_BY_KEY: Record<string, string> = {
  draft: 'app.kuaizhizao.quotation.statusFilter.draft',
  pending_review: 'app.kuaizhizao.quotation.statusFilter.pendingReview',
  generated: 'app.kuaizhizao.quotation.statusFilter.sent',
  customer_confirmed: 'app.kuaizhizao.quotation.statusFilter.accepted',
  converted: 'app.kuaizhizao.quotation.statusFilter.converted',
  sent_pending_confirm: 'app.kuaizhizao.quotation.statusFilter.sent',
};

export function getQuotationLifecycle(
  record: QuotationLike | Record<string, unknown> | null | undefined,
  auditRequired = true,
  t?: LifecycleTranslateFn,
): LifecycleResult {
  if (!record) return { percent: 0, stageName: '-', mainStages: [] };
  const raw = record as Record<string, unknown>;
  const backend = (record?.lifecycle ?? raw.lifecycle) as BackendLifecycle | undefined;
  if (!backend?.main_stages?.length) {
    return {
      percent: 0,
      stageName: t ? t('common.lifecycleMissing', { defaultValue: '生命周期缺失' }) : '生命周期缺失',
      status: 'exception',
      mainStages: [],
    };
  }
  let base = parseBackendLifecycle(backend);

  if (raw.conversion_downstream_missing === true) {
    base = {
      ...base,
      status: 'warning',
    };
  }

  const activeKey = base.mainStages?.find((s) => s.status === 'active')?.key;
  if (activeKey === 'sent_pending_confirm' || base.stageName === '已发送待确认') {
    const mappedKey = auditRequired ? 'generated' : 'generated';
    base = {
      ...base,
      stageName: '已报价',
      mainStages: buildMainStages(
        auditRequired ? MAIN_STAGE_KEYS_AUDIT : MAIN_STAGE_KEYS_NO_AUDIT,
        mappedKey,
      ),
      percent: auditRequired ? AUDIT_STAGE_PERCENT.generated : NO_AUDIT_STAGE_PERCENT.generated,
    };
  }

  if (!auditRequired) {
    base = adaptQuotationLifecycleForNoAudit(base, raw);
  }

  if (!t) {
    if (raw.conversion_downstream_missing === true) {
      return { ...base, stageName: '下推单据已删除' };
    }
    return base;
  }

  const withI18n = applyLifecycleI18n(base, t, QUOTATION_STAGE_I18N_BY_KEY);
  if (raw.conversion_downstream_missing === true) {
    return {
      ...withI18n,
      stageName: t('app.kuaizhizao.quotation.lifecycleDownstreamDeleted'),
      status: 'warning',
    };
  }
  return withI18n;
}
