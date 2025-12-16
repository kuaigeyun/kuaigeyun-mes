/**
 * 计划调整管理页面
 * 
 * 提供计划调整的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProForm, ProFormText, ProFormSelect, ProFormTextArea, ProFormInstance, ProDescriptions, ProFormDatePicker } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Modal, Drawer } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '@/components/uni-table';
import { planAdjustmentApi } from '../../services/process';
import type { PlanAdjustment, PlanAdjustmentCreate, PlanAdjustmentUpdate } from '../../types/process';

/**
 * 计划调整管理列表页面组件
 */
const PlanAdjustmentsPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentAdjustmentUuid, setCurrentAdjustmentUuid] = useState<string | null>(null);
  const [adjustmentDetail, setAdjustmentDetail] = useState<PlanAdjustment | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Modal 相关状态（创建/编辑计划调整）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  /**
   * 处理新建计划调整
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentAdjustmentUuid(null);
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      approvalStatus: '待审批',
      adjustmentStatus: '待执行',
      status: '草稿',
    });
  };

  /**
   * 处理编辑计划调整
   */
  const handleEdit = async (record: PlanAdjustment) => {
    try {
      setIsEdit(true);
      setCurrentAdjustmentUuid(record.uuid);
      setModalVisible(true);
      
      // 获取计划调整详情
      const detail = await planAdjustmentApi.get(record.uuid);
      formRef.current?.setFieldsValue({
        adjustmentNo: detail.adjustmentNo,
        adjustmentName: detail.adjustmentName,
        adjustmentType: detail.adjustmentType,
        planId: detail.planId,
        planUuid: detail.planUuid,
        planNo: detail.planNo,
        adjustmentReason: detail.adjustmentReason,
        approvalStatus: detail.approvalStatus,
        approvalPersonId: detail.approvalPersonId,
        approvalPersonName: detail.approvalPersonName,
        approvalDate: detail.approvalDate,
        adjustmentStatus: detail.adjustmentStatus,
        status: detail.status,
        remark: detail.remark,
      });
    } catch (error: any) {
      messageApi.error(error.message || '获取计划调整详情失败');
    }
  };

  /**
   * 处理删除计划调整
   */
  const handleDelete = async (record: PlanAdjustment) => {
    try {
      await planAdjustmentApi.delete(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理打开详情
   */
  const handleOpenDetail = async (record: PlanAdjustment) => {
    try {
      setCurrentAdjustmentUuid(record.uuid);
      setDrawerVisible(true);
      setDetailLoading(true);
      
      const detail = await planAdjustmentApi.get(record.uuid);
      setAdjustmentDetail(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取计划调整详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理提交表单
   */
  const handleSubmit = async (values: PlanAdjustmentCreate | PlanAdjustmentUpdate) => {
    try {
      setFormLoading(true);
      
      if (isEdit && currentAdjustmentUuid) {
        await planAdjustmentApi.update(currentAdjustmentUuid, values as PlanAdjustmentUpdate);
        messageApi.success('更新成功');
      } else {
        await planAdjustmentApi.create(values as PlanAdjustmentCreate);
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
  const columns: ProColumns<PlanAdjustment>[] = [
    {
      title: '调整编号',
      dataIndex: 'adjustmentNo',
      width: 150,
      ellipsis: true,
      render: (_, record) => (
        <a onClick={() => handleOpenDetail(record)}>{record.adjustmentNo}</a>
      ),
    },
    {
      title: '调整名称',
      dataIndex: 'adjustmentName',
      width: 200,
      ellipsis: true,
    },
    {
      title: '调整类型',
      dataIndex: 'adjustmentType',
      width: 120,
      valueType: 'select',
      valueEnum: {
        '计划变更': { text: '计划变更' },
        '紧急插单': { text: '紧急插单' },
        '计划重排': { text: '计划重排' },
      },
    },
    {
      title: '计划编号',
      dataIndex: 'planNo',
      width: 150,
      ellipsis: true,
    },
    {
      title: '调整原因',
      dataIndex: 'adjustmentReason',
      width: 200,
      ellipsis: true,
    },
    {
      title: '审批状态',
      dataIndex: 'approvalStatus',
      width: 120,
      valueType: 'select',
      valueEnum: {
        '待审批': { text: <Tag color="default">待审批</Tag> },
        '审批中': { text: <Tag color="processing">审批中</Tag> },
        '已审批': { text: <Tag color="green">已审批</Tag> },
        '已拒绝': { text: <Tag color="red">已拒绝</Tag> },
      },
    },
    {
      title: '调整状态',
      dataIndex: 'adjustmentStatus',
      width: 120,
      valueType: 'select',
      valueEnum: {
        '待执行': { text: <Tag color="default">待执行</Tag> },
        '执行中': { text: <Tag color="processing">执行中</Tag> },
        '已完成': { text: <Tag color="green">已完成</Tag> },
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
        '已取消': { text: <Tag color="default">已取消</Tag> },
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
            title="确定要删除这条计划调整吗？"
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
      <UniTable<PlanAdjustment>
        headerTitle="计划调整管理"
        actionRef={actionRef}
        columns={columns}
        request={async (params) => {
          const { current = 1, pageSize = 20, ...rest } = params;
          const skip = (current - 1) * pageSize;
          const data = await planAdjustmentApi.list({
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
            新建计划调整
          </Button>,
        ]}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
      />

      {/* 创建/编辑 Modal */}
      <Modal
        title={isEdit ? '编辑计划调整' : '新建计划调整'}
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
            name="adjustmentNo"
            label="调整编号"
            rules={[{ required: true, message: '请输入调整编号' }]}
            placeholder="请输入调整编号"
            disabled={isEdit}
          />
          <ProFormText
            name="adjustmentName"
            label="调整名称"
            rules={[{ required: true, message: '请输入调整名称' }]}
            placeholder="请输入调整名称"
          />
          <ProFormSelect
            name="adjustmentType"
            label="调整类型"
            options={[
              { label: '计划变更', value: '计划变更' },
              { label: '紧急插单', value: '紧急插单' },
              { label: '计划重排', value: '计划重排' },
            ]}
            rules={[{ required: true, message: '请选择调整类型' }]}
          />
          <ProFormDigit
            name="planId"
            label="计划ID"
            placeholder="请输入计划ID"
          />
          <ProFormText
            name="planUuid"
            label="计划UUID"
            placeholder="请输入计划UUID"
          />
          <ProFormText
            name="planNo"
            label="计划编号"
            placeholder="请输入计划编号"
          />
          <ProFormTextArea
            name="adjustmentReason"
            label="调整原因"
            placeholder="请输入调整原因"
          />
          <ProFormSelect
            name="approvalStatus"
            label="审批状态"
            options={[
              { label: '待审批', value: '待审批' },
              { label: '审批中', value: '审批中' },
              { label: '已审批', value: '已审批' },
              { label: '已拒绝', value: '已拒绝' },
            ]}
            initialValue="待审批"
          />
          <ProFormDigit
            name="approvalPersonId"
            label="审批人ID"
            placeholder="请输入审批人ID"
          />
          <ProFormText
            name="approvalPersonName"
            label="审批人姓名"
            placeholder="请输入审批人姓名"
          />
          <ProFormDatePicker
            name="approvalDate"
            label="审批日期"
            placeholder="请选择审批日期"
          />
          <ProFormSelect
            name="adjustmentStatus"
            label="调整状态"
            options={[
              { label: '待执行', value: '待执行' },
              { label: '执行中', value: '执行中' },
              { label: '已完成', value: '已完成' },
            ]}
            initialValue="待执行"
          />
          <ProFormSelect
            name="status"
            label="状态"
            options={[
              { label: '草稿', value: '草稿' },
              { label: '执行中', value: '执行中' },
              { label: '已完成', value: '已完成' },
              { label: '已取消', value: '已取消' },
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
        title="计划调整详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        width={600}
      >
        {detailLoading ? (
          <div>加载中...</div>
        ) : adjustmentDetail ? (
          <ProDescriptions<PlanAdjustment>
            column={1}
            dataSource={adjustmentDetail}
            columns={[
              { title: '调整编号', dataIndex: 'adjustmentNo' },
              { title: '调整名称', dataIndex: 'adjustmentName' },
              { title: '调整类型', dataIndex: 'adjustmentType' },
              { title: '计划ID', dataIndex: 'planId' },
              { title: '计划UUID', dataIndex: 'planUuid' },
              { title: '计划编号', dataIndex: 'planNo' },
              { title: '调整原因', dataIndex: 'adjustmentReason' },
              { title: '审批状态', dataIndex: 'approvalStatus' },
              { title: '审批人ID', dataIndex: 'approvalPersonId' },
              { title: '审批人姓名', dataIndex: 'approvalPersonName' },
              { title: '审批日期', dataIndex: 'approvalDate', valueType: 'dateTime' },
              { title: '调整状态', dataIndex: 'adjustmentStatus' },
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

export default PlanAdjustmentsPage;

