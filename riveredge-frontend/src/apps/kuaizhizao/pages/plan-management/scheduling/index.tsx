/**
 * 计划排程页面
 *
 * 提供MRP运算结果展示和工单排程管理功能。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Card, message, Modal } from 'antd';
import { ReloadOutlined, CalculatorOutlined, ScheduleOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate } from '../../../../../components/layout-templates/ListPageTemplate';

interface MRPSuggestion {
  id: number;
  materialCode: string;
  materialName: string;
  requiredQuantity: number;
  availableQuantity: number;
  shortageQuantity: number;
  suggestedWorkOrders: number;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'scheduled' | 'completed';
}

interface WorkOrderSchedule {
  id: number;
  workOrderCode: string;
  workOrderName: string;
  productName: string;
  quantity: number;
  plannedStartDate: string;
  plannedEndDate: string;
  workCenter: string;
  status: 'pending' | 'scheduled' | 'in_progress';
  priority: number;
}

interface GanttTask {
  id: string;
  name: string;
  start: Date;
  end: Date;
  progress: number;
  dependencies?: string[];
  workCenter: string;
  priority: number;
  status: 'pending' | 'in_progress' | 'completed';
}

const SchedulingPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // Tab状态
  const [activeTab, setActiveTab] = useState<'mrp' | 'lrp' | 'schedule' | 'gantt'>('mrp');

  // 甘特图数据状态
  const [ganttTasks, setGanttTasks] = useState<GanttTask[]>([]);
  const [ganttViewMode, setGanttViewMode] = useState<'day' | 'week' | 'month'>('week');

  /**
   * 处理MRP运算
   */
  const handleRunMRP = () => {
    Modal.confirm({
      title: '运行需求计算',
      content: '确定要运行物料需求计算吗？这将基于销售预测重新计算所有物料需求。',
      onOk: async () => {
        messageApi.success('需求计算已启动，请稍后查看结果');
        actionRef.current?.reload();
      },
    });
  };

  /**
   * 处理生成工单
   */
  const handleGenerateWorkOrders = () => {
    Modal.confirm({
      title: '生成工单',
      content: '确定要基于需求计算结果生成工单吗？',
      onOk: async () => {
        messageApi.success('工单生成成功');
        actionRef.current?.reload();
      },
    });
  };

  /**
   * 处理自动排程（使用高级排产）
   */
  const handleAutoSchedule = async () => {
    Modal.confirm({
      title: '智能排产',
      content: '确定要执行智能排产吗？系统将根据工作中心能力、优先级、交期等多约束条件自动安排生产计划。',
      onOk: async () => {
        try {
          const { advancedSchedulingApi } = await import('../../../services/production');
          const result = await advancedSchedulingApi.intelligentScheduling({
            constraints: {
              priority_weight: 0.3,
              due_date_weight: 0.3,
              capacity_weight: 0.2,
              setup_time_weight: 0.2,
              optimize_objective: 'min_makespan',
            },
          });
          
          if (result.statistics.scheduled_count > 0) {
            messageApi.success(`智能排产完成：成功排产 ${result.statistics.scheduled_count} 个工单，排产成功率 ${(result.statistics.scheduling_rate * 100).toFixed(1)}%`);
          } else {
            messageApi.warning('智能排产完成，但没有工单可以排产');
          }
          
          if (result.unscheduled_orders.length > 0) {
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
        } catch (error: any) {
          messageApi.error(error?.message || '智能排产失败');
        }
      },
    });
  };

  /**
   * 处理甘特图任务拖拽
   */
  const handleTaskDrag = (taskId: string, newStart: Date, newEnd: Date) => {
    setGanttTasks(prevTasks =>
      prevTasks.map(task =>
        task.id === taskId
          ? { ...task, start: newStart, end: newEnd }
          : task
      )
    );
    messageApi.success('工单排程已更新');
  };

  /**
   * 处理甘特图视图模式切换
   */
  const handleViewModeChange = (mode: 'day' | 'week' | 'month') => {
    setGanttViewMode(mode);
  };

  /**
   * 加载甘特图数据
   */
  const loadGanttData = () => {
    // 模拟甘特图数据
    const mockTasks: GanttTask[] = [
      {
        id: 'task-1',
        name: 'WO20241201001 - 产品A生产',
        start: new Date('2024-12-02'),
        end: new Date('2024-12-04'),
        progress: 30,
        workCenter: '组装线1',
        priority: 8,
        status: 'in_progress',
      },
      {
        id: 'task-2',
        name: 'WO20241201002 - 产品B生产',
        start: new Date('2024-12-03'),
        end: new Date('2024-12-05'),
        progress: 0,
        workCenter: '组装线2',
        priority: 6,
        status: 'pending',
        dependencies: ['task-1'],
      },
      {
        id: 'task-3',
        name: 'WO20241201003 - 产品C生产',
        start: new Date('2024-12-04'),
        end: new Date('2024-12-06'),
        progress: 100,
        workCenter: '组装线1',
        priority: 5,
        status: 'completed',
      },
    ];
    setGanttTasks(mockTasks);
  };

  // 初始化甘特图数据
  React.useEffect(() => {
    if (activeTab === 'gantt') {
      loadGanttData();
    }
  }, [activeTab]);

  /**
   * MRP建议表格列定义
   */
  const mrpColumns: ProColumns<MRPSuggestion>[] = [
    {
      title: '物料编码',
      dataIndex: 'materialCode',
      width: 120,
      ellipsis: true,
      fixed: 'left',
    },
    {
      title: '物料名称',
      dataIndex: 'materialName',
      width: 150,
      ellipsis: true,
    },
    {
      title: '需求数量',
      dataIndex: 'requiredQuantity',
      width: 100,
      align: 'right',
    },
    {
      title: '可用库存',
      dataIndex: 'availableQuantity',
      width: 100,
      align: 'right',
    },
    {
      title: '缺口数量',
      dataIndex: 'shortageQuantity',
      width: 100,
      align: 'right',
      render: (text) => (
        <span style={{ color: text > 0 ? '#f5222d' : '#52c41a' }}>
          {text > 0 ? `-${text}` : text}
        </span>
      ),
    },
    {
      title: '建议工单数',
      dataIndex: 'suggestedWorkOrders',
      width: 100,
      align: 'center',
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      width: 80,
      valueEnum: {
        high: { text: '高', status: 'error' },
        medium: { text: '中', status: 'warning' },
        low: { text: '低', status: 'default' },
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueEnum: {
        pending: { text: '待处理', status: 'default' },
        scheduled: { text: '已排程', status: 'processing' },
        completed: { text: '已完成', status: 'success' },
      },
    },
    {
      title: '操作',
      width: 120,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          {record.shortageQuantity > 0 && (
            <Button
              type="link"
              size="small"
              onClick={() => messageApi.info('采购建议功能开发中')}
            >
              采购建议
            </Button>
          )}
        </Space>
      ),
    },
  ];

  /**
   * 工单排程表格列定义
   */
  const scheduleColumns: ProColumns<WorkOrderSchedule>[] = [
    {
      title: '工单编号',
      dataIndex: 'workOrderCode',
      width: 140,
      ellipsis: true,
      fixed: 'left',
    },
    {
      title: '工单名称',
      dataIndex: 'workOrderName',
      width: 150,
      ellipsis: true,
    },
    {
      title: '产品名称',
      dataIndex: 'productName',
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
      dataIndex: 'plannedStartDate',
      valueType: 'dateTime',
      width: 160,
    },
    {
      title: '计划结束时间',
      dataIndex: 'plannedEndDate',
      valueType: 'dateTime',
      width: 160,
    },
    {
      title: '工作中心',
      dataIndex: 'workCenter',
      width: 120,
      ellipsis: true,
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      width: 80,
      align: 'center',
      render: (priority) => (
        <Tag color={
          priority >= 8 ? 'red' :
          priority >= 5 ? 'orange' : 'green'
        }>
          {priority}
        </Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueEnum: {
        pending: { text: '待排程', status: 'default' },
        scheduled: { text: '已排程', status: 'processing' },
        in_progress: { text: '生产中', status: 'processing' },
      },
    },
  ];

  const tabs = [
    {
      key: 'mrp',
      label: '按预测运算结果',
      children: (
        <>
          <UniTable
            headerTitle=""
            actionRef={actionRef}
            rowKey="id"
            columns={mrpColumns}
            showAdvancedSearch={true}
            request={async (params) => {
              // 模拟MRP结果数据
              const mockData: MRPSuggestion[] = [
                {
                  id: 1,
                  materialCode: 'FIN001',
                  materialName: '产品A',
                  requiredQuantity: 100,
                  availableQuantity: 8,
                  shortageQuantity: 92,
                  suggestedWorkOrders: 1,
                  priority: 'high',
                  status: 'pending',
                },
                {
                  id: 2,
                  materialCode: 'RAW001',
                  materialName: '塑料颗粒A',
                  requiredQuantity: 2000,
                  availableQuantity: 950,
                  shortageQuantity: 1050,
                  suggestedWorkOrders: 0,
                  priority: 'high',
                  status: 'pending',
                },
                {
                  id: 3,
                  materialCode: 'RAW003',
                  materialName: '螺丝',
                  requiredQuantity: 800,
                  availableQuantity: 9800,
                  shortageQuantity: 0,
                  suggestedWorkOrders: 0,
                  priority: 'medium',
                  status: 'scheduled',
                },
              ];

              return {
                data: mockData,
                success: true,
                total: mockData.length,
              };
            }}
            rowSelection={{
              selectedRowKeys,
              onChange: setSelectedRowKeys,
            }}
            toolBarRender={() => [
              <Button
                key="run-mrp"
                type="primary"
                icon={<CalculatorOutlined />}
                onClick={handleRunMRP}
              >
                运行需求计算
              </Button>,
              <Button
                key="generate-orders"
                icon={<ScheduleOutlined />}
                onClick={handleGenerateWorkOrders}
              >
                生成工单
              </Button>,
            ]}
          />
        </>
      ),
    },
    {
      key: 'lrp',
      label: '按订单运算结果',
      children: (
        <>
          <UniTable
            headerTitle=""
            actionRef={actionRef}
            rowKey="id"
            columns={[
              {
                title: '销售订单',
                dataIndex: 'salesOrderCode',
                width: 150,
                ellipsis: true,
              },
              {
                title: '产品编码',
                dataIndex: 'productCode',
                width: 120,
              },
              {
                title: '产品名称',
                dataIndex: 'productName',
                width: 150,
                ellipsis: true,
              },
              {
                title: '需求数量',
                dataIndex: 'requiredQuantity',
                width: 100,
                align: 'right',
              },
              {
                title: '可用库存',
                dataIndex: 'availableQuantity',
                width: 100,
                align: 'right',
              },
              {
                title: '缺口数量',
                dataIndex: 'shortageQuantity',
                width: 100,
                align: 'right',
                render: (text) => (
                  <span style={{ color: text > 0 ? '#f5222d' : '#52c41a' }}>
                    {text > 0 ? `-${text}` : text}
                  </span>
                ),
              },
              {
                title: '建议工单数',
                dataIndex: 'suggestedWorkOrders',
                width: 100,
                align: 'center',
              },
              {
                title: '交货日期',
                dataIndex: 'deliveryDate',
                width: 120,
                valueType: 'date',
              },
              {
                title: '优先级',
                dataIndex: 'priority',
                width: 80,
                valueEnum: {
                  high: { text: '高', status: 'error' },
                  medium: { text: '中', status: 'warning' },
                  low: { text: '低', status: 'default' },
                },
              },
              {
                title: '状态',
                dataIndex: 'status',
                width: 100,
                valueEnum: {
                  pending: { text: '待处理', status: 'default' },
                  scheduled: { text: '已排程', status: 'processing' },
                  completed: { text: '已完成', status: 'success' },
                },
              },
            ]}
            showAdvancedSearch={true}
            request={async (params) => {
              // 模拟MTO LRP结果数据
              const mockData = [
                {
                  id: 1,
                  salesOrderCode: 'SO20251229001',
                  productCode: 'P001',
                  productName: '产品A',
                  requiredQuantity: 100,
                  availableQuantity: 8,
                  shortageQuantity: 92,
                  suggestedWorkOrders: 1,
                  deliveryDate: '2026-01-20',
                  priority: 'high',
                  status: 'pending',
                },
                {
                  id: 2,
                  salesOrderCode: 'SO20251229002',
                  productCode: 'P002',
                  productName: '产品B',
                  requiredQuantity: 50,
                  availableQuantity: 60,
                  shortageQuantity: 0,
                  suggestedWorkOrders: 0,
                  deliveryDate: '2026-01-15',
                  priority: 'medium',
                  status: 'scheduled',
                },
              ];

              return {
                data: mockData,
                success: true,
                total: mockData.length,
              };
            }}
            rowSelection={{
              selectedRowKeys,
              onChange: setSelectedRowKeys,
            }}
            toolBarRender={() => [
              <Button
                key="run-lrp"
                type="primary"
                icon={<CalculatorOutlined />}
                onClick={() => messageApi.info('运行按订单运算功能开发中')}
              >
                运行按订单运算
              </Button>,
              <Button
                key="create-work-orders"
                icon={<ScheduleOutlined />}
                onClick={() => messageApi.info('生成工单功能开发中')}
              >
                生成工单
              </Button>,
            ]}
          />
        </>
      ),
    },
    {
      key: 'schedule',
      label: '工单排程',
      children: (
        <>
          <UniTable
            headerTitle=""
            actionRef={actionRef}
            rowKey="id"
            columns={scheduleColumns}
            showAdvancedSearch={true}
            request={async (params) => {
              // 模拟工单排程数据
              const mockData: WorkOrderSchedule[] = [
                {
                  id: 1,
                  workOrderCode: 'WO20241202001',
                  workOrderName: '产品A生产工单',
                  productName: '产品A',
                  quantity: 92,
                  plannedStartDate: '2024-12-02 08:00:00',
                  plannedEndDate: '2024-12-02 18:00:00',
                  workCenter: '组装线1',
                  status: 'scheduled',
                  priority: 8,
                },
                {
                  id: 2,
                  workOrderCode: 'WO20241203001',
                  workOrderName: '产品B定制工单',
                  productName: '产品B',
                  quantity: 60,
                  plannedStartDate: '2024-12-03 08:00:00',
                  plannedEndDate: '2024-12-03 17:00:00',
                  workCenter: '组装线2',
                  status: 'pending',
                  priority: 6,
                },
              ];

              return {
                data: mockData,
                success: true,
                total: mockData.length,
              };
            }}
            rowSelection={{
              selectedRowKeys,
              onChange: setSelectedRowKeys,
            }}
            toolBarRender={() => [
              <Button
                key="auto-schedule"
                type="primary"
                icon={<ScheduleOutlined />}
                onClick={handleAutoSchedule}
              >
                自动排程
              </Button>,
            ]}
          />
        </>
      ),
    },
    {
      key: 'gantt',
      label: '甘特图排产',
      children: (
        <>
          {/* 甘特图工具栏 */}
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Space>
              <Button
                icon={<ReloadOutlined />}
                onClick={loadGanttData}
              >
                刷新
              </Button>
              <Button
                type="primary"
                icon={<ScheduleOutlined />}
                onClick={handleAutoSchedule}
              >
                自动排程
              </Button>
            </Space>
            <Space>
              <span>视图：</span>
              <Button.Group>
                <Button
                  type={ganttViewMode === 'day' ? 'primary' : 'default'}
                  onClick={() => handleViewModeChange('day')}
                >
                  日
                </Button>
                <Button
                  type={ganttViewMode === 'week' ? 'primary' : 'default'}
                  onClick={() => handleViewModeChange('week')}
                >
                  周
                </Button>
                <Button
                  type={ganttViewMode === 'month' ? 'primary' : 'default'}
                  onClick={() => handleViewModeChange('month')}
                >
                  月
                </Button>
              </Button.Group>
            </Space>
          </div>

          {/* 甘特图容器 */}
          <Card style={{ height: 600 }}>
            <div style={{
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#f5f5f5',
              border: '2px dashed #d9d9d9',
              borderRadius: '8px'
            }}>
              <div style={{ textAlign: 'center', color: '#999' }}>
                <ScheduleOutlined style={{ fontSize: '48px', marginBottom: '16px' }} />
                <div style={{ fontSize: '16px', marginBottom: '8px' }}>甘特图功能开发中</div>
                <div>支持拖拽调整工单排程时间</div>
                <div>显示工作中心产能和依赖关系</div>
              </div>
            </div>
          </Card>
        </>
      ),
    },
  ];

  return (
    <ListPageTemplate>
      <Card
        tabList={tabs.map(tab => ({ key: tab.key, label: tab.label }))}
        activeTabKey={activeTab}
        onTabChange={(key) => setActiveTab(key as 'mrp' | 'lrp' | 'schedule')}
        bodyStyle={{ padding: '0' }}
      >
        {tabs.find(tab => tab.key === activeTab)?.children}
      </Card>
    </ListPageTemplate>
  );
};

export default SchedulingPage;
