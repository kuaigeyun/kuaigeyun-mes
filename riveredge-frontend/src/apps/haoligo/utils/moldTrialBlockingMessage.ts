import { formatDateTime } from '../../../utils/format';

export type MoldTrialBlockingInfo = {
  blocking_sheet_no?: string | null;
  blocking_sheet_id?: number | null;
  blocking_trial_user_name?: string | null;
  blocking_created_at?: string | null;
};

export function formatMoldTrialBlockingSheetClause(info: MoldTrialBlockingInfo): string | null {
  const sn = info.blocking_sheet_no?.trim();
  const label = sn || (info.blocking_sheet_id != null ? `#${info.blocking_sheet_id}` : '');
  if (!label) return null;
  const who = info.blocking_trial_user_name?.trim();
  const when = info.blocking_created_at ? formatDateTime(info.blocking_created_at, 'YYYY-MM-DD HH:mm') : '';
  const meta = [
    who ? `开单人：${who}` : null,
    when ? `开单时间：${when}` : null,
  ].filter(Boolean);
  if (meta.length) return `试模单 ${label}（${meta.join('，')}）`;
  return `试模单 ${label}`;
}

export function formatMoldTrialBlockingFlowMessage(
  info: MoldTrialBlockingInfo | null | undefined,
  options?: { suffix?: string; short?: boolean },
): string {
  const suffix =
    options?.suffix ??
    (options?.short
      ? '不可新建'
      : '请先完成试模/试产及发出收回等环节。');
  const clause = info ? formatMoldTrialBlockingSheetClause(info) : null;
  if (clause) {
    return `该模具/订单仍有未完结的试模流程（${clause}），${suffix}`;
  }
  return options?.short
    ? '该模具/订单仍有未完结的试模流程，不可新建'
    : '该模具/订单仍有未完结的试模流程，请先完成当前试模流程后再新建。';
}
