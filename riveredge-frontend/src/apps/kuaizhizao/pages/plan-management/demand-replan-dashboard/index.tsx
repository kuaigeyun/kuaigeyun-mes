import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Button, Empty, Modal, Space, Spin, Table, Tag, Typography } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import type { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import { ListPageTemplate, TwoColumnLayout, type StatCard, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { UniTable } from '../../../../../components/uni-table';
import { rowActionKind } from '../../../../../components/uni-action';
import {
  ensureReplanTaskForEvent,
  executeDemandReplanTask,
  getDemandChangeImpact,
  getDemandReplanDashboard,
  listDemandReplanTasks,
  listPendingDemandChangeEvents,
  type DemandChangeEventItem,
  type DemandChangeImpactDetail,
  type DemandReplanTaskItem,
} from '../../../services/demand-computation';

const riskColor: Record<string, string> = {
  low: 'success',
  medium: 'warning',
  high: 'error',
};

const taskStatusColor: Record<string, string> = {
  pending: 'default',
  running: 'processing',
  completed: 'success',
  failed: 'error',
  cancelled: 'default',
};

const approvalStatusColor: Record<string, string> = {
  not_required: 'default',
  pending: 'warning',
  approved: 'success',
  rejected: 'error',
};

const isActionableTaskStatus = (status?: string) => status === 'pending' || status === 'failed';

const eventStatusTagColor = (status?: string) => {
  if (status === 'analyzed') return 'success';
  if (status === 'failed') return 'error';
  return 'default';
};

function formatReplanTaskError(
  task: DemandReplanTaskItem,
  t: (key: string, options?: Record<string, unknown>) => string,
): string | null {
  if (task.error_message) return task.error_message;
  const failed = task.result_summary?.failed_items;
  if (Array.isArray(failed) && failed.length > 0) {
    return failed
      .map((item: { computation_id?: number; error?: string }) =>
        t('app.kuaizhizao.demandReplan.failureItem', {
          id: item.computation_id ?? '-',
          error: item.error ?? '',
        }),
      )
      .join('\n');
  }
  if (task.result_summary?.target_count === 0) {
    return t('app.kuaizhizao.demandReplan.emptyTargetComputations');
  }
  return null;
}

const DemandReplanDashboardPage: React.FC = () => {
  const { t } = useTranslation();
  const { message, modal } = App.useApp();
  const [stats, setStats] = useState<StatCard[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [eventKeyword, setEventKeyword] = useState('');
  const [eventRows, setEventRows] = useState<DemandChangeEventItem[]>([]);
  const [taskRows, setTaskRows] = useState<DemandReplanTaskItem[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [selectedEventCode, setSelectedEventCode] = useState<string>('');
  const [impactLoading, setImpactLoading] = useState(false);
  const [impactOpen, setImpactOpen] = useState(false);
  const [impactEventId, setImpactEventId] = useState<number | null>(null);
  const [impactDetail, setImpactDetail] = useState<DemandChangeImpactDetail | null>(null);
  const [executingTaskId, setExecutingTaskId] = useState<number | null>(null);
  const [creatingTaskEventId, setCreatingTaskEventId] = useState<number | null>(null);
  const [failureTask, setFailureTask] = useState<DemandReplanTaskItem | null>(null);
  const [refreshSeed, setRefreshSeed] = useState(0);

  const modeText = useMemo(
    () => ({
      net_change: t('app.kuaizhizao.demandReplan.mode.netChange'),
      full_regen: t('app.kuaizhizao.demandReplan.mode.fullRegen'),
      what_if: t('app.kuaizhizao.demandReplan.mode.whatIf'),
    }),
    [t]
  );

  const eventTypeText = useMemo(
    () => ({
      order: t('app.kuaizhizao.demandReplan.eventType.order'),
      design: t('app.kuaizhizao.demandReplan.eventType.design'),
      route: t('app.kuaizhizao.demandReplan.eventType.route'),
      manual: t('app.kuaizhizao.demandReplan.eventType.manual'),
    }),
    [t]
  );

  const sourceTypeText = useMemo(
    () => ({
      sales_order: t('app.kuaizhizao.demandReplan.sourceType.salesOrder'),
      sales_forecast: t('app.kuaizhizao.demandReplan.sourceType.salesForecast'),
      bom_change: t('app.kuaizhizao.demandReplan.sourceType.bomChange'),
      process_route_change: t('app.kuaizhizao.demandReplan.sourceType.processRouteChange'),
    }),
    [t]
  );

  const riskLevelText = useMemo(
    () => ({
      low: t('app.kuaizhizao.demandReplan.riskLevel.low'),
      medium: t('app.kuaizhizao.demandReplan.riskLevel.medium'),
      high: t('app.kuaizhizao.demandReplan.riskLevel.high'),
    }),
    [t]
  );

  const taskStatusText = useMemo(
    () => ({
      pending: t('app.kuaizhizao.demandReplan.taskStatus.pending'),
      running: t('app.kuaizhizao.demandReplan.taskStatus.running'),
      completed: t('app.kuaizhizao.demandReplan.taskStatus.completed'),
      failed: t('app.kuaizhizao.demandReplan.taskStatus.failed'),
      cancelled: t('app.kuaizhizao.demandReplan.taskStatus.cancelled'),
    }),
    [t]
  );

  const approvalStatusText = useMemo(
    () => ({
      not_required: t('app.kuaizhizao.demandReplan.approvalStatus.notRequired'),
      pending: t('app.kuaizhizao.demandReplan.approvalStatus.pending'),
      approved: t('app.kuaizhizao.demandReplan.approvalStatus.approved'),
      rejected: t('app.kuaizhizao.demandReplan.approvalStatus.rejected'),
    }),
    [t]
  );

  const eventStatusText = useMemo(
    () => ({
      pending: t('app.kuaizhizao.demandReplan.eventStatus.pending'),
      analyzed: t('app.kuaizhizao.demandReplan.eventStatus.analyzed'),
      failed: t('app.kuaizhizao.demandReplan.eventStatus.failed'),
      closed: t('app.kuaizhizao.demandReplan.eventStatus.closed'),
    }),
    [t]
  );

  const impactTypeText = useMemo(
    () => ({
      demand: t('app.kuaizhizao.demandReplan.impactType.demand'),
      computation: t('app.kuaizhizao.demandReplan.impactType.computation'),
      plan: t('app.kuaizhizao.demandReplan.impactType.plan'),
      material: t('app.kuaizhizao.demandReplan.impactType.material'),
    }),
    [t]
  );

  const labelFromMap = (map: Record<string, string>, key?: string) => {
    if (!key) return '-';
    return map[key] ?? key;
  };

  const refreshAll = () => setRefreshSeed((v) => v + 1);

  const loadStats = async () => {
    const d = await getDemandReplanDashboard();
    setStats([
      { key: 'pending_events', title: t('app.kuaizhizao.demandReplan.stat.pendingEvents'), value: d.pending_events, valueStyle: { color: '#1677ff' } },
      { key: 'running_tasks', title: t('app.kuaizhizao.demandReplan.stat.runningTasks'), value: d.running_tasks, valueStyle: { color: '#722ed1' } },
      { key: 'failed_tasks', title: t('app.kuaizhizao.demandReplan.stat.failedTasks'), value: d.failed_tasks, valueStyle: { color: '#cf1322' } },
      { key: 'pending_approval_tasks', title: t('app.kuaizhizao.demandReplan.stat.pendingApprovalTasks'), value: d.pending_approval_tasks, valueStyle: { color: '#d48806' } },
    ]);
  };

  const loadEvents = async () => {
    setEventsLoading(true);
    try {
      const rows = await listPendingDemandChangeEvents(200);
      setEventRows(rows || []);
    } catch (e: any) {
      message.error(e?.message || t('app.kuaizhizao.demandReplan.loadEventsFailed'));
      setEventRows([]);
    } finally {
      setEventsLoading(false);
    }
  };

  const loadTasks = async () => {
    setTasksLoading(true);
    try {
      const rows = await listDemandReplanTasks(200);
      setTaskRows(rows || []);
    } catch (e: any) {
      message.error(e?.message || t('app.kuaizhizao.demandReplan.loadTasksFailed'));
      setTaskRows([]);
    } finally {
      setTasksLoading(false);
    }
  };

  useEffect(() => {
    void Promise.all([loadStats(), loadEvents(), loadTasks()]);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh on seed only
  }, [refreshSeed]);

  const eventHasActionableTask = useCallback(
    (eventId: number) =>
      taskRows.some((task) => Number(task.event_id) === eventId && isActionableTaskStatus(task.status)),
    [taskRows],
  );

  const loadImpactDetail = async (eventId: number) => {
    const detail = await getDemandChangeImpact(eventId);
    setImpactDetail(detail);
    return detail;
  };

  const openImpact = async (eventId: number) => {
    setImpactEventId(eventId);
    setImpactLoading(true);
    setImpactOpen(true);
    try {
      await loadImpactDetail(eventId);
    } catch (e: any) {
      message.error(e?.message || t('app.kuaizhizao.demandReplan.loadImpactFailed'));
      setImpactDetail(null);
    } finally {
      setImpactLoading(false);
    }
  };

  const createTaskForEvent = async (eventId: number, options?: { fromImpactModal?: boolean }) => {
    setCreatingTaskEventId(eventId);
    try {
      const res = await ensureReplanTaskForEvent(eventId);
      if (res.created) {
        message.success(t('app.kuaizhizao.demandReplan.createTaskSuccess', { code: res.task_code }));
      } else {
        message.info(t('app.kuaizhizao.demandReplan.createTaskExists', { code: res.task_code }));
      }
      setSelectedEventId(eventId);
      refreshAll();
      if (options?.fromImpactModal && impactOpen && impactEventId === eventId) {
        await loadImpactDetail(eventId);
      }
    } catch (e: any) {
      message.error(e?.message || t('app.kuaizhizao.demandReplan.createTaskFailed'));
    } finally {
      setCreatingTaskEventId(null);
    }
  };

  const executeTask = async (row: DemandReplanTaskItem, options?: { refreshImpact?: boolean }) => {
    const requireForce = row.approval_status === 'pending';
    modal.confirm({
      title: requireForce
        ? t('app.kuaizhizao.demandReplan.executeConfirmApproval')
        : t('app.kuaizhizao.demandReplan.executeConfirm'),
      content: (
        <Typography.Text type={requireForce ? 'warning' : undefined}>
          {row.task_code}（{modeText[row.mode as keyof typeof modeText] || row.mode}）
        </Typography.Text>
      ),
      onOk: async () => {
        setExecutingTaskId(row.id);
        try {
          const res = await executeDemandReplanTask(
            row.id,
            requireForce ? { force: true, approval_comment: t('app.kuaizhizao.demandReplan.approvalComment') } : {}
          );
          if (res.status === 'failed') {
            const errText =
              res.error_message ||
              formatReplanTaskError({ ...row, error_message: res.error_message, result_summary: res.result_summary }, t) ||
              t('app.kuaizhizao.demandReplan.executeFailed');
            message.error(errText);
            setFailureTask({
              ...row,
              status: 'failed',
              error_message: res.error_message,
              result_summary: res.result_summary ?? row.result_summary,
            });
          } else {
            message.success(t('app.kuaizhizao.demandReplan.executeSuccess'));
          }
          refreshAll();
          if (options?.refreshImpact && impactOpen && impactEventId != null) {
            await loadImpactDetail(impactEventId);
          }
        } catch (e: any) {
          message.error(e?.message || t('app.kuaizhizao.demandReplan.executeFailed'));
        } finally {
          setExecutingTaskId(null);
        }
      },
    });
  };

  const taskColumns: ProColumns<DemandReplanTaskItem>[] = useMemo(
    () => [
      { title: t('app.kuaizhizao.demandReplan.col.taskCode'), dataIndex: 'task_code', width: 180, fixed: 'left' },
      {
        title: t('app.kuaizhizao.demandReplan.col.mode'),
        dataIndex: 'mode',
        width: 120,
        render: (_, row) => <Tag>{modeText[row.mode as keyof typeof modeText] || row.mode}</Tag>,
      },
      {
        title: t('app.kuaizhizao.demandReplan.col.riskLevel'),
        dataIndex: 'risk_level',
        width: 110,
        render: (_, row) => (
          <Tag color={riskColor[row.risk_level] || 'default'}>
            {labelFromMap(riskLevelText, row.risk_level)}
          </Tag>
        ),
      },
      {
        title: t('app.kuaizhizao.demandReplan.col.approvalStatus'),
        dataIndex: 'approval_status',
        width: 130,
        render: (_, row) => (
          <Tag color={approvalStatusColor[row.approval_status] || 'default'}>
            {labelFromMap(approvalStatusText, row.approval_status)}
          </Tag>
        ),
      },
      {
        title: t('app.kuaizhizao.demandReplan.col.taskStatus'),
        dataIndex: 'status',
        width: 110,
        render: (_, row) => (
          <Tag color={taskStatusColor[row.status] || 'default'}>
            {labelFromMap(taskStatusText, row.status)}
          </Tag>
        ),
      },
      { title: t('app.kuaizhizao.demandReplan.col.createdAt'), dataIndex: 'created_at', valueType: 'dateTime', width: 180 },
      { title: t('app.kuaizhizao.demandReplan.col.startedAt'), dataIndex: 'started_at', valueType: 'dateTime', width: 180, hideInSearch: true },
      { title: t('app.kuaizhizao.demandReplan.col.finishedAt'), dataIndex: 'finished_at', valueType: 'dateTime', width: 180, hideInSearch: true },
      {
        title: t('app.kuaizhizao.demandReplan.col.failureReason'),
        key: 'failure_reason',
        width: 200,
        ellipsis: true,
        render: (_, row) => {
          const err = formatReplanTaskError(row, t);
          if (!err) return '-';
          return (
            <Button type="link" size="small" style={{ padding: 0, maxWidth: '100%' }} onClick={() => setFailureTask(row)}>
              <Typography.Text type="danger" ellipsis style={{ maxWidth: 180 }}>
                {err.split('\n')[0]}
              </Typography.Text>
            </Button>
          );
        },
      },
      {
        title: t('app.kuaizhizao.demandReplan.col.actions'),
        key: 'action',
        fixed: 'right',
        width: 180,
        render: (_, row) => (
          <Space size={4}>
            {formatReplanTaskError(row, t) && (
              <Button {...rowActionKind('read')} size="small" onClick={() => setFailureTask(row)}>
                {t('app.kuaizhizao.demandReplan.action.viewFailure')}
              </Button>
            )}
            <Button
              {...rowActionKind('execute')}
              size="small"
              loading={executingTaskId === row.id}
              disabled={!isActionableTaskStatus(row.status)}
              onClick={() => executeTask(row)}
            >
              {t('app.kuaizhizao.demandReplan.action.execute')}
            </Button>
          </Space>
        ),
      },
    ],
    [executingTaskId, modeText, riskLevelText, taskStatusText, approvalStatusText, t]
  );

  const impactTaskColumns = useMemo(
    () => [
      { title: t('app.kuaizhizao.demandReplan.col.taskCode'), dataIndex: 'task_code', width: 160 },
      {
        title: t('app.kuaizhizao.demandReplan.col.mode'),
        dataIndex: 'mode',
        width: 100,
        render: (mode: string) => <Tag>{modeText[mode as keyof typeof modeText] || mode}</Tag>,
      },
      {
        title: t('app.kuaizhizao.demandReplan.col.taskStatus'),
        dataIndex: 'status',
        width: 100,
        render: (status: string) => (
          <Tag color={taskStatusColor[status] || 'default'}>{labelFromMap(taskStatusText, status)}</Tag>
        ),
      },
      {
        title: t('app.kuaizhizao.demandReplan.col.actions'),
        key: 'action',
        width: 100,
        render: (_: unknown, row: DemandReplanTaskItem) => (
          <Button
            {...rowActionKind('execute')}
            size="small"
            loading={executingTaskId === row.id}
            disabled={!isActionableTaskStatus(row.status)}
            onClick={() => executeTask(row, { refreshImpact: true })}
          >
            {t('app.kuaizhizao.demandReplan.action.execute')}
          </Button>
        ),
      },
    ],
    [executingTaskId, modeText, taskStatusText, t]
  );

  const filteredEventRows = useMemo(() => {
    const kw = eventKeyword.trim().toLowerCase();
    if (!kw) return eventRows;
    return eventRows.filter((row) => {
      const fullText = [
        row.event_code,
        row.source_code,
        eventTypeText[row.event_type as keyof typeof eventTypeText] || row.event_type,
        sourceTypeText[row.source_type as keyof typeof sourceTypeText] || row.source_type,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return fullText.includes(kw);
    });
  }, [eventRows, eventKeyword, eventTypeText, sourceTypeText]);

  const filteredTaskRows = useMemo(
    () => (selectedEventId ? taskRows.filter((x) => Number(x.event_id) === selectedEventId) : taskRows),
    [taskRows, selectedEventId]
  );

  const leftEventList = (
    <div style={{ padding: 8 }}>
      {eventsLoading ? (
        <div style={{ textAlign: 'center', padding: '40px 8px' }}>
          <Spin />
        </div>
      ) : filteredEventRows.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('app.kuaizhizao.demandReplan.emptyEvents')} />
      ) : (
        filteredEventRows.map((row) => {
          const active = selectedEventId === row.id;
          const hasActionableTask = eventHasActionableTask(row.id);
          return (
            <button
              key={row.id}
              type="button"
              onClick={() => {
                setSelectedEventId(row.id);
                setSelectedEventCode(row.event_code || row.source_code || '');
              }}
              style={{
                width: '100%',
                textAlign: 'left',
                border: active ? '1px solid #1677ff' : '1px solid rgba(5,5,5,0.1)',
                background: active ? 'rgba(22,119,255,0.08)' : '#fff',
                borderRadius: 8,
                padding: 10,
                marginBottom: 8,
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <Typography.Text strong style={{ fontSize: 13 }}>
                  {row.source_code || row.event_code || t('app.kuaizhizao.demandReplan.docFallback', { id: row.id })}
                </Typography.Text>
                <Tag color={eventStatusTagColor(row.event_status)}>
                  {labelFromMap(eventStatusText, row.event_status)}
                </Tag>
              </div>
              <div style={{ marginTop: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {eventTypeText[row.event_type as keyof typeof eventTypeText] || row.event_type} ·{' '}
                  {sourceTypeText[row.source_type as keyof typeof sourceTypeText] || row.source_type}
                </Typography.Text>
                <Space size={4}>
                  <Button
                    {...rowActionKind('read')}
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      void openImpact(row.id);
                    }}
                  >
                    {t('app.kuaizhizao.demandReplan.action.impact')}
                  </Button>
                  {!hasActionableTask && (
                    <Button
                      {...rowActionKind('create')}
                      size="small"
                      loading={creatingTaskEventId === row.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        void createTaskForEvent(row.id);
                      }}
                    >
                      {t('app.kuaizhizao.demandReplan.action.createTask')}
                    </Button>
                  )}
                </Space>
              </div>
              <div style={{ marginTop: 2 }}>
                <Typography.Text style={{ fontSize: 12 }}>
                  {t('app.kuaizhizao.demandReplan.eventLabel', { code: row.event_code || '-' })}
                </Typography.Text>
              </div>
            </button>
          );
        })
      )}
    </div>
  );

  return (
    <>
      <ListPageTemplate statCards={stats} fillMain>
        <TwoColumnLayout
          style={{ flex: 1, minHeight: 0 }}
          leftPanel={{
            width: 320,
            minWidth: 260,
            search: {
              placeholder: t('app.kuaizhizao.demandReplan.searchPlaceholder'),
              value: eventKeyword,
              onChange: setEventKeyword,
              allowClear: true,
            },
            actions: [
              <Button key="refresh-left" icon={<ReloadOutlined />} onClick={refreshAll} block>
                {t('app.kuaizhizao.demandReplan.refresh')}
              </Button>,
            ],
            leftContent: leftEventList,
          }}
          rightPanel={{
            header: {
              left: (
                <Space>
                  {selectedEventId ? (
                    <>
                      <Tag color="blue">
                        {t('app.kuaizhizao.demandReplan.currentDoc', {
                          code: selectedEventCode || String(selectedEventId),
                        })}
                      </Tag>
                      <Button type="link" size="small" onClick={() => setSelectedEventId(null)}>
                        {t('app.kuaizhizao.demandReplan.clearEventFilter')}
                      </Button>
                    </>
                  ) : (
                    <Tag>{t('app.kuaizhizao.demandReplan.currentDocAll')}</Tag>
                  )}
                  {tasksLoading ? <Tag color="processing">{t('app.kuaizhizao.demandReplan.tasksLoading')}</Tag> : null}
                </Space>
              ),
              right: selectedEventId && !eventHasActionableTask(selectedEventId) ? (
                <Button
                  type="primary"
                  loading={creatingTaskEventId === selectedEventId}
                  onClick={() => createTaskForEvent(selectedEventId)}
                >
                  {t('app.kuaizhizao.demandReplan.action.createTask')}
                </Button>
              ) : null,
            },
            content: (
              <UniTable<DemandReplanTaskItem>
                columnPersistenceId="apps.kuaizhizao.pages.plan-management.demand-replan-dashboard.tasks"
                columns={taskColumns}
                rowKey="id"
                request={async (params) => {
                  const current = Number(params.current || 1);
                  const pageSize = Number(params.pageSize || 20);
                  const start = (current - 1) * pageSize;
                  return {
                    data: filteredTaskRows.slice(start, start + pageSize),
                    total: filteredTaskRows.length,
                    success: true,
                  };
                }}
                params={{ refreshSeed, selectedEventId: selectedEventId || 0, taskRowsCount: filteredTaskRows.length }}
              />
            ),
            contentPadding: 16,
          }}
        />
      </ListPageTemplate>

      <Modal
        open={impactOpen}
        title={t('app.kuaizhizao.demandReplan.impactModal.title')}
        width={MODAL_CONFIG.LARGE_WIDTH}
        onCancel={() => {
          setImpactOpen(false);
          setImpactEventId(null);
          setImpactDetail(null);
        }}
        footer={null}
      >
        {impactLoading ? (
          <Typography.Text>{t('app.kuaizhizao.demandReplan.impactModal.loading')}</Typography.Text>
        ) : !impactDetail ? (
          <Typography.Text type="secondary">{t('app.kuaizhizao.demandReplan.impactModal.noDetail')}</Typography.Text>
        ) : (
          <Space direction="vertical" style={{ width: '100%' }} size={16}>
            <Typography.Text>
              {t('app.kuaizhizao.demandReplan.impactModal.event', {
                code: impactDetail.event.event_code,
                type:
                  eventTypeText[impactDetail.event.event_type as keyof typeof eventTypeText] ||
                  impactDetail.event.event_type,
              })}
            </Typography.Text>

            <div>
              <Typography.Text strong>{t('app.kuaizhizao.demandReplan.impactModal.tasksTitle')}</Typography.Text>
              {impactDetail.tasks.length === 0 ? (
                <div style={{ marginTop: 8 }}>
                  <Typography.Text type="secondary">{t('app.kuaizhizao.demandReplan.impactModal.emptyTasks')}</Typography.Text>
                  {impactEventId != null && (
                    <Button
                      type="primary"
                      size="small"
                      style={{ marginTop: 8 }}
                      loading={creatingTaskEventId === impactEventId}
                      onClick={() => createTaskForEvent(impactEventId, { fromImpactModal: true })}
                    >
                      {t('app.kuaizhizao.demandReplan.action.createTask')}
                    </Button>
                  )}
                </div>
              ) : (
                <Table
                  size="small"
                  rowKey="id"
                  pagination={false}
                  style={{ marginTop: 8 }}
                  dataSource={impactDetail.tasks}
                  columns={impactTaskColumns}
                  scroll={{ y: 160 }}
                />
              )}
            </div>

            <div>
              <Typography.Text strong>{t('app.kuaizhizao.demandReplan.impactModal.impactsTitle')}</Typography.Text>
              <Table
                size="small"
                rowKey="id"
                pagination={false}
                style={{ marginTop: 8 }}
                dataSource={impactDetail.impacts}
                locale={{ emptyText: t('app.kuaizhizao.demandReplan.impactModal.emptyImpacts') }}
                columns={[
                  {
                    title: t('app.kuaizhizao.demandReplan.impactCol.impactType'),
                    dataIndex: 'impact_type',
                    width: 120,
                    render: (v: string) => labelFromMap(impactTypeText, v),
                  },
                  { title: t('app.kuaizhizao.demandReplan.impactCol.impactId'), dataIndex: 'impact_id', width: 100 },
                  { title: t('app.kuaizhizao.demandReplan.impactCol.impactCode'), dataIndex: 'impact_code', width: 160 },
                  {
                    title: t('app.kuaizhizao.demandReplan.impactCol.risk'),
                    dataIndex: 'risk_level',
                    width: 90,
                    render: (v: string) => (
                      <Tag color={riskColor[String(v)] || 'default'}>{labelFromMap(riskLevelText, String(v))}</Tag>
                    ),
                  },
                  {
                    title: t('app.kuaizhizao.demandReplan.impactCol.approval'),
                    dataIndex: 'needs_approval',
                    width: 80,
                    render: (v) =>
                      v ? (
                        <Tag color="warning">{t('app.kuaizhizao.demandReplan.yes')}</Tag>
                      ) : (
                        <Tag>{t('app.kuaizhizao.demandReplan.no')}</Tag>
                      ),
                  },
                  { title: t('app.kuaizhizao.demandReplan.impactCol.reason'), dataIndex: 'impact_reason' },
                ]}
                scroll={{ y: 240 }}
              />
            </div>
          </Space>
        )}
      </Modal>

      <Modal
        open={failureTask != null}
        title={t('app.kuaizhizao.demandReplan.failureModal.title', { code: failureTask?.task_code ?? '' })}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        onCancel={() => setFailureTask(null)}
        footer={
          failureTask && isActionableTaskStatus(failureTask.status)
            ? [
                <Button key="close" onClick={() => setFailureTask(null)}>
                  {t('common.close')}
                </Button>,
                <Button
                  key="retry"
                  type="primary"
                  loading={executingTaskId === failureTask.id}
                  onClick={() => {
                    executeTask(failureTask);
                    setFailureTask(null);
                  }}
                >
                  {t('app.kuaizhizao.demandReplan.action.execute')}
                </Button>,
              ]
            : null
        }
      >
        {failureTask && (
          <Space direction="vertical" style={{ width: '100%' }} size={12}>
            <Typography.Paragraph type="danger" style={{ whiteSpace: 'pre-wrap', marginBottom: 0 }}>
              {formatReplanTaskError(failureTask, t) || t('app.kuaizhizao.demandReplan.failureModal.noDetail')}
            </Typography.Paragraph>
            {failureTask.result_summary && (
              <Typography.Text type="secondary">
                {t('app.kuaizhizao.demandReplan.failureModal.summary', {
                  target: failureTask.result_summary.target_count ?? 0,
                  success: failureTask.result_summary.success_count ?? 0,
                  failed: failureTask.result_summary.failed_count ?? 0,
                })}
              </Typography.Text>
            )}
          </Space>
        )}
      </Modal>
    </>
  );
};

export default DemandReplanDashboardPage;
