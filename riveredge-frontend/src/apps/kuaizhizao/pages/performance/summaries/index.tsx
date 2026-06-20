/**
 * 绩效汇总页面
 */

import React, { useRef, useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import type { ProDescriptionsItemProps } from '@ant-design/pro-components';
import { App, Button, DatePicker, Descriptions, Select, Space, Typography, Table, Spin, Empty, theme as AntdTheme } from 'antd';
import { CalculatorOutlined, EyeOutlined, CheckOutlined, RollbackOutlined, DownloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { UniTable } from '../../../../../components/uni-table';
import { UniLifecycle, UniLifecycleStepper } from '../../../../../components/uni-lifecycle';
import {
  detailDrawerDescriptionItems,
  DetailDrawerTemplate,
  DetailDrawerSection, DetailDrawerInlineFullChain,
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
      setDetailLoading(true);
      const d = await employeePerformanceApi.getDetail({ period: record.period, employee_id: record.employee_id });
      setDetail(d);
      if (d?.summary?.id != null) {
        setSummaryTrackingId(d.summary.id);
      }
      setSummaryTrackingRefreshKey((k) => k + 1);
    } catch (e: any) {
      messageApi.error(e?.message || t('app.kuaizhizao.performance.common.messages.loadFailed'));
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
    () => [
      {
        title: t('app.kuaizhizao.performance.common.columns.employee'),
        dataIndex: 'employee_name',
        width: 120,
        fixed: 'left',
        render: (_, r) => (
          <Typography.Text copyable={{ text: String(r.employee_name ?? '') }} ellipsis>
            {r.employee_name ?? '-'}
          </Typography.Text>
        ),
      },
      { title: t('app.kuaizhizao.performance.common.columns.period'), dataIndex: 'period', width: 100 },
      { title: t('app.kuaizhizao.performance.common.columns.totalHours'), dataIndex: 'total_hours', width: 100, align: 'right' },
      { title: t('app.kuaizhizao.performance.common.columns.totalPieces'), dataIndex: 'total_pieces', width: 100, align: 'right' },
      { title: t('app.kuaizhizao.performance.common.columns.timeAmount'), dataIndex: 'time_amount', width: 110, align: 'right' },
      { title: t('app.kuaizhizao.performance.common.columns.pieceAmount'), dataIndex: 'piece_amount', width: 110, align: 'right' },
      { title: t('app.kuaizhizao.performance.common.columns.totalAmount'), dataIndex: 'total_amount', width: 110, align: 'right' },
      { title: t('app.kuaizhizao.performance.common.columns.kpiScore'), dataIndex: 'kpi_score', width: 100, align: 'right' },
      { title: t('app.kuaizhizao.performance.common.columns.kpiCoefficient'), dataIndex: 'kpi_coefficient', width: 90, align: 'right' },
      {
        title: t('app.kuaizhizao.performance.common.columns.status'),
        dataIndex: 'status',
        hideInTable: true,
        valueEnum: getPerformanceSummaryStatusValueEnum(t),
      },
      {
        title: t('app.kuaizhizao.performance.common.columns.updatedAt'),
        dataIndex: 'updated_at',
        width: 168,
        hideInSearch: true,
        render: (_, r) => (r.updated_at ? formatDateTime(r.updated_at, 'YYYY-MM-DD HH:mm:ss') : '-'),
      },
      {
        title: t('app.kuaizhizao.performance.common.columns.lifecycle'),
        dataIndex: 'lifecycle_stage',
        fixed: 'right',
        align: 'left',
        hideInSearch: true,
        render: (_, record) => {
          const lifecycle = getPerformanceSummaryLifecycle(record as unknown as Record<string, unknown>);
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
      {
        title: t('app.kuaizhizao.performance.common.columns.actions'),
        width: 220,
        fixed: 'right',
        render: (_, record) => (
          <Space size={0}>
            <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleViewDetail(record)}>
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
    ],
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
          request={async (params) => {
            try {
              const pageSize = params.pageSize || 20;
              const skip = ((params.current || 1) - 1) * pageSize;
              const result = await employeePerformanceApi.listSummaries({
                period,
                employee_id: employeeId,
                skip,
                limit: pageSize,
              });
              const rows = Array.isArray(result) ? result : [];
              const total = rows.length < pageSize ? skip + rows.length : skip + rows.length + 1;
              return { data: rows, success: true, total };
            } catch (e: any) {
              messageApi.error(e?.message || t('app.kuaizhizao.performance.common.messages.loadFailed'));
              return { data: [], success: false, total: 0 };
            }
          }}
          scroll={{ x: 1500 }}
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
        columns={[]}
        customContent={
          detailLoading && !detail ? (
            <div style={{ textAlign: 'center', padding: 48 }}>
              <Spin />
            </div>
          ) : detail ? (
            <>
              <DetailDrawerSection title={t('app.kuaizhizao.performance.common.sections.basicInfo')}>
                <Descriptions column={2} items={detailDrawerDescriptionItems(detailColumns, detail)} />
              </DetailDrawerSection>
              <DetailDrawerSection title={t('app.kuaizhizao.performance.common.sections.lifecycle')}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {(() => {
                    const row = (detail.summary ?? detail) as unknown as Record<string, unknown>;
                    const lc = getPerformanceSummaryLifecycle(row);
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
                  {summaryTrackingId != null ? (
                    <DetailDrawerInlineFullChain
                      documentType='performance_summary'
                      documentId={summaryTrackingId}
                      active={drawerVisible}
                      selfDocumentId={summaryTrackingId}
                      renderBriefActions={(doc) => (
                  <PerformanceTraceBriefPrimaryActions
                    doc={doc}
                    t={t}
                    navigate={navigate}
                    closeDrawer={closeDrawer}
                  />
                )}
                    />
                  ) : null}
                </div>
              </DetailDrawerSection>
              {detail.kpi_scores && detail.kpi_scores.length > 0 ? (
                <DetailDrawerSection title={t('app.kuaizhizao.performance.summaries.sections.kpiScores')}>
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
                </DetailDrawerSection>
              ) : null}
              <DetailDrawerSection title={t('app.kuaizhizao.performance.summaries.sections.reportingItems')}>
                {detail.items && detail.items.length > 0 ? (
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
                )}
              </DetailDrawerSection>
              <DetailDrawerSection title={t('app.kuaizhizao.performance.common.sections.operationLog')}>
                {summaryTracking.loading && (
                  <div style={{ textAlign: 'center', padding: 24 }}>
                    <Spin />
                  </div>
                )}
                {summaryTracking.error && !summaryTracking.loading && (
                  <Typography.Text type="danger">{summaryTracking.error}</Typography.Text>
                )}
                {summaryTracking.data && !summaryTracking.loading && (
                  <DocumentTrackingTimelineBody data={summaryTracking.data} />
                )}
                {!summaryTracking.loading && !summaryTracking.data && !summaryTracking.error && (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('app.kuaizhizao.performance.common.empty.noActivityLog')} />
                )}
              </DetailDrawerSection>
            </>
          ) : null
        }
      />
    </>
  );
};

export default SummariesPage;
