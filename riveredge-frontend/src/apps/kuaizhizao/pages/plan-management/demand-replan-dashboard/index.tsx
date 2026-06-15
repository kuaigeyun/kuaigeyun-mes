import React, { useEffect, useMemo, useState } from 'react';
import { App, Button, Empty, Modal, Space, Spin, Table, Tag, Typography } from 'antd';
import { EyeOutlined, PlayCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import type { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import { ListPageTemplate, TwoColumnLayout, type StatCard, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { UniTable } from '../../../../../components/uni-table';
import {
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
  const [impactDetail, setImpactDetail] = useState<DemandChangeImpactDetail | null>(null);
  const [executingTaskId, setExecutingTaskId] = useState<number | null>(null);
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

  const openImpact = async (eventId: number) => {
    setImpactLoading(true);
    try {
      const detail = await getDemandChangeImpact(eventId);
      setImpactDetail(detail);
      setImpactOpen(true);
    } catch (e: any) {
      message.error(e?.message || t('app.kuaizhizao.demandReplan.loadImpactFailed'));
    } finally {
      setImpactLoading(false);
    }
  };

  const executeTask = async (row: DemandReplanTaskItem) => {
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
          await executeDemandReplanTask(
            row.id,
            requireForce ? { force: true, approval_comment: t('app.kuaizhizao.demandReplan.approvalComment') } : {}
          );
          message.success(t('app.kuaizhizao.demandReplan.executeSuccess'));
          refreshAll();
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
        render: (_, row) => <Tag color={riskColor[row.risk_level] || 'default'}>{row.risk_level}</Tag>,
      },
      {
        title: t('app.kuaizhizao.demandReplan.col.approvalStatus'),
        dataIndex: 'approval_status',
        width: 130,
        render: (_, row) => <Tag color={approvalStatusColor[row.approval_status] || 'default'}>{row.approval_status}</Tag>,
      },
      {
        title: t('app.kuaizhizao.demandReplan.col.taskStatus'),
        dataIndex: 'status',
        width: 110,
        render: (_, row) => <Tag color={taskStatusColor[row.status] || 'default'}>{row.status}</Tag>,
      },
      { title: t('app.kuaizhizao.demandReplan.col.createdAt'), dataIndex: 'created_at', valueType: 'dateTime', width: 180 },
      { title: t('app.kuaizhizao.demandReplan.col.startedAt'), dataIndex: 'started_at', valueType: 'dateTime', width: 180, hideInSearch: true },
      { title: t('app.kuaizhizao.demandReplan.col.finishedAt'), dataIndex: 'finished_at', valueType: 'dateTime', width: 180, hideInSearch: true },
      {
        title: t('app.kuaizhizao.demandReplan.col.actions'),
        key: 'action',
        fixed: 'right',
        width: 140,
        render: (_, row) => (
          <Button
            icon={<PlayCircleOutlined />}
            size="small"
            type="primary"
            loading={executingTaskId === row.id}
            disabled={!(row.status === 'pending' || row.status === 'failed')}
            onClick={() => executeTask(row)}
          >
            {t('app.kuaizhizao.demandReplan.action.execute')}
          </Button>
        ),
      },
    ],
    [executingTaskId, modeText, t]
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
          return (
            <button
              key={row.id}
              type="button"
              onClick={() => {
                setSelectedEventId(row.id);
                setSelectedEventCode(row.event_code || '');
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
                <Tag color={row.event_status === 'analyzed' ? 'success' : 'default'}>{row.event_status}</Tag>
              </div>
              <div style={{ marginTop: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {eventTypeText[row.event_type as keyof typeof eventTypeText] || row.event_type} ·{' '}
                  {sourceTypeText[row.source_type as keyof typeof sourceTypeText] || row.source_type}
                </Typography.Text>
                <Button
                  size="small"
                  type="link"
                  icon={<EyeOutlined />}
                  onClick={(e) => {
                    e.stopPropagation();
                    void openImpact(row.id);
                  }}
                >
                  {t('app.kuaizhizao.demandReplan.action.impact')}
                </Button>
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
                    <Tag color="blue">
                      {t('app.kuaizhizao.demandReplan.currentDoc', {
                        code: selectedEventCode || String(selectedEventId),
                      })}
                    </Tag>
                  ) : (
                    <Tag>{t('app.kuaizhizao.demandReplan.currentDocAll')}</Tag>
                  )}
                  {tasksLoading ? <Tag color="processing">{t('app.kuaizhizao.demandReplan.tasksLoading')}</Tag> : null}
                </Space>
              ),
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
        onCancel={() => setImpactOpen(false)}
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
            <Table
              size="small"
              rowKey="id"
              pagination={false}
              dataSource={impactDetail.impacts}
              columns={[
                { title: t('app.kuaizhizao.demandReplan.impactCol.impactType'), dataIndex: 'impact_type', width: 120 },
                { title: t('app.kuaizhizao.demandReplan.impactCol.impactId'), dataIndex: 'impact_id', width: 100 },
                { title: t('app.kuaizhizao.demandReplan.impactCol.impactCode'), dataIndex: 'impact_code', width: 160 },
                {
                  title: t('app.kuaizhizao.demandReplan.impactCol.risk'),
                  dataIndex: 'risk_level',
                  width: 90,
                  render: (v) => <Tag color={riskColor[String(v)] || 'default'}>{String(v)}</Tag>,
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
              scroll={{ y: 320 }}
            />
          </Space>
        )}
      </Modal>
    </>
  );
};

export default DemandReplanDashboardPage;
