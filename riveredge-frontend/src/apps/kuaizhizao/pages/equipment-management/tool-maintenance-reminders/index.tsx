/**
 * 工装保养/校准提醒页面
 *
 * 保养：方案周期 + 上次保养日期/使用次数；校准：台账下次校准日期 7 天窗口。
 */

import React, { useRef, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { Button, Tag, Typography } from 'antd';
import { UniTable } from '../../../../../components/uni-table';
import { UniLifecycle } from '../../../../../components/uni-lifecycle';
import { getDueReminderLifecycle } from '../../../utils/equipmentLifecycle';
import { MultiTabListPageTemplate } from '../../../../../components/layout-templates';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { toolApi } from '../../../services/equipment';
import { formatDateTime } from '../../../../../utils/format';

const RESOURCE = 'kuaizhizao:tool-maintenance-reminder';

interface ToolMaintenanceReminder {
  tool_uuid?: string;
  tool_code?: string;
  tool_name?: string;
  trigger_type?: string;
  total_usage_count?: number;
  maintenance_interval?: number;
  next_maintenance_at_count?: number;
  usages_until_due?: number;
  last_maintenance_date?: string;
  days_since_maintenance?: number;
  trigger_interval_days?: number;
  reminder_type?: string;
}

interface ToolCalibrationReminder {
  tool_uuid?: string;
  tool_code?: string;
  tool_name?: string;
  due_type?: string;
  due_date?: string;
  days_until_due?: number;
  calibration_period?: number;
  last_calibration_date?: string;
}

const ToolMaintenanceRemindersPage: React.FC = () => {
  const { t } = useTranslation();
  const perms = useResourcePermissions(RESOURCE);
  const maintenanceActionRef = useRef<ActionType>(null);
  const calibrationActionRef = useRef<ActionType>(null);
  const [maintenanceSelectedRowKeys, setMaintenanceSelectedRowKeys] = useState<React.Key[]>([]);
  const [calibrationSelectedRowKeys, setCalibrationSelectedRowKeys] = useState<React.Key[]>([]);
  const [activeTabKey, setActiveTabKey] = useState('maintenance');

  const maintenanceColumns: ProColumns<ToolMaintenanceReminder>[] = useMemo(
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
      { title: t('app.kuaizhizao.toolMaintenanceReminder.colToolName'), dataIndex: 'tool_name', width: 160, ellipsis: true },
      {
        title: t('app.kuaizhizao.toolMaintenanceReminder.colTriggerType'),
        dataIndex: 'trigger_type',
        width: 100,
        valueType: 'select',
        valueEnum: {
          days: { text: t('app.kuaizhizao.toolMaintenanceReminder.triggerDays') },
          usage_count: { text: t('app.kuaizhizao.toolMaintenanceReminder.triggerUsage') },
        },
      },
      {
        title: t('app.kuaizhizao.toolMaintenanceReminder.colTotalUsageCount'),
        dataIndex: 'total_usage_count',
        width: 110,
        align: 'right',
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.toolMaintenanceReminder.colMaintenanceInterval'),
        dataIndex: 'maintenance_interval',
        width: 100,
        align: 'right',
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.toolMaintenanceReminder.colDaysSinceMaintenance'),
        dataIndex: 'days_since_maintenance',
        width: 110,
        align: 'right',
        hideInSearch: true,
        render: (_, r) => (r.trigger_type === 'days' ? (r.days_since_maintenance ?? '-') : '-'),
      },
      {
        title: t('app.kuaizhizao.toolMaintenanceReminder.colUsagesUntilDue'),
        dataIndex: 'usages_until_due',
        width: 100,
        align: 'right',
        hideInSearch: true,
        render: (_, r) => {
          if (r.trigger_type !== 'usage_count') return '-';
          const v = r.usages_until_due ?? 0;
          if (v <= 0) return <Tag color="red">{t('app.kuaizhizao.toolMaintenanceReminder.overdueUsages', { count: Math.abs(v) || 0 })}</Tag>;
          return <span>{v}</span>;
        },
      },
      {
        title: t('app.kuaizhizao.toolMaintenanceReminder.colReminderStatus'),
        dataIndex: 'reminder_type',
        width: 100,
        valueType: 'select',
        valueEnum: {
          due_soon: { text: t('app.kuaizhizao.toolMaintenanceReminder.statusDueSoon'), status: 'Warning' },
          overdue: { text: t('app.kuaizhizao.toolMaintenanceReminder.statusOverdue'), status: 'Error' },
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

  const calibrationColumns: ProColumns<ToolCalibrationReminder>[] = useMemo(
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
      { title: t('app.kuaizhizao.toolMaintenanceReminder.colToolName'), dataIndex: 'tool_name', width: 160, ellipsis: true },
      {
        title: t('app.kuaizhizao.toolMaintenanceReminder.colDueDate'),
        dataIndex: 'due_date',
        width: 120,
        hideInSearch: true,
        render: (_, r) => (r.due_date ? formatDateTime(r.due_date, 'YYYY-MM-DD') : '-'),
      },
      {
        title: t('app.kuaizhizao.toolMaintenanceReminder.colDaysUntilDue'),
        dataIndex: 'days_until_due',
        width: 100,
        align: 'right',
        hideInSearch: true,
        render: (_, r) => {
          const v = r.days_until_due ?? 0;
          if (v < 0) return <Tag color="red">{t('app.kuaizhizao.toolMaintenanceReminder.overdueDays', { count: Math.abs(v) })}</Tag>;
          return <span>{t('app.kuaizhizao.toolMaintenanceReminder.daysRemaining', { count: v })}</span>;
        },
      },
      {
        title: t('app.kuaizhizao.toolMaintenanceReminder.colReminderStatus'),
        dataIndex: 'due_type',
        width: 100,
        valueType: 'select',
        valueEnum: {
          due_soon: { text: t('app.kuaizhizao.toolMaintenanceReminder.statusDueSoon'), status: 'Warning' },
          overdue: { text: t('app.kuaizhizao.toolMaintenanceReminder.statusOverdue'), status: 'Error' },
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

  if (!perms.canRead) {
    return null;
  }

  return (
    <MultiTabListPageTemplate
      activeTabKey={activeTabKey}
      onTabChange={setActiveTabKey}
      preserveMounted
      tabs={[
        {
          key: 'maintenance',
          label: t('app.kuaizhizao.toolMaintenanceReminder.tabMaintenance'),
          children: (
            <UniTable<ToolMaintenanceReminder>
              columnPersistenceId="apps.kuaizhizao.pages.equipment-management.tool-maintenance-reminders.maintenance"
              actionRef={maintenanceActionRef}
              enableRowSelection
              selectedRowKeys={maintenanceSelectedRowKeys}
              onRowSelectionChange={setMaintenanceSelectedRowKeys}
              rowKey={(record) =>
                [record.tool_uuid, record.trigger_type, record.reminder_type, record.usages_until_due]
                  .filter((v) => v != null)
                  .join(':') || 'maintenance-reminder-unknown'
              }
              columns={maintenanceColumns}
              toolBarRender={() =>
                perms.canCreate
                  ? [
                      <Link key="create" to="/apps/kuaizhizao/equipment-management/tool-maintenances">
                        <Button type="primary">{t('app.kuaizhizao.toolMaintenanceReminder.createMaintenance')}</Button>
                      </Link>,
                    ]
                  : []
              }
              request={async (params) => {
                const res = await toolApi.listMaintenanceReminders({
                  skip: ((params.current || 1) - 1) * (params.pageSize || 20),
                  limit: params.pageSize || 20,
                  reminder_type: params.reminder_type as string | undefined,
                });
                return { data: res.items || [], success: true, total: res.total || 0 };
              }}
              search={{ labelWidth: 'auto' }}
              pagination={{ defaultPageSize: 20 }}
              scroll={{ x: 1200 }}
            />
          ),
        },
        {
          key: 'calibration',
          label: t('app.kuaizhizao.toolMaintenanceReminder.tabCalibration'),
          children: (
            <UniTable<ToolCalibrationReminder>
              columnPersistenceId="apps.kuaizhizao.pages.equipment-management.tool-maintenance-reminders.calibration"
              actionRef={calibrationActionRef}
              enableRowSelection
              selectedRowKeys={calibrationSelectedRowKeys}
              onRowSelectionChange={setCalibrationSelectedRowKeys}
              rowKey={(record) =>
                [record.tool_uuid, record.due_date, record.due_type].filter(Boolean).join(':') || 'calibration-reminder-unknown'
              }
              columns={calibrationColumns}
              toolBarRender={() =>
                perms.canCreate
                  ? [
                      <Link key="create" to="/apps/kuaizhizao/equipment-management/tool-calibrations">
                        <Button type="primary">{t('app.kuaizhizao.toolMaintenanceReminder.createCalibration')}</Button>
                      </Link>,
                    ]
                  : []
              }
              request={async (params) => {
                const res = await toolApi.listCalibrationReminders({
                  skip: ((params.current || 1) - 1) * (params.pageSize || 20),
                  limit: params.pageSize || 20,
                  due_type: params.due_type as string | undefined,
                });
                return { data: res.items || [], success: true, total: res.total || 0 };
              }}
              search={{ labelWidth: 'auto' }}
              pagination={{ defaultPageSize: 20 }}
              scroll={{ x: 1000 }}
            />
          ),
        },
      ]}
    />
  );
};

export default ToolMaintenanceRemindersPage;
