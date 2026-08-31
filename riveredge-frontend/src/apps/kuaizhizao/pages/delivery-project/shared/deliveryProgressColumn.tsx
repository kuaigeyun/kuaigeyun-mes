import React from 'react';
import type { TFunction } from 'i18next';
import {
  DocumentPushProgressBar,
  type DocumentPushProgressBarProps,
} from '../../sales-management/shared/DocumentPushProgressBar';

export function resolveDeliveryProgressStatus(
  entityStatus?: string | null,
  percent?: number | string | null,
): DocumentPushProgressBarProps['status'] | undefined {
  const value = Number(percent ?? 0);
  if (entityStatus === 'completed' || (Number.isFinite(value) && value >= 100)) return 'success';
  if (entityStatus === 'overdue') return 'exception';
  return undefined;
}

export function renderDeliveryProgressCell(
  percent: number | string | null | undefined,
  t: TFunction,
  options?: Pick<DocumentPushProgressBarProps, 'status' | 'tooltip' | 'tooltipSummary' | 'width'>,
) {
  const value = Number(percent ?? 0);
  const rounded = Math.round(Number.isFinite(value) ? value : 0);
  return (
    <DocumentPushProgressBar
      percent={value}
      status={options?.status}
      width={options?.width}
      tooltip={options?.tooltip}
      tooltipSummary={
        options?.tooltipSummary ??
        t('app.kuaizhizao.salesManagement.pushProgress.percentOnly', { percent: rounded })
      }
    />
  );
}
