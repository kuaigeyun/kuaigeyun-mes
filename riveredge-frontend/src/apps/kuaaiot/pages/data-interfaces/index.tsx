/**
 * 数据接口管理页面
 * 
 * 提供数据接口的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProForm, ProFormText, ProFormSelect, ProFormTextArea, ProFormInstance, ProDescriptions } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Modal, Drawer } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../components/uni-table';
import { dataInterfaceApi } from '../../services/process';
import type { DataInterface, DataInterfaceCreate, DataInterfaceUpdate } from '../../types/process';

/**
 * 数据接口管理列表页面组件
 */
const DataInterfacesPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentInterfaceUuid, setCurrentInterfaceUuid] = useState<string | null>(null);
  const [interfaceDetail, setInterfaceDetail] = useState<DataInterface | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Modal 相关状态（创建/编辑数据接口）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  /**
   * 处理新建数据接口
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentInterfaceUuid(null);
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      interfaceType: '查询API',
      status: '启用',
    });
  };

  /**
   * 处理编辑数据接口
   */
  const handleEdit = async (record: DataInterface) => {
    try {
      setIsEdit(true);
      setCurrentInterfaceUuid(record.uuid);
      setModalVisible(true);
      
      // 获取数据接口详情
      const detail = await dataInterfaceApi.get(record.uuid);
      formRef.current?.setFieldsValue({
        interfaceNo: detail.interfaceNo,
        interfaceName: detail.interfaceName,
        interfaceType: detail.interfaceType,
        interfaceUrl: detail.interfaceUrl,
        requestMethod: detail.requestMethod,
        requestFormat: detail.requestFormat,
        responseFormat: detail.responseFormat,
        interfaceConfig: detail.interfaceConfig,
        status: detail.status,
        remark: detail.remark,
      });
    } catch (error: any) {
      messageApi.error(error.message || '获取数据接口详情失败');
    }
  };

  /**
   * 处理删除数据接口
   */
  const handleDelete = async (record: DataInterface) => {
    try {
      await dataInterfaceApi.delete(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理打开详情
   */
  const handleOpenDetail = async (record: DataInterface) => {
    try {
      setCurrentInterfaceUuid(record.uuid);
      setDrawerVisible(true);
      setDetailLoading(true);
      
      const detail = await dataInterfaceApi.get(record.uuid);
      setInterfaceDetail(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取数据接口详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理提交表单
   */
  const handleSubmit = async (values: DataInterfaceCreate | DataInterfaceUpdate) => {
    try {
      setFormLoading(true);
      
      if (isEdit && currentInterfaceUuid) {
        await dataInterfaceApi.update(currentInterfaceUuid, values as DataInterfaceUpdate);
        messageApi.success('更新成功');
      } else {
        await dataInterfaceApi.create(values as DataInterfaceCreate);
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
  const columns: ProColumns<DataInterface>[] = [
    {
      title: '接口编号',
      dataIndex: 'interfaceNo',
      width: 150,
      ellipsis: true,
      render: (_, record) => (
        <a onClick={() => handleOpenDetail(record)}>{record.interfaceNo}</a>
      ),
    },
    {
      title: '接口名称',
      dataIndex: 'interfaceName',
      width: 200,
      ellipsis: true,
    },
    {
      title: '接口类型',
      dataIndex: 'interfaceType',
      width: 120,
      valueType: 'select',
      valueEnum: {
        '查询API': { text: '查询API' },
        '数据推送': { text: '数据推送' },
        '数据订阅': { text: '数据订阅' },
      },
    },
    {
      title: '接口URL',
      dataIndex: 'interfaceUrl',
      width: 200,
      ellipsis: true,
    },
    {
      title: '请求方法',
      dataIndex: 'requestMethod',
      width: 100,
      valueType: 'select',
      valueEnum: {
        'GET': { text: 'GET' },
        'POST': { text: 'POST' },
        'PUT': { text: 'PUT' },
        'DELETE': { text: 'DELETE' },
      },
    },
    {
      title: '请求格式',
      dataIndex: 'requestFormat',
      width: 100,
    },
    {
      title: '响应格式',
      dataIndex: 'responseFormat',
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
            title="确定要删除这条数据接口吗？"
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
      <UniTable<DataInterface>
        headerTitle="数据接口管理"
        actionRef={actionRef}
        columns={columns}
        request={async (params) => {
          const { current = 1, pageSize = 20, ...rest } = params;
          const skip = (current - 1) * pageSize;
          const data = await dataInterfaceApi.list({
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
            新建数据接口
          </Button>,
        ]}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
      />

      {/* 创建/编辑 Modal */}
      <Modal
        title={isEdit ? '编辑数据接口' : '新建数据接口'}
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
            name="interfaceNo"
            label="接口编号"
            rules={[{ required: true, message: '请输入接口编号' }]}
            placeholder="请输入接口编号"
            disabled={isEdit}
          />
          <ProFormText
            name="interfaceName"
            label="接口名称"
            rules={[{ required: true, message: '请输入接口名称' }]}
            placeholder="请输入接口名称"
          />
          <ProFormSelect
            name="interfaceType"
            label="接口类型"
            options={[
              { label: '查询API', value: '查询API' },
              { label: '数据推送', value: '数据推送' },
              { label: '数据订阅', value: '数据订阅' },
            ]}
            rules={[{ required: true, message: '请选择接口类型' }]}
          />
          <ProFormText
            name="interfaceUrl"
            label="接口URL"
            placeholder="请输入接口URL"
          />
          <ProFormSelect
            name="requestMethod"
            label="请求方法"
            options={[
              { label: 'GET', value: 'GET' },
              { label: 'POST', value: 'POST' },
              { label: 'PUT', value: 'PUT' },
              { label: 'DELETE', value: 'DELETE' },
            ]}
          />
          <ProFormText
            name="requestFormat"
            label="请求格式"
            placeholder="请输入请求格式（JSON、XML等）"
          />
          <ProFormText
            name="responseFormat"
            label="响应格式"
            placeholder="请输入响应格式（JSON、XML等）"
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
        title="数据接口详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        width={600}
      >
        {detailLoading ? (
          <div>加载中...</div>
        ) : interfaceDetail ? (
          <ProDescriptions<DataInterface>
            column={1}
            dataSource={interfaceDetail}
            columns={[
              { title: '接口编号', dataIndex: 'interfaceNo' },
              { title: '接口名称', dataIndex: 'interfaceName' },
              { title: '接口类型', dataIndex: 'interfaceType' },
              { title: '接口URL', dataIndex: 'interfaceUrl' },
              { title: '请求方法', dataIndex: 'requestMethod' },
              { title: '请求格式', dataIndex: 'requestFormat' },
              { title: '响应格式', dataIndex: 'responseFormat' },
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

export default DataInterfacesPage;

