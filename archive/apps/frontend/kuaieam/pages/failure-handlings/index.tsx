/**
 * 故障处理管理页面
 * 
 * 提供故障处理的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProForm, ProFormText, ProFormSelect, ProFormTextArea, ProFormInstance, ProDescriptions, ProFormDigit, ProFormDatePicker, ProFormMoney } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Modal, Drawer, message } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../components/uni-table';
import { failureHandlingApi } from '../../services/process';
import type { FailureHandling, FailureHandlingCreate, FailureHandlingUpdate } from '../../types/process';

/**
 * 故障处理管理列表页面组件
 */
const FailureHandlingsPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentHandlingUuid, setCurrentHandlingUuid] = useState<string | null>(null);
  const [handlingDetail, setHandlingDetail] = useState<FailureHandling | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Modal 相关状态（创建/编辑故障处理）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  /**
   * 处理新建故障处理
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentHandlingUuid(null);
    setModalVisible(true);
    formRef.current?.resetFields();
  };

  /**
   * 处理编辑故障处理
   */
  const handleEdit = async (record: FailureHandling) => {
    try {
      setIsEdit(true);
      setCurrentHandlingUuid(record.uuid);
      setModalVisible(true);
      
      const detail = await failureHandlingApi.get(record.uuid);
      formRef.current?.setFieldsValue({
        handlingNo: detail.handlingNo,
        reportId: detail.reportId,
        equipmentId: detail.equipmentId,
        equipmentName: detail.equipmentName,
        handlingStartDate: detail.handlingStartDate,
        handlingEndDate: detail.handlingEndDate,
        handlerId: detail.handlerId,
        handlerName: detail.handlerName,
        handlingMethod: detail.handlingMethod,
        handlingResult: detail.handlingResult,
        rootCause: detail.rootCause,
        handlingCost: detail.handlingCost,
        acceptancePersonId: detail.acceptancePersonId,
        acceptancePersonName: detail.acceptancePersonName,
        acceptanceDate: detail.acceptanceDate,
        acceptanceResult: detail.acceptanceResult,
        remark: detail.remark,
      });
    } catch (error: any) {
      messageApi.error(error.message || '获取故障处理详情失败');
    }
  };

  /**
   * 处理删除故障处理
   */
  const handleDelete = async (record: FailureHandling) => {
    try {
      await failureHandlingApi.delete(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理打开详情
   */
  const handleOpenDetail = async (record: FailureHandling) => {
    try {
      setCurrentHandlingUuid(record.uuid);
      setDrawerVisible(true);
      setDetailLoading(true);
      
      const detail = await failureHandlingApi.get(record.uuid);
      setHandlingDetail(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取故障处理详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理提交表单
   */
  const handleSubmit = async (values: FailureHandlingCreate | FailureHandlingUpdate) => {
    try {
      setFormLoading(true);
      
      if (isEdit && currentHandlingUuid) {
        await failureHandlingApi.update(currentHandlingUuid, values as FailureHandlingUpdate);
        messageApi.success('更新成功');
      } else {
        await failureHandlingApi.create(values as FailureHandlingCreate);
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
  const columns: ProColumns<FailureHandling>[] = [
    {
      title: '处理单编号',
      dataIndex: 'handlingNo',
      width: 150,
      ellipsis: true,
      render: (_, record) => (
        <a onClick={() => handleOpenDetail(record)}>{record.handlingNo}</a>
      ),
    },
    {
      title: '设备名称',
      dataIndex: 'equipmentName',
      width: 150,
      ellipsis: true,
    },
    {
      title: '处理开始时间',
      dataIndex: 'handlingStartDate',
      width: 150,
      valueType: 'dateTime',
    },
    {
      title: '处理结束时间',
      dataIndex: 'handlingEndDate',
      width: 150,
      valueType: 'dateTime',
    },
    {
      title: '处理人',
      dataIndex: 'handlerName',
      width: 100,
      ellipsis: true,
    },
    {
      title: '处理结果',
      dataIndex: 'handlingResult',
      width: 100,
      valueType: 'select',
      valueEnum: {
        '已修复': { text: <Tag color="green">已修复</Tag> },
        '待修复': { text: <Tag color="orange">待修复</Tag> },
        '无法修复': { text: <Tag color="red">无法修复</Tag> },
      },
    },
    {
      title: '处理成本',
      dataIndex: 'handlingCost',
      width: 100,
      valueType: 'money',
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueType: 'select',
      valueEnum: {
        '处理中': { text: <Tag color="orange">处理中</Tag> },
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
            title="确定要删除这条故障处理记录吗？"
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
      <UniTable<FailureHandling>
        headerTitle="故障处理管理"
        actionRef={actionRef}
        columns={columns}
        request={async (params) => {
          const { current = 1, pageSize = 20, ...rest } = params;
          const skip = (current - 1) * pageSize;
          const data = await failureHandlingApi.list({
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
            新建故障处理
          </Button>,
        ]}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
      />

      {/* 创建/编辑 Modal */}
      <Modal
        title={isEdit ? '编辑故障处理' : '新建故障处理'}
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
            name="handlingNo"
            label="处理单编号"
            rules={[{ required: true, message: '请输入处理单编号' }]}
            placeholder="请输入处理单编号"
          />
          <ProFormDigit
            name="reportId"
            label="故障报修ID"
            placeholder="请输入故障报修ID（可选）"
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
            name="handlingStartDate"
            label="处理开始时间"
            placeholder="请选择处理开始时间"
          />
          <ProFormDatePicker
            name="handlingEndDate"
            label="处理结束时间"
            placeholder="请选择处理结束时间"
          />
          <ProFormDigit
            name="handlerId"
            label="处理人员ID"
            placeholder="请输入处理人员ID"
          />
          <ProFormText
            name="handlerName"
            label="处理人员姓名"
            placeholder="请输入处理人员姓名"
          />
          <ProFormTextArea
            name="handlingMethod"
            label="处理方法"
            placeholder="请输入处理方法"
          />
          <ProFormSelect
            name="handlingResult"
            label="处理结果"
            options={[
              { label: '已修复', value: '已修复' },
              { label: '待修复', value: '待修复' },
              { label: '无法修复', value: '无法修复' },
            ]}
            placeholder="请选择处理结果"
          />
          <ProFormTextArea
            name="rootCause"
            label="根本原因"
            placeholder="请输入根本原因"
          />
          <ProFormMoney
            name="handlingCost"
            label="处理成本"
            placeholder="请输入处理成本"
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
        title="故障处理详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        width={600}
      >
        {detailLoading ? (
          <div>加载中...</div>
        ) : handlingDetail ? (
          <ProDescriptions<FailureHandling>
            column={1}
            dataSource={handlingDetail}
            columns={[
              { title: '处理单编号', dataIndex: 'handlingNo' },
              { title: '故障报修ID', dataIndex: 'reportId' },
              { title: '设备ID', dataIndex: 'equipmentId' },
              { title: '设备名称', dataIndex: 'equipmentName' },
              { title: '处理开始时间', dataIndex: 'handlingStartDate', valueType: 'dateTime' },
              { title: '处理结束时间', dataIndex: 'handlingEndDate', valueType: 'dateTime' },
              { title: '处理人员', dataIndex: 'handlerName' },
              { title: '处理方法', dataIndex: 'handlingMethod' },
              { title: '处理结果', dataIndex: 'handlingResult' },
              { title: '根本原因', dataIndex: 'rootCause' },
              { title: '处理成本', dataIndex: 'handlingCost', valueType: 'money' },
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

export default FailureHandlingsPage;

