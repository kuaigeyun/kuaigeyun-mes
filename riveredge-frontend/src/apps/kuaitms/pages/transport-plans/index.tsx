/**
 * 运输计划管理页面
 * 
 * 提供运输计划的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProForm, ProFormText, ProFormSelect, ProFormTextArea, ProFormInstance, ProDescriptions, ProFormDigit, ProFormDatePicker } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Modal, Drawer, message } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../components/uni-table';
import { transportPlanApi } from '../../services/process';
import type { TransportPlan, TransportPlanCreate, TransportPlanUpdate } from '../../types/process';

/**
 * 运输计划管理列表页面组件
 */
const TransportPlansPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentPlanUuid, setCurrentPlanUuid] = useState<string | null>(null);
  const [planDetail, setPlanDetail] = useState<TransportPlan | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Modal 相关状态（创建/编辑运输计划）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  /**
   * 处理新建运输计划
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentPlanUuid(null);
    setModalVisible(true);
    formRef.current?.resetFields();
  };

  /**
   * 处理编辑运输计划
   */
  const handleEdit = async (record: TransportPlan) => {
    try {
      setIsEdit(true);
      setCurrentPlanUuid(record.uuid);
      setModalVisible(true);
      
      const detail = await transportPlanApi.get(record.uuid);
      formRef.current?.setFieldsValue({
        planNo: detail.planNo,
        planName: detail.planName,
        vehicleId: detail.vehicleId,
        vehicleNo: detail.vehicleNo,
        driverId: detail.driverId,
        driverName: detail.driverName,
        routeInfo: detail.routeInfo,
        plannedStartDate: detail.plannedStartDate,
        plannedEndDate: detail.plannedEndDate,
        remark: detail.remark,
      });
    } catch (error: any) {
      messageApi.error(error.message || '获取运输计划详情失败');
    }
  };

  /**
   * 处理删除运输计划
   */
  const handleDelete = async (record: TransportPlan) => {
    try {
      await transportPlanApi.delete(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理打开详情
   */
  const handleOpenDetail = async (record: TransportPlan) => {
    try {
      setCurrentPlanUuid(record.uuid);
      setDrawerVisible(true);
      setDetailLoading(true);
      
      const detail = await transportPlanApi.get(record.uuid);
      setPlanDetail(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取运输计划详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理提交表单
   */
  const handleSubmit = async (values: TransportPlanCreate | TransportPlanUpdate) => {
    try {
      setFormLoading(true);
      
      if (isEdit && currentPlanUuid) {
        await transportPlanApi.update(currentPlanUuid, values as TransportPlanUpdate);
        messageApi.success('更新成功');
      } else {
        await transportPlanApi.create(values as TransportPlanCreate);
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
  const columns: ProColumns<TransportPlan>[] = [
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
      title: '车牌号',
      dataIndex: 'vehicleNo',
      width: 120,
      ellipsis: true,
    },
    {
      title: '司机姓名',
      dataIndex: 'driverName',
      width: 100,
      ellipsis: true,
    },
    {
      title: '计划开始时间',
      dataIndex: 'plannedStartDate',
      width: 150,
      valueType: 'dateTime',
    },
    {
      title: '计划结束时间',
      dataIndex: 'plannedEndDate',
      width: 150,
      valueType: 'dateTime',
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueType: 'select',
      valueEnum: {
        '草稿': { text: <Tag color="default">草稿</Tag> },
        '已发布': { text: <Tag color="blue">已发布</Tag> },
        '执行中': { text: <Tag color="orange">执行中</Tag> },
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
            title="确定要删除这条运输计划吗？"
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
      <UniTable<TransportPlan>
        headerTitle="运输计划管理"
        actionRef={actionRef}
        columns={columns}
        request={async (params) => {
          const { current = 1, pageSize = 20, ...rest } = params;
          const skip = (current - 1) * pageSize;
          const data = await transportPlanApi.list({
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
            新建运输计划
          </Button>,
        ]}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
      />

      {/* 创建/编辑 Modal */}
      <Modal
        title={isEdit ? '编辑运输计划' : '新建运输计划'}
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
          />
          <ProFormText
            name="planName"
            label="计划名称"
            rules={[{ required: true, message: '请输入计划名称' }]}
            placeholder="请输入计划名称"
          />
          <ProFormDigit
            name="vehicleId"
            label="车辆ID"
            placeholder="请输入车辆ID"
          />
          <ProFormText
            name="vehicleNo"
            label="车牌号"
            placeholder="请输入车牌号"
          />
          <ProFormDigit
            name="driverId"
            label="司机ID"
            placeholder="请输入司机ID"
          />
          <ProFormText
            name="driverName"
            label="司机姓名"
            placeholder="请输入司机姓名"
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
          <ProFormTextArea
            name="remark"
            label="备注"
            placeholder="请输入备注信息"
          />
        </ProForm>
      </Modal>

      {/* 详情 Drawer */}
      <Drawer
        title="运输计划详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        width={600}
      >
        {detailLoading ? (
          <div>加载中...</div>
        ) : planDetail ? (
          <ProDescriptions<TransportPlan>
            column={1}
            dataSource={planDetail}
            columns={[
              { title: '计划编号', dataIndex: 'planNo' },
              { title: '计划名称', dataIndex: 'planName' },
              { title: '车辆ID', dataIndex: 'vehicleId' },
              { title: '车牌号', dataIndex: 'vehicleNo' },
              { title: '司机ID', dataIndex: 'driverId' },
              { title: '司机姓名', dataIndex: 'driverName' },
              { title: '计划开始时间', dataIndex: 'plannedStartDate', valueType: 'dateTime' },
              { title: '计划结束时间', dataIndex: 'plannedEndDate', valueType: 'dateTime' },
              { title: '实际开始时间', dataIndex: 'actualStartDate', valueType: 'dateTime' },
              { title: '实际结束时间', dataIndex: 'actualEndDate', valueType: 'dateTime' },
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

export default TransportPlansPage;

