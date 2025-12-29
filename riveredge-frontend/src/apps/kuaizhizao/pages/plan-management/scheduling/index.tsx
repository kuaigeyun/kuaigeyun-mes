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

const SchedulingPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // Tab状态
  const [activeTab, setActiveTab] = useState<'mrp' | 'schedule'>('mrp');

  /**
   * 处理MRP运算
   */
  const handleRunMRP = () => {
    Modal.confirm({
      title: '运行MRP运算',
      content: '确定要运行MRP物料需求计算吗？这将基于销售预测重新计算所有物料需求。',
      onOk: async () => {
        messageApi.success('MRP运算已启动，请稍后查看结果');
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
      content: '确定要基于MRP结果生成工单吗？',
      onOk: async () => {
        messageApi.success('工单生成成功');
        actionRef.current?.reload();
      },
    });
  };

  /**
   * 处理自动排程
   */
  const handleAutoSchedule = () => {
    Modal.confirm({
      title: '自动排程',
      content: '确定要执行自动排程吗？系统将根据工作中心能力和优先级自动安排生产计划。',
      onOk: async () => {
        messageApi.success('自动排程执行完成');
        actionRef.current?.reload();
      },
    });
  };

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
      label: 'MRP运算结果',
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
                运行MRP
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
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Card
        tabList={tabs.map(tab => ({ key: tab.key, label: tab.label }))}
        activeTabKey={activeTab}
        onTabChange={(key) => setActiveTab(key as 'mrp' | 'schedule')}
        bodyStyle={{ padding: '0' }}
      >
        {tabs.find(tab => tab.key === activeTab)?.children}
      </Card>
    </div>
  );
};

export default SchedulingPage;
