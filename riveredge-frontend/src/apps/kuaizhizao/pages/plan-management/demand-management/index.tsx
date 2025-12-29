/**
 * 需求管理页面
 *
 * 提供销售预测的管理功能，支持MTS/MTO两种模式的需求预测。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProFormSelect, ProFormText, ProFormDatePicker } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Modal, Drawer, message, Form, Table, Input, Select } from 'antd';
import { PlusOutlined, EyeOutlined, EditOutlined, CalculatorOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';

interface DemandForecast {
  id: number;
  code: string;
  name: string;
  productCode: string;
  productName: string;
  mode: 'MTS' | 'MTO';
  forecastPeriod: string; // 预测周期，如 "2026-01"
  forecastQuantity: number;
  unit: string;
  status: 'draft' | 'active' | 'completed' | 'cancelled';
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

const DemandManagementPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // Modal 相关状态（创建/编辑销售预测）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentForecast, setCurrentForecast] = useState<DemandForecast | null>(null);

  // Drawer 相关状态（详情查看）
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);

  /**
   * 处理创建销售预测
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentForecast(null);
    setModalVisible(true);
  };

  /**
   * 处理编辑销售预测
   */
  const handleEdit = (record: DemandForecast) => {
    setIsEdit(true);
    setCurrentForecast(record);
    setModalVisible(true);
  };

  /**
   * 处理查看详情
   */
  const handleDetail = (record: DemandForecast) => {
    setCurrentForecast(record);
    setDetailDrawerVisible(true);
  };

  /**
   * 处理激活预测
   */
  const handleActivate = (record: DemandForecast) => {
    Modal.confirm({
      title: '激活销售预测',
      content: `确定要激活销售预测 "${record.name}" 吗？激活后将用于MRP运算。`,
      onOk: async () => {
        messageApi.success('销售预测激活成功');
        actionRef.current?.reload();
      },
    });
  };

  /**
   * 处理运行MRP
   */
  const handleRunMRP = (record: DemandForecast) => {
    Modal.confirm({
      title: '运行MRP运算',
      content: `确定要基于销售预测 "${record.name}" 运行MRP运算吗？`,
      onOk: async () => {
        messageApi.success('MRP运算已启动，请稍后查看结果');
      },
    });
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<DemandForecast>[] = [
    {
      title: '预测编号',
      dataIndex: 'code',
      width: 140,
      ellipsis: true,
      fixed: 'left',
    },
    {
      title: '预测名称',
      dataIndex: 'name',
      width: 150,
      ellipsis: true,
    },
    {
      title: '产品编码',
      dataIndex: 'productCode',
      width: 120,
      ellipsis: true,
    },
    {
      title: '产品名称',
      dataIndex: 'productName',
      width: 150,
      ellipsis: true,
    },
    {
      title: '生产模式',
      dataIndex: 'mode',
      width: 100,
      valueEnum: {
        MTS: { text: '按库存生产', status: 'processing' },
        MTO: { text: '按订单生产', status: 'success' },
      },
    },
    {
      title: '预测周期',
      dataIndex: 'forecastPeriod',
      width: 100,
      align: 'center',
    },
    {
      title: '预测数量',
      dataIndex: 'forecastQuantity',
      width: 100,
      align: 'right',
    },
    {
      title: '单位',
      dataIndex: 'unit',
      width: 80,
      align: 'center',
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueEnum: {
        draft: { text: '草稿', status: 'default' },
        active: { text: '激活', status: 'processing' },
        completed: { text: '完成', status: 'success' },
        cancelled: { text: '取消', status: 'error' },
      },
    },
    {
      title: '创建人',
      dataIndex: 'createdBy',
      width: 100,
      ellipsis: true,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      valueType: 'dateTime',
      width: 160,
    },
    {
      title: '操作',
      width: 180,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleDetail(record)}
          >
            详情
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          {record.status === 'draft' && (
            <Button
              type="link"
              size="small"
              onClick={() => handleActivate(record)}
              style={{ color: '#52c41a' }}
            >
              激活
            </Button>
          )}
          {record.status === 'active' && record.mode === 'MTS' && (
            <Button
              type="link"
              size="small"
              icon={<CalculatorOutlined />}
              onClick={() => handleRunMRP(record)}
              style={{ color: '#1890ff' }}
            >
              运行MRP
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <>
      <UniTable
        headerTitle="需求管理 - 销售预测"
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        request={async (params) => {
          // 模拟数据
          const mockData: DemandForecast[] = [
            {
              id: 1,
              code: 'FC202601001',
              name: '产品A 1月份销售预测',
              productCode: 'FIN001',
              productName: '产品A',
              mode: 'MTS',
              forecastPeriod: '2026-01',
              forecastQuantity: 100,
              unit: '个',
              status: 'active',
              createdBy: '张三',
              createdAt: '2024-12-01 09:00:00',
              updatedAt: '2024-12-01 09:00:00',
            },
            {
              id: 2,
              code: 'FC202602001',
              name: '产品B 2月份销售预测',
              productCode: 'FIN002',
              productName: '产品B',
              mode: 'MTS',
              forecastPeriod: '2026-02',
              forecastQuantity: 60,
              unit: '个',
              status: 'draft',
              createdBy: '李四',
              createdAt: '2024-12-01 10:30:00',
              updatedAt: '2024-12-01 10:30:00',
            },
            {
              id: 3,
              code: 'FC202601002',
              name: '定制产品C 订单预测',
              productCode: 'FIN001',
              productName: '产品A',
              mode: 'MTO',
              forecastPeriod: '2026-01',
              forecastQuantity: 50,
              unit: '个',
              status: 'active',
              createdBy: '王五',
              createdAt: '2024-12-01 11:00:00',
              updatedAt: '2024-12-01 11:00:00',
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
            key="create"
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreate}
          >
            新建销售预测
          </Button>,
        ]}
      />

      {/* 创建/编辑销售预测 Modal */}
      <Modal
        title={isEdit ? '编辑销售预测' : '新建销售预测'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => {
          messageApi.success(isEdit ? '销售预测更新成功' : '销售预测创建成功');
          setModalVisible(false);
          actionRef.current?.reload();
        }}
        width={800}
      >
        <Form layout="vertical" style={{ padding: '16px 0' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <Form.Item
              label="预测名称"
              required
            >
              <Input placeholder="请输入预测名称" />
            </Form.Item>

            <Form.Item
              label="生产模式"
              required
            >
              <Select defaultValue="MTS">
                <Select.Option value="MTS">按库存生产 (MTS)</Select.Option>
                <Select.Option value="MTO">按订单生产 (MTO)</Select.Option>
              </Select>
            </Form.Item>

            <Form.Item
              label="产品"
              required
            >
              <Select placeholder="选择产品">
                <Select.Option value="FIN001">产品A</Select.Option>
                <Select.Option value="FIN002">产品B</Select.Option>
              </Select>
            </Form.Item>

            <Form.Item
              label="预测周期"
              required
            >
              <Input placeholder="例如：2026-01" />
            </Form.Item>

            <Form.Item
              label="预测数量"
              required
            >
              <Input type="number" placeholder="请输入预测数量" />
            </Form.Item>

            <Form.Item
              label="单位"
              required
            >
              <Input placeholder="例如：个、kg" defaultValue="个" />
            </Form.Item>
          </div>

          <Form.Item
            label="备注"
          >
            <Input.TextArea rows={3} placeholder="请输入备注信息" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 销售预测详情 Drawer */}
      <Drawer
        title="销售预测详情"
        size="large"
        open={detailDrawerVisible}
        onClose={() => setDetailDrawerVisible(false)}
      >
        {currentForecast && (
          <div style={{ padding: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
              <div><strong>预测编号：</strong>{currentForecast.code}</div>
              <div><strong>预测名称：</strong>{currentForecast.name}</div>
              <div><strong>产品编码：</strong>{currentForecast.productCode}</div>
              <div><strong>产品名称：</strong>{currentForecast.productName}</div>
              <div><strong>生产模式：</strong>
                <Tag color={currentForecast.mode === 'MTS' ? 'processing' : 'success'}>
                  {currentForecast.mode === 'MTS' ? '按库存生产' : '按订单生产'}
                </Tag>
              </div>
              <div><strong>预测周期：</strong>{currentForecast.forecastPeriod}</div>
              <div><strong>预测数量：</strong>{currentForecast.forecastQuantity} {currentForecast.unit}</div>
              <div><strong>状态：</strong>
                <Tag color={
                  currentForecast.status === 'active' ? 'processing' :
                  currentForecast.status === 'completed' ? 'success' :
                  currentForecast.status === 'cancelled' ? 'error' : 'default'
                }>
                  {currentForecast.status === 'draft' ? '草稿' :
                   currentForecast.status === 'active' ? '激活' :
                   currentForecast.status === 'completed' ? '完成' : '取消'}
                </Tag>
              </div>
              <div><strong>创建人：</strong>{currentForecast.createdBy}</div>
              <div><strong>创建时间：</strong>{currentForecast.createdAt}</div>
              <div><strong>更新时间：</strong>{currentForecast.updatedAt}</div>
            </div>

            {/* 预测历史表格 */}
            <div>
              <h4>预测历史</h4>
              <Table
                size="small"
                columns={[
                  { title: '周期', dataIndex: 'period', width: 100 },
                  { title: '预测数量', dataIndex: 'quantity', width: 120, align: 'right' },
                  { title: '实际销量', dataIndex: 'actual', width: 120, align: 'right' },
                  { title: '准确率', dataIndex: 'accuracy', width: 100, align: 'right' },
                ]}
                dataSource={[
                  { period: '2025-12', quantity: 80, actual: 75, accuracy: '93.8%' },
                  { period: '2025-11', quantity: 70, actual: 68, accuracy: '97.1%' },
                  { period: '2025-10', quantity: 65, actual: 62, accuracy: '95.4%' },
                ]}
                pagination={false}
                bordered
              />
            </div>
          </div>
        )}
      </Drawer>
    </>
  );
};

export default DemandManagementPage;
