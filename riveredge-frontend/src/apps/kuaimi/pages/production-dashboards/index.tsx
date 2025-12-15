/**
 * 实时生产看板管理页面
 * 
 * 提供实时生产看板的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProForm, ProFormText, ProFormSelect, ProFormTextArea, ProFormInstance, ProDescriptions, ProFormDigit, ProFormDatePicker } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Modal, Drawer } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '@/components/uni_table';
import { productionDashboardApi } from '../../services/process';
import type { ProductionDashboard, ProductionDashboardCreate, ProductionDashboardUpdate } from '../../types/process';

/**
 * 实时生产看板管理列表页面组件
 */
const ProductionDashboardsPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentDashboardUuid, setCurrentDashboardUuid] = useState<string | null>(null);
  const [dashboardDetail, setDashboardDetail] = useState<ProductionDashboard | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Modal 相关状态（创建/编辑实时生产看板）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  /**
   * 处理新建实时生产看板
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentDashboardUuid(null);
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      alertLevel: '正常',
      alertStatus: '正常',
      productionStatus: '运行中',
      status: '启用',
    });
  };

  /**
   * 处理编辑实时生产看板
   */
  const handleEdit = async (record: ProductionDashboard) => {
    try {
      setIsEdit(true);
      setCurrentDashboardUuid(record.uuid);
      setModalVisible(true);
      
      // 获取实时生产看板详情
      const detail = await productionDashboardApi.get(record.uuid);
      formRef.current?.setFieldsValue({
        dashboardNo: detail.dashboardNo,
        dashboardName: detail.dashboardName,
        dashboardType: detail.dashboardType,
        productionLineId: detail.productionLineId,
        productionLineName: detail.productionLineName,
        alertLevel: detail.alertLevel,
        alertCategory: detail.alertCategory,
        alertStatus: detail.alertStatus,
        alertTime: detail.alertTime,
        alertDescription: detail.alertDescription,
        handlerId: detail.handlerId,
        handlerName: detail.handlerName,
        handleTime: detail.handleTime,
        handleResult: detail.handleResult,
        productionStatus: detail.productionStatus,
        status: detail.status,
        remark: detail.remark,
      });
    } catch (error: any) {
      messageApi.error(error.message || '获取实时生产看板详情失败');
    }
  };

  /**
   * 处理删除实时生产看板
   */
  const handleDelete = async (record: ProductionDashboard) => {
    try {
      await productionDashboardApi.delete(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理打开详情
   */
  const handleOpenDetail = async (record: ProductionDashboard) => {
    try {
      setCurrentDashboardUuid(record.uuid);
      setDrawerVisible(true);
      setDetailLoading(true);
      
      const detail = await productionDashboardApi.get(record.uuid);
      setDashboardDetail(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取实时生产看板详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理提交表单
   */
  const handleSubmit = async (values: ProductionDashboardCreate | ProductionDashboardUpdate) => {
    try {
      setFormLoading(true);
      
      if (isEdit && currentDashboardUuid) {
        await productionDashboardApi.update(currentDashboardUuid, values as ProductionDashboardUpdate);
        messageApi.success('更新成功');
      } else {
        await productionDashboardApi.create(values as ProductionDashboardCreate);
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
  const columns: ProColumns<ProductionDashboard>[] = [
    {
      title: '看板编号',
      dataIndex: 'dashboardNo',
      width: 150,
      ellipsis: true,
      render: (_, record) => (
        <a onClick={() => handleOpenDetail(record)}>{record.dashboardNo}</a>
      ),
    },
    {
      title: '看板名称',
      dataIndex: 'dashboardName',
      width: 200,
      ellipsis: true,
    },
    {
      title: '看板类型',
      dataIndex: 'dashboardType',
      width: 120,
      valueType: 'select',
      valueEnum: {
        'Andon系统': { text: 'Andon系统' },
        '生产状态监控': { text: '生产状态监控' },
        '异常预警': { text: '异常预警' },
      },
    },
    {
      title: '产线名称',
      dataIndex: 'productionLineName',
      width: 150,
      ellipsis: true,
    },
    {
      title: '预警等级',
      dataIndex: 'alertLevel',
      width: 120,
      valueType: 'select',
      valueEnum: {
        '正常': { text: <Tag color="green">正常</Tag> },
        '预警': { text: <Tag color="orange">预警</Tag> },
        '紧急': { text: <Tag color="red">紧急</Tag> },
      },
    },
    {
      title: '预警状态',
      dataIndex: 'alertStatus',
      width: 120,
      valueType: 'select',
      valueEnum: {
        '正常': { text: <Tag color="green">正常</Tag> },
        '已预警': { text: <Tag color="orange">已预警</Tag> },
        '已处理': { text: <Tag color="blue">已处理</Tag> },
      },
    },
    {
      title: '生产状态',
      dataIndex: 'productionStatus',
      width: 120,
      valueType: 'select',
      valueEnum: {
        '运行中': { text: <Tag color="green">运行中</Tag> },
        '已停止': { text: <Tag color="default">已停止</Tag> },
        '异常': { text: <Tag color="red">异常</Tag> },
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueType: 'select',
      valueEnum: {
        '启用': { text: <Tag color="green">启用</Tag> },
        '停用': { text: <Tag color="default">停用</Tag> },
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
            title="确定要删除这条实时生产看板吗？"
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
      <UniTable<ProductionDashboard>
        headerTitle="实时生产看板管理"
        actionRef={actionRef}
        columns={columns}
        request={async (params) => {
          const { current = 1, pageSize = 20, ...rest } = params;
          const skip = (current - 1) * pageSize;
          const data = await productionDashboardApi.list({
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
            新建实时生产看板
          </Button>,
        ]}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
      />

      {/* 创建/编辑 Modal */}
      <Modal
        title={isEdit ? '编辑实时生产看板' : '新建实时生产看板'}
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
            name="dashboardNo"
            label="看板编号"
            rules={[{ required: true, message: '请输入看板编号' }]}
            placeholder="请输入看板编号"
            disabled={isEdit}
          />
          <ProFormText
            name="dashboardName"
            label="看板名称"
            rules={[{ required: true, message: '请输入看板名称' }]}
            placeholder="请输入看板名称"
          />
          <ProFormSelect
            name="dashboardType"
            label="看板类型"
            options={[
              { label: 'Andon系统', value: 'Andon系统' },
              { label: '生产状态监控', value: '生产状态监控' },
              { label: '异常预警', value: '异常预警' },
            ]}
            rules={[{ required: true, message: '请选择看板类型' }]}
          />
          <ProFormDigit
            name="productionLineId"
            label="产线ID"
            placeholder="请输入产线ID"
          />
          <ProFormText
            name="productionLineName"
            label="产线名称"
            placeholder="请输入产线名称"
          />
          <ProFormSelect
            name="alertLevel"
            label="预警等级"
            options={[
              { label: '正常', value: '正常' },
              { label: '预警', value: '预警' },
              { label: '紧急', value: '紧急' },
            ]}
            initialValue="正常"
          />
          <ProFormText
            name="alertCategory"
            label="预警分类"
            placeholder="请输入预警分类"
          />
          <ProFormSelect
            name="alertStatus"
            label="预警状态"
            options={[
              { label: '正常', value: '正常' },
              { label: '已预警', value: '已预警' },
              { label: '已处理', value: '已处理' },
            ]}
            initialValue="正常"
          />
          <ProFormDatePicker
            name="alertTime"
            label="预警时间"
            placeholder="请选择预警时间"
            showTime
          />
          <ProFormTextArea
            name="alertDescription"
            label="预警描述"
            placeholder="请输入预警描述"
          />
          <ProFormDigit
            name="handlerId"
            label="处理人ID"
            placeholder="请输入处理人ID"
          />
          <ProFormText
            name="handlerName"
            label="处理人姓名"
            placeholder="请输入处理人姓名"
          />
          <ProFormDatePicker
            name="handleTime"
            label="处理时间"
            placeholder="请选择处理时间"
            showTime
          />
          <ProFormTextArea
            name="handleResult"
            label="处理结果"
            placeholder="请输入处理结果"
          />
          <ProFormSelect
            name="productionStatus"
            label="生产状态"
            options={[
              { label: '运行中', value: '运行中' },
              { label: '已停止', value: '已停止' },
              { label: '异常', value: '异常' },
            ]}
            initialValue="运行中"
          />
          <ProFormSelect
            name="status"
            label="状态"
            options={[
              { label: '启用', value: '启用' },
              { label: '停用', value: '停用' },
            ]}
            initialValue="启用"
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
        title="实时生产看板详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        width={600}
      >
        {detailLoading ? (
          <div>加载中...</div>
        ) : dashboardDetail ? (
          <ProDescriptions<ProductionDashboard>
            column={1}
            dataSource={dashboardDetail}
            columns={[
              { title: '看板编号', dataIndex: 'dashboardNo' },
              { title: '看板名称', dataIndex: 'dashboardName' },
              { title: '看板类型', dataIndex: 'dashboardType' },
              { title: '产线ID', dataIndex: 'productionLineId' },
              { title: '产线名称', dataIndex: 'productionLineName' },
              { title: '预警等级', dataIndex: 'alertLevel' },
              { title: '预警分类', dataIndex: 'alertCategory' },
              { title: '预警状态', dataIndex: 'alertStatus' },
              { title: '预警时间', dataIndex: 'alertTime', valueType: 'dateTime' },
              { title: '预警描述', dataIndex: 'alertDescription' },
              { title: '处理人ID', dataIndex: 'handlerId' },
              { title: '处理人姓名', dataIndex: 'handlerName' },
              { title: '处理时间', dataIndex: 'handleTime', valueType: 'dateTime' },
              { title: '处理结果', dataIndex: 'handleResult' },
              { title: '生产状态', dataIndex: 'productionStatus' },
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

export default ProductionDashboardsPage;

