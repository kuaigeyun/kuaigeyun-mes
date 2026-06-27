/**
 * 报工 lifecycle（模式 A）：业务主轴仅「已报工」；审核态由 record.audit + 列表「审核状态」列展示。
 */

import { createLifecycleResolver } from './createLifecycleResolver';

const P = 'app.kuaizhizao.workReporting';

export const getReportingLifecycle = createLifecycleResolver({
  stageDefs: [
    { key: 'recorded', label: '已报工', labelKey: `${P}.lifecycleRecorded` },
  ],
  statusToKey: {
    已报工: 'recorded',
    recorded: 'recorded',
  },
  nextStepSuggestions: {
    recorded: [],
  },
  successKeys: ['recorded'],
});

/** 报工记录 uni-audit 工作流 props（与 record.audit + capabilities 对齐） */
export function reportingRecordUniAuditProps(record: Record<string, unknown> | null | undefined) {
  if (!record) return {};
  const audit = (record as { audit?: { allowed_actions?: string[] } }).audit;
  return {
    auditPhase: audit,
    capabilities: (record as { capabilities?: Record<string, unknown> }).capabilities,
  };
}
