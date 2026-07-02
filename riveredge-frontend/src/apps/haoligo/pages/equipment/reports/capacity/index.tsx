/**
 * 好力 GO — 产能查询（口径：设备产出单）
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Card, Col, Flex, Row, Statistic, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { ThemedSegmented } from '../../../../../../components/themed-segmented';
import { UniTable } from '../../../../../../components/uni-table';
import { ListPageTemplate, LIST_PAGE_TABLE_SCROLL } from '../../../../../../components/layout-templates';
import { formatDateTime } from '../../../../../../utils/format';
import { downloadFile } from '../../../../../../utils/fileDownload';
import {
  getEquipmentCapacityReport,
  listEquipments,
  listWorkshops,
  type EquipmentCapacityByEquipmentRow,
  type EquipmentCapacityByPeriodRow,
  type EquipmentCapacityByWorkshopRow,
  type EquipmentCapacityReportResult,
  type EquipmentCapacitySummary,
  type EquipmentOutputRecordRow,
} from '../../../../services/haoligo';
import { commitListPageSearchParams } from '../../../../../../utils/listLifecycleStage';
import {
  defaultEquipmentReportRecordedRange,
  isCapacityPeriodOnlyGroupBy,
  resolveCapacityGroupBy,
  resolveEquipmentCapacitySearchParams,
  type CapacityDimensionMode,
  type CapacityPeriodMode,
} from '../../../../utils/equipmentReportDateRange';
import { formatEquipmentOutputQty } from '../../../../utils/equipmentOutputQty';

type SelectOption = { label: string; value: number };

type CapacityExportRow =
  | EquipmentOutputRecordRow
  | EquipmentCapacityByEquipmentRow
  | EquipmentCapacityByWorkshopRow
  | EquipmentCapacityByPeriodRow;

const EXPORT_PAGE_SIZE = 200;

function formatRate(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return '—';
  return `${v}%`;
}

function optionsToValueEnum(options: SelectOption[]): Record<string, { text: string }> {
  return Object.fromEntries(options.map((opt) => [String(opt.value), { text: opt.label }]));
}

function escapeCsvCell(v: unknown): string {
  const s = v == null ? '' : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function buildCsv(headers: string[], rows: string[][]): string {
  const lines = [headers.map(escapeCsvCell).join(','), ...rows.map((row) => row.map(escapeCsvCell).join(','))];
  return `\ufeff${lines.join('\n')}`;
}

function equipmentLabel(assetCode?: string | null, name?: string | null, id?: number): string {
  if (assetCode || name) return `${assetCode || ''} ${name || ''}`.trim();
  return id != null ? `ID ${id}` : '—';
}

const EquipmentCapacityReportPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const searchParamsRef = useRef<Record<string, unknown> | undefined>(undefined);
  const [dimensionMode, setDimensionMode] = useState<CapacityDimensionMode>('detail');
  const [periodMode, setPeriodMode] = useState<CapacityPeriodMode>('none');
  const [summary, setSummary] = useState<EquipmentCapacitySummary | null>(null);
  const [equipmentOptions, setEquipmentOptions] = useState<SelectOption[]>([]);
  const [workshopOptions, setWorkshopOptions] = useState<SelectOption[]>([]);

  const title = t('app.haoligo.menu.equipment.reports.capacity');
  const defaultRange = useMemo(() => defaultEquipmentReportRecordedRange(), []);

  const searchDefaults = useMemo(
    () => ({
      recorded_at_range: defaultRange,
    }),
    [defaultRange],
  );

  useEffect(() => {
    commitListPageSearchParams(searchParamsRef, searchDefaults);
  }, [searchDefaults]);

  const groupBy = useMemo(
    () => resolveCapacityGroupBy(dimensionMode, periodMode),
    [dimensionMode, periodMode],
  );

  const dimensionModeOptions = useMemo(
    () => [
      { label: t('app.haoligo.equipment.reports.capacity.viewDetail'), value: 'detail' as const },
      { label: t('app.haoligo.equipment.reports.capacity.viewEquipment'), value: 'equipment' as const },
      { label: t('app.haoligo.equipment.reports.capacity.viewWorkshop'), value: 'workshop' as const },
    ],
    [t],
  );

  const periodModeOptions = useMemo(
    () => [
      { label: t('app.haoligo.equipment.reports.capacity.periodNone'), value: 'none' as const },
      { label: t('app.haoligo.equipment.reports.capacity.viewMonth'), value: 'month' as const },
      { label: t('app.haoligo.equipment.reports.capacity.viewQuarter'), value: 'quarter' as const },
      { label: t('app.haoligo.equipment.reports.capacity.viewYear'), value: 'year' as const },
    ],
    [t],
  );

  useEffect(() => {
    void (async () => {
      const [equipmentRes, workshops] = await Promise.all([
        listEquipments({ limit: 500 }),
        listWorkshops(),
      ]);
      setEquipmentOptions(
        (equipmentRes.items || []).map((eq) => ({
          label: `${eq.asset_code || ''} · ${eq.name || ''}`.trim() || `#${eq.id}`,
          value: eq.id,
        })),
      );
      setWorkshopOptions(
        (workshops || []).map((w) => ({
          label: w.name || w.code || `#${w.id}`,
          value: w.id,
        })),
      );
    })();
  }, []);

  const searchColumns = useMemo<ProColumns[]>(
    () => [
      {
        title: t('app.haoligo.equipment.reports.capacity.dateRange'),
        dataIndex: 'recorded_at_range',
        valueType: 'dateRange',
        hideInTable: true,
        initialValue: defaultRange,
        fieldProps: { placeholder: [t('common.startDate', '开始'), t('common.endDate', '结束')] },
      },
      {
        title: t('app.haoligo.equipment.ledger.colWorkshop'),
        dataIndex: 'workshop_id',
        valueType: 'select',
        hideInTable: true,
        valueEnum: optionsToValueEnum(workshopOptions),
        fieldProps: { showSearch: true, allowClear: true, placeholder: t('common.pleaseSelect', '请选择') },
      },
      {
        title: t('app.haoligo.equipment.documents.colEquipment'),
        dataIndex: 'equipment_id',
        valueType: 'select',
        hideInTable: true,
        valueEnum: optionsToValueEnum(equipmentOptions),
        fieldProps: { showSearch: true, allowClear: true, placeholder: t('common.pleaseSelect', '请选择') },
      },
      {
        title: t('app.haoligo.equipment.documents.colSheetNo'),
        dataIndex: 'sheet_no',
        hideInTable: true,
        fieldProps: { placeholder: t('app.haoligo.equipment.documents.colSheetNo') },
      },
      {
        title: t('app.haoligo.equipment.documents.colWorkOrderNo'),
        dataIndex: 'work_order_no',
        hideInTable: true,
        fieldProps: { placeholder: t('app.haoligo.equipment.documents.colWorkOrderNo') },
      },
      {
        title: t('app.haoligo.equipment.documents.colFinishedProductCode'),
        dataIndex: 'finished_product_code',
        hideInTable: true,
        fieldProps: { placeholder: t('app.haoligo.equipment.documents.colFinishedProductCode') },
      },
      {
        title: t('app.haoligo.equipment.documents.colFinishedProductName'),
        dataIndex: 'finished_product_name',
        hideInTable: true,
        fieldProps: { placeholder: t('app.haoligo.equipment.documents.colFinishedProductName') },
      },
      {
        title: t('app.haoligo.equipment.documents.formOperator'),
        dataIndex: 'operator_name',
        hideInTable: true,
        fieldProps: { placeholder: t('app.haoligo.equipment.documents.formOperator') },
      },
      {
        title: t('app.haoligo.equipment.documents.formTeamLeader'),
        dataIndex: 'team_leader_name',
        hideInTable: true,
        fieldProps: { placeholder: t('app.haoligo.equipment.documents.formTeamLeader') },
      },
      {
        title: t('app.haoligo.equipment.documents.formStartupAt'),
        dataIndex: 'startup_at_range',
        valueType: 'dateRange',
        hideInTable: true,
        fieldProps: { placeholder: [t('common.startDate', '开始'), t('common.endDate', '结束')] },
      },
      {
        title: t('app.haoligo.equipment.documents.formCompletedAt'),
        dataIndex: 'completed_at_range',
        valueType: 'dateRange',
        hideInTable: true,
        fieldProps: { placeholder: [t('common.startDate', '开始'), t('common.endDate', '结束')] },
      },
      {
        title: t('common.keyword', '关键词'),
        dataIndex: 'keyword',
        hideInTable: true,
        fieldProps: {
          placeholder: `${t('app.haoligo.equipment.documents.colSheetNo')} / ${t('app.haoligo.equipment.documents.colWorkOrderNo')} / ${t('app.haoligo.equipment.documents.colFinishedProductCode')}`,
        },
      },
    ],
    [defaultRange, equipmentOptions, t, workshopOptions],
  );

  const detailColumns = useMemo<ProColumns<EquipmentOutputRecordRow>[]>(
    () => [
      ...searchColumns,
      { title: t('app.haoligo.equipment.documents.colSheetNo'), dataIndex: 'sheet_no', width: 130, ellipsis: true, hideInSearch: true },
      {
        title: t('app.haoligo.equipment.documents.colRecordedAt'),
        dataIndex: 'recorded_at',
        width: 150,
        hideInSearch: true,
        render: (_, r) => (r.recorded_at ? formatDateTime(r.recorded_at, 'YYYY-MM-DD HH:mm') : '—'),
      },
      {
        title: t('app.haoligo.equipment.documents.colEquipment'),
        hideInSearch: true,
        width: 160,
        ellipsis: true,
        render: (_, r) => equipmentLabel(r.equipment_asset_code, r.equipment_name, r.equipment_id),
      },
      {
        title: t('app.haoligo.equipment.documents.colWorkOrderNo'),
        dataIndex: 'work_order_no',
        width: 130,
        ellipsis: true,
        hideInSearch: true,
      },
      {
        title: t('app.haoligo.equipment.documents.colFinishedProductCode'),
        dataIndex: 'finished_product_code',
        width: 120,
        ellipsis: true,
        hideInSearch: true,
      },
      {
        title: t('app.haoligo.equipment.documents.colFinishedProductName'),
        dataIndex: 'finished_product_name',
        width: 140,
        ellipsis: true,
        hideInSearch: true,
      },
      {
        title: t('app.haoligo.equipment.documents.colPlannedQty'),
        dataIndex: 'planned_qty',
        width: 100,
        hideInSearch: true,
        render: (_, r) => formatEquipmentOutputQty(r.planned_qty),
      },
      {
        title: t('app.haoligo.equipment.documents.colCompletedQty'),
        dataIndex: 'completed_qty',
        width: 100,
        hideInSearch: true,
        render: (_, r) => formatEquipmentOutputQty(r.completed_qty),
      },
      {
        title: t('app.haoligo.equipment.documents.formOperator'),
        dataIndex: 'operator_name',
        width: 100,
        ellipsis: true,
        hideInSearch: true,
        render: (_, r) => (r.operator_name?.trim() ? r.operator_name : '—'),
      },
      {
        title: t('app.haoligo.equipment.documents.formStartupAt'),
        dataIndex: 'startup_at',
        width: 150,
        hideInSearch: true,
        render: (_, r) => (r.startup_at ? formatDateTime(r.startup_at, 'YYYY-MM-DD HH:mm') : '—'),
      },
      {
        title: t('app.haoligo.equipment.documents.formCompletedAt'),
        dataIndex: 'completed_at',
        width: 150,
        hideInSearch: true,
        render: (_, r) => (r.completed_at ? formatDateTime(r.completed_at, 'YYYY-MM-DD HH:mm') : '—'),
      },
      {
        title: t('app.haoligo.equipment.documents.formTeamLeader'),
        dataIndex: 'team_leader_name',
        width: 100,
        ellipsis: true,
        hideInSearch: true,
        render: (_, r) => (r.team_leader_name?.trim() ? r.team_leader_name : '—'),
      },
    ],
    [searchColumns, t],
  );

  const equipmentColumns = useMemo<ProColumns<EquipmentCapacityByEquipmentRow>[]>(
    () => [
      ...searchColumns,
      {
        title: t('app.haoligo.equipment.documents.colEquipment'),
        hideInSearch: true,
        width: 180,
        ellipsis: true,
        render: (_, r) => equipmentLabel(r.equipment_asset_code, r.equipment_name, r.equipment_id),
      },
      {
        title: t('app.haoligo.equipment.reports.capacity.colRecordCount'),
        dataIndex: 'record_count',
        width: 88,
        hideInSearch: true,
      },
      {
        title: t('app.haoligo.equipment.reports.capacity.colPlannedTotal'),
        dataIndex: 'planned_qty_total',
        width: 110,
        hideInSearch: true,
        render: (_, r) => formatEquipmentOutputQty(r.planned_qty_total),
      },
      {
        title: t('app.haoligo.equipment.reports.capacity.colCompletedTotal'),
        dataIndex: 'completed_qty_total',
        width: 110,
        hideInSearch: true,
        render: (_, r) => formatEquipmentOutputQty(r.completed_qty_total),
      },
      {
        title: t('app.haoligo.equipment.reports.capacity.colAchievement'),
        dataIndex: 'achievement_rate_pct',
        width: 100,
        hideInSearch: true,
        render: (_, r) => formatRate(r.achievement_rate_pct),
      },
    ],
    [searchColumns, t],
  );

  const workshopColumns = useMemo<ProColumns<EquipmentCapacityByWorkshopRow>[]>(
    () => [
      ...searchColumns,
      {
        title: t('app.haoligo.equipment.reports.capacity.colWorkshop'),
        dataIndex: 'workshop_name',
        hideInSearch: true,
        width: 180,
        ellipsis: true,
        render: (_, r) => (r.workshop_name?.trim() ? r.workshop_name : '—'),
      },
      {
        title: t('app.haoligo.equipment.reports.capacity.colRecordCount'),
        dataIndex: 'record_count',
        width: 88,
        hideInSearch: true,
      },
      {
        title: t('app.haoligo.equipment.reports.capacity.colPlannedTotal'),
        dataIndex: 'planned_qty_total',
        width: 110,
        hideInSearch: true,
        render: (_, r) => formatEquipmentOutputQty(r.planned_qty_total),
      },
      {
        title: t('app.haoligo.equipment.reports.capacity.colCompletedTotal'),
        dataIndex: 'completed_qty_total',
        width: 110,
        hideInSearch: true,
        render: (_, r) => formatEquipmentOutputQty(r.completed_qty_total),
      },
      {
        title: t('app.haoligo.equipment.reports.capacity.colAchievement'),
        dataIndex: 'achievement_rate_pct',
        width: 100,
        hideInSearch: true,
        render: (_, r) => formatRate(r.achievement_rate_pct),
      },
    ],
    [searchColumns, t],
  );

  const periodColumn = useMemo<ProColumns<EquipmentCapacityByPeriodRow>>(
    () => ({
      title: t('app.haoligo.equipment.reports.capacity.colPeriod'),
      dataIndex: 'period_label',
      width: 120,
      hideInSearch: true,
      render: (_, r) => (r.period_label?.trim() ? r.period_label : '—'),
    }),
    [t],
  );

  const periodColumns = useMemo<ProColumns<EquipmentCapacityByPeriodRow>[]>(
    () => [
      ...searchColumns,
      periodColumn,
      {
        title: t('app.haoligo.equipment.reports.capacity.colRecordCount'),
        dataIndex: 'record_count',
        width: 88,
        hideInSearch: true,
      },
      {
        title: t('app.haoligo.equipment.reports.capacity.colPlannedTotal'),
        dataIndex: 'planned_qty_total',
        width: 110,
        hideInSearch: true,
        render: (_, r) => formatEquipmentOutputQty(r.planned_qty_total),
      },
      {
        title: t('app.haoligo.equipment.reports.capacity.colCompletedTotal'),
        dataIndex: 'completed_qty_total',
        width: 110,
        hideInSearch: true,
        render: (_, r) => formatEquipmentOutputQty(r.completed_qty_total),
      },
      {
        title: t('app.haoligo.equipment.reports.capacity.colAchievement'),
        dataIndex: 'achievement_rate_pct',
        width: 100,
        hideInSearch: true,
        render: (_, r) => formatRate(r.achievement_rate_pct),
      },
    ],
    [periodColumn, searchColumns, t],
  );

  const tableMeta = useMemo(() => {
    const showPeriodCol = periodMode !== 'none';
    if (dimensionMode === 'equipment') {
      const columns = showPeriodCol
        ? ([
            ...searchColumns,
            periodColumn as ProColumns<CapacityExportRow>,
            ...equipmentColumns.filter((col) => !col.hideInTable && col.dataIndex !== 'period_label'),
          ] as ProColumns<CapacityExportRow>[])
        : (equipmentColumns as ProColumns<CapacityExportRow>[]);
      return {
        columns,
        rowKey: (r: CapacityExportRow) => {
          const row = r as EquipmentCapacityByEquipmentRow;
          return showPeriodCol
            ? `${row.period_label ?? ''}-${row.equipment_id}`
            : String(row.equipment_id);
        },
        persistenceSuffix: showPeriodCol ? `:equipment-${periodMode}` : ':equipment',
        pickRows: (res: EquipmentCapacityReportResult) => res.equipment_items,
      };
    }
    if (dimensionMode === 'workshop') {
      const columns = showPeriodCol
        ? ([
            ...searchColumns,
            periodColumn as ProColumns<CapacityExportRow>,
            ...workshopColumns.filter((col) => !col.hideInTable && col.dataIndex !== 'period_label'),
          ] as ProColumns<CapacityExportRow>[])
        : (workshopColumns as ProColumns<CapacityExportRow>[]);
      return {
        columns,
        rowKey: (r: CapacityExportRow) => {
          const row = r as EquipmentCapacityByWorkshopRow;
          return showPeriodCol
            ? `${row.period_label ?? ''}-${row.workshop_id ?? 'none'}`
            : String(row.workshop_id ?? 'none');
        },
        persistenceSuffix: showPeriodCol ? `:workshop-${periodMode}` : ':workshop',
        pickRows: (res: EquipmentCapacityReportResult) => res.workshop_items,
      };
    }
    if (periodMode !== 'none') {
      return {
        columns: periodColumns as ProColumns<CapacityExportRow>[],
        rowKey: (r: CapacityExportRow) => String((r as EquipmentCapacityByPeriodRow).period_label),
        persistenceSuffix: `:${periodMode}`,
        pickRows: (res: EquipmentCapacityReportResult) => res.period_items ?? [],
      };
    }
    return {
      columns: detailColumns as ProColumns<CapacityExportRow>[],
      rowKey: (r: CapacityExportRow) => String((r as EquipmentOutputRecordRow).id),
      persistenceSuffix: '',
      pickRows: (res: EquipmentCapacityReportResult) => res.items,
    };
  }, [
    detailColumns,
    dimensionMode,
    equipmentColumns,
    periodColumn,
    periodColumns,
    periodMode,
    searchColumns,
    workshopColumns,
  ]);

  const loadReport = async (
    searchFormValues: Record<string, unknown> | undefined,
    skip: number,
    limit: number,
    resolvedGroupBy: string,
  ) => {
    const filters = resolveEquipmentCapacitySearchParams(searchFormValues, defaultRange);
    return getEquipmentCapacityReport({
      skip,
      limit,
      group_by: resolvedGroupBy,
      ...filters,
    });
  };

  const pickRowsForGroupBy = useCallback((res: EquipmentCapacityReportResult, resolvedGroupBy: string) => {
    if (resolvedGroupBy === 'detail') return res.items;
    if (resolvedGroupBy === 'equipment' || resolvedGroupBy.startsWith('equipment_')) return res.equipment_items;
    if (resolvedGroupBy === 'workshop' || resolvedGroupBy.startsWith('workshop_')) return res.workshop_items;
    if (isCapacityPeriodOnlyGroupBy(resolvedGroupBy)) return res.period_items ?? [];
    return res.items;
  }, []);

  const fetchAllRows = useCallback(
    async (resolvedGroupBy: string, searchFormValues?: Record<string, unknown>) => {
      const filters = resolveEquipmentCapacitySearchParams(searchFormValues, defaultRange);
      let skip = 0;
      let total = 0;
      const all: CapacityExportRow[] = [];
      do {
        const res = await getEquipmentCapacityReport({
          skip,
          limit: EXPORT_PAGE_SIZE,
          group_by: resolvedGroupBy,
          ...filters,
        });
        total = res.total;
        all.push(...(pickRowsForGroupBy(res, resolvedGroupBy) as CapacityExportRow[]));
        skip += EXPORT_PAGE_SIZE;
      } while (skip < total);
      return all;
    },
    [defaultRange, pickRowsForGroupBy],
  );

  const rowsToCsv = useCallback(
    (
      rows: CapacityExportRow[],
      dimension: CapacityDimensionMode,
      period: CapacityPeriodMode,
      resolvedGroupBy: string,
    ): { headers: string[]; body: string[][] } => {
      const showPeriodCol = period !== 'none';
      if (dimension === 'equipment') {
        const headers = [
          ...(showPeriodCol ? [t('app.haoligo.equipment.reports.capacity.colPeriod')] : []),
          t('app.haoligo.equipment.documents.colEquipment'),
          t('app.haoligo.equipment.reports.capacity.colRecordCount'),
          t('app.haoligo.equipment.reports.capacity.colPlannedTotal'),
          t('app.haoligo.equipment.reports.capacity.colCompletedTotal'),
          t('app.haoligo.equipment.reports.capacity.colAchievement'),
        ];
        const body = (rows as EquipmentCapacityByEquipmentRow[]).map((r) => [
          ...(showPeriodCol ? [r.period_label || ''] : []),
          equipmentLabel(r.equipment_asset_code, r.equipment_name, r.equipment_id),
          String(r.record_count ?? ''),
          formatEquipmentOutputQty(r.planned_qty_total),
          formatEquipmentOutputQty(r.completed_qty_total),
          formatRate(r.achievement_rate_pct),
        ]);
        return { headers, body };
      }
      if (dimension === 'workshop') {
        const headers = [
          ...(showPeriodCol ? [t('app.haoligo.equipment.reports.capacity.colPeriod')] : []),
          t('app.haoligo.equipment.reports.capacity.colWorkshop'),
          t('app.haoligo.equipment.reports.capacity.colRecordCount'),
          t('app.haoligo.equipment.reports.capacity.colPlannedTotal'),
          t('app.haoligo.equipment.reports.capacity.colCompletedTotal'),
          t('app.haoligo.equipment.reports.capacity.colAchievement'),
        ];
        const body = (rows as EquipmentCapacityByWorkshopRow[]).map((r) => [
          ...(showPeriodCol ? [r.period_label || ''] : []),
          r.workshop_name?.trim() ? r.workshop_name : '—',
          String(r.record_count ?? ''),
          formatEquipmentOutputQty(r.planned_qty_total),
          formatEquipmentOutputQty(r.completed_qty_total),
          formatRate(r.achievement_rate_pct),
        ]);
        return { headers, body };
      }
      if (isCapacityPeriodOnlyGroupBy(resolvedGroupBy)) {
        const headers = [
          t('app.haoligo.equipment.reports.capacity.colPeriod'),
          t('app.haoligo.equipment.reports.capacity.colRecordCount'),
          t('app.haoligo.equipment.reports.capacity.colPlannedTotal'),
          t('app.haoligo.equipment.reports.capacity.colCompletedTotal'),
          t('app.haoligo.equipment.reports.capacity.colAchievement'),
        ];
        const body = (rows as EquipmentCapacityByPeriodRow[]).map((r) => [
          r.period_label || '',
          String(r.record_count ?? ''),
          formatEquipmentOutputQty(r.planned_qty_total),
          formatEquipmentOutputQty(r.completed_qty_total),
          formatRate(r.achievement_rate_pct),
        ]);
        return { headers, body };
      }
      const headers = [
        t('app.haoligo.equipment.documents.colSheetNo'),
        t('app.haoligo.equipment.documents.colRecordedAt'),
        t('app.haoligo.equipment.documents.colEquipment'),
        t('app.haoligo.equipment.documents.colWorkOrderNo'),
        t('app.haoligo.equipment.documents.colFinishedProductCode'),
        t('app.haoligo.equipment.documents.colFinishedProductName'),
        t('app.haoligo.equipment.documents.colPlannedQty'),
        t('app.haoligo.equipment.documents.colCompletedQty'),
        t('app.haoligo.equipment.documents.formOperator'),
        t('app.haoligo.equipment.documents.formStartupAt'),
        t('app.haoligo.equipment.documents.formCompletedAt'),
        t('app.haoligo.equipment.documents.formTeamLeader'),
      ];
      const body = (rows as EquipmentOutputRecordRow[]).map((r) => [
        r.sheet_no || '',
        r.recorded_at ? formatDateTime(r.recorded_at, 'YYYY-MM-DD HH:mm') : '',
        equipmentLabel(r.equipment_asset_code, r.equipment_name, r.equipment_id),
        r.work_order_no || '',
        r.finished_product_code || '',
        r.finished_product_name || '',
        formatEquipmentOutputQty(r.planned_qty),
        formatEquipmentOutputQty(r.completed_qty),
        r.operator_name?.trim() ? r.operator_name : '',
        r.startup_at ? formatDateTime(r.startup_at, 'YYYY-MM-DD HH:mm') : '',
        r.completed_at ? formatDateTime(r.completed_at, 'YYYY-MM-DD HH:mm') : '',
        r.team_leader_name?.trim() ? r.team_leader_name : '',
      ]);
      return { headers, body };
    },
    [t],
  );

  const handleExport = useCallback(
    async (
      type: 'selected' | 'currentPage' | 'all',
      selectedRowKeys?: React.Key[],
      currentPageData?: CapacityExportRow[],
    ) => {
      try {
        let rows: CapacityExportRow[] = [];
        if (type === 'all') {
          const hide = messageApi.loading(t('components.uniReport.exporting', '正在导出…'), 0);
          try {
            rows = await fetchAllRows(groupBy, searchParamsRef.current);
          } finally {
            hide();
          }
        } else if (type === 'selected' && selectedRowKeys?.length) {
          const keySet = new Set(selectedRowKeys.map(String));
          rows = (currentPageData || []).filter((r) => keySet.has(tableMeta.rowKey(r)));
        } else {
          rows = currentPageData || [];
        }
        if (!rows.length) {
          messageApi.warning(t('components.uniReport.exportEmpty', '没有可导出的数据'));
          return;
        }
        const { headers, body } = rowsToCsv(rows, dimensionMode, periodMode, groupBy);
        const dateStr = new Date().toISOString().slice(0, 10);
        downloadFile(buildCsv(headers, body), `${title}-${dateStr}.csv`, 'text/csv;charset=utf-8');
        messageApi.success(t('common.exportCountSuccess', { count: rows.length }));
      } catch (e) {
        messageApi.error((e as Error).message || t('common.exportFailed', '导出失败'));
      }
    },
    [dimensionMode, fetchAllRows, groupBy, messageApi, periodMode, rowsToCsv, t, tableMeta, title],
  );

  const summaryCards = (
    <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
      <Col xs={12} sm={6}>
        <Card size="small" bordered={false} style={{ background: '#fafafa' }}>
          <Statistic title={t('app.haoligo.equipment.reports.capacity.kpiRecords')} value={summary?.record_count ?? 0} />
        </Card>
      </Col>
      <Col xs={12} sm={6}>
        <Card size="small" bordered={false} style={{ background: '#fafafa' }}>
          <Statistic
            title={t('app.haoligo.equipment.reports.capacity.kpiPlanned')}
            value={formatEquipmentOutputQty(summary?.planned_qty_total)}
          />
        </Card>
      </Col>
      <Col xs={12} sm={6}>
        <Card size="small" bordered={false} style={{ background: '#fafafa' }}>
          <Statistic
            title={t('app.haoligo.equipment.reports.capacity.kpiCompleted')}
            value={formatEquipmentOutputQty(summary?.completed_qty_total)}
          />
        </Card>
      </Col>
      <Col xs={12} sm={6}>
        <Card size="small" bordered={false} style={{ background: '#fafafa' }}>
          <Statistic
            title={t('app.haoligo.equipment.reports.capacity.kpiAchievement')}
            value={formatRate(summary?.achievement_rate_pct)}
          />
        </Card>
      </Col>
    </Row>
  );

  return (
    <ListPageTemplate
      fillMain
      tableScrollLayout="report"
      tableScrollOffsetExtraPx={LIST_PAGE_TABLE_SCROLL.STAT_CARDS_ROW_EXTRA_PX}
    >
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Flex justify="space-between" align="center" wrap="wrap" gap={8} style={{ marginBottom: 8, flexShrink: 0 }}>
          <div>
            <Typography.Title level={4} style={{ margin: 0 }}>
              {title}
            </Typography.Title>
            <Typography.Text type="secondary" style={{ fontSize: 13 }}>
              {t('app.haoligo.equipment.reports.capacity.lead')}
            </Typography.Text>
          </div>
          <Flex gap={8} wrap="wrap" justify="flex-end">
            <ThemedSegmented
              value={dimensionMode}
              onChange={(v) => {
                setDimensionMode(v as CapacityDimensionMode);
                actionRef.current?.reload();
              }}
              options={dimensionModeOptions}
            />
            <ThemedSegmented
              value={periodMode}
              onChange={(v) => {
                setPeriodMode(v as CapacityPeriodMode);
                actionRef.current?.reload();
              }}
              options={periodModeOptions}
            />
          </Flex>
        </Flex>
        <div style={{ flexShrink: 0 }}>{summaryCards}</div>
        <UniTable<CapacityExportRow>
          key={`capacity-${groupBy}`}
          columnPersistenceId={`apps.haoligo.pages.equipment.reports.capacity${tableMeta.persistenceSuffix}`}
          headerTitle={title}
          actionRef={actionRef}
          rowKey={tableMeta.rowKey}
          columns={tableMeta.columns}
          showAdvancedSearch
          fillViewportBody
          searchParamsRef={searchParamsRef}
          form={{ initialValues: searchDefaults }}
          search={{ labelWidth: 'auto', defaultCollapsed: false }}
          onExport={handleExport}
          request={async (params, _sort, _filter, searchFormValues) => {
            const current = params.current ?? 1;
            const pageSize = params.pageSize ?? 20;
            const skip = (current - 1) * pageSize;
            const searchValues = searchFormValues as Record<string, unknown> | undefined;
            try {
              const res = await loadReport(searchValues, skip, pageSize, groupBy);
              setSummary(res.summary);
              return { data: tableMeta.pickRows(res), total: res.total, success: true };
            } catch (e) {
              messageApi.error((e as Error).message || t('app.haoligo.equipment.reports.capacity.loadFailed'));
              return { data: [], success: false, total: 0 };
            }
          }}
        />
      </div>
    </ListPageTemplate>
  );
};

export default EquipmentCapacityReportPage;
