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
import { useTranslation } from 'react-i18next';
import { App, Card, Table, Tag, Tabs, Descriptions, Spin, message, Button } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { getEquipmentTrace, EquipmentTrace } from '../../../../services/equipmentTrace';
import { getEquipmentByUuid, Equipment } from '../../../../services/equipment';

/**
 * 设备使用记录追溯页面组件
 */
const EquipmentTracePage: React.FC = () => {
  const { t } = useTranslation();
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
        messageApi.error(t('pages.system.equipmentTrace.uuidRequired'));
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
        messageApi.error(error.message || t('pages.system.equipmentTrace.loadFailed'));
        navigate('/system/equipment');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [uuid, navigate, messageApi, t]);

  const planStatusTextKey: Record<string, string> = {
    '待执行': 'pages.system.equipmentTrace.statusPending',
    '执行中': 'pages.system.equipmentTrace.statusInProgress',
    '已完成': 'pages.system.equipmentTrace.statusCompleted',
    '已取消': 'pages.system.equipmentTrace.statusCancelled',
  };
  const repairStatusTextKey: Record<string, string> = {
    '待维修': 'pages.system.equipmentTrace.repairStatusPending',
    '维修中': 'pages.system.equipmentTrace.repairStatusInProgress',
    '已完成': 'pages.system.equipmentTrace.repairStatusCompleted',
    '已取消': 'pages.system.equipmentTrace.repairStatusCancelled',
  };
  const faultLevelTextKey: Record<string, string> = {
    '轻微': 'pages.system.equipmentFaults.levelMinor',
    '一般': 'pages.system.equipmentFaults.levelNormal',
    '严重': 'pages.system.equipmentFaults.levelSerious',
    '紧急': 'pages.system.equipmentFaults.levelUrgent',
  };
  const faultStatusTextKey: Record<string, string> = {
    '待处理': 'pages.system.equipmentFaults.statusPending',
    '处理中': 'pages.system.equipmentFaults.statusProcessing',
    '已修复': 'pages.system.equipmentFaults.statusFixed',
    '已关闭': 'pages.system.equipmentFaults.statusClosed',
  };
  const equipmentStatusTextKey: Record<string, string> = {
    '正常': 'pages.system.equipment.statusNormal',
    '维修中': 'pages.system.equipment.statusMaintenance',
    '停用': 'pages.system.equipment.statusStopped',
    '报废': 'pages.system.equipment.statusScrapped',
  };

  /**
   * 维护计划表格列
   */
  const maintenancePlanColumns = [
    {
      title: t('pages.system.equipmentTrace.planNo'),
      dataIndex: 'plan_no',
      key: 'plan_no',
      width: 150,
    },
    {
      title: t('pages.system.equipmentTrace.planName'),
      dataIndex: 'plan_name',
      key: 'plan_name',
      width: 200,
    },
    {
      title: t('pages.system.equipmentTrace.planType'),
      dataIndex: 'plan_type',
      key: 'plan_type',
      width: 120,
    },
    {
      title: t('pages.system.equipmentTrace.maintenanceType'),
      dataIndex: 'maintenance_type',
      key: 'maintenance_type',
      width: 120,
    },
    {
      title: t('pages.system.equipmentFaults.columnStatus'),
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const colorMap: Record<string, string> = { '待执行': 'default', '执行中': 'processing', '已完成': 'success', '已取消': 'error' };
        const text = planStatusTextKey[status] ? t(planStatusTextKey[status]) : status;
        return <Tag color={colorMap[status] || 'default'}>{text}</Tag>;
      },
    },
    {
      title: t('pages.system.equipmentTrace.plannedStartDate'),
      dataIndex: 'planned_start_date',
      key: 'planned_start_date',
      width: 150,
      render: (date: string) => date ? new Date(date).toLocaleString() : '-',
    },
    {
      title: t('pages.system.equipmentTrace.plannedEndDate'),
      dataIndex: 'planned_end_date',
      key: 'planned_end_date',
      width: 150,
      render: (date: string) => date ? new Date(date).toLocaleString() : '-',
    },
    {
      title: t('pages.system.equipmentFaults.columnCreatedAt'),
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (date: string) => new Date(date).toLocaleString(),
    },
  ];

  /**
   * 维护执行记录表格列
   */
  const maintenanceExecutionColumns = [
    {
      title: t('pages.system.equipmentTrace.executionNo'),
      dataIndex: 'execution_no',
      key: 'execution_no',
      width: 150,
    },
    {
      title: t('pages.system.equipmentTrace.executionDate'),
      dataIndex: 'execution_date',
      key: 'execution_date',
      width: 150,
      render: (date: string) => new Date(date).toLocaleString(),
    },
    {
      title: t('pages.system.equipmentTrace.executor'),
      dataIndex: 'executor_name',
      key: 'executor_name',
      width: 120,
    },
    {
      title: t('pages.system.equipmentTrace.executionResult'),
      dataIndex: 'execution_result',
      key: 'execution_result',
      width: 200,
      ellipsis: true,
    },
    {
      title: t('pages.system.equipmentFaults.columnStatus'),
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const colorMap: Record<string, string> = { '待执行': 'default', '执行中': 'processing', '已完成': 'success', '已取消': 'error' };
        const text = planStatusTextKey[status] ? t(planStatusTextKey[status]) : status;
        return <Tag color={colorMap[status] || 'default'}>{text}</Tag>;
      },
    },
    {
      title: t('pages.system.equipmentFaults.columnCreatedAt'),
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (date: string) => new Date(date).toLocaleString(),
    },
  ];

  /**
   * 故障记录表格列
   */
  const faultColumns = [
    {
      title: t('pages.system.equipmentFaults.columnFaultNo'),
      dataIndex: 'fault_no',
      key: 'fault_no',
      width: 150,
    },
    {
      title: t('pages.system.equipmentFaults.columnFaultDate'),
      dataIndex: 'fault_date',
      key: 'fault_date',
      width: 150,
      render: (date: string) => new Date(date).toLocaleString(),
    },
    {
      title: t('pages.system.equipmentFaults.columnFaultType'),
      dataIndex: 'fault_type',
      key: 'fault_type',
      width: 120,
    },
    {
      title: t('pages.system.equipmentFaults.columnFaultLevel'),
      dataIndex: 'fault_level',
      key: 'fault_level',
      width: 100,
      render: (level: string) => {
        const colorMap: Record<string, string> = { '轻微': 'default', '一般': 'processing', '严重': 'warning', '紧急': 'error' };
        const text = faultLevelTextKey[level] ? t(faultLevelTextKey[level]) : level;
        return <Tag color={colorMap[level] || 'default'}>{text}</Tag>;
      },
    },
    {
      title: t('pages.system.equipmentFaults.columnStatus'),
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const colorMap: Record<string, string> = { '待处理': 'default', '处理中': 'processing', '已修复': 'success', '已关闭': 'error' };
        const text = faultStatusTextKey[status] ? t(faultStatusTextKey[status]) : status;
        return <Tag color={colorMap[status] || 'default'}>{text}</Tag>;
      },
    },
    {
      title: t('pages.system.equipmentFaults.columnCreatedAt'),
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (date: string) => new Date(date).toLocaleString(),
    },
  ];

  /**
   * 维修记录表格列
   */
  const repairColumns = [
    {
      title: t('pages.system.equipmentTrace.repairNo'),
      dataIndex: 'repair_no',
      key: 'repair_no',
      width: 150,
    },
    {
      title: t('pages.system.equipmentTrace.repairDate'),
      dataIndex: 'repair_date',
      key: 'repair_date',
      width: 150,
      render: (date: string) => new Date(date).toLocaleString(),
    },
    {
      title: t('pages.system.equipmentTrace.repairType'),
      dataIndex: 'repair_type',
      key: 'repair_type',
      width: 120,
    },
    {
      title: t('pages.system.equipmentTrace.repairCost'),
      dataIndex: 'repair_cost',
      key: 'repair_cost',
      width: 120,
      render: (cost: number) => cost ? `¥${cost.toFixed(2)}` : '-',
    },
    {
      title: t('pages.system.equipmentFaults.columnStatus'),
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const colorMap: Record<string, string> = { '待维修': 'default', '维修中': 'processing', '已完成': 'success', '已取消': 'error' };
        const text = repairStatusTextKey[status] ? t(repairStatusTextKey[status]) : status;
        return <Tag color={colorMap[status] || 'default'}>{text}</Tag>;
      },
    },
    {
      title: t('pages.system.equipmentFaults.columnCreatedAt'),
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (date: string) => new Date(date).toLocaleString(),
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
            {t('pages.system.equipmentTrace.backToList')}
          </Button>
        </div>

        {/* 设备基本信息 */}
        <Card title={t('pages.system.equipmentTrace.basicInfoTitle')} style={{ marginBottom: '16px' }}>
          <Descriptions column={3} bordered>
            <Descriptions.Item label={t('pages.system.equipment.columnCode')}>{equipment.code}</Descriptions.Item>
            <Descriptions.Item label={t('pages.system.equipment.columnName')}>{equipment.name}</Descriptions.Item>
            <Descriptions.Item label={t('pages.system.equipment.columnStatus')}>
              <Tag color={equipment.status === '正常' ? 'success' : 'warning'}>
                {equipmentStatusTextKey[equipment.status] ? t(equipmentStatusTextKey[equipment.status]) : equipment.status}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label={t('pages.system.equipment.columnType')}>{equipment.type || '-'}</Descriptions.Item>
            <Descriptions.Item label={t('pages.system.equipment.columnCategory')}>{equipment.category || '-'}</Descriptions.Item>
            <Descriptions.Item label={t('pages.system.equipment.columnBrand')}>{equipment.brand || '-'}</Descriptions.Item>
          </Descriptions>
        </Card>

        {/* 追溯信息标签页 */}
        <Card>
          <Tabs
            defaultActiveKey="maintenance-plans"
            items={[
              {
                key: 'maintenance-plans',
                label: t('pages.system.equipmentTrace.tabWithCount', { label: t('pages.system.equipmentTrace.tabMaintenancePlans'), count: traceData.maintenance_plans.length }),
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
                label: t('pages.system.equipmentTrace.tabWithCount', { label: t('pages.system.equipmentTrace.tabMaintenanceExecutions'), count: traceData.maintenance_executions.length }),
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
                label: t('pages.system.equipmentTrace.tabWithCount', { label: t('pages.system.equipmentTrace.tabFaults'), count: traceData.equipment_faults.length }),
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
                label: t('pages.system.equipmentTrace.tabWithCount', { label: t('pages.system.equipmentTrace.tabRepairs'), count: traceData.equipment_repairs.length }),
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
                label: t('pages.system.equipmentTrace.tabWithCount', { label: t('pages.system.equipmentTrace.tabUsageHistory'), count: traceData.usage_history.length }),
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
                      <div>{t('pages.system.equipmentTrace.noUsageHistory')}</div>
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

