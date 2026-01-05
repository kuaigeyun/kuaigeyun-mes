/**
 * 设备使用记录追溯页面
 * 
 * 用于查看设备的使用历史、维护历史、故障历史、维修历史等追溯信息。
 * 
 * Author: Luigi Lu
 * Date: 2025-01-15
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { App, Card, Table, Tag, Tabs, Descriptions, Spin, message, Button } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { getEquipmentTrace, EquipmentTrace } from '../../../../services/equipmentTrace';
import { getEquipmentByUuid, Equipment } from '../../../../services/equipment';

/**
 * 设备使用记录追溯页面组件
 */
const EquipmentTracePage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const { uuid } = useParams<{ uuid: string }>();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [traceData, setTraceData] = useState<EquipmentTrace | null>(null);

  /**
   * 加载设备追溯数据
   */
  useEffect(() => {
    const loadData = async () => {
      if (!uuid) {
        messageApi.error('设备UUID不能为空');
        navigate('/system/equipment');
        return;
      }

      try {
        setLoading(true);
        
        // 并行加载设备信息和追溯数据
        const [equipmentData, trace] = await Promise.all([
          getEquipmentByUuid(uuid),
          getEquipmentTrace(uuid),
        ]);
        
        setEquipment(equipmentData);
        setTraceData(trace);
      } catch (error: any) {
        messageApi.error(error.message || '加载设备追溯数据失败');
        navigate('/system/equipment');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [uuid, navigate, messageApi]);

  /**
   * 维护计划表格列
   */
  const maintenancePlanColumns = [
    {
      title: '计划编号',
      dataIndex: 'plan_no',
      key: 'plan_no',
      width: 150,
    },
    {
      title: '计划名称',
      dataIndex: 'plan_name',
      key: 'plan_name',
      width: 200,
    },
    {
      title: '计划类型',
      dataIndex: 'plan_type',
      key: 'plan_type',
      width: 120,
    },
    {
      title: '保养类型',
      dataIndex: 'maintenance_type',
      key: 'maintenance_type',
      width: 120,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const statusMap: Record<string, { color: string; text: string }> = {
          '待执行': { color: 'default', text: '待执行' },
          '执行中': { color: 'processing', text: '执行中' },
          '已完成': { color: 'success', text: '已完成' },
          '已取消': { color: 'error', text: '已取消' },
        };
        const statusInfo = statusMap[status] || { color: 'default', text: status };
        return <Tag color={statusInfo.color}>{statusInfo.text}</Tag>;
      },
    },
    {
      title: '计划开始日期',
      dataIndex: 'planned_start_date',
      key: 'planned_start_date',
      width: 150,
      render: (date: string) => date ? new Date(date).toLocaleString('zh-CN') : '-',
    },
    {
      title: '计划结束日期',
      dataIndex: 'planned_end_date',
      key: 'planned_end_date',
      width: 150,
      render: (date: string) => date ? new Date(date).toLocaleString('zh-CN') : '-',
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (date: string) => new Date(date).toLocaleString('zh-CN'),
    },
  ];

  /**
   * 维护执行记录表格列
   */
  const maintenanceExecutionColumns = [
    {
      title: '执行编号',
      dataIndex: 'execution_no',
      key: 'execution_no',
      width: 150,
    },
    {
      title: '执行日期',
      dataIndex: 'execution_date',
      key: 'execution_date',
      width: 150,
      render: (date: string) => new Date(date).toLocaleString('zh-CN'),
    },
    {
      title: '执行人',
      dataIndex: 'executor_name',
      key: 'executor_name',
      width: 120,
    },
    {
      title: '执行结果',
      dataIndex: 'execution_result',
      key: 'execution_result',
      width: 200,
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const statusMap: Record<string, { color: string; text: string }> = {
          '待执行': { color: 'default', text: '待执行' },
          '执行中': { color: 'processing', text: '执行中' },
          '已完成': { color: 'success', text: '已完成' },
          '已取消': { color: 'error', text: '已取消' },
        };
        const statusInfo = statusMap[status] || { color: 'default', text: status };
        return <Tag color={statusInfo.color}>{statusInfo.text}</Tag>;
      },
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (date: string) => new Date(date).toLocaleString('zh-CN'),
    },
  ];

  /**
   * 故障记录表格列
   */
  const faultColumns = [
    {
      title: '故障编号',
      dataIndex: 'fault_no',
      key: 'fault_no',
      width: 150,
    },
    {
      title: '故障日期',
      dataIndex: 'fault_date',
      key: 'fault_date',
      width: 150,
      render: (date: string) => new Date(date).toLocaleString('zh-CN'),
    },
    {
      title: '故障类型',
      dataIndex: 'fault_type',
      key: 'fault_type',
      width: 120,
    },
    {
      title: '故障级别',
      dataIndex: 'fault_level',
      key: 'fault_level',
      width: 100,
      render: (level: string) => {
        const levelMap: Record<string, { color: string; text: string }> = {
          '轻微': { color: 'default', text: '轻微' },
          '一般': { color: 'processing', text: '一般' },
          '严重': { color: 'warning', text: '严重' },
          '紧急': { color: 'error', text: '紧急' },
        };
        const levelInfo = levelMap[level] || { color: 'default', text: level };
        return <Tag color={levelInfo.color}>{levelInfo.text}</Tag>;
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const statusMap: Record<string, { color: string; text: string }> = {
          '待处理': { color: 'default', text: '待处理' },
          '处理中': { color: 'processing', text: '处理中' },
          '已修复': { color: 'success', text: '已修复' },
          '已关闭': { color: 'error', text: '已关闭' },
        };
        const statusInfo = statusMap[status] || { color: 'default', text: status };
        return <Tag color={statusInfo.color}>{statusInfo.text}</Tag>;
      },
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (date: string) => new Date(date).toLocaleString('zh-CN'),
    },
  ];

  /**
   * 维修记录表格列
   */
  const repairColumns = [
    {
      title: '维修编号',
      dataIndex: 'repair_no',
      key: 'repair_no',
      width: 150,
    },
    {
      title: '维修日期',
      dataIndex: 'repair_date',
      key: 'repair_date',
      width: 150,
      render: (date: string) => new Date(date).toLocaleString('zh-CN'),
    },
    {
      title: '维修类型',
      dataIndex: 'repair_type',
      key: 'repair_type',
      width: 120,
    },
    {
      title: '维修成本',
      dataIndex: 'repair_cost',
      key: 'repair_cost',
      width: 120,
      render: (cost: number) => cost ? `¥${cost.toFixed(2)}` : '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const statusMap: Record<string, { color: string; text: string }> = {
          '待维修': { color: 'default', text: '待维修' },
          '维修中': { color: 'processing', text: '维修中' },
          '已完成': { color: 'success', text: '已完成' },
          '已取消': { color: 'error', text: '已取消' },
        };
        const statusInfo = statusMap[status] || { color: 'default', text: status };
        return <Tag color={statusInfo.color}>{statusInfo.text}</Tag>;
      },
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (date: string) => new Date(date).toLocaleString('zh-CN'),
    },
  ];

  if (loading) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!equipment || !traceData) {
    return null;
  }

  return (
    <div style={{ padding: '24px' }}>
      <Card>
        <div style={{ marginBottom: '16px' }}>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/system/equipment')}
            style={{ marginBottom: '16px' }}
          >
            返回设备列表
          </Button>
        </div>

        {/* 设备基本信息 */}
        <Card title="设备基本信息" style={{ marginBottom: '16px' }}>
          <Descriptions column={3} bordered>
            <Descriptions.Item label="设备编码">{equipment.code}</Descriptions.Item>
            <Descriptions.Item label="设备名称">{equipment.name}</Descriptions.Item>
            <Descriptions.Item label="设备状态">
              <Tag color={equipment.status === '正常' ? 'success' : 'warning'}>
                {equipment.status}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="设备类型">{equipment.type || '-'}</Descriptions.Item>
            <Descriptions.Item label="设备分类">{equipment.category || '-'}</Descriptions.Item>
            <Descriptions.Item label="品牌">{equipment.brand || '-'}</Descriptions.Item>
          </Descriptions>
        </Card>

        {/* 追溯信息标签页 */}
        <Card>
          <Tabs
            defaultActiveKey="maintenance-plans"
            items={[
              {
                key: 'maintenance-plans',
                label: `维护计划 (${traceData.maintenance_plans.length})`,
                children: (
                  <Table
                    columns={maintenancePlanColumns}
                    dataSource={traceData.maintenance_plans}
                    rowKey="uuid"
                    pagination={{ pageSize: 10 }}
                    size="small"
                  />
                ),
              },
              {
                key: 'maintenance-executions',
                label: `维护执行 (${traceData.maintenance_executions.length})`,
                children: (
                  <Table
                    columns={maintenanceExecutionColumns}
                    dataSource={traceData.maintenance_executions}
                    rowKey="uuid"
                    pagination={{ pageSize: 10 }}
                    size="small"
                  />
                ),
              },
              {
                key: 'faults',
                label: `故障记录 (${traceData.equipment_faults.length})`,
                children: (
                  <Table
                    columns={faultColumns}
                    dataSource={traceData.equipment_faults}
                    rowKey="uuid"
                    pagination={{ pageSize: 10 }}
                    size="small"
                  />
                ),
              },
              {
                key: 'repairs',
                label: `维修记录 (${traceData.equipment_repairs.length})`,
                children: (
                  <Table
                    columns={repairColumns}
                    dataSource={traceData.equipment_repairs}
                    rowKey="uuid"
                    pagination={{ pageSize: 10 }}
                    size="small"
                  />
                ),
              },
              {
                key: 'usage-history',
                label: `使用历史 (${traceData.usage_history.length})`,
                children: (
                  <div style={{ padding: '24px', textAlign: 'center', color: '#999' }}>
                    {traceData.usage_history.length > 0 ? (
                      <Table
                        dataSource={traceData.usage_history}
                        rowKey={(record, index) => `usage-${index}`}
                        pagination={{ pageSize: 10 }}
                        size="small"
                      />
                    ) : (
                      <div>暂无使用历史记录</div>
                    )}
                  </div>
                ),
              },
            ]}
          />
        </Card>
      </Card>
    </div>
  );
};

export default EquipmentTracePage;

