/**
 * 实验管理页面
 * 
 * 提供实验管理的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProForm, ProFormText, ProFormSelect, ProFormTextArea, ProFormInstance, ProDescriptions, ProFormDigit, ProFormDatePicker } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Modal, Drawer } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '@/components/uni-table';
import { experimentManagementApi } from '../../services/process';
import type { ExperimentManagement, ExperimentManagementCreate, ExperimentManagementUpdate } from '../../types/process';

/**
 * 实验管理列表页面组件
 */
const ExperimentManagementsPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentExperimentUuid, setCurrentExperimentUuid] = useState<string | null>(null);
  const [experimentDetail, setExperimentDetail] = useState<ExperimentManagement | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Modal 相关状态（创建/编辑实验管理）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  /**
   * 处理新建实验管理
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentExperimentUuid(null);
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      experimentStatus: '待执行',
      confirmationStatus: '待确认',
      status: '草稿',
    });
  };

  /**
   * 处理编辑实验管理
   */
  const handleEdit = async (record: ExperimentManagement) => {
    try {
      setIsEdit(true);
      setCurrentExperimentUuid(record.uuid);
      setModalVisible(true);
      
      // 获取实验管理详情
      const detail = await experimentManagementApi.get(record.uuid);
      formRef.current?.setFieldsValue({
        experimentNo: detail.experimentNo,
        experimentName: detail.experimentName,
        experimentType: detail.experimentType,
        sampleId: detail.sampleId,
        sampleUuid: detail.sampleUuid,
        sampleNo: detail.sampleNo,
        planStartDate: detail.planStartDate,
        planEndDate: detail.planEndDate,
        actualStartDate: detail.actualStartDate,
        actualEndDate: detail.actualEndDate,
        experimenterId: detail.experimenterId,
        experimenterName: detail.experimenterName,
        experimentStatus: detail.experimentStatus,
        confirmationStatus: detail.confirmationStatus,
        confirmationPersonId: detail.confirmationPersonId,
        confirmationPersonName: detail.confirmationPersonName,
        status: detail.status,
        remark: detail.remark,
      });
    } catch (error: any) {
      messageApi.error(error.message || '获取实验管理详情失败');
    }
  };

  /**
   * 处理删除实验管理
   */
  const handleDelete = async (record: ExperimentManagement) => {
    try {
      await experimentManagementApi.delete(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理打开详情
   */
  const handleOpenDetail = async (record: ExperimentManagement) => {
    try {
      setCurrentExperimentUuid(record.uuid);
      setDrawerVisible(true);
      setDetailLoading(true);
      
      const detail = await experimentManagementApi.get(record.uuid);
      setExperimentDetail(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取实验管理详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理提交表单
   */
  const handleSubmit = async (values: ExperimentManagementCreate | ExperimentManagementUpdate) => {
    try {
      setFormLoading(true);
      
      if (isEdit && currentExperimentUuid) {
        await experimentManagementApi.update(currentExperimentUuid, values as ExperimentManagementUpdate);
        messageApi.success('更新成功');
      } else {
        await experimentManagementApi.create(values as ExperimentManagementCreate);
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
  const columns: ProColumns<ExperimentManagement>[] = [
    {
      title: '实验编号',
      dataIndex: 'experimentNo',
      width: 150,
      ellipsis: true,
      render: (_, record) => (
        <a onClick={() => handleOpenDetail(record)}>{record.experimentNo}</a>
      ),
    },
    {
      title: '实验名称',
      dataIndex: 'experimentName',
      width: 200,
      ellipsis: true,
    },
    {
      title: '实验类型',
      dataIndex: 'experimentType',
      width: 120,
      valueType: 'select',
      valueEnum: {
        '物理实验': { text: '物理实验' },
        '化学实验': { text: '化学实验' },
        '生物实验': { text: '生物实验' },
        '其他': { text: '其他' },
      },
    },
    {
      title: '样品编号',
      dataIndex: 'sampleNo',
      width: 150,
      ellipsis: true,
    },
    {
      title: '实验员',
      dataIndex: 'experimenterName',
      width: 100,
      ellipsis: true,
    },
    {
      title: '计划开始日期',
      dataIndex: 'planStartDate',
      width: 150,
      valueType: 'dateTime',
    },
    {
      title: '计划结束日期',
      dataIndex: 'planEndDate',
      width: 150,
      valueType: 'dateTime',
    },
    {
      title: '实验状态',
      dataIndex: 'experimentStatus',
      width: 120,
      valueType: 'select',
      valueEnum: {
        '待执行': { text: <Tag color="default">待执行</Tag> },
        '执行中': { text: <Tag color="processing">执行中</Tag> },
        '已完成': { text: <Tag color="green">已完成</Tag> },
        '已取消': { text: <Tag color="default">已取消</Tag> },
      },
    },
    {
      title: '确认状态',
      dataIndex: 'confirmationStatus',
      width: 120,
      valueType: 'select',
      valueEnum: {
        '待确认': { text: <Tag color="default">待确认</Tag> },
        '已确认': { text: <Tag color="green">已确认</Tag> },
        '已拒绝': { text: <Tag color="red">已拒绝</Tag> },
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueType: 'select',
      valueEnum: {
        '草稿': { text: <Tag color="default">草稿</Tag> },
        '执行中': { text: <Tag color="processing">执行中</Tag> },
        '已完成': { text: <Tag color="green">已完成</Tag> },
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
            title="确定要删除这条实验管理吗？"
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
      <UniTable<ExperimentManagement>
        headerTitle="实验管理"
        actionRef={actionRef}
        columns={columns}
        request={async (params) => {
          const { current = 1, pageSize = 20, ...rest } = params;
          const skip = (current - 1) * pageSize;
          const data = await experimentManagementApi.list({
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
            新建实验管理
          </Button>,
        ]}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
      />

      {/* 创建/编辑 Modal */}
      <Modal
        title={isEdit ? '编辑实验管理' : '新建实验管理'}
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
            name="experimentNo"
            label="实验编号"
            rules={[{ required: true, message: '请输入实验编号' }]}
            placeholder="请输入实验编号"
            disabled={isEdit}
          />
          <ProFormText
            name="experimentName"
            label="实验名称"
            rules={[{ required: true, message: '请输入实验名称' }]}
            placeholder="请输入实验名称"
          />
          <ProFormSelect
            name="experimentType"
            label="实验类型"
            options={[
              { label: '物理实验', value: '物理实验' },
              { label: '化学实验', value: '化学实验' },
              { label: '生物实验', value: '生物实验' },
              { label: '其他', value: '其他' },
            ]}
            rules={[{ required: true, message: '请选择实验类型' }]}
          />
          <ProFormDigit
            name="sampleId"
            label="样品ID"
            placeholder="请输入样品ID"
          />
          <ProFormText
            name="sampleUuid"
            label="样品UUID"
            placeholder="请输入样品UUID"
          />
          <ProFormText
            name="sampleNo"
            label="样品编号"
            placeholder="请输入样品编号"
          />
          <ProFormDatePicker
            name="planStartDate"
            label="计划开始日期"
            placeholder="请选择计划开始日期"
            showTime
          />
          <ProFormDatePicker
            name="planEndDate"
            label="计划结束日期"
            placeholder="请选择计划结束日期"
            showTime
          />
          <ProFormDatePicker
            name="actualStartDate"
            label="实际开始日期"
            placeholder="请选择实际开始日期"
            showTime
          />
          <ProFormDatePicker
            name="actualEndDate"
            label="实际结束日期"
            placeholder="请选择实际结束日期"
            showTime
          />
          <ProFormDigit
            name="experimenterId"
            label="实验员ID"
            placeholder="请输入实验员ID"
          />
          <ProFormText
            name="experimenterName"
            label="实验员姓名"
            placeholder="请输入实验员姓名"
          />
          <ProFormSelect
            name="experimentStatus"
            label="实验状态"
            options={[
              { label: '待执行', value: '待执行' },
              { label: '执行中', value: '执行中' },
              { label: '已完成', value: '已完成' },
              { label: '已取消', value: '已取消' },
            ]}
            initialValue="待执行"
          />
          <ProFormSelect
            name="confirmationStatus"
            label="确认状态"
            options={[
              { label: '待确认', value: '待确认' },
              { label: '已确认', value: '已确认' },
              { label: '已拒绝', value: '已拒绝' },
            ]}
            initialValue="待确认"
          />
          <ProFormDigit
            name="confirmationPersonId"
            label="确认人ID"
            placeholder="请输入确认人ID"
          />
          <ProFormText
            name="confirmationPersonName"
            label="确认人姓名"
            placeholder="请输入确认人姓名"
          />
          <ProFormSelect
            name="status"
            label="状态"
            options={[
              { label: '草稿', value: '草稿' },
              { label: '执行中', value: '执行中' },
              { label: '已完成', value: '已完成' },
            ]}
            initialValue="草稿"
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
        title="实验管理详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        width={600}
      >
        {detailLoading ? (
          <div>加载中...</div>
        ) : experimentDetail ? (
          <ProDescriptions<ExperimentManagement>
            column={1}
            dataSource={experimentDetail}
            columns={[
              { title: '实验编号', dataIndex: 'experimentNo' },
              { title: '实验名称', dataIndex: 'experimentName' },
              { title: '实验类型', dataIndex: 'experimentType' },
              { title: '样品ID', dataIndex: 'sampleId' },
              { title: '样品UUID', dataIndex: 'sampleUuid' },
              { title: '样品编号', dataIndex: 'sampleNo' },
              { title: '计划开始日期', dataIndex: 'planStartDate', valueType: 'dateTime' },
              { title: '计划结束日期', dataIndex: 'planEndDate', valueType: 'dateTime' },
              { title: '实际开始日期', dataIndex: 'actualStartDate', valueType: 'dateTime' },
              { title: '实际结束日期', dataIndex: 'actualEndDate', valueType: 'dateTime' },
              { title: '实验员ID', dataIndex: 'experimenterId' },
              { title: '实验员姓名', dataIndex: 'experimenterName' },
              { title: '实验状态', dataIndex: 'experimentStatus' },
              { title: '确认状态', dataIndex: 'confirmationStatus' },
              { title: '确认人ID', dataIndex: 'confirmationPersonId' },
              { title: '确认人姓名', dataIndex: 'confirmationPersonName' },
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

export default ExperimentManagementsPage;

