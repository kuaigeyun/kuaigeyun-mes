/**
 * 模具保养提醒页面
 *
 * 基于使用次数（maintenance_interval）展示即将到期/已过期的模具保养提醒。
 */

import React, { useRef, useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns, ProDescriptionsItemProps } from '@ant-design/pro-components';
import { Button, Tag, Typography } from 'antd';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import { rowActionKind } from '../../../../../components/uni-action';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { moldApi } from '../../../services/equipment';
import { alignProColumns, SALES_DOC_LIST_FIELD_RANK } from '../../sales-management/shared/documentFieldAlignment';
import {
  normalizeEquipmentListResponse,
  resolveReminderListParams,
} from '../../../utils/equipmentListCore';
import {
  EquipmentMasterDetailDrawer,
  useEquipmentDetailDrawer,
} from '../shared/equipmentMasterDataDetail';

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

const P = 'app.kuaizhizao.moldMaintenanceReminder';
const RESOURCE = 'kuaizhizao:mold-maintenance-reminder';

const MoldMaintenanceRemindersPage: React.FC = () => {
  const { t } = useTranslation();
  const perms = useResourcePermissions(RESOURCE);
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const { open: detailVisible, loading: detailLoading, detail, openDetail, closeDetail } =
    useEquipmentDetailDrawer<MoldMaintenanceReminder>();

  const reminderStatusLabel = (type?: string) => {
    if (type === 'overdue') return t(`${P}.statusOverdue`);
    if (type === 'due_soon') return t(`${P}.statusDueSoon`);
    return type ?? '-';
  };

  const handleDetail = useCallback(
    (record: MoldMaintenanceReminder) => {
      if (!record.mold_uuid) return;
      void openDetail(async () => record as MoldMaintenanceReminder);
    },
    [openDetail],
  );

  const detailColumns: ProDescriptionsItemProps<MoldMaintenanceReminder>[] = useMemo(
    () => [
      { title: t(`${P}.colMoldCode`), dataIndex: 'mold_code' },
      { title: t(`${P}.colMoldName`), dataIndex: 'mold_name' },
      { title: t(`${P}.colTotalUsageCount`), dataIndex: 'total_usage_count' },
      { title: t(`${P}.colMaintenanceInterval`), dataIndex: 'maintenance_interval' },
      { title: t(`${P}.colNextMaintenanceAtCount`), dataIndex: 'next_maintenance_at_count' },
      {
        title: t(`${P}.colUsagesUntilDue`),
        key: 'usages_until_due',
        render: (_, r) => {
          const v = r.usages_until_due ?? 0;
          if (v < 0) {
            return (
              <Tag color="error">
                {t(`${P}.overdueUsages`, { count: Math.abs(v) })}
              </Tag>
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
          return <Tag color={color}>{reminderStatusLabel(r.reminder_type)}</Tag>;
        },
      },
    ],
    [t],
  );

  const columns: ProColumns<MoldMaintenanceReminder>[] = useMemo(
    () => [
      {
        title: t(`${P}.colReminderStatus`),
        dataIndex: 'reminder_type',
        valueType: 'select',
        valueEnum: {
          due_soon: { text: t(`${P}.statusDueSoon`) },
          overdue: { text: t(`${P}.statusOverdue`) },
        },
        hideInTable: true,
        search: { order: 10 } as ProColumns['search'],
      },
      {
        title: t(`${P}.colMoldCode`),
        dataIndex: 'mold_code',
        width: 120,
        sorter: true,
        search: { order: 30 } as ProColumns['search'],
        render: (_, r) => (
          <Typography.Text copyable={{ text: String(r.mold_code ?? '') }} ellipsis>
            {r.mold_code ?? '-'}
          </Typography.Text>
        ),
      },
      {
        title: t(`${P}.colMoldName`),
        dataIndex: 'mold_name',
        width: 180,
        ellipsis: true,
        sorter: true,
        hideInSearch: true,
      },
      {
        title: t(`${P}.colTotalUsageCount`),
        dataIndex: 'total_usage_count',
        width: 120,
        align: 'right',
        sorter: true,
        hideInSearch: true,
      },
      {
        title: t(`${P}.colMaintenanceInterval`),
        dataIndex: 'maintenance_interval',
        width: 100,
        align: 'right',
        sorter: true,
        hideInSearch: true,
      },
      {
        title: t(`${P}.colNextMaintenanceAtCount`),
        dataIndex: 'next_maintenance_at_count',
        width: 120,
        align: 'right',
        sorter: true,
        hideInSearch: true,
      },
      {
        title: t(`${P}.colUsagesUntilDue`),
        dataIndex: 'usages_until_due',
        width: 100,
        align: 'right',
        sorter: true,
        hideInSearch: true,
        render: (_, r) => {
          const v = r.usages_until_due ?? 0;
          if (v < 0) {
            return <Tag color="red">{t(`${P}.overdueUsages`, { count: Math.abs(v) })}</Tag>;
          }
          return <span>{v}</span>;
        },
      },
      {
        title: t('common.actions'),
        valueType: 'option',
        fixed: 'right',
        hideInSearch: true,
        render: (_, record) =>
          perms.canRead
            ? [
                <Button key="detail" {...rowActionKind('read')} onClick={() => handleDetail(record)} />,
              ]
            : null,
      },
    ],
    [t, perms.canRead, handleDetail],
  );

  if (!perms.canRead) return null;

  return (
    <>
      <ListPageTemplate>
        <UniTable<MoldMaintenanceReminder>
          headerTitle={t(`${P}.title`)}
          columnPersistenceId="apps.kuaizhizao.pages.equipment-management.mold-maintenance-reminders"
          actionRef={actionRef}
          enableRowSelection
          selectedRowKeys={selectedRowKeys}
          onRowSelectionChange={setSelectedRowKeys}
          rowKey="mold_uuid"
          columns={alignProColumns(columns, SALES_DOC_LIST_FIELD_RANK)}
          showAdvancedSearch
          skipFuzzyPinyinClientFilter
          onRow={(record) => ({
            onClick: () => handleDetail(record),
            style: { cursor: 'pointer' },
          })}
          request={async (params, sort, _filter, searchFormValues) => {
            const listParams = resolveReminderListParams(searchFormValues, sort);
            const res = await moldApi.listMaintenanceReminders({
              skip: ((params.current || 1) - 1) * (params.pageSize || 20),
              limit: params.pageSize || 20,
              ...listParams,
            });
            const { data, total } = normalizeEquipmentListResponse(res);
            return { data: data as MoldMaintenanceReminder[], success: true, total };
          }}
          search={{ labelWidth: 'auto' }}
          pagination={{ defaultPageSize: 20 }}
        />
      </ListPageTemplate>

      <EquipmentMasterDetailDrawer
        open={detailVisible}
        loading={detailLoading}
        detail={detail}
        title={`${t(`${P}.title`)}${detail?.mold_code ? ` - ${detail.mold_code}` : ''}`}
        onClose={closeDetail}
        basicColumns={detailColumns}
      />
    </>
  );
};

export default MoldMaintenanceRemindersPage;
