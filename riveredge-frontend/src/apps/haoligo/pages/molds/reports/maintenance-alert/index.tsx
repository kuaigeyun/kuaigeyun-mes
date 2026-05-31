/**
 * 好力 GO — 保养预警表（统计报表：台账 + 厂内/外协保养完修合并预警）
 */

import React, { useRef } from 'react';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Tag } from 'antd';
import dayjs from 'dayjs';
import { UniTable } from '../../../../../../components/uni-table';
import { ListPageTemplate } from '../../../../../../components/layout-templates';
import { getMoldLedgerStatusTagColor } from '../../../../constants/moldStatus';
import {
  type AlertLevel,
  type MoldMaintenanceAlertRow,
  buildMoldMaintenanceAlertRows,
  loadMoldMaintenanceAlertDataset,
  passesSeverityFilter,
  severityRank,
  sortMaintenanceAlertRows,
} from '../../../../utils/moldMaintenanceAlert';

const CACHE_TTL_MS = 45_000;

function alertTag(level: AlertLevel) {
  if (level === 'critical') return <Tag color="error">紧急</Tag>;
  if (level === 'warning') return <Tag color="warning">预警</Tag>;
  return <Tag color="success">正常</Tag>;
}

const MoldMaintenanceAlertReportPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const cacheRef = useRef<{ at: number; rows: MoldMaintenanceAlertRow[] } | null>(null);

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
      title: '预警',
      dataIndex: 'alert_level',
      width: 88,
      fixed: 'left',
      hideInSearch: true,
      sorter: (a, b) => severityRank[a.alert_level] - severityRank[b.alert_level],
      render: (_, r) => alertTag(r.alert_level),
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
      render: (_, r) => (r.last_upkeep_at ? dayjs(r.last_upkeep_at).format('YYYY-MM-DD HH:mm') : '—'),
    },
    {
      title: '产量周期达成%',
      dataIndex: 'yield_usage_pct',
      width: 130,
      hideInSearch: true,
      render: (_, r) => (r.yield_usage_pct != null ? `${r.yield_usage_pct}%` : '—'),
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
          const now = Date.now();
          try {
            let rows = cacheRef.current?.rows;
            if (!cacheRef.current || now - cacheRef.current.at > CACHE_TTL_MS) {
              const { molds, lastUpkeepByMold } = await loadMoldMaintenanceAlertDataset();
              rows = buildMoldMaintenanceAlertRows(molds, lastUpkeepByMold);
              cacheRef.current = { at: now, rows };
            }
            const kw =
              typeof searchFormValues?.keyword === 'string' ? searchFormValues.keyword.trim().toLowerCase() : '';
            const st =
              typeof searchFormValues?.status === 'string' && searchFormValues.status.trim()
                ? searchFormValues.status.trim()
                : '';
            const sevMin =
              typeof searchFormValues?.severity_min === 'string' ? searchFormValues.severity_min : 'all';

            let filtered = rows!.filter((r) => {
              if (st && r.status !== st) return false;
              if (kw) {
                const hay = `${r.mold_code}\n${r.name}`.toLowerCase();
                if (!hay.includes(kw)) return false;
              }
              return passesSeverityFilter(r, sevMin === 'all' ? 'all' : sevMin);
            });
            filtered = [...filtered].sort(sortMaintenanceAlertRows);
            const total = filtered.length;
            const start = (current - 1) * pageSize;
            const data = filtered.slice(start, start + pageSize);
            return { data, success: true, total };
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
