/**
 * 客户跟进「生命周期」：纯前端推导（无审批流）。
 * 主轴：跟进已记录 → 回访计划（待回访 / 逾期 / 无需回访）→ 闭环。
 */

import type { LifecycleResult, SubStage } from '../../../components/uni-lifecycle/types';
import type { CustomerFollowUp } from '../services/customer-follow-up';
import dayjs from 'dayjs';

function fmtPlan(dt: dayjs.Dayjs): string {
  return dt.format('YYYY-MM-DD HH:mm');
}

export function getCustomerFollowUpLifecycle(record: CustomerFollowUp): LifecycleResult {
  const nextRaw = record.next_follow_up_at;
  const next = nextRaw ? dayjs(nextRaw) : null;
  const now = dayjs();

  let revisitLabel = '无需回访';
  let revisitStatus: SubStage['status'] = 'done';
  let percent = 100;
  let stageName = '已闭环';
  let lifecycleStatus: LifecycleResult['status'] = 'success';
  const suggestions: string[] = [];

  if (next?.isValid()) {
    if (next.isAfter(now)) {
      revisitLabel = '待回访';
      revisitStatus = 'active';
      percent = 52;
      stageName = '待回访';
      suggestions.push(`下次回访计划：${fmtPlan(next)}`);
    } else {
      revisitLabel = '回访逾期';
      revisitStatus = 'active';
      percent = 72;
      stageName = '回访逾期';
      lifecycleStatus = 'exception';
      suggestions.push('已到计划回访时间，请尽快联系客户或调整下次跟进计划');
    }
  }

  const mainStages: SubStage[] = [
    { key: 'recorded', label: '跟进记录', status: 'done' },
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

/** 回访计划已到期（与 `getCustomerFollowUpLifecycle` 的 exception 态一致） */
export function isCustomerFollowUpRevisitOverdue(record: CustomerFollowUp): boolean {
  return getCustomerFollowUpLifecycle(record).status === 'exception';
}
