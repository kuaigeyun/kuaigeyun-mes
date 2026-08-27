/**
 * 工装保养/校准提醒页面
 *
 * 保养：方案周期 + 上次保养日期/使用次数；校准：台账下次校准日期 7 天窗口。
 */

import React, { useRef, useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns, ProDescriptionsItemProps } from '@ant-design/pro-components';
import { Button } from 'antd';
import { MarkerTag } from '../../../../../constants/statusBadges';
import { UniTable } from '../../../../../components/uni-table';
import { MultiTabListPageTemplate } from '../../../../../components/layout-templates';
import { rowActionKind } from '../../../../../components/uni-action';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { toolApi } from '../../../services/equipment';
import { formatDateTime } from '../../../../../utils/format';
import {
  normalizeEquipmentListResponse,
  resolveReminderListParams,
} from '../../../utils/equipmentListCore';
import { buildListPageHelpViewConfig } from '../../../../../components/page-help-wiki';
import { UniTableStackedPrimaryCell } from '../../../../../components/uni-table/stackedPrimaryColumn';
import { UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS } from '../../../../../utils/uniTableLayoutColumns';
import {
  EquipmentMasterDetailDrawer,
  useEquipmentDetailDrawer,
} from '../shared/equipmentMasterDataDetail';

const P = 'app.kuaizhizao.toolMaintenanceReminder';
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

type ReminderDetailKind = 'maintenance' | 'calibration';

