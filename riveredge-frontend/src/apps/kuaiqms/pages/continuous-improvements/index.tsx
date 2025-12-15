/**
 * 持续改进管理页面
 * 
 * 提供持续改进的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProForm, ProFormText, ProFormSelect, ProFormDatePicker, ProFormTextArea, ProFormInstance, ProDescriptions } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Modal, Drawer, message } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '@/components/uni_table';
import { continuousImprovementApi } from '../../services/process';
import type { ContinuousImprovement, ContinuousImprovementCreate, ContinuousImprovementUpdate } from '../../types/process';

/**
 * 持续改进管理列表页面组件
 */
const ContinuousImprovementsPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentImprovementUuid, setCurrentImprovementUuid] = useState<string | null>(null);
  const [improvementDetail, setImprovementDetail] = useState<ContinuousImprovement | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Modal 相关状态（创建/编辑改进）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  /**
   * 处理新建改进
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentImprovementUuid(null);
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      status: '计划中',
    });
  };

  /**
   * 处理编辑改进
   */
  const handleEdit = async (record: ContinuousImprovement) => {
    try {
      setIsEdit(true);
      setCurrentImprovementUuid(record.uuid);
      setModalVisible(true);
      
      const detail = await continuousImprovementApi.get(record.uuid);
      formRef.current?.setFieldsValue({
        improvementNo: detail.improvementNo,
        improvementType: detail.improvementType,
        improvementTitle: detail.improvementTitle,
        improvementDescription: detail.improvementDescription,
        improvementPlan: detail.improvementPlan,
        responsiblePersonName: detail.responsiblePersonName,
        plannedStartDate: detail.plannedStartDate,
        plannedEndDate: detail.plannedEndDate,
        remark: detail.remark,
      });
    } catch (error: any) {
      messageApi.error(error.message || '获取改进详情失败');
    }
  };

  /**
   * 处理删除改进
   */
  const handleDelete = async (record: ContinuousImprovement) => {
    try {
      await continuousImprovementApi.delete(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理打开详情
   */
  const handleOpenDetail = async (record: ContinuousImprovement) => {
    try {
      setCurrentImprovementUuid(record.uuid);
      setDrawerVisible(true);
      setDetailLoading(true);
      
      const detail = await continuousImprovementApi.get(record.uuid);
      setImprovementDetail(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取改进详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理提交表单
   */
  const handleSubmit = async (values: ContinuousImprovementCreate | ContinuousImprovementUpdate) => {
    try {
      setFormLoading(true);
      
      if (isEdit && currentImprovementUuid) {
        await continuousImprovementApi.update(currentImprovementUuid, values as ContinuousImprovementUpdate);
        messageApi.success('更新成功');
      } else {
        await continuousImprovementApi.create(values as ContinuousImprovementCreate);
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
  const columns: ProColumns<ContinuousImprovement>[] = [
    {
      title: '改进编号',
      dataIndex: 'improvementNo',
      width: 150,
      fixed: 'left',
      render: (_, record) => (
        <a onClick={() => handleOpenDetail(record)}>{record.improvementNo}</a>
      ),
    },
    {
      title: '改进类型',
      dataIndex: 'improvementType',
      width: 120,
      valueType: 'select',
      valueEnum: {
        '流程改进': { text: <Tag color="blue">流程改进</Tag> },
        '质量改进': { text: <Tag color="green">质量改进</Tag> },
        '效率改进': { text: <Tag color="purple">效率改进</Tag> },
      },
    },
    {
      title: '改进标题',
      dataIndex: 'improvementTitle',
      width: 200,
      ellipsis: true,
    },
    {
      title: '负责人',
      dataIndex: 'responsiblePersonName',
      width: 100,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueType: 'select',
      valueEnum: {
        '计划中': { text: <Tag color="default">计划中</Tag> },
        '执行中': { text: <Tag color="processing">执行中</Tag> },
        '已完成': { text: <Tag color="success">已完成</Tag> },
        '已关闭': { text: <Tag color="default">已关闭</Tag> },
      },
    },
    {
      title: '计划开始日期',
      dataIndex: 'plannedStartDate',
      width: 150,
      valueType: 'dateTime',
    },
    {
      title: '计划结束日期',
      dataIndex: 'plannedEndDate',
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
            title="确定要删除这条改进吗？"
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
      <UniTable<ContinuousImprovement>
        headerTitle="持续改进管理"
        actionRef={actionRef}
        columns={columns}
        request={async (params) => {
          const { current = 1, pageSize = 20, ...rest } = params;
          const skip = (current - 1) * pageSize;
          const data = await continuousImprovementApi.list({
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
            新建改进
          </Button>,
        ]}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
      />

      {/* 创建/编辑 Modal */}
      <Modal
        title={isEdit ? '编辑持续改进' : '新建持续改进'}
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
            name="improvementNo"
            label="改进编号"
            rules={[{ required: true, message: '请输入改进编号' }]}
            placeholder="请输入改进编号"
          />
          <ProFormSelect
            name="improvementType"
            label="改进类型"
            rules={[{ required: true, message: '请选择改进类型' }]}
            options={[
              { label: '流程改进', value: '流程改进' },
              { label: '质量改进', value: '质量改进' },
              { label: '效率改进', value: '效率改进' },
            ]}
          />
          <ProFormText
            name="improvementTitle"
            label="改进标题"
            rules={[{ required: true, message: '请输入改进标题' }]}
            placeholder="请输入改进标题"
          />
          <ProFormTextArea
            name="improvementDescription"
            label="改进描述"
            rules={[{ required: true, message: '请输入改进描述' }]}
            placeholder="请输入改进描述"
          />
          <ProFormTextArea
            name="improvementPlan"
            label="改进计划"
            placeholder="请输入改进计划"
          />
          <ProFormText
            name="responsiblePersonName"
            label="负责人"
            placeholder="请输入负责人姓名"
          />
          <ProFormDatePicker
            name="plannedStartDate"
            label="计划开始日期"
            placeholder="请选择计划开始日期"
          />
          <ProFormDatePicker
            name="plannedEndDate"
            label="计划结束日期"
            placeholder="请选择计划结束日期"
          />
        </ProForm>
      </Modal>

      {/* 详情 Drawer */}
      <Drawer
        title="持续改进详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        width={600}
      >
        {detailLoading ? (
          <div>加载中...</div>
        ) : improvementDetail ? (
          <ProDescriptions<ContinuousImprovement>
            column={1}
            dataSource={improvementDetail}
            columns={[
              { title: '改进编号', dataIndex: 'improvementNo' },
              { title: '改进类型', dataIndex: 'improvementType' },
              { title: '改进标题', dataIndex: 'improvementTitle' },
              { title: '改进描述', dataIndex: 'improvementDescription' },
              { title: '改进计划', dataIndex: 'improvementPlan' },
              { title: '负责人', dataIndex: 'responsiblePersonName' },
              { title: '计划开始日期', dataIndex: 'plannedStartDate', valueType: 'dateTime' },
              { title: '计划结束日期', dataIndex: 'plannedEndDate', valueType: 'dateTime' },
              { title: '实际开始日期', dataIndex: 'actualStartDate', valueType: 'dateTime' },
              { title: '实际结束日期', dataIndex: 'actualEndDate', valueType: 'dateTime' },
              { title: '改进结果', dataIndex: 'improvementResult' },
              { title: '有效性评估', dataIndex: 'effectivenessEvaluation' },
              { title: '状态', dataIndex: 'status' },
              { title: '创建时间', dataIndex: 'createdAt', valueType: 'dateTime' },
              { title: '更新时间', dataIndex: 'updatedAt', valueType: 'dateTime' },
            ]}
          />
        ) : null}
      </Drawer>
    </div>
  );
};

export default ContinuousImprovementsPage;
