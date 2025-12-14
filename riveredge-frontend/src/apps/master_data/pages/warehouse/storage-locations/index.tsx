/**
 * 库位管理页面
 * 
 * 提供库位的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState, useEffect } from 'react';
import { ActionType, ProColumns, ProForm, ProFormText, ProFormTextArea, ProFormSwitch, ProFormSelect, ProFormInstance, ProDescriptions } from '@ant-design/pro-components';
import SafeProFormSelect from '@/components/SafeProFormSelect';
import { App, Popconfirm, Button, Tag, Space, Modal, Drawer, message } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '@/components/uni_table';
import { storageLocationApi, storageAreaApi } from '../../../services/warehouse';
import type { StorageLocation, StorageLocationCreate, StorageLocationUpdate, StorageArea } from '../../../types/warehouse';

/**
 * 库位管理列表页面组件
 */
const StorageLocationsPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentStorageLocationUuid, setCurrentStorageLocationUuid] = useState<string | null>(null);
  const [storageLocationDetail, setStorageLocationDetail] = useState<StorageLocation | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Modal 相关状态（创建/编辑库位）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  
  // 库区列表（用于下拉选择）
  const [storageAreas, setStorageAreas] = useState<StorageArea[]>([]);
  const [storageAreasLoading, setStorageAreasLoading] = useState(false);

  /**
   * 加载库区列表
   */
  useEffect(() => {
    const loadStorageAreas = async () => {
      try {
        setStorageAreasLoading(true);
        const result = await storageAreaApi.list({ limit: 1000, isActive: true });
        setStorageAreas(result);
      } catch (error: any) {
        console.error('加载库区列表失败:', error);
      } finally {
        setStorageAreasLoading(false);
      }
    };
    loadStorageAreas();
  }, []);

  /**
   * 处理新建库位
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentStorageLocationUuid(null);
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      isActive: true,
    });
  };

  /**
   * 处理编辑库位
   */
  const handleEdit = async (record: StorageLocation) => {
    try {
      setIsEdit(true);
      setCurrentStorageLocationUuid(record.uuid);
      setModalVisible(true);
      
      // 获取库位详情
      const detail = await storageLocationApi.get(record.uuid);
      formRef.current?.setFieldsValue({
        code: detail.code,
        name: detail.name,
        storageAreaId: detail.storageAreaId,
        description: detail.description,
        isActive: detail.isActive,
      });
    } catch (error: any) {
      messageApi.error(error.message || '获取库位详情失败');
    }
  };

  /**
   * 处理删除库位
   */
  const handleDelete = async (record: StorageLocation) => {
    try {
      await storageLocationApi.delete(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理打开详情
   */
  const handleOpenDetail = async (record: StorageLocation) => {
    try {
      setCurrentStorageLocationUuid(record.uuid);
      setDrawerVisible(true);
      setDetailLoading(true);
      
      const detail = await storageLocationApi.get(record.uuid);
      setStorageLocationDetail(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取库位详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理关闭详情
   */
  const handleCloseDetail = () => {
    setDrawerVisible(false);
    setCurrentStorageLocationUuid(null);
    setStorageLocationDetail(null);
  };

  /**
   * 处理提交表单（创建/更新库位）
   */
  const handleSubmit = async (values: any) => {
    try {
      setFormLoading(true);
      
      if (isEdit && currentStorageLocationUuid) {
        // 更新库位
        await storageLocationApi.update(currentStorageLocationUuid, values as StorageLocationUpdate);
        messageApi.success('更新成功');
      } else {
        // 创建库位
        await storageLocationApi.create(values as StorageLocationCreate);
        messageApi.success('创建成功');
      }
      
      setModalVisible(false);
      formRef.current?.resetFields();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || (isEdit ? '更新失败' : '创建失败'));
    } finally {
      setFormLoading(false);
    }
  };

  /**
   * 处理关闭 Modal
   */
  const handleCloseModal = () => {
    setModalVisible(false);
    formRef.current?.resetFields();
  };

  /**
   * 获取库区名称
   */
  const getStorageAreaName = (storageAreaId: number): string => {
    const storageArea = storageAreas.find(s => s.id === storageAreaId);
    return storageArea ? `${storageArea.code} - ${storageArea.name}` : `库区ID: ${storageAreaId}`;
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<StorageLocation>[] = [
    {
      title: '库位编码',
      dataIndex: 'code',
      width: 150,
      fixed: 'left',
    },
    {
      title: '库位名称',
      dataIndex: 'name',
      width: 200,
    },
    {
      title: '所属库区',
      dataIndex: 'storageAreaId',
      width: 200,
      hideInSearch: true,
      render: (_, record) => getStorageAreaName(record.storageAreaId),
    },
    {
      title: '描述',
      dataIndex: 'description',
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: '启用状态',
      dataIndex: 'isActive',
      width: 100,
      valueType: 'select',
      valueEnum: {
        true: { text: '启用', status: 'Success' },
        false: { text: '禁用', status: 'Default' },
      },
      render: (_, record) => (
        <Tag color={record.isActive ? 'success' : 'default'}>
          {record.isActive ? '启用' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 180,
      valueType: 'dateTime',
      hideInSearch: true,
      sorter: true,
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
            onClick={() => handleOpenDetail(record)}
          >
            详情
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这个库位吗？"
            onConfirm={() => handleDelete(record)}
          >
            <Button
              type="link"
              danger
              size="small"
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
    <>
      <UniTable<StorageLocation>
        actionRef={actionRef}
        columns={columns}
        request={async (params, sort, _filter, searchFormValues) => {
          // 处理搜索参数
          const apiParams: any = {
            skip: ((params.current || 1) - 1) * (params.pageSize || 20),
            limit: params.pageSize || 20,
          };
          
          // 启用状态筛选
          if (searchFormValues?.isActive !== undefined && searchFormValues.isActive !== '' && searchFormValues.isActive !== null) {
            apiParams.isActive = searchFormValues.isActive;
          }
          
          // 库区筛选
          if (searchFormValues?.storageAreaId !== undefined && searchFormValues.storageAreaId !== '' && searchFormValues.storageAreaId !== null) {
            apiParams.storageAreaId = searchFormValues.storageAreaId;
          }
          
          try {
            const result = await storageLocationApi.list(apiParams);
            return {
              data: result,
              success: true,
              total: result.length,
            };
          } catch (error: any) {
            console.error('获取库位列表失败:', error);
            messageApi.error(error?.message || '获取库位列表失败');
            return {
              data: [],
              success: false,
              total: 0,
            };
          }
        }}
        rowKey="uuid"
        showAdvancedSearch={true}
        pagination={{
          defaultPageSize: 20,
          showSizeChanger: true,
        }}
        toolBarRender={() => [
          <Button
            key="create"
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreate}
          >
            新建库位
          </Button>,
        ]}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
      />

      {/* 详情 Drawer */}
      <Drawer
        title="库位详情"
        size={720}
        open={drawerVisible}
        onClose={handleCloseDetail}
      >
        <ProDescriptions<StorageLocation>
          dataSource={storageLocationDetail}
          loading={detailLoading}
          column={2}
          columns={[
            {
              title: '库位编码',
              dataIndex: 'code',
            },
            {
              title: '库位名称',
              dataIndex: 'name',
            },
            {
              title: '所属库区',
              dataIndex: 'storageAreaId',
              render: (_, record) => getStorageAreaName(record.storageAreaId),
            },
            {
              title: '描述',
              dataIndex: 'description',
              span: 2,
            },
            {
              title: '启用状态',
              dataIndex: 'isActive',
              render: (_, record) => (
                <Tag color={record.isActive ? 'success' : 'default'}>
                  {record.isActive ? '启用' : '禁用'}
                </Tag>
              ),
            },
            {
              title: '创建时间',
              dataIndex: 'createdAt',
              valueType: 'dateTime',
            },
            {
              title: '更新时间',
              dataIndex: 'updatedAt',
              valueType: 'dateTime',
            },
          ]}
        />
      </Drawer>

      {/* 创建/编辑库位 Modal */}
      <Modal
        title={isEdit ? '编辑库位' : '新建库位'}
        open={modalVisible}
        onCancel={handleCloseModal}
        footer={null}
        width={800}
        destroyOnHidden
      >
        <ProForm
          formRef={formRef}
          loading={formLoading}
          onFinish={handleSubmit}
          submitter={{
            searchConfig: {
              submitText: isEdit ? '更新' : '创建',
              resetText: '取消',
            },
            resetButtonProps: {
              onClick: handleCloseModal,
            },
          }}
          initialValues={{
            isActive: true,
          }}
          layout="vertical"
          grid={true}
          rowProps={{ gutter: 16 }}
        >
          <SafeProFormSelect
            name="storageAreaId"
            label="所属库区"
            placeholder="请选择库区"
            colProps={{ span: 12 }}
            options={storageAreas.map(s => ({
              label: `${s.code} - ${s.name}`,
              value: s.id,
            }))}
            rules={[
              { required: true, message: '请选择库区' },
            ]}
            fieldProps={{
              loading: storageAreasLoading,
              showSearch: true,
              filterOption: (input, option) => {
                const label = option?.label as string || '';
                return label.toLowerCase().includes(input.toLowerCase());
              },
            }}
          />
          <ProFormText
            name="code"
            label="库位编码"
            placeholder="请输入库位编码"
            colProps={{ span: 12 }}
            rules={[
              { required: true, message: '请输入库位编码' },
              { max: 50, message: '库位编码不能超过50个字符' },
            ]}
            fieldProps={{
              style: { textTransform: 'uppercase' },
            }}
          />
          <ProFormText
            name="name"
            label="库位名称"
            placeholder="请输入库位名称"
            colProps={{ span: 12 }}
            rules={[
              { required: true, message: '请输入库位名称' },
              { max: 200, message: '库位名称不能超过200个字符' },
            ]}
          />
          <ProFormTextArea
            name="description"
            label="描述"
            placeholder="请输入描述"
            colProps={{ span: 24 }}
            fieldProps={{
              rows: 4,
              maxLength: 500,
            }}
          />
          <ProFormSwitch
            name="isActive"
            label="是否启用"
            colProps={{ span: 12 }}
          />
        </ProForm>
      </Modal>
    </>
  );
};

export default StorageLocationsPage;
