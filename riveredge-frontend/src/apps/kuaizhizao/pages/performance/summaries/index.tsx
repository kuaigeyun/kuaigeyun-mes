/**
 * 绩效汇总页面
 */

import React, { useRef, useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import type { ProDescriptionsItemProps } from '@ant-design/pro-components';
import { App, Button, DatePicker, Descriptions, Select, Space, Typography, Table, Spin, Empty, theme as AntdTheme } from 'antd';
import { CalculatorOutlined, CheckOutlined, RollbackOutlined, DownloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { UniTable } from '../../../../../components/uni-table';
import { rowActionKind } from '../../../../../components/uni-action';
import { UniLifecycleStepper } from '../../../../../components/uni-lifecycle';
import {
  detailDrawerDescriptionItems,
  DetailDrawerTemplate,
  DRAWER_CONFIG,
  ListPageTemplate,
} from '../../../../../components/layout-templates';
import { DocumentTrackingTimelineBody, useDocumentTracking } from '../../../../../components/document-tracking-panel';
import { PerformanceTraceBriefPrimaryActions } from '../PerformanceTraceBriefFooter';
import { getPerformanceSummaryStatusValueEnum } from '../components/performanceMeta';
import { employeePerformanceApi } from '../../../services/performance';
import type { PerformanceSummary, PerformanceDetail, PerformanceDetailItem } from '../../../types/performance';
import { getPerformanceSummaryLifecycle } from '../../../utils/performanceLifecycle';
import { formatDateTime } from '../../../../../utils/format';
import { alignProColumns, SALES_DOC_LIST_FIELD_RANK } from '../../sales-management/shared/documentFieldAlignment';
import {
  normalizePerformanceListResponse,
  PERFORMANCE_SUMMARY_PINNED_STATUS_FIELD,
  resolvePerformanceSummaryListParams,
} from '../../../utils/performanceListCore';
import { buildDocumentAuditColumns } from '../../shared/documentAuditColumns';

const SummariesPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { token } = AntdTheme.useToken();
  const summaryDrawerZIndex = token.zIndexPopupBase;
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [period, setPeriod] = useState<string>(formatDateTime(dayjs(), 'YYYY-MM'));
  const [employeeId, setEmployeeId] = useState<number | undefined>();
  const [employees, setEmployees] = useState<{ id: number; full_name: string }[]>([]);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [detail, setDetail] = useState<PerformanceDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [calcLoading, setCalcLoading] = useState(false);
  const [summaryTrackingId, setSummaryTrackingId] = useState<number | null>(null);
  const [summaryTrackingRefreshKey, setSummaryTrackingRefreshKey] = useState(0);

  const summaryTracking = useDocumentTracking(
    drawerVisible && summaryTrackingId != null ? 'performance_summary' : undefined,
    summaryTrackingId ?? undefined,
    summaryTrackingRefreshKey,
  );

  const closeDrawer = () => {
    setDrawerVisible(false);
    setDetail(null);
    setSummaryTrackingId(null);
  };

  useEffect(() => {
    employeePerformanceApi.listEmployees({ limit: 500 }).then((r) => {
      setEmployees(r.items.map((e) => ({ id: e.id, full_name: e.full_name || e.username })));
    }).catch(() => {});
  }, []);

  const handleCalculate = async () => {
    try {
      setCalcLoading(true);
      await employeePerformanceApi.calculate(period);
      messageApi.success(t('app.kuaizhizao.performance.summaries.messages.calculateSuccess'));
      actionRef.current?.reload();
      setSummaryTrackingRefreshKey((k) => k + 1);
    } catch (e: any) {
      messageApi.error(e?.message || t('app.kuaizhizao.performance.summaries.messages.calculateFailed'));
    } finally {
      setCalcLoading(false);
    }
  };

  const handleConfirm = async (record: PerformanceSummary) => {
    try {
      await employeePerformanceApi.confirmSummary(record.id);
      messageApi.success(t('app.kuaizhizao.performance.summaries.messages.confirmSuccess'));
      actionRef.current?.reload();
    } catch (e: any) {
      messageApi.error(e?.message || t('app.kuaizhizao.performance.summaries.messages.confirmFailed'));
    }
  };

  const handleReopen = async (record: PerformanceSummary) => {
    try {
      await employeePerformanceApi.reopenSummary(record.id);
      messageApi.success(t('app.kuaizhizao.performance.summaries.messages.reopenSuccess'));
      actionRef.current?.reload();
    } catch (e: any) {
      messageApi.error(e?.message || t('app.kuaizhizao.performance.summaries.messages.reopenFailed'));
    }
  };

  const handleBatchConfirm = async () => {
    try {
      setCalcLoading(true);
      const res = await employeePerformanceApi.batchConfirm(period);
      messageApi.success(
        t('app.kuaizhizao.performance.summaries.messages.batchConfirmSuccess', {
          confirmed: res.confirmed_count,
          skipped: res.skipped_count,
        }),
      );
      actionRef.current?.reload();
    } catch (e: any) {
      messageApi.error(e?.message || t('app.kuaizhizao.performance.summaries.messages.batchConfirmFailed'));
    } finally {
      setCalcLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      const { csv } = await employeePerformanceApi.exportSummaries(period, 'confirmed');
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `performance-${period}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      messageApi.error(e?.message || t('app.kuaizhizao.performance.summaries.messages.exportFailed'));
    }
  };

  const handleViewDetail = async (record: PerformanceSummary) => {
    try {
      setSummaryTrackingId(record.id);
      setDrawerVisible(true);
      setDetail(null);
      setDetailLoading(true);
      const d = await employeePerformanceApi.getDetail({ period: record.period, employee_id: record.employee_id });
      setDetail(d);
      if (d?.summary?.id != null) {
        setSummaryTrackingId(d.summary.id);
      }
      setSummaryTrackingRefreshKey((k) => k + 1);
    } catch (e: any) {
      messageApi.error(e?.message || t('app.kuaizhizao.performance.common.messages.loadFailed'));
      setDrawerVisible(false);
      setDetail(null);
      setSummaryTrackingId(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const detailColumns: ProDescriptionsItemProps<PerformanceDetail>[] = useMemo(
    () => [
      { title: t('app.kuaizhizao.performance.common.columns.employee'), dataIndex: 'employee_name' },
      { title: t('app.kuaizhizao.performance.common.columns.period'), dataIndex: 'period' },
      {
        title: t('app.kuaizhizao.performance.common.columns.totalHours'),
        dataIndex: ['summary', 'total_hours'],
        render: (_, r) => r?.summary?.total_hours ?? '-',
      },
      {
        title: t('app.kuaizhizao.performance.common.columns.totalPieces'),
        dataIndex: ['summary', 'total_pieces'],
        render: (_, r) => r?.summary?.total_pieces ?? '-',
      },
      {
        title: t('app.kuaizhizao.performance.common.columns.totalAmount'),
        dataIndex: ['summary', 'total_amount'],
        render: (_, r) => r?.summary?.total_amount ?? '-',
      },
      {
        title: t('app.kuaizhizao.performance.common.columns.kpiScore'),
        dataIndex: ['summary', 'kpi_score'],
        render: (_, r) => r?.summary?.kpi_score ?? '-',
      },
      {
        title: t('app.kuaizhizao.performance.common.columns.kpiCoefficient'),
        dataIndex: ['summary', 'kpi_coefficient'],
        render: (_, r) => r?.summary?.kpi_coefficient ?? '-',
      },
    ],
    [t],
  );

  const columns: ProColumns<PerformanceSummary>[] = useMemo(
    () => alignProColumns<PerformanceSummary>([
      {
        title: t('app.kuaizhizao.performance.common.columns.employee'),
        dataIndex: 'employee_name',
        width: 120,
        fixed: 'left',
        sorter: true,
        render: (_, r) => (
          <Typography.Text copyable={{ text: String(r.employee_name ?? '') }} ellipsis>
            {r.employee_name ?? '-'}
          </Typography.Text>
        ),
      },
      { title: t('app.kuaizhizao.performance.common.columns.period'), dataIndex: 'period', width: 100, sorter: true },
      { title: t('app.kuaizhizao.performance.common.columns.totalHours'), dataIndex: 'total_hours', width: 100, align: 'right', sorter: true },
      { title: t('app.kuaizhizao.performance.common.columns.totalPieces'), dataIndex: 'total_pieces', width: 100, align: 'right', sorter: true },
      { title: t('app.kuaizhizao.performance.common.columns.timeAmount'), dataIndex: 'time_amount', width: 110, align: 'right', sorter: true },
      { title: t('app.kuaizhizao.performance.common.columns.pieceAmount'), dataIndex: 'piece_amount', width: 110, align: 'right', sorter: true },
      { title: t('app.kuaizhizao.performance.common.columns.totalAmount'), dataIndex: 'total_amount', width: 110, align: 'right', sorter: true },
      { title: t('app.kuaizhizao.performance.common.columns.kpiScore'), dataIndex: 'kpi_score', width: 100, align: 'right', sorter: true },
      { title: t('app.kuaizhizao.performance.common.columns.kpiCoefficient'), dataIndex: 'kpi_coefficient', width: 90, align: 'right', sorter: true },
      {
        title: t('app.kuaizhizao.performance.common.columns.status'),
        dataIndex: 'status',
        hideInTable: true,
        valueEnum: getPerformanceSummaryStatusValueEnum(t),
      },
      ...buildDocumentAuditColumns<PerformanceSummary>(t),
      {
        title: t('app.kuaizhizao.performance.common.columns.actions'),
        width: 220,
        fixed: 'right',
        render: (_, record) => (
          <Space size={0}>
            <Button key="view" {...rowActionKind('read')} onClick={() => handleViewDetail(record)}>
              {t('app.kuaizhizao.performance.summaries.actions.detail')}
            </Button>
            {record.status === 'calculated' ? (
              <Button type="link" size="small" icon={<CheckOutlined />} onClick={() => handleConfirm(record)}>
                {t('app.kuaizhizao.performance.common.actions.confirm')}
              </Button>
            ) : null}
            {record.status === 'confirmed' ? (
              <Button type="link" size="small" icon={<RollbackOutlined />} onClick={() => handleReopen(record)}>
                {t('app.kuaizhizao.performance.common.actions.reopen')}
              </Button>
            ) : null}
          </Space>
        ),
      },
    ], SALES_DOC_LIST_FIELD_RANK),
    [t],
  );

  return (
    <>
      <ListPageTemplate>
        <UniTable<PerformanceSummary>
          headerTitle={t('app.kuaizhizao.performance.summaries.pageTitle')}
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          columnPersistenceId="apps.kuaizhizao.pages.performance.summaries"
          showAdvancedSearch
          skipFuzzyPinyinClientFilter
          pinnedTabsField={PERFORMANCE_SUMMARY_PINNED_STATUS_FIELD}
          request={async (params, sort, _filter, searchFormValues) => {
            try {
              const pageSize = params.pageSize || 20;
              const skip = ((params.current || 1) - 1) * pageSize;
              const listParams = resolvePerformanceSummaryListParams(searchFormValues, sort, {
                period: period || undefined,
                employee_id: employeeId,
              });
              const response = await employeePerformanceApi.listSummaries({
                skip,
                limit: pageSize,
                ...listParams,
              });
              const { data, total } = normalizePerformanceListResponse(response);
              return { data: data as PerformanceSummary[], success: true, total };
            } catch (e: any) {
              messageApi.error(e?.message || t('app.kuaizhizao.performance.common.messages.loadFailed'));
              return { data: [], success: false, total: 0 };
            }
          }}
          toolBarRender={() => [
            <Space key="filters">
              <DatePicker
                picker="month"
                value={period ? dayjs(period) : null}
                onChange={(d) => {
                  setPeriod(d ? d.format('YYYY-MM') : '');
                  actionRef.current?.reload();
                }}
                placeholder={t('app.kuaizhizao.performance.summaries.placeholder.period')}
              />
              <Select
                placeholder={t('app.kuaizhizao.performance.summaries.placeholder.employee')}
                allowClear
                style={{ width: 160 }}
                options={employees.map((e) => ({ label: e.full_name, value: e.id }))}
                value={employeeId}
                onChange={(v) => {
                  setEmployeeId(v);
                  actionRef.current?.reload();
                }}
              />
              <Button type="primary" icon={<CalculatorOutlined />} loading={calcLoading} onClick={handleCalculate}>
                {t('app.kuaizhizao.performance.summaries.actions.calculate')}
              </Button>
              <Button icon={<CheckOutlined />} loading={calcLoading} onClick={handleBatchConfirm}>
                {t('app.kuaizhizao.performance.summaries.actions.batchConfirm')}
              </Button>
              <Button icon={<DownloadOutlined />} onClick={handleExport}>
                {t('app.kuaizhizao.performance.summaries.actions.exportConfirmed')}
              </Button>
            </Space>,
          ]}
        />
      </ListPageTemplate>

      <DetailDrawerTemplate
        title={t('app.kuaizhizao.performance.summaries.modal.detailTitle', {
          name: detail?.employee_name || '',
          period: detail?.period || '',
        })}
        open={drawerVisible}
        zIndex={summaryDrawerZIndex}
        onClose={closeDrawer}
        loading={detailLoading}
        width={DRAWER_CONFIG.HALF_WIDTH}
        basicTitle={t('app.kuaizhizao.performance.common.sections.basicInfo')}
        basic={
          detail ? (
            <Descriptions column={2} size="small" items={detailDrawerDescriptionItems(detailColumns, detail)} />
          ) : undefined
        }
        collaborationTitle={t('app.kuaizhizao.performance.common.sections.lifecycle')}
        collaborationLifecycle={
          detail ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {(() => {
                const row = (detail.summary ?? detail) as unknown as Record<string, unknown>;
                const lc = getPerformanceSummaryLifecycle(row, t);
                const mainStages = lc.mainStages ?? [];
                if (mainStages.length === 0) return null;
                return (
                  <UniLifecycleStepper
                    steps={mainStages}
                    showLabels
                    status={lc.status}
                    nextStepSuggestions={lc.nextStepSuggestions}
                    hideNextStepSuggestions
                  />
                );
              })()}
            </div>
          ) : undefined
        }
        traceDocument={
          summaryTrackingId != null
            ? {
                documentType: 'performance_summary',
                documentId: summaryTrackingId,
                selfDocumentId: summaryTrackingId,
                renderBriefActions: (doc) => (
                  <PerformanceTraceBriefPrimaryActions
                    doc={doc}
                    t={t}
                    navigate={navigate}
                    closeDrawer={closeDrawer}
                  />
                ),
              }
            : undefined
        }
        supplementary={
          detail?.kpi_scores && detail.kpi_scores.length > 0 ? (
            <Table
              size="small"
              rowKey="kpi_code"
              pagination={false}
              dataSource={detail.kpi_scores}
              columns={[
                { title: t('app.kuaizhizao.performance.summaries.columns.kpiCode'), dataIndex: 'kpi_code', width: 120 },
                { title: t('app.kuaizhizao.performance.summaries.columns.score'), dataIndex: 'score', width: 80, align: 'right' },
              ]}
            />
          ) : undefined
        }
        supplementaryTitle={t('app.kuaizhizao.performance.summaries.sections.kpiScores')}
        supplementaryVisible={Boolean(detail?.kpi_scores && detail.kpi_scores.length > 0)}
        linesTitle={t('app.kuaizhizao.performance.summaries.sections.reportingItems')}
        linesVisible
        lines={
          detail?.items && detail.items.length > 0 ? (
            <Table<PerformanceDetailItem>
              size="small"
              rowKey={(r) => String(r.reporting_record_id)}
              pagination={false}
              dataSource={detail.items}
              columns={[
                { title: t('app.kuaizhizao.performance.summaries.columns.reportingRecord'), dataIndex: 'reporting_record_id', width: 88 },
                { title: t('app.kuaizhizao.performance.summaries.columns.workOrder'), dataIndex: 'work_order_code', width: 120, ellipsis: true },
                { title: t('app.kuaizhizao.performance.summaries.columns.operation'), dataIndex: 'operation_name', width: 120, ellipsis: true },
                { title: t('app.kuaizhizao.performance.summaries.columns.reportedAt'), dataIndex: 'reported_at', width: 160 },
                { title: t('app.kuaizhizao.performance.common.columns.qualifiedQty'), dataIndex: 'qualified_quantity', width: 80, align: 'right' },
                { title: t('app.kuaizhizao.performance.summaries.columns.workHours'), dataIndex: 'work_hours', width: 80, align: 'right' },
              ]}
            />
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('app.kuaizhizao.performance.common.empty.noReportingItems')} />
          )
        }
        timelineTitle={t('app.kuaizhizao.performance.common.sections.operationLog')}
        timelineVisible
        timeline={
          summaryTracking.loading ? (
            <div style={{ textAlign: 'center', padding: 24 }}>
              <Spin />
            </div>
          ) : summaryTracking.error ? (
            <Typography.Text type="danger">{summaryTracking.error}</Typography.Text>
          ) : summaryTracking.data ? (
            <DocumentTrackingTimelineBody data={summaryTracking.data} />
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('app.kuaizhizao.performance.common.empty.noActivityLog')} />
          )
        }
      />
    </>
  );
};

export default SummariesPage;
