import type { TFunction } from 'i18next';
import type { MessageInstance } from 'antd/es/message/interface';
import type { BatchUpdateResult } from '../../../services/production';

export function reportBatchUpdateResult(
  messageApi: MessageInstance,
  label: string,
  result?: BatchUpdateResult | null,
  t?: TFunction
): void {
  if (!result) return;
  const updated = result.updated?.length ?? 0;
  const frozen = result.skipped_frozen?.length ?? 0;
  const freezeWin = result.skipped_freeze_window?.length ?? 0;
  const failed = result.failed?.length ?? 0;
  if (updated > 0) {
    messageApi.success(
      t
        ? t('app.kuaizhizao.scheduling.batch.updated', { label, count: updated })
        : `${label}：已更新 ${updated} 条`
    );
  }
  if (frozen > 0) {
    messageApi.warning(
      t
        ? t('app.kuaizhizao.scheduling.batch.skippedFrozen', { label, count: frozen })
        : `${label}：${frozen} 条因工单冻结未更新`
    );
  }
  if (freezeWin > 0) {
    messageApi.warning(
      t
        ? t('app.kuaizhizao.scheduling.batch.skippedFreezeWindow', { label, count: freezeWin })
        : `${label}：${freezeWin} 条因落在冻结窗内未更新`
    );
  }
  if (failed > 0) {
    const detail = result.failed?.slice(0, 3).map((f) => `${f.id}: ${f.reason}`).join('；');
    messageApi.error(
      t
        ? t('app.kuaizhizao.scheduling.batch.failed', {
            label,
            count: failed,
            detail: detail ? t('app.kuaizhizao.scheduling.batch.failedDetail', { detail }) : '',
          })
        : `${label}：${failed} 条失败${detail ? `（${detail}）` : ''}`
    );
  }
  if (updated === 0 && frozen === 0 && freezeWin === 0 && failed === 0) {
    messageApi.info(
      t ? t('app.kuaizhizao.scheduling.batch.noUpdate', { label }) : `${label}：无有效更新`
    );
  }
}

/** 排产落库：若请求更新但无一成功，抛出错误避免前端误显示已保存 */
export function ensureBatchUpdatesPersisted(
  result: BatchUpdateResult | null | undefined,
  expectedCount: number,
  label: string,
  t?: TFunction
): void {
  if (expectedCount <= 0) return;
  const updated = result?.updated?.length ?? 0;
  if (updated > 0) return;
  const frozen = result?.skipped_frozen?.length ?? 0;
  const freezeWin = result?.skipped_freeze_window?.length ?? 0;
  const failed = result?.failed?.length ?? 0;
  if (freezeWin > 0) {
    throw new Error(
      t
        ? t('app.kuaizhizao.scheduling.batch.notSavedFreezeWindow', { label })
        : `${label}未保存：计划开始落在冻结窗内，请将开始时间调到冻结窗之后或缩短冻结天数`
    );
  }
  if (frozen > 0) {
    throw new Error(
      t
        ? t('app.kuaizhizao.scheduling.batch.notSavedFrozen', { label })
        : `${label}未保存：工单已冻结，请先解冻后再排产`
    );
  }
  if (failed > 0) {
    const detail = result?.failed?.slice(0, 2).map((f) => f.reason).join('；');
    throw new Error(
      t
        ? t('app.kuaizhizao.scheduling.batch.notSavedFailed', {
            label,
            detail: detail || t('app.kuaizhizao.scheduling.batch.notSavedServerRejected'),
          })
        : `${label}未保存：${detail || '服务器拒绝更新'}`
    );
  }
  throw new Error(
    t
      ? t('app.kuaizhizao.scheduling.batch.notSavedRetry', { label })
      : `${label}未保存：请检查计划时间后重试`
  );
}
