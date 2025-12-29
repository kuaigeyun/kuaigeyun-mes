/**
 * 销售出库页面
 *
 * 提供MTS模式销售出库管理功能，支持订单关联和库存自动扣减。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProFormText, ProFormDigit, ProFormSelect, ProFormTextArea, ProFormDatePicker } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Modal, Form, Card, Row, Col, Statistic } from 'antd';
import { PlusOutlined, CheckCircleOutlined, TruckOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';

interface SalesOutbound {
  id: number;
  outboundCode: string;
  orderType: 'MTO' | 'MTS'; // 添加订单类型
  salesOrderCode?: string; // MTO模式下的销售订单号
  salesOrderName?: string; // MTO模式下的销售订单名称
  customerName: string;
  productCode: string;
  productName: string;
  quantity: number;
  unit: string;
  warehouseName: string;
  storageAreaName?: string;
  storageLocationName?: string;
  batchNo: string;
  outboundDate: string;
  operatorName: string;
  logisticsInfo?: string;
  remarks?: string;
  status: 'draft' | 'confirmed' | 'shipped' | 'cancelled';
}

const SalesOutboundPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // 出库Modal状态
  const [outboundModalVisible, setOutboundModalVisible] = useState(false);
  const [outboundForm] = Form.useForm();

  // 统计数据状态
  const [stats, setStats] = useState({
    todayOutbound: 0,
    totalOutbound: 0,
    pendingCount: 0,
    shippedCount: 0,
  });

  /**
   * 处理新增出库
   */
  const handleCreateOutbound = () => {
    setOutboundModalVisible(true);
    outboundForm.resetFields();
  };

  /**
   * 处理出库确认
   */
  const handleConfirmOutbound = async (record: SalesOutbound) => {
    Modal.confirm({
      title: '确认出库',
      content: `确定要确认出库单 ${record.outboundCode} 吗？确认后将扣减库存。`,
      onOk: async () => {
        messageApi.success('出库确认成功，库存已扣减');
        actionRef.current?.reload();
      },
    });
  };

  /**
   * 处理发货确认
   */
  const handleShipOutbound = async (record: SalesOutbound) => {
    Modal.confirm({
      title: '确认发货',
      content: `确定要标记出库单 ${record.outboundCode} 为已发货吗？`,
      onOk: async () => {
        messageApi.success('发货确认成功');
        actionRef.current?.reload();
      },
    });
  };

  /**
   * 处理出库单提交
   */
  const handleOutboundSubmit = async (values: any) => {
    try {
      // 模拟API调用
      await new Promise(resolve => setTimeout(resolve, 1000));
      messageApi.success('销售出库单创建成功');
      setOutboundModalVisible(false);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '创建失败');
    }
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<SalesOutbound>[] = [
    {
      title: '出库单号',
      dataIndex: 'outboundCode',
      width: 140,
      ellipsis: true,
    },
    {
      title: '订单类型',
      dataIndex: 'orderType',
      width: 100,
      render: (text) => (
        <Tag color={text === 'MTO' ? 'blue' : 'green'}>
          {text === 'MTO' ? '按订单生产' : '按库存生产'}
        </Tag>
      ),
    },
    {
      title: '销售订单',
      dataIndex: 'salesOrderCode',
      width: 120,
      render: (text, record) => (
        record.orderType === 'MTO' ? (
          <Tag color="blue">{text}</Tag>
        ) : (
          <span style={{ color: '#999' }}>无</span>
        )
      ),
    },
    {
      title: '客户名称',
      dataIndex: 'customerName',
      width: 120,
      ellipsis: true,
    },
    {
      title: '产品名称',
      dataIndex: 'productName',
      width: 120,
      ellipsis: true,
    },
    {
      title: '出库数量',
      dataIndex: 'quantity',
      width: 100,
      align: 'right',
    },
    {
      title: '单位',
      dataIndex: 'unit',
      width: 60,
      align: 'center',
    },
    {
      title: '仓库',
      dataIndex: 'warehouseName',
      width: 100,
    },
    {
      title: '批次号',
      dataIndex: 'batchNo',
      width: 100,
    },
    {
      title: '出库日期',
      dataIndex: 'outboundDate',
      width: 140,
      valueType: 'dateTime',
      hideInSearch: true,
    },
    {
      title: '物流信息',
      dataIndex: 'logisticsInfo',
      width: 120,
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 80,
      valueEnum: {
        draft: { text: '草稿', status: 'default' },
        confirmed: { text: '已确认', status: 'processing' },
        shipped: { text: '已发货', status: 'success' },
        cancelled: { text: '已取消', status: 'error' },
      },
    },
    {
      title: '操作',
      valueType: 'option',
      width: 150,
      render: (_, record) => [
        record.status === 'draft' && (
          <Button
            key="confirm"
            type="link"
            size="small"
            icon={<CheckCircleOutlined />}
            onClick={() => handleConfirmOutbound(record)}
            style={{ color: '#52c41a' }}
          >
            确认
          </Button>
        ),
        record.status === 'confirmed' && (
          <Button
            key="ship"
            type="link"
            size="small"
            icon={<TruckOutlined />}
            onClick={() => handleShipOutbound(record)}
            style={{ color: '#1890ff' }}
          >
            发货
          </Button>
        ),
        (record.status === 'confirmed' || record.status === 'shipped') && (
          <Button
            key="detail"
            type="link"
            size="small"
            onClick={() => messageApi.info('查看详情功能开发中')}
          >
            详情
          </Button>
        ),
      ],
    },
  ];

  return (
    <>
      {/* 统计卡片 */}
      <div style={{ padding: '16px 16px 0 16px' }}>
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <Card>
              <Statistic
                title="今日出库"
                value={stats.todayOutbound}
                prefix={<TruckOutlined />}
                suffix="件"
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="累计出库"
                value={stats.totalOutbound}
                prefix={<CheckCircleOutlined />}
                suffix="件"
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="待确认"
                value={stats.pendingCount}
                prefix={<ExclamationCircleOutlined />}
                suffix="单"
                valueStyle={{ color: '#faad14' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="已发货"
                value={stats.shippedCount}
                prefix={<TruckOutlined />}
                suffix="单"
                valueStyle={{ color: '#722ed1' }}
              />
            </Card>
          </Col>
        </Row>
      </div>

      {/* 销售出库表格 */}
      <UniTable
        headerTitle="销售出库管理"
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        showAdvancedSearch={true}
        request={async (params) => {
          // 模拟数据
          const mockData: SalesOutbound[] = [
            {
              id: 1,
              outboundCode: 'OUT20241201001',
              orderType: 'MTO',
              salesOrderCode: 'SO20241201001',
              salesOrderName: '客户A订单',
              customerName: '客户A',
              productCode: 'FIN001',
              productName: '产品A',
              quantity: 100,
              unit: '个',
              warehouseName: '成品仓库',
              storageAreaName: 'A区',
              storageLocationName: 'A01',
              batchNo: 'BATCH001',
              outboundDate: '2024-12-01 10:30:00',
              operatorName: '张三',
              logisticsInfo: '顺丰快递 SF123456789',
              status: 'shipped',
            },
            {
              id: 2,
              outboundCode: 'OUT20241201002',
              orderType: 'MTS',
              customerName: '客户B',
              productCode: 'FIN002',
              productName: '产品B',
              quantity: 50,
              unit: '个',
              warehouseName: '成品仓库',
              storageAreaName: 'B区',
              storageLocationName: 'B01',
              batchNo: 'BATCH002',
              outboundDate: '2024-12-01 14:20:00',
              operatorName: '李四',
              status: 'confirmed',
              remarks: '等待安排发货',
            },
            {
              id: 3,
              outboundCode: 'OUT20241201003',
              salesOrderCode: 'SO20241201003',
              salesOrderName: '客户C订单',
              customerName: '客户C',
              productCode: 'FIN001',
              productName: '产品A',
              quantity: 80,
              unit: '个',
              warehouseName: '成品仓库',
              storageAreaName: 'A区',
              storageLocationName: 'A02',
              batchNo: 'BATCH003',
              outboundDate: '2024-12-01 16:45:00',
              operatorName: '王五',
              status: 'draft',
              remarks: '新创建的出库单',
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
            onClick={handleCreateOutbound}
          >
            新增出库
          </Button>,
        ]}
        search={{
          labelWidth: 'auto',
        }}
      />

      {/* 新增出库 Modal */}
      <Modal
        title="新增销售出库"
        open={outboundModalVisible}
        onCancel={() => setOutboundModalVisible(false)}
        onOk={() => outboundForm.submit()}
        width={800}
        destroyOnClose
      >
        <ProForm
          form={outboundForm}
          onFinish={handleOutboundSubmit}
          layout="vertical"
          submitter={false}
          initialValues={{
            outboundDate: new Date().toISOString().split('T')[0],
          }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <ProFormText
                name="outboundCode"
                label="出库单号"
                placeholder="系统自动生成"
                disabled
                initialValue="OUT20241201004"
              />
            </Col>
            <Col span={12}>
              <ProFormSelect
                name="orderType"
                label="出库类型"
                placeholder="请选择出库类型"
                rules={[{ required: true, message: '请选择出库类型' }]}
                options={[
                  { label: '按订单生产 (MTO)', value: 'MTO' },
                  { label: '按库存生产 (MTS)', value: 'MTS' },
                ]}
                initialValue="MTS"
              />
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <ProFormSelect
                name="salesOrderCode"
                label="销售订单"
                placeholder="请选择销售订单"
                dependencies={['orderType']}
                rules={[
                  ({ getFieldValue }) => ({
                    required: getFieldValue('orderType') === 'MTO',
                    message: 'MTO模式必须选择销售订单',
                  }),
                ]}
                request={async () => [
                  { label: 'SO20241201001 - 客户A订单 (MTO)', value: 'SO20241201001' },
                  { label: 'SO20241201002 - 客户B订单 (MTO)', value: 'SO20241201002' },
                  { label: 'SO20241201003 - 客户C订单 (MTO)', value: 'SO20241201003' },
                ]}
                hidden={({ orderType }) => orderType !== 'MTO'}
              />
            </Col>
            <Col span={12}>
              <ProFormSelect
                name="customerName"
                label="客户"
                placeholder="请选择客户"
                rules={[{ required: true, message: '请选择客户' }]}
                request={async () => [
                  { label: '客户A', value: '客户A' },
                  { label: '客户B', value: '客户B' },
                  { label: '客户C', value: '客户C' },
                ]}
              />
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <ProFormSelect
                name="customerName"
                label="客户"
                placeholder="请选择客户"
                rules={[{ required: true, message: '请选择客户' }]}
                request={async () => [
                  { label: '客户A', value: '客户A' },
                  { label: '客户B', value: '客户B' },
                  { label: '客户C', value: '客户C' },
                ]}
              />
            </Col>
            <Col span={12}>
              <ProFormSelect
                name="productCode"
                label="产品"
                placeholder="请选择产品"
                rules={[{ required: true, message: '请选择产品' }]}
                request={async () => [
                  { label: 'FIN001 - 产品A', value: 'FIN001' },
                  { label: 'FIN002 - 产品B', value: 'FIN002' },
                ]}
              />
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <ProFormDigit
                name="quantity"
                label="出库数量"
                placeholder="请输入出库数量"
                rules={[{ required: true, message: '请输入出库数量' }]}
                min={1}
              />
            </Col>
            <Col span={8}>
              <ProFormSelect
                name="warehouseName"
                label="仓库"
                placeholder="请选择仓库"
                rules={[{ required: true, message: '请选择仓库' }]}
                request={async () => [
                  { label: '成品仓库', value: '成品仓库' },
                ]}
              />
            </Col>
            <Col span={8}>
              <ProFormText
                name="batchNo"
                label="批次号"
                placeholder="请输入批次号"
                rules={[{ required: true, message: '请输入批次号' }]}
              />
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <ProFormDatePicker
                name="outboundDate"
                label="出库日期"
                placeholder="请选择出库日期"
                rules={[{ required: true, message: '请选择出库日期' }]}
              />
            </Col>
            <Col span={12}>
              <ProFormText
                name="operatorName"
                label="操作员"
                placeholder="请输入操作员姓名"
                rules={[{ required: true, message: '请输入操作员姓名' }]}
              />
            </Col>
          </Row>

          <ProFormTextArea
            name="logisticsInfo"
            label="物流信息"
            placeholder="请输入物流信息（如快递单号等）"
            rows={2}
          />

          <ProFormTextArea
            name="remarks"
            label="备注"
            placeholder="请输入备注信息"
            rows={2}
          />
        </ProForm>
      </Modal>
    </>
  );
};

export default SalesOutboundPage;
