/**
 * 平台级定时任务管理列表页面
 * 
 * 用于平台管理员查看和管理全局定时任务。
 * 此功能已从租户级移至平台级，以降低注入攻击风险。
 */

import React, { useRef, useState } from 'react';
import { rowActionKind } from '../../../../components/uni-action';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns, ProForm, ProFormText, ProFormTextArea, ProFormSelect, ProFormSwitch, ProFormInstance } from '@ant-design/pro-components';
import SafeProFormSelect from '../../../../components/safe-pro-form-select';
import { App, Popconfirm, Button, Tag, Space, Drawer, Modal, message, Input, Row, Col } from 'antd';
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
import { countWithPagedRequests } from '../../../../utils/pagedCount';

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
  const executeFormRef = useRef<ProFormInstance>(null);
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
      messageApi.error(error.message || t('pages.infra.scripts.getDetailFailed'));
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
      messageApi.error(error.message || t('pages.infra.scripts.getDetailFailed'));
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
        messageApi.success(t('pages.infra.scripts.executeSuccess'));
      } else {
        messageApi.error(result.error || t('pages.infra.scripts.executeFailed'));
      }
      
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('pages.infra.scripts.executeFailed'));
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
      messageApi.success(t('pages.infra.scripts.deleteSuccess'));
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('pages.infra.scripts.deleteFailed'));
    }
  };

  /**
   * 处理批量删除
   */
  const handleBatchDelete = async () => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning(t('pages.infra.scripts.selectToDelete'));
      return;
    }
    
    try {
      await Promise.all(selectedRowKeys.map((key) => deleteScript(key as string)));
      messageApi.success(t('pages.infra.scripts.batchDeleteSuccess'));
      setSelectedRowKeys([]);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(t('pages.infra.scripts.batchDeleteFailed'));
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
          messageApi.error(t('pages.infra.scripts.configJsonError'));
          throw new Error(t('pages.infra.scripts.configJsonError'));
        }
      }
      
      const data: CreateScriptData | UpdateScriptData = {
        ...values,
        config,
      };
      
      if (isEdit && currentScriptUuid) {
        await updateScript(currentScriptUuid, data as UpdateScriptData);
        messageApi.success(t('pages.infra.scripts.updateSuccess'));
      } else {
        await createScript(data as CreateScriptData);
        messageApi.success(t('pages.infra.scripts.createSuccess'));
      }
      
      setModalVisible(false);
      setFormInitialValues(undefined);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('pages.infra.scripts.operationFailed'));
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
      title: t('pages.infra.scripts.columnName'),
      dataIndex: 'name',
      width: 200,
      ellipsis: true,
    },
    {
      title: t('pages.infra.scripts.columnCode'),
      dataIndex: 'code',
      width: 150,
      ellipsis: true,
    },
    {
      title: t('pages.infra.scripts.columnType'),
      dataIndex: 'type',
      width: 120,
      valueType: 'select',
      valueEnum: {
        python: { text: t('pages.infra.scripts.typePython') },
        shell: { text: t('pages.infra.scripts.typeShell') },
        sql: { text: t('pages.infra.scripts.typeSql') },
        javascript: { text: t('pages.infra.scripts.typeJavascript') },
        other: { text: t('pages.infra.scripts.typeOther') },
      },
      render: (_, record) => {
        const typeMap: Record<string, { color: string; text: string }> = {
          python: { color: 'blue', text: t('pages.infra.scripts.typePython') },
          shell: { color: 'green', text: t('pages.infra.scripts.typeShell') },
          sql: { color: 'purple', text: t('pages.infra.scripts.typeSql') },
          javascript: { color: 'orange', text: t('pages.infra.scripts.typeJavascript') },
          other: { color: 'default', text: t('pages.infra.scripts.typeOther') },
        };
        const typeInfo = typeMap[record.type] || { color: 'default', text: record.type };
        return <Tag color={typeInfo.color}>{typeInfo.text}</Tag>;
      },
    },
    {
      title: t('pages.infra.scripts.columnActive'),
      dataIndex: 'is_active',
      width: 100,
      valueType: 'select',
      valueEnum: {
        true: { text: t('pages.infra.scripts.activeEnabled'), status: 'Success' },
        false: { text: t('pages.infra.scripts.activeDisabled'), status: 'Default' },
      },
      render: (_, record) => (
        <Tag color={record.is_active ? 'success' : 'default'}>
          {record.is_active ? t('pages.infra.scripts.activeEnabled') : t('pages.infra.scripts.activeDisabled')}
        </Tag>
      ),
    },
    {
      title: t('pages.infra.scripts.columnRunning'),
      dataIndex: 'is_running',
      width: 100,
      hideInSearch: true,
      render: (_, record) => (
        <Tag color={record.is_running ? 'processing' : 'default'}>
          {record.is_running ? t('pages.infra.scripts.runningRunning') : t('pages.infra.scripts.runningIdle')}
        </Tag>
      ),
    },
    {
      title: t('pages.infra.scripts.columnLastRunStatus'),
      dataIndex: 'last_run_status',
      width: 120,
      hideInSearch: true,
      render: (_, record) => {
        if (!record.last_run_status) return '-';
        const statusMap: Record<string, { color: string; text: string }> = {
          success: { color: 'success', text: t('pages.infra.scripts.statusSuccess') },
          failed: { color: 'error', text: t('pages.infra.scripts.statusFailed') },
          running: { color: 'processing', text: t('pages.infra.scripts.statusRunning') },
        };
        const statusInfo = statusMap[record.last_run_status] || { color: 'default', text: record.last_run_status };
        return <Tag color={statusInfo.color}>{statusInfo.text}</Tag>;
      },
    },
    {
      title: t('pages.infra.scripts.columnLastRunAt'),
      dataIndex: 'last_run_at',
      width: 180,
      valueType: 'dateTime',
      hideInSearch: true,
    },
    {
      title: t('pages.infra.scripts.columnCreatedAt'),
      dataIndex: 'created_at',
      width: 180,
      valueType: 'dateTime',
      hideInSearch: true,
    },
    {
      title: t('pages.infra.scripts.columnActions'),
      valueType: 'option',
      width: 300,
      fixed: 'right',
      render: (_, record) => {
        return [
          <Button {...rowActionKind('read')}
            key="view"
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleView(record)}
          >
            {t('pages.infra.scripts.view')}
          </Button>,
          <Button {...rowActionKind('update')}
            key="edit"
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            {t('pages.infra.scripts.edit')}
          </Button>,
          <Button {...rowActionKind('execute')}
            key="execute"
            type="link"
            size="small"
            icon={<PlayCircleOutlined />}
            onClick={() => handleExecute(record)}
            disabled={!record.is_active || record.is_running}
          >
            {t('pages.infra.scripts.execute')}
          </Button>,
          <Popconfirm {...rowActionKind('delete')}
            key="delete"
            title={t('pages.infra.scripts.deleteConfirmTitle')}
            onConfirm={() => handleDelete(record)}
          >
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
            >
              {t('pages.infra.scripts.delete')}
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
          columnPersistenceId="pages.infra.scripts.list"
          headerTitle={t('pages.infra.scripts.title')}
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
            
            const [data, total] = await Promise.all([
              getScriptList(listParams),
              countWithPagedRequests(getScriptList, searchFormValues || {}, { chunkSize: 100 }),
            ]);
            return {
              data,
              success: true,
              total,
            };
          }}
          rowKey="uuid"
          rowSelection={{
            selectedRowKeys,
            onChange: setSelectedRowKeys,
          }}
          showAdvancedSearch={true}
          showCreateButton
          createButtonText={t('pages.infra.scripts.createButton')}
          onCreate={handleCreate}
          showDeleteButton
          onDelete={handleBatchDelete}
          deleteButtonText={t('pages.infra.scripts.batchDelete')}
          showImportButton
          showExportButton
          onExport={async (type, keys, pageData) => {
            const allData = await getScriptList({ skip: 0, limit: 10000 });
            let items = type === 'currentPage' && pageData?.length ? pageData : allData;
            if (type === 'selected' && keys?.length) {
              items = allData.filter((d) => keys.includes(d.uuid));
            }
            if (items.length === 0) {
              messageApi.warning(t('pages.infra.scripts.noDataToExport'));
              return;
            }
            const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `scripts-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
            messageApi.success(t('pages.infra.scripts.exportSuccess'));
          }}
          search={{
            labelWidth: 'auto',
          }}
        />
      </ListPageTemplate>

      {/* 创建/编辑 Modal - 两栏布局，备注倒数第二，启用开关最后 */}
      <FormModalTemplate
        title={isEdit ? t('pages.infra.scripts.modalEdit') : t('pages.infra.scripts.modalCreate')}
        open={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setFormInitialValues(undefined);
        }}
        onFinish={handleSubmit}
        isEdit={isEdit}
        initialValues={formInitialValues}
        loading={formLoading}
        width={MODAL_CONFIG.STANDARD_WIDTH}
      >
        <Row gutter={16}>
          <Col span={8}>
            <ProFormText
              name="code"
              label={t('pages.infra.scripts.labelCode')}
              rules={[
                { required: true, message: t('pages.infra.scripts.codeRequired') },
                { pattern: /^[a-zA-Z][a-zA-Z0-9_]*$/, message: t('pages.infra.scripts.codePattern') },
              ]}
              disabled={isEdit}
              tooltip={t('pages.infra.scripts.codeTooltip')}
            />
          </Col>
          <Col span={8}>
            <ProFormText
              name="name"
              label={t('pages.infra.scripts.labelName')}
              rules={[{ required: true, message: t('pages.infra.scripts.nameRequired') }]}
            />
          </Col>
          <Col span={8}>
            <SafeProFormSelect
              name="type"
              label={t('pages.infra.scripts.labelType')}
              rules={[{ required: true, message: t('pages.infra.scripts.typeRequired') }]}
              options={[
                { label: t('pages.infra.scripts.typePython'), value: 'python' },
                { label: t('pages.infra.scripts.typeShell'), value: 'shell' },
                { label: t('pages.infra.scripts.typeSql'), value: 'sql' },
                { label: t('pages.infra.scripts.typeJavascript'), value: 'javascript' },
                { label: t('pages.infra.scripts.typeOther'), value: 'other' },
              ]}
              disabled={isEdit}
            />
          </Col>
        </Row>
        <ProFormTextArea
          name="content"
          label={t('pages.infra.scripts.labelContent')}
          rules={[{ required: true, message: t('pages.infra.scripts.contentRequired') }]}
          fieldProps={{
            rows: 12,
            style: { fontFamily: 'monospace' },
          }}
        />
        <ProFormTextArea
          name="config"
          label={t('pages.infra.scripts.labelConfig')}
          fieldProps={{
            rows: 4,
            style: { fontFamily: 'monospace' },
          }}
          tooltip={t('pages.infra.scripts.configTooltip')}
        />
        <ProFormTextArea
          name="description"
          label={t('pages.infra.scripts.labelDescription')}
          fieldProps={{
            rows: 3,
          }}
        />
        <ProFormSwitch
          name="is_active"
          label={t('pages.infra.scripts.labelActive')}
        />
      </FormModalTemplate>

      {/* 执行脚本 Modal */}
      <Modal
        title={t('pages.infra.scripts.executeModalTitle')}
        open={executeModalVisible}
        onCancel={() => setExecuteModalVisible(false)}
        footer={null}
        width={700}
      >
        <ProForm
          formRef={executeFormRef}
          loading={executeFormLoading}
          onFinish={handleExecuteSubmit}
          submitter={{
            searchConfig: {
              submitText: t('pages.infra.scripts.submitExecute'),
            },
          }}
        >
          <ProFormTextArea
            name="parameters"
            label={t('pages.infra.scripts.labelParams')}
            fieldProps={{
              rows: 4,
              style: { fontFamily: 'monospace' },
              placeholder: t('pages.infra.scripts.paramsPlaceholder'),
            }}
            tooltip={t('pages.infra.scripts.paramsTooltip')}
          />
          <ProFormSwitch
            name="async_execution"
            label={t('pages.infra.scripts.labelAsync')}
            tooltip={t('pages.infra.scripts.asyncTooltip')}
          />
        </ProForm>
        
        {executeResult && (
          <div style={{ marginTop: 24, padding: 16, background: '#f5f5f5', borderRadius: 4 }}>
            <div style={{ marginBottom: 8, fontWeight: 'bold' }}>{t('pages.infra.scripts.resultTitle')}</div>
            {executeResult.success ? (
              <div style={{ color: '#52c41a' }}>{t('pages.infra.scripts.resultSuccess')}</div>
            ) : (
              <div style={{ color: '#ff4d4f' }}>{t('pages.infra.scripts.resultFailed')}</div>
            )}
            {executeResult.output && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontWeight: 'bold', marginBottom: 4 }}>{t('pages.infra.scripts.outputLabel')}</div>
                <pre style={{ background: '#fff', padding: 8, borderRadius: 4, maxHeight: 200, overflow: 'auto' }}>
                  {executeResult.output}
                </pre>
              </div>
            )}
            {executeResult.error && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontWeight: 'bold', marginBottom: 4 }}>{t('pages.infra.scripts.errorLabel')}</div>
                <pre style={{ background: '#fff', padding: 8, borderRadius: 4, maxHeight: 200, overflow: 'auto', color: '#ff4d4f' }}>
                  {executeResult.error}
                </pre>
              </div>
            )}
            {executeResult.execution_time && (
              <div style={{ marginTop: 8, color: '#666' }}>
                {t('pages.infra.scripts.executionTime', { seconds: executeResult.execution_time.toFixed(2) })}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* 详情 Drawer */}
      <DetailDrawerTemplate
        title={t('pages.infra.scripts.detailTitle')}
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        loading={detailLoading}
        width={DRAWER_CONFIG.LARGE_WIDTH}
        dataSource={detailData}
        columns={[
          {
            title: t('pages.infra.scripts.columnName'),
            dataIndex: 'name',
          },
          {
            title: t('pages.infra.scripts.columnCode'),
            dataIndex: 'code',
          },
          {
            title: t('pages.infra.scripts.columnType'),
            dataIndex: 'type',
          },
          {
            title: t('pages.infra.scripts.labelDescription'),
            dataIndex: 'description',
          },
          {
            title: t('pages.infra.scripts.columnActive'),
            dataIndex: 'is_active',
            render: (_: React.ReactNode, record: Script) => {
              const value = record.is_active;
              return (
              <Tag color={value ? 'success' : 'default'}>
                {value ? t('pages.infra.scripts.activeEnabled') : t('pages.infra.scripts.activeDisabled')}
              </Tag>
            ); },
          },
          {
            title: t('pages.infra.scripts.columnRunning'),
            dataIndex: 'is_running',
            render: (_: React.ReactNode, record: Script) => {
              const value = record.is_running;
              return (
              <Tag color={value ? 'processing' : 'default'}>
                {value ? t('pages.infra.scripts.runningRunning') : t('pages.infra.scripts.runningIdle')}
              </Tag>
            ); },
          },
          {
            title: t('pages.infra.scripts.columnContent'),
            dataIndex: 'content',
            render: (_: React.ReactNode, record: Script) => (
              <pre style={{ maxHeight: '300px', overflow: 'auto', background: '#f5f5f5', padding: 12, borderRadius: 4 }}>
                {record.content}
              </pre>
            ),
          },
          {
            title: t('pages.infra.scripts.columnConfig'),
            dataIndex: 'config',
            render: (_: React.ReactNode, record: Script) => {
              const value = record.config as Record<string, any> | undefined;
              return (
              value ? (
                <pre style={{ maxHeight: '200px', overflow: 'auto', background: '#f5f5f5', padding: 12, borderRadius: 4 }}>
                  {JSON.stringify(value, null, 2)}
                </pre>
              ) : '-'
            ); },
          },
          {
            title: t('pages.infra.scripts.columnLastRunStatus'),
            dataIndex: 'last_run_status',
            render: (_: React.ReactNode, record: Script) => {
              const value = record.last_run_status;
              if (!value) return '-';
              const statusMap: Record<string, { color: string; text: string }> = {
                success: { color: 'success', text: t('pages.infra.scripts.statusSuccess') },
                failed: { color: 'error', text: t('pages.infra.scripts.statusFailed') },
                running: { color: 'processing', text: t('pages.infra.scripts.statusRunning') },
              };
              const statusInfo = statusMap[value] || { color: 'default', text: value };
              return <Tag color={statusInfo.color}>{statusInfo.text}</Tag>;
            },
          },
          {
            title: t('pages.infra.scripts.columnLastRunAt'),
            dataIndex: 'last_run_at',
            valueType: 'dateTime',
          },
          {
            title: t('pages.infra.scripts.columnLastError'),
            dataIndex: 'last_error',
            render: (_: React.ReactNode, record: Script) => {
              const value = record.last_error;
              return (
              value ? (
                <pre style={{ maxHeight: '100px', overflow: 'auto', background: '#fff2f0', padding: 8, borderRadius: 4, color: '#ff4d4f' }}>
                  {value}
                </pre>
              ) : '-'
            ); },
          },
          {
            title: t('pages.infra.scripts.columnCreatedAt'),
            dataIndex: 'created_at',
            valueType: 'dateTime',
          },
          {
            title: t('pages.infra.scripts.columnUpdatedAt'),
            dataIndex: 'updated_at',
            valueType: 'dateTime',
          },
        ]}
      />
    </>
  );
};

export default ScriptListPage;

