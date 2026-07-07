import type { TFunction } from 'i18next';

const D = 'app.kuaicaiwu.documentReconciliation';

const FALLBACK: Record<string, string> = {
  unlinked: '未关联业财链',
  unsettled: '仍有未结清金额',
  unlinked_and_unsettled: '未关联业财链且仍有未结清金额',
};

export const documentReconciliationGapReasonMessage = (
  reason: string | null | undefined,
  t: TFunction,
): string => {
  if (!reason) return '';
  const key = `${D}.gap.${reason}`;
  const translated = t(key);
  if (translated !== key) return translated;
  return FALLBACK[reason] ?? reason;
};
