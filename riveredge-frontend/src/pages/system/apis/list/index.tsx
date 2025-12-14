/**
 * 接口管理列表页面
 * 
 * 用于系统管理员查看和管理组织内的接口。
 * 支持接口的 CRUD 操作和接口测试功能。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProDescriptions, ProForm, ProFormText, ProFormTextArea, ProFormSwitch, ProFormSelect, ProFormInstance, ProFormJsonSchema } from '@ant-design/pro-components';
import SafeProFormSelect from '@/components/SafeProFormSelect';
import { App, Popconfirm, Button, Tag, Space, Drawer, Modal, message, Input, Badge, Typography } from 'antd';
import { EditOutlined, DeleteOutlined, EyeOutlined, PlusOutlined, ApiOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../components/uni_table';
import {
  getAPIList,
  getAPIByUuid,
  createAPI,
  updateAPI,
  deleteAPI,
  testAPI,
  API,
  CreateAPIData,
  UpdateAPIData,
  APITestRequest,
  APITestResponse,
} from '../../../../services/apiManagement';

const { TextArea } = Input;
const { Text, Paragraph } = Typography;

/**
 * 接口管理列表页面组件
 */
const APIListPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Modal 相关状态（创建/编辑接口）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentApiUuid, setCurrentApiUuid] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  
  // JSON 字段状态
  const [requestHeadersJson, setRequestHeadersJson] = useState<string>('{}');
  const [requestParamsJson, setRequestParamsJson] = useState<string>('{}');
  const [requestBodyJson, setRequestBodyJson] = useState<string>('{}');
  const [responseFormatJson, setResponseFormatJson] = useState<string>('{}');
  const [responseExampleJson, setResponseExampleJson] = useState<string>('{}');
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [detailData, setDetailData] = useState<API | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // 测试接口状态
  const [testDrawerVisible, setTestDrawerVisible] = useState(false);
  const [testingApiUuid, setTestingApiUuid] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<APITestResponse | null>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [testRequestJson, setTestRequestJson] = useState<string>('{}');

  /**
   * 处理新建接口
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentApiUuid(null);
    setRequestHeadersJson('{}');
    setRequestParamsJson('{}');
    setRequestBodyJson('{}');
    setResponseFormatJson('{}');
    setResponseExampleJson('{}');
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      method: 'GET',
      is_active: true,
      is_system: false,
    });
  };

  /**
   * 处理编辑接口
   */
  const handleEdit = async (record: API) => {
    try {
      setIsEdit(true);
      setCurrentApiUuid(record.uuid);
      setModalVisible(true);
      
      // 获取接口详情
      const detail = await getAPIByUuid(record.uuid);
      setRequestHeadersJson(JSON.stringify(detail.request_headers || {}, null, 2));
      setRequestParamsJson(JSON.stringify(detail.request_params || {}, null, 2));
      setRequestBodyJson(JSON.stringify(detail.request_body || {}, null, 2));
      setResponseFormatJson(JSON.stringify(detail.response_format || {}, null, 2));
      setResponseExampleJson(JSON.stringify(detail.response_example || {}, null, 2));
      
      formRef.current?.setFieldsValue({
        name: detail.name,
        code: detail.code,
        description: detail.description,
        path: detail.path,
        method: detail.method,
        is_active: detail.is_active,
        is_system: detail.is_system,
      });
    } catch (error: any) {
      messageApi.error(error.message || '获取接口详情失败');
    }
  };

  /**
   * 处理查看详情
   */
  const handleView = async (record: API) => {
    try {
      setDetailLoading(true);
      setDrawerVisible(true);
      const detail = await getAPIByUuid(record.uuid);
      setDetailData(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取接口详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理删除接口
   */
  const handleDelete = async (record: API) => {
    try {
      await deleteAPI(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理测试接口
   */
  const handleTest = async (record: API) => {
    try {
      setTestingApiUuid(record.uuid);
      setTestDrawerVisible(true);
      setTestRequestJson('{}');
      setTestResult(null);
    } catch (error: any) {
      messageApi.error(error.message || '打开测试面板失败');
    }
  };

  /**
   * 执行接口测试
   */
  const handleExecuteTest = async () => {
    if (!testingApiUuid) return;
    
    try {
      setTestLoading(true);
      
      // 解析测试请求 JSON
      let testRequest: APITestRequest = {};
      try {
        testRequest = JSON.parse(testRequestJson);
      } catch (e) {
        messageApi.error('测试请求 JSON 格式不正确');
        return;
      }
      
      const result = await testAPI(testingApiUuid, testRequest);
      setTestResult(result);
      
      if (result.status_code >= 200 && result.status_code < 300) {
        messageApi.success('接口测试成功');
      } else {
        messageApi.warning(`接口测试完成，状态码: ${result.status_code}`);
      }
    } catch (error: any) {
      messageApi.error(error.message || '接口测试失败');
    } finally {
      setTestLoading(false);
    }
  };

  /**
   * 处理提交表单（创建/更新接口）
   */
  const handleSubmit = async () => {
    try {
      setFormLoading(true);
      const values = await formRef.current?.validateFields();
      
      // 解析 JSON 字段
      let requestHeaders: Record<string, any> = {};
      let requestParams: Record<string, any> = {};
      let requestBody: Record<string, any> = {};
      let responseFormat: Record<string, any> = {};
      let responseExample: Record<string, any> = {};
      
      try {
        requestHeaders = JSON.parse(requestHeadersJson);
      } catch (e) {
        messageApi.error('请求头 JSON 格式不正确');
        return;
      }
      
      try {
        requestParams = JSON.parse(requestParamsJson);
      } catch (e) {
        messageApi.error('请求参数 JSON 格式不正确');
        return;
      }
      
      try {
        requestBody = JSON.parse(requestBodyJson);
      } catch (e) {
        messageApi.error('请求体 JSON 格式不正确');
        return;
      }
      
      try {
        responseFormat = JSON.parse(responseFormatJson);
      } catch (e) {
        messageApi.error('响应格式 JSON 格式不正确');
        return;
      }
      
      try {
        responseExample = JSON.parse(responseExampleJson);
      } catch (e) {
        messageApi.error('响应示例 JSON 格式不正确');
        return;
      }
      
      if (isEdit && currentApiUuid) {
        await updateAPI(currentApiUuid, {
          name: values.name,
          code: values.code,
          description: values.description,
          path: values.path,
          method: values.method,
          request_headers: requestHeaders,
          request_params: requestParams,
          request_body: requestBody,
          response_format: responseFormat,
          response_example: responseExample,
          is_active: values.is_active,
        } as UpdateAPIData);
        messageApi.success('更新成功');
      } else {
        await createAPI({
          name: values.name,
          code: values.code,
          description: values.description,
          path: values.path,
          method: values.method,
          request_headers: requestHeaders,
          request_params: requestParams,
          request_body: requestBody,
          response_format: responseFormat,
          response_example: responseExample,
          is_active: values.is_active,
          is_system: values.is_system || false,
        } as CreateAPIData);
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
   * 表格列定义
   */
  const columns: ProColumns<API>[] = [
    {
      title: '接口名称',
      dataIndex: 'name',
      width: 200,
      fixed: 'left',
    },
    {
      title: '接口代码',
      dataIndex: 'code',
      width: 150,
    },
    {
      title: '请求方法',
      dataIndex: 'method',
      width: 100,
      valueType: 'select',
      valueEnum: {
        GET: { text: 'GET', status: 'Success' },
        POST: { text: 'POST', status: 'Processing' },
        PUT: { text: 'PUT', status: 'Warning' },
        DELETE: { text: 'DELETE', status: 'Error' },
        PATCH: { text: 'PATCH', status: 'Default' },
      },
      render: (_, record) => {
        const methodColors: Record<string, string> = {
          GET: 'green',
          POST: 'blue',
          PUT: 'orange',
          DELETE: 'red',
          PATCH: 'purple',
        };
        return <Tag color={methodColors[record.method] || 'default'}>{record.method}</Tag>;
      },
    },
    {
      title: '接口路径',
      dataIndex: 'path',
      ellipsis: true,
      width: 300,
    },
    {
      title: '描述',
      dataIndex: 'description',
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: '启用状态',
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
      title: '系统接口',
      dataIndex: 'is_system',
      width: 100,
      hideInSearch: true,
      render: (_, record) => (
        record.is_system ? <Tag color="purple">系统</Tag> : <Tag>自定义</Tag>
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
          >
            编辑
          </Button>
          <Button
            type="link"
            size="small"
            icon={<ThunderboltOutlined />}
            onClick={() => handleTest(record)}
          >
            测试
          </Button>
          {!record.is_system && (
            <Popconfirm
              title="确定要删除这个接口吗？"
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
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <UniTable<API>
        actionRef={actionRef}
        columns={columns}
        request={async (params, sort, _filter, searchFormValues) => {
          // 处理搜索参数
          const apiParams: any = {
            page: params.current || 1,
            page_size: params.pageSize || 20,
          };
          
          // 搜索关键词
          if (searchFormValues?.search) {
            apiParams.search = searchFormValues.search;
          }
          
          // 方法筛选
          if (searchFormValues?.method) {
            apiParams.method = searchFormValues.method;
          }
          
          // 启用状态筛选
          if (searchFormValues?.is_active !== undefined && searchFormValues.is_active !== '' && searchFormValues.is_active !== null) {
            apiParams.is_active = searchFormValues.is_active;
          }
          
          try {
            const result = await getAPIList(apiParams);
            return {
              data: result.items,
              success: true,
              total: result.total,
            };
          } catch (error: any) {
            console.error('获取接口列表失败:', error);
            messageApi.error(error?.message || '获取接口列表失败');
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
            新建接口
          </Button>,
        ]}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
      />

      {/* 创建/编辑接口 Modal */}
      <Modal
        title={isEdit ? '编辑接口' : '新建接口'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        confirmLoading={formLoading}
        size={900}
        style={{ top: 20 }}
      >
        <ProForm
          formRef={formRef}
          submitter={false}
          layout="vertical"
        >
          <ProFormText
            name="name"
            label="接口名称"
            rules={[{ required: true, message: '请输入接口名称' }]}
            placeholder="请输入接口名称"
          />
          <ProFormText
            name="code"
            label="接口代码"
            rules={[
              { required: true, message: '请输入接口代码' },
              { pattern: /^[a-z0-9_]+$/, message: '接口代码只能包含小写字母、数字和下划线' },
            ]}
            placeholder="请输入接口代码（唯一标识，如：get_user_info）"
            disabled={isEdit}
          />
          <ProFormTextArea
            name="description"
            label="接口描述"
            placeholder="请输入接口描述"
          />
          <ProFormText
            name="path"
            label="接口路径"
            rules={[{ required: true, message: '请输入接口路径' }]}
            placeholder="请输入接口路径（如：/api/v1/users 或 https://api.example.com/users）"
          />
          <SafeProFormSelect
            name="method"
            label="请求方法"
            rules={[{ required: true, message: '请选择请求方法' }]}
            options={[
              { label: 'GET', value: 'GET' },
              { label: 'POST', value: 'POST' },
              { label: 'PUT', value: 'PUT' },
              { label: 'DELETE', value: 'DELETE' },
              { label: 'PATCH', value: 'PATCH' },
            ]}
          />
          <div>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
              请求头（JSON）
            </label>
            <TextArea
              value={requestHeadersJson}
              onChange={(e) => setRequestHeadersJson(e.target.value)}
              rows={4}
              placeholder='请输入请求头（JSON 格式），例如：{"Authorization": "Bearer token", "Content-Type": "application/json"}'
              style={{ fontFamily: 'monospace', fontSize: 12 }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
              请求参数（JSON）
            </label>
            <TextArea
              value={requestParamsJson}
              onChange={(e) => setRequestParamsJson(e.target.value)}
              rows={4}
              placeholder='请输入请求参数（JSON 格式），例如：{"page": 1, "page_size": 20}'
              style={{ fontFamily: 'monospace', fontSize: 12 }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
              请求体（JSON）
            </label>
            <TextArea
              value={requestBodyJson}
              onChange={(e) => setRequestBodyJson(e.target.value)}
              rows={4}
              placeholder='请输入请求体（JSON 格式），例如：{"name": "test", "email": "test@example.com"}'
              style={{ fontFamily: 'monospace', fontSize: 12 }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
              响应格式（JSON）
            </label>
            <TextArea
              value={responseFormatJson}
              onChange={(e) => setResponseFormatJson(e.target.value)}
              rows={4}
              placeholder='请输入响应格式（JSON 格式），例如：{"code": 200, "message": "success", "data": {}}'
              style={{ fontFamily: 'monospace', fontSize: 12 }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
              响应示例（JSON）
            </label>
            <TextArea
              value={responseExampleJson}
              onChange={(e) => setResponseExampleJson(e.target.value)}
              rows={4}
              placeholder='请输入响应示例（JSON 格式），例如：{"code": 200, "message": "success", "data": {"id": 1, "name": "test"}}'
              style={{ fontFamily: 'monospace', fontSize: 12 }}
            />
          </div>
          <ProFormSwitch
            name="is_active"
            label="是否启用"
          />
          {!isEdit && (
            <ProFormSwitch
              name="is_system"
              label="是否系统接口"
            />
          )}
        </ProForm>
      </Modal>

      {/* 查看详情 Drawer */}
      <Drawer
        title="接口详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        size={700}
        loading={detailLoading}
      >
        {detailData && (
          <ProDescriptions<API>
            column={1}
            dataSource={detailData}
            columns={[
              {
                title: '接口名称',
                dataIndex: 'name',
              },
              {
                title: '接口代码',
                dataIndex: 'code',
              },
              {
                title: '接口描述',
                dataIndex: 'description',
              },
              {
                title: '请求方法',
                dataIndex: 'method',
                render: (value) => <Tag color="blue">{value}</Tag>,
              },
              {
                title: '接口路径',
                dataIndex: 'path',
              },
              {
                title: '请求头',
                dataIndex: 'request_headers',
                render: (value) => (
                  <pre style={{
                    margin: 0,
                    padding: '8px',
                    backgroundColor: '#f5f5f5',
                    borderRadius: '4px',
                    overflow: 'auto',
                    maxHeight: '200px',
                    fontSize: 12,
                  }}>
                    {JSON.stringify(value || {}, null, 2)}
                  </pre>
                ),
              },
              {
                title: '请求参数',
                dataIndex: 'request_params',
                render: (value) => (
                  <pre style={{
                    margin: 0,
                    padding: '8px',
                    backgroundColor: '#f5f5f5',
                    borderRadius: '4px',
                    overflow: 'auto',
                    maxHeight: '200px',
                    fontSize: 12,
                  }}>
                    {JSON.stringify(value || {}, null, 2)}
                  </pre>
                ),
              },
              {
                title: '请求体',
                dataIndex: 'request_body',
                render: (value) => (
                  <pre style={{
                    margin: 0,
                    padding: '8px',
                    backgroundColor: '#f5f5f5',
                    borderRadius: '4px',
                    overflow: 'auto',
                    maxHeight: '200px',
                    fontSize: 12,
                  }}>
                    {JSON.stringify(value || {}, null, 2)}
                  </pre>
                ),
              },
              {
                title: '响应格式',
                dataIndex: 'response_format',
                render: (value) => (
                  <pre style={{
                    margin: 0,
                    padding: '8px',
                    backgroundColor: '#f5f5f5',
                    borderRadius: '4px',
                    overflow: 'auto',
                    maxHeight: '200px',
                    fontSize: 12,
                  }}>
                    {JSON.stringify(value || {}, null, 2)}
                  </pre>
                ),
              },
              {
                title: '响应示例',
                dataIndex: 'response_example',
                render: (value) => (
                  <pre style={{
                    margin: 0,
                    padding: '8px',
                    backgroundColor: '#f5f5f5',
                    borderRadius: '4px',
                    overflow: 'auto',
                    maxHeight: '200px',
                    fontSize: 12,
                  }}>
                    {JSON.stringify(value || {}, null, 2)}
                  </pre>
                ),
              },
              {
                title: '启用状态',
                dataIndex: 'is_active',
                render: (value) => (
                  <Tag color={value ? 'success' : 'default'}>
                    {value ? '启用' : '禁用'}
                  </Tag>
                ),
              },
              {
                title: '系统接口',
                dataIndex: 'is_system',
                render: (value) => (
                  value ? <Tag color="purple">系统</Tag> : <Tag>自定义</Tag>
                ),
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

      {/* 接口测试 Drawer */}
      <Drawer
        title="接口测试"
        open={testDrawerVisible}
        onClose={() => {
          setTestDrawerVisible(false);
          setTestingApiUuid(null);
          setTestResult(null);
          setTestRequestJson('{}');
        }}
        size={800}
        extra={
          <Button
            type="primary"
            icon={<ThunderboltOutlined />}
            loading={testLoading}
            onClick={handleExecuteTest}
          >
            执行测试
          </Button>
        }
      >
        {testingApiUuid && (
          <>
            <div style={{ marginBottom: 16 }}>
              <Paragraph>
                <Text strong>测试请求（JSON）</Text>
              </Paragraph>
              <TextArea
                value={testRequestJson}
                onChange={(e) => setTestRequestJson(e.target.value)}
                rows={8}
                placeholder='请输入测试请求（JSON 格式），例如：{"headers": {"Authorization": "Bearer token"}, "params": {"page": 1}, "body": {"name": "test"}}'
                style={{ fontFamily: 'monospace', fontSize: 12 }}
              />
            </div>
            
            {testResult && (
              <div>
                <Paragraph>
                  <Text strong>测试结果</Text>
                </Paragraph>
                <div style={{ marginBottom: 16 }}>
                  <Space>
                    <Text>状态码：</Text>
                    <Tag color={testResult.status_code >= 200 && testResult.status_code < 300 ? 'success' : 'error'}>
                      {testResult.status_code}
                    </Tag>
                    <Text>耗时：</Text>
                    <Tag>{testResult.elapsed_time}s</Tag>
                  </Space>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <Text strong>响应头：</Text>
                  <pre style={{
                    margin: '8px 0',
                    padding: '8px',
                    backgroundColor: '#f5f5f5',
                    borderRadius: '4px',
                    overflow: 'auto',
                    maxHeight: '200px',
                    fontSize: 12,
                  }}>
                    {JSON.stringify(testResult.headers, null, 2)}
                  </pre>
                </div>
                <div>
                  <Text strong>响应体：</Text>
                  <pre style={{
                    margin: '8px 0',
                    padding: '8px',
                    backgroundColor: '#f5f5f5',
                    borderRadius: '4px',
                    overflow: 'auto',
                    maxHeight: '400px',
                    fontSize: 12,
                  }}>
                    {typeof testResult.body === 'string' ? testResult.body : JSON.stringify(testResult.body, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </>
        )}
      </Drawer>
    </div>
  );
};

export default APIListPage;

