/**
 * 主数据列表：批量启用 / 批量停用（基于 update isActive）
 */
import React, { useCallback, useMemo } from 'react';
import { CheckCircleOutlined, StopOutlined } from '@ant-design/icons';
import type { ActionType } from '@ant-design/pro-components';
import type { MessageInstance } from 'antd/es/message/interface';
import { useTranslation } from 'react-i18next';
import { UniBatchMenuButton, type UniBatchMenuItem } from '../../../components/uni-batch';

type MasterDataActiveUpdate = (uuid: string, data: { isActive: boolean }) => Promise<unknown>;

export async function runMasterDataBatchSetActive(
  keys: React.Key[],
  isActive: boolean,
  update: MasterDataActiveUpdate,
  messageApi: MessageInstance,
  t: (key: string, options?: Record<string, unknown>) => string,
  onDone?: () => void,
): Promise<void> {
  if (keys.length === 0) {
    messageApi.warning(t('common.selectAtLeastOne'));
    return;
  }
  const results = await Promise.allSettled(
    keys.map((key) => update(String(key), { isActive })),
  );
  const successCount = results.filter((item) => item.status === 'fulfilled').length;
  const failedCount = keys.length - successCount;
  if (successCount > 0) {
    messageApi.success(
      isActive
        ? t('app.master-data.batchEnableSuccess', { count: successCount })
        : t('app.master-data.batchDisableSuccess', { count: successCount }),
    );
  }
  if (failedCount > 0) {
    messageApi.warning(
      t('app.master-data.batchUpdatePartial', {
        success: successCount,
        failed: failedCount,
      }),
    );
  }
  onDone?.();
}

export function buildMasterDataBatchActiveMenuItems(
  t: (key: string) => string,
  run: (keys: React.Key[], isActive: boolean) => void | Promise<void>,
): UniBatchMenuItem[] {
  return [
    {
      key: 'batch-enable',
      label: t('app.master-data.batchEnable'),
      icon: <CheckCircleOutlined />,
      onClick: (keys) => run(keys, true),
    },
    {
      key: 'batch-disable',
      label: t('app.master-data.batchDisable'),
      icon: <StopOutlined />,
      onClick: (keys) => run(keys, false),
    },
  ];
}

export function MasterDataBatchActiveMenuButton(props: {
  menuKey: string;
  selectedRowKeys: React.Key[];
  menuItems: UniBatchMenuItem[];
}) {
  return (
    <UniBatchMenuButton
      key={props.menuKey}
      selectedRowKeys={props.selectedRowKeys}
      menuItems={props.menuItems}
    />
  );
}

export function useMasterDataBatchSetActive(options: {
  update: MasterDataActiveUpdate;
  messageApi: MessageInstance;
  actionRef: React.RefObject<ActionType | null>;
  selectedRowKeys: React.Key[];
  setSelectedRowKeys: (keys: React.Key[]) => void;
}) {
  const { t } = useTranslation();
  const { update, messageApi, actionRef, selectedRowKeys, setSelectedRowKeys } = options;

  const runBatchSetActive = useCallback(
    async (keys: React.Key[], isActive: boolean) => {
      await runMasterDataBatchSetActive(keys, isActive, update, messageApi, t, () => {
        setSelectedRowKeys([]);
        actionRef.current?.reload();
      });
    },
    [actionRef, messageApi, setSelectedRowKeys, t, update],
  );

  const batchActiveMenuItems = useMemo(
    () => buildMasterDataBatchActiveMenuItems(t, runBatchSetActive),
    [runBatchSetActive, t],
  );

  return { batchActiveMenuItems, runBatchSetActive };
}
