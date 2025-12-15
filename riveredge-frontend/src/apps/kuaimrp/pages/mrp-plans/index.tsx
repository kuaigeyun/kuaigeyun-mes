/**
 * MRP计划管理页面
 * 
 * 提供MRP计划的 CRUD 功能，包括列表展示、创建、编辑、删除、计算等操作。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProForm, ProFormText, ProFormSelect, ProFormDatePicker, ProFormInstance, ProDescriptions } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Modal, Drawer, message } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined, CalculatorOutlined } from '@ant-design/icons';
import { UniTable } from '@/components/uni_table';
import { mrpPlanApi } from '../../services/process';
import type { MRPPlan, MRPPlanCreate, MRPPlanUpdate } from '../../types/process';

/**
 * MRP计划管理列表页面组件
 */
const MRPPlansPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentPlanUuid, setCurrentPlanUuid] = useState<string | null>(null);
  const [planDetail, setPlanDetail] = useState<MRPPlan | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Modal 相关状态（创建/编辑计划）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  /**
   * 处理新建计划
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentPlanUuid(null);
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      planType: 'MRP',
      status: '草稿',
    });
  };

  /**
   * 处理编辑计划
   */
  const handleEdit = async (record: MRPPlan) => {
    try {
      setIsEdit(true);
      setCurrentPlanUuid(record.uuid);
      setModalVisible(true);
      
      const detail = await mrpPlanApi.get(record.uuid);
      formRef.current?.setFieldsValue({
        planNo: detail.planNo,
        planName: detail.planName,
        planType: detail.planType,
        planDate: detail.planDate,
        startDate: detail.startDate,
        endDate: detail.endDate,
      });
    } catch (error: any) {
      messageApi.error(error.message || '获取计划详情失败');
    }
  };

  /**
   * 处理删除计划
   */
  const handleDelete = async (record: MRPPlan) => {
    try {
      await mrpPlanApi.delete(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理打开详情
   */
  const handleOpenDetail = async (record: MRPPlan) => {
    try {
      setCurrentPlanUuid(record.uuid);
      setDrawerVisible(true);
      setDetailLoading(true);
      
      const detail = await mrpPlanApi.get(record.uuid);
      setPlanDetail(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取计划详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理执行MRP计算
   */
  const handleCalculate = async (record: MRPPlan) => {
    Modal.confirm({
      title: '执行MRP计算',
      content: `确定要执行计划 ${record.planNo} 的MRP计算吗？`,
      onOk: async () => {
        try {
          await mrpPlanApi.calculate(record.uuid);
          messageApi.success('MRP计算已启动');
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '执行MRP计算失败');
        }
      },
    });
  };

  /**
   * 处理提交表单
   */
  const handleSubmit = async (values: MRPPlanCreate | MRPPlanUpdate) => {
    try {
      setFormLoading(true);
      
      if (isEdit && currentPlanUuid) {
        await mrpPlanApi.update(currentPlanUuid, values as MRPPlanUpdate);
        messageApi.success('更新成功');
      } else {
        await mrpPlanApi.create(values as MRPPlanCreate);
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
  const columns: ProColumns<MRPPlan>[] = [
    {
      title: '计划编号',
      dataIndex: 'planNo',
      width: 150,
      fixed: 'left',
      render: (_, record) => (
        <a onClick={() => handleOpenDetail(record)}>{record.planNo}</a>
      ),
    },
    {
      title: '计划名称',
      dataIndex: 'planName',
      width: 200,
    },
    {
      title: '计划类型',
      dataIndex: 'planType',
      width: 100,
      valueType: 'select',
      valueEnum: {
        'MRP': { text: <Tag color="blue">MRP</Tag> },
        'LRP': { text: <Tag color="green">LRP</Tag> },
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueType: 'select',
      valueEnum: {
        '草稿': { text: <Tag color="default">草稿</Tag> },
        '计算中': { text: <Tag color="orange">计算中</Tag> },
        '已完成': { text: <Tag color="green">已完成</Tag> },
        '已关闭': { text: <Tag color="default">已关闭</Tag> },
      },
    },
    {
      title: '计划日期',
      dataIndex: 'planDate',
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
          {record.status === '草稿' && (
            <Button
              type="link"
              size="small"
              icon={<CalculatorOutlined />}
              onClick={() => handleCalculate(record)}
            >
              计算
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
            title="确定要删除这条计划吗？"
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
      <UniTable<MRPPlan>
        headerTitle="MRP计划管理"
        actionRef={actionRef}
        columns={columns}
        request={async (params) => {
          const { current = 1, pageSize = 20, ...rest } = params;
          const skip = (current - 1) * pageSize;
          const data = await mrpPlanApi.list({
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
            新建计划
          </Button>,
        ]}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
      />

      {/* 创建/编辑 Modal */}
      <Modal
        title={isEdit ? '编辑MRP计划' : '新建MRP计划'}
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
            name="planNo"
            label="计划编号"
            rules={[{ required: true, message: '请输入计划编号' }]}
            placeholder="请输入计划编号"
          />
          <ProFormText
            name="planName"
            label="计划名称"
            rules={[{ required: true, message: '请输入计划名称' }]}
            placeholder="请输入计划名称"
          />
          <ProFormSelect
            name="planType"
            label="计划类型"
            options={[
              { label: 'MRP', value: 'MRP' },
              { label: 'LRP', value: 'LRP' },
            ]}
            rules={[{ required: true, message: '请选择计划类型' }]}
          />
          <ProFormDatePicker
            name="planDate"
            label="计划日期"
            rules={[{ required: true, message: '请选择计划日期' }]}
          />
        </ProForm>
      </Modal>

      {/* 详情 Drawer */}
      <Drawer
        title="MRP计划详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        width={600}
      >
        {detailLoading ? (
          <div>加载中...</div>
        ) : planDetail ? (
          <ProDescriptions<MRPPlan>
            column={1}
            dataSource={planDetail}
            columns={[
              { title: '计划编号', dataIndex: 'planNo' },
              { title: '计划名称', dataIndex: 'planName' },
              { title: '计划类型', dataIndex: 'planType' },
              { title: '状态', dataIndex: 'status' },
              { title: '计划日期', dataIndex: 'planDate', valueType: 'dateTime' },
              { title: '开始日期', dataIndex: 'startDate', valueType: 'dateTime' },
              { title: '结束日期', dataIndex: 'endDate', valueType: 'dateTime' },
              { title: '创建时间', dataIndex: 'createdAt', valueType: 'dateTime' },
              { title: '更新时间', dataIndex: 'updatedAt', valueType: 'dateTime' },
            ]}
          />
        ) : null}
      </Drawer>
    </div>
  );
};

export default MRPPlansPage;
