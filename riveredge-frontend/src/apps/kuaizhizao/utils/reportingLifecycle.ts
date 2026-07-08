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
  nextStepSuggestionKeys: {},
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

const REPORTING_STATUS_KEYS = ['pending', 'approved', 'rejected'] as const;

const REPORTING_STATUS_I18N: Record<string, string> = {
  pending: `${P}.statusPending`,
  approved: `${P}.statusApproved`,
  rejected: `${P}.statusRejected`,
};

/** 列表审核状态筛选 / 钉住 Tab */
export function buildReportingStatusValueEnum(
  t: (key: string) => string,
): Record<string, { text: string; status?: 'Default' | 'Processing' | 'Success' | 'Error' }> {
  const statusByKey: Record<string, 'Default' | 'Processing' | 'Success' | 'Error'> = {
    pending: 'Processing',
    approved: 'Success',
    rejected: 'Error',
  };
  return Object.fromEntries(
    REPORTING_STATUS_KEYS.map((key) => [
      key,
      { text: t(REPORTING_STATUS_I18N[key]!), status: statusByKey[key] },
    ]),
  );
}

export function resolveReportingListStatusParams(
  searchFormValues?: Record<string, unknown> | null,
): { status?: string } {
  const raw = searchFormValues?.status;
  if (raw == null || String(raw).trim() === '') return {};
  const status = String(raw).trim();
  if (REPORTING_STATUS_KEYS.includes(status as (typeof REPORTING_STATUS_KEYS)[number])) {
    return { status };
  }
  return {};
}
