/**
 * 自定义字段管理列表页面
 * 
 * 用于系统管理员查看和管理组织内的自定义字段。
 * 支持自定义字段的 CRUD 操作。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProDescriptions, ProForm, ProFormText, ProFormTextArea, ProFormSwitch, ProFormSelect, ProFormDigit, ProFormInstance, ProFormJsonSchema } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Drawer, Modal, message } from 'antd';
import { EditOutlined, DeleteOutlined, EyeOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../components/uni_table';
import {
  getCustomFieldList,
  getCustomFieldByUuid,
  createCustomField,
  updateCustomField,
  deleteCustomField,
  CustomField,
  CreateCustomFieldData,
  UpdateCustomFieldData,
} from '../../../../services/customField';


/**
 * 自定义字段管理列表页面组件
 */
const CustomFieldListPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Modal 相关状态（创建/编辑字段）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentFieldUuid, setCurrentFieldUuid] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [fieldType, setFieldType] = useState<'text' | 'number' | 'date' | 'select' | 'textarea' | 'json'>('text');
  const [configForm, setConfigForm] = useState<Record<string, any>>({});
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [detailData, setDetailData] = useState<CustomField | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  /**
   * 处理新建字段
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentFieldUuid(null);
    setFieldType('text');
    setConfigForm({});
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      field_type: 'text',
      is_required: false,
      is_searchable: true,
      is_sortable: true,
      sort_order: 0,
      is_active: true,
    });
  };

  /**
   * 处理编辑字段
   */
  const handleEdit = async (record: CustomField) => {
    try {
      setIsEdit(true);
      setCurrentFieldUuid(record.uuid);
      setFieldType(record.field_type);
      setConfigForm(record.config || {});
      setModalVisible(true);
      
      // 获取字段详情
      const detail = await getCustomFieldByUuid(record.uuid);
      formRef.current?.setFieldsValue({
        name: detail.name,
        code: detail.code,
        table_name: detail.table_name,
        field_type: detail.field_type,
        label: detail.label,
        placeholder: detail.placeholder,
        is_required: detail.is_required,
        is_searchable: detail.is_searchable,
        is_sortable: detail.is_sortable,
        sort_order: detail.sort_order,
        is_active: detail.is_active,
        // 配置字段
        default_value: detail.config?.default || '',
        max_length: detail.config?.maxLength || '',
        min_value: detail.config?.min || '',
        max_value: detail.config?.max || '',
        date_format: detail.config?.format || 'YYYY-MM-DD',
        textarea_rows: detail.config?.rows || 4,
        select_options: detail.config?.options ? JSON.stringify(detail.config.options, null, 2) : '',
      });
    } catch (error: any) {
      messageApi.error(error.message || '获取字段详情失败');
    }
  };

  /**
   * 处理查看详情
   */
  const handleView = async (record: CustomField) => {
    try {
      setDetailLoading(true);
      setDrawerVisible(true);
      const detail = await getCustomFieldByUuid(record.uuid);
      setDetailData(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取字段详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理删除字段
   */
  const handleDelete = async (record: CustomField) => {
    try {
      await deleteCustomField(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理提交表单（创建/更新字段）
   */
  const handleSubmit = async () => {
    try {
      setFormLoading(true);
      const values = await formRef.current?.validateFields();
      
      // 根据字段类型构建配置对象
      const config: Record<string, any> = {};
      
      if (fieldType === 'text') {
        if (values.default_value) config.default = values.default_value;
        if (values.max_length) config.maxLength = parseInt(values.max_length);
      } else if (fieldType === 'number') {
        if (values.default_value !== undefined && values.default_value !== '') {
          config.default = parseFloat(values.default_value);
        }
        if (values.min_value !== undefined && values.min_value !== '') {
          config.min = parseFloat(values.min_value);
        }
        if (values.max_value !== undefined && values.max_value !== '') {
          config.max = parseFloat(values.max_value);
        }
      } else if (fieldType === 'date') {
        if (values.default_value) config.default = values.default_value;
        if (values.date_format) config.format = values.date_format;
      } else if (fieldType === 'select') {
        if (values.select_options) {
          try {
            config.options = JSON.parse(values.select_options);
          } catch (e) {
            messageApi.error('选项 JSON 格式不正确');
            return;
          }
        }
      } else if (fieldType === 'textarea') {
        if (values.default_value) config.default = values.default_value;
        if (values.textarea_rows) config.rows = parseInt(values.textarea_rows);
      } else if (fieldType === 'json') {
        if (values.default_value) {
          try {
            config.default = JSON.parse(values.default_value);
          } catch (e) {
            messageApi.error('默认值 JSON 格式不正确');
            return;
          }
        }
      }
      
      // 移除配置相关字段
      const { default_value, max_length, min_value, max_value, date_format, textarea_rows, select_options, ...fieldData } = values;
      
      if (isEdit && currentFieldUuid) {
        await updateCustomField(currentFieldUuid, {
          ...fieldData,
          config: Object.keys(config).length > 0 ? config : undefined,
        } as UpdateCustomFieldData);
        messageApi.success('更新成功');
      } else {
        await createCustomField({
          ...fieldData,
          config: Object.keys(config).length > 0 ? config : undefined,
        } as CreateCustomFieldData);
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
   * 根据字段类型渲染配置表单
   */
  const renderConfigFields = () => {
    switch (fieldType) {
      case 'text':
        return (
          <>
            <ProFormText
              name="default_value"
              label="默认值"
              placeholder="请输入默认值（可选）"
            />
            <ProFormDigit
              name="max_length"
              label="最大长度"
              placeholder="请输入最大长度（可选）"
              fieldProps={{ min: 1 }}
            />
          </>
        );
      case 'number':
        return (
          <>
            <ProFormDigit
              name="default_value"
              label="默认值"
              placeholder="请输入默认值（可选）"
            />
            <Space style={{ width: '100%' }} size="large">
              <ProFormDigit
                name="min_value"
                label="最小值"
                placeholder="最小值（可选）"
                width="md"
              />
              <ProFormDigit
                name="max_value"
                label="最大值"
                placeholder="最大值（可选）"
                width="md"
              />
            </Space>
          </>
        );
      case 'date':
        return (
          <>
            <ProFormText
              name="default_value"
              label="默认值"
              placeholder="请输入默认日期，例如：2025-01-01（可选）"
            />
            <ProFormText
              name="date_format"
              label="日期格式"
              placeholder="例如：YYYY-MM-DD"
              initialValue="YYYY-MM-DD"
              extra="支持的格式：YYYY-MM-DD、YYYY/MM/DD、YYYY年MM月DD日等"
            />
          </>
        );
      case 'select':
        return (
          <>
            <ProFormTextArea
              name="select_options"
              label="选项配置（JSON）"
              placeholder='请输入选项 JSON，例如：[{"label": "选项1", "value": "1"}, {"label": "选项2", "value": "2"}]'
              fieldProps={{ rows: 6 }}
              extra={
                <div style={{ fontSize: '12px', color: '#666', marginTop: 4 }}>
                  格式示例：
                  <pre style={{ margin: '4px 0', padding: '4px', backgroundColor: '#f5f5f5', borderRadius: '2px', fontSize: '11px' }}>
{`[
  {"label": "选项1", "value": "1"},
  {"label": "选项2", "value": "2"}
]`}
                  </pre>
                </div>
              }
            />
          </>
        );
      case 'textarea':
        return (
          <>
            <ProFormTextArea
              name="default_value"
              label="默认值"
              placeholder="请输入默认值（可选）"
              fieldProps={{ rows: 3 }}
            />
            <ProFormDigit
              name="textarea_rows"
              label="行数"
              placeholder="请输入行数"
              fieldProps={{ min: 1, max: 20 }}
              initialValue={4}
            />
          </>
        );
      case 'json':
        return (
          <>
            <ProFormTextArea
              name="default_value"
              label="默认值（JSON）"
              placeholder='请输入 JSON 格式的默认值，例如：{"key": "value"}'
              fieldProps={{ rows: 6 }}
              extra="请输入有效的 JSON 格式"
            />
          </>
        );
      default:
        return null;
    }
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<CustomField>[] = [
    {
      title: '字段名称',
      dataIndex: 'name',
      width: 150,
      fixed: 'left',
    },
    {
      title: '字段代码',
      dataIndex: 'code',
      width: 150,
    },
    {
      title: '关联表',
      dataIndex: 'table_name',
      width: 150,
    },
    {
      title: '字段类型',
      dataIndex: 'field_type',
      width: 120,
      valueType: 'select',
      valueEnum: {
        text: { text: '文本', status: 'Default' },
        number: { text: '数字', status: 'Processing' },
        date: { text: '日期', status: 'Success' },
        select: { text: '选择', status: 'Warning' },
        textarea: { text: '多行文本', status: 'Error' },
        json: { text: 'JSON', status: 'Default' },
      },
      render: (_, record) => {
        const typeMap: Record<string, { color: string; text: string }> = {
          text: { color: 'default', text: '文本' },
          number: { color: 'blue', text: '数字' },
          date: { color: 'green', text: '日期' },
          select: { color: 'orange', text: '选择' },
          textarea: { color: 'red', text: '多行文本' },
          json: { color: 'purple', text: 'JSON' },
        };
        const typeInfo = typeMap[record.field_type] || { color: 'default', text: record.field_type };
        return <Tag color={typeInfo.color}>{typeInfo.text}</Tag>;
      },
    },
    {
      title: '字段标签',
      dataIndex: 'label',
      width: 150,
      hideInSearch: true,
    },
    {
      title: '是否必填',
      dataIndex: 'is_required',
      width: 100,
      valueType: 'select',
      valueEnum: {
        true: { text: '是', status: 'Success' },
        false: { text: '否', status: 'Default' },
      },
      render: (_, record) => (
        <Tag color={record.is_required ? 'success' : 'default'}>
          {record.is_required ? '是' : '否'}
        </Tag>
      ),
    },
    {
      title: '排序',
      dataIndex: 'sort_order',
      width: 80,
      hideInSearch: true,
      sorter: true,
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
            title="确定要删除这个字段吗？"
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
      <UniTable<CustomField>
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
          if (searchFormValues?.field_type) {
            apiParams.field_type = searchFormValues.field_type;
          }
          
          // 表名筛选
          if (searchFormValues?.table_name) {
            apiParams.table_name = searchFormValues.table_name;
          }
          
          // 搜索条件处理：name 和 code 使用模糊搜索
          if (searchFormValues?.name) {
            apiParams.name = searchFormValues.name as string;
          }
          if (searchFormValues?.code) {
            apiParams.code = searchFormValues.code as string;
          }
          
          try {
            const response = await getCustomFieldList(apiParams);
            return {
              data: response.items,
              success: true,
              total: response.total,
            };
          } catch (error: any) {
            console.error('获取自定义字段列表失败:', error);
            messageApi.error(error?.message || '获取自定义字段列表失败');
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
            新建字段
          </Button>,
        ]}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
      />

      {/* 创建/编辑字段 Modal */}
      <Modal
        title={isEdit ? '编辑字段' : '新建字段'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        confirmLoading={formLoading}
        size={700}
      >
        <ProForm
          formRef={formRef}
          submitter={false}
          layout="vertical"
        >
          <ProFormText
            name="name"
            label="字段名称"
            rules={[{ required: true, message: '请输入字段名称' }]}
            placeholder="请输入字段名称"
          />
          <ProFormText
            name="code"
            label="字段代码"
            rules={[{ required: true, message: '请输入字段代码' }]}
            placeholder="请输入字段代码（唯一标识）"
            disabled={isEdit}
            extra="字段代码用于程序调用，创建后不可修改"
          />
          <ProFormText
            name="table_name"
            label="关联表名"
            rules={[{ required: true, message: '请输入关联表名' }]}
            placeholder="例如：sys_users"
            disabled={isEdit}
            extra="关联表名，创建后不可修改"
          />
          <ProFormSelect
            name="field_type"
            label="字段类型"
            rules={[{ required: true, message: '请选择字段类型' }]}
            options={[
              { label: '文本', value: 'text' },
              { label: '数字', value: 'number' },
              { label: '日期', value: 'date' },
              { label: '选择', value: 'select' },
              { label: '多行文本', value: 'textarea' },
              { label: 'JSON', value: 'json' },
            ]}
            fieldProps={{
              onChange: (value) => {
                setFieldType(value);
                // 重置配置
                setConfigJson('{}');
              },
            }}
            disabled={isEdit}
          />
          <ProFormText
            name="label"
            label="字段标签"
            placeholder="请输入字段标签（显示名称）"
          />
          <ProFormText
            name="placeholder"
            label="占位符"
            placeholder="请输入占位符"
          />
          <div style={{ 
            padding: '16px', 
            backgroundColor: '#fafafa', 
            borderRadius: '4px',
            border: '1px solid #d9d9d9',
            marginBottom: 16,
          }}>
            <div style={{ marginBottom: 12, fontWeight: 500 }}>字段配置</div>
            {renderConfigFields()}
          </div>
          <Space style={{ width: '100%' }} size="large">
            <ProFormSwitch
              name="is_required"
              label="是否必填"
            />
            <ProFormSwitch
              name="is_searchable"
              label="是否可搜索"
            />
            <ProFormSwitch
              name="is_sortable"
              label="是否可排序"
            />
          </Space>
          <ProFormDigit
            name="sort_order"
            label="排序顺序"
            fieldProps={{ min: 0 }}
            initialValue={0}
          />
          <ProFormSwitch
            name="is_active"
            label="是否启用"
          />
        </ProForm>
      </Modal>

      {/* 查看详情 Drawer */}
      <Drawer
        title="字段详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        size={600}
        loading={detailLoading}
      >
        {detailData && (
          <ProDescriptions<CustomField>
            column={1}
            dataSource={detailData}
            columns={[
              {
                title: '字段名称',
                dataIndex: 'name',
              },
              {
                title: '字段代码',
                dataIndex: 'code',
              },
              {
                title: '关联表名',
                dataIndex: 'table_name',
              },
              {
                title: '字段类型',
                dataIndex: 'field_type',
              },
              {
                title: '字段标签',
                dataIndex: 'label',
              },
              {
                title: '占位符',
                dataIndex: 'placeholder',
              },
              {
                title: '字段配置',
                dataIndex: 'config',
                render: (value) => (
                  <pre style={{
                    margin: 0,
                    padding: '8px',
                    backgroundColor: '#f5f5f5',
                    borderRadius: '4px',
                    overflow: 'auto',
                    maxHeight: '300px',
                  }}>
                    {JSON.stringify(value || {}, null, 2)}
                  </pre>
                ),
              },
              {
                title: '是否必填',
                dataIndex: 'is_required',
                render: (value) => (value ? '是' : '否'),
              },
              {
                title: '是否可搜索',
                dataIndex: 'is_searchable',
                render: (value) => (value ? '是' : '否'),
              },
              {
                title: '是否可排序',
                dataIndex: 'is_sortable',
                render: (value) => (value ? '是' : '否'),
              },
              {
                title: '排序顺序',
                dataIndex: 'sort_order',
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

export default CustomFieldListPage;

