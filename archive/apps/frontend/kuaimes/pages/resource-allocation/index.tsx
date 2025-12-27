/**
 * 人机料法资源分配管理页面
 *
 * 提供人机料法资源分配的管理功能
 */

import React, { useRef, useState } from 'react';
import { PageContainer } from '@ant-design/pro-components';
import { Card, Row, Col, Statistic, Button, Modal, Form, Select, message, Table, Tag, Space, Descriptions } from 'antd';
import { App } from 'antd';
import { PlusOutlined, UserOutlined, SettingOutlined, DatabaseOutlined, FileTextOutlined } from '@ant-design/icons';
import { resourceAllocationApi } from '../../services/process';
import type { WorkOrder } from '../../types/process';

const { Option } = Select;

interface ResourceAllocation {
  personnel: {
    operator_id: number | null;
    operator_name: string | null;
  };
  equipment: {
    equipment_id: number | null;
    equipment_name: string | null;
    equipment_code: string | null;
  };
  materials: {
    materials: any[] | null;
    material_requirements: string | null;
  };
  method: {
    process_method: string | null;
    quality_requirements: string | null;
    route_id: number | null;
    route_name: string | null;
  };
}

const ResourceAllocationPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const [allocationModalVisible, setAllocationModalVisible] = useState(false);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrder | null>(null);
  const [resourceAllocation, setResourceAllocation] = useState<ResourceAllocation | null>(null);
  const [allocationType, setAllocationType] = useState<'equipment' | 'operator' | 'materials' | 'method'>('equipment');

  // 模拟工单数据
  const mockWorkOrders: WorkOrder[] = [
    {
      id: 1,
      uuid: 'wo-001',
      work_order_no: 'WO20241217001',
      product_name: '测试产品A',
      quantity: 100,
      completed_quantity: 0,
      status: '已下发',
      operator_name: null,
      equipment_name: null,
    },
    {
      id: 2,
      uuid: 'wo-002',
      work_order_no: 'WO20241217002',
      product_name: '测试产品B',
      quantity: 50,
      completed_quantity: 0,
      status: '执行中',
      operator_name: '张三',
      equipment_name: 'CNC机床001',
    }
  ];

  const [workOrders] = useState<WorkOrder[]>(mockWorkOrders);

  const handleViewAllocation = async (workOrder: WorkOrder) => {
    try {
      const result = await resourceAllocationApi.getWorkOrderResourceAllocation(workOrder.uuid);
      setResourceAllocation(result.resource_allocation);
      setSelectedWorkOrder(workOrder);
      setAllocationModalVisible(true);
    } catch (error: any) {
      messageApi.error(error.message || '获取资源分配信息失败');
    }
  };

  const handleAllocateResource = (workOrder: WorkOrder, type: 'equipment' | 'operator' | 'materials' | 'method') => {
    setSelectedWorkOrder(workOrder);
    setAllocationType(type);
    setAllocationModalVisible(true);
  };

  const workOrderColumns = [
    {
      title: '工单编号',
      dataIndex: 'work_order_no',
      key: 'work_order_no',
    },
    {
      title: '产品名称',
      dataIndex: 'product_name',
      key: 'product_name',
    },
    {
      title: '计划数量',
      dataIndex: 'quantity',
      key: 'quantity',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const colorMap: Record<string, string> = {
          '草稿': 'default',
          '已下发': 'blue',
          '执行中': 'purple',
          '已完成': 'green',
          '已取消': 'red',
        };
        return <Tag color={colorMap[status] || 'default'}>{status}</Tag>;
      },
    },
    {
      title: '操作员',
      dataIndex: 'operator_name',
      key: 'operator_name',
      render: (operator_name: string | null) => operator_name || '未分配',
    },
    {
      title: '设备',
      dataIndex: 'equipment_name',
      key: 'equipment_name',
      render: (equipment_name: string | null) => equipment_name || '未分配',
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: WorkOrder) => (
        <Space>
          <Button
            type="link"
            size="small"
            onClick={() => handleViewAllocation(record)}
          >
            查看分配
          </Button>
          <Button
            type="link"
            size="small"
            icon={<UserOutlined />}
            onClick={() => handleAllocateResource(record, 'operator')}
          >
            分配人员
          </Button>
          <Button
            type="link"
            size="small"
            icon={<SettingOutlined />}
            onClick={() => handleAllocateResource(record, 'equipment')}
          >
            分配设备
          </Button>
          <Button
            type="link"
            size="small"
            icon={<DatabaseOutlined />}
            onClick={() => handleAllocateResource(record, 'materials')}
          >
            设置材料
          </Button>
          <Button
            type="link"
            size="small"
            icon={<FileTextOutlined />}
            onClick={() => handleAllocateResource(record, 'method')}
          >
            设置工艺
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <PageContainer
      title="人机料法资源分配管理"
      subTitle="统一管理生产要素的分配和调度"
    >
      {/* 统计卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="总工单数"
              value={workOrders.length}
              prefix={<FileTextOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="已分配人员"
              value={workOrders.filter(wo => wo.operator_name).length}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="已分配设备"
              value={workOrders.filter(wo => wo.equipment_name).length}
              prefix={<SettingOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="资源利用率"
              value={85}
              suffix="%"
              prefix={<DatabaseOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 工单列表 */}
      <Card title="工单资源分配" bordered={false}>
        <Table
          columns={workOrderColumns}
          dataSource={workOrders}
          rowKey="uuid"
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
          }}
        />
      </Card>

      {/* 资源分配详情 Modal */}
      <Modal
        title={`工单 ${selectedWorkOrder?.work_order_no} - 资源分配详情`}
        open={allocationModalVisible}
        onCancel={() => setAllocationModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setAllocationModalVisible(false)}>
            关闭
          </Button>
        ]}
        width={800}
      >
        {resourceAllocation && (
          <div>
            <Descriptions title="人员分配（人）" bordered column={2} style={{ marginBottom: 24 }}>
              <Descriptions.Item label="操作员ID">{resourceAllocation.personnel.operator_id || '未分配'}</Descriptions.Item>
              <Descriptions.Item label="操作员姓名">{resourceAllocation.personnel.operator_name || '未分配'}</Descriptions.Item>
            </Descriptions>

            <Descriptions title="设备分配（机）" bordered column={2} style={{ marginBottom: 24 }}>
              <Descriptions.Item label="设备ID">{resourceAllocation.equipment.equipment_id || '未分配'}</Descriptions.Item>
              <Descriptions.Item label="设备名称">{resourceAllocation.equipment.equipment_name || '未分配'}</Descriptions.Item>
              <Descriptions.Item label="设备编码">{resourceAllocation.equipment.equipment_code || '未分配'}</Descriptions.Item>
            </Descriptions>

            <Descriptions title="材料清单（料）" bordered column={1} style={{ marginBottom: 24 }}>
              <Descriptions.Item label="材料需求">
                {resourceAllocation.materials.material_requirements || '暂无说明'}
              </Descriptions.Item>
              <Descriptions.Item label="材料清单">
                {resourceAllocation.materials.materials ?
                  JSON.stringify(resourceAllocation.materials.materials, null, 2) :
                  '暂无材料清单'
                }
              </Descriptions.Item>
            </Descriptions>

            <Descriptions title="工艺方法（法）" bordered column={2}>
              <Descriptions.Item label="工艺路线">{resourceAllocation.method.route_name || '未设置'}</Descriptions.Item>
              <Descriptions.Item label="工艺方法">{resourceAllocation.method.process_method || '未设置'}</Descriptions.Item>
              <Descriptions.Item label="质量要求" span={2}>{resourceAllocation.method.quality_requirements || '未设置'}</Descriptions.Item>
            </Descriptions>
          </div>
        )}
      </Modal>
    </PageContainer>
  );
};

export default ResourceAllocationPage;
