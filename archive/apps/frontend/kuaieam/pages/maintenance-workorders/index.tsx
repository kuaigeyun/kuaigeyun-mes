/**
 * 维护工单管理页面
 * 
 * 提供维护工单的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProForm, ProFormText, ProFormSelect, ProFormTextArea, ProFormInstance, ProDescriptions, ProFormDigit, ProFormDatePicker } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Modal, Drawer, message } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../components/uni-table';
import { maintenanceWorkOrderApi } from '../../services/process';
import type { MaintenanceWorkOrder, MaintenanceWorkOrderCreate, MaintenanceWorkOrderUpdate } from '../../types/process';

/**
 * 维护工单管理列表页面组件
 */
const MaintenanceWorkOrdersPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentWorkOrderUuid, setCurrentWorkOrderUuid] = useState<string | null>(null);
  const [workOrderDetail, setWorkOrderDetail] = useState<MaintenanceWorkOrder | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Modal 相关状态（创建/编辑维护工单）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  /**
   * 处理新建维护工单
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentWorkOrderUuid(null);
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      priority: '中',
    });
  };

  /**
   * 处理编辑维护工单
   */
  const handleEdit = async (record: MaintenanceWorkOrder) => {
    try {
      setIsEdit(true);
      setCurrentWorkOrderUuid(record.uuid);
      setModalVisible(true);
      
      const detail = await maintenanceWorkOrderApi.get(record.uuid);
      formRef.current?.setFieldsValue({
        workorderNo: detail.workorderNo,
        planId: detail.planId,
        equipmentId: detail.equipmentId,
        equipmentName: detail.equipmentName,
        workorderType: detail.workorderType,
        maintenanceType: detail.maintenanceType,
        priority: detail.priority,
        plannedStartDate: detail.plannedStartDate,
        plannedEndDate: detail.plannedEndDate,
        assignedPersonId: detail.assignedPersonId,
        assignedPersonName: detail.assignedPersonName,
        executorId: detail.executorId,
        executorName: detail.executorName,
        remark: detail.remark,
      });
    } catch (error: any) {
      messageApi.error(error.message || '获取维护工单详情失败');
    }
  };

  /**
   * 处理删除维护工单
   */
  const handleDelete = async (record: MaintenanceWorkOrder) => {
    try {
      await maintenanceWorkOrderApi.delete(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理打开详情
   */
  const handleOpenDetail = async (record: MaintenanceWorkOrder) => {
    try {
      setCurrentWorkOrderUuid(record.uuid);
      setDrawerVisible(true);
      setDetailLoading(true);
      
      const detail = await maintenanceWorkOrderApi.get(record.uuid);
      setWorkOrderDetail(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取维护工单详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理提交表单
   */
  const handleSubmit = async (values: MaintenanceWorkOrderCreate | MaintenanceWorkOrderUpdate) => {
    try {
      setFormLoading(true);
      
      if (isEdit && currentWorkOrderUuid) {
        await maintenanceWorkOrderApi.update(currentWorkOrderUuid, values as MaintenanceWorkOrderUpdate);
        messageApi.success('更新成功');
      } else {
        await maintenanceWorkOrderApi.create(values as MaintenanceWorkOrderCreate);
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
  const columns: ProColumns<MaintenanceWorkOrder>[] = [
    {
      title: '工单编号',
      dataIndex: 'workorderNo',
      width: 150,
      ellipsis: true,
      render: (_, record) => (
        <a onClick={() => handleOpenDetail(record)}>{record.workorderNo}</a>
      ),
    },
    {
      title: '设备名称',
      dataIndex: 'equipmentName',
      width: 150,
      ellipsis: true,
    },
    {
      title: '工单类型',
      dataIndex: 'workorderType',
      width: 100,
      valueType: 'select',
      valueEnum: {
        '计划性维护': { text: '计划性维护' },
        '故障维修': { text: '故障维修' },
        '临时维护': { text: '临时维护' },
      },
    },
    {
      title: '维护类型',
      dataIndex: 'maintenanceType',
      width: 100,
      valueType: 'select',
      valueEnum: {
        '日常保养': { text: '日常保养' },
        '定期检修': { text: '定期检修' },
        '大修': { text: '大修' },
      },
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      width: 80,
      valueType: 'select',
      valueEnum: {
        '高': { text: <Tag color="red">高</Tag> },
        '中': { text: <Tag color="orange">中</Tag> },
        '低': { text: <Tag color="blue">低</Tag> },
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueType: 'select',
      valueEnum: {
        '待分配': { text: <Tag color="blue">待分配</Tag> },
        '待执行': { text: <Tag color="orange">待执行</Tag> },
        '执行中': { text: <Tag color="processing">执行中</Tag> },
        '已完成': { text: <Tag color="green">已完成</Tag> },
        '已取消': { text: <Tag color="default">已取消</Tag> },
      },
    },
    {
      title: '执行人',
      dataIndex: 'executorName',
      width: 100,
      ellipsis: true,
    },
    {
      title: '操作',
      valueType: 'option',
      width: 150,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这条维护工单吗？"
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
      <UniTable<MaintenanceWorkOrder>
        headerTitle="维护工单管理"
        actionRef={actionRef}
        columns={columns}
        request={async (params) => {
          const { current = 1, pageSize = 20, ...rest } = params;
          const skip = (current - 1) * pageSize;
          const data = await maintenanceWorkOrderApi.list({
            skip,
            limit: pageSize,
            ...rest,
          });
          return {
            data,
            success: true,
            total: data.length, // TODO: 后端需要返回总数
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
            新建维护工单
          </Button>,
        ]}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
      />

      {/* 创建/编辑 Modal */}
      <Modal
        title={isEdit ? '编辑维护工单' : '新建维护工单'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={800}
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
            name="workorderNo"
            label="工单编号"
            rules={[{ required: true, message: '请输入工单编号' }]}
            placeholder="请输入工单编号"
          />
          <ProFormDigit
            name="planId"
            label="维护计划ID"
            placeholder="请输入维护计划ID（可选）"
          />
          <ProFormDigit
            name="equipmentId"
            label="设备ID"
            rules={[{ required: true, message: '请输入设备ID' }]}
            placeholder="请输入设备ID"
          />
          <ProFormText
            name="equipmentName"
            label="设备名称"
            rules={[{ required: true, message: '请输入设备名称' }]}
            placeholder="请输入设备名称"
          />
          <ProFormSelect
            name="workorderType"
            label="工单类型"
            options={[
              { label: '计划性维护', value: '计划性维护' },
              { label: '故障维修', value: '故障维修' },
              { label: '临时维护', value: '临时维护' },
            ]}
            rules={[{ required: true, message: '请选择工单类型' }]}
          />
          <ProFormSelect
            name="maintenanceType"
            label="维护类型"
            options={[
              { label: '日常保养', value: '日常保养' },
              { label: '定期检修', value: '定期检修' },
              { label: '大修', value: '大修' },
            ]}
            rules={[{ required: true, message: '请选择维护类型' }]}
          />
          <ProFormSelect
            name="priority"
            label="优先级"
            options={[
              { label: '高', value: '高' },
              { label: '中', value: '中' },
              { label: '低', value: '低' },
            ]}
          />
          <ProFormDatePicker
            name="plannedStartDate"
            label="计划开始时间"
            placeholder="请选择计划开始时间"
          />
          <ProFormDatePicker
            name="plannedEndDate"
            label="计划结束时间"
            placeholder="请选择计划结束时间"
          />
          <ProFormDigit
            name="assignedPersonId"
            label="分配人员ID"
            placeholder="请输入分配人员ID"
          />
          <ProFormText
            name="assignedPersonName"
            label="分配人员姓名"
            placeholder="请输入分配人员姓名"
          />
          <ProFormDigit
            name="executorId"
            label="执行人员ID"
            placeholder="请输入执行人员ID"
          />
          <ProFormText
            name="executorName"
            label="执行人员姓名"
            placeholder="请输入执行人员姓名"
          />
          <ProFormTextArea
            name="remark"
            label="备注"
            placeholder="请输入备注信息"
          />
        </ProForm>
      </Modal>

      {/* 详情 Drawer */}
      <Drawer
        title="维护工单详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        width={600}
      >
        {detailLoading ? (
          <div>加载中...</div>
        ) : workOrderDetail ? (
          <ProDescriptions<MaintenanceWorkOrder>
            column={1}
            dataSource={workOrderDetail}
            columns={[
              { title: '工单编号', dataIndex: 'workorderNo' },
              { title: '维护计划ID', dataIndex: 'planId' },
              { title: '设备ID', dataIndex: 'equipmentId' },
              { title: '设备名称', dataIndex: 'equipmentName' },
              { title: '工单类型', dataIndex: 'workorderType' },
              { title: '维护类型', dataIndex: 'maintenanceType' },
              { title: '优先级', dataIndex: 'priority' },
              { title: '计划开始时间', dataIndex: 'plannedStartDate', valueType: 'dateTime' },
              { title: '计划结束时间', dataIndex: 'plannedEndDate', valueType: 'dateTime' },
              { title: '实际开始时间', dataIndex: 'actualStartDate', valueType: 'dateTime' },
              { title: '实际结束时间', dataIndex: 'actualEndDate', valueType: 'dateTime' },
              { title: '分配人员', dataIndex: 'assignedPersonName' },
              { title: '执行人员', dataIndex: 'executorName' },
              { title: '状态', dataIndex: 'status' },
              { title: '备注', dataIndex: 'remark' },
              { title: '创建时间', dataIndex: 'createdAt', valueType: 'dateTime' },
              { title: '更新时间', dataIndex: 'updatedAt', valueType: 'dateTime' },
            ]}
          />
        ) : null}
      </Drawer>
    </div>
  );
};

export default MaintenanceWorkOrdersPage;

