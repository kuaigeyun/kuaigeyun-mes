/**
 * 好力 GO — 产能查询（口径：设备产出单）
 */

import React, { useMemo, useRef, useState } from 'react';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Card, Col, Flex, Row, Segmented, Statistic, Typography } from 'antd';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { UniTable } from '../../../../../../components/uni-table';
import { ListPageTemplate } from '../../../../../../components/layout-templates';
import {
  getEquipmentCapacityReport,
  listEquipments,
  type EquipmentCapacityByEquipmentRow,
  type EquipmentCapacitySummary,
  type EquipmentOutputRecordRow,
} from '../../../../services/haoligo';
import {
  defaultEquipmentReportRecordedRange,
  parseEquipmentReportRecordedRange,
} from '../../../../utils/equipmentReportDateRange';

type ViewMode = 'detail' | 'equipment';

function formatQty(v: string | number | null | undefined): string {
  if (v == null || v === '') return '—';
  const n = Number(v);
  return Number.isFinite(n) ? String(n) : String(v);
}

function formatRate(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return '—';
  return `${v}%`;
}

const EquipmentCapacityReportPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('detail');
  const [summary, setSummary] = useState<EquipmentCapacitySummary | null>(null);

  const title = t('app.haoligo.menu.equipment.reports.capacity');
  const defaultRange = useMemo(() => defaultEquipmentReportRecordedRange(), []);

  const searchDefaults = useMemo(
    () => ({
      recorded_at_range: defaultRange,
    }),
    [defaultRange],
  );

  const detailColumns = useMemo<ProColumns<EquipmentOutputRecordRow>[]>(
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
        title: t('app.haoligo.equipment.documents.colEquipment'),
        dataIndex: 'equipment_id',
        valueType: 'select',
        hideInTable: true,
        request: async () => {
          const res = await listEquipments({ limit: 500 });
          return (res.items || []).map((eq) => ({
            label: `${eq.asset_code} · ${eq.name}`,
            value: eq.id,
          }));
        },
        fieldProps: { showSearch: true, allowClear: true },
      },
      {
        title: t('app.haoligo.equipment.documents.colWorkOrderNo'),
        dataIndex: 'work_order_no',
        hideInTable: true,
      },
      {
        title: t('common.keyword', '关键词'),
        dataIndex: 'keyword',
        hideInTable: true,
        fieldProps: {
          placeholder: t('app.haoligo.equipment.documents.colSheetNo'),
        },
      },
      { title: t('app.haoligo.equipment.documents.colSheetNo'), dataIndex: 'sheet_no', width: 130, ellipsis: true, hideInSearch: true },
      {
        title: t('app.haoligo.equipment.documents.colRecordedAt'),
        dataIndex: 'recorded_at',
        width: 150,
        hideInSearch: true,
        render: (_, r) => (r.recorded_at ? dayjs(r.recorded_at).format('YYYY-MM-DD HH:mm') : '—'),
      },
      {
        title: t('app.haoligo.equipment.documents.colEquipment'),
        hideInSearch: true,
        width: 160,
        ellipsis: true,
        render: (_, r) =>
          r.equipment_asset_code || r.equipment_name
            ? `${r.equipment_asset_code || ''} ${r.equipment_name || ''}`.trim()
            : `ID ${r.equipment_id}`,
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
        render: (_, r) => formatQty(r.planned_qty),
      },
      {
        title: t('app.haoligo.equipment.documents.colCompletedQty'),
        dataIndex: 'completed_qty',
        width: 100,
        hideInSearch: true,
        render: (_, r) => formatQty(r.completed_qty),
      },
      {
        title: t('app.haoligo.equipment.documents.formOperator'),
        dataIndex: 'operator_name',
        width: 100,
        ellipsis: true,
        hideInSearch: true,
      },
    ],
    [defaultRange, t],
  );

  const equipmentColumns = useMemo<ProColumns<EquipmentCapacityByEquipmentRow>[]>(
    () => [
      {
        title: t('app.haoligo.equipment.reports.capacity.dateRange'),
        dataIndex: 'recorded_at_range',
        valueType: 'dateRange',
        hideInTable: true,
        initialValue: defaultRange,
      },
      {
        title: t('app.haoligo.equipment.documents.colEquipment'),
        dataIndex: 'equipment_id',
        valueType: 'select',
        hideInTable: true,
        request: async () => {
          const res = await listEquipments({ limit: 500 });
          return (res.items || []).map((eq) => ({
            label: `${eq.asset_code} · ${eq.name}`,
            value: eq.id,
          }));
        },
        fieldProps: { showSearch: true, allowClear: true },
      },
      {
        title: t('app.haoligo.equipment.documents.colWorkOrderNo'),
        dataIndex: 'work_order_no',
        hideInTable: true,
      },
      {
        title: t('common.keyword', '关键词'),
        dataIndex: 'keyword',
        hideInTable: true,
      },
      {
        title: t('app.haoligo.equipment.documents.colEquipment'),
        hideInSearch: true,
        width: 180,
        ellipsis: true,
        render: (_, r) =>
          r.equipment_asset_code || r.equipment_name
            ? `${r.equipment_asset_code || ''} ${r.equipment_name || ''}`.trim()
            : `ID ${r.equipment_id}`,
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
        render: (_, r) => formatQty(r.planned_qty_total),
      },
      {
        title: t('app.haoligo.equipment.reports.capacity.colCompletedTotal'),
        dataIndex: 'completed_qty_total',
        width: 110,
        hideInSearch: true,
        render: (_, r) => formatQty(r.completed_qty_total),
      },
      {
        title: t('app.haoligo.equipment.reports.capacity.colAchievement'),
        dataIndex: 'achievement_rate_pct',
        width: 100,
        hideInSearch: true,
        render: (_, r) => formatRate(r.achievement_rate_pct),
      },
    ],
    [defaultRange, t],
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
            value={formatQty(summary?.planned_qty_total)}
          />
        </Card>
      </Col>
      <Col xs={12} sm={6}>
        <Card size="small" bordered={false} style={{ background: '#fafafa' }}>
          <Statistic
            title={t('app.haoligo.equipment.reports.capacity.kpiCompleted')}
            value={formatQty(summary?.completed_qty_total)}
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
    <ListPageTemplate>
      <Flex vertical gap={0} style={{ width: '100%' }}>
        <Flex justify="space-between" align="center" wrap="wrap" gap={8} style={{ marginBottom: 8 }}>
          <div>
            <Typography.Title level={4} style={{ margin: 0 }}>
              {title}
            </Typography.Title>
            <Typography.Text type="secondary" style={{ fontSize: 13 }}>
              {t('app.haoligo.equipment.reports.capacity.lead')}
            </Typography.Text>
          </div>
          <Segmented<ViewMode>
            value={viewMode}
            onChange={(v) => {
              setViewMode(v as ViewMode);
              actionRef.current?.reload();
            }}
            options={[
              { label: t('app.haoligo.equipment.reports.capacity.viewDetail'), value: 'detail' },
              { label: t('app.haoligo.equipment.reports.capacity.viewEquipment'), value: 'equipment' },
            ]}
          />
        </Flex>
        {summaryCards}
        {viewMode === 'detail' ? (
          <UniTable<EquipmentOutputRecordRow>
            key="capacity-detail"
            columnPersistenceId="apps.haoligo.pages.equipment.reports.capacity"
            headerTitle={title}
            actionRef={actionRef}
            rowKey="id"
            columns={detailColumns}
            showAdvancedSearch
            form={{ initialValues: searchDefaults }}
            search={{ labelWidth: 'auto', defaultCollapsed: false }}
            request={async (params, _sort, _filter, searchFormValues) => {
              const current = params.current ?? 1;
              const pageSize = params.pageSize ?? 20;
              const skip = (current - 1) * pageSize;
              const range = parseEquipmentReportRecordedRange(searchFormValues as Record<string, unknown>);
              const equipmentIdRaw = searchFormValues?.equipment_id;
              try {
                const res = await getEquipmentCapacityReport({
                  skip,
                  limit: pageSize,
                  group_by: 'detail',
                  equipment_id:
                    equipmentIdRaw != null && equipmentIdRaw !== '' ? Number(equipmentIdRaw) : undefined,
                  work_order_no:
                    typeof searchFormValues?.work_order_no === 'string'
                      ? searchFormValues.work_order_no.trim() || undefined
                      : undefined,
                  keyword:
                    typeof searchFormValues?.keyword === 'string'
                      ? searchFormValues.keyword.trim() || undefined
                      : undefined,
                  ...range,
                });
                setSummary(res.summary);
                return { data: res.items, total: res.total, success: true };
              } catch (e) {
                messageApi.error((e as Error).message || t('app.haoligo.equipment.reports.capacity.loadFailed'));
                return { data: [], success: false, total: 0 };
              }
            }}
          />
        ) : (
          <UniTable<EquipmentCapacityByEquipmentRow>
            key="capacity-equipment"
            columnPersistenceId="apps.haoligo.pages.equipment.reports.capacity:2"
            headerTitle={title}
            actionRef={actionRef}
            rowKey="equipment_id"
            columns={equipmentColumns}
            showAdvancedSearch
            form={{ initialValues: searchDefaults }}
            search={{ labelWidth: 'auto', defaultCollapsed: false }}
            request={async (params, _sort, _filter, searchFormValues) => {
              const current = params.current ?? 1;
              const pageSize = params.pageSize ?? 20;
              const skip = (current - 1) * pageSize;
              const range = parseEquipmentReportRecordedRange(searchFormValues as Record<string, unknown>);
              const equipmentIdRaw = searchFormValues?.equipment_id;
              try {
                const res = await getEquipmentCapacityReport({
                  skip,
                  limit: pageSize,
                  group_by: 'equipment',
                  equipment_id:
                    equipmentIdRaw != null && equipmentIdRaw !== '' ? Number(equipmentIdRaw) : undefined,
                  work_order_no:
                    typeof searchFormValues?.work_order_no === 'string'
                      ? searchFormValues.work_order_no.trim() || undefined
                      : undefined,
                  keyword:
                    typeof searchFormValues?.keyword === 'string'
                      ? searchFormValues.keyword.trim() || undefined
                      : undefined,
                  ...range,
                });
                setSummary(res.summary);
                return { data: res.equipment_items, total: res.total, success: true };
              } catch (e) {
                messageApi.error((e as Error).message || t('app.haoligo.equipment.reports.capacity.loadFailed'));
                return { data: [], success: false, total: 0 };
              }
            }}
          />
        )}
      </Flex>
    </ListPageTemplate>
  );
};

export default EquipmentCapacityReportPage;
