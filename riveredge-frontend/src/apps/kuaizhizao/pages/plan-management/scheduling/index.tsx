/**
 * 计划排程页面
 *
 * 工单级排产：基于已有工单进行排产，考虑设备/产能约束。
 * 计划日期由生产计划给出，排产日期为考虑产能后的实际执行时间。
 *
 * 注意：MRP/LRP 运算结果请前往「需求计算」页面查看和操作。
 */

import React, { useRef, useState, useCallback } from 'react';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Card, Modal, Drawer, Switch } from 'antd';
import { ScheduleOutlined, ReloadOutlined, SettingOutlined } from '@ant-design/icons';
import { useRequest } from 'ahooks';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import { workOrderApi, advancedSchedulingApi, schedulingConfigApi } from '../../../services/production';
import GanttSchedulingChart, {
  type ViewMode,
  type WorkOrderForGantt,
  type GanttTaskLevel,
} from '../../../components/GanttSchedulingChart';

/** 默认排程约束（含 4M 人机料法开关） */
const DEFAULT_SCHEDULING_CONSTRAINTS = {
  priority_weight: 0.3,
  due_date_weight: 0.3,
  capacity_weight: 0.2,
  setup_time_weight: 0.2,
  optimize_objective: 'min_makespan' as const,
  consider_human: true,
  consider_equipment: true,
  consider_material: true,
  consider_mold_tool: true,
};

const SchedulingPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [ganttViewMode, setGanttViewMode] = useState<ViewMode>('week');
  const [ganttTaskLevel, setGanttTaskLevel] = useState<GanttTaskLevel>('work_order');
  const [configDrawerOpen, setConfigDrawerOpen] = useState(false);
  const [schedulingConstraints, setSchedulingConstraints] = useState(DEFAULT_SCHEDULING_CONSTRAINTS);

  const { data: ganttWorkOrders = [] as WorkOrderForGantt[], loading: ganttLoading, run: refreshGantt } = useRequest(
    async () => {
      const res = await workOrderApi.list({ skip: 0, limit: 500, include_operations: true });
      const list = Array.isArray(res) ? res : (res?.data ?? []);
      return list as WorkOrderForGantt[];
    },
    { refreshDeps: [] }
  );

  // 加载默认排程配置（若有）
  useRequest(
    async () => {
      const res = await schedulingConfigApi.getDefault();
      const config = res?.data;
      if (config?.constraints) {
        setSchedulingConstraints((prev) => ({ ...prev, ...config.constraints }));
      }
      return config;
    },
    { refreshDeps: [] }
  );

  /**
   * 处理智能排产
   */
  const handleAutoSchedule = async () => {
    const selectedIds = selectedRowKeys.length > 0
      ? (selectedRowKeys as number[])
      : undefined;

    try {
      const result = await advancedSchedulingApi.intelligentScheduling({
        work_order_ids: selectedIds,
        constraints: schedulingConstraints,
      });

      if (result.statistics.scheduled_count > 0) {
        messageApi.success(
          `智能排产完成：成功排产 ${result.statistics.scheduled_count} 个工单，排产成功率 ${(result.statistics.scheduling_rate * 100).toFixed(1)}%`
        );
      } else {
        messageApi.warning('智能排产完成，但没有工单可以排产');
      }

      if (result.unscheduled_orders?.length > 0) {
        Modal.warning({
          title: '部分工单无法排产',
          content: (
            <div>
              <p>以下工单无法排产：</p>
              <ul>
                {result.unscheduled_orders.slice(0, 5).map((order: any) => (
                  <li key={order.work_order_id}>
                    {order.work_order_code}: {order.reason}
                  </li>
                ))}
                {result.unscheduled_orders.length > 5 && (
                  <li>... 还有 {result.unscheduled_orders.length - 5} 个工单</li>
                )}
              </ul>
            </div>
          ),
        });
      }

      actionRef.current?.reload();
      refreshGantt();
    } catch (error: any) {
      messageApi.error(error?.message || '智能排产失败');
    }
  };

  const handleGanttBatchUpdate = useCallback(
    async (updates: Array<{ work_order_id: number; planned_start_date: string; planned_end_date: string }>) => {
      if (updates.length === 0) return;
      try {
        await workOrderApi.batchUpdateDates(updates);
        messageApi.success('排程已更新');
        actionRef.current?.reload();
        refreshGantt();
      } catch (e: any) {
        messageApi.error(e?.message || '排程更新失败');
        throw e;
      }
    },
    [messageApi, refreshGantt]
  );

  const handleGanttBatchUpdateOperations = useCallback(
    async (updates: Array<{ operation_id: number; planned_start_date: string; planned_end_date: string }>) => {
      if (updates.length === 0) return;
      try {
        await workOrderApi.batchUpdateOperationDates(updates);
        messageApi.success('工序排程已更新');
        actionRef.current?.reload();
        refreshGantt();
      } catch (e: any) {
        messageApi.error(e?.message || '工序排程更新失败');
        throw e;
      }
    },
    [messageApi, refreshGantt]
  );

  const columns: ProColumns<any>[] = [
    {
      title: '工单编号',
      dataIndex: 'code',
      width: 140,
      ellipsis: true,
      fixed: 'left',
    },
    {
      title: '工单名称',
      dataIndex: 'name',
      width: 150,
      ellipsis: true,
    },
    {
      title: '产品名称',
      dataIndex: 'product_name',
      width: 120,
      ellipsis: true,
    },
    {
      title: '数量',
      dataIndex: 'quantity',
      width: 80,
      align: 'right',
    },
    {
      title: '计划开始时间',
      dataIndex: 'planned_start_date',
      valueType: 'dateTime',
      width: 160,
    },
    {
      title: '计划结束时间',
      dataIndex: 'planned_end_date',
      valueType: 'dateTime',
      width: 160,
    },
    {
      title: '工作中心',
      dataIndex: 'work_center_name',
      width: 120,
      ellipsis: true,
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      width: 80,
      align: 'center',
      render: (priority: any) => {
        const val = String(priority || '');
        const colorMap: Record<string, string> = {
          urgent: 'red',
          high: 'orange',
          normal: 'blue',
          low: 'default',
        };
        const textMap: Record<string, string> = {
          urgent: '紧急',
          high: '高',
          normal: '普通',
          low: '低',
        };
        return <Tag color={colorMap[val] || 'default'}>{textMap[val] || val}</Tag>;
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueEnum: {
        draft: { text: '草稿', status: 'default' },
        released: { text: '已下达', status: 'processing' },
        in_progress: { text: '生产中', status: 'processing' },
        completed: { text: '已完成', status: 'success' },
        cancelled: { text: '已取消', status: 'error' },
      },
    },
  ];

  return (
    <ListPageTemplate>
      <UniTable
        headerTitle="待排产工单"
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        showAdvancedSearch={true}
        request={async (params: any) => {
          const res = await workOrderApi.list({
            skip: ((params.current ?? 1) - 1) * (params.pageSize ?? 20),
            limit: params.pageSize ?? 20,
            status: params.status,
            code: params.code,
          });
          const data = Array.isArray(res) ? res : (res?.data ?? res?.items ?? []);
          const total = res?.total ?? (Array.isArray(data) ? data.length : 0);
          return {
            data: Array.isArray(data) ? data : [],
            success: true,
            total: typeof total === 'number' ? total : 0,
          };
        }}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
        toolBarRender={() => [
          <Button
            key="config"
            icon={<SettingOutlined />}
            onClick={() => setConfigDrawerOpen(true)}
          >
            排程配置
          </Button>,
          <Button
            key="auto-schedule"
            type="primary"
            icon={<ScheduleOutlined />}
            onClick={handleAutoSchedule}
          >
            智能排产
          </Button>,
        ]}
      />
      <Card
        style={{ marginTop: 16 }}
        title={
          <Space>
            <ReloadOutlined onClick={refreshGantt} style={{ cursor: 'pointer' }} />
            甘特图排产
          </Space>
        }
        extra={
          <Space>
            <span>粒度：</span>
            <Space.Compact>
              <Button
                type={ganttTaskLevel === 'work_order' ? 'primary' : 'default'}
                size="small"
                onClick={() => setGanttTaskLevel('work_order')}
              >
                工单
              </Button>
              <Button
                type={ganttTaskLevel === 'operation' ? 'primary' : 'default'}
                size="small"
                onClick={() => setGanttTaskLevel('operation')}
              >
                工序
              </Button>
            </Space.Compact>
            <span style={{ marginLeft: 8 }}>视图：</span>
            <Space.Compact>
              <Button
                type={ganttViewMode === 'day' ? 'primary' : 'default'}
                size="small"
                onClick={() => setGanttViewMode('day')}
              >
                日
              </Button>
              <Button
                type={ganttViewMode === 'week' ? 'primary' : 'default'}
                size="small"
                onClick={() => setGanttViewMode('week')}
              >
                周
              </Button>
              <Button
                type={ganttViewMode === 'month' ? 'primary' : 'default'}
                size="small"
                onClick={() => setGanttViewMode('month')}
              >
                月
              </Button>
            </Space.Compact>
          </Space>
        }
      >
        <GanttSchedulingChart
          workOrders={ganttWorkOrders}
          loading={ganttLoading}
          viewMode={ganttViewMode}
          taskLevel={ganttTaskLevel}
          onViewModeChange={setGanttViewMode}
          onBatchUpdate={handleGanttBatchUpdate}
          onBatchUpdateOperations={handleGanttBatchUpdateOperations}
          onRefresh={refreshGantt}
        />
      </Card>

      {/* 排程配置 Drawer - 4M 人机料法可配置 */}
      <Drawer
        title="排程配置"
        placement="right"
        width={360}
        open={configDrawerOpen}
        onClose={() => setConfigDrawerOpen(false)}
        footer={
          <Space>
            <Button onClick={() => setSchedulingConstraints(DEFAULT_SCHEDULING_CONSTRAINTS)}>
              恢复默认
            </Button>
            <Button type="primary" onClick={() => setConfigDrawerOpen(false)}>
              确定
            </Button>
          </Space>
        }
      >
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 8, fontWeight: 500 }}>人机料法约束（4M）</div>
          <div style={{ color: '#8c8c8c', fontSize: 12, marginBottom: 12 }}>
            勾选表示排程时考虑该约束，取消勾选则忽略（适合资源有限的中小企业按实情选择）
          </div>
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>人：考虑人员约束</span>
              <Switch
                checked={schedulingConstraints.consider_human}
                onChange={(v) => setSchedulingConstraints((c) => ({ ...c, consider_human: v }))}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>机：考虑设备约束</span>
              <Switch
                checked={schedulingConstraints.consider_equipment}
                onChange={(v) => setSchedulingConstraints((c) => ({ ...c, consider_equipment: v }))}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>料：考虑物料齐套</span>
              <Switch
                checked={schedulingConstraints.consider_material}
                onChange={(v) => setSchedulingConstraints((c) => ({ ...c, consider_material: v }))}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>法：考虑模具/工装占用</span>
              <Switch
                checked={schedulingConstraints.consider_mold_tool}
                onChange={(v) => setSchedulingConstraints((c) => ({ ...c, consider_mold_tool: v }))}
              />
            </div>
          </Space>
        </div>
      </Drawer>
    </ListPageTemplate>
  );
};

export default SchedulingPage;
