/**
 * 设备数据采集管理页面
 * 
 * 提供设备数据采集的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProForm, ProFormText, ProFormSelect, ProFormTextArea, ProFormInstance, ProDescriptions, ProFormDigit, ProFormDatePicker } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Modal, Drawer } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '@/components/uni-table';
import { deviceDataCollectionApi } from '../../services/process';
import type { DeviceDataCollection, DeviceDataCollectionCreate, DeviceDataCollectionUpdate } from '../../types/process';

/**
 * 设备数据采集管理列表页面组件
 */
const DeviceDataCollectionsPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentCollectionUuid, setCurrentCollectionUuid] = useState<string | null>(null);
  const [collectionDetail, setCollectionDetail] = useState<DeviceDataCollection | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Modal 相关状态（创建/编辑设备数据采集）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  /**
   * 处理新建设备数据采集
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentCollectionUuid(null);
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      collectionStatus: '运行中',
      dataQuality: '正常',
      collectionCount: 0,
      errorCount: 0,
      status: '启用',
    });
  };

  /**
   * 处理编辑设备数据采集
   */
  const handleEdit = async (record: DeviceDataCollection) => {
    try {
      setIsEdit(true);
      setCurrentCollectionUuid(record.uuid);
      setModalVisible(true);
      
      // 获取设备数据采集详情
      const detail = await deviceDataCollectionApi.get(record.uuid);
      formRef.current?.setFieldsValue({
        collectionNo: detail.collectionNo,
        collectionName: detail.collectionName,
        deviceId: detail.deviceId,
        deviceName: detail.deviceName,
        collectionPoint: detail.collectionPoint,
        collectionFrequency: detail.collectionFrequency,
        collectionStatus: detail.collectionStatus,
        dataQuality: detail.dataQuality,
        lastCollectionTime: detail.lastCollectionTime,
        collectionCount: detail.collectionCount,
        errorCount: detail.errorCount,
        status: detail.status,
        remark: detail.remark,
      });
    } catch (error: any) {
      messageApi.error(error.message || '获取设备数据采集详情失败');
    }
  };

  /**
   * 处理删除设备数据采集
   */
  const handleDelete = async (record: DeviceDataCollection) => {
    try {
      await deviceDataCollectionApi.delete(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理打开详情
   */
  const handleOpenDetail = async (record: DeviceDataCollection) => {
    try {
      setCurrentCollectionUuid(record.uuid);
      setDrawerVisible(true);
      setDetailLoading(true);
      
      const detail = await deviceDataCollectionApi.get(record.uuid);
      setCollectionDetail(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取设备数据采集详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理提交表单
   */
  const handleSubmit = async (values: DeviceDataCollectionCreate | DeviceDataCollectionUpdate) => {
    try {
      setFormLoading(true);
      
      if (isEdit && currentCollectionUuid) {
        await deviceDataCollectionApi.update(currentCollectionUuid, values as DeviceDataCollectionUpdate);
        messageApi.success('更新成功');
      } else {
        await deviceDataCollectionApi.create(values as DeviceDataCollectionCreate);
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
  const columns: ProColumns<DeviceDataCollection>[] = [
    {
      title: '采集编号',
      dataIndex: 'collectionNo',
      width: 150,
      ellipsis: true,
      render: (_, record) => (
        <a onClick={() => handleOpenDetail(record)}>{record.collectionNo}</a>
      ),
    },
    {
      title: '采集名称',
      dataIndex: 'collectionName',
      width: 200,
      ellipsis: true,
    },
    {
      title: '设备名称',
      dataIndex: 'deviceName',
      width: 150,
      ellipsis: true,
    },
    {
      title: '采集点',
      dataIndex: 'collectionPoint',
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
      title: '采集次数',
      dataIndex: 'collectionCount',
      width: 100,
    },
    {
      title: '错误次数',
      dataIndex: 'errorCount',
      width: 100,
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
            title="确定要删除这条设备数据采集吗？"
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
      <UniTable<DeviceDataCollection>
        headerTitle="设备数据采集管理"
        actionRef={actionRef}
        columns={columns}
        request={async (params) => {
          const { current = 1, pageSize = 20, ...rest } = params;
          const skip = (current - 1) * pageSize;
          const data = await deviceDataCollectionApi.list({
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
            新建设备数据采集
          </Button>,
        ]}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
      />

      {/* 创建/编辑 Modal */}
      <Modal
        title={isEdit ? '编辑设备数据采集' : '新建设备数据采集'}
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
            name="collectionNo"
            label="采集编号"
            rules={[{ required: true, message: '请输入采集编号' }]}
            placeholder="请输入采集编号"
            disabled={isEdit}
          />
          <ProFormText
            name="collectionName"
            label="采集名称"
            rules={[{ required: true, message: '请输入采集名称' }]}
            placeholder="请输入采集名称"
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
          <ProFormText
            name="collectionPoint"
            label="采集点"
            placeholder="请输入采集点"
          />
          <ProFormDigit
            name="collectionFrequency"
            label="采集频率（秒）"
            placeholder="请输入采集频率"
            min={1}
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
          <ProFormDigit
            name="collectionCount"
            label="采集次数"
            placeholder="请输入采集次数"
            min={0}
            initialValue={0}
          />
          <ProFormDigit
            name="errorCount"
            label="错误次数"
            placeholder="请输入错误次数"
            min={0}
            initialValue={0}
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
        title="设备数据采集详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        width={600}
      >
        {detailLoading ? (
          <div>加载中...</div>
        ) : collectionDetail ? (
          <ProDescriptions<DeviceDataCollection>
            column={1}
            dataSource={collectionDetail}
            columns={[
              { title: '采集编号', dataIndex: 'collectionNo' },
              { title: '采集名称', dataIndex: 'collectionName' },
              { title: '设备ID', dataIndex: 'deviceId' },
              { title: '设备名称', dataIndex: 'deviceName' },
              { title: '采集点', dataIndex: 'collectionPoint' },
              { title: '采集频率（秒）', dataIndex: 'collectionFrequency' },
              { title: '采集状态', dataIndex: 'collectionStatus' },
              { title: '数据质量', dataIndex: 'dataQuality' },
              { title: '最后采集时间', dataIndex: 'lastCollectionTime', valueType: 'dateTime' },
              { title: '采集次数', dataIndex: 'collectionCount' },
              { title: '错误次数', dataIndex: 'errorCount' },
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

export default DeviceDataCollectionsPage;

