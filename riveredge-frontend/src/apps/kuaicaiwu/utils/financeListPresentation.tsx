/**
 * 轻财务列表展示：启用/类型/方向等 MarkerTag filled；流程态仍走 UniLifecycle（key=lifecycle）。
 */
import type { TFunction } from 'i18next';
import { MarkerTag } from '../../../constants/statusBadges';

export function renderFinanceActiveTag(
  t: TFunction,
  isActive?: boolean | null,
  enabledKey = 'common.enabled',
  disabledKey = 'common.disabled',
) {
  return (
    <MarkerTag color={isActive ? 'success' : 'default'}>
      {isActive ? t(enabledKey) : t(disabledKey)}
    </MarkerTag>
  );
}

export function renderFinanceTypeMarker(label: string, color: string = 'processing') {
  const text = String(label ?? '').trim();
  if (!text) return '-';
  return <MarkerTag color={color}>{text}</MarkerTag>;
}

export function renderFinanceDirectionTag(t: TFunction, direction?: string | null) {
  const code = String(direction ?? '').trim();
  if (code === 'in' || code === '收入') {
    return <MarkerTag color="success">{t('app.kuaicaiwu.financeUi.bankDirection.in')}</MarkerTag>;
  }
  if (code === 'out' || code === '支出') {
    return <MarkerTag color="error">{t('app.kuaicaiwu.financeUi.bankDirection.out')}</MarkerTag>;
  }
  return code ? <MarkerTag color="default">{code}</MarkerTag> : '-';
}
