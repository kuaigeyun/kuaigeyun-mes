/**
 * 好力 GO — 保养预警表（统计报表：台账 + 厂内保养完修合并预警）
 */

import React, { useMemo, useRef } from 'react';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Tag } from 'antd';
import dayjs from 'dayjs';
import { UniTable } from '../../../../../../components/uni-table';
import { ListPageTemplate } from '../../../../../../components/layout-templates';
import { MOLD_LEDGER_STATUSES, getMoldLedgerStatusTagColor } from '../../../../constants/moldStatus';
import { listMoldMaintenanceCompleteSheets, listMolds, type MoldRow } from '../../../../services/haoligo';

const CACHE_TTL_MS = 45_000;

type AlertLevel = 'critical' | 'warning' | 'notice' | 'ok';

interface MoldMaintenanceAlertRow extends MoldRow {
  alert_level: AlertLevel;
  alert_reasons: string[];
  last_upkeep_at?: string;
  days_since_upkeep?: number;
  times_remaining_pct?: number;
  yield_usage_pct?: number;
}

const severityRank: Record<AlertLevel, number> = {
  critical: 0,
  warning: 1,
  notice: 2,
  ok: 3,
};

async function fetchAllPaged<T>(
  fetchPage: (skip: number, limit: number) => Promise<{ items: T[]; total: number }>,
  limit = 200,
): Promise<T[]> {
  const out: T[] = [];
  let skip = 0;
  for (let guard = 0; guard < 500; guard++) {
    const r = await fetchPage(skip, limit);
    out.push(...r.items);
    if (out.length >= r.total || r.items.length === 0) break;
    skip += limit;
  }
  return out;
}

function parseDec(s: string | null | undefined): number | undefined {
  if (s == null) return undefined;
  const t = String(s).trim();
  if (!t) return undefined;
  const n = Number(t.replace(/,/g, ''));
  return Number.isFinite(n) ? n : undefined;
}

function maxLevel(a: AlertLevel, b: AlertLevel): AlertLevel {
  return severityRank[a] <= severityRank[b] ? a : b;
}

async function buildLastUpkeepDateByMold(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const sheets = await fetchAllPaged((skip, limit) =>
    listMoldMaintenanceCompleteSheets({ skip, limit, service_type: '保养' }),
  );
  for (const s of sheets) {
    const at = s.created_at;
    if (!at) continue;
    const lines = (s.line_items || []) as { mold_code?: string | null }[];
    for (const line of lines) {
      const code = String(line.mold_code || '').trim();
      if (!code) continue;
      const prev = map.get(code);
      if (!prev || dayjs(at).isAfter(dayjs(prev))) map.set(code, at);
    }
  }
  return map;
}

function evaluateMold(row: MoldRow, lastUpkeepByMold: Map<string, string>): MoldMaintenanceAlertRow {
  const reasons: string[] = [];
  let level: AlertLevel = 'ok';
  let last_upkeep_at: string | undefined;
  let days_since_upkeep: number | undefined;
  let times_remaining_pct: number | undefined;
  let yield_usage_pct: number | undefined;

  const ut = row.usable_times;
  const usedT = row.used_times ?? 0;
  if (ut != null && ut > 0) {
    const ratio = usedT / ut;
    const remainingPct = (1 - ratio) * 100;
    if (ratio >= 1) {
      reasons.push('寿命次数已达或超过额定');
      level = maxLevel(level, 'critical');
    } else if (ratio >= 0.9) {
      reasons.push('寿命次数剩余不足 10%');
      level = maxLevel(level, 'warning');
    }
    if (ratio < 1 && ratio >= 0) {
      times_remaining_pct = Math.round(remainingPct * 10) / 10;
    }
  }

  const cycleY = parseDec(row.maintenance_cycle_by_yield);
  const usedY = parseDec(row.used_yield ?? '');
  if (cycleY != null && cycleY > 0 && usedY != null) {
    const ur = usedY / cycleY;
    yield_usage_pct = Math.round(ur * 1000) / 10;
    if (ur >= 1) {
      reasons.push('累计产量已达或超过「依产量」维保周期');
      level = maxLevel(level, 'critical');
    } else if (ur >= 0.9) {
      reasons.push('累计产量已接近「依产量」维保周期（≥90%）');
      level = maxLevel(level, 'warning');
    }
  }

  const cycleD = row.maintenance_cycle_by_days;
  const mcode = String(row.mold_code || '').trim();
  if (cycleD != null && cycleD > 0 && mcode) {
    const last = lastUpkeepByMold.get(mcode);
    if (last) {
      last_upkeep_at = last;
      const days = dayjs().startOf('day').diff(dayjs(last).startOf('day'), 'day');
      days_since_upkeep = days;
      if (days >= cycleD) {
        reasons.push(`距上次厂内保养完修已超过周期（${days}/${cycleD} 天）`);
        level = maxLevel(level, 'critical');
      } else if (days >= Math.floor(cycleD * 0.9)) {
        reasons.push(`距上次厂内保养完修已接近周期（${days}/${cycleD} 天）`);
        level = maxLevel(level, 'warning');
      }
    } else {
      reasons.push('已配置「依天」保养周期，但未找到厂内保养完修记录');
      level = maxLevel(level, 'notice');
    }
  }

  return {
    ...row,
    alert_level: level,
    alert_reasons: reasons,
    last_upkeep_at,
    days_since_upkeep,
    times_remaining_pct,
    yield_usage_pct,
  };
}

