/**
 * 传感器数据管理页面
 * 
 * 提供传感器数据的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProForm, ProFormText, ProFormSelect, ProFormTextArea, ProFormInstance, ProDescriptions, ProFormDigit, ProFormDatePicker } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Modal, Drawer } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '@/components/uni-table';
import { sensorDataApi } from '../../services/process';
import type { SensorData, SensorDataCreate, SensorDataUpdate } from '../../types/process';

/**
 * 传感器数据管理列表页面组件
 */
const SensorDatasPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentSensorUuid, setCurrentSensorUuid] = useState<string | null>(null);
  const [sensorDetail, setSensorDetail] = useState<SensorData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Modal 相关状态（创建/编辑传感器数据）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  /**
   * 处理新建传感器数据
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentSensorUuid(null);
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      collectionStatus: '运行中',
      dataQuality: '正常',
      status: '启用',
    });
  };

  /**
   * 处理编辑传感器数据
   */
  const handleEdit = async (record: SensorData) => {
    try {
      setIsEdit(true);
      setCurrentSensorUuid(record.uuid);
      setModalVisible(true);
      
      // 获取传感器数据详情
      const detail = await sensorDataApi.get(record.uuid);
      formRef.current?.setFieldsValue({
        sensorNo: detail.sensorNo,
        sensorName: detail.sensorName,
        sensorType: detail.sensorType,
        deviceId: detail.deviceId,
        deviceName: detail.deviceName,
        collectionFrequency: detail.collectionFrequency,
        lastCollectionTime: detail.lastCollectionTime,
        collectionStatus: detail.collectionStatus,
        dataQuality: detail.dataQuality,
        status: detail.status,
        remark: detail.remark,
      });
    } catch (error: any) {
      messageApi.error(error.message || '获取传感器数据详情失败');
    }
  };

  /**
   * 处理删除传感器数据
   */
  const handleDelete = async (record: SensorData) => {
    try {
      await sensorDataApi.delete(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理打开详情
   */
  const handleOpenDetail = async (record: SensorData) => {
    try {
      setCurrentSensorUuid(record.uuid);
      setDrawerVisible(true);
      setDetailLoading(true);
      
      const detail = await sensorDataApi.get(record.uuid);
      setSensorDetail(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取传感器数据详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理提交表单
   */
  const handleSubmit = async (values: SensorDataCreate | SensorDataUpdate) => {
    try {
      setFormLoading(true);
      
      if (isEdit && currentSensorUuid) {
        await sensorDataApi.update(currentSensorUuid, values as SensorDataUpdate);
        messageApi.success('更新成功');
      } else {
        await sensorDataApi.create(values as SensorDataCreate);
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
  const columns: ProColumns<SensorData>[] = [
    {
      title: '传感器编号',
      dataIndex: 'sensorNo',
      width: 150,
      ellipsis: true,
      render: (_, record) => (
        <a onClick={() => handleOpenDetail(record)}>{record.sensorNo}</a>
      ),
    },
    {
      title: '传感器名称',
      dataIndex: 'sensorName',
      width: 200,
      ellipsis: true,
    },
    {
      title: '传感器类型',
      dataIndex: 'sensorType',
      width: 120,
      valueType: 'select',
      valueEnum: {
        '温度': { text: '温度' },
        '湿度': { text: '湿度' },
        '压力': { text: '压力' },
        '流量': { text: '流量' },
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
      title: '采集频率（秒）',
      dataIndex: 'collectionFrequency',
      width: 120,
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
      title: '最后采集时间',
      dataIndex: 'lastCollectionTime',
      width: 150,
      valueType: 'dateTime',
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
            title="确定要删除这条传感器数据吗？"
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
      <UniTable<SensorData>
        headerTitle="传感器数据管理"
        actionRef={actionRef}
        columns={columns}
        request={async (params) => {
          const { current = 1, pageSize = 20, ...rest } = params;
          const skip = (current - 1) * pageSize;
          const data = await sensorDataApi.list({
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
            新建传感器数据
          </Button>,
        ]}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
      />

      {/* 创建/编辑 Modal */}
      <Modal
        title={isEdit ? '编辑传感器数据' : '新建传感器数据'}
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
            name="sensorNo"
            label="传感器编号"
            rules={[{ required: true, message: '请输入传感器编号' }]}
            placeholder="请输入传感器编号"
            disabled={isEdit}
          />
          <ProFormText
            name="sensorName"
            label="传感器名称"
            rules={[{ required: true, message: '请输入传感器名称' }]}
            placeholder="请输入传感器名称"
          />
          <ProFormSelect
            name="sensorType"
            label="传感器类型"
            options={[
              { label: '温度', value: '温度' },
              { label: '湿度', value: '湿度' },
              { label: '压力', value: '压力' },
              { label: '流量', value: '流量' },
              { label: '其他', value: '其他' },
            ]}
            rules={[{ required: true, message: '请选择传感器类型' }]}
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
          <ProFormDatePicker
            name="lastCollectionTime"
            label="最后采集时间"
            placeholder="请选择最后采集时间"
            showTime
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
        title="传感器数据详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        width={600}
      >
        {detailLoading ? (
          <div>加载中...</div>
        ) : sensorDetail ? (
          <ProDescriptions<SensorData>
            column={1}
            dataSource={sensorDetail}
            columns={[
              { title: '传感器编号', dataIndex: 'sensorNo' },
              { title: '传感器名称', dataIndex: 'sensorName' },
              { title: '传感器类型', dataIndex: 'sensorType' },
              { title: '设备ID', dataIndex: 'deviceId' },
              { title: '设备名称', dataIndex: 'deviceName' },
              { title: '采集频率（秒）', dataIndex: 'collectionFrequency' },
              { title: '最后采集时间', dataIndex: 'lastCollectionTime', valueType: 'dateTime' },
              { title: '采集状态', dataIndex: 'collectionStatus' },
              { title: '数据质量', dataIndex: 'dataQuality' },
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

export default SensorDatasPage;

