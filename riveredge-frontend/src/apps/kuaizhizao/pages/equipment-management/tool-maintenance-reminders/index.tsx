/**
 * 工装保养提醒页面
 *
 * 基于 next_maintenance_date、next_calibration_date 展示即将到期/已过期的工装保养、校准提醒。
 */

import React, { useRef, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { Tag, Typography } from 'antd';
import { UniTable } from '../../../../../components/uni-table';
import { UniLifecycle } from '../../../../../components/uni-lifecycle';
import { getDueReminderLifecycle } from '../../../utils/equipmentLifecycle';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import { toolApi } from '../../../services/equipment';
import dayjs from 'dayjs';
import { formatDateTime } from '../../../../../utils/format';

interface ToolMaintenanceReminder {
  tool_uuid?: string;
  tool_code?: string;
  tool_name?: string;
  reminder_type?: string;
  due_type?: string;
  due_date?: string;
  days_until_due?: number;
}

const ToolMaintenanceRemindersPage: React.FC = () => {
  const { t } = useTranslation();
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const columns: ProColumns<ToolMaintenanceReminder>[] = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.toolMaintenanceReminder.colToolCode'),
        dataIndex: 'tool_code',
        width: 120,
        render: (_, r) => (
          <Typography.Text copyable={{ text: String(r.tool_code ?? '') }} ellipsis>
            {r.tool_code ?? '-'}
          </Typography.Text>
        ),
      },
      { title: t('app.kuaizhizao.toolMaintenanceReminder.colToolName'), dataIndex: 'tool_name', width: 180, ellipsis: true },
      {
        title: t('app.kuaizhizao.toolMaintenanceReminder.colType'),
        dataIndex: 'reminder_type',
        width: 90,
        render: (_, r) =>
          r.reminder_type === 'maintenance'
            ? t('app.kuaizhizao.toolMaintenanceReminder.typeMaintenance')
            : r.reminder_type === 'calibration'
              ? t('app.kuaizhizao.toolMaintenanceReminder.typeCalibration')
              : r.reminder_type,
      },
      {
        title: t('app.kuaizhizao.toolMaintenanceReminder.colDueDate'),
        dataIndex: 'due_date',
        width: 120,
        render: (_, r) => (r.due_date ? formatDateTime(r.due_date, 'YYYY-MM-DD') : '-'),
      },
      {
        title: t('app.kuaizhizao.toolMaintenanceReminder.colDaysUntilDue'),
        dataIndex: 'days_until_due',
        width: 100,
        align: 'right',
        render: (_, r) => {
          const v = r.days_until_due ?? 0;
          if (v < 0) return <Tag color="red">{t('app.kuaizhizao.toolMaintenanceReminder.overdueDays', { count: Math.abs(v) })}</Tag>;
          return <span>{t('app.kuaizhizao.toolMaintenanceReminder.daysRemaining', { count: v })}</span>;
        },
      },
      {
        title: t('app.kuaizhizao.toolMaintenanceReminder.colLifecycle'),
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
      <UniTable<ToolMaintenanceReminder>
        headerTitle={t('app.kuaizhizao.toolMaintenanceReminder.title')}
        columnPersistenceId="apps.kuaizhizao.pages.equipment-management.tool-maintenance-reminders"
        actionRef={actionRef}
        enableRowSelection
        selectedRowKeys={selectedRowKeys}
        onRowSelectionChange={setSelectedRowKeys}
        rowKey={(record) =>
          [record.tool_uuid, record.tool_code, record.reminder_type, record.due_type, record.due_date]
            .filter(Boolean)
            .join(':') || 'reminder-unknown'
        }
        columns={columns}
        request={async (params) => {
          const res = await toolApi.listMaintenanceReminders({
            skip: ((params.current || 1) - 1) * (params.pageSize || 20),
            limit: params.pageSize || 20,
            due_type: params.due_type,
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

export default ToolMaintenanceRemindersPage;
