/**
 * 生产计划管理页面
 * 
 * 提供生产计划的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProForm, ProFormText, ProFormSelect, ProFormTextArea, ProFormInstance, ProDescriptions, ProFormDigit, ProFormDatePicker } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Modal, Drawer } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '@/components/uni_table';
import { productionPlanApi } from '../../services/process';
import type { ProductionPlan, ProductionPlanCreate, ProductionPlanUpdate } from '../../types/process';

/**
 * 生产计划管理列表页面组件
 */
const ProductionPlansPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentPlanUuid, setCurrentPlanUuid] = useState<string | null>(null);
  const [planDetail, setPlanDetail] = useState<ProductionPlan | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Modal 相关状态（创建/编辑生产计划）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  /**
   * 处理新建生产计划
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentPlanUuid(null);
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      priority: '普通',
      status: '草稿',
    });
  };

  /**
   * 处理编辑生产计划
   */
  const handleEdit = async (record: ProductionPlan) => {
    try {
      setIsEdit(true);
      setCurrentPlanUuid(record.uuid);
      setModalVisible(true);
      
      // 获取生产计划详情
      const detail = await productionPlanApi.get(record.uuid);
      formRef.current?.setFieldsValue({
        planNo: detail.planNo,
        planName: detail.planName,
        planType: detail.planType,
        sourceType: detail.sourceType,
        sourceId: detail.sourceId,
        sourceNo: detail.sourceNo,
        productId: detail.productId,
        productName: detail.productName,
        productCode: detail.productCode,
        plannedQuantity: detail.plannedQuantity,
        plannedStartDate: detail.plannedStartDate,
        plannedEndDate: detail.plannedEndDate,
        actualStartDate: detail.actualStartDate,
        actualEndDate: detail.actualEndDate,
        priority: detail.priority,
        optimizationTarget: detail.optimizationTarget,
        status: detail.status,
        remark: detail.remark,
      });
    } catch (error: any) {
      messageApi.error(error.message || '获取生产计划详情失败');
    }
  };

  /**
   * 处理删除生产计划
   */
  const handleDelete = async (record: ProductionPlan) => {
    try {
      await productionPlanApi.delete(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理打开详情
   */
  const handleOpenDetail = async (record: ProductionPlan) => {
    try {
      setCurrentPlanUuid(record.uuid);
      setDrawerVisible(true);
      setDetailLoading(true);
      
      const detail = await productionPlanApi.get(record.uuid);
      setPlanDetail(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取生产计划详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理提交表单
   */
  const handleSubmit = async (values: ProductionPlanCreate | ProductionPlanUpdate) => {
    try {
      setFormLoading(true);
      
      if (isEdit && currentPlanUuid) {
        await productionPlanApi.update(currentPlanUuid, values as ProductionPlanUpdate);
        messageApi.success('更新成功');
      } else {
        await productionPlanApi.create(values as ProductionPlanCreate);
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
  const columns: ProColumns<ProductionPlan>[] = [
    {
      title: '计划编号',
      dataIndex: 'planNo',
      width: 150,
      ellipsis: true,
      render: (_, record) => (
        <a onClick={() => handleOpenDetail(record)}>{record.planNo}</a>
      ),
    },
    {
      title: '计划名称',
      dataIndex: 'planName',
      width: 200,
      ellipsis: true,
    },
    {
      title: '计划类型',
      dataIndex: 'planType',
      width: 120,
      valueType: 'select',
      valueEnum: {
        '主生产计划': { text: '主生产计划' },
        '详细排产': { text: '详细排产' },
      },
    },
    {
      title: '产品名称',
      dataIndex: 'productName',
      width: 150,
      ellipsis: true,
    },
    {
      title: '计划数量',
      dataIndex: 'plannedQuantity',
      width: 120,
      valueType: 'digit',
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
      title: '优先级',
      dataIndex: 'priority',
      width: 100,
      valueType: 'select',
      valueEnum: {
        '高': { text: <Tag color="red">高</Tag> },
        '中': { text: <Tag color="orange">中</Tag> },
        '普通': { text: <Tag color="default">普通</Tag> },
        '低': { text: <Tag color="blue">低</Tag> },
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueType: 'select',
      valueEnum: {
        '草稿': { text: <Tag color="default">草稿</Tag> },
        '已确认': { text: <Tag color="blue">已确认</Tag> },
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
            title="确定要删除这条生产计划吗？"
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
      <UniTable<ProductionPlan>
        headerTitle="生产计划管理"
        actionRef={actionRef}
        columns={columns}
        request={async (params) => {
          const { current = 1, pageSize = 20, ...rest } = params;
          const skip = (current - 1) * pageSize;
          const data = await productionPlanApi.list({
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
            新建生产计划
          </Button>,
        ]}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
      />

      {/* 创建/编辑 Modal */}
      <Modal
        title={isEdit ? '编辑生产计划' : '新建生产计划'}
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
            name="planNo"
            label="计划编号"
            rules={[{ required: true, message: '请输入计划编号' }]}
            placeholder="请输入计划编号"
            disabled={isEdit}
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
              { label: '主生产计划', value: '主生产计划' },
              { label: '详细排产', value: '详细排产' },
            ]}
            rules={[{ required: true, message: '请选择计划类型' }]}
          />
          <ProFormText
            name="sourceType"
            label="来源类型"
            placeholder="请输入来源类型"
          />
          <ProFormDigit
            name="sourceId"
            label="来源ID"
            placeholder="请输入来源ID"
          />
          <ProFormText
            name="sourceNo"
            label="来源编号"
            placeholder="请输入来源编号"
          />
          <ProFormDigit
            name="productId"
            label="产品ID"
            placeholder="请输入产品ID"
          />
          <ProFormText
            name="productName"
            label="产品名称"
            placeholder="请输入产品名称"
          />
          <ProFormText
            name="productCode"
            label="产品编码"
            placeholder="请输入产品编码"
          />
          <ProFormDigit
            name="plannedQuantity"
            label="计划数量"
            placeholder="请输入计划数量"
            min={0}
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
          <ProFormDatePicker
            name="actualStartDate"
            label="实际开始日期"
            placeholder="请选择实际开始日期"
          />
          <ProFormDatePicker
            name="actualEndDate"
            label="实际结束日期"
            placeholder="请选择实际结束日期"
          />
          <ProFormSelect
            name="priority"
            label="优先级"
            options={[
              { label: '高', value: '高' },
              { label: '中', value: '中' },
              { label: '普通', value: '普通' },
              { label: '低', value: '低' },
            ]}
            initialValue="普通"
          />
          <ProFormText
            name="optimizationTarget"
            label="优化目标"
            placeholder="请输入优化目标（交期、成本、效率）"
          />
          <ProFormSelect
            name="status"
            label="状态"
            options={[
              { label: '草稿', value: '草稿' },
              { label: '已确认', value: '已确认' },
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
        title="生产计划详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        width={600}
      >
        {detailLoading ? (
          <div>加载中...</div>
        ) : planDetail ? (
          <ProDescriptions<ProductionPlan>
            column={1}
            dataSource={planDetail}
            columns={[
              { title: '计划编号', dataIndex: 'planNo' },
              { title: '计划名称', dataIndex: 'planName' },
              { title: '计划类型', dataIndex: 'planType' },
              { title: '来源类型', dataIndex: 'sourceType' },
              { title: '来源ID', dataIndex: 'sourceId' },
              { title: '来源编号', dataIndex: 'sourceNo' },
              { title: '产品ID', dataIndex: 'productId' },
              { title: '产品名称', dataIndex: 'productName' },
              { title: '产品编码', dataIndex: 'productCode' },
              { title: '计划数量', dataIndex: 'plannedQuantity' },
              { title: '计划开始日期', dataIndex: 'plannedStartDate', valueType: 'dateTime' },
              { title: '计划结束日期', dataIndex: 'plannedEndDate', valueType: 'dateTime' },
              { title: '实际开始日期', dataIndex: 'actualStartDate', valueType: 'dateTime' },
              { title: '实际结束日期', dataIndex: 'actualEndDate', valueType: 'dateTime' },
              { title: '优先级', dataIndex: 'priority' },
              { title: '优化目标', dataIndex: 'optimizationTarget' },
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

export default ProductionPlansPage;

