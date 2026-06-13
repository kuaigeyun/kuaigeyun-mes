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
import dayjs, { Dayjs } from 'dayjs';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import {
  rollingSchedulingApi,
  type RollingScheduleLine,
} from '../../../services/rolling-scheduling';

const RESOURCE = 'kuaizhizao:plan-management-rolling-scheduling';

const SOURCE_LABELS: Record<string, string> = {
  carry_forward: '结转',
  backlog: '积压',
  already_scheduled: '已排',
  pool: '待排',
  manual: '手工',
};

const STATUS_COLORS: Record<string, string> = {
  draft: 'default',
  published: 'success',
  closed: 'processing',
};

function formatDate(d: Dayjs | string | undefined | null): string {
  if (!d) return '';
  return dayjs(d).format('YYYY-MM-DD');
}

const RollingSchedulingPage: React.FC = () => {
  const { message, modal } = App.useApp();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const perms = useResourcePermissions(RESOURCE);

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
        message.success(`已生成下一工作日计划草稿（${count} 单）`);
      } else {
        message.warning('已生成空计划：工单池无结转/已排明日/可排工单');
      }
      setLines(plan.lines ?? []);
      setDirty(false);
      refreshTargetPlan();
      refreshClosePlan();
    } catch (e: unknown) {
      message.error((e as Error)?.message || '生成失败');
    }
  }, [baseDate, message, refreshClosePlan, refreshTargetPlan]);

  const handleCloseDay = useCallback(() => {
    const closeDate = formatDate(baseDate);
    modal.confirm({
      title: `关账 ${closeDate}`,
      content: '关账将锁定当日已发布计划并统计完成实绩，是否继续？',
      onOk: async () => {
        try {
          await rollingSchedulingApi.closeDay(closeDate);
          message.success('关账完成');
          refreshClosePlan();
          refreshTargetPlan();
        } catch (e: unknown) {
          message.error((e as Error)?.message || '关账失败');
        }
      },
    });
  }, [baseDate, message, modal, refreshClosePlan, refreshTargetPlan]);

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
      message.success('计划行已保存');
      setDirty(false);
      refreshTargetPlan();
    } catch (e: unknown) {
      message.error((e as Error)?.message || '保存失败');
    }
  }, [lines, message, refreshTargetPlan, targetPlan?.id]);

  const handlePublish = useCallback(() => {
    if (!targetPlan?.id) return;
    modal.confirm({
      title: '发布日计划',
      content: `将 ${nextWorkday} 计划写入工单计划开始日（不下达），是否继续？`,
      onOk: async () => {
        try {
          if (dirty) await saveLines();
          const result = await rollingSchedulingApi.publish(targetPlan.id);
          const updated = result.batch_update?.updated?.length ?? 0;
          message.success(`发布成功，已更新 ${updated} 个工单计划日`);
          refreshTargetPlan();
          const woIds = (result.plan.lines ?? []).map((l) => l.work_order_id).join(',');
          navigate(
            `/apps/kuaizhizao/plan-management/scheduling?plan_date=${nextWorkday}&work_order_ids=${woIds}`,
          );
        } catch (e: unknown) {
          message.error((e as Error)?.message || '发布失败');
        }
      },
    });
  }, [dirty, message, modal, navigate, nextWorkday, refreshTargetPlan, saveLines, targetPlan?.id]);

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
        title: '序',
        width: 48,
        render: (_: unknown, __: RollingScheduleLine, index: number) => index + 1,
      },
      {
        title: '工单',
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
        title: '来源',
        dataIndex: 'source_type',
        width: 72,
        render: (v: string) => <Tag>{SOURCE_LABELS[v] || v}</Tag>,
      },
      {
        title: '齐套%',
        dataIndex: 'readiness_rate_snapshot',
        width: 72,
        render: (v: number | string | null) => (v != null ? `${Number(v).toFixed(0)}%` : '—'),
      },
      {
        title: '评分',
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
        title: '状态',
        dataIndex: 'work_order_status',
        width: 80,
      },
      {
        title: '操作',
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
              <Button type="link" size="small" danger onClick={() => removeLine(row.work_order_id)}>
                移除
              </Button>
            </Space>
          ) : null,
      },
    ],
    [lines.length, moveLine, perms.canUpdate, removeLine, targetPlan?.status],
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
            生成次日计划
          </Button>
        ) : null}
        {canPublish ? (
          <Button
            type="primary"
            icon={<SendOutlined />}
            disabled={!targetPlan || targetPlan.status !== 'draft' || lines.length === 0}
            onClick={handlePublish}
          >
            发布
          </Button>
        ) : null}
        {perms.canUpdate && targetPlan?.status === 'draft' ? (
          <Button onClick={saveLines} disabled={!dirty}>
            保存调序
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
          刷新
        </Button>
        {canClose ? (
          <Button onClick={handleCloseDay} disabled={closePlan?.status !== 'published'}>
            关账当日
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
            title={`当日关账统计（${formatDate(baseDate)}）`}
            loading={closeLoading}
            size="small"
            extra={
              closePlan ? (
                <Tag color={STATUS_COLORS[closePlan.status] || 'default'}>{closePlan.status}</Tag>
              ) : null
            }
          >
            {closeSummary ? (
              <Space direction="vertical" style={{ width: '100%' }} size="middle">
                <Row gutter={8}>
                  <Col span={12}>
                    <Statistic title="计划工单" value={closeSummary.planned_count ?? 0} />
                  </Col>
                  <Col span={12}>
                    <Statistic title="完成率" value={closeSummary.completion_rate ?? 0} suffix="%" />
                  </Col>
                </Row>
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="完成">{closeSummary.completed_count ?? 0}</Descriptions.Item>
                  <Descriptions.Item label="部分完成">{closeSummary.partial_count ?? 0}</Descriptions.Item>
                  <Descriptions.Item label="未开工">{closeSummary.not_started_count ?? 0}</Descriptions.Item>
                  <Descriptions.Item label="延期">{closeSummary.delayed_count ?? 0}</Descriptions.Item>
                </Descriptions>
                {(closeSummary.incomplete_items?.length ?? 0) > 0 ? (
                  <Alert
                    type="warning"
                    showIcon
                    message={`未完 ${closeSummary.incomplete_items?.length} 单将结转候选`}
                  />
                ) : (
                  <Alert type="success" showIcon icon={<CheckCircleOutlined />} message="当日计划已全部完成" />
                )}
              </Space>
            ) : (
              <Typography.Text type="secondary">
                {closePlan?.status === 'published'
                  ? '当日计划已发布，下班后可关账'
                  : '当日无已发布计划或无数据'}
              </Typography.Text>
            )}
          </Card>
        </Col>

        <Col xs={24} lg={11}>
          <Card
            title={`次日计划（${nextWorkday || '—'}）`}
            loading={planLoading}
            size="small"
            extra={
              targetPlan ? (
                <Space>
                  <Typography.Text type="secondary">{targetPlan.plan_code}</Typography.Text>
                  <Tag color={STATUS_COLORS[targetPlan.status] || 'default'}>{targetPlan.status}</Tag>
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
                  ? '计划已生成，但候选池为空（无结转/已排明日/可排工单）'
                  : '请先生成次日计划',
              }}
              scroll={{ y: 420 }}
            />
            {targetPlan && lines.length === 0 ? (
              <Alert
                type="info"
                showIcon
                style={{ marginTop: 12 }}
                message="候选池为空"
                description="请确认存在草稿/已下达/进行中工单，或先发布并关账当日计划以结转未完单据。"
              />
            ) : null}
          </Card>
        </Col>

        <Col xs={24} lg={6}>
          <Card title="粗产能提示" size="small">
            {capacity ? (
              <Space direction="vertical" style={{ width: '100%' }}>
                <Progress
                  percent={Math.min(100, capacity.utilization_rate)}
                  status={capacity.overloaded ? 'exception' : 'normal'}
                />
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="可用工时">{capacity.available_hours}h</Descriptions.Item>
                  <Descriptions.Item label="候选工时">{capacity.required_hours}h</Descriptions.Item>
                  <Descriptions.Item label="工位数">{capacity.station_count}</Descriptions.Item>
                </Descriptions>
                <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 0 }}>
                  {capacity.message}
                </Typography.Paragraph>
              </Space>
            ) : (
              <Typography.Text type="secondary">生成计划后显示</Typography.Text>
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
              跳转可视排产细排
            </Button>
          </Card>
        </Col>
      </Row>
    </ListPageTemplate>
  );
};

export default RollingSchedulingPage;
