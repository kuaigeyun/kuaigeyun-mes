/**
 * 产品入库页面
 *
 * 提供完成品入库管理功能，支持工单关联和库存自动更新。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProFormText, ProFormDigit, ProFormSelect, ProFormTextArea, ProFormDatePicker } from '@ant-design/pro-components';
import { App, Button, Modal } from 'antd';
import { PlusOutlined, CheckCircleOutlined, ClockCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';

interface FinishedGoodsInbound {
  id: number;
  inboundCode: string;
  workOrderCode: string;
  workOrderName: string;
  productCode: string;
  productName: string;
  quantity: number;
  unit: string;
  warehouseName: string;
  storageAreaName?: string;
  storageLocationName?: string;
  batchNo: string;
  qualityStatus: 'qualified' | 'unqualified' | 'pending';
  inboundDate: string;
  operatorName: string;
  remarks?: string;
  status: 'draft' | 'confirmed' | 'cancelled';
}

const FinishedGoodsInboundPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // 入库Modal状态
  const [inboundModalVisible, setInboundModalVisible] = useState(false);
  const formRef = useRef<any>(null);

  // 统计数据状态
  const [stats] = useState({
    todayInbound: 0,
    totalInbound: 0,
    pendingCount: 0,
    qualifiedRate: 0,
  });

  /**
   * 处理新增入库
   */
  const handleCreateInbound = () => {
    setInboundModalVisible(true);
    formRef.current?.resetFields();
  };

  /**
   * 处理入库确认
   */
  const handleConfirmInbound = async (record: FinishedGoodsInbound) => {
    Modal.confirm({
      title: '确认入库',
      content: `确定要确认入库单 ${record.inboundCode} 吗？确认后将更新库存。`,
      onOk: async () => {
        messageApi.success('入库确认成功，库存已更新');
        actionRef.current?.reload();
      },
    });
  };

  /**
   * 处理入库单提交
   */
  const handleInboundSubmit = async (_values: any) => {
    try {
      // 模拟API调用
      await new Promise(resolve => setTimeout(resolve, 1000));
      messageApi.success('产品入库单创建成功');
      setInboundModalVisible(false);
      formRef.current?.resetFields();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '创建失败');
      throw error;
    }
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<FinishedGoodsInbound>[] = [
    {
      title: '入库单号',
      dataIndex: 'inboundCode',
      width: 140,
      ellipsis: true,
    },
    {
      title: '工单编号',
      dataIndex: 'workOrderCode',
      width: 120,
    },
    {
      title: '产品名称',
      dataIndex: 'productName',
      width: 120,
      ellipsis: true,
    },
    {
      title: '入库数量',
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
      title: '质量状态',
      dataIndex: 'qualityStatus',
      width: 100,
      valueEnum: {
        qualified: { text: '合格', status: 'success' },
        unqualified: { text: '不合格', status: 'error' },
        pending: { text: '待检', status: 'warning' },
      },
    },
    {
      title: '入库日期',
      dataIndex: 'inboundDate',
      width: 140,
      valueType: 'dateTime',
      hideInSearch: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 80,
      valueEnum: {
        draft: { text: '草稿', status: 'default' },
        confirmed: { text: '已确认', status: 'success' },
        cancelled: { text: '已取消', status: 'error' },
      },
    },
    {
      title: '操作',
      valueType: 'option',
      width: 120,
      render: (_, record) => [
        record.status === 'draft' && (
          <Button
            key="confirm"
            type="link"
            size="small"
            icon={<CheckCircleOutlined />}
            onClick={() => handleConfirmInbound(record)}
            style={{ color: '#52c41a' }}
          >
            确认
          </Button>
        ),
        record.status === 'confirmed' && (
          <Button
            key="view"
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
    <ListPageTemplate
      statCards={[
        {
          title: '今日入库',
          value: stats.todayInbound,
          prefix: <ClockCircleOutlined />,
          suffix: '件',
          valueStyle: { color: '#1890ff' },
        },
        {
          title: '累计入库',
          value: stats.totalInbound,
          prefix: <CheckCircleOutlined />,
          suffix: '件',
          valueStyle: { color: '#52c41a' },
        },
        {
          title: '待确认',
          value: stats.pendingCount,
          prefix: <ExclamationCircleOutlined />,
          suffix: '单',
          valueStyle: { color: '#faad14' },
        },
        {
          title: '合格率',
          value: stats.qualifiedRate,
          prefix: <CheckCircleOutlined />,
          suffix: '%',
          precision: 1,
          valueStyle: { color: '#722ed1' },
        },
      ]}
    >
      <UniTable
        headerTitle="产品入库"
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        showAdvancedSearch={true}
        request={async (_params: any) => {
          // 模拟数据
          const mockData: FinishedGoodsInbound[] = [
            {
              id: 1,
              inboundCode: 'IN20241201001',
              workOrderCode: 'WO20241201001',
              workOrderName: '产品A生产工单',
              productCode: 'FIN001',
              productName: '产品A',
              quantity: 100,
              unit: '个',
              warehouseName: '成品仓库',
              storageAreaName: 'A区',
              storageLocationName: 'A01',
              batchNo: 'BATCH001',
              qualityStatus: 'qualified',
              inboundDate: '2024-12-01 10:30:00',
              operatorName: '张三',
              status: 'confirmed',
            },
            {
              id: 2,
              inboundCode: 'IN20241201002',
              workOrderCode: 'WO20241201002',
              workOrderName: '产品B定制工单',
              productCode: 'FIN002',
              productName: '产品B',
              quantity: 50,
              unit: '个',
              warehouseName: '成品仓库',
              storageAreaName: 'B区',
              storageLocationName: 'B01',
              batchNo: 'BATCH002',
              qualityStatus: 'pending',
              inboundDate: '2024-12-01 14:20:00',
              operatorName: '李四',
              status: 'draft',
              remarks: '等待质量检验',
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
            onClick={handleCreateInbound}
          >
            新增入库
          </Button>,
        ]}
        search={{
          labelWidth: 'auto',
        }}
      />

      <FormModalTemplate
        title="新增产品入库"
        open={inboundModalVisible}
        onClose={() => setInboundModalVisible(false)}
        onFinish={handleInboundSubmit}
        isEdit={false}
        initialValues={{
          qualityStatus: 'qualified',
          inboundDate: new Date().toISOString().split('T')[0],
          inboundCode: 'IN20241201003',
        }}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        formRef={formRef}
        grid={true}
      >
        <ProFormText
          name="inboundCode"
          label="入库单号"
          placeholder="系统自动生成"
          disabled
          colProps={{ span: 12 }}
        />
        <ProFormSelect
          name="workOrderCode"
          label="关联工单"
          placeholder="请选择工单"
          rules={[{ required: true, message: '请选择关联工单' }]}
          request={async () => [
            { label: 'WO20241201001 - 产品A生产工单', value: 'WO20241201001' },
            { label: 'WO20241201002 - 产品B定制工单', value: 'WO20241201002' },
          ]}
          colProps={{ span: 12 }}
        />
        <ProFormSelect
          name="productCode"
          label="产品"
          placeholder="请选择产品"
          rules={[{ required: true, message: '请选择产品' }]}
          request={async () => [
            { label: 'FIN001 - 产品A', value: 'FIN001' },
            { label: 'FIN002 - 产品B', value: 'FIN002' },
          ]}
          colProps={{ span: 12 }}
        />
        <ProFormDigit
          name="quantity"
          label="入库数量"
          placeholder="请输入入库数量"
          rules={[{ required: true, message: '请输入入库数量' }]}
          min={1}
          colProps={{ span: 12 }}
        />
        <ProFormSelect
          name="warehouseName"
          label="仓库"
          placeholder="请选择仓库"
          rules={[{ required: true, message: '请选择仓库' }]}
          request={async () => [
            { label: '成品仓库', value: '成品仓库' },
            { label: '半成品仓库', value: '半成品仓库' },
          ]}
          colProps={{ span: 8 }}
        />
        <ProFormText
          name="batchNo"
          label="批次号"
          placeholder="请输入批次号"
          rules={[{ required: true, message: '请输入批次号' }]}
          colProps={{ span: 8 }}
        />
        <ProFormSelect
          name="qualityStatus"
          label="质量状态"
          placeholder="请选择质量状态"
          rules={[{ required: true, message: '请选择质量状态' }]}
          valueEnum={{
            qualified: '合格',
            unqualified: '不合格',
            pending: '待检',
          }}
          colProps={{ span: 8 }}
        />
        <ProFormDatePicker
          name="inboundDate"
          label="入库日期"
          placeholder="请选择入库日期"
          rules={[{ required: true, message: '请选择入库日期' }]}
          colProps={{ span: 12 }}
        />
        <ProFormText
          name="operatorName"
          label="操作员"
          placeholder="请输入操作员姓名"
          rules={[{ required: true, message: '请输入操作员姓名' }]}
          colProps={{ span: 12 }}
        />
        <ProFormTextArea
          name="remarks"
          label="备注"
          placeholder="请输入备注信息"
          fieldProps={{ rows: 3 }}
          colProps={{ span: 24 }}
        />
      </FormModalTemplate>
    </ListPageTemplate>
  );
};

export default FinishedGoodsInboundPage;
