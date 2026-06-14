import React, { useEffect, useMemo, useState } from 'react'
import { App, Button, Empty, Modal, Space, Spin, Table, Tag, Typography } from 'antd'
import { EyeOutlined, PlayCircleOutlined, ReloadOutlined } from '@ant-design/icons'
import type { ProColumns } from '@ant-design/pro-components'
import { ListPageTemplate, TwoColumnLayout, type StatCard, MODAL_CONFIG } from '../../../../../components/layout-templates'
import { UniTable } from '../../../../../components/uni-table'
import {
  executeDemandReplanTask,
  getDemandChangeImpact,
  getDemandReplanDashboard,
  listDemandReplanTasks,
  listPendingDemandChangeEvents,
  type DemandChangeEventItem,
  type DemandChangeImpactDetail,
  type DemandReplanTaskItem,
} from '../../../services/demand-computation'

const riskColor: Record<string, string> = {
  low: 'success',
  medium: 'warning',
  high: 'error',
}

const taskStatusColor: Record<string, string> = {
  pending: 'default',
  running: 'processing',
  completed: 'success',
  failed: 'error',
  cancelled: 'default',
}

const approvalStatusColor: Record<string, string> = {
  not_required: 'default',
  pending: 'warning',
  approved: 'success',
  rejected: 'error',
}

const modeText: Record<string, string> = {
  net_change: '净变更',
  full_regen: '全量重算',
  what_if: '模拟',
}

const eventTypeText: Record<string, string> = {
  order: '订单变更',
  design: '设计变更',
  route: '工艺路线变更',
  manual: '手工触发',
}

const sourceTypeText: Record<string, string> = {
  sales_order: '销售订单',
  sales_forecast: '销售预测',
  bom_change: 'BOM变更',
  process_route_change: '工艺路线变更',
}

