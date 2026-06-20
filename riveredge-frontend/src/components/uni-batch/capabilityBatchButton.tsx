/**
 * 非审核类 capabilities 批量按钮（单选/多选文案混合，置于批量菜单外层）。
 */

import React, { useCallback, useMemo } from 'react';
import { App } from 'antd';
import { useTranslation } from 'react-i18next';
import { batchSomeCapabilityAllowed } from '../../hooks/useDocumentCapabilities';
import { pickCapability, defaultAuditBatchAllowed } from './auditBatchMenu';
import { UniBatchButton, type UniBatchButtonProps } from './index';

export type BulkCapabilityResult = {
  success_count?: number;
  failed_count?: number;
  failed_items?: Array<{ reason?: string }>;
};

export interface RunCapabilityBatchOptions<T extends { id?: number }> {
  keys: React.Key[];
  records: T[];
  capabilityKey: string;
  permAllowed: boolean;
  resolveId?: (key: React.Key, record: T | undefined) => number | null;
  notAllowedMessage?: string;
  onSuccess?: () => void;
  i18nPrefix?: string;
}

export async function runCapabilityBatchLoop(
  options: RunCapabilityBatchOptions<unknown> & {
    onRun: (id: number) => Promise<unknown>;
    message: ReturnType<typeof App.useApp>['message'];
    t: (key: string, opts?: Record<string, unknown>) => string;
  },
): Promise<void> {
  const {
    keys,
    records,
    capabilityKey,
    permAllowed,
    resolveId,
    notAllowedMessage,
    onSuccess,
    onRun,
    message,
    t,
    i18nPrefix = 'components.uniBatch.capability',
  } = options;

  const eligibleIds: number[] = [];
  for (const key of keys) {
    const id = resolveId
      ? resolveId(key, records.find((r) => String(r.id) === String(key)))
      : Number(key);
    if (!Number.isFinite(id) || id <= 0) continue;
    const record = records.find((r) => Number(r.id) === id);
    if (!record || !permAllowed) continue;
    if (pickCapability(record, capabilityKey)?.allowed !== true) continue;
    eligibleIds.push(id);
  }

  if (eligibleIds.length === 0) {
    message.warning(notAllowedMessage ?? t(`${i18nPrefix}.notAllowed`));
    return;
  }

  let success = 0;
  let failed = 0;
  for (const id of eligibleIds) {
    try {
      await onRun(id);
      success += 1;
    } catch {
      failed += 1;
    }
  }

  if (success > 0) {
    message.success(t(`${i18nPrefix}.success`, { count: success }));
  }
  if (failed > 0) {
    message.warning(t(`${i18nPrefix}.partial`, { success, failed }));
  }
  onSuccess?.();
}

export async function runCapabilityBatchBulk(
  options: RunCapabilityBatchOptions<unknown> & {
    onRunBulk: (ids: number[]) => Promise<BulkCapabilityResult>;
    message: ReturnType<typeof App.useApp>['message'];
    t: (key: string, opts?: Record<string, unknown>) => string;
  },
): Promise<void> {
  const {
    keys,
    records,
    capabilityKey,
    permAllowed,
    resolveId,
    notAllowedMessage,
    onSuccess,
    onRunBulk,
    message,
    t,
    i18nPrefix = 'components.uniBatch.capability',
  } = options;

  const eligibleIds: number[] = [];
  for (const key of keys) {
    const id = resolveId
      ? resolveId(key, records.find((r) => String(r.id) === String(key)))
      : Number(key);
    if (!Number.isFinite(id) || id <= 0) continue;
    const record = records.find((r) => Number(r.id) === id);
    if (!record || !permAllowed) continue;
    if (pickCapability(record, capabilityKey)?.allowed !== true) continue;
    eligibleIds.push(id);
  }

  if (eligibleIds.length === 0) {
    message.warning(notAllowedMessage ?? t(`${i18nPrefix}.notAllowed`));
    return;
  }

  try {
    const res = await onRunBulk(eligibleIds);
    const success = res.success_count ?? 0;
    const failed = res.failed_count ?? 0;
    if (failed === 0 && success > 0) {
      message.success(t(`${i18nPrefix}.success`, { count: success }));
    } else if (success > 0 || failed > 0) {
      const reason = res.failed_items?.[0]?.reason;
      if (reason) {
        message.warning(t(`${i18nPrefix}.partialWithReason`, { success, failed, reason }));
      } else {
        message.warning(t(`${i18nPrefix}.partial`, { success, failed }));
      }
    }
    onSuccess?.();
  } catch (e: unknown) {
    const err = e as { message?: string };
    message.error(err?.message || t(`${i18nPrefix}.failed`));
  }
}

