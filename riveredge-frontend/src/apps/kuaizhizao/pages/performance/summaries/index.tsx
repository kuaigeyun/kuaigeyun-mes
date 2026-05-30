/**
 * 绩效汇总页面
 */

import React, { useRef, useState, useEffect } from 'react';
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
import { employeePerformanceApi } from '../../../services/performance';
import type { PerformanceSummary, PerformanceDetail, PerformanceDetailItem } from '../../../types/performance';
import { getPerformanceSummaryLifecycle } from '../../../utils/performanceLifecycle';

const SummariesPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { token } = AntdTheme.useToken();
  const summaryDrawerZIndex = token.zIndexPopupBase;
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [period, setPeriod] = useState<string>(dayjs().format('YYYY-MM'));
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
      messageApi.success('计算完成');
      actionRef.current?.reload();
      setSummaryTrackingRefreshKey((k) => k + 1);
    } catch (e: any) {
      messageApi.error(e?.message || '计算失败');
    } finally {
      setCalcLoading(false);
    }
  };

  const handleConfirm = async (record: PerformanceSummary) => {
    try {
      await employeePerformanceApi.confirmSummary(record.id);
      messageApi.success('已确认');
      actionRef.current?.reload();
    } catch (e: any) {
      messageApi.error(e?.message || '确认失败');
    }
  };

  const handleReopen = async (record: PerformanceSummary) => {
    try {
      await employeePerformanceApi.reopenSummary(record.id);
      messageApi.success('已退回重算');
      actionRef.current?.reload();
    } catch (e: any) {
      messageApi.error(e?.message || '退回失败');
    }
  };

  const handleBatchConfirm = async () => {
    try {
      setCalcLoading(true);
      const res = await employeePerformanceApi.batchConfirm(period);
      messageApi.success(`已确认 ${res.confirmed_count} 条，跳过 ${res.skipped_count} 条`);
      actionRef.current?.reload();
    } catch (e: any) {
      messageApi.error(e?.message || '批量确认失败');
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
      messageApi.error(e?.message || '导出失败');
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
      messageApi.error(e?.message || '加载失败');
    } finally {
      setDetailLoading(false);
    }
  };

  const detailColumns: ProDescriptionsItemProps<PerformanceDetail>[] = [
    { title: '员工', dataIndex: 'employee_name' },
    { title: '周期', dataIndex: 'period' },
    { title: '总工时', dataIndex: ['summary', 'total_hours'], render: (_, r) => r?.summary?.total_hours ?? '-' },
    { title: '总件数', dataIndex: ['summary', 'total_pieces'], render: (_, r) => r?.summary?.total_pieces ?? '-' },
    { title: '应发金额', dataIndex: ['summary', 'total_amount'], render: (_, r) => r?.summary?.total_amount ?? '-' },
    { title: 'KPI综合分', dataIndex: ['summary', 'kpi_score'], render: (_, r) => r?.summary?.kpi_score ?? '-' },
    { title: '绩效系数', dataIndex: ['summary', 'kpi_coefficient'], render: (_, r) => r?.summary?.kpi_coefficient ?? '-' },
  ];

  const columns: ProColumns<PerformanceSummary>[] = [
    {
      title: '员工',
      dataIndex: 'employee_name',
      width: 120,
      fixed: 'left',
      render: (_, r) => (
        <Typography.Text copyable={{ text: String(r.employee_name ?? '') }} ellipsis>
          {r.employee_name ?? '-'}
        </Typography.Text>
      ),
    },
    { title: '周期', dataIndex: 'period', width: 100 },
    { title: '总工时', dataIndex: 'total_hours', width: 100, align: 'right' },
    { title: '总件数', dataIndex: 'total_pieces', width: 100, align: 'right' },
    { title: '计时金额', dataIndex: 'time_amount', width: 110, align: 'right' },
    { title: '计件金额', dataIndex: 'piece_amount', width: 110, align: 'right' },
    { title: '应发总额', dataIndex: 'total_amount', width: 110, align: 'right' },
    { title: 'KPI综合分', dataIndex: 'kpi_score', width: 100, align: 'right' },
    { title: '绩效系数', dataIndex: 'kpi_coefficient', width: 90, align: 'right' },
    {
      title: '状态',
      dataIndex: 'status',
      hideInTable: true,
      valueEnum: {
        pending: { text: '待计算' },
        calculated: { text: '已计算' },
        confirmed: { text: '已确认' },
        draft: { text: '草稿' },
      },
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      width: 168,
      hideInSearch: true,
      render: (_, r) => (r.updated_at ? dayjs(r.updated_at).format('YYYY-MM-DD HH:mm:ss') : '-'),
    },
    {
      title: '生命周期',
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
      title: '操作',
      width: 220,
      fixed: 'right',
      render: (_, record) => (
        <Space size={0}>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleViewDetail(record)}>
            明细
          </Button>
          {record.status === 'calculated' ? (
            <Button type="link" size="small" icon={<CheckOutlined />} onClick={() => handleConfirm(record)}>
              确认
            </Button>
          ) : null}
          {record.status === 'confirmed' ? (
            <Button type="link" size="small" icon={<RollbackOutlined />} onClick={() => handleReopen(record)}>
              退回
            </Button>
          ) : null}
        </Space>
      ),
    },
  ];

  return (
    <>
      <ListPageTemplate>
        <UniTable<PerformanceSummary>
          headerTitle="绩效汇总"
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
              messageApi.error(e?.message || '加载失败');
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
                placeholder="周期"
              />
              <Select
                placeholder="员工"
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
                计算绩效
              </Button>
              <Button icon={<CheckOutlined />} loading={calcLoading} onClick={handleBatchConfirm}>
                批量确认
              </Button>
              <Button icon={<DownloadOutlined />} onClick={handleExport}>
                导出已确认
              </Button>
            </Space>,
          ]}
        />
      </ListPageTemplate>

      <DetailDrawerTemplate
        title={`绩效明细 - ${detail?.employee_name || ''} ${detail?.period || ''}`}
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
              <DetailDrawerSection title="基本信息">
                <Descriptions column={2} items={detailDrawerDescriptionItems(detailColumns, detail)} />
              </DetailDrawerSection>
              <DetailDrawerSection title="生命周期">
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
                <DetailDrawerSection title="KPI 分项得分">
                  <Table
                    size="small"
                    rowKey="kpi_code"
                    pagination={false}
                    dataSource={detail.kpi_scores}
                    columns={[
                      { title: '指标', dataIndex: 'kpi_code', width: 120 },
                      { title: '得分', dataIndex: 'score', width: 80, align: 'right' },
                    ]}
                  />
                </DetailDrawerSection>
              ) : null}
              <DetailDrawerSection title="报工明细">
                {detail.items && detail.items.length > 0 ? (
                  <Table<PerformanceDetailItem>
                    size="small"
                    rowKey={(r) => String(r.reporting_record_id)}
                    pagination={false}
                    dataSource={detail.items}
                    columns={[
                      { title: '报工记录', dataIndex: 'reporting_record_id', width: 88 },
                      { title: '工单', dataIndex: 'work_order_code', width: 120, ellipsis: true },
                      { title: '工序', dataIndex: 'operation_name', width: 120, ellipsis: true },
                      { title: '报工时间', dataIndex: 'reported_at', width: 160 },
                      { title: '合格数', dataIndex: 'qualified_quantity', width: 80, align: 'right' },
                      { title: '工时', dataIndex: 'work_hours', width: 80, align: 'right' },
                    ]}
                  />
                ) : (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无报工明细" />
                )}
              </DetailDrawerSection>
              <DetailDrawerSection title="操作记录">
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
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无操作记录" />
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
