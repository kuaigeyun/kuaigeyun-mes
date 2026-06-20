/**
 * 审核类单据批量操作统一入口（与行级 UniWorkflowActions / UniAuditActions 对称）。
 *
 * 门控：capabilities（业务态）+ useResourcePermissions（RBAC）。
 * 执行：逐条调用单文档 API（无 bulk 端点时统一循环）。
 */

import React, { useCallback, useMemo } from 'react';
import { App } from 'antd';
import type { ButtonProps } from 'antd';
import {
  CheckOutlined,
  RollbackOutlined,
  SendOutlined,
  UndoOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { ResourcePermissionGates } from '../../hooks/useResourcePermissions';
import { batchSomeCapabilityAllowed } from '../../hooks/useDocumentCapabilities';
import { UniBatchMenuButton, type UniBatchMenuItem } from './index';

type ActionCapability = { allowed: boolean; reason?: string | null };

export type AuditBatchAction = 'submit' | 'withdraw' | 'approve' | 'revoke';

export type AuditBatchCapabilityKeys = Record<AuditBatchAction, string>;

export const DEFAULT_AUDIT_BATCH_CAPABILITY_KEYS: AuditBatchCapabilityKeys = {
  submit: 'submit',
  withdraw: 'withdraw_submit',
  approve: 'approve',
  revoke: 'revoke_approval',
};

export const DEFAULT_AUDIT_BATCH_PERMISSION_ACTIONS: Record<
  AuditBatchAction,
  'submit' | 'revoke' | 'audit'
> = {
  submit: 'submit',
  withdraw: 'revoke',
  approve: 'audit',
  revoke: 'revoke',
};

export type AuditBatchHandlers = Partial<
  Record<AuditBatchAction, (id: number) => Promise<unknown>>
>;

export type BulkAuditBatchResult = {
  success_count?: number;
  failed_count?: number;
  failed_items?: Array<{ reason?: string }>;
};

export type BulkAuditBatchHandlers = Partial<
  Record<AuditBatchAction, (ids: number[]) => Promise<BulkAuditBatchResult>>
>;

export type CapabilitiesRecord = Record<string, ActionCapability | undefined>;

export function resolveBatchRecordId(
  key: React.Key,
  records: { id?: number }[],
  resolveIdFromKey?: (key: React.Key) => number | null,
): number | null {
  if (resolveIdFromKey) {
    const id = resolveIdFromKey(key);
    if (id != null && Number.isFinite(id) && id > 0) return id;
  }
  const id = Number(key);
  if (!Number.isFinite(id) || id <= 0) return null;
  if (records.some((r) => Number(r.id) === id)) return id;
  return id;
}

export function pickCapability(
  record: { capabilities?: CapabilitiesRecord | null },
  key: string,
): ActionCapability | undefined {
  return record.capabilities?.[key];
}

export function defaultAuditBatchAllowed<T>(
  records: T[],
  permAllowed: boolean,
  capabilityKey: string,
  pickRecord: (r: T) => { capabilities?: CapabilitiesRecord | null },
): boolean {
  return batchSomeCapabilityAllowed(records, permAllowed, (r) =>
    pickCapability(pickRecord(r), capabilityKey),
  );
}

export interface BuildAuditBatchMenuItemsOptions<T> {
  selectedRecords: T[];
  permGates: ResourcePermissionGates;
  auditEnabled?: boolean;
  handlers?: AuditBatchHandlers;
  bulkHandlers?: BulkAuditBatchHandlers;
  extraMenuItems?: UniBatchMenuItem[];
  onBatchComplete?: () => void;
  resolveIdFromKey?: (key: React.Key) => number | null;
  /** i18n 前缀，默认 components.uniBatch.audit */
  i18nPrefix?: string;
}

export function useAuditBatchRunner<T extends { id?: number }>(
  options: BuildAuditBatchMenuItemsOptions<T>,
) {
  const { message } = App.useApp();
  const { t } = useTranslation();
  const {
    permGates,
    handlers = {},
    bulkHandlers = {},
    onBatchComplete,
    resolveIdFromKey,
    i18nPrefix = 'components.uniBatch.audit',
  } = options;

  const runAction = useCallback(
    async (
      action: AuditBatchAction,
      keys: React.Key[],
      records: T[],
      auditEnabled: boolean,
    ) => {
      const handler = handlers[action];
      const bulkHandler = bulkHandlers[action];
      if (!handler && !bulkHandler) return;

      const capKey = DEFAULT_AUDIT_BATCH_CAPABILITY_KEYS[action];
      const permAction = DEFAULT_AUDIT_BATCH_PERMISSION_ACTIONS[action];
      const canPerm = permGates.canAction?.(permAction) ?? false;

      if (
        records.length > 0 &&
        !defaultAuditBatchAllowed(records, canPerm, capKey, (r) => r)
      ) {
        message.warning(t(`${i18nPrefix}.${action}NotAllowed`));
        return;
      }

      const eligibleIds: number[] = [];
      for (const key of keys) {
        const id = resolveBatchRecordId(key, records, resolveIdFromKey);
        if (id == null) continue;
        const record = records.find((r) => Number(r.id) === id);
        if (!record || !canPerm) continue;
        if (pickCapability(record, capKey)?.allowed !== true) continue;
        eligibleIds.push(id);
      }

      if (eligibleIds.length === 0) {
        message.warning(t(`${i18nPrefix}.${action}NotAllowed`));
        return;
      }

      const actionLabel = t(`${i18nPrefix}.${action}`);

      if (bulkHandler) {
        try {
          const res = await bulkHandler(eligibleIds);
          const success = res.success_count ?? 0;
          const failed = res.failed_count ?? 0;
          if (failed === 0 && success > 0) {
            message.success(t(`${i18nPrefix}.success`, { action: actionLabel, count: success }));
          } else if (success > 0 || failed > 0) {
            const reason = res.failed_items?.[0]?.reason;
            if (reason) {
              message.warning(
                t(`${i18nPrefix}.partialWithReason`, { action: actionLabel, success, failed, reason }),
              );
            } else {
              message.warning(
                t(`${i18nPrefix}.partial`, { action: actionLabel, success, failed }),
              );
            }
          }
          onBatchComplete?.();
        } catch (e: unknown) {
          const err = e as { message?: string };
          message.error(err?.message || t(`${i18nPrefix}.failed`, { action: actionLabel }));
        }
        return;
      }

      let success = 0;
      let failed = 0;

      for (const id of eligibleIds) {
        try {
          await handler!(id);
          success += 1;
        } catch {
          failed += 1;
        }
      }

      if (success > 0) {
        message.success(t(`${i18nPrefix}.success`, { action: actionLabel, count: success }));
      }
      if (failed > 0) {
        message.warning(
          t(`${i18nPrefix}.partial`, { action: actionLabel, success, failed }),
        );
      }

      onBatchComplete?.();
    },
    [
      bulkHandlers,
      handlers,
      i18nPrefix,
      message,
      onBatchComplete,
      permGates,
      resolveIdFromKey,
      t,
    ],
  );

  return { runAction };
}

export function buildAuditBatchMenuItems<T extends { id?: number }>(
  options: BuildAuditBatchMenuItemsOptions<T> & {
    selectedRowKeys: React.Key[];
    auditEnabled?: boolean;
    runAction: (
      action: AuditBatchAction,
      keys: React.Key[],
      records: T[],
      auditEnabled: boolean,
    ) => Promise<void>;
    t: (key: string) => string;
  },
): UniBatchMenuItem[] {
  const {
    selectedRecords,
    auditEnabled = false,
    permGates,
    handlers = {},
    bulkHandlers = {},
    extraMenuItems = [],
    i18nPrefix = 'components.uniBatch.audit',
    runAction,
    t,
  } = options;

  const iconByAction: Record<AuditBatchAction, React.ReactNode> = {
    submit: <SendOutlined />,
    withdraw: <RollbackOutlined />,
    approve: <CheckOutlined />,
    revoke: <UndoOutlined />,
  };

  const auditActions: AuditBatchAction[] = ['withdraw', 'approve', 'revoke'];
  const actionsToBuild: AuditBatchAction[] = [
    'submit',
    ...(auditEnabled ? auditActions : []),
  ];

  const items: UniBatchMenuItem[] = [];

  for (const action of actionsToBuild) {
    const handler = handlers[action];
    const bulkHandler = bulkHandlers?.[action];
    if (!handler && !bulkHandler) continue;

    const capKey = DEFAULT_AUDIT_BATCH_CAPABILITY_KEYS[action];
    const permAction = DEFAULT_AUDIT_BATCH_PERMISSION_ACTIONS[action];
    const canPerm = permGates.canAction?.(permAction) ?? false;

    const disabled =
      selectedRecords.length > 0 &&
      !defaultAuditBatchAllowed(selectedRecords, canPerm, capKey, (r) => r);

    items.push({
      key: action,
      label: t(`${i18nPrefix}.${action}`),
      icon: iconByAction[action],
      disabled,
      onClick: (keys) => runAction(action, keys, selectedRecords, auditEnabled),
    });
  }

  return [...items, ...extraMenuItems];
}

export interface UniAuditBatchMenuButtonProps<T extends { id?: number }>
  extends Omit<BuildAuditBatchMenuItemsOptions<T>, 'onBatchComplete'> {
  selectedRowKeys: React.Key[];
  selectedRecords: T[];
  auditEnabled?: boolean;
  onSuccess?: () => void;
  toolBarButtonSize?: ButtonProps['size'];
}

/** 审核流批量菜单：capabilities + RBAC；挂在 UniBatchMenuButton 上 */
export function UniAuditBatchMenuButton<T extends { id?: number }>({
  selectedRowKeys,
  selectedRecords,
  auditEnabled = false,
  permGates,
  handlers,
  bulkHandlers,
  extraMenuItems,
  resolveIdFromKey,
  i18nPrefix,
  onSuccess,
  toolBarButtonSize = 'middle',
}: UniAuditBatchMenuButtonProps<T>) {
  const { t } = useTranslation();
  const { runAction } = useAuditBatchRunner<T>({
    permGates,
    handlers,
    bulkHandlers,
    resolveIdFromKey,
    i18nPrefix,
    onBatchComplete: onSuccess,
    selectedRecords,
  });

  const menuItems = useMemo(
    () =>
      buildAuditBatchMenuItems({
        selectedRowKeys,
        selectedRecords,
        auditEnabled,
        permGates,
        handlers,
        bulkHandlers,
        extraMenuItems,
        i18nPrefix,
        runAction,
        t,
      }),
    [
      selectedRowKeys,
      selectedRecords,
      auditEnabled,
      permGates,
      handlers,
      bulkHandlers,
      extraMenuItems,
      i18nPrefix,
      runAction,
      t,
    ],
  );

  if (menuItems.length === 0) {
    return null;
  }

  return (
    <UniBatchMenuButton
      selectedRowKeys={selectedRowKeys}
      menuItems={menuItems}
      toolBarButtonSize={toolBarButtonSize}
    />
  );
}
