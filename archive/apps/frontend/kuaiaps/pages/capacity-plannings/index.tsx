/**
 * 产能规划管理页面
 * 
 * 提供产能规划的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProForm, ProFormText, ProFormSelect, ProFormTextArea, ProFormInstance, ProDescriptions, ProFormDigit, ProFormDatePicker } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Modal, Drawer } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../components/uni-table';
import { capacityPlanningApi } from '../../services/process';
import type { CapacityPlanning, CapacityPlanningCreate, CapacityPlanningUpdate } from '../../types/process';

/**
 * 产能规划管理列表页面组件
 */
const CapacityPlanningsPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentPlanningUuid, setCurrentPlanningUuid] = useState<string | null>(null);
  const [planningDetail, setPlanningDetail] = useState<CapacityPlanning | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Modal 相关状态（创建/编辑产能规划）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  /**
   * 处理新建产能规划
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentPlanningUuid(null);
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      bottleneckStatus: '正常',
      status: '草稿',
    });
  };

  /**
   * 处理编辑产能规划
   */
  const handleEdit = async (record: CapacityPlanning) => {
    try {
      setIsEdit(true);
      setCurrentPlanningUuid(record.uuid);
      setModalVisible(true);
      
      // 获取产能规划详情
      const detail = await capacityPlanningApi.get(record.uuid);
      formRef.current?.setFieldsValue({
        planningNo: detail.planningNo,
        planningName: detail.planningName,
        resourceType: detail.resourceType,
        resourceId: detail.resourceId,
        resourceName: detail.resourceName,
        planningPeriod: detail.planningPeriod,
        planningStartDate: detail.planningStartDate,
        planningEndDate: detail.planningEndDate,
        plannedCapacity: detail.plannedCapacity,
        actualCapacity: detail.actualCapacity,
        utilizationRate: detail.utilizationRate,
        bottleneckStatus: detail.bottleneckStatus,
        optimizationSuggestion: detail.optimizationSuggestion,
        status: detail.status,
        remark: detail.remark,
      });
    } catch (error: any) {
      messageApi.error(error.message || '获取产能规划详情失败');
    }
  };

  /**
   * 处理删除产能规划
   */
  const handleDelete = async (record: CapacityPlanning) => {
    try {
      await capacityPlanningApi.delete(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理打开详情
   */
  const handleOpenDetail = async (record: CapacityPlanning) => {
    try {
      setCurrentPlanningUuid(record.uuid);
      setDrawerVisible(true);
      setDetailLoading(true);
      
      const detail = await capacityPlanningApi.get(record.uuid);
      setPlanningDetail(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取产能规划详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理提交表单
   */
  const handleSubmit = async (values: CapacityPlanningCreate | CapacityPlanningUpdate) => {
    try {
      setFormLoading(true);
      
      if (isEdit && currentPlanningUuid) {
        await capacityPlanningApi.update(currentPlanningUuid, values as CapacityPlanningUpdate);
        messageApi.success('更新成功');
      } else {
        await capacityPlanningApi.create(values as CapacityPlanningCreate);
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
  const columns: ProColumns<CapacityPlanning>[] = [
    {
      title: '规划编号',
      dataIndex: 'planningNo',
      width: 150,
      ellipsis: true,
      render: (_, record) => (
        <a onClick={() => handleOpenDetail(record)}>{record.planningNo}</a>
      ),
    },
    {
      title: '规划名称',
      dataIndex: 'planningName',
      width: 200,
      ellipsis: true,
    },
    {
      title: '资源类型',
      dataIndex: 'resourceType',
      width: 120,
      valueType: 'select',
      valueEnum: {
        '设备': { text: '设备' },
        '人员': { text: '人员' },
        '工装夹具': { text: '工装夹具' },
        '模具': { text: '模具' },
      },
    },
    {
      title: '资源名称',
      dataIndex: 'resourceName',
      width: 150,
      ellipsis: true,
    },
    {
      title: '规划周期',
      dataIndex: 'planningPeriod',
      width: 100,
    },
    {
      title: '计划产能',
      dataIndex: 'plannedCapacity',
      width: 120,
      valueType: 'digit',
    },
    {
      title: '实际产能',
      dataIndex: 'actualCapacity',
      width: 120,
      valueType: 'digit',
    },
    {
      title: '利用率',
      dataIndex: 'utilizationRate',
      width: 100,
      valueType: 'percent',
    },
    {
      title: '瓶颈状态',
      dataIndex: 'bottleneckStatus',
      width: 120,
      valueType: 'select',
      valueEnum: {
        '正常': { text: <Tag color="green">正常</Tag> },
        '瓶颈': { text: <Tag color="red">瓶颈</Tag> },
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueType: 'select',
      valueEnum: {
        '草稿': { text: <Tag color="default">草稿</Tag> },
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
            title="确定要删除这条产能规划吗？"
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
      <UniTable<CapacityPlanning>
        headerTitle="产能规划管理"
        actionRef={actionRef}
        columns={columns}
        request={async (params) => {
          const { current = 1, pageSize = 20, ...rest } = params;
          const skip = (current - 1) * pageSize;
          const data = await capacityPlanningApi.list({
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
            新建产能规划
          </Button>,
        ]}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
      />

      {/* 创建/编辑 Modal */}
      <Modal
        title={isEdit ? '编辑产能规划' : '新建产能规划'}
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
            name="planningNo"
            label="规划编号"
            rules={[{ required: true, message: '请输入规划编号' }]}
            placeholder="请输入规划编号"
            disabled={isEdit}
          />
          <ProFormText
            name="planningName"
            label="规划名称"
            rules={[{ required: true, message: '请输入规划名称' }]}
            placeholder="请输入规划名称"
          />
          <ProFormSelect
            name="resourceType"
            label="资源类型"
            options={[
              { label: '设备', value: '设备' },
              { label: '人员', value: '人员' },
              { label: '工装夹具', value: '工装夹具' },
              { label: '模具', value: '模具' },
            ]}
            rules={[{ required: true, message: '请选择资源类型' }]}
          />
          <ProFormDigit
            name="resourceId"
            label="资源ID"
            placeholder="请输入资源ID"
          />
          <ProFormText
            name="resourceName"
            label="资源名称"
            placeholder="请输入资源名称"
          />
          <ProFormText
            name="planningPeriod"
            label="规划周期"
            placeholder="请输入规划周期（日、周、月、年）"
          />
          <ProFormDatePicker
            name="planningStartDate"
            label="规划开始日期"
            placeholder="请选择规划开始日期"
          />
          <ProFormDatePicker
            name="planningEndDate"
            label="规划结束日期"
            placeholder="请选择规划结束日期"
          />
          <ProFormDigit
            name="plannedCapacity"
            label="计划产能"
            placeholder="请输入计划产能"
          />
          <ProFormDigit
            name="actualCapacity"
            label="实际产能"
            placeholder="请输入实际产能"
          />
          <ProFormDigit
            name="utilizationRate"
            label="利用率"
            placeholder="请输入利用率（百分比）"
            min={0}
            max={100}
          />
          <ProFormSelect
            name="bottleneckStatus"
            label="瓶颈状态"
            options={[
              { label: '正常', value: '正常' },
              { label: '瓶颈', value: '瓶颈' },
            ]}
            initialValue="正常"
          />
          <ProFormTextArea
            name="optimizationSuggestion"
            label="优化建议"
            placeholder="请输入优化建议"
          />
          <ProFormSelect
            name="status"
            label="状态"
            options={[
              { label: '草稿', value: '草稿' },
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
        title="产能规划详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        width={600}
      >
        {detailLoading ? (
          <div>加载中...</div>
        ) : planningDetail ? (
          <ProDescriptions<CapacityPlanning>
            column={1}
            dataSource={planningDetail}
            columns={[
              { title: '规划编号', dataIndex: 'planningNo' },
              { title: '规划名称', dataIndex: 'planningName' },
              { title: '资源类型', dataIndex: 'resourceType' },
              { title: '资源ID', dataIndex: 'resourceId' },
              { title: '资源名称', dataIndex: 'resourceName' },
              { title: '规划周期', dataIndex: 'planningPeriod' },
              { title: '规划开始日期', dataIndex: 'planningStartDate', valueType: 'dateTime' },
              { title: '规划结束日期', dataIndex: 'planningEndDate', valueType: 'dateTime' },
              { title: '计划产能', dataIndex: 'plannedCapacity' },
              { title: '实际产能', dataIndex: 'actualCapacity' },
              { title: '利用率', dataIndex: 'utilizationRate', valueType: 'percent' },
              { title: '瓶颈状态', dataIndex: 'bottleneckStatus' },
              { title: '优化建议', dataIndex: 'optimizationSuggestion' },
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

export default CapacityPlanningsPage;