const DemandReplanDashboardPage: React.FC = () => {
  const { message, modal } = App.useApp()
  const [stats, setStats] = useState<StatCard[]>([])
  const [eventsLoading, setEventsLoading] = useState(false)
  const [tasksLoading, setTasksLoading] = useState(false)
  const [eventKeyword, setEventKeyword] = useState('')
  const [eventRows, setEventRows] = useState<DemandChangeEventItem[]>([])
  const [taskRows, setTaskRows] = useState<DemandReplanTaskItem[]>([])
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null)
  const [selectedEventCode, setSelectedEventCode] = useState<string>('')
  const [impactLoading, setImpactLoading] = useState(false)
  const [impactOpen, setImpactOpen] = useState(false)
  const [impactDetail, setImpactDetail] = useState<DemandChangeImpactDetail | null>(null)
  const [executingTaskId, setExecutingTaskId] = useState<number | null>(null)
  const [refreshSeed, setRefreshSeed] = useState(0)

  const refreshAll = () => setRefreshSeed((v) => v + 1)

  const loadStats = async () => {
    const d = await getDemandReplanDashboard()
    setStats([
      { key: 'pending_events', title: '待处理变更事件', value: d.pending_events, valueStyle: { color: '#1677ff' } },
      { key: 'running_tasks', title: '执行中任务', value: d.running_tasks, valueStyle: { color: '#722ed1' } },
      { key: 'failed_tasks', title: '失败任务', value: d.failed_tasks, valueStyle: { color: '#cf1322' } },
      { key: 'pending_approval_tasks', title: '待审批任务', value: d.pending_approval_tasks, valueStyle: { color: '#d48806' } },
    ])
  }

  const loadEvents = async () => {
    setEventsLoading(true)
    try {
      const rows = await listPendingDemandChangeEvents(200)
      setEventRows(rows || [])
    } catch (e: any) {
      message.error(e?.message || '加载变更事件失败')
      setEventRows([])
    } finally {
      setEventsLoading(false)
    }
  }

  const loadTasks = async () => {
    setTasksLoading(true)
    try {
      const rows = await listDemandReplanTasks(200)
      setTaskRows(rows || [])
    } catch (e: any) {
      message.error(e?.message || '加载重算任务失败')
      setTaskRows([])
    } finally {
      setTasksLoading(false)
    }
  }

  useEffect(() => {
    void Promise.all([loadStats(), loadEvents(), loadTasks()])
  }, [refreshSeed])

  const openImpact = async (eventId: number) => {
    setImpactLoading(true)
    try {
      const detail = await getDemandChangeImpact(eventId)
      setImpactDetail(detail)
      setImpactOpen(true)
    } catch (e: any) {
      message.error(e?.message || '获取影响详情失败')
    } finally {
      setImpactLoading(false)
    }
  }

  const executeTask = async (row: DemandReplanTaskItem) => {
    const requireForce = row.approval_status === 'pending'
    modal.confirm({
      title: requireForce ? '该任务待审批，确认审批并执行？' : '确认执行重算任务？',
      content: (
        <Typography.Text type={requireForce ? 'warning' : undefined}>
          任务 {row.task_code}（{modeText[row.mode] || row.mode}）
        </Typography.Text>
      ),
      onOk: async () => {
        setExecutingTaskId(row.id)
        try {
          await executeDemandReplanTask(row.id, requireForce ? { force: true, approval_comment: '前端看板执行' } : {})
          message.success('任务执行已触发')
          refreshAll()
        } catch (e: any) {
          message.error(e?.message || '任务执行失败')
        } finally {
          setExecutingTaskId(null)
        }
      },
    })
  }

  const taskColumns: ProColumns<DemandReplanTaskItem>[] = useMemo(
    () => [
      { title: '任务编码', dataIndex: 'task_code', width: 180, fixed: 'left' },
      {
        title: '模式',
        dataIndex: 'mode',
        width: 120,
        render: (_, row) => <Tag>{modeText[row.mode] || row.mode}</Tag>,
      },
      {
        title: '风险等级',
        dataIndex: 'risk_level',
        width: 110,
        render: (_, row) => <Tag color={riskColor[row.risk_level] || 'default'}>{row.risk_level}</Tag>,
      },
      {
        title: '审批状态',
        dataIndex: 'approval_status',
        width: 130,
        render: (_, row) => <Tag color={approvalStatusColor[row.approval_status] || 'default'}>{row.approval_status}</Tag>,
      },
      {
        title: '任务状态',
        dataIndex: 'status',
        width: 110,
        render: (_, row) => <Tag color={taskStatusColor[row.status] || 'default'}>{row.status}</Tag>,
      },
      { title: '创建时间', dataIndex: 'created_at', valueType: 'dateTime', width: 180 },
      { title: '开始时间', dataIndex: 'started_at', valueType: 'dateTime', width: 180, hideInSearch: true },
      { title: '结束时间', dataIndex: 'finished_at', valueType: 'dateTime', width: 180, hideInSearch: true },
      {
        title: '操作',
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
            执行
          </Button>
        ),
      },
    ],
    [executingTaskId],
  )

  const filteredEventRows = useMemo(() => {
    const kw = eventKeyword.trim().toLowerCase()
    if (!kw) return eventRows
    return eventRows.filter((row) => {
      const fullText = [
        row.event_code,
        row.source_code,
        eventTypeText[row.event_type] || row.event_type,
        sourceTypeText[row.source_type] || row.source_type,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return fullText.includes(kw)
    })
  }, [eventRows, eventKeyword])

  const filteredTaskRows = useMemo(
    () => (selectedEventId ? taskRows.filter((x) => Number(x.event_id) === selectedEventId) : taskRows),
    [taskRows, selectedEventId],
  )

  const leftEventList = (
    <div style={{ padding: 8 }}>
      {eventsLoading ? (
        <div style={{ textAlign: 'center', padding: '40px 8px' }}>
          <Spin />
        </div>
      ) : filteredEventRows.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无需重算单据" />
      ) : (
        filteredEventRows.map((row) => {
          const active = selectedEventId === row.id
          return (
            <button
              key={row.id}
              type="button"
              onClick={() => {
                setSelectedEventId(row.id)
                setSelectedEventCode(row.event_code || '')
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
                  {row.source_code || row.event_code || `单据#${row.id}`}
                </Typography.Text>
                <Tag color={row.event_status === 'analyzed' ? 'success' : 'default'}>{row.event_status}</Tag>
              </div>
              <div style={{ marginTop: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {eventTypeText[row.event_type] || row.event_type} · {sourceTypeText[row.source_type] || row.source_type}
                </Typography.Text>
                <Button
                  size="small"
                  type="link"
                  icon={<EyeOutlined />}
                  onClick={(e) => {
                    e.stopPropagation()
                    void openImpact(row.id)
                  }}
                >
                  影响
                </Button>
              </div>
              <div style={{ marginTop: 2 }}>
                <Typography.Text style={{ fontSize: 12 }}>事件：{row.event_code || '-'}</Typography.Text>
              </div>
            </button>
          )
        })
      )}
    </div>
  )

  return (
    <>
      <ListPageTemplate statCards={stats} fillMain>
        <TwoColumnLayout
          style={{ flex: 1, minHeight: 0 }}
          leftPanel={{
            width: 320,
            minWidth: 260,
            search: {
              placeholder: '搜索需重算单据号',
              value: eventKeyword,
              onChange: setEventKeyword,
              allowClear: true,
            },
            actions: [
              <Button key="refresh-left" icon={<ReloadOutlined />} onClick={refreshAll} block>
                刷新
              </Button>,
            ],
            leftContent: leftEventList,
          }}
          rightPanel={{
            header: {
              left: (
                <Space>
                  {selectedEventId ? (
                    <Tag color="blue">当前单据：{selectedEventCode || selectedEventId}</Tag>
                  ) : (
                    <Tag>当前单据：全部</Tag>
                  )}
                  {tasksLoading ? <Tag color="processing">任务加载中</Tag> : null}
                </Space>
              ),
            },
            content: (
              <UniTable<DemandReplanTaskItem>
                columnPersistenceId="apps.kuaizhizao.pages.plan-management.demand-replan-dashboard.tasks"
                columns={taskColumns}
                rowKey="id"
                request={async (params) => {
                  const current = Number(params.current || 1)
                  const pageSize = Number(params.pageSize || 20)
                  const start = (current - 1) * pageSize
                  return {
                    data: filteredTaskRows.slice(start, start + pageSize),
                    total: filteredTaskRows.length,
                    success: true,
                  }
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
        title="变更影响详情"
        width={MODAL_CONFIG.LARGE_WIDTH}
        onCancel={() => setImpactOpen(false)}
        footer={null}
      >
        {impactLoading ? (
          <Typography.Text>加载中...</Typography.Text>
        ) : !impactDetail ? (
          <Typography.Text type="secondary">暂无详情</Typography.Text>
        ) : (
          <Space direction="vertical" style={{ width: '100%' }} size={16}>
            <Typography.Text>
              事件：{impactDetail.event.event_code} / {eventTypeText[impactDetail.event.event_type] || impactDetail.event.event_type}
            </Typography.Text>
            <Table
              size="small"
              rowKey="id"
              pagination={false}
              dataSource={impactDetail.impacts}
              columns={[
                { title: '影响对象', dataIndex: 'impact_type', width: 120 },
                { title: '对象ID', dataIndex: 'impact_id', width: 100 },
                { title: '对象编码', dataIndex: 'impact_code', width: 160 },
                {
                  title: '风险',
                  dataIndex: 'risk_level',
                  width: 90,
                  render: (v) => <Tag color={riskColor[String(v)] || 'default'}>{String(v)}</Tag>,
                },
                {
                  title: '审批',
                  dataIndex: 'needs_approval',
                  width: 80,
                  render: (v) => (v ? <Tag color="warning">是</Tag> : <Tag>否</Tag>),
                },
                { title: '原因', dataIndex: 'impact_reason' },
              ]}
              scroll={{ y: 320 }}
            />
          </Space>
        )}
      </Modal>
    </>
  )
}

export default DemandReplanDashboardPage
