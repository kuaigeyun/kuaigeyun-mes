/**
 * 客户跟进「生命周期」：纯前端推导（无审批流）。
 * 主轴：跟进已记录 → 回访计划（待回访 / 逾期 / 无需回访）→ 闭环。
 */

import type { LifecycleResult, SubStage } from '../../../components/uni-lifecycle/types';
import type { CustomerFollowUp } from '../services/customer-follow-up';
import dayjs from 'dayjs';

type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

function fmtPlan(dt: dayjs.Dayjs): string {
  return dt.format('YYYY-MM-DD HH:mm');
}

/** 回访计划已到期（与 `getCustomerFollowUpLifecycle` 的 exception 态一致） */
export function isCustomerFollowUpRevisitOverdue(record: CustomerFollowUp): boolean {
  const nextRaw = record.next_follow_up_at;
  const next = nextRaw ? dayjs(nextRaw) : null;
  const now = dayjs();
  return Boolean(next?.isValid() && !next.isAfter(now));
}

export function getCustomerFollowUpLifecycle(
  record: CustomerFollowUp,
  t: TranslateFn,
): LifecycleResult {
  const nextRaw = record.next_follow_up_at;
  const next = nextRaw ? dayjs(nextRaw) : null;
  const now = dayjs();

  let revisitLabel = t('app.kuaizhizao.customerFollowUp.lifecycle.noRevisitNeeded');
  let revisitStatus: SubStage['status'] = 'done';
  let percent = 100;
  let stageName = t('app.kuaizhizao.customerFollowUp.lifecycle.closed');
  let lifecycleStatus: LifecycleResult['status'] = 'success';
  const suggestions: string[] = [];

  if (next?.isValid()) {
    if (next.isAfter(now)) {
      revisitLabel = t('app.kuaizhizao.customerFollowUp.lifecycle.pendingRevisit');
      revisitStatus = 'active';
      percent = 52;
      stageName = t('app.kuaizhizao.customerFollowUp.lifecycle.pendingRevisit');
      suggestions.push(
        t('app.kuaizhizao.customerFollowUp.lifecycle.suggestionNextPlan', { datetime: fmtPlan(next) }),
      );
    } else {
      revisitLabel = t('app.kuaizhizao.customerFollowUp.lifecycle.revisitOverdue');
      revisitStatus = 'active';
      percent = 72;
      stageName = t('app.kuaizhizao.customerFollowUp.lifecycle.revisitOverdue');
      lifecycleStatus = 'exception';
      suggestions.push(t('app.kuaizhizao.customerFollowUp.lifecycle.suggestionOverdue'));
    }
  }

  const mainStages: SubStage[] = [
    {
      key: 'recorded',
      label: t('app.kuaizhizao.customerFollowUp.lifecycle.recorded'),
      status: 'done',
    },
    { key: 'revisit_plan', label: revisitLabel, status: revisitStatus },
  ];

  return {
    percent,
    stageName,
    status: lifecycleStatus,
    mainStages,
    nextStepSuggestions: suggestions.length ? suggestions : undefined,
  };
}
