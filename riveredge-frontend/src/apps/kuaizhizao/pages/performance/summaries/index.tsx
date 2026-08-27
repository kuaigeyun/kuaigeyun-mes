/**
 * 绩效汇总页面
 */

import React, { useRef, useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Button, DatePicker, Select, Space, theme as AntdTheme, Tooltip } from 'antd';
import { CalculatorOutlined, CheckOutlined, RollbackOutlined, DownloadOutlined, TeamOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { UniTable } from '../../../../../components/uni-table';
import { rowActionKind, rowActionLabelKeep } from '../../../../../components/uni-action';
import { DetailDrawerActions, ListPageTemplate } from '../../../../../components/layout-templates';
import { useDocumentTracking } from '../../../../../components/document-tracking-panel';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';
import {
  getPerformanceSummaryStatusValueEnum,
  renderSummaryStatusTag,
} from '../components/performanceMeta';
import { employeePerformanceApi } from '../../../services/performance';
import type { PerformanceSummary, PerformanceDetail } from '../../../types/performance';
import { formatDateTime } from '../../../../../utils/format';
import { PerformanceSummaryDetailDrawer } from './components/PerformanceSummaryDetailDrawer';
import { alignProColumns, SALES_DOC_LIST_FIELD_RANK } from '../../sales-management/shared/documentFieldAlignment';
import {
  normalizePerformanceListResponse,
  PERFORMANCE_SUMMARY_PINNED_STATUS_FIELD,
  resolvePerformanceSummaryListParams,
} from '../../../utils/performanceListCore';
import { buildDocumentAuditColumns } from '../../shared/documentAuditColumns';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { WorkGroupDistributeModal } from './components/WorkGroupDistributeModal';
import { buildListPageHelpViewConfig } from '../../../../../components/page-help-wiki';

const SUMMARY_RESOURCE = 'kuaizhizao:performance-summaries';

const SummariesPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { token } = AntdTheme.useToken();
  const summaryDrawerZIndex = token.zIndexPopupBase;
  const { message: messageApi } = App.useApp();
  const summaryPerms = useResourcePermissions(SUMMARY_RESOURCE);
  const actionRef = useRef<ActionType>(null);
  const [period, setPeriod] = useState<string>(formatDateTime(dayjs(), 'YYYY-MM'));
  const [employeeId, setEmployeeId] = useState<number | undefined>();
  const [employees, setEmployees] = useState<{ id: number; full_name: string }[]>([]);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [detail, setDetail] = useState<PerformanceDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const detailRetryKeyRef = useRef<{ period: string; employee_id: number } | null>(null);
  const [calcLoading, setCalcLoading] = useState(false);
  const [distributeOpen, setDistributeOpen] = useState(false);
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
    setDetailError(null);
    setSummaryTrackingId(null);
  };

  const loadDetail = async (periodValue: string, employeeIdValue: number) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      const next = await employeePerformanceApi.getDetail({
        period: periodValue,
        employee_id: employeeIdValue,
      });
      setDetail(next);
      if (next?.summary?.id != null) {
        setSummaryTrackingId(next.summary.id);
      }
      setSummaryTrackingRefreshKey((k) => k + 1);
    } catch (error) {
      setDetail(null);
      setDetailError(getApiErrorMessage(error, t('common.loadFailed')));
      setSummaryTrackingId(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const reloadOpenDetail = () => {
    const key = detailRetryKeyRef.current;
    if (key) void loadDetail(key.period, key.employee_id);
  };

  useEffect(() => {
    employeePerformanceApi.listEmployees({ limit: 500 }).then((r) => {
      setEmployees(r.items.map((e) => ({ id: e.id, full_name: e.full_name || e.username })));
    }).catch(() => {});
  }, []);

  const handleCalculate = async () => {
    try {
      setCalcLoading(true);
      const res = await employeePerformanceApi.calculate(period);
      messageApi.success(t('app.kuaizhizao.performance.summaries.messages.calculateSuccess'));
      if ((res.team_only_reporting_count ?? 0) > 0) {
        messageApi.warning(
          t('app.kuaizhizao.performance.summaries.messages.teamOnlyReportingHint', {
            count: res.team_only_reporting_count,
          }),
        );
      }
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
      if (drawerVisible) reloadOpenDetail();
    } catch (e: any) {
      messageApi.error(e?.message || t('app.kuaizhizao.performance.summaries.messages.confirmFailed'));
    }
  };

  const handleReopen = async (record: PerformanceSummary) => {
    try {
      await employeePerformanceApi.reopenSummary(record.id);
      messageApi.success(t('app.kuaizhizao.performance.summaries.messages.reopenSuccess'));
      actionRef.current?.reload();
      if (drawerVisible) reloadOpenDetail();
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
      messageApi.error(e?.message || t('common.exportFailed'));
    }
  };

  const handleViewDetail = (record: PerformanceSummary) => {
    detailRetryKeyRef.current = { period: record.period, employee_id: record.employee_id };
    setSummaryTrackingId(record.id);
    setDrawerVisible(true);
    setDetail(null);
    setDetailError(null);
    void loadDetail(record.period, record.employee_id);
  };

  const columns: ProColumns<PerformanceSummary>[] = useMemo(
    () => alignProColumns<PerformanceSummary>([
      {
        // 列稀疏：业务列不堆叠（员工 → 周期 → 数量金额 → KPI → 状态）；审计叠列保留
        title: t('app.kuaizhizao.performance.common.columns.employee'),
        key: 'performance_employee_name',
        dataIndex: 'employee_name',
        minWidth: 140,
        uniTableRemainderFlex: true,
        uniTablePrimaryFlex: true,
        resizable: false,
        ellipsis: true,
        fixed: 'left',
        sorter: true,
      },
      {
        title: t('app.kuaizhizao.performance.common.columns.period'),
        dataIndex: 'period',
        width: 112,
        minWidth: 112,
        uniTableKeepWidth: true,
        resizable: false,
        sorter: true,
      },
      {
        title: t('app.kuaizhizao.performance.common.columns.totalHours'),
        dataIndex: 'total_hours',
        width: 120,
        minWidth: 120,
        uniTableKeepWidth: true,
        resizable: false,
        align: 'right',
        sorter: true,
      },
      {
        title: t('app.kuaizhizao.performance.common.columns.totalPieces'),
        dataIndex: 'total_pieces',
        width: 120,
        minWidth: 120,
        uniTableKeepWidth: true,
        resizable: false,
        align: 'right',
        sorter: true,
      },
      {
        title: t('app.kuaizhizao.performance.common.columns.timeAmount'),
        dataIndex: 'time_amount',
        width: 140,
        minWidth: 140,
        uniTableKeepWidth: true,
        resizable: false,
        align: 'right',
        sorter: true,
      },
      {
        title: t('app.kuaizhizao.performance.common.columns.pieceAmount'),
        dataIndex: 'piece_amount',
        width: 140,
        minWidth: 140,
        uniTableKeepWidth: true,
        resizable: false,
        align: 'right',
        sorter: true,
      },
      {
        title: t('app.kuaizhizao.performance.common.columns.totalAmount'),
        dataIndex: 'total_amount',
        width: 140,
        minWidth: 140,
        uniTableKeepWidth: true,
        resizable: false,
        align: 'right',
        sorter: true,
      },
      {
        title: t('app.kuaizhizao.performance.common.columns.kpiScore'),
        dataIndex: 'kpi_score',
        // 表头「KPI综合分」+ 排序钮
        width: 148,
        minWidth: 148,
        uniTableKeepWidth: true,
        resizable: false,
        align: 'right',
        sorter: true,
      },
      {
        title: t('app.kuaizhizao.performance.common.columns.kpiCoefficient'),
        dataIndex: 'kpi_coefficient',
        width: 140,
        minWidth: 140,
        uniTableKeepWidth: true,
        resizable: false,
        align: 'right',
        sorter: true,
      },
      {
        title: t('common.status'),
        dataIndex: 'status',
        hideInTable: true,
        valueEnum: getPerformanceSummaryStatusValueEnum(t),
      },
      ...buildDocumentAuditColumns<PerformanceSummary>(t),
      {
        title: t('common.status'),
        key: 'lifecycle',
        dataIndex: 'status',
        fixed: 'right',
        hideInSearch: true,
        render: (_, r) => renderSummaryStatusTag(t, r.status),
      },
      {
        title: t('common.actions'),
        key: 'action',
        fixed: 'right',
        hideInSearch: true,
        render: (_, record) => {
          const parts: React.ReactNode[] = [];
          if (summaryPerms.canRead) {
            parts.push(
              <Button key="view" {...rowActionKind('read')} onClick={() => handleViewDetail(record)} />,
            );
          }
          if (record.status === 'calculated' && summaryPerms.canAction?.('approve')) {
            parts.push(
              <Button
                key="confirm"
                {...rowActionKind('approve')}
                {...rowActionLabelKeep()}
                onClick={() => handleConfirm(record)}
              >
                {t('app.kuaizhizao.performance.common.actions.confirm')}
              </Button>,
            );
          }
          if (record.status === 'confirmed' && summaryPerms.canAction?.('revoke')) {
            parts.push(
              <Button
                key="reopen"
                {...rowActionKind('revoke')}
                {...rowActionLabelKeep()}
                onClick={() => handleReopen(record)}
              >
                {t('app.kuaizhizao.performance.common.actions.reopen')}
              </Button>,
            );
          }
          return parts;
        },
      },
    ], SALES_DOC_LIST_FIELD_RANK),
    [t, summaryPerms],
  );

  return (
    <>
      <ListPageTemplate>
        <UniTable<PerformanceSummary>
          headerTitle={t('app.kuaizhizao.performance.summaries.pageTitle')}
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          columnPersistenceId="apps.kuaizhizao.pages.performance.summaries.v2"
        viewTypes={['table', 'help']}
          helpViewConfig={buildListPageHelpViewConfig('kuaizhizao.performanceSummaries')}
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
              messageApi.error(e?.message || t('common.loadFailed'));
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
              {summaryPerms.canUpdate ? (
                <Tooltip title={t('app.kuaizhizao.performance.summaries.hints.calculate')}>
                  <Button type="primary" icon={<CalculatorOutlined />} loading={calcLoading} onClick={handleCalculate}>
                    {t('app.kuaizhizao.performance.summaries.actions.calculate')}
                  </Button>
                </Tooltip>
              ) : null}
              {summaryPerms.canUpdate ? (
                <Button icon={<TeamOutlined />} onClick={() => setDistributeOpen(true)}>
                  {t('app.kuaizhizao.performance.summaries.actions.distribute')}
                </Button>
              ) : null}
              {summaryPerms.canAction?.('approve') ? (
                <Button icon={<CheckOutlined />} loading={calcLoading} onClick={handleBatchConfirm}>
                  {t('app.kuaizhizao.performance.summaries.actions.batchConfirm')}
                </Button>
              ) : null}
              {summaryPerms.canExport ? (
                <Button icon={<DownloadOutlined />} onClick={handleExport}>
                  {t('app.kuaizhizao.performance.summaries.actions.exportConfirmed')}
                </Button>
              ) : null}
            </Space>,
          ]}
        />
      </ListPageTemplate>

      <PerformanceSummaryDetailDrawer
        open={drawerVisible}
        zIndex={summaryDrawerZIndex}
        onClose={closeDrawer}
        record={detail}
        loading={detailLoading}
        error={detailError}
        onRetry={reloadOpenDetail}
        trackingId={summaryTrackingId}
        tracking={summaryTracking}
        navigate={navigate}
        extra={
          detail?.summary ? (
            <DetailDrawerActions
              items={[
                {
                  key: 'confirm',
                  visible: detail.summary.status === 'calculated' && Boolean(summaryPerms.canAction?.('approve')),
                  render: (
                    <Button icon={<CheckOutlined />} onClick={() => void handleConfirm(detail.summary!)}>
                      {t('app.kuaizhizao.performance.common.actions.confirm')}
                    </Button>
                  ),
                },
                {
                  key: 'reopen',
                  visible: detail.summary.status === 'confirmed' && Boolean(summaryPerms.canAction?.('revoke')),
                  render: (
                    <Button icon={<RollbackOutlined />} onClick={() => void handleReopen(detail.summary!)}>
                      {t('app.kuaizhizao.performance.common.actions.reopen')}
                    </Button>
                  ),
                },
              ]}
            />
          ) : null
        }
      />

      <WorkGroupDistributeModal
        open={distributeOpen}
        period={period}
        onClose={() => setDistributeOpen(false)}
        onSuccess={() => actionRef.current?.reload()}
      />
    </>
  );
};

export default SummariesPage;
