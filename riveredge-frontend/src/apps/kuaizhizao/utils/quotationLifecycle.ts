/**
 * 报价单生命周期：前端兜底（无 lifecycle 字段时），与后端 get_quotation_lifecycle 语义对齐。
 * 阶段：草稿 → 已提交 → 已审核 → 发送/下推 → 已下推
 */

import type { LifecycleResult, SubStage } from '../../../../components/uni-lifecycle/types';
import type { BackendLifecycle } from './backendLifecycle';
import { parseBackendLifecycle } from './backendLifecycle';

function norm(s: string | undefined): string {
  return (s ?? '').trim();
}

const MAIN_STAGE_KEYS = ['draft', 'submitted', 'reviewed', 'send_or_push', 'converted'] as const;
const MAIN_STAGE_LABELS: Record<string, string> = {
  draft: '草稿',
  submitted: '已提交',
  reviewed: '已审核',
  send_or_push: '发送/下推',
  converted: '已下推',
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

function buildFallbackLifecycle(record: Record<string, unknown>): BackendLifecycle {
  const status = norm(record?.status as string);
  const rs = norm(record?.review_status as string);
  const convMissing = record?.conversion_downstream_missing === true;

  if (convMissing && status === '已转订单') {
    return {
      current_stage_key: 'converted',
      current_stage_name: '已下推（下游销售订单已删除）',
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
      current_stage_name: '已下推',
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
  record: QuotationLike | Record<string, unknown> | null | undefined
): LifecycleResult {
  if (!record) return { percent: 0, stageName: '-', mainStages: [] };
  const backend = (record?.lifecycle ?? (record as Record<string, unknown>).lifecycle) as BackendLifecycle | undefined;
  if (backend?.main_stages?.length) {
    return parseBackendLifecycle(backend);
  }
  return parseBackendLifecycle(buildFallbackLifecycle(record as Record<string, unknown>));
}