function passesSeverityFilter(row: MoldMaintenanceAlertRow, min: string | undefined): boolean {
  if (!min || min === 'all') return true;
  const r = severityRank[row.alert_level];
  if (min === 'critical') return row.alert_level === 'critical';
  if (min === 'warning') return r <= severityRank.warning;
  if (min === 'notice') return r <= severityRank.notice;
  return true;
}

function alertTag(level: AlertLevel) {
  if (level === 'critical') return <Tag color="error">紧急</Tag>;
  if (level === 'warning') return <Tag color="warning">预警</Tag>;
  if (level === 'notice') return <Tag color="processing">提示</Tag>;
  return <Tag color="success">正常</Tag>;
}

const MoldMaintenanceAlertReportPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const cacheRef = useRef<{ at: number; rows: MoldMaintenanceAlertRow[] } | null>(null);

  const statusValueEnum = useMemo(
    () =>
      MOLD_LEDGER_STATUSES.reduce<Record<string, { text: string }>>((acc, s) => {
        acc[s] = { text: s };
        return acc;
      }, {}),
    [],
  );

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
        notice: { text: '提示及以上' },
        warning: { text: '预警及以上（含紧急）' },
        critical: { text: '仅紧急' },
      },
      initialValue: 'warning',
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
      valueType: 'select',
      valueEnum: statusValueEnum,
      width: 110,
      fieldProps: { allowClear: true },
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
      title: '上次厂内保养完修',
      dataIndex: 'last_upkeep_at',
      width: 168,
      hideInSearch: true,
      render: (_, r) => (r.last_upkeep_at ? dayjs(r.last_upkeep_at).format('YYYY-MM-DD HH:mm') : '—'),
    },
    {
      title: '距上次保养(天)',
      dataIndex: 'days_since_upkeep',
      width: 120,
      hideInSearch: true,
      render: (_, r) => (r.days_since_upkeep != null ? r.days_since_upkeep : '—'),
    },
    {
      title: '寿命剩余%',
      dataIndex: 'times_remaining_pct',
      width: 110,
      hideInSearch: true,
      render: (_, r) => (r.times_remaining_pct != null ? `${r.times_remaining_pct}%` : '—'),
    },
    {
      title: '产量周期达成%',
      dataIndex: 'yield_usage_pct',
      width: 130,
      hideInSearch: true,
      render: (_, r) => (r.yield_usage_pct != null ? `${r.yield_usage_pct}%` : '—'),
    },
    { title: '额定寿命次数', dataIndex: 'usable_times', width: 120, hideInSearch: true },
    { title: '已用次数', dataIndex: 'used_times', width: 96, hideInSearch: true },
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
      title: '维保周期(天)',
      dataIndex: 'maintenance_cycle_by_days',
      width: 120,
      hideInSearch: true,
      render: (_, r) => r.maintenance_cycle_by_days ?? '—',
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
              const [molds, lastUpkeep] = await Promise.all([
                fetchAllPaged((skip, limit) => listMolds({ skip, limit })),
                buildLastUpkeepDateByMold(),
              ]);
              rows = molds.map((m) => evaluateMold(m, lastUpkeep));
              cacheRef.current = { at: now, rows };
            }
            const kw =
              typeof searchFormValues?.keyword === 'string' ? searchFormValues.keyword.trim().toLowerCase() : '';
            const st =
              typeof searchFormValues?.status === 'string' && searchFormValues.status.trim()
                ? searchFormValues.status.trim()
                : '';
            const sevMin =
              typeof searchFormValues?.severity_min === 'string' ? searchFormValues.severity_min : 'warning';

            let filtered = rows!.filter((r) => {
              if (st && r.status !== st) return false;
              if (kw) {
                const hay = `${r.mold_code}\n${r.name}`.toLowerCase();
                if (!hay.includes(kw)) return false;
              }
              return passesSeverityFilter(r, sevMin === 'all' ? 'all' : sevMin);
            });
            filtered = [...filtered].sort((a, b) => {
              const d = severityRank[a.alert_level] - severityRank[b.alert_level];
              if (d !== 0) return d;
              return String(a.mold_code).localeCompare(String(b.mold_code));
            });
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
