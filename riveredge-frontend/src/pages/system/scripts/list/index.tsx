/**
 * 脚本管理列表页面
 * 
 * 用于系统管理员查看和管理组织内的脚本。
 * 支持脚本的 CRUD 操作和脚本执行功能。
 */

import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns, ProForm, ProFormText, ProFormTextArea, ProFormSelect, ProFormSwitch, ProFormInstance } from '@ant-design/pro-components';
import SafeProFormSelect from '../../../../components/safe-pro-form-select';
import { App, Popconfirm, Button, Tag, Space, Drawer, Modal, message, Input, Form } from 'antd';
import { EditOutlined, DeleteOutlined, EyeOutlined, PlusOutlined, PlayCircleOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, MODAL_CONFIG, DRAWER_CONFIG } from '../../../../components/layout-templates';
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
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Modal 相关状态（创建/编辑脚本）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentScriptUuid, setCurrentScriptUuid] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formInitialValues, setFormInitialValues] = useState<Record<string, any> | undefined>(undefined);
  
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
    setFormInitialValues({
      type: 'python',
      is_active: true,
    });
    setModalVisible(true);
  };

  /**
   * 处理编辑脚本
   */
  const handleEdit = async (record: Script) => {
    try {
      setIsEdit(true);
      setCurrentScriptUuid(record.uuid);
      
      // 获取脚本详情
      const detail = await getScriptByUuid(record.uuid);
      setFormInitialValues({
        name: detail.name,
        code: detail.code,
        type: detail.type,
        description: detail.description,
        content: detail.content,
        config: detail.config ? JSON.stringify(detail.config, null, 2) : '',
        is_active: detail.is_active,
      });
      setModalVisible(true);
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.scripts.getDetailFailed'));
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
      messageApi.error(error.message || t('pages.system.scripts.getDetailFailed'));
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
        messageApi.success(t('pages.system.scripts.executeSuccess'));
      } else {
        messageApi.error(result.error || t('pages.system.scripts.executeFailed'));
      }
      
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.scripts.executeFailed'));
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
      messageApi.success(t('pages.system.scripts.deleteSuccess'));
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.scripts.deleteFailed'));
    }
  };

  /**
   * 处理批量删除
   */
  const handleBatchDelete = async () => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning(t('pages.system.scripts.selectToDelete'));
      return;
    }
    
    try {
      await Promise.all(selectedRowKeys.map((key) => deleteScript(key as string)));
      messageApi.success(t('pages.system.scripts.batchDeleteSuccess'));
      setSelectedRowKeys([]);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(t('pages.system.scripts.batchDeleteFailed'));
    }
  };

  /**
   * 处理表单提交
   */
  const handleSubmit = async (values: any): Promise<void> => {
    try {
      setFormLoading(true);
      
      // 解析 JSON 配置
      let config: Record<string, any> | undefined;
      if (values.config) {
        try {
          config = JSON.parse(values.config);
        } catch (e) {
          messageApi.error(t('pages.system.scripts.configJsonError'));
          throw new Error(t('pages.system.scripts.configJsonError'));
        }
      }
      
      const data: CreateScriptData | UpdateScriptData = {
        ...values,
        config,
      };
      
      if (isEdit && currentScriptUuid) {
        await updateScript(currentScriptUuid, data as UpdateScriptData);
        messageApi.success(t('pages.system.scripts.updateSuccess'));
      } else {
        await createScript(data as CreateScriptData);
        messageApi.success(t('pages.system.scripts.createSuccess'));
      }
      
      setModalVisible(false);
      setFormInitialValues(undefined);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.scripts.operationFailed'));
      throw error;
    } finally {
      setFormLoading(false);
    }
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<Script>[] = [
    {
      title: t('pages.system.scripts.columnName'),
      dataIndex: 'name',
      width: 200,
      ellipsis: true,
    },
    {
      title: t('pages.system.scripts.columnCode'),
      dataIndex: 'code',
      width: 150,
      ellipsis: true,
    },
    {
      title: t('pages.system.scripts.columnType'),
      dataIndex: 'type',
      width: 120,
      valueType: 'select',
      valueEnum: {
        python: { text: t('pages.system.scripts.typePython') },
        shell: { text: t('pages.system.scripts.typeShell') },
        sql: { text: t('pages.system.scripts.typeSql') },
        javascript: { text: t('pages.system.scripts.typeJavascript') },
        other: { text: t('pages.system.scripts.typeOther') },
      },
      render: (_, record) => {
        const typeMap: Record<string, { color: string; text: string }> = {
          python: { color: 'blue', text: t('pages.system.scripts.typePython') },
          shell: { color: 'green', text: t('pages.system.scripts.typeShell') },
          sql: { color: 'purple', text: t('pages.system.scripts.typeSql') },
          javascript: { color: 'orange', text: t('pages.system.scripts.typeJavascript') },
          other: { color: 'default', text: t('pages.system.scripts.typeOther') },
        };
        const typeInfo = typeMap[record.type] || { color: 'default', text: record.type };
        return <Tag color={typeInfo.color}>{typeInfo.text}</Tag>;
      },
    },
    {
      title: t('pages.system.scripts.columnActive'),
      dataIndex: 'is_active',
      width: 100,
      valueType: 'select',
      valueEnum: {
        true: { text: t('pages.system.scripts.activeEnabled'), status: 'Success' },
        false: { text: t('pages.system.scripts.activeDisabled'), status: 'Default' },
      },
      render: (_, record) => (
        <Tag color={record.is_active ? 'success' : 'default'}>
          {record.is_active ? t('pages.system.scripts.activeEnabled') : t('pages.system.scripts.activeDisabled')}
        </Tag>
      ),
    },
    {
      title: t('pages.system.scripts.columnRunning'),
      dataIndex: 'is_running',
      width: 100,
      hideInSearch: true,
      render: (_, record) => (
        <Tag color={record.is_running ? 'processing' : 'default'}>
          {record.is_running ? t('pages.system.scripts.runningRunning') : t('pages.system.scripts.runningIdle')}
        </Tag>
      ),
    },
    {
      title: t('pages.system.scripts.columnLastRunStatus'),
      dataIndex: 'last_run_status',
      width: 120,
      hideInSearch: true,
      render: (_, record) => {
        if (!record.last_run_status) return '-';
        const statusMap: Record<string, { color: string; text: string }> = {
          success: { color: 'success', text: t('pages.system.scripts.statusSuccess') },
          failed: { color: 'error', text: t('pages.system.scripts.statusFailed') },
          running: { color: 'processing', text: t('pages.system.scripts.statusRunning') },
        };
        const statusInfo = statusMap[record.last_run_status] || { color: 'default', text: record.last_run_status };
        return <Tag color={statusInfo.color}>{statusInfo.text}</Tag>;
      },
    },
    {
      title: t('pages.system.scripts.columnLastRunAt'),
      dataIndex: 'last_run_at',
      width: 180,
      valueType: 'dateTime',
      hideInSearch: true,
    },
    {
      title: t('pages.system.scripts.columnCreatedAt'),
      dataIndex: 'created_at',
      width: 180,
      valueType: 'dateTime',
      hideInSearch: true,
    },
    {
      title: t('pages.system.scripts.columnActions'),
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
            {t('pages.system.scripts.view')}
          </Button>,
          <Button
            key="edit"
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            {t('pages.system.scripts.edit')}
          </Button>,
          <Button
            key="execute"
            type="link"
            size="small"
            icon={<PlayCircleOutlined />}
            onClick={() => handleExecute(record)}
            disabled={!record.is_active || record.is_running}
          >
            {t('pages.system.scripts.execute')}
          </Button>,
          <Popconfirm
            key="delete"
            title={t('pages.system.scripts.deleteConfirmTitle')}
            onConfirm={() => handleDelete(record)}
          >
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
            >
              {t('pages.system.scripts.delete')}
            </Button>
          </Popconfirm>,
        ];
      },
    },
  ];

  return (
    <>
      <ListPageTemplate>
        <UniTable<Script>
          headerTitle={t('pages.system.scripts.title')}
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
          showAdvancedSearch={true}
          showCreateButton
          createButtonText={t('pages.system.scripts.createButton')}
          onCreate={handleCreate}
          showDeleteButton
          onDelete={handleBatchDelete}
          deleteButtonText={t('pages.system.scripts.batchDelete')}
          showImportButton
          showExportButton
          onExport={async (type, keys, pageData) => {
            const allData = await getScriptList({ skip: 0, limit: 10000 });
            let items = type === 'currentPage' && pageData?.length ? pageData : allData;
            if (type === 'selected' && keys?.length) {
              items = allData.filter((d) => keys.includes(d.uuid));
            }
            if (items.length === 0) {
              messageApi.warning(t('pages.system.scripts.noDataToExport'));
              return;
            }
            const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `scripts-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
            messageApi.success(t('pages.system.scripts.exportSuccess'));
          }}
          search={{
            labelWidth: 'auto',
          }}
        />
      </ListPageTemplate>

      {/* 创建/编辑 Modal */}
      <FormModalTemplate
        title={isEdit ? t('pages.system.scripts.modalEdit') : t('pages.system.scripts.modalCreate')}
        open={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setFormInitialValues(undefined);
        }}
        onFinish={handleSubmit}
        isEdit={isEdit}
        initialValues={formInitialValues}
        loading={formLoading}
        width={MODAL_CONFIG.LARGE_WIDTH}
      >
        <ProFormText
          name="name"
          label={t('pages.system.scripts.labelName')}
          rules={[{ required: true, message: t('pages.system.scripts.nameRequired') }]}
        />
        <ProFormText
          name="code"
          label={t('pages.system.scripts.labelCode')}
          rules={[
            { required: true, message: t('pages.system.scripts.codeRequired') },
            { pattern: /^[a-zA-Z][a-zA-Z0-9_]*$/, message: t('pages.system.scripts.codePattern') },
          ]}
          disabled={isEdit}
          tooltip={t('pages.system.scripts.codeTooltip')}
        />
        <SafeProFormSelect
          name="type"
          label={t('pages.system.scripts.labelType')}
          rules={[{ required: true, message: t('pages.system.scripts.typeRequired') }]}
          options={[
            { label: t('pages.system.scripts.typePython'), value: 'python' },
            { label: t('pages.system.scripts.typeShell'), value: 'shell' },
            { label: t('pages.system.scripts.typeSql'), value: 'sql' },
            { label: t('pages.system.scripts.typeJavascript'), value: 'javascript' },
            { label: t('pages.system.scripts.typeOther'), value: 'other' },
          ]}
          disabled={isEdit}
        />
        <ProFormTextArea
          name="description"
          label={t('pages.system.scripts.labelDescription')}
          fieldProps={{
            rows: 3,
          }}
        />
        <ProFormTextArea
          name="content"
          label={t('pages.system.scripts.labelContent')}
          rules={[{ required: true, message: t('pages.system.scripts.contentRequired') }]}
          fieldProps={{
            rows: 12,
            style: { fontFamily: 'monospace' },
          }}
        />
        <ProFormTextArea
          name="config"
          label={t('pages.system.scripts.labelConfig')}
          fieldProps={{
            rows: 4,
            style: { fontFamily: 'monospace' },
          }}
          tooltip={t('pages.system.scripts.configTooltip')}
        />
        {isEdit && (
          <ProFormSwitch
            name="is_active"
            label={t('pages.system.scripts.labelActive')}
          />
        )}
      </FormModalTemplate>

      {/* 执行脚本 Modal */}
      <Modal
        title={t('pages.system.scripts.executeModalTitle')}
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
              submitText: t('pages.system.scripts.submitExecute'),
            },
          }}
        >
          <ProFormTextArea
            name="parameters"
            label={t('pages.system.scripts.labelParams')}
            fieldProps={{
              rows: 4,
              style: { fontFamily: 'monospace' },
              placeholder: t('pages.system.scripts.paramsPlaceholder'),
            }}
            tooltip={t('pages.system.scripts.paramsTooltip')}
          />
          <ProFormSwitch
            name="async_execution"
            label={t('pages.system.scripts.labelAsync')}
            tooltip={t('pages.system.scripts.asyncTooltip')}
          />
        </ProForm>
        
        {executeResult && (
          <div style={{ marginTop: 24, padding: 16, background: '#f5f5f5', borderRadius: 4 }}>
            <div style={{ marginBottom: 8, fontWeight: 'bold' }}>{t('pages.system.scripts.resultTitle')}</div>
            {executeResult.success ? (
              <div style={{ color: '#52c41a' }}>{t('pages.system.scripts.resultSuccess')}</div>
            ) : (
              <div style={{ color: '#ff4d4f' }}>{t('pages.system.scripts.resultFailed')}</div>
            )}
            {executeResult.output && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontWeight: 'bold', marginBottom: 4 }}>{t('pages.system.scripts.outputLabel')}</div>
                <pre style={{ background: '#fff', padding: 8, borderRadius: 4, maxHeight: 200, overflow: 'auto' }}>
                  {executeResult.output}
                </pre>
              </div>
            )}
            {executeResult.error && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontWeight: 'bold', marginBottom: 4 }}>{t('pages.system.scripts.errorLabel')}</div>
                <pre style={{ background: '#fff', padding: 8, borderRadius: 4, maxHeight: 200, overflow: 'auto', color: '#ff4d4f' }}>
                  {executeResult.error}
                </pre>
              </div>
            )}
            {executeResult.execution_time && (
              <div style={{ marginTop: 8, color: '#666' }}>
                {t('pages.system.scripts.executionTime', { seconds: executeResult.execution_time.toFixed(2) })}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* 详情 Drawer */}
      <DetailDrawerTemplate
        title={t('pages.system.scripts.detailTitle')}
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        loading={detailLoading}
        width={DRAWER_CONFIG.LARGE_WIDTH}
        dataSource={detailData}
        columns={[
          {
            title: t('pages.system.scripts.columnName'),
            dataIndex: 'name',
          },
          {
            title: t('pages.system.scripts.columnCode'),
            dataIndex: 'code',
          },
          {
            title: t('pages.system.scripts.columnType'),
            dataIndex: 'type',
          },
          {
            title: t('pages.system.scripts.labelDescription'),
            dataIndex: 'description',
          },
          {
            title: t('pages.system.scripts.columnActive'),
            dataIndex: 'is_active',
            render: (value: boolean) => (
              <Tag color={value ? 'success' : 'default'}>
                {value ? t('pages.system.scripts.activeEnabled') : t('pages.system.scripts.activeDisabled')}
              </Tag>
            ),
          },
          {
            title: t('pages.system.scripts.columnRunning'),
            dataIndex: 'is_running',
            render: (value: boolean) => (
              <Tag color={value ? 'processing' : 'default'}>
                {value ? t('pages.system.scripts.runningRunning') : t('pages.system.scripts.runningIdle')}
              </Tag>
            ),
          },
          {
            title: t('pages.system.scripts.columnContent'),
            dataIndex: 'content',
            render: (value: string) => (
              <pre style={{ maxHeight: '300px', overflow: 'auto', background: '#f5f5f5', padding: 12, borderRadius: 4 }}>
                {value}
              </pre>
            ),
          },
          {
            title: t('pages.system.scripts.columnConfig'),
            dataIndex: 'config',
            render: (value: Record<string, any>) => (
              value ? (
                <pre style={{ maxHeight: '200px', overflow: 'auto', background: '#f5f5f5', padding: 12, borderRadius: 4 }}>
                  {JSON.stringify(value, null, 2)}
                </pre>
              ) : '-'
            ),
          },
          {
            title: t('pages.system.scripts.columnLastRunStatus'),
            dataIndex: 'last_run_status',
            render: (value: string) => {
              if (!value) return '-';
              const statusMap: Record<string, { color: string; text: string }> = {
                success: { color: 'success', text: t('pages.system.scripts.statusSuccess') },
                failed: { color: 'error', text: t('pages.system.scripts.statusFailed') },
                running: { color: 'processing', text: t('pages.system.scripts.statusRunning') },
              };
              const statusInfo = statusMap[value] || { color: 'default', text: value };
              return <Tag color={statusInfo.color}>{statusInfo.text}</Tag>;
            },
          },
          {
            title: t('pages.system.scripts.columnLastRunAt'),
            dataIndex: 'last_run_at',
            valueType: 'dateTime',
          },
          {
            title: t('pages.system.scripts.columnLastError'),
            dataIndex: 'last_error',
            render: (value: string) => (
              value ? (
                <pre style={{ maxHeight: '100px', overflow: 'auto', background: '#fff2f0', padding: 8, borderRadius: 4, color: '#ff4d4f' }}>
                  {value}
                </pre>
              ) : '-'
            ),
          },
          {
            title: t('pages.system.scripts.columnCreatedAt'),
            dataIndex: 'created_at',
            valueType: 'dateTime',
          },
          {
            title: t('pages.system.scripts.columnUpdatedAt'),
            dataIndex: 'updated_at',
            valueType: 'dateTime',
          },
        ]}
      />
    </>
  );
};

export default ScriptListPage;

