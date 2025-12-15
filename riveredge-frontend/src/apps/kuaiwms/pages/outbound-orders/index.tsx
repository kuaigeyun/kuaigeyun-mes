/**
 * 出库单管理页面
 * 
 * 提供出库单的 CRUD 功能，包括列表展示、创建、编辑、删除、确认出库等操作。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProForm, ProFormText, ProFormSelect, ProFormDatePicker, ProFormInstance, ProDescriptions } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Modal, Drawer, message } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { UniTable } from '@/components/uni_table';
import { outboundOrderApi } from '../../services/process';
import type { OutboundOrder, OutboundOrderCreate, OutboundOrderUpdate } from '../../types/process';

/**
 * 出库单管理列表页面组件
 */
const OutboundOrdersPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentOrderUuid, setCurrentOrderUuid] = useState<string | null>(null);
  const [orderDetail, setOrderDetail] = useState<OutboundOrder | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Modal 相关状态（创建/编辑订单）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  /**
   * 处理新建订单
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentOrderUuid(null);
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      status: '草稿',
    });
  };

  /**
   * 处理编辑订单
   */
  const handleEdit = async (record: OutboundOrder) => {
    try {
      setIsEdit(true);
      setCurrentOrderUuid(record.uuid);
      setModalVisible(true);
      
      const detail = await outboundOrderApi.get(record.uuid);
      formRef.current?.setFieldsValue({
        orderNo: detail.orderNo,
        orderDate: detail.orderDate,
        orderType: detail.orderType,
        warehouseId: detail.warehouseId,
        totalAmount: detail.totalAmount,
        remark: detail.remark,
      });
    } catch (error: any) {
      messageApi.error(error.message || '获取订单详情失败');
    }
  };

  /**
   * 处理删除订单
   */
  const handleDelete = async (record: OutboundOrder) => {
    try {
      await outboundOrderApi.delete(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理打开详情
   */
  const handleOpenDetail = async (record: OutboundOrder) => {
    try {
      setCurrentOrderUuid(record.uuid);
      setDrawerVisible(true);
      setDetailLoading(true);
      
      const detail = await outboundOrderApi.get(record.uuid);
      setOrderDetail(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取订单详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理确认出库
   */
  const handleConfirm = async (record: OutboundOrder) => {
    Modal.confirm({
      title: '确认出库',
      content: `确定要确认出库单 ${record.orderNo} 吗？确认后将更新库存。`,
      onOk: async () => {
        try {
          await outboundOrderApi.confirm(record.uuid);
          messageApi.success('确认出库成功');
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '确认出库失败');
        }
      },
    });
  };

  /**
   * 处理提交表单
   */
  const handleSubmit = async (values: OutboundOrderCreate | OutboundOrderUpdate) => {
    try {
      setFormLoading(true);
      
      if (isEdit && currentOrderUuid) {
        await outboundOrderApi.update(currentOrderUuid, values as OutboundOrderUpdate);
        messageApi.success('更新成功');
      } else {
        await outboundOrderApi.create(values as OutboundOrderCreate);
        messageApi.success('创建成功');
      }
      
      setModalVisible(false);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || (isEdit ? '更新失败' : '创建失败'));
    } finally {
      setFormLoading(false);
    }
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<OutboundOrder>[] = [
    {
      title: '出库单编号',
      dataIndex: 'orderNo',
      width: 150,
      fixed: 'left',
      render: (_, record) => (
        <a onClick={() => handleOpenDetail(record)}>{record.orderNo}</a>
      ),
    },
    {
      title: '出库类型',
      dataIndex: 'orderType',
      width: 120,
      valueType: 'select',
      valueEnum: {
        '销售出库': { text: '销售出库' },
        '生产领料': { text: '生产领料' },
        '调拨出库': { text: '调拨出库' },
        '委外发料': { text: '委外发料' },
        '其他出库': { text: '其他出库' },
      },
    },
    {
      title: '仓库ID',
      dataIndex: 'warehouseId',
      width: 100,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueType: 'select',
      valueEnum: {
        '草稿': { text: <Tag color="default">草稿</Tag> },
        '待拣货': { text: <Tag color="orange">待拣货</Tag> },
        '拣货中': { text: <Tag color="blue">拣货中</Tag> },
        '已拣货': { text: <Tag color="cyan">已拣货</Tag> },
        '执行中': { text: <Tag color="purple">执行中</Tag> },
        '部分出库': { text: <Tag color="orange">部分出库</Tag> },
        '已完成': { text: <Tag color="green">已完成</Tag> },
        '已关闭': { text: <Tag color="default">已关闭</Tag> },
        '已取消': { text: <Tag color="red">已取消</Tag> },
      },
    },
    {
      title: '拣货状态',
      dataIndex: 'pickingStatus',
      width: 100,
      render: (status) => {
        if (!status) return '-';
        const statusMap: Record<string, { color: string; text: string }> = {
          '待拣货': { color: 'orange', text: '待拣货' },
          '拣货中': { color: 'blue', text: '拣货中' },
          '已拣货': { color: 'green', text: '已拣货' },
        };
        const statusInfo = statusMap[status] || { color: 'default', text: status };
        return <Tag color={statusInfo.color}>{statusInfo.text}</Tag>;
      },
    },
    {
      title: '出库金额',
      dataIndex: 'totalAmount',
      width: 120,
      valueType: 'money',
    },
    {
      title: '出库日期',
      dataIndex: 'orderDate',
      width: 150,
      valueType: 'dateTime',
    },
    {
      title: '操作',
      valueType: 'option',
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          {record.status === '已拣货' && (
            <Button
              type="link"
              size="small"
              icon={<CheckCircleOutlined />}
              onClick={() => handleConfirm(record)}
            >
              确认出库
            </Button>
          )}
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这条订单吗？"
            onConfirm={() => handleDelete(record)}
          >
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '16px', margin: 0, boxSizing: 'border-box' }}>
      <UniTable<OutboundOrder>
        headerTitle="出库单管理"
        actionRef={actionRef}
        columns={columns}
        request={async (params) => {
          const { current = 1, pageSize = 20, ...rest } = params;
          const skip = (current - 1) * pageSize;
          const data = await outboundOrderApi.list({
            skip,
            limit: pageSize,
            ...rest,
          });
          return {
            data,
            success: true,
            total: data.length,
          };
        }}
        rowKey="uuid"
        search={{
          labelWidth: 'auto',
        }}
        toolBarRender={() => [
          <Button
            type="primary"
            key="primary"
            icon={<PlusOutlined />}
            onClick={handleCreate}
          >
            新建出库单
          </Button>,
        ]}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
      />

      {/* 创建/编辑 Modal */}
      <Modal
        title={isEdit ? '编辑出库单' : '新建出库单'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={700}
      >
        <ProForm
          formRef={formRef}
          onFinish={handleSubmit}
          submitter={{
            searchConfig: {
              submitText: isEdit ? '更新' : '创建',
            },
            submitButtonProps: {
              loading: formLoading,
            },
          }}
        >
          <ProFormText
            name="orderNo"
            label="出库单编号"
            rules={[{ required: true, message: '请输入出库单编号' }]}
            placeholder="请输入出库单编号"
          />
          <ProFormDatePicker
            name="orderDate"
            label="出库日期"
            rules={[{ required: true, message: '请选择出库日期' }]}
          />
          <ProFormSelect
            name="orderType"
            label="出库类型"
            options={[
              { label: '销售出库', value: '销售出库' },
              { label: '生产领料', value: '生产领料' },
              { label: '调拨出库', value: '调拨出库' },
              { label: '委外发料', value: '委外发料' },
              { label: '其他出库', value: '其他出库' },
            ]}
            rules={[{ required: true, message: '请选择出库类型' }]}
          />
          <ProFormText
            name="warehouseId"
            label="仓库ID"
            rules={[{ required: true, message: '请输入仓库ID' }]}
            placeholder="请输入仓库ID"
          />
        </ProForm>
      </Modal>

      {/* 详情 Drawer */}
      <Drawer
        title="出库单详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        width={600}
      >
        {detailLoading ? (
          <div>加载中...</div>
        ) : orderDetail ? (
          <ProDescriptions<OutboundOrder>
            column={1}
            dataSource={orderDetail}
            columns={[
              { title: '出库单编号', dataIndex: 'orderNo' },
              { title: '出库类型', dataIndex: 'orderType' },
              { title: '仓库ID', dataIndex: 'warehouseId' },
              { title: '状态', dataIndex: 'status' },
              { title: '拣货状态', dataIndex: 'pickingStatus' },
              { title: '出库金额', dataIndex: 'totalAmount', valueType: 'money' },
              { title: '出库日期', dataIndex: 'orderDate', valueType: 'dateTime' },
              { title: '来源订单', dataIndex: 'sourceOrderNo' },
              { title: '创建时间', dataIndex: 'createdAt', valueType: 'dateTime' },
              { title: '更新时间', dataIndex: 'updatedAt', valueType: 'dateTime' },
            ]}
          />
        ) : null}
      </Drawer>
    </div>
  );
};

export default OutboundOrdersPage;