const ToolMaintenanceRemindersPage: React.FC = () => {
  const { t } = useTranslation();
  const perms = useResourcePermissions(RESOURCE);
  const maintenanceActionRef = useRef<ActionType>(null);
  const calibrationActionRef = useRef<ActionType>(null);
  const [maintenanceSelectedRowKeys, setMaintenanceSelectedRowKeys] = useState<React.Key[]>([]);
  const [calibrationSelectedRowKeys, setCalibrationSelectedRowKeys] = useState<React.Key[]>([]);
  const [activeTabKey, setActiveTabKey] = useState('maintenance');
  const [detailKind, setDetailKind] = useState<ReminderDetailKind>('maintenance');
  const { open: detailVisible, loading: detailLoading, detail, openDetail, closeDetail } =
    useEquipmentDetailDrawer<ToolMaintenanceReminder | ToolCalibrationReminder>();

  const reminderStatusLabel = (type?: string) => {
    if (type === 'overdue') return t(`${P}.statusOverdue`);
    if (type === 'due_soon') return t(`${P}.statusDueSoon`);
    return type ?? '-';
  };

  const handleMaintenanceDetail = useCallback(
    (record: ToolMaintenanceReminder) => {
      if (!record.tool_uuid) return;
      setDetailKind('maintenance');
      void openDetail(async () => record as ToolMaintenanceReminder);
    },
    [openDetail],
  );

  const handleCalibrationDetail = useCallback(
    (record: ToolCalibrationReminder) => {
      if (!record.tool_uuid) return;
      setDetailKind('calibration');
      void openDetail(async () => record as ToolCalibrationReminder);
    },
    [openDetail],
  );

  const maintenanceDetailColumns: ProDescriptionsItemProps<ToolMaintenanceReminder>[] = useMemo(
    () => [
      { title: t(`${P}.colToolCode`), dataIndex: 'tool_code' },
      { title: t(`${P}.colToolName`), dataIndex: 'tool_name' },
      {
        title: t(`${P}.colTriggerType`),
        dataIndex: 'trigger_type',
        render: (_, r) =>
          r.trigger_type === 'days'
            ? t(`${P}.triggerDays`)
            : r.trigger_type === 'usage_count'
              ? t(`${P}.triggerUsage`)
              : r.trigger_type ?? '-',
      },
      { title: t(`${P}.colTotalUsageCount`), dataIndex: 'total_usage_count' },
      { title: t(`${P}.colMaintenanceInterval`), dataIndex: 'maintenance_interval' },
      {
        title: t(`${P}.colDaysSinceMaintenance`),
        dataIndex: 'days_since_maintenance',
        render: (_, r) => (r.trigger_type === 'days' ? (r.days_since_maintenance ?? '-') : '-'),
      },
      {
        title: t(`${P}.colUsagesUntilDue`),
        key: 'usages_until_due',
        render: (_, r) => {
          if (r.trigger_type !== 'usage_count') return '-';
          const v = r.usages_until_due ?? 0;
          if (v <= 0) {
            return (
              <MarkerTag color="error">
                {t(`${P}.overdueUsages`, { count: Math.abs(v) || 0 })}
              </MarkerTag>
            );
          }
          return v;
        },
      },
      {
        title: t(`${P}.colReminderStatus`),
        dataIndex: 'reminder_type',
        render: (_, r) => {
          const color = r.reminder_type === 'overdue' ? 'error' : r.reminder_type === 'due_soon' ? 'warning' : 'default';
          return <MarkerTag color={color}>{reminderStatusLabel(r.reminder_type)}</MarkerTag>;
        },
      },
    ],
    [t],
  );

  const calibrationDetailColumns: ProDescriptionsItemProps<ToolCalibrationReminder>[] = useMemo(
    () => [
      { title: t(`${P}.colToolCode`), dataIndex: 'tool_code' },
      { title: t(`${P}.colToolName`), dataIndex: 'tool_name' },
      {
        title: t(`${P}.colDueDate`),
        dataIndex: 'due_date',
        render: (_, r) => (r.due_date ? formatDateTime(r.due_date, 'YYYY-MM-DD') : '-'),
      },
      {
        title: t(`${P}.colDaysUntilDue`),
        key: 'days_until_due',
        render: (_, r) => {
          const v = r.days_until_due ?? 0;
          if (v < 0) {
            return <MarkerTag color="error">{t(`${P}.overdueDays`, { count: Math.abs(v) })}</MarkerTag>;
          }
          return t(`${P}.daysRemaining`, { count: v });
        },
      },
      { title: t(`${P}.colCalibrationPeriod`, { defaultValue: '校准周期' }), dataIndex: 'calibration_period' },
      {
        title: t(`${P}.colLastCalibrationDate`, { defaultValue: '上次校准日期' }),
        dataIndex: 'last_calibration_date',
        render: (_, r) => (r.last_calibration_date ? formatDateTime(r.last_calibration_date, 'YYYY-MM-DD') : '-'),
      },
      {
        title: t(`${P}.colReminderStatus`),
        dataIndex: 'due_type',
        render: (_, r) => {
          const color = r.due_type === 'overdue' ? 'error' : r.due_type === 'due_soon' ? 'warning' : 'default';
          return <MarkerTag color={color}>{reminderStatusLabel(r.due_type)}</MarkerTag>;
        },
      },
    ],
    [t],
  );

  const detailTitle = useMemo(() => {
    const code =
      detailKind === 'maintenance'
        ? (detail as ToolMaintenanceReminder | null)?.tool_code
        : (detail as ToolCalibrationReminder | null)?.tool_code;
    const tabLabel =
      detailKind === 'maintenance' ? t(`${P}.tabMaintenance`) : t(`${P}.tabCalibration`);
    return `${tabLabel}${code ? ` - ${code}` : ''}`;
  }, [detail, detailKind, t]);

  const maintenanceColumns: ProColumns<ToolMaintenanceReminder>[] = useMemo(
    () => [
      {
        title: t(`${P}.colToolName`),
        dataIndex: 'tool_name',
        minWidth: 200,
        uniTablePrimaryFlex: true,
        uniTableRemainderFlex: true,
        resizable: false,
        ellipsis: false,
        hideInSearch: true,
        render: (_, r) => (
          <UniTableStackedPrimaryCell
            primary={String(r.tool_name ?? '') || '-'}
            secondary={String(r.tool_code ?? '') || '-'}
          />
        ),
      },
      {
        title: t(`${P}.colTriggerType`),
        dataIndex: 'trigger_type',
        width: 100,
        minWidth: 100,
        uniTableKeepWidth: true,
        resizable: false,
        valueType: 'select',
        valueEnum: {
          days: { text: t(`${P}.triggerDays`) },
          usage_count: { text: t(`${P}.triggerUsage`) },
        },
      },
      {
        title: t(`${P}.colTotalUsageCount`),
        dataIndex: 'total_usage_count',
        width: 110,
        minWidth: 110,
        uniTableKeepWidth: true,
        resizable: false,
        hideInSearch: true,
        render: (_, r) => (r.total_usage_count != null ? String(r.total_usage_count) : '-'),
      },
      {
        title: t(`${P}.colMaintenanceInterval`),
        dataIndex: 'maintenance_interval',
        width: 100,
        minWidth: 100,
        uniTableKeepWidth: true,
        resizable: false,
        hideInSearch: true,
        render: (_, r) => (r.maintenance_interval != null ? String(r.maintenance_interval) : '-'),
      },
      {
        title: t(`${P}.colDaysSinceMaintenance`),
        dataIndex: 'days_since_maintenance',
        width: 110,
        minWidth: 110,
        uniTableKeepWidth: true,
        resizable: false,
        hideInSearch: true,
        align: 'right' as const,
        render: (_, r) => (r.trigger_type === 'days' ? (r.days_since_maintenance ?? '-') : '-'),
      },
      {
        title: t(`${P}.colUsagesUntilDue`),
        dataIndex: 'usages_until_due',
        width: 100,
        minWidth: 100,
        uniTableKeepWidth: true,
        resizable: false,
        hideInSearch: true,
        align: 'right' as const,
        render: (_, r) => {
          if (r.trigger_type !== 'usage_count') return '-';
          const v = r.usages_until_due ?? 0;
          if (v <= 0) {
            return <MarkerTag color="error">{t(`${P}.overdueUsages`, { count: Math.abs(v) || 0 })}</MarkerTag>;
          }
          return <span>{v}</span>;
        },
      },
      {
        title: t(`${P}.colReminderStatus`),
        dataIndex: 'reminder_type',
        ...UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS,
        valueType: 'select',
        valueEnum: {
          due_soon: { text: t(`${P}.statusDueSoon`) },
          overdue: { text: t(`${P}.statusOverdue`) },
        },
        render: (_, r) => {
          const color =
            r.reminder_type === 'overdue' ? 'error' : r.reminder_type === 'due_soon' ? 'warning' : 'default';
          return <MarkerTag color={color}>{reminderStatusLabel(r.reminder_type)}</MarkerTag>;
        },
      },
      {
        title: t('common.actions'),
        key: 'option',
        fixed: 'right',
        hideInSearch: true,
        render: (_, record) =>
          perms.canRead
            ? [
                <Button
                  key="detail"
                  {...rowActionKind('read')}
                  onClick={() => handleMaintenanceDetail(record)}
                >
                  {t('common.detail')}
                </Button>,
              ]
            : null,
      },
    ],
    [t, perms.canRead, handleMaintenanceDetail],
  );

  const calibrationColumns: ProColumns<ToolCalibrationReminder>[] = useMemo(
    () => [
      {
        title: t(`${P}.colToolName`),
        dataIndex: 'tool_name',
        minWidth: 200,
        uniTablePrimaryFlex: true,
        uniTableRemainderFlex: true,
        resizable: false,
        ellipsis: false,
        hideInSearch: true,
        render: (_, r) => (
          <UniTableStackedPrimaryCell
            primary={String(r.tool_name ?? '') || '-'}
            secondary={String(r.tool_code ?? '') || '-'}
          />
        ),
      },
      {
        title: t(`${P}.colDueDate`),
        dataIndex: 'due_date',
        width: 120,
        minWidth: 120,
        uniTableKeepWidth: true,
        resizable: false,
        hideInSearch: true,
        render: (_, r) => (r.due_date ? formatDateTime(r.due_date, 'YYYY-MM-DD') : '-'),
      },
      {
        title: t(`${P}.colDaysUntilDue`),
        dataIndex: 'days_until_due',
        width: 100,
        minWidth: 100,
        uniTableKeepWidth: true,
        resizable: false,
        hideInSearch: true,
        align: 'right' as const,
        render: (_, r) => {
          const v = r.days_until_due ?? 0;
          if (v < 0) {
            return <MarkerTag color="error">{t(`${P}.overdueDays`, { count: Math.abs(v) })}</MarkerTag>;
          }
          return <span>{t(`${P}.daysRemaining`, { count: v })}</span>;
        },
      },
      {
        title: t(`${P}.colReminderStatus`),
        dataIndex: 'due_type',
        ...UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS,
        valueType: 'select',
        valueEnum: {
          due_soon: { text: t(`${P}.statusDueSoon`) },
          overdue: { text: t(`${P}.statusOverdue`) },
        },
        render: (_, r) => {
          const color = r.due_type === 'overdue' ? 'error' : r.due_type === 'due_soon' ? 'warning' : 'default';
          return <MarkerTag color={color}>{reminderStatusLabel(r.due_type)}</MarkerTag>;
        },
      },
      {
        title: t('common.actions'),
        key: 'option',
        fixed: 'right',
        hideInSearch: true,
        render: (_, record) =>
          perms.canRead
            ? [
                <Button
                  key="detail"
                  {...rowActionKind('read')}
                  onClick={() => handleCalibrationDetail(record)}
                >
                  {t('common.detail')}
                </Button>,
              ]
            : null,
      },
    ],
    [t, perms.canRead, handleCalibrationDetail],
  );

  if (!perms.canRead) {
    return null;
  }

  return (
    <>
      <MultiTabListPageTemplate
        activeTabKey={activeTabKey}
        onTabChange={setActiveTabKey}
        preserveMounted
        tabs={[
          {
            key: 'maintenance',
            label: t(`${P}.tabMaintenance`),
            children: (
              <UniTable<ToolMaintenanceReminder>
        viewTypes={['table', 'help']}
          helpViewConfig={buildListPageHelpViewConfig('kuaizhizao.toolMaintenanceReminders')}
                columnPersistenceId="apps.kuaizhizao.pages.equipment-management.tool-maintenance-reminders.maintenance-width-v2"
                actionRef={maintenanceActionRef}
                showAdvancedSearch
                skipFuzzyPinyinClientFilter
                enableRowSelection
                selectedRowKeys={maintenanceSelectedRowKeys}
                onRowSelectionChange={setMaintenanceSelectedRowKeys}
                rowKey={(record) =>
                  [record.tool_uuid, record.trigger_type, record.reminder_type, record.usages_until_due]
                    .filter((v) => v != null)
                    .join(':') || 'maintenance-reminder-unknown'
                }
                columns={maintenanceColumns}
                onRow={(record) => ({
                  onClick: () => handleMaintenanceDetail(record),
                  style: { cursor: 'pointer' },
                })}
                toolBarRender={() =>
                  perms.canCreate
                    ? [
                        <Link key="create" to="/apps/kuaizhizao/equipment-management/tool-maintenances">
                          <Button type="primary">{t(`${P}.createMaintenance`)}</Button>
                        </Link>,
                      ]
                    : []
                }
                request={async (params, sort, _filter, searchFormValues) => {
                  const listParams = resolveReminderListParams(searchFormValues, sort);
                  const res = await toolApi.listMaintenanceReminders({
                    skip: ((params.current || 1) - 1) * (params.pageSize || 20),
                    limit: params.pageSize || 20,
                    ...listParams,
                  });
                  const { data, total } = normalizeEquipmentListResponse(res);
                  return { data: data as ToolMaintenanceReminder[], success: true, total };
                }}
                search={{ labelWidth: 'auto' }}
                pagination={{ defaultPageSize: 20 }}
              />
            ),
          },
          {
            key: 'calibration',
            label: t(`${P}.tabCalibration`),
            children: (
              <UniTable<ToolCalibrationReminder>
                columnPersistenceId="apps.kuaizhizao.pages.equipment-management.tool-maintenance-reminders.calibration-width-v2"
                actionRef={calibrationActionRef}
                showAdvancedSearch
                skipFuzzyPinyinClientFilter
                enableRowSelection
                selectedRowKeys={calibrationSelectedRowKeys}
                onRowSelectionChange={setCalibrationSelectedRowKeys}
                rowKey={(record) =>
                  [record.tool_uuid, record.due_date, record.due_type].filter(Boolean).join(':') ||
                  'calibration-reminder-unknown'
                }
                columns={calibrationColumns}
                onRow={(record) => ({
                  onClick: () => handleCalibrationDetail(record),
                  style: { cursor: 'pointer' },
                })}
                toolBarRender={() =>
                  perms.canCreate
                    ? [
                        <Link key="create" to="/apps/kuaizhizao/equipment-management/tool-calibrations">
                          <Button type="primary">{t(`${P}.createCalibration`)}</Button>
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
              />
            ),
          },
        ]}
      />

      <EquipmentMasterDetailDrawer
        open={detailVisible}
        loading={detailLoading}
        detail={detail as Record<string, unknown> | null}
        title={detailTitle}
        onClose={closeDetail}
        basicColumns={
          detailKind === 'maintenance'
            ? (maintenanceDetailColumns as ProDescriptionsItemProps<Record<string, unknown>>[])
            : (calibrationDetailColumns as ProDescriptionsItemProps<Record<string, unknown>>[])
        }
      />
    </>
  );
};

export default ToolMaintenanceRemindersPage;
