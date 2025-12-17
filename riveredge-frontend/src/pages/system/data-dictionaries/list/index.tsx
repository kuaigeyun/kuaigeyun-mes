/**
 * 数据字典管理列表页面
 * 
 * 用于系统管理员查看和管理组织内的数据字典。
 * 支持数据字典的 CRUD 操作和字典项管理。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProDescriptions, ProForm, ProFormText, ProFormTextArea, ProFormSwitch, ProFormInstance } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Drawer, Modal, Table, message } from 'antd';
import { EditOutlined, DeleteOutlined, EyeOutlined, SettingOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../components/uni-table';
import {
  getDataDictionaryList,
  getDataDictionaryByUuid,
  createDataDictionary,
  updateDataDictionary,
  deleteDataDictionary,
  getDictionaryItemList,
  createDictionaryItem,
  updateDictionaryItem,
  deleteDictionaryItem,
  DataDictionary,
  CreateDataDictionaryData,
  UpdateDataDictionaryData,
  DictionaryItem,
  CreateDictionaryItemData,
  UpdateDictionaryItemData,
} from '../../../../services/dataDictionary';

/**
 * 数据字典管理列表页面组件
 */
const DataDictionaryListPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const itemFormRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Modal 相关状态（创建/编辑字典）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentDictionaryUuid, setCurrentDictionaryUuid] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [detailData, setDetailData] = useState<DataDictionary | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // 字典项管理 Drawer 状态
  const [itemDrawerVisible, setItemDrawerVisible] = useState(false);
  const [currentDictionaryForItems, setCurrentDictionaryForItems] = useState<DataDictionary | null>(null);
  const [items, setItems] = useState<DictionaryItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  
  // 字典项 Modal 状态（创建/编辑字典项）
  const [itemModalVisible, setItemModalVisible] = useState(false);
  const [isEditItem, setIsEditItem] = useState(false);
  const [currentItemUuid, setCurrentItemUuid] = useState<string | null>(null);
  const [itemFormLoading, setItemFormLoading] = useState(false);

  /**
   * 处理新建字典
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentDictionaryUuid(null);
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      is_system: false,
      is_active: true,
    });
  };

  /**
   * 处理编辑字典
   */
  const handleEdit = async (record: DataDictionary) => {
    try {
      setIsEdit(true);
      setCurrentDictionaryUuid(record.uuid);
      setModalVisible(true);
      
      // 获取字典详情
      const detail = await getDataDictionaryByUuid(record.uuid);
      formRef.current?.setFieldsValue({
        name: detail.name,
        code: detail.code,
        description: detail.description,
        is_active: detail.is_active,
      });
    } catch (error: any) {
      messageApi.error(error.message || '获取字典详情失败');
    }
  };

  /**
   * 处理查看详情
   */
  const handleView = async (record: DataDictionary) => {
    try {
      setDetailLoading(true);
      setDrawerVisible(true);
      const detail = await getDataDictionaryByUuid(record.uuid);
      setDetailData(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取字典详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理删除字典
   */
  const handleDelete = async (record: DataDictionary) => {
    try {
      await deleteDataDictionary(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理提交表单（创建/更新字典）
   */
  const handleSubmit = async () => {
    try {
      setFormLoading(true);
      const values = await formRef.current?.validateFields();
      
      if (isEdit && currentDictionaryUuid) {
        await updateDataDictionary(currentDictionaryUuid, values as UpdateDataDictionaryData);
        messageApi.success('更新成功');
      } else {
        await createDataDictionary(values as CreateDataDictionaryData);
        messageApi.success('创建成功');
      }
      
      setModalVisible(false);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '操作失败');
    } finally {
      setFormLoading(false);
    }
  };

  /**
   * 处理管理字典项
   */
  const handleManageItems = async (record: DataDictionary) => {
    try {
      setCurrentDictionaryForItems(record);
      setItemDrawerVisible(true);
      await loadItems(record.uuid);
    } catch (error: any) {
      messageApi.error(error.message || '加载字典项失败');
    }
  };

  /**
   * 加载字典项列表
   */
  const loadItems = async (dictionaryUuid: string) => {
    try {
      setItemsLoading(true);
      const itemList = await getDictionaryItemList(dictionaryUuid);
      setItems(itemList);
    } catch (error: any) {
      messageApi.error(error.message || '加载字典项失败');
    } finally {
      setItemsLoading(false);
    }
  };

  /**
   * 处理新建字典项
   */
  const handleCreateItem = () => {
    if (!currentDictionaryForItems) return;
    
    setIsEditItem(false);
    setCurrentItemUuid(null);
    setItemModalVisible(true);
    itemFormRef.current?.resetFields();
    itemFormRef.current?.setFieldsValue({
      sort_order: 0,
      is_active: true,
    });
  };

  /**
   * 处理编辑字典项
   */
  const handleEditItem = async (record: DictionaryItem) => {
    try {
      setIsEditItem(true);
      setCurrentItemUuid(record.uuid);
      setItemModalVisible(true);
      
      itemFormRef.current?.setFieldsValue({
        label: record.label,
        value: record.value,
        description: record.description,
        color: record.color,
        icon: record.icon,
        sort_order: record.sort_order,
        is_active: record.is_active,
      });
    } catch (error: any) {
      messageApi.error(error.message || '获取字典项详情失败');
    }
  };

  /**
   * 处理删除字典项
   */
  const handleDeleteItem = async (record: DictionaryItem) => {
    try {
      await deleteDictionaryItem(record.uuid);
      messageApi.success('删除成功');
      if (currentDictionaryForItems) {
        await loadItems(currentDictionaryForItems.uuid);
      }
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理提交字典项表单（创建/更新）
   */
  const handleSubmitItem = async () => {
    try {
      if (!currentDictionaryForItems) return;
      
      setItemFormLoading(true);
      const values = await itemFormRef.current?.validateFields();
      
      if (isEditItem && currentItemUuid) {
        await updateDictionaryItem(currentItemUuid, values as UpdateDictionaryItemData);
        messageApi.success('更新成功');
      } else {
        await createDictionaryItem(currentDictionaryForItems.uuid, {
          ...values,
        } as Omit<CreateDictionaryItemData, 'dictionary_uuid'>);
        messageApi.success('创建成功');
      }
      
      setItemModalVisible(false);
      await loadItems(currentDictionaryForItems.uuid);
    } catch (error: any) {
      messageApi.error(error.message || '操作失败');
    } finally {
      setItemFormLoading(false);
    }
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<DataDictionary>[] = [
    {
      title: '字典名称',
      dataIndex: 'name',
      width: 150,
      fixed: 'left',
    },
    {
      title: '字典代码',
      dataIndex: 'code',
      width: 150,
    },
    {
      title: '描述',
      dataIndex: 'description',
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: '系统字典',
      dataIndex: 'is_system',
      width: 100,
      valueType: 'select',
      valueEnum: {
        true: { text: '是', status: 'Default' },
        false: { text: '否', status: 'Processing' },
      },
      render: (_, record) => (
        <Tag color={record.is_system ? 'default' : 'blue'}>
          {record.is_system ? '是' : '否'}
        </Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      width: 100,
      valueType: 'select',
      valueEnum: {
        true: { text: '启用', status: 'Success' },
        false: { text: '禁用', status: 'Default' },
      },
      render: (_, record) => (
        <Tag color={record.is_active ? 'success' : 'default'}>
          {record.is_active ? '启用' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      width: 180,
      valueType: 'dateTime',
      hideInSearch: true,
      sorter: true,
    },
    {
      title: '操作',
      valueType: 'option',
      width: 250,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleView(record)}
          >
            查看
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
            disabled={record.is_system}
          >
            编辑
          </Button>
          <Button
            type="link"
            size="small"
            icon={<SettingOutlined />}
            onClick={() => handleManageItems(record)}
          >
            字典项
          </Button>
          <Popconfirm
            title="确定要删除这个字典吗？"
            onConfirm={() => handleDelete(record)}
            disabled={record.is_system}
          >
            <Button
              type="link"
              danger
              size="small"
              icon={<DeleteOutlined />}
              disabled={record.is_system}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  /**
   * 字典项表格列定义
   */
  const itemColumns = [
    {
      title: '标签',
      dataIndex: 'label',
      key: 'label',
      width: 150,
    },
    {
      title: '值',
      dataIndex: 'value',
      key: 'value',
      width: 150,
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: '颜色',
      dataIndex: 'color',
      key: 'color',
      width: 100,
      render: (color: string) => color ? <Tag color={color}>{color}</Tag> : '-',
    },
    {
      title: '图标',
      dataIndex: 'icon',
      key: 'icon',
      width: 100,
    },
    {
      title: '排序',
      dataIndex: 'sort_order',
      key: 'sort_order',
      width: 80,
      sorter: (a: DictionaryItem, b: DictionaryItem) => a.sort_order - b.sort_order,
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 100,
      render: (isActive: boolean) => (
        <Tag color={isActive ? 'success' : 'default'}>
          {isActive ? '启用' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_: any, record: DictionaryItem) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEditItem(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这个字典项吗？"
            onConfirm={() => handleDeleteItem(record)}
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
      <UniTable<DataDictionary>
        actionRef={actionRef}
        columns={columns}
        request={async (params, sort, _filter, searchFormValues) => {
          // 处理搜索参数
          const apiParams: any = {
            page: params.current || 1,
            page_size: params.pageSize || 20,
          };
          
          // 状态筛选
          if (searchFormValues?.is_active !== undefined && searchFormValues.is_active !== '' && searchFormValues.is_active !== null) {
            apiParams.is_active = searchFormValues.is_active;
          }
          
          // 搜索条件处理：name 和 code 使用模糊搜索
          if (searchFormValues?.name) {
            apiParams.name = searchFormValues.name as string;
          }
          if (searchFormValues?.code) {
            apiParams.code = searchFormValues.code as string;
          }
          
          try {
            const response = await getDataDictionaryList(apiParams);
            return {
              data: response.items,
              success: true,
              total: response.total,
            };
          } catch (error: any) {
            console.error('获取数据字典列表失败:', error);
            messageApi.error(error?.message || '获取数据字典列表失败');
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
            新建字典
          </Button>,
        ]}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
      />

      {/* 创建/编辑字典 Modal */}
      <Modal
        title={isEdit ? '编辑字典' : '新建字典'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        confirmLoading={formLoading}
        size={600}
      >
        <ProForm
          formRef={formRef}
          submitter={false}
          layout="vertical"
        >
          <ProFormText
            name="name"
            label="字典名称"
            rules={[{ required: true, message: '请输入字典名称' }]}
            placeholder="请输入字典名称"
          />
          <ProFormText
            name="code"
            label="字典代码"
            rules={[{ required: true, message: '请输入字典代码' }]}
            placeholder="请输入字典代码（唯一标识）"
            disabled={isEdit}
          />
          <ProFormTextArea
            name="description"
            label="描述"
            placeholder="请输入字典描述"
          />
          <ProFormSwitch
            name="is_active"
            label="是否启用"
          />
        </ProForm>
      </Modal>

      {/* 查看详情 Drawer */}
      <Drawer
        title="字典详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        size={600}
        loading={detailLoading}
      >
        {detailData && (
          <ProDescriptions<DataDictionary>
            column={1}
            dataSource={detailData}
            columns={[
              {
                title: '字典名称',
                dataIndex: 'name',
              },
              {
                title: '字典代码',
                dataIndex: 'code',
              },
              {
                title: '描述',
                dataIndex: 'description',
              },
              {
                title: '系统字典',
                dataIndex: 'is_system',
                render: (value) => (value ? '是' : '否'),
              },
              {
                title: '状态',
                dataIndex: 'is_active',
                render: (value) => (value ? '启用' : '禁用'),
              },
              {
                title: '创建时间',
                dataIndex: 'created_at',
                valueType: 'dateTime',
              },
              {
                title: '更新时间',
                dataIndex: 'updated_at',
                valueType: 'dateTime',
              },
            ]}
          />
        )}
      </Drawer>

      {/* 字典项管理 Drawer */}
      <Drawer
        title={`字典项管理 - ${currentDictionaryForItems?.name || ''}`}
        open={itemDrawerVisible}
        onClose={() => {
          setItemDrawerVisible(false);
          setCurrentDictionaryForItems(null);
          setItems([]);
        }}
        size={800}
      >
        <div style={{ marginBottom: 16 }}>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreateItem}
          >
            新建字典项
          </Button>
        </div>
        <Table
          columns={itemColumns}
          dataSource={items}
          rowKey="uuid"
          loading={itemsLoading}
          pagination={false}
        />
      </Drawer>

      {/* 创建/编辑字典项 Modal */}
      <Modal
        title={isEditItem ? '编辑字典项' : '新建字典项'}
        open={itemModalVisible}
        onOk={handleSubmitItem}
        onCancel={() => setItemModalVisible(false)}
        confirmLoading={itemFormLoading}
        size={600}
      >
        <ProForm
          formRef={itemFormRef}
          submitter={false}
          layout="vertical"
        >
          <ProFormText
            name="label"
            label="标签"
            rules={[{ required: true, message: '请输入标签' }]}
            placeholder="请输入标签（显示名称）"
          />
          <ProFormText
            name="value"
            label="值"
            rules={[{ required: true, message: '请输入值' }]}
            placeholder="请输入值（用于程序识别）"
          />
          <ProFormTextArea
            name="description"
            label="描述"
            placeholder="请输入描述"
          />
          <ProFormText
            name="color"
            label="颜色"
            placeholder="请输入颜色（如：#FF0000）"
          />
          <ProFormText
            name="icon"
            label="图标"
            placeholder="请输入图标名称"
          />
          <ProFormText
            name="sort_order"
            label="排序"
            fieldProps={{ type: 'number' }}
            initialValue={0}
          />
          <ProFormSwitch
            name="is_active"
            label="是否启用"
          />
        </ProForm>
      </Modal>
    </>
  );
};

export default DataDictionaryListPage;