export interface CapabilityBatchLabels {
  single: string;
  batch: string;
  singleConfirmTitle?: React.ReactNode | ((count: number) => React.ReactNode);
  batchConfirmTitle?: React.ReactNode | ((count: number) => React.ReactNode);
  singleConfirmDescription?: React.ReactNode | ((count: number) => React.ReactNode);
  batchConfirmDescription?: React.ReactNode | ((count: number) => React.ReactNode);
}

export type UniCapabilityBatchButtonProps<T extends { id?: number }> = Omit<
  UniBatchButtonProps,
  'onAction' | 'disabled' | 'children' | 'confirmTitle' | 'confirmDescription'
> & {
  selectedRecords: T[];
  capabilityKey: string;
  permAllowed: boolean;
  labels: CapabilityBatchLabels;
  onRun?: (id: number) => Promise<unknown>;
  onRunBulk?: (ids: number[]) => Promise<BulkCapabilityResult>;
  batchAllowed?: (records: T[], permAllowed: boolean) => boolean;
  notAllowedMessage?: string;
  onSuccess?: () => void;
  resolveId?: (key: React.Key, record: T | undefined) => number | null;
  /** 仅允许选中一条（如打印） */
  singleOnly?: boolean;
  i18nPrefix?: string;
};

export function UniCapabilityBatchButton<T extends { id?: number }>({
  selectedRowKeys,
  selectedRecords,
  capabilityKey,
  permAllowed,
  labels,
  onRun,
  onRunBulk,
  batchAllowed,
  notAllowedMessage,
  onSuccess,
  resolveId,
  singleOnly = false,
  i18nPrefix,
  requireConfirm = false,
  disabled: disabledProp,
  ...buttonProps
}: UniCapabilityBatchButtonProps<T>) {
  const { message } = App.useApp();
  const { t } = useTranslation();
  const count = selectedRowKeys.length;

  const toolbarEnabled = useMemo(() => {
    if (singleOnly && count !== 1) return false;
    const fn =
      batchAllowed ??
      ((recs: T[], perm: boolean) =>
        defaultAuditBatchAllowed(recs, perm, capabilityKey, (r) => r));
    return fn(selectedRecords, permAllowed);
  }, [batchAllowed, capabilityKey, count, permAllowed, selectedRecords, singleOnly]);

  const disabled = disabledProp ?? !toolbarEnabled;

  const handleAction = useCallback(
    async (keys: React.Key[]) => {
      const base = {
        keys,
        records: selectedRecords,
        capabilityKey,
        permAllowed,
        resolveId,
        notAllowedMessage,
        onSuccess,
        message,
        t,
        i18nPrefix,
      };
      if (onRunBulk) {
        await runCapabilityBatchBulk({ ...base, onRunBulk });
      } else if (onRun) {
        await runCapabilityBatchLoop({ ...base, onRun });
      }
    },
    [
      capabilityKey,
      i18nPrefix,
      message,
      notAllowedMessage,
      onRun,
      onRunBulk,
      onSuccess,
      permAllowed,
      resolveId,
      selectedRecords,
      t,
    ],
  );

  const isSingle = count <= 1;
  const pickLabel = (
    single?: React.ReactNode | ((count: number) => React.ReactNode),
    batch?: React.ReactNode | ((count: number) => React.ReactNode),
  ) => {
    const pick = isSingle ? single : batch ?? single;
    return typeof pick === 'function' ? pick(count) : pick;
  };
  const confirmTitle = requireConfirm
    ? pickLabel(labels.singleConfirmTitle ?? labels.single, labels.batchConfirmTitle ?? labels.batch)
    : undefined;
  const confirmDescription = requireConfirm
    ? pickLabel(labels.singleConfirmDescription, labels.batchConfirmDescription)
    : undefined;

  return (
    <UniBatchButton
      selectedRowKeys={selectedRowKeys}
      onAction={handleAction}
      disabled={disabled}
      requireConfirm={requireConfirm}
      confirmTitle={confirmTitle}
      confirmDescription={confirmDescription}
      {...buttonProps}
    >
      {isSingle ? labels.single : labels.batch}
    </UniBatchButton>
  );
}
