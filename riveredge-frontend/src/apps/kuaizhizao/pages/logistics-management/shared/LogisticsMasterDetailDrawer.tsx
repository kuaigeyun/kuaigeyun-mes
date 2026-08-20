/**
 * 物流基础资料详情抽屉（车辆 / 驾驶员 / 承运商）。
 * STANDARD_WIDTH、2 列 Descriptions、无生命周期/全链路。
 */

import React from 'react';
import { Descriptions } from 'antd';
import type { ProDescriptionsItemProps } from '@ant-design/pro-components';
import {
  DetailDrawerTemplate,
  DRAWER_CONFIG,
  useDetailDrawerDescriptionItems,
} from '../../../../../components/layout-templates';

type LogisticsMasterDetailDrawerProps<T extends object> = {
  open: boolean;
  onClose: () => void;
  record: T | null;
  title: string;
  extra?: React.ReactNode;
  basicColumns: ProDescriptionsItemProps<T>[];
};

export function LogisticsMasterDetailDrawer<T extends object>({
  open,
  onClose,
  record,
  title,
  extra,
  basicColumns,
}: LogisticsMasterDetailDrawerProps<T>) {
  const contentReady = Boolean(record);

  const timeconfigBasicItems = useDetailDrawerDescriptionItems(
    basicColumns as ProDescriptionsItemProps<Record<string, unknown>>[],
              record as Record<string, unknown>,
  );

  if (!open) return null;

  return (
    <DetailDrawerTemplate
      title={title}
      open={open}
      onClose={onClose}
      width={DRAWER_CONFIG.STANDARD_WIDTH}
      extra={contentReady ? extra ?? null : null}
      basic={
        contentReady && record ? (
          <Descriptions
            column={2}
            size="small"
            items={timeconfigBasicItems}
          />
        ) : (
          <div style={{ minHeight: 80 }} />
        )
      }
    />
  );
}
