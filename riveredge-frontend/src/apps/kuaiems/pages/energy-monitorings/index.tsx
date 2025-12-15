/**
 * 能源监测管理页面
 * 
 * 提供能源监测的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProForm, ProFormText, ProFormSelect, ProFormTextArea, ProFormInstance, ProDescriptions, ProFormDigit, ProFormDatePicker } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Modal, Drawer } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '@/components/uni_table';
import { energyMonitoringApi } from '../../services/process';
import type { EnergyMonitoring, EnergyMonitoringCreate, EnergyMonitoringUpdate } from '../../types/process';

/**
 * 能源监测管理列表页面组件
 */
const EnergyMonitoringsPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentMonitoringUuid, setCurrentMonitoringUuid] = useState<string | null>(null);
  const [monitoringDetail, setMonitoringDetail] = useState<EnergyMonitoring | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Modal 相关状态（创建/编辑能源监测）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  /**
   * 处理新建能源监测
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentMonitoringUuid(null);
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      collectionStatus: '运行中',
      dataQuality: '正常',
      alertStatus: '正常',
      status: '启用',
    });
  };

  /**
   * 处理编辑能源监测
   */
  const handleEdit = async (record: EnergyMonitoring) => {
    try {
      setIsEdit(true);
      setCurrentMonitoringUuid(record.uuid);
      setModalVisible(true);
      
      // 获取能源监测详情
      const detail = await energyMonitoringApi.get(record.uuid);
      formRef.current?.setFieldsValue({
        monitoringNo: detail.monitoringNo,
        monitoringName: detail.monitoringName,
        energyType: detail.energyType,
        deviceId: detail.deviceId,
        deviceName: detail.deviceName,
        collectionFrequency: detail.collectionFrequency,
        currentConsumption: detail.currentConsumption,
        unit: detail.unit,
        collectionStatus: detail.collectionStatus,
        dataQuality: detail.dataQuality,
        lastCollectionTime: detail.lastCollectionTime,
        alertStatus: detail.alertStatus,
        status: detail.status,
        remark: detail.remark,
      });
    } catch (error: any) {
      messageApi.error(error.message || '获取能源监测详情失败');
    }
  };

  /**
   * 处理删除能源监测
   */
  const handleDelete = async (record: EnergyMonitoring) => {
    try {
      await energyMonitoringApi.delete(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理打开详情
   */
  const handleOpenDetail = async (record: EnergyMonitoring) => {
    try {
      setCurrentMonitoringUuid(record.uuid);
      setDrawerVisible(true);
      setDetailLoading(true);
      
      const detail = await energyMonitoringApi.get(record.uuid);
      setMonitoringDetail(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取能源监测详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理提交表单
   */
  const handleSubmit = async (values: EnergyMonitoringCreate | EnergyMonitoringUpdate) => {
    try {
      setFormLoading(true);
      
      if (isEdit && currentMonitoringUuid) {
        await energyMonitoringApi.update(currentMonitoringUuid, values as EnergyMonitoringUpdate);
        messageApi.success('更新成功');
      } else {
        await energyMonitoringApi.create(values as EnergyMonitoringCreate);
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
  const columns: ProColumns<EnergyMonitoring>[] = [
    {
      title: '监测编号',
      dataIndex: 'monitoringNo',
      width: 150,
      ellipsis: true,
      render: (_, record) => (
        <a onClick={() => handleOpenDetail(record)}>{record.monitoringNo}</a>
      ),
    },
    {
      title: '监测名称',
      dataIndex: 'monitoringName',
      width: 200,
      ellipsis: true,
    },
    {
      title: '能源类型',
      dataIndex: 'energyType',
      width: 120,
      valueType: 'select',
      valueEnum: {
        '电': { text: '电' },
        '水': { text: '水' },
        '气': { text: '气' },
        '其他': { text: '其他' },
      },
    },
    {
      title: '设备名称',
      dataIndex: 'deviceName',
      width: 150,
      ellipsis: true,
    },
    {
      title: '当前消耗量',
      dataIndex: 'currentConsumption',
      width: 120,
      valueType: 'digit',
    },
    {
      title: '单位',
      dataIndex: 'unit',
      width: 80,
    },
    {
      title: '采集状态',
      dataIndex: 'collectionStatus',
      width: 120,
      valueType: 'select',
      valueEnum: {
        '运行中': { text: <Tag color="green">运行中</Tag> },
        '已停止': { text: <Tag color="default">已停止</Tag> },
        '异常': { text: <Tag color="red">异常</Tag> },
      },
    },
    {
      title: '数据质量',
      dataIndex: 'dataQuality',
      width: 120,
      valueType: 'select',
      valueEnum: {
        '正常': { text: <Tag color="green">正常</Tag> },
        '异常': { text: <Tag color="red">异常</Tag> },
        '缺失': { text: <Tag color="orange">缺失</Tag> },
      },
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
            title="确定要删除这条能源监测吗？"
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
      <UniTable<EnergyMonitoring>
        headerTitle="能源监测管理"
        actionRef={actionRef}
        columns={columns}
        request={async (params) => {
          const { current = 1, pageSize = 20, ...rest } = params;
          const skip = (current - 1) * pageSize;
          const data = await energyMonitoringApi.list({
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
            新建能源监测
          </Button>,
        ]}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
      />

      {/* 创建/编辑 Modal */}
      <Modal
        title={isEdit ? '编辑能源监测' : '新建能源监测'}
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
            label="监测编号"
            rules={[{ required: true, message: '请输入监测编号' }]}
            placeholder="请输入监测编号"
            disabled={isEdit}
          />
          <ProFormText
            name="monitoringName"
            label="监测名称"
            rules={[{ required: true, message: '请输入监测名称' }]}
            placeholder="请输入监测名称"
          />
          <ProFormSelect
            name="energyType"
            label="能源类型"
            options={[
              { label: '电', value: '电' },
              { label: '水', value: '水' },
              { label: '气', value: '气' },
              { label: '其他', value: '其他' },
            ]}
            rules={[{ required: true, message: '请选择能源类型' }]}
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
          <ProFormDigit
            name="collectionFrequency"
            label="采集频率（秒）"
            placeholder="请输入采集频率"
            min={1}
          />
          <ProFormDigit
            name="currentConsumption"
            label="当前消耗量"
            placeholder="请输入当前消耗量"
            min={0}
          />
          <ProFormText
            name="unit"
            label="单位"
            placeholder="请输入单位（kWh、m³等）"
          />
          <ProFormSelect
            name="collectionStatus"
            label="采集状态"
            options={[
              { label: '运行中', value: '运行中' },
              { label: '已停止', value: '已停止' },
              { label: '异常', value: '异常' },
            ]}
            initialValue="运行中"
          />
          <ProFormSelect
            name="dataQuality"
            label="数据质量"
            options={[
              { label: '正常', value: '正常' },
              { label: '异常', value: '异常' },
              { label: '缺失', value: '缺失' },
            ]}
            initialValue="正常"
          />
          <ProFormDatePicker
            name="lastCollectionTime"
            label="最后采集时间"
            placeholder="请选择最后采集时间"
            showTime
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
        title="能源监测详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        width={600}
      >
        {detailLoading ? (
          <div>加载中...</div>
        ) : monitoringDetail ? (
          <ProDescriptions<EnergyMonitoring>
            column={1}
            dataSource={monitoringDetail}
            columns={[
              { title: '监测编号', dataIndex: 'monitoringNo' },
              { title: '监测名称', dataIndex: 'monitoringName' },
              { title: '能源类型', dataIndex: 'energyType' },
              { title: '设备ID', dataIndex: 'deviceId' },
              { title: '设备名称', dataIndex: 'deviceName' },
              { title: '采集频率（秒）', dataIndex: 'collectionFrequency' },
              { title: '当前消耗量', dataIndex: 'currentConsumption' },
              { title: '单位', dataIndex: 'unit' },
              { title: '采集状态', dataIndex: 'collectionStatus' },
              { title: '数据质量', dataIndex: 'dataQuality' },
              { title: '最后采集时间', dataIndex: 'lastCollectionTime', valueType: 'dateTime' },
              { title: '预警状态', dataIndex: 'alertStatus' },
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

export default EnergyMonitoringsPage;

