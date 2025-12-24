/**
 * 实时监控管理页面
 * 
 * 提供实时监控的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProForm, ProFormText, ProFormSelect, ProFormTextArea, ProFormInstance, ProDescriptions } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Modal, Drawer } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../components/uni-table';
import { realTimeMonitoringApi } from '../../services/process';
import type { RealTimeMonitoring, RealTimeMonitoringCreate, RealTimeMonitoringUpdate } from '../../types/process';

/**
 * 实时监控管理列表页面组件
 */
const RealTimeMonitoringsPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentMonitoringUuid, setCurrentMonitoringUuid] = useState<string | null>(null);
  const [monitoringDetail, setMonitoringDetail] = useState<RealTimeMonitoring | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Modal 相关状态（创建/编辑实时监控）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  /**
   * 处理新建实时监控
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentMonitoringUuid(null);
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      monitoringType: '设备状态监控',
      alertStatus: '正常',
      status: '启用',
    });
  };

  /**
   * 处理编辑实时监控
   */
  const handleEdit = async (record: RealTimeMonitoring) => {
    try {
      setIsEdit(true);
      setCurrentMonitoringUuid(record.uuid);
      setModalVisible(true);
      
      // 获取实时监控详情
      const detail = await realTimeMonitoringApi.get(record.uuid);
      formRef.current?.setFieldsValue({
        monitoringNo: detail.monitoringNo,
        monitoringName: detail.monitoringName,
        monitoringType: detail.monitoringType,
        deviceId: detail.deviceId,
        deviceName: detail.deviceName,
        monitoringConfig: detail.monitoringConfig,
        alertStatus: detail.alertStatus,
        alertLevel: detail.alertLevel,
        alertDescription: detail.alertDescription,
        status: detail.status,
        remark: detail.remark,
      });
    } catch (error: any) {
      messageApi.error(error.message || '获取实时监控详情失败');
    }
  };

  /**
   * 处理删除实时监控
   */
  const handleDelete = async (record: RealTimeMonitoring) => {
    try {
      await realTimeMonitoringApi.delete(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理打开详情
   */
  const handleOpenDetail = async (record: RealTimeMonitoring) => {
    try {
      setCurrentMonitoringUuid(record.uuid);
      setDrawerVisible(true);
      setDetailLoading(true);
      
      const detail = await realTimeMonitoringApi.get(record.uuid);
      setMonitoringDetail(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取实时监控详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理提交表单
   */
  const handleSubmit = async (values: RealTimeMonitoringCreate | RealTimeMonitoringUpdate) => {
    try {
      setFormLoading(true);
      
      if (isEdit && currentMonitoringUuid) {
        await realTimeMonitoringApi.update(currentMonitoringUuid, values as RealTimeMonitoringUpdate);
        messageApi.success('更新成功');
      } else {
        await realTimeMonitoringApi.create(values as RealTimeMonitoringCreate);
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
  const columns: ProColumns<RealTimeMonitoring>[] = [
    {
      title: '监控编号',
      dataIndex: 'monitoringNo',
      width: 150,
      ellipsis: true,
      render: (_, record) => (
        <a onClick={() => handleOpenDetail(record)}>{record.monitoringNo}</a>
      ),
    },
    {
      title: '监控名称',
      dataIndex: 'monitoringName',
      width: 200,
      ellipsis: true,
    },
    {
      title: '监控类型',
      dataIndex: 'monitoringType',
      width: 150,
      valueType: 'select',
      valueEnum: {
        '设备状态监控': { text: '设备状态监控' },
        '异常预警': { text: '异常预警' },
        '实时看板': { text: '实时看板' },
      },
    },
    {
      title: '设备名称',
      dataIndex: 'deviceName',
      width: 150,
      ellipsis: true,
    },
    {
      title: '预警状态',
      dataIndex: 'alertStatus',
      width: 120,
      valueType: 'select',
      valueEnum: {
        '正常': { text: <Tag color="green">正常</Tag> },
        '预警': { text: <Tag color="orange">预警</Tag> },
        '紧急': { text: <Tag color="red">紧急</Tag> },
      },
    },
    {
      title: '预警等级',
      dataIndex: 'alertLevel',
      width: 100,
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
            title="确定要删除这条实时监控吗？"
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
      <UniTable<RealTimeMonitoring>
        headerTitle="实时监控管理"
        actionRef={actionRef}
        columns={columns}
        request={async (params) => {
          const { current = 1, pageSize = 20, ...rest } = params;
          const skip = (current - 1) * pageSize;
          const data = await realTimeMonitoringApi.list({
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
            新建实时监控
          </Button>,
        ]}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
      />

      {/* 创建/编辑 Modal */}
      <Modal
        title={isEdit ? '编辑实时监控' : '新建实时监控'}
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
            name="monitoringNo"
            label="监控编号"
            rules={[{ required: true, message: '请输入监控编号' }]}
            placeholder="请输入监控编号"
            disabled={isEdit}
          />
          <ProFormText
            name="monitoringName"
            label="监控名称"
            rules={[{ required: true, message: '请输入监控名称' }]}
            placeholder="请输入监控名称"
          />
          <ProFormSelect
            name="monitoringType"
            label="监控类型"
            options={[
              { label: '设备状态监控', value: '设备状态监控' },
              { label: '异常预警', value: '异常预警' },
              { label: '实时看板', value: '实时看板' },
            ]}
            rules={[{ required: true, message: '请选择监控类型' }]}
          />
          <ProFormDigit
            name="deviceId"
            label="设备ID"
            placeholder="请输入设备ID"
          />
          <ProFormText
            name="deviceName"
            label="设备名称"
            placeholder="请输入设备名称"
          />
          <ProFormSelect
            name="alertStatus"
            label="预警状态"
            options={[
              { label: '正常', value: '正常' },
              { label: '预警', value: '预警' },
              { label: '紧急', value: '紧急' },
            ]}
            initialValue="正常"
          />
          <ProFormText
            name="alertLevel"
            label="预警等级"
            placeholder="请输入预警等级"
          />
          <ProFormTextArea
            name="alertDescription"
            label="预警描述"
            placeholder="请输入预警描述"
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
        title="实时监控详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        width={600}
      >
        {detailLoading ? (
          <div>加载中...</div>
        ) : monitoringDetail ? (
          <ProDescriptions<RealTimeMonitoring>
            column={1}
            dataSource={monitoringDetail}
            columns={[
              { title: '监控编号', dataIndex: 'monitoringNo' },
              { title: '监控名称', dataIndex: 'monitoringName' },
              { title: '监控类型', dataIndex: 'monitoringType' },
              { title: '设备ID', dataIndex: 'deviceId' },
              { title: '设备名称', dataIndex: 'deviceName' },
              { title: '预警状态', dataIndex: 'alertStatus' },
              { title: '预警等级', dataIndex: 'alertLevel' },
              { title: '预警描述', dataIndex: 'alertDescription' },
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

export default RealTimeMonitoringsPage;

