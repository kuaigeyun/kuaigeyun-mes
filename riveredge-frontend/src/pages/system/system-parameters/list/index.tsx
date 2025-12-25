/**
 * 系统参数管理列表页面
 * 
 * 用于系统管理员查看和管理组织内的系统参数。
 * 支持系统参数的 CRUD 操作和批量更新。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProDescriptions, ProForm, ProFormText, ProFormTextArea, ProFormSwitch, ProFormSelect, ProFormDigit, ProFormInstance } from '@ant-design/pro-components';
import SafeProFormSelect from '../../../../components/safe-pro-form-select';
import { App, Popconfirm, Button, Tag, Space, Drawer, Modal, message, Tabs } from 'antd';
import { EditOutlined, DeleteOutlined, EyeOutlined, PlusOutlined, AppstoreOutlined, UnorderedListOutlined } from '@ant-design/icons';
import GroupedFormView from '../grouped-form-view';
import { UniTable } from '../../../../components/uni-table';
import {
  getSystemParameterList,
  getSystemParameterByUuid,
  createSystemParameter,
  updateSystemParameter,
  deleteSystemParameter,
  SystemParameter,
  CreateSystemParameterData,
  UpdateSystemParameterData,
} from '../../../../services/systemParameter';

/**
 * 系统参数管理列表页面组件
 */
const SystemParameterListPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'form'>('form');
  
  // Modal 相关状态（创建/编辑参数）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentParameterUuid, setCurrentParameterUuid] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [parameterType, setParameterType] = useState<'string' | 'number' | 'boolean' | 'json'>('string');
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [detailData, setDetailData] = useState<SystemParameter | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  /**
   * 处理新建参数
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentParameterUuid(null);
    setParameterType('string');
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      type: 'string',
      is_system: false,
      is_active: true,
    });
  };

  /**
   * 处理编辑参数
   */
  const handleEdit = async (record: SystemParameter) => {
    try {
      setIsEdit(true);
      setCurrentParameterUuid(record.uuid);
      setParameterType(record.type);
      setModalVisible(true);
      
      // 获取参数详情
      const detail = await getSystemParameterByUuid(record.uuid);
      formRef.current?.setFieldsValue({
        key: detail.key,
        value: detail.value,
        type: detail.type,
        description: detail.description,
        is_active: detail.is_active,
      });
    } catch (error: any) {
      messageApi.error(error.message || '获取参数详情失败');
    }
  };

  /**
   * 处理查看详情
   */
  const handleView = async (record: SystemParameter) => {
    try {
      setDetailLoading(true);
      setDrawerVisible(true);
      const detail = await getSystemParameterByUuid(record.uuid);
      setDetailData(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取参数详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理删除参数
   */
  const handleDelete = async (record: SystemParameter) => {
    try {
      await deleteSystemParameter(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理提交表单（创建/更新参数）
   */
  const handleSubmit = async () => {
    try {
      setFormLoading(true);
      const values = await formRef.current?.validateFields();
      
      // 处理 JSON 类型参数值
      let processedValue = values.value;
      if (values.type === 'json') {
        try {
          if (typeof values.value === 'string') {
            processedValue = JSON.parse(values.value);
          }
        } catch (e) {
          messageApi.error('JSON 格式不正确');
          return;
        }
      } else if (values.type === 'number') {
        processedValue = Number(values.value);
      } else if (values.type === 'boolean') {
        processedValue = values.value === true || values.value === 'true' || values.value === 1;
      }
      
      if (isEdit && currentParameterUuid) {
        await updateSystemParameter(currentParameterUuid, {
          value: processedValue,
          description: values.description,
          is_active: values.is_active,
        } as UpdateSystemParameterData);
        messageApi.success('更新成功');
      } else {
        await createSystemParameter({
          key: values.key,
          value: processedValue,
          type: values.type,
          description: values.description,
          is_system: values.is_system || false,
          is_active: values.is_active,
        } as CreateSystemParameterData);
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
   * 格式化参数值显示
   */
  const formatValue = (value: any, type: string): string => {
    if (type === 'json') {
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<SystemParameter>[] = [
    {
      title: '参数键',
      dataIndex: 'key',
      width: 200,
      fixed: 'left',
    },
    {
      title: '参数值',
      dataIndex: 'value',
      width: 250,
      ellipsis: true,
      render: (_, record) => {
        const displayValue = formatValue(record.value, record.type);
        return (
          <span title={displayValue}>
            {displayValue.length > 50 ? `${displayValue.substring(0, 50)}...` : displayValue}
          </span>
        );
      },
    },
    {
      title: '参数类型',
      dataIndex: 'type',
      width: 100,
      valueType: 'select',
      valueEnum: {
        string: { text: '字符串', status: 'Default' },
        number: { text: '数字', status: 'Processing' },
        boolean: { text: '布尔', status: 'Success' },
        json: { text: 'JSON', status: 'Warning' },
      },
      render: (_, record) => {
        const typeMap: Record<string, { color: string; text: string }> = {
          string: { color: 'default', text: '字符串' },
          number: { color: 'blue', text: '数字' },
          boolean: { color: 'green', text: '布尔' },
          json: { color: 'orange', text: 'JSON' },
        };
        const typeInfo = typeMap[record.type] || { color: 'default', text: record.type };
        return <Tag color={typeInfo.color}>{typeInfo.text}</Tag>;
      },
    },
    {
      title: '描述',
      dataIndex: 'description',
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: '系统参数',
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
      width: 200,
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
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这个参数吗？"
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
   * 根据类型渲染值输入框
   */
  const renderValueInput = () => {
    switch (parameterType) {
      case 'number':
        return (
          <ProFormDigit
            name="value"
            label="参数值"
            rules={[{ required: true, message: '请输入参数值' }]}
            placeholder="请输入数字"
          />
        );
      case 'boolean':
        return (
          <ProFormSwitch
            name="value"
            label="参数值"
            rules={[{ required: true, message: '请选择参数值' }]}
          />
        );
      case 'json':
        return (
          <ProFormTextArea
            name="value"
            label="参数值（JSON）"
            rules={[
              { required: true, message: '请输入参数值' },
              {
                validator: (_, value) => {
                  if (!value) return Promise.resolve();
                  try {
                    JSON.parse(value);
                    return Promise.resolve();
                  } catch (e) {
                    return Promise.reject(new Error('JSON 格式不正确'));
                  }
                },
              },
            ]}
            placeholder='请输入 JSON 格式的值，例如：{"key": "value"} 或 ["item1", "item2"]'
            fieldProps={{
              rows: 6,
            }}
          />
        );
      default:
        return (
          <ProFormText
            name="value"
            label="参数值"
            rules={[{ required: true, message: '请输入参数值' }]}
            placeholder="请输入字符串值"
          />
        );
    }
  };

  return (
    <>
      {/* 视图切换 */}
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Tabs
          activeKey={viewMode}
          onChange={(key) => setViewMode(key as 'list' | 'form')}
          items={[
            { key: 'form', label: '分组表单视图', icon: <AppstoreOutlined /> },
            { key: 'list', label: '列表视图', icon: <UnorderedListOutlined /> },
          ]}
        />
        {viewMode === 'list' && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreate}
          >
            新建参数
          </Button>
        )}
      </div>

      {/* 分组表单视图 */}
      {viewMode === 'form' && <GroupedFormView />}

      {/* 列表视图 */}
      {viewMode === 'list' && (
        <UniTable<SystemParameter>
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
            
            // 类型筛选
            if (searchFormValues?.type) {
              apiParams.type = searchFormValues.type;
            }
            
            // 搜索条件处理：key 使用模糊搜索
            if (searchFormValues?.key) {
              apiParams.key = searchFormValues.key as string;
            }
            
            try {
              const response = await getSystemParameterList(apiParams);
              return {
                data: response.items,
                success: true,
                total: response.total,
              };
            } catch (error: any) {
              console.error('获取系统参数列表失败:', error);
              messageApi.error(error?.message || '获取系统参数列表失败');
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
          toolBarRender={() => []}
          rowSelection={{
            selectedRowKeys,
            onChange: setSelectedRowKeys,
          }}
        />
      )}

      {/* 创建/编辑参数 Modal */}
      <Modal
        title={isEdit ? '编辑参数' : '新建参数'}
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
            name="key"
            label="参数键"
            rules={[{ required: true, message: '请输入参数键' }]}
            placeholder="请输入参数键（唯一标识）"
            disabled={isEdit}
          />
          <SafeProFormSelect
            name="type"
            label="参数类型"
            rules={[{ required: true, message: '请选择参数类型' }]}
            options={[
              { label: '字符串', value: 'string' },
              { label: '数字', value: 'number' },
              { label: '布尔', value: 'boolean' },
              { label: 'JSON', value: 'json' },
            ]}
            fieldProps={{
              onChange: (value) => {
                setParameterType(value);
                formRef.current?.setFieldsValue({ value: undefined });
              },
            }}
            disabled={isEdit}
          />
          {renderValueInput()}
          <ProFormTextArea
            name="description"
            label="描述"
            placeholder="请输入参数描述"
          />
          {!isEdit && (
            <ProFormSwitch
              name="is_system"
              label="是否系统参数"
            />
          )}
          <ProFormSwitch
            name="is_active"
            label="是否启用"
          />
        </ProForm>
      </Modal>

      {/* 查看详情 Drawer */}
      <Drawer
        title="参数详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        size={600}
        loading={detailLoading}
      >
        {detailData && (
          <ProDescriptions<SystemParameter>
            column={1}
            dataSource={detailData}
            columns={[
              {
                title: '参数键',
                dataIndex: 'key',
              },
              {
                title: '参数值',
                dataIndex: 'value',
                render: (value, record) => {
                  const displayValue = formatValue(value, record.type);
                  if (record.type === 'json') {
                    return (
                      <pre style={{
                        margin: 0,
                        padding: '8px',
                        backgroundColor: '#f5f5f5',
                        borderRadius: '4px',
                        overflow: 'auto',
                        maxHeight: '300px',
                      }}>
                        {displayValue}
                      </pre>
                    );
                  }
                  return <span>{displayValue}</span>;
                },
              },
              {
                title: '参数类型',
                dataIndex: 'type',
              },
              {
                title: '描述',
                dataIndex: 'description',
              },
              {
                title: '系统参数',
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
    </>
  );
};

export default SystemParameterListPage;

