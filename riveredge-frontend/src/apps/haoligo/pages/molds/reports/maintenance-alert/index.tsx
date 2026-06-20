/**
 * 好力 GO — 保养预警表（统计报表：台账 + 厂内/外协保养完修合并预警）
 */

import React, { useRef } from 'react';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Tag } from 'antd';
import dayjs from 'dayjs';
import { UniTable } from '../../../../../../components/uni-table';
import { ListPageTemplate } from '../../../../../../components/layout-templates';
import { formatDateTime } from '../../../../../../utils/format';
import { getMoldLedgerStatusTagColor } from '../../../../constants/moldStatus';
import {
  type AlertLevel,
  type MoldMaintenanceAlertRow,
  type MoldMaintenanceReminderKind,
  dominantDimensionLabel,
  fetchMoldMaintenanceRemindersPage,
  reminderKindLabel,
  severityRank,
} from '../../../../utils/moldMaintenanceAlert';

function alertTag(level: AlertLevel) {
  if (level === 'critical') return <Tag color="error">紧急</Tag>;
  if (level === 'warning') return <Tag color="warning">预警</Tag>;
  return <Tag color="success">正常</Tag>;
}

function renderAlertCell(r: MoldMaintenanceAlertRow) {
  if (r.reminder_kind === 'manual_maintenance') {
    return <Tag color="processing">{reminderKindLabel(r.reminder_kind)}</Tag>;
  }
  if (r.reminder_kind === 'setup_no_cycle' || r.reminder_kind === 'setup_no_baseline') {
    return <Tag color="default">{reminderKindLabel(r.reminder_kind)}</Tag>;
  }
  return alertTag(r.alert_level);
}

const MoldMaintenanceAlertReportPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);

  const columns: ProColumns<MoldMaintenanceAlertRow>[] = [
    {
      title: '关键词',
      dataIndex: 'keyword',
      hideInTable: true,
      fieldProps: { placeholder: '模具代号 / 名称' },
    },
    {
      title: '最低严重程度',
      dataIndex: 'severity_min',
      valueType: 'select',
      hideInTable: true,
      valueEnum: {
        all: { text: '全部' },
        warning: { text: '预警及以上（含紧急）' },
        critical: { text: '仅紧急' },
      },
      initialValue: 'all',
    },
    {
      title: '台账状态',
      dataIndex: 'status',
      valueType: 'select',
      hideInTable: true,
      fieldProps: { allowClear: true, placeholder: '全部状态' },
      valueEnum: {
        在用: { text: '在用' },
        保养: { text: '保养' },
        待用: { text: '待用' },
        维修: { text: '维修' },
      },
    },
    {
      title: '预警',
      dataIndex: 'alert_level',
      width: 88,
      fixed: 'left',
      hideInSearch: true,
      sorter: (a, b) => severityRank[a.alert_level] - severityRank[b.alert_level],
      render: (_, r) => renderAlertCell(r),
    },
    { title: '模具代号', dataIndex: 'mold_code', width: 120, ellipsis: true, hideInSearch: true },
    { title: '模具名称', dataIndex: 'name', width: 160, ellipsis: true, hideInSearch: true },
    {
      title: '台账状态',
      dataIndex: 'status',
      width: 110,
      hideInSearch: true,
      render: (_, r) => {
        const c = getMoldLedgerStatusTagColor(r.status);
        return c ? <Tag color={c}>{r.status}</Tag> : <Tag>{r.status}</Tag>;
      },
    },
    {
      title: '主导维度',
      dataIndex: 'dominant_dimension',
      width: 110,
      hideInSearch: true,
      render: (_, r) => dominantDimensionLabel(r.dominant_dimension ?? null),
    },
    {
      title: '预警说明',
      dataIndex: 'alert_reasons',
      width: 320,
      ellipsis: true,
      hideInSearch: true,
      render: (_, r) => (r.alert_reasons.length ? r.alert_reasons.join('；') : '—'),
    },
    {
      title: '上次保养完修',
      dataIndex: 'last_upkeep_at',
      width: 168,
      hideInSearch: true,
      render: (_, r) => (r.last_upkeep_at ? formatDateTime(r.last_upkeep_at, 'YYYY-MM-DD HH:mm') : '—'),
    },
    {
      title: '已用产量达成%',
      dataIndex: 'yield_usage_pct',
      width: 130,
      hideInSearch: true,
      render: (_, r) => (r.yield_usage_pct != null ? `${r.yield_usage_pct}%` : '—'),
    },
    {
      title: '总制造数量达成%',
      dataIndex: 'total_yield_usage_pct',
      width: 140,
      hideInSearch: true,
      render: (_, r) => (r.total_yield_usage_pct != null ? `${r.total_yield_usage_pct}%` : '—'),
    },
    {
      title: '额定产量余量%',
      dataIndex: 'remaining_yield_pct',
      width: 130,
      hideInSearch: true,
      render: (_, r) => (r.remaining_yield_pct != null ? `${r.remaining_yield_pct}%` : '—'),
    },
    {
      title: '维保周期(产量)',
      dataIndex: 'maintenance_cycle_by_yield',
      width: 130,
      hideInSearch: true,
      render: (_, r) => r.maintenance_cycle_by_yield ?? '—',
    },
    {
      title: '已用产量',
      dataIndex: 'used_yield',
      width: 120,
      hideInSearch: true,
      render: (_, r) => r.used_yield ?? '—',
    },
    {
      title: '总制造数量',
      dataIndex: 'total_manufacture_qty',
      width: 120,
      hideInSearch: true,
      render: (_, r) => r.total_manufacture_qty ?? '—',
    },
    {
      title: '额定可用产量',
      dataIndex: 'usable_yield',
      width: 120,
      hideInSearch: true,
      render: (_, r) => r.usable_yield ?? '—',
    },
  ];

  return (
    <ListPageTemplate>
      <UniTable<MoldMaintenanceAlertRow>
        headerTitle="保养预警表"
        columnPersistenceId="apps.haoligo.pages.molds.reports.maintenance-alert"
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        showAdvancedSearch
        request={async (params, _sort, _filter, searchFormValues) => {
          const current = params.current ?? 1;
          const pageSize = params.pageSize ?? 20;
          try {
            const kw =
              typeof searchFormValues?.keyword === 'string' ? searchFormValues.keyword.trim() : '';
            const st =
              typeof searchFormValues?.status === 'string' && searchFormValues.status.trim()
                ? searchFormValues.status.trim()
                : undefined;
            const sevMin =
              typeof searchFormValues?.severity_min === 'string' ? searchFormValues.severity_min : 'all';

            const { items, summary } = await fetchMoldMaintenanceRemindersPage({
              keyword: kw || undefined,
              severity_min: sevMin === 'all' ? undefined : sevMin,
              status: st,
              limit: pageSize,
              offset: (current - 1) * pageSize,
            });

            return {
              data: items,
              success: true,
              total: summary.filtered_total ?? items.length,
            };
          } catch (e) {
            messageApi.error((e as Error).message || '加载保养预警失败');
            return { data: [], success: false, total: 0 };
          }
        }}
      />
    </ListPageTemplate>
  );
};

export default MoldMaintenanceAlertReportPage;
