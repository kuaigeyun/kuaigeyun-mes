/**
 * 滚动计划（日派工）
 *
 * 关账上一工作日 → 生成下一工作日候选 → 发布写计划日 → 跳转可视排产细排。
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  App,
  Button,
  Card,
  Col,
  DatePicker,
  Descriptions,
  Progress,
  Row,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  Alert,
} from 'antd';
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  ExportOutlined,
  ReloadOutlined,
  SendOutlined,
} from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useRequest } from 'ahooks';
import { useTranslation } from 'react-i18next';
import dayjs, { Dayjs } from 'dayjs';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { rowActionKind } from '../../../../../components/uni-action';
import { formatDateTime } from '../../../../../utils/format';
import {
  rollingSchedulingApi,
  type RollingScheduleLine,
} from '../../../services/rolling-scheduling';
import { translateWorkOrderLifecycleStatus } from '../../../utils/workOrderLifecycle';

const RESOURCE = 'kuaizhizao:plan-management-rolling-scheduling';

const STATUS_COLORS: Record<string, string> = {
  draft: 'default',
  published: 'success',
  closed: 'processing',
};

function formatDate(d: Dayjs | string | undefined | null): string {
  if (!d) return '';
  return formatDateTime(d, 'YYYY-MM-DD');
}

const RollingSchedulingPage: React.FC = () => {
  const { t } = useTranslation();
  const { message, modal } = App.useApp();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const perms = useResourcePermissions(RESOURCE);

  const sourceLabels = useMemo(
    () => ({
      carry_forward: t('app.kuaizhizao.rollingScheduling.source.carryForward'),
      backlog: t('app.kuaizhizao.rollingScheduling.source.backlog'),
      already_scheduled: t('app.kuaizhizao.rollingScheduling.source.alreadyScheduled'),
      pool: t('app.kuaizhizao.rollingScheduling.source.pool'),
      manual: t('app.kuaizhizao.rollingScheduling.source.manual'),
    }),
    [t]
  );

  const planStatusLabels = useMemo(
    () => ({
      draft: t('app.kuaizhizao.rollingScheduling.planStatus.draft'),
      published: t('app.kuaizhizao.rollingScheduling.planStatus.published'),
      closed: t('app.kuaizhizao.rollingScheduling.planStatus.closed'),
    }),
    [t]
  );

  const renderPlanStatusTag = useCallback(
    (status: string) => (
      <Tag color={STATUS_COLORS[status] || 'default'}>
        {planStatusLabels[status as keyof typeof planStatusLabels] || status}
      </Tag>
    ),
    [planStatusLabels],
  );

  const initialPlanDate = searchParams.get('plan_date');
  const [baseDate, setBaseDate] = useState<Dayjs>(() =>
    initialPlanDate ? dayjs(initialPlanDate) : dayjs(),
  );
  const [lines, setLines] = useState<RollingScheduleLine[]>([]);
  const [dirty, setDirty] = useState(false);

  const { data: nextWorkdayInfo, refresh: refreshNextWorkday } = useRequest(
    () => rollingSchedulingApi.getNextWorkday(formatDate(baseDate)),
    { refreshDeps: [formatDate(baseDate)] },
  );

  const nextWorkday = nextWorkdayInfo?.next_workday;

  const {
    data: targetPlan,
    loading: planLoading,
    refresh: refreshTargetPlan,
  } = useRequest(
    async () => {
      if (!nextWorkday) return null;
      try {
        return await rollingSchedulingApi.getByDate(nextWorkday);
      } catch {
        return null;
      }
    },
    { refreshDeps: [nextWorkday] },
  );

  const {
    data: closePlan,
    loading: closeLoading,
    refresh: refreshClosePlan,
  } = useRequest(
    async () => {
      const closeDate = formatDate(baseDate);
      try {
        return await rollingSchedulingApi.getByDate(closeDate);
      } catch {
        return null;
      }
    },
    { refreshDeps: [formatDate(baseDate)] },
  );

  useEffect(() => {
    if (targetPlan?.lines) {
      setLines(targetPlan.lines);
      setDirty(false);
    } else {
      setLines([]);
      setDirty(false);
    }
  }, [targetPlan?.id, targetPlan?.lines]);

  useEffect(() => {
    if (nextWorkday) {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('plan_date', nextWorkday);
        return next;
      });
    }
  }, [nextWorkday, setSearchParams]);

  const handleGenerate = useCallback(async () => {
    try {
      const plan = await rollingSchedulingApi.generate({ base_date: formatDate(baseDate) });
      const count = plan.lines?.length ?? 0;
      if (count > 0) {
        message.success(t('app.kuaizhizao.rollingScheduling.generateSuccess', { count }));
      } else {
        message.warning(t('app.kuaizhizao.rollingScheduling.generateEmpty'));
      }
      setLines(plan.lines ?? []);
      setDirty(false);
      refreshTargetPlan();
      refreshClosePlan();
    } catch (e: unknown) {
      message.error((e as Error)?.message || t('app.kuaizhizao.rollingScheduling.generateFailed'));
    }
  }, [baseDate, message, refreshClosePlan, refreshTargetPlan, t]);

  const handleCloseDay = useCallback(() => {
    const closeDate = formatDate(baseDate);
    modal.confirm({
      title: t('app.kuaizhizao.rollingScheduling.closeDayTitle', { date: closeDate }),
      content: t('app.kuaizhizao.rollingScheduling.closeDayContent'),
      onOk: async () => {
        try {
          await rollingSchedulingApi.closeDay(closeDate);
          message.success(t('app.kuaizhizao.rollingScheduling.closeDaySuccess'));
          refreshClosePlan();
          refreshTargetPlan();
        } catch (e: unknown) {
          message.error((e as Error)?.message || t('app.kuaizhizao.rollingScheduling.closeDayFailed'));
        }
      },
    });
  }, [baseDate, message, modal, refreshClosePlan, refreshTargetPlan, t]);

  const saveLines = useCallback(async () => {
    if (!targetPlan?.id) return;
    try {
      await rollingSchedulingApi.updateLines(
        targetPlan.id,
        lines.map((ln, idx) => ({
          work_order_id: ln.work_order_id,
          sequence: idx,
          planned_quantity: ln.planned_quantity != null ? Number(ln.planned_quantity) : undefined,
          source_type: ln.source_type,
          remarks: ln.remarks ?? undefined,
        })),
      );
      message.success(t('app.kuaizhizao.rollingScheduling.saveLinesSuccess'));
      setDirty(false);
      refreshTargetPlan();
    } catch (e: unknown) {
      message.error((e as Error)?.message || t('app.kuaizhizao.rollingScheduling.saveFailed'));
    }
  }, [lines, message, refreshTargetPlan, targetPlan?.id, t]);

  const handlePublish = useCallback(() => {
    if (!targetPlan?.id) return;
    modal.confirm({
      title: t('app.kuaizhizao.rollingScheduling.publishTitle'),
      content: t('app.kuaizhizao.rollingScheduling.publishContent', { date: nextWorkday }),
      onOk: async () => {
        try {
          if (dirty) await saveLines();
          const result = await rollingSchedulingApi.publish(targetPlan.id);
          const updated = result.batch_update?.updated?.length ?? 0;
          message.success(t('app.kuaizhizao.rollingScheduling.publishSuccess', { count: updated }));
          refreshTargetPlan();
          const woIds = (result.plan.lines ?? []).map((l) => l.work_order_id).join(',');
          navigate(
            `/apps/kuaizhizao/plan-management/scheduling?plan_date=${nextWorkday}&work_order_ids=${woIds}`,
          );
        } catch (e: unknown) {
          message.error((e as Error)?.message || t('app.kuaizhizao.rollingScheduling.publishFailed'));
        }
      },
    });
  }, [dirty, message, modal, navigate, nextWorkday, refreshTargetPlan, saveLines, targetPlan?.id, t]);

  const moveLine = useCallback((index: number, direction: -1 | 1) => {
    setLines((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next.map((ln, idx) => ({ ...ln, sequence: idx }));
    });
    setDirty(true);
  }, []);

  const removeLine = useCallback((workOrderId: number) => {
    setLines((prev) => prev.filter((ln) => ln.work_order_id !== workOrderId));
    setDirty(true);
  }, []);

  const closeSummary = closePlan?.close_summary;
  const capacity = targetPlan?.capacity_advisory;

  const columns = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.rollingScheduling.col.sequence'),
        width: 48,
        render: (_: unknown, __: RollingScheduleLine, index: number) => index + 1,
      },
      {
        title: t('app.kuaizhizao.rollingScheduling.col.workOrder'),
        dataIndex: 'work_order_code',
        render: (_: unknown, row: RollingScheduleLine) => (
          <Space direction="vertical" size={0}>
            <Typography.Text strong>{row.work_order_code}</Typography.Text>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {row.work_order_name}
            </Typography.Text>
          </Space>
        ),
      },
      {
        title: t('app.kuaizhizao.rollingScheduling.col.source'),
        dataIndex: 'source_type',
        width: 72,
        render: (v: string) => <Tag>{sourceLabels[v as keyof typeof sourceLabels] || v}</Tag>,
      },
      {
        title: t('app.kuaizhizao.rollingScheduling.col.readiness'),
        dataIndex: 'readiness_rate_snapshot',
        width: 72,
        render: (v: number | string | null) => (v != null ? `${Number(v).toFixed(0)}%` : '—'),
      },
      {
        title: t('app.kuaizhizao.rollingScheduling.col.score'),
        dataIndex: 'scheduling_score',
        width: 64,
        render: (v: number | null, row: RollingScheduleLine) =>
          v != null ? (
            <Space size={4}>
              <span>{v.toFixed(1)}</span>
              {row.scheduling_rank_band ? <Tag>{row.scheduling_rank_band}</Tag> : null}
            </Space>
          ) : (
            '—'
          ),
      },
      {
        title: t('app.kuaizhizao.rollingScheduling.col.status'),
        dataIndex: 'work_order_status',
        width: 80,
        render: (v: string) => translateWorkOrderLifecycleStatus(t, v),
      },
      {
        title: t('app.kuaizhizao.rollingScheduling.col.actions'),
        width: 120,
        render: (_: unknown, row: RollingScheduleLine, index: number) =>
          targetPlan?.status === 'draft' && perms.canUpdate ? (
            <Space size={4}>
              <Button
                type="text"
                size="small"
                icon={<ArrowUpOutlined />}
                disabled={index === 0}
                onClick={() => moveLine(index, -1)}
              />
              <Button
                type="text"
                size="small"
                icon={<ArrowDownOutlined />}
                disabled={index === lines.length - 1}
                onClick={() => moveLine(index, 1)}
              />
              <Button {...rowActionKind('delete')} size="small" onClick={() => removeLine(row.work_order_id)}>
                {t('app.kuaizhizao.rollingScheduling.remove')}
              </Button>
            </Space>
          ) : null,
      },
    ],
    [lines.length, moveLine, perms.canUpdate, removeLine, sourceLabels, t, targetPlan?.status],
  );

  const canClose = perms.canAction?.('close') ?? false;
  const canGenerate = perms.canCreate;
  const canPublish = perms.canAction?.('publish') ?? false;

  const toolbar = (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 8,
      }}
    >
      <Space wrap>
        {canGenerate ? (
          <Button type="primary" onClick={handleGenerate}>
            {t('app.kuaizhizao.rollingScheduling.generateNextDay')}
          </Button>
        ) : null}
        {canPublish ? (
          <Button
            type="primary"
            icon={<SendOutlined />}
            disabled={!targetPlan || targetPlan.status !== 'draft' || lines.length === 0}
            onClick={handlePublish}
          >
            {t('app.kuaizhizao.rollingScheduling.publish')}
          </Button>
        ) : null}
        {perms.canUpdate && targetPlan?.status === 'draft' ? (
          <Button onClick={saveLines} disabled={!dirty}>
            {t('app.kuaizhizao.rollingScheduling.saveOrder')}
          </Button>
        ) : null}
      </Space>
      <Space wrap>
        <DatePicker
          value={baseDate}
          onChange={(d) => d && setBaseDate(d)}
          allowClear={false}
          suffixIcon={<CalendarOutlined />}
        />
        <Button
          icon={<ReloadOutlined />}
          onClick={() => {
            refreshNextWorkday();
            refreshTargetPlan();
            refreshClosePlan();
          }}
        >
          {t('app.kuaizhizao.rollingScheduling.refresh')}
        </Button>
        {canClose ? (
          <Button onClick={handleCloseDay} disabled={closePlan?.status !== 'published'}>
            {t('app.kuaizhizao.rollingScheduling.closeDay')}
          </Button>
        ) : null}
      </Space>
    </div>
  );

  return (
    <ListPageTemplate toolbarExtra={toolbar}>
      <Row gutter={16}>
        <Col xs={24} lg={7}>
          <Card
            title={t('app.kuaizhizao.rollingScheduling.closeSummaryTitle', { date: formatDate(baseDate) })}
            loading={closeLoading}
            size="small"
            extra={closePlan ? renderPlanStatusTag(closePlan.status) : null}
          >
            {closeSummary ? (
              <Space direction="vertical" style={{ width: '100%' }} size="middle">
                <Row gutter={8}>
                  <Col span={12}>
                    <Statistic title={t('app.kuaizhizao.rollingScheduling.stat.plannedWorkOrders')} value={closeSummary.planned_count ?? 0} />
                  </Col>
                  <Col span={12}>
                    <Statistic title={t('app.kuaizhizao.rollingScheduling.stat.completionRate')} value={closeSummary.completion_rate ?? 0} suffix="%" />
                  </Col>
                </Row>
                <Descriptions column={1} size="small">
                  <Descriptions.Item label={t('app.kuaizhizao.rollingScheduling.stat.completed')}>{closeSummary.completed_count ?? 0}</Descriptions.Item>
                  <Descriptions.Item label={t('app.kuaizhizao.rollingScheduling.stat.partial')}>{closeSummary.partial_count ?? 0}</Descriptions.Item>
                  <Descriptions.Item label={t('app.kuaizhizao.rollingScheduling.stat.notStarted')}>{closeSummary.not_started_count ?? 0}</Descriptions.Item>
                  <Descriptions.Item label={t('app.kuaizhizao.rollingScheduling.stat.delayed')}>{closeSummary.delayed_count ?? 0}</Descriptions.Item>
                </Descriptions>
                {(closeSummary.incomplete_items?.length ?? 0) > 0 ? (
                  <Alert
                    type="warning"
                    showIcon
                    message={t('app.kuaizhizao.rollingScheduling.incompleteCarryForward', {
                      count: closeSummary.incomplete_items?.length,
                    })}
                  />
                ) : (
                  <Alert type="success" showIcon icon={<CheckCircleOutlined />} message={t('app.kuaizhizao.rollingScheduling.allCompleted')} />
                )}
              </Space>
            ) : (
              <Typography.Text type="secondary">
                {closePlan?.status === 'published'
                  ? t('app.kuaizhizao.rollingScheduling.closeHintPublished')
                  : t('app.kuaizhizao.rollingScheduling.closeHintNoData')}
              </Typography.Text>
            )}
          </Card>
        </Col>

        <Col xs={24} lg={11}>
          <Card
            title={t('app.kuaizhizao.rollingScheduling.nextDayPlanTitle', { date: nextWorkday || '—' })}
            loading={planLoading}
            size="small"
            extra={
              targetPlan ? (
                <Space>
                  <Typography.Text type="secondary">{targetPlan.plan_code}</Typography.Text>
                  {renderPlanStatusTag(targetPlan.status)}
                </Space>
              ) : null
            }
          >
            <Table<RollingScheduleLine>
              rowKey="work_order_id"
              size="small"
              pagination={false}
              dataSource={lines}
              columns={columns}
              locale={{
                emptyText: targetPlan
                  ? t('app.kuaizhizao.rollingScheduling.emptyGenerated')
                  : t('app.kuaizhizao.rollingScheduling.emptyGenerateFirst'),
              }}
              scroll={{ y: 420 }}
            />
            {targetPlan && lines.length === 0 ? (
              <Alert
                type="info"
                showIcon
                style={{ marginTop: 12 }}
                message={t('app.kuaizhizao.rollingScheduling.poolEmptyTitle')}
                description={t('app.kuaizhizao.rollingScheduling.poolEmptyDesc')}
              />
            ) : null}
          </Card>
        </Col>

        <Col xs={24} lg={6}>
          <Card title={t('app.kuaizhizao.rollingScheduling.capacityTitle')} size="small">
            {capacity ? (
              <Space direction="vertical" style={{ width: '100%' }}>
                <Progress
                  percent={Math.min(100, capacity.utilization_rate)}
                  status={capacity.overloaded ? 'exception' : 'normal'}
                />
                <Descriptions column={1} size="small">
                  <Descriptions.Item label={t('app.kuaizhizao.rollingScheduling.capacity.availableHours')}>{capacity.available_hours}h</Descriptions.Item>
                  <Descriptions.Item label={t('app.kuaizhizao.rollingScheduling.capacity.requiredHours')}>{capacity.required_hours}h</Descriptions.Item>
                  <Descriptions.Item label={t('app.kuaizhizao.rollingScheduling.capacity.stationCount')}>{capacity.station_count}</Descriptions.Item>
                </Descriptions>
                <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 0 }}>
                  {capacity.message}
                </Typography.Paragraph>
              </Space>
            ) : (
              <Typography.Text type="secondary">{t('app.kuaizhizao.rollingScheduling.capacity.generateFirst')}</Typography.Text>
            )}
          </Card>
          <Card size="small" style={{ marginTop: 16 }}>
            <Button
              block
              icon={<ExportOutlined />}
              disabled={!targetPlan || targetPlan.status === 'draft' || lines.length === 0}
              onClick={() => {
                const woIds = lines.map((l) => l.work_order_id).join(',');
                navigate(
                  `/apps/kuaizhizao/plan-management/scheduling?plan_date=${nextWorkday}&work_order_ids=${woIds}`,
                );
              }}
            >
              {t('app.kuaizhizao.rollingScheduling.goToScheduling')}
            </Button>
          </Card>
        </Col>
      </Row>
    </ListPageTemplate>
  );
};

export default RollingSchedulingPage;
