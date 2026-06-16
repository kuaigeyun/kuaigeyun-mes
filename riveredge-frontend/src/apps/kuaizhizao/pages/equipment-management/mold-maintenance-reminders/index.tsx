/**
 * 模具保养提醒页面
 *
 * 基于使用次数（maintenance_interval）展示即将到期/已过期的模具保养提醒。
 */

import React, { useRef, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { Tag, Typography } from 'antd';
import { UniTable } from '../../../../../components/uni-table';
import { UniLifecycle } from '../../../../../components/uni-lifecycle';
import { getDueReminderLifecycle } from '../../../utils/equipmentLifecycle';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import { moldApi } from '../../../services/equipment';

interface MoldMaintenanceReminder {
  mold_uuid?: string;
  mold_code?: string;
  mold_name?: string;
  total_usage_count?: number;
  maintenance_interval?: number;
  next_maintenance_at_count?: number;
  usages_until_due?: number;
  reminder_type?: string;
}

const MoldMaintenanceRemindersPage: React.FC = () => {
  const { t } = useTranslation();
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const columns: ProColumns<MoldMaintenanceReminder>[] = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.moldMaintenanceReminder.colMoldCode'),
        dataIndex: 'mold_code',
        width: 120,
        render: (_, r) => (
          <Typography.Text copyable={{ text: String(r.mold_code ?? '') }} ellipsis>
            {r.mold_code ?? '-'}
          </Typography.Text>
        ),
      },
      { title: t('app.kuaizhizao.moldMaintenanceReminder.colMoldName'), dataIndex: 'mold_name', width: 180, ellipsis: true },
      { title: t('app.kuaizhizao.moldMaintenanceReminder.colTotalUsageCount'), dataIndex: 'total_usage_count', width: 120, align: 'right' },
      { title: t('app.kuaizhizao.moldMaintenanceReminder.colMaintenanceInterval'), dataIndex: 'maintenance_interval', width: 100, align: 'right' },
      { title: t('app.kuaizhizao.moldMaintenanceReminder.colNextMaintenanceAtCount'), dataIndex: 'next_maintenance_at_count', width: 120, align: 'right' },
      {
        title: t('app.kuaizhizao.moldMaintenanceReminder.colUsagesUntilDue'),
        dataIndex: 'usages_until_due',
        width: 100,
        align: 'right',
        render: (_, r) => {
          const v = r.usages_until_due ?? 0;
          if (v < 0) return <Tag color="red">{t('app.kuaizhizao.moldMaintenanceReminder.overdueUsages', { count: Math.abs(v) })}</Tag>;
          return <span>{v}</span>;
        },
      },
      {
        title: t('app.kuaizhizao.moldMaintenanceReminder.colLifecycle'),
        dataIndex: 'lifecycle_stage',
        fixed: 'right',
        align: 'left',
        hideInSearch: true,
        render: (_, record) => {
          const lifecycle = getDueReminderLifecycle(record as Record<string, unknown>);
          return (
            <UniLifecycle
              percent={lifecycle.percent}
              stageName={lifecycle.stageName}
              status={lifecycle.status}
              subStages={lifecycle.subStages}
              showLabel
              size="small"
              showCircleTooltip={false}
            />
          );
        },
      },
    ],
    [t],
  );

  return (
    <ListPageTemplate>
      <UniTable<MoldMaintenanceReminder>
        headerTitle={t('app.kuaizhizao.moldMaintenanceReminder.title')}
        columnPersistenceId="apps.kuaizhizao.pages.equipment-management.mold-maintenance-reminders"
        actionRef={actionRef}
        enableRowSelection
        selectedRowKeys={selectedRowKeys}
        onRowSelectionChange={setSelectedRowKeys}
        rowKey="mold_uuid"
        columns={columns}
        request={async (params) => {
          const res = await moldApi.listMaintenanceReminders({
            skip: ((params.current || 1) - 1) * (params.pageSize || 20),
            limit: params.pageSize || 20,
            reminder_type: params.reminder_type,
            keyword: (params as any).keyword,
          });
          return { data: res.items || [], success: true, total: res.total || 0 };
        }}
        search={{ labelWidth: 'auto' }}
        pagination={{ defaultPageSize: 20 }}
        scroll={{ x: 1200 }}
      />
    </ListPageTemplate>
  );
};

export default MoldMaintenanceRemindersPage;
