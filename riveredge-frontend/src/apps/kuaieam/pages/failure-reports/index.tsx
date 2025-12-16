/**
 * 故障报修管理页面
 * 
 * 提供故障报修的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProForm, ProFormText, ProFormSelect, ProFormTextArea, ProFormInstance, ProDescriptions, ProFormDigit, ProFormDatePicker } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Modal, Drawer, message } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '@/components/uni-table';
import { failureReportApi } from '../../services/process';
import type { FailureReport, FailureReportCreate, FailureReportUpdate } from '../../types/process';

/**
 * 故障报修管理列表页面组件
 */
const FailureReportsPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentReportUuid, setCurrentReportUuid] = useState<string | null>(null);
  const [reportDetail, setReportDetail] = useState<FailureReport | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Modal 相关状态（创建/编辑故障报修）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  /**
   * 处理新建故障报修
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentReportUuid(null);
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      failureLevel: '一般',
      reportDate: new Date().toISOString(),
    });
  };

  /**
   * 处理编辑故障报修
   */
  const handleEdit = async (record: FailureReport) => {
    try {
      setIsEdit(true);
      setCurrentReportUuid(record.uuid);
      setModalVisible(true);
      
      const detail = await failureReportApi.get(record.uuid);
      formRef.current?.setFieldsValue({
        reportNo: detail.reportNo,
        equipmentId: detail.equipmentId,
        equipmentName: detail.equipmentName,
        failureType: detail.failureType,
        failureLevel: detail.failureLevel,
        failureDescription: detail.failureDescription,
        reporterId: detail.reporterId,
        reporterName: detail.reporterName,
        reportDate: detail.reportDate,
        assignedPersonId: detail.assignedPersonId,
        assignedPersonName: detail.assignedPersonName,
        remark: detail.remark,
      });
    } catch (error: any) {
      messageApi.error(error.message || '获取故障报修详情失败');
    }
  };

  /**
   * 处理删除故障报修
   */
  const handleDelete = async (record: FailureReport) => {
    try {
      await failureReportApi.delete(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理打开详情
   */
  const handleOpenDetail = async (record: FailureReport) => {
    try {
      setCurrentReportUuid(record.uuid);
      setDrawerVisible(true);
      setDetailLoading(true);
      
      const detail = await failureReportApi.get(record.uuid);
      setReportDetail(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取故障报修详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理提交表单
   */
  const handleSubmit = async (values: FailureReportCreate | FailureReportUpdate) => {
    try {
      setFormLoading(true);
      
      if (isEdit && currentReportUuid) {
        await failureReportApi.update(currentReportUuid, values as FailureReportUpdate);
        messageApi.success('更新成功');
      } else {
        await failureReportApi.create(values as FailureReportCreate);
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
  const columns: ProColumns<FailureReport>[] = [
    {
      title: '报修单编号',
      dataIndex: 'reportNo',
      width: 150,
      ellipsis: true,
      render: (_, record) => (
        <a onClick={() => handleOpenDetail(record)}>{record.reportNo}</a>
      ),
    },
    {
      title: '设备名称',
      dataIndex: 'equipmentName',
      width: 150,
      ellipsis: true,
    },
    {
      title: '故障类型',
      dataIndex: 'failureType',
      width: 100,
      valueType: 'select',
      valueEnum: {
        '机械故障': { text: '机械故障' },
        '电气故障': { text: '电气故障' },
        '软件故障': { text: '软件故障' },
        '其他': { text: '其他' },
      },
    },
    {
      title: '故障等级',
      dataIndex: 'failureLevel',
      width: 100,
      valueType: 'select',
      valueEnum: {
        '紧急': { text: <Tag color="red">紧急</Tag> },
        '重要': { text: <Tag color="orange">重要</Tag> },
        '一般': { text: <Tag color="blue">一般</Tag> },
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueType: 'select',
      valueEnum: {
        '待分配': { text: <Tag color="blue">待分配</Tag> },
        '处理中': { text: <Tag color="orange">处理中</Tag> },
        '已完成': { text: <Tag color="green">已完成</Tag> },
        '已取消': { text: <Tag color="default">已取消</Tag> },
      },
    },
    {
      title: '报修人',
      dataIndex: 'reporterName',
      width: 100,
      ellipsis: true,
    },
    {
      title: '报修日期',
      dataIndex: 'reportDate',
      width: 150,
      valueType: 'dateTime',
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
            title="确定要删除这条故障报修吗？"
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
      <UniTable<FailureReport>
        headerTitle="故障报修管理"
        actionRef={actionRef}
        columns={columns}
        request={async (params) => {
          const { current = 1, pageSize = 20, ...rest } = params;
          const skip = (current - 1) * pageSize;
          const data = await failureReportApi.list({
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
            新建故障报修
          </Button>,
        ]}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
      />

      {/* 创建/编辑 Modal */}
      <Modal
        title={isEdit ? '编辑故障报修' : '新建故障报修'}
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
            name="reportNo"
            label="报修单编号"
            rules={[{ required: true, message: '请输入报修单编号' }]}
            placeholder="请输入报修单编号"
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
            name="failureType"
            label="故障类型"
            options={[
              { label: '机械故障', value: '机械故障' },
              { label: '电气故障', value: '电气故障' },
              { label: '软件故障', value: '软件故障' },
              { label: '其他', value: '其他' },
            ]}
            rules={[{ required: true, message: '请选择故障类型' }]}
          />
          <ProFormSelect
            name="failureLevel"
            label="故障等级"
            options={[
              { label: '紧急', value: '紧急' },
              { label: '重要', value: '重要' },
              { label: '一般', value: '一般' },
            ]}
          />
          <ProFormTextArea
            name="failureDescription"
            label="故障描述"
            rules={[{ required: true, message: '请输入故障描述' }]}
            placeholder="请输入故障描述"
          />
          <ProFormDigit
            name="reporterId"
            label="报修人ID"
            placeholder="请输入报修人ID"
          />
          <ProFormText
            name="reporterName"
            label="报修人姓名"
            placeholder="请输入报修人姓名"
          />
          <ProFormDatePicker
            name="reportDate"
            label="报修日期"
            rules={[{ required: true, message: '请选择报修日期' }]}
            placeholder="请选择报修日期"
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
          <ProFormTextArea
            name="remark"
            label="备注"
            placeholder="请输入备注信息"
          />
        </ProForm>
      </Modal>

      {/* 详情 Drawer */}
      <Drawer
        title="故障报修详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        width={600}
      >
        {detailLoading ? (
          <div>加载中...</div>
        ) : reportDetail ? (
          <ProDescriptions<FailureReport>
            column={1}
            dataSource={reportDetail}
            columns={[
              { title: '报修单编号', dataIndex: 'reportNo' },
              { title: '设备ID', dataIndex: 'equipmentId' },
              { title: '设备名称', dataIndex: 'equipmentName' },
              { title: '故障类型', dataIndex: 'failureType' },
              { title: '故障等级', dataIndex: 'failureLevel' },
              { title: '故障描述', dataIndex: 'failureDescription' },
              { title: '报修人', dataIndex: 'reporterName' },
              { title: '报修日期', dataIndex: 'reportDate', valueType: 'dateTime' },
              { title: '分配人员', dataIndex: 'assignedPersonName' },
              { title: '分配日期', dataIndex: 'assignedDate', valueType: 'dateTime' },
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

export default FailureReportsPage;

