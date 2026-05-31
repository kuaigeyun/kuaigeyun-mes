/**
 * 好力 GO — 设备保养计划表（台账 + 保养完修记录合并预警）
 */

import React, { useRef } from 'react';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Tag } from 'antd';
import dayjs from 'dayjs';
import { UniTable } from '../../../../../../components/uni-table';
import { ListPageTemplate } from '../../../../../../components/layout-templates';
import { useEquipmentOperationalStatusLabels } from '../../../../utils/equipmentOperationalStatus';
import {
  type AlertLevel,
  type EquipmentMaintenanceAlertRow,
  buildEquipmentMaintenanceAlertRows,
  dominantDimensionLabel,
  loadEquipmentMaintenanceAlertDataset,
  passesSeverityFilter,
  severityRank,
  sortMaintenanceAlertRows,
} from '../../../../utils/equipmentMaintenanceAlert';

const CACHE_TTL_MS = 45_000;

function alertTag(level: AlertLevel) {
  if (level === 'critical') return <Tag color="error">紧急</Tag>;
  if (level === 'warning') return <Tag color="warning">预警</Tag>;
  return <Tag color="success">正常</Tag>;
}

const EquipmentMaintenancePlanReportPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const cacheRef = useRef<{ at: number; rows: EquipmentMaintenanceAlertRow[] } | null>(null);
  const { formatStatus: operationalStatusLabel, labelByValue: equipmentStatusLabels } =
    useEquipmentOperationalStatusLabels();

  const columns: ProColumns<EquipmentMaintenanceAlertRow>[] = [
    {
      title: '关键词',
      dataIndex: 'keyword',
      hideInTable: true,
      fieldProps: { placeholder: '设备编号 / 名称' },
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
      render: (_, r) =>
        r.reminder_kind === 'manual_maintenance' ? (
          <Tag color="processing">待保养</Tag>
        ) : (
          alertTag(r.alert_level)
        ),
    },
    { title: '设备编号', dataIndex: 'asset_code', width: 120, ellipsis: true, hideInSearch: true },
    { title: '设备名称', dataIndex: 'name', width: 160, ellipsis: true, hideInSearch: true },
    {
      title: '运行状态',
      dataIndex: 'operational_status',
      width: 110,
      hideInSearch: true,
      render: (_, r) => operationalStatusLabel(r.operational_status, '—'),
    },
    {
      title: '主导维度',
      dataIndex: 'dominant_dimension',
      width: 96,
      hideInSearch: true,
      render: (_, r) => dominantDimensionLabel(r.dominant_dimension),
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
      title: '距上次保养(天)',
      dataIndex: 'days_since_upkeep',
      width: 120,
      hideInSearch: true,
      render: (_, r) => (r.days_since_upkeep != null ? r.days_since_upkeep : '—'),
    },
    {
      title: '产量周期达成%',
      dataIndex: 'yield_usage_pct',
      width: 130,
      hideInSearch: true,
      render: (_, r) => (r.yield_usage_pct != null ? `${r.yield_usage_pct}%` : '—'),
    },
    {
      title: '天数周期达成%',
      dataIndex: 'days_usage_pct',
      width: 130,
      hideInSearch: true,
      render: (_, r) => (r.days_usage_pct != null ? `${r.days_usage_pct}%` : '—'),
    },
    {
      title: '保养周期(产量)',
      dataIndex: 'maintenance_cycle_by_yield',
      width: 130,
      hideInSearch: true,
      render: (_, r) => r.maintenance_cycle_by_yield ?? '—',
    },
    {
      title: '累计产量',
      dataIndex: 'used_yield',
      width: 120,
      hideInSearch: true,
      render: (_, r) => r.used_yield ?? '—',
    },
    {
      title: '保养周期(天)',
      dataIndex: 'maintenance_cycle_by_days',
      width: 120,
      hideInSearch: true,
      render: (_, r) => r.maintenance_cycle_by_days ?? '—',
    },
  ];

  return (
    <ListPageTemplate>
      <UniTable<EquipmentMaintenanceAlertRow>
        headerTitle="设备保养计划表"
        columnPersistenceId="apps.haoligo.pages.equipment.reports.maintenance-plan"
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
              const { equipments, lastUpkeepByEquipment } = await loadEquipmentMaintenanceAlertDataset();
              rows = buildEquipmentMaintenanceAlertRows(
                equipments,
                lastUpkeepByEquipment,
                equipmentStatusLabels,
              );
              cacheRef.current = { at: now, rows };
            }
            const kw =
              typeof searchFormValues?.keyword === 'string' ? searchFormValues.keyword.trim().toLowerCase() : '';
            const sevMin =
              typeof searchFormValues?.severity_min === 'string' ? searchFormValues.severity_min : 'all';

            let filtered = rows!.filter((r) => {
              if (kw) {
                const hay = `${r.asset_code}\n${r.name}`.toLowerCase();
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
            messageApi.error((e as Error).message || '加载设备保养计划失败');
            return { data: [], success: false, total: 0 };
          }
        }}
      />
    </ListPageTemplate>
  );
};

export default EquipmentMaintenancePlanReportPage;
