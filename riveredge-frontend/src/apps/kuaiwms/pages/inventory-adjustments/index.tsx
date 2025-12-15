/**
 * 库存调整管理页面
 * 
 * 提供库存调整的 CRUD 功能，包括列表展示、创建、编辑、删除、审批等操作。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProForm, ProFormText, ProFormSelect, ProFormDatePicker, ProFormTextArea, ProFormInstance, ProDescriptions } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Modal, Drawer, message } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { UniTable } from '@/components/uni_table';
import { inventoryAdjustmentApi } from '../../services/process';
import type { InventoryAdjustment, InventoryAdjustmentCreate, InventoryAdjustmentUpdate } from '../../types/process';

/**
 * 库存调整管理列表页面组件
 */
const InventoryAdjustmentsPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentAdjustmentUuid, setCurrentAdjustmentUuid] = useState<string | null>(null);
  const [adjustmentDetail, setAdjustmentDetail] = useState<InventoryAdjustment | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Modal 相关状态（创建/编辑调整）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  /**
   * 处理新建调整
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentAdjustmentUuid(null);
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      status: '草稿',
    });
  };

  /**
   * 处理编辑调整
   */
  const handleEdit = async (record: InventoryAdjustment) => {
    try {
      setIsEdit(true);
      setCurrentAdjustmentUuid(record.uuid);
      setModalVisible(true);
      
      const detail = await inventoryAdjustmentApi.get(record.uuid);
      formRef.current?.setFieldsValue({
        adjustmentNo: detail.adjustmentNo,
        adjustmentDate: detail.adjustmentDate,
        warehouseId: detail.warehouseId,
        adjustmentType: detail.adjustmentType,
        adjustmentReason: detail.adjustmentReason,
      });
    } catch (error: any) {
      messageApi.error(error.message || '获取调整详情失败');
    }
  };

  /**
   * 处理删除调整
   */
  const handleDelete = async (record: InventoryAdjustment) => {
    try {
      await inventoryAdjustmentApi.delete(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理打开详情
   */
  const handleOpenDetail = async (record: InventoryAdjustment) => {
    try {
      setCurrentAdjustmentUuid(record.uuid);
      setDrawerVisible(true);
      setDetailLoading(true);
      
      const detail = await inventoryAdjustmentApi.get(record.uuid);
      setAdjustmentDetail(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取调整详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理提交审批
   */
  const handleSubmitApproval = async (record: InventoryAdjustment) => {
    Modal.confirm({
      title: '提交库存调整审批',
      content: '请输入审批流程代码',
      // TODO: 实现流程代码输入
      onOk: async () => {
        try {
          await inventoryAdjustmentApi.submitApproval(record.uuid, 'inventory_adjustment_approval');
          messageApi.success('提交审批成功');
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '提交审批失败');
        }
      },
    });
  };

  /**
   * 处理提交表单
   */
  const handleSubmit = async (values: InventoryAdjustmentCreate | InventoryAdjustmentUpdate) => {
    try {
      setFormLoading(true);
      
      if (isEdit && currentAdjustmentUuid) {
        await inventoryAdjustmentApi.update(currentAdjustmentUuid, values as InventoryAdjustmentUpdate);
        messageApi.success('更新成功');
      } else {
        await inventoryAdjustmentApi.create(values as InventoryAdjustmentCreate);
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
  const columns: ProColumns<InventoryAdjustment>[] = [
    {
      title: '调整单编号',
      dataIndex: 'adjustmentNo',
      width: 150,
      fixed: 'left',
      render: (_, record) => (
        <a onClick={() => handleOpenDetail(record)}>{record.adjustmentNo}</a>
      ),
    },
    {
      title: '仓库ID',
      dataIndex: 'warehouseId',
      width: 100,
    },
    {
      title: '调整类型',
      dataIndex: 'adjustmentType',
      width: 100,
      valueType: 'select',
      valueEnum: {
        '盘盈': { text: <Tag color="green">盘盈</Tag> },
        '盘亏': { text: <Tag color="red">盘亏</Tag> },
        '其他调整': { text: '其他调整' },
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueType: 'select',
      valueEnum: {
        '草稿': { text: <Tag color="default">草稿</Tag> },
        '待审批': { text: <Tag color="orange">待审批</Tag> },
        '已审批': { text: <Tag color="blue">已审批</Tag> },
        '已执行': { text: <Tag color="green">已执行</Tag> },
        '已关闭': { text: <Tag color="default">已关闭</Tag> },
      },
    },
    {
      title: '审批状态',
      dataIndex: 'approvalStatus',
      width: 100,
      render: (status) => {
        if (!status) return '-';
        const statusMap: Record<string, { color: string; text: string }> = {
          pending: { color: 'orange', text: '审批中' },
          approved: { color: 'green', text: '已通过' },
          rejected: { color: 'red', text: '已拒绝' },
          cancelled: { color: 'default', text: '已取消' },
        };
        const statusInfo = statusMap[status] || { color: 'default', text: status };
        return <Tag color={statusInfo.color}>{statusInfo.text}</Tag>;
      },
    },
    {
      title: '调整金额',
      dataIndex: 'totalAmount',
      width: 120,
      valueType: 'money',
    },
    {
      title: '调整日期',
      dataIndex: 'adjustmentDate',
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
          {!record.approvalInstanceId && (
            <Button
              type="link"
              size="small"
              icon={<CheckCircleOutlined />}
              onClick={() => handleSubmitApproval(record)}
            >
              提交审批
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
            title="确定要删除这条调整吗？"
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
      <UniTable<InventoryAdjustment>
        headerTitle="库存调整管理"
        actionRef={actionRef}
        columns={columns}
        request={async (params) => {
          const { current = 1, pageSize = 20, ...rest } = params;
          const skip = (current - 1) * pageSize;
          const data = await inventoryAdjustmentApi.list({
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
            新建调整
          </Button>,
        ]}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
      />

      {/* 创建/编辑 Modal */}
      <Modal
        title={isEdit ? '编辑库存调整' : '新建库存调整'}
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
            name="adjustmentNo"
            label="调整单编号"
            rules={[{ required: true, message: '请输入调整单编号' }]}
            placeholder="请输入调整单编号"
          />
          <ProFormDatePicker
            name="adjustmentDate"
            label="调整日期"
            rules={[{ required: true, message: '请选择调整日期' }]}
          />
          <ProFormText
            name="warehouseId"
            label="仓库ID"
            rules={[{ required: true, message: '请输入仓库ID' }]}
            placeholder="请输入仓库ID"
          />
          <ProFormSelect
            name="adjustmentType"
            label="调整类型"
            options={[
              { label: '盘盈', value: '盘盈' },
              { label: '盘亏', value: '盘亏' },
              { label: '其他调整', value: '其他调整' },
            ]}
            rules={[{ required: true, message: '请选择调整类型' }]}
          />
          <ProFormTextArea
            name="adjustmentReason"
            label="调整原因"
            rules={[{ required: true, message: '请输入调整原因' }]}
            placeholder="请输入调整原因"
          />
        </ProForm>
      </Modal>

      {/* 详情 Drawer */}
      <Drawer
        title="库存调整详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        width={600}
      >
        {detailLoading ? (
          <div>加载中...</div>
        ) : adjustmentDetail ? (
          <ProDescriptions<InventoryAdjustment>
            column={1}
            dataSource={adjustmentDetail}
            columns={[
              { title: '调整单编号', dataIndex: 'adjustmentNo' },
              { title: '仓库ID', dataIndex: 'warehouseId' },
              { title: '调整类型', dataIndex: 'adjustmentType' },
              { title: '调整原因', dataIndex: 'adjustmentReason' },
              { title: '状态', dataIndex: 'status' },
              { title: '审批状态', dataIndex: 'approvalStatus' },
              { title: '调整金额', dataIndex: 'totalAmount', valueType: 'money' },
              { title: '调整日期', dataIndex: 'adjustmentDate', valueType: 'dateTime' },
              { title: '创建时间', dataIndex: 'createdAt', valueType: 'dateTime' },
              { title: '更新时间', dataIndex: 'updatedAt', valueType: 'dateTime' },
            ]}
          />
        ) : null}
      </Drawer>
    </div>
  );
};

export default InventoryAdjustmentsPage;
