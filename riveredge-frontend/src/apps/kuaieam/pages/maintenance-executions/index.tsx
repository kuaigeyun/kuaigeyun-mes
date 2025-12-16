/**
 * 维护执行管理页面
 * 
 * 提供维护执行记录的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProForm, ProFormText, ProFormSelect, ProFormTextArea, ProFormInstance, ProDescriptions, ProFormDigit, ProFormDatePicker, ProFormMoney } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Modal, Drawer, message } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '@/components/uni-table';
import { maintenanceExecutionApi } from '../../services/process';
import type { MaintenanceExecution, MaintenanceExecutionCreate, MaintenanceExecutionUpdate } from '../../types/process';

/**
 * 维护执行管理列表页面组件
 */
const MaintenanceExecutionsPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentExecutionUuid, setCurrentExecutionUuid] = useState<string | null>(null);
  const [executionDetail, setExecutionDetail] = useState<MaintenanceExecution | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Modal 相关状态（创建/编辑维护执行）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  /**
   * 处理新建维护执行
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentExecutionUuid(null);
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      executionDate: new Date().toISOString(),
    });
  };

  /**
   * 处理编辑维护执行
   */
  const handleEdit = async (record: MaintenanceExecution) => {
    try {
      setIsEdit(true);
      setCurrentExecutionUuid(record.uuid);
      setModalVisible(true);
      
      const detail = await maintenanceExecutionApi.get(record.uuid);
      formRef.current?.setFieldsValue({
        executionNo: detail.executionNo,
        workorderId: detail.workorderId,
        equipmentId: detail.equipmentId,
        equipmentName: detail.equipmentName,
        executionDate: detail.executionDate,
        executorId: detail.executorId,
        executorName: detail.executorName,
        executionContent: detail.executionContent,
        executionResult: detail.executionResult,
        maintenanceCost: detail.maintenanceCost,
        acceptancePersonId: detail.acceptancePersonId,
        acceptancePersonName: detail.acceptancePersonName,
        acceptanceDate: detail.acceptanceDate,
        acceptanceResult: detail.acceptanceResult,
        remark: detail.remark,
      });
    } catch (error: any) {
      messageApi.error(error.message || '获取维护执行详情失败');
    }
  };

  /**
   * 处理删除维护执行
   */
  const handleDelete = async (record: MaintenanceExecution) => {
    try {
      await maintenanceExecutionApi.delete(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理打开详情
   */
  const handleOpenDetail = async (record: MaintenanceExecution) => {
    try {
      setCurrentExecutionUuid(record.uuid);
      setDrawerVisible(true);
      setDetailLoading(true);
      
      const detail = await maintenanceExecutionApi.get(record.uuid);
      setExecutionDetail(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取维护执行详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理提交表单
   */
  const handleSubmit = async (values: MaintenanceExecutionCreate | MaintenanceExecutionUpdate) => {
    try {
      setFormLoading(true);
      
      if (isEdit && currentExecutionUuid) {
        await maintenanceExecutionApi.update(currentExecutionUuid, values as MaintenanceExecutionUpdate);
        messageApi.success('更新成功');
      } else {
        await maintenanceExecutionApi.create(values as MaintenanceExecutionCreate);
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
  const columns: ProColumns<MaintenanceExecution>[] = [
    {
      title: '执行记录编号',
      dataIndex: 'executionNo',
      width: 150,
      ellipsis: true,
      render: (_, record) => (
        <a onClick={() => handleOpenDetail(record)}>{record.executionNo}</a>
      ),
    },
    {
      title: '设备名称',
      dataIndex: 'equipmentName',
      width: 150,
      ellipsis: true,
    },
    {
      title: '执行日期',
      dataIndex: 'executionDate',
      width: 150,
      valueType: 'dateTime',
    },
    {
      title: '执行人',
      dataIndex: 'executorName',
      width: 100,
      ellipsis: true,
    },
    {
      title: '执行结果',
      dataIndex: 'executionResult',
      width: 100,
      valueType: 'select',
      valueEnum: {
        '合格': { text: <Tag color="green">合格</Tag> },
        '不合格': { text: <Tag color="red">不合格</Tag> },
        '待验收': { text: <Tag color="orange">待验收</Tag> },
      },
    },
    {
      title: '维护成本',
      dataIndex: 'maintenanceCost',
      width: 100,
      valueType: 'money',
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueType: 'select',
      valueEnum: {
        '执行中': { text: <Tag color="orange">执行中</Tag> },
        '待验收': { text: <Tag color="blue">待验收</Tag> },
        '已验收': { text: <Tag color="green">已验收</Tag> },
      },
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
            title="确定要删除这条维护执行记录吗？"
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
      <UniTable<MaintenanceExecution>
        headerTitle="维护执行管理"
        actionRef={actionRef}
        columns={columns}
        request={async (params) => {
          const { current = 1, pageSize = 20, ...rest } = params;
          const skip = (current - 1) * pageSize;
          const data = await maintenanceExecutionApi.list({
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
            新建维护执行
          </Button>,
        ]}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
      />

      {/* 创建/编辑 Modal */}
      <Modal
        title={isEdit ? '编辑维护执行' : '新建维护执行'}
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
            name="executionNo"
            label="执行记录编号"
            rules={[{ required: true, message: '请输入执行记录编号' }]}
            placeholder="请输入执行记录编号"
          />
          <ProFormDigit
            name="workorderId"
            label="维护工单ID"
            placeholder="请输入维护工单ID（可选）"
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
          <ProFormDatePicker
            name="executionDate"
            label="执行日期"
            rules={[{ required: true, message: '请选择执行日期' }]}
            placeholder="请选择执行日期"
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
            name="executionContent"
            label="执行内容"
            placeholder="请输入执行内容"
          />
          <ProFormSelect
            name="executionResult"
            label="执行结果"
            options={[
              { label: '合格', value: '合格' },
              { label: '不合格', value: '不合格' },
              { label: '待验收', value: '待验收' },
            ]}
            placeholder="请选择执行结果"
          />
          <ProFormMoney
            name="maintenanceCost"
            label="维护成本"
            placeholder="请输入维护成本"
          />
          <ProFormDigit
            name="acceptancePersonId"
            label="验收人员ID"
            placeholder="请输入验收人员ID"
          />
          <ProFormText
            name="acceptancePersonName"
            label="验收人员姓名"
            placeholder="请输入验收人员姓名"
          />
          <ProFormDatePicker
            name="acceptanceDate"
            label="验收日期"
            placeholder="请选择验收日期"
          />
          <ProFormSelect
            name="acceptanceResult"
            label="验收结果"
            options={[
              { label: '通过', value: '通过' },
              { label: '不通过', value: '不通过' },
            ]}
            placeholder="请选择验收结果"
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
        title="维护执行详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        width={600}
      >
        {detailLoading ? (
          <div>加载中...</div>
        ) : executionDetail ? (
          <ProDescriptions<MaintenanceExecution>
            column={1}
            dataSource={executionDetail}
            columns={[
              { title: '执行记录编号', dataIndex: 'executionNo' },
              { title: '维护工单ID', dataIndex: 'workorderId' },
              { title: '设备ID', dataIndex: 'equipmentId' },
              { title: '设备名称', dataIndex: 'equipmentName' },
              { title: '执行日期', dataIndex: 'executionDate', valueType: 'dateTime' },
              { title: '执行人员', dataIndex: 'executorName' },
              { title: '执行内容', dataIndex: 'executionContent' },
              { title: '执行结果', dataIndex: 'executionResult' },
              { title: '维护成本', dataIndex: 'maintenanceCost', valueType: 'money' },
              { title: '验收人员', dataIndex: 'acceptancePersonName' },
              { title: '验收日期', dataIndex: 'acceptanceDate', valueType: 'dateTime' },
              { title: '验收结果', dataIndex: 'acceptanceResult' },
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

export default MaintenanceExecutionsPage;

