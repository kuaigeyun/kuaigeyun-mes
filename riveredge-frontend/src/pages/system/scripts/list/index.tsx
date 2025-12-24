/**
 * 脚本管理列表页面
 * 
 * 用于系统管理员查看和管理组织内的脚本。
 * 支持脚本的 CRUD 操作和脚本执行功能。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProDescriptions, ProForm, ProFormText, ProFormTextArea, ProFormSelect, ProFormSwitch, ProFormInstance } from '@ant-design/pro-components';
import SafeProFormSelect from '../../../../components/SafeProFormSelect';
import { App, Popconfirm, Button, Tag, Space, Drawer, Modal, message, Input, Form } from 'antd';
import { EditOutlined, DeleteOutlined, EyeOutlined, PlusOutlined, PlayCircleOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../components/uni-table';
import {
  getScriptList,
  getScriptByUuid,
  createScript,
  updateScript,
  deleteScript,
  executeScript,
  Script,
  CreateScriptData,
  UpdateScriptData,
  ExecuteScriptData,
  ScriptExecuteResponse,
} from '../../../../services/script';

const { TextArea } = Input;

/**
 * 脚本管理列表页面组件
 */
const ScriptListPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Modal 相关状态（创建/编辑脚本）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentScriptUuid, setCurrentScriptUuid] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  
  // Modal 相关状态（执行脚本）
  const [executeModalVisible, setExecuteModalVisible] = useState(false);
  const [executeFormLoading, setExecuteFormLoading] = useState(false);
  const [currentExecuteScriptUuid, setCurrentExecuteScriptUuid] = useState<string | null>(null);
  const [executeFormRef] = Form.useForm();
  const [executeResult, setExecuteResult] = useState<ScriptExecuteResponse | null>(null);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [detailData, setDetailData] = useState<Script | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  /**
   * 处理新建脚本
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentScriptUuid(null);
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      type: 'python',
      is_active: true,
    });
  };

  /**
   * 处理编辑脚本
   */
  const handleEdit = async (record: Script) => {
    try {
      setIsEdit(true);
      setCurrentScriptUuid(record.uuid);
      setModalVisible(true);
      
      // 获取脚本详情
      const detail = await getScriptByUuid(record.uuid);
      formRef.current?.setFieldsValue({
        name: detail.name,
        code: detail.code,
        type: detail.type,
        description: detail.description,
        content: detail.content,
        config: detail.config ? JSON.stringify(detail.config, null, 2) : '',
        is_active: detail.is_active,
      });
    } catch (error: any) {
      messageApi.error(error.message || '获取脚本详情失败');
    }
  };

  /**
   * 处理查看详情
   */
  const handleView = async (record: Script) => {
    try {
      setDetailLoading(true);
      setDrawerVisible(true);
      const detail = await getScriptByUuid(record.uuid);
      setDetailData(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取脚本详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理执行脚本
   */
  const handleExecute = (record: Script) => {
    setCurrentExecuteScriptUuid(record.uuid);
    setExecuteModalVisible(true);
    setExecuteResult(null);
    executeFormRef.current?.resetFields();
    executeFormRef.current?.setFieldsValue({
      async_execution: false,
    });
  };

  /**
   * 处理执行脚本表单提交
   */
  const handleExecuteSubmit = async (values: any) => {
    if (!currentExecuteScriptUuid) return;
    
    try {
      setExecuteFormLoading(true);
      setExecuteResult(null);
      
      const data: ExecuteScriptData = {
        parameters: values.parameters ? JSON.parse(values.parameters) : undefined,
        async_execution: values.async_execution || false,
      };
      
      const result = await executeScript(currentExecuteScriptUuid, data);
      setExecuteResult(result);
      
      if (result.success) {
        messageApi.success('脚本执行成功');
      } else {
        messageApi.error(result.error || '脚本执行失败');
      }
      
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '脚本执行失败');
    } finally {
      setExecuteFormLoading(false);
    }
  };

  /**
   * 处理删除脚本
   */
  const handleDelete = async (record: Script) => {
    try {
      await deleteScript(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理批量删除
   */
  const handleBatchDelete = async () => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning('请选择要删除的脚本');
      return;
    }
    
    try {
      await Promise.all(selectedRowKeys.map((key) => deleteScript(key as string)));
      messageApi.success('批量删除成功');
      setSelectedRowKeys([]);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error('批量删除失败');
    }
  };

  /**
   * 处理表单提交
   */
  const handleSubmit = async (values: any) => {
    try {
      setFormLoading(true);
      
      // 解析 JSON 配置
      let config: Record<string, any> | undefined;
      if (values.config) {
        try {
          config = JSON.parse(values.config);
        } catch (e) {
          messageApi.error('脚本配置 JSON 格式错误');
          return;
        }
      }
      
      const data: CreateScriptData | UpdateScriptData = {
        ...values,
        config,
      };
      
      if (isEdit && currentScriptUuid) {
        await updateScript(currentScriptUuid, data as UpdateScriptData);
        messageApi.success('更新成功');
      } else {
        await createScript(data as CreateScriptData);
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
  const columns: ProColumns<Script>[] = [
    {
      title: '脚本名称',
      dataIndex: 'name',
      width: 200,
      ellipsis: true,
    },
    {
      title: '脚本代码',
      dataIndex: 'code',
      width: 150,
      ellipsis: true,
    },
    {
      title: '脚本类型',
      dataIndex: 'type',
      width: 120,
      valueType: 'select',
      valueEnum: {
        python: { text: 'Python' },
        shell: { text: 'Shell' },
        sql: { text: 'SQL' },
        javascript: { text: 'JavaScript' },
        other: { text: '其他' },
      },
      render: (_, record) => {
        const typeMap: Record<string, { color: string; text: string }> = {
          python: { color: 'blue', text: 'Python' },
          shell: { color: 'green', text: 'Shell' },
          sql: { color: 'purple', text: 'SQL' },
          javascript: { color: 'orange', text: 'JavaScript' },
          other: { color: 'default', text: '其他' },
        };
        const typeInfo = typeMap[record.type] || { color: 'default', text: record.type };
        return <Tag color={typeInfo.color}>{typeInfo.text}</Tag>;
      },
    },
    {
      title: '是否启用',
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
      title: '运行状态',
      dataIndex: 'is_running',
      width: 100,
      hideInSearch: true,
      render: (_, record) => (
        <Tag color={record.is_running ? 'processing' : 'default'}>
          {record.is_running ? '运行中' : '空闲'}
        </Tag>
      ),
    },
    {
      title: '最后执行状态',
      dataIndex: 'last_run_status',
      width: 120,
      hideInSearch: true,
      render: (_, record) => {
        if (!record.last_run_status) return '-';
        const statusMap: Record<string, { color: string; text: string }> = {
          success: { color: 'success', text: '成功' },
          failed: { color: 'error', text: '失败' },
          running: { color: 'processing', text: '运行中' },
        };
        const statusInfo = statusMap[record.last_run_status] || { color: 'default', text: record.last_run_status };
        return <Tag color={statusInfo.color}>{statusInfo.text}</Tag>;
      },
    },
    {
      title: '最后执行时间',
      dataIndex: 'last_run_at',
      width: 180,
      valueType: 'dateTime',
      hideInSearch: true,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      width: 180,
      valueType: 'dateTime',
      hideInSearch: true,
    },
    {
      title: '操作',
      valueType: 'option',
      width: 300,
      fixed: 'right',
      render: (_, record) => {
        return [
          <Button
            key="view"
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleView(record)}
          >
            查看
          </Button>,
          <Button
            key="edit"
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>,
          <Button
            key="execute"
            type="link"
            size="small"
            icon={<PlayCircleOutlined />}
            onClick={() => handleExecute(record)}
            disabled={!record.is_active || record.is_running}
          >
            执行
          </Button>,
          <Popconfirm
            key="delete"
            title="确定要删除这个脚本吗？"
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
          </Popconfirm>,
        ];
      },
    },
  ];

  return (
    <>
      <UniTable<Script>
        headerTitle="脚本管理"
        actionRef={actionRef}
        columns={columns}
        request={async (params, sort, _filter, searchFormValues) => {
          const { current = 1, pageSize = 20, ...rest } = params;
          const skip = (current - 1) * pageSize;
          const limit = pageSize;
          
          const listParams: any = {
            skip,
            limit,
            ...searchFormValues,
          };
          
          const data = await getScriptList(listParams);
          return {
            data,
            success: true,
            total: data.length,
          };
        }}
        rowKey="uuid"
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
        toolBarRender={() => [
          <Button
            key="batch-delete"
            danger
            onClick={handleBatchDelete}
            disabled={selectedRowKeys.length === 0}
          >
            批量删除
          </Button>,
          <Button
            key="create"
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreate}
          >
            新建
          </Button>,
        ]}
        search={{
          labelWidth: 'auto',
          showAdvancedSearch: true,
        }}
      />

      {/* 创建/编辑 Modal */}
      <Modal
        title={isEdit ? '编辑脚本' : '新建脚本'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        size={900}
      >
        <ProForm
          formRef={formRef}
          loading={formLoading}
          onFinish={handleSubmit}
          submitter={{
            searchConfig: {
              submitText: isEdit ? '更新' : '创建',
            },
          }}
        >
          <ProFormText
            name="name"
            label="脚本名称"
            rules={[{ required: true, message: '请输入脚本名称' }]}
          />
          <ProFormText
            name="code"
            label="脚本代码"
            rules={[
              { required: true, message: '请输入脚本代码' },
              { pattern: /^[a-zA-Z][a-zA-Z0-9_]*$/, message: '脚本代码只能包含字母、数字和下划线，且必须以字母开头' },
            ]}
            disabled={isEdit}
            tooltip="脚本代码用于程序识别，创建后不可修改"
          />
          <SafeProFormSelect
            name="type"
            label="脚本类型"
            rules={[{ required: true, message: '请选择脚本类型' }]}
            options={[
              { label: 'Python', value: 'python' },
              { label: 'Shell', value: 'shell' },
              { label: 'SQL', value: 'sql' },
              { label: 'JavaScript', value: 'javascript' },
              { label: '其他', value: 'other' },
            ]}
            disabled={isEdit}
          />
          <ProFormTextArea
            name="description"
            label="脚本描述"
            fieldProps={{
              rows: 3,
            }}
          />
          <ProFormTextArea
            name="content"
            label="脚本内容"
            rules={[{ required: true, message: '请输入脚本内容' }]}
            fieldProps={{
              rows: 12,
              style: { fontFamily: 'monospace' },
            }}
          />
          <ProFormTextArea
            name="config"
            label="脚本配置（JSON，可选）"
            fieldProps={{
              rows: 4,
              style: { fontFamily: 'monospace' },
            }}
            tooltip="脚本配置，JSON 格式，如参数、环境变量等"
          />
          {isEdit && (
            <ProFormSwitch
              name="is_active"
              label="是否启用"
            />
          )}
        </ProForm>
      </Modal>

      {/* 执行脚本 Modal */}
      <Modal
        title="执行脚本"
        open={executeModalVisible}
        onCancel={() => setExecuteModalVisible(false)}
        footer={null}
        size={700}
      >
        <ProForm
          formRef={executeFormRef}
          loading={executeFormLoading}
          onFinish={handleExecuteSubmit}
          submitter={{
            searchConfig: {
              submitText: '执行',
            },
          }}
        >
          <ProFormTextArea
            name="parameters"
            label="脚本参数（JSON，可选）"
            fieldProps={{
              rows: 4,
              style: { fontFamily: 'monospace' },
              placeholder: '{"key": "value"}',
            }}
            tooltip="脚本执行参数，JSON 格式"
          />
          <ProFormSwitch
            name="async_execution"
            label="异步执行（通过 Inngest）"
            tooltip="如果启用，脚本将通过 Inngest 异步执行"
          />
        </ProForm>
        
        {executeResult && (
          <div style={{ marginTop: 24, padding: 16, background: '#f5f5f5', borderRadius: 4 }}>
            <div style={{ marginBottom: 8, fontWeight: 'bold' }}>执行结果：</div>
            {executeResult.success ? (
              <div style={{ color: '#52c41a' }}>✓ 执行成功</div>
            ) : (
              <div style={{ color: '#ff4d4f' }}>✗ 执行失败</div>
            )}
            {executeResult.output && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontWeight: 'bold', marginBottom: 4 }}>输出：</div>
                <pre style={{ background: '#fff', padding: 8, borderRadius: 4, maxHeight: 200, overflow: 'auto' }}>
                  {executeResult.output}
                </pre>
              </div>
            )}
            {executeResult.error && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontWeight: 'bold', marginBottom: 4 }}>错误：</div>
                <pre style={{ background: '#fff', padding: 8, borderRadius: 4, maxHeight: 200, overflow: 'auto', color: '#ff4d4f' }}>
                  {executeResult.error}
                </pre>
              </div>
            )}
            {executeResult.execution_time && (
              <div style={{ marginTop: 8, color: '#666' }}>
                执行时间：{executeResult.execution_time.toFixed(2)} 秒
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* 详情 Drawer */}
      <Drawer
        title="脚本详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        size={700}
      >
        {detailLoading ? (
          <div>加载中...</div>
        ) : detailData ? (
          <ProDescriptions
            column={1}
            dataSource={detailData}
            columns={[
              {
                title: '脚本名称',
                dataIndex: 'name',
              },
              {
                title: '脚本代码',
                dataIndex: 'code',
              },
              {
                title: '脚本类型',
                dataIndex: 'type',
              },
              {
                title: '脚本描述',
                dataIndex: 'description',
              },
              {
                title: '是否启用',
                dataIndex: 'is_active',
                render: (value) => (
                  <Tag color={value ? 'success' : 'default'}>
                    {value ? '启用' : '禁用'}
                  </Tag>
                ),
              },
              {
                title: '运行状态',
                dataIndex: 'is_running',
                render: (value) => (
                  <Tag color={value ? 'processing' : 'default'}>
                    {value ? '运行中' : '空闲'}
                  </Tag>
                ),
              },
              {
                title: '脚本内容',
                dataIndex: 'content',
                render: (value) => (
                  <pre style={{ maxHeight: '300px', overflow: 'auto', background: '#f5f5f5', padding: 12, borderRadius: 4 }}>
                    {value}
                  </pre>
                ),
              },
              {
                title: '脚本配置',
                dataIndex: 'config',
                render: (value) => (
                  value ? (
                    <pre style={{ maxHeight: '200px', overflow: 'auto', background: '#f5f5f5', padding: 12, borderRadius: 4 }}>
                      {JSON.stringify(value, null, 2)}
                    </pre>
                  ) : '-'
                ),
              },
              {
                title: '最后执行状态',
                dataIndex: 'last_run_status',
                render: (value) => {
                  if (!value) return '-';
                  const statusMap: Record<string, { color: string; text: string }> = {
                    success: { color: 'success', text: '成功' },
                    failed: { color: 'error', text: '失败' },
                    running: { color: 'processing', text: '运行中' },
                  };
                  const statusInfo = statusMap[value] || { color: 'default', text: value };
                  return <Tag color={statusInfo.color}>{statusInfo.text}</Tag>;
                },
              },
              {
                title: '最后执行时间',
                dataIndex: 'last_run_at',
                valueType: 'dateTime',
              },
              {
                title: '最后执行错误',
                dataIndex: 'last_error',
                render: (value) => (
                  value ? (
                    <pre style={{ maxHeight: '100px', overflow: 'auto', background: '#fff2f0', padding: 8, borderRadius: 4, color: '#ff4d4f' }}>
                      {value}
                    </pre>
                  ) : '-'
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
        ) : null}
      </Drawer>
    </>
  );
};

export default ScriptListPage;

