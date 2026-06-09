/**
 * 平台级定时任务管理列表页面
 * 
 * 用于平台管理员查看和管理全局定时任务。
 * 此功能已从租户级移至平台级，以降低注入攻击风险。
 */

import React, { useRef, useState } from 'react';
import { rowActionKind } from '../../../../components/uni-action';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns, ProForm, ProFormText, ProFormTextArea, ProFormSwitch, ProFormSelect, ProFormInstance } from '@ant-design/pro-components';
import SafeProFormSelect from '../../../../components/safe-pro-form-select';
import { App, Popconfirm, Button, Tag, Space, Drawer, Modal, message, Input, Badge, Row, Col, Select } from 'antd';
import { EditOutlined, DeleteOutlined, EyeOutlined, PlusOutlined, PlayCircleOutlined, PauseCircleOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, MODAL_CONFIG, DRAWER_CONFIG } from '../../../../components/layout-templates';
import {
  getScheduledTaskList,
  getScheduledTaskByUuid,
  createScheduledTask,
  updateScheduledTask,
  deleteScheduledTask,
  startScheduledTask,
  stopScheduledTask,
  ScheduledTask,
  CreateScheduledTaskData,
  UpdateScheduledTaskData,
} from '../../../../services/scheduledTask';
import { CODE_FONT_FAMILY } from '../../../../constants/fonts';

const { TextArea } = Input;

/**
 * 定时任务管理列表页面组件
 */
const ScheduledTaskListPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Modal 相关状态（创建/编辑定时任务）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentScheduledTaskUuid, setCurrentScheduledTaskUuid] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formInitialValues, setFormInitialValues] = useState<Record<string, any> | undefined>(undefined);
  const [triggerType, setTriggerType] = useState<'cron' | 'interval' | 'date'>('cron');
  const [triggerCron, setTriggerCron] = useState<string>('0 0 * * *');
  const [triggerIntervalSeconds, setTriggerIntervalSeconds] = useState<number>(300);
  const [triggerDateAt, setTriggerDateAt] = useState<string>('');
  const [taskType, setTaskType] = useState<string>('api_call');
  const [taskUrl, setTaskUrl] = useState<string>('');
  const [taskMethod, setTaskMethod] = useState<string>('POST');
  const [taskScriptUuid, setTaskScriptUuid] = useState<string>('');
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [detailData, setDetailData] = useState<ScheduledTask | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  /**
   * 处理新建定时任务
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentScheduledTaskUuid(null);
    setTriggerType('cron');
    setTriggerCron('0 0 * * *');
    setTriggerIntervalSeconds(300);
    setTriggerDateAt('');
    setTaskType('api_call');
    setTaskUrl('');
    setTaskMethod('POST');
    setTaskScriptUuid('');
    setFormInitialValues({
      type: 'api_call',
      trigger_type: 'cron',
      is_active: true,
    });
    setModalVisible(true);
  };

  /**
   * 处理编辑定时任务
   */
  const handleEdit = async (record: ScheduledTask) => {
    try {
      setIsEdit(true);
      setCurrentScheduledTaskUuid(record.uuid);
      const detail = await getScheduledTaskByUuid(record.uuid);
      setTriggerType(detail.trigger_type);
      const tc = detail.trigger_config || {};
      setTriggerCron(tc.cron ?? '0 0 * * *');
      setTriggerIntervalSeconds(typeof tc.seconds === 'number' ? tc.seconds : 300);
      setTriggerDateAt(tc.at ?? '');
      setTaskType(detail.type);
      const taskCfg = detail.task_config || {};
      setTaskUrl(taskCfg.url ?? '');
      setTaskMethod(taskCfg.method ?? 'POST');
      setTaskScriptUuid(taskCfg.script_uuid ?? taskCfg.script_code ?? '');
      setFormInitialValues({
        name: detail.name,
        code: detail.code,
        description: detail.description,
        type: detail.type,
        trigger_type: detail.trigger_type,
        is_active: detail.is_active,
      });
      setModalVisible(true);
    } catch (error: any) {
      messageApi.error(error.message || t('field.scheduledTask.fetchDetailFailed'));
    }
  };

  /**
   * 处理查看详情
   */
  const handleView = async (record: ScheduledTask) => {
    try {
      setDetailLoading(true);
      setDrawerVisible(true);
      const detail = await getScheduledTaskByUuid(record.uuid);
      setDetailData(detail);
    } catch (error: any) {
      messageApi.error(error.message || t('field.scheduledTask.fetchDetailFailed'));
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理删除定时任务
   */
  const handleDelete = async (record: ScheduledTask) => {
    try {
      await deleteScheduledTask(record.uuid);
      messageApi.success(t('pages.system.deleteSuccess'));
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.deleteFailed'));
    }
  };

  /**
   * 处理批量删除定时任务
   */
  const handleBatchDelete = async (keys: React.Key[]) => {
    try {
      let successCount = 0;
      let failCount = 0;
      const errors: string[] = [];

      for (const key of keys) {
        try {
          await deleteScheduledTask(key.toString());
          successCount++;
        } catch (error: any) {
          failCount++;
          errors.push(error.message || t('pages.system.deleteFailed'));
        }
      }

      if (successCount > 0) {
        messageApi.success(t('pages.system.deleteSuccess'));
      }
      if (failCount > 0) {
        messageApi.error(t('pages.system.deleteFailed') + (errors.length > 0 ? '：' + errors.join('; ') : ''));
      }

      setSelectedRowKeys([]);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.deleteFailed'));
    }
  };

  /**
   * 处理启动定时任务
   */
  const handleStart = async (record: ScheduledTask) => {
    try {
      await startScheduledTask(record.uuid);
      messageApi.success(t('field.scheduledTask.startSuccess'));
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('field.scheduledTask.startFailed'));
    }
  };

  /**
   * 处理停止定时任务
   */
  const handleStop = async (record: ScheduledTask) => {
    try {
      await stopScheduledTask(record.uuid);
      messageApi.success(t('field.scheduledTask.stopSuccess'));
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('field.scheduledTask.stopFailed'));
    }
  };

  /**
   * 处理提交表单（创建/更新定时任务）- 从表单构建设置
   */
  const handleSubmit = async (values: any): Promise<void> => {
    try {
      setFormLoading(true);

      const triggerTypeVal = values.trigger_type || triggerType;
      let triggerConfig: Record<string, any> = {};
      if (triggerTypeVal === 'cron') {
        triggerConfig = { cron: triggerCron || '0 0 * * *' };
      } else if (triggerTypeVal === 'interval') {
        triggerConfig = { seconds: Number(triggerIntervalSeconds) || 300 };
      } else if (triggerTypeVal === 'date') {
        triggerConfig = { at: triggerDateAt || new Date().toISOString() };
      }

      const typeVal = values.type || taskType;
      let taskConfig: Record<string, any> = {};
      if (typeVal === 'api_call') {
        taskConfig = { url: taskUrl, method: taskMethod || 'POST' };
      } else if (typeVal === 'python_script') {
        taskConfig = { script_code: taskScriptUuid || undefined, script_path: taskScriptUuid || undefined };
      }

      if (isEdit && currentScheduledTaskUuid) {
        await updateScheduledTask(currentScheduledTaskUuid, {
          name: values.name,
          description: values.description,
          trigger_type: values.trigger_type,
          trigger_config: triggerConfig,
          task_config: taskConfig,
          is_active: values.is_active,
        } as UpdateScheduledTaskData);
        messageApi.success(t('pages.system.updateSuccess'));
      } else {
        await createScheduledTask({
          name: values.name,
          code: values.code,
          type: values.type,
          description: values.description,
          trigger_type: values.trigger_type,
          trigger_config: triggerConfig,
          task_config: taskConfig,
          is_active: values.is_active,
        } as CreateScheduledTaskData);
        messageApi.success(t('pages.system.createSuccess'));
      }
      
      setModalVisible(false);
      setFormInitialValues(undefined);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.deleteFailed'));
      throw error;
    } finally {
      setFormLoading(false);
    }
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<ScheduledTask>[] = [
    {
      title: t('field.scheduledTask.name'),
      dataIndex: 'name',
      width: 200,
      fixed: 'left',
    },
    {
      title: t('field.scheduledTask.code'),
      dataIndex: 'code',
      width: 150,
    },
    {
      title: t('field.scheduledTask.type'),
      dataIndex: 'type',
      width: 120,
      valueType: 'select',
      valueEnum: {
        python_script: { text: t('field.scheduledTask.typePython'), status: 'Processing' },
        api_call: { text: t('field.scheduledTask.typeApi'), status: 'Success' },
      },
      render: (_, record) => {
        const typeMap: Record<string, { color: string; textKey: string }> = {
          python_script: { color: 'blue', textKey: 'field.scheduledTask.typePython' },
          api_call: { color: 'green', textKey: 'field.scheduledTask.typeApi' },
        };
        const typeInfo = typeMap[record.type] || { color: 'default', textKey: record.type };
        return <Tag color={typeInfo.color}>{t(typeInfo.textKey)}</Tag>;
      },
    },
    {
      title: t('field.scheduledTask.triggerType'),
      dataIndex: 'trigger_type',
      width: 120,
      valueType: 'select',
      valueEnum: {
        cron: { text: t('field.scheduledTask.triggerCron'), status: 'Success' },
        interval: { text: t('field.scheduledTask.triggerInterval'), status: 'Processing' },
        date: { text: t('field.scheduledTask.triggerDate'), status: 'Warning' },
      },
      render: (_, record) => {
        const triggerMap: Record<string, { color: string; textKey: string }> = {
          cron: { color: 'blue', textKey: 'field.scheduledTask.triggerCron' },
          interval: { color: 'orange', textKey: 'field.scheduledTask.triggerInterval' },
          date: { color: 'green', textKey: 'field.scheduledTask.triggerDate' },
        };
        const triggerInfo = triggerMap[record.trigger_type] || { color: 'default', textKey: record.trigger_type };
        return <Tag color={triggerInfo.color}>{t(triggerInfo.textKey)}</Tag>;
      },
    },
    {
      title: t('field.scheduledTask.description'),
      dataIndex: 'description',
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: t('field.scheduledTask.runStatus'),
      dataIndex: 'is_running',
      width: 100,
      render: (_, record) => (
        <Space>
          {record.is_running ? (
            <Badge status="processing" text={t('field.scheduledTask.running')} />
          ) : (
            <Badge status="default" text={t('field.scheduledTask.notRunning')} />
          )}
        </Space>
      ),
    },
    {
      title: t('field.scheduledTask.activeStatus'),
      dataIndex: 'is_active',
      width: 100,
      valueType: 'select',
      valueEnum: {
        true: { text: t('field.systemParameter.enabled'), status: 'Success' },
        false: { text: t('field.systemParameter.disabled'), status: 'Default' },
      },
      render: (_, record) => (
        <Tag color={record.is_active ? 'success' : 'default'}>
          {record.is_active ? t('field.systemParameter.enabled') : t('field.systemParameter.disabled')}
        </Tag>
      ),
    },
    {
      title: t('field.scheduledTask.lastRunAt'),
      dataIndex: 'last_run_at',
      width: 180,
      valueType: 'dateTime',
      hideInSearch: true,
      sorter: true,
    },
    {
      title: t('field.scheduledTask.lastRunStatus'),
      dataIndex: 'last_run_status',
      width: 120,
      hideInSearch: true,
      render: (_, record) => {
        if (!record.last_run_status) {
          return '-';
        }
        const statusMap: Record<string, { color: string; textKey: string }> = {
          success: { color: 'success', textKey: 'field.scheduledTask.success' },
          failed: { color: 'error', textKey: 'field.scheduledTask.failed' },
        };
        const statusInfo = statusMap[record.last_run_status] || { color: 'default', textKey: record.last_run_status };
        return <Tag color={statusInfo.color}>{t(statusInfo.textKey)}</Tag>;
      },
    },
    {
      title: t('field.scheduledTask.createdAt'),
      dataIndex: 'created_at',
      width: 180,
      valueType: 'dateTime',
      hideInSearch: true,
      sorter: true,
    },
    {
      title: t('common.actions'),
      valueType: 'option',
      width: 300,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button key="view" {...rowActionKind('read')}
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleView(record)}
          >
            {t('field.scheduledTask.view')}
          </Button>
          <Button key="edit" {...rowActionKind('update')}
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            {t('field.scheduledTask.edit')}
          </Button>
          {record.is_active ? (
            <Button key="stop" {...rowActionKind('execute')}
              size="small"
              icon={<PauseCircleOutlined />}
              onClick={() => handleStop(record)}
            >
              {t('field.scheduledTask.stop')}
            </Button>
          ) : (
            <Button key="execute" {...rowActionKind('execute')}
              size="small"
              icon={<PlayCircleOutlined />}
              onClick={() => handleStart(record)}
            >
              {t('field.scheduledTask.start')}
            </Button>
          )}
          <Popconfirm key="delete" {...rowActionKind('delete')} title={t('field.scheduledTask.deleteConfirm')}
            onConfirm={() => handleDelete(record)}
          >
            <Button
              type="link"
              danger
              size="small"
              icon={<DeleteOutlined />}
            >
              {t('field.scheduledTask.delete')}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <ListPageTemplate>
        <UniTable<ScheduledTask>
          columnPersistenceId="pages.infra.scheduled-tasks.list"
          actionRef={actionRef}
          columns={columns}
          request={async (params, sort, _filter, searchFormValues) => {
            // 处理搜索参数
            const apiParams: any = {
              skip: ((params.current || 1) - 1) * (params.pageSize || 20),
              limit: params.pageSize || 20,
            };
            
            // 任务类型筛选
            if (searchFormValues?.type) {
              apiParams.type = searchFormValues.type;
            }
            
            // 触发器类型筛选
            if (searchFormValues?.trigger_type) {
              apiParams.trigger_type = searchFormValues.trigger_type;
            }
            
            // 启用状态筛选
            if (searchFormValues?.is_active !== undefined && searchFormValues.is_active !== '' && searchFormValues.is_active !== null) {
              apiParams.is_active = searchFormValues.is_active;
            }
            
            try {
              const result = await getScheduledTaskList(apiParams);
              return {
                data: result,
                success: true,
                total: result.length,  // 简化实现，实际应该从后端返回总数
              };
            } catch (error: any) {
              console.error('获取定时任务列表失败:', error);
              messageApi.error(error?.message || t('field.scheduledTask.listFetchFailed'));
              return {
                data: [],
                success: false,
                total: 0,
              };
            }
          }}
          rowKey="uuid"
          showAdvancedSearch={true}
          showCreateButton
          createButtonText={t('field.scheduledTask.createButton')}
          onCreate={handleCreate}
          enableRowSelection
          onRowSelectionChange={setSelectedRowKeys}
          showDeleteButton
          onDelete={handleBatchDelete}
          deleteButtonText={t('field.scheduledTask.batchDeleteButton')}
          deleteConfirmTitle={t('field.scheduledTask.batchDeleteConfirmTitle')}
          deleteConfirmDescription={(c) => t('field.scheduledTask.batchDeleteConfirmDescription', { count: c })}
          showImportButton={false}
          showExportButton={true}
          onExport={async (type, keys, pageData) => {
            try {
              const allData = await getScheduledTaskList({ skip: 0, limit: 10000 });
              let items = Array.isArray(allData) ? allData : [];
              if (type === 'currentPage' && pageData?.length) {
                items = pageData;
              } else if (type === 'selected' && keys?.length) {
                items = items.filter((d: any) => keys.includes(d.uuid));
              }
              if (items.length === 0) {
                messageApi.warning(t('field.scheduledTask.exportNoData'));
                return;
              }
              const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `scheduled-tasks-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              URL.revokeObjectURL(url);
              messageApi.success(t('field.scheduledTask.exportSuccess', { count: items.length }));
            } catch (error: any) {
              messageApi.error(error?.message || t('pages.system.deleteFailed'));
            }
          }}
          pagination={{
            defaultPageSize: 20,
            showSizeChanger: true,
          }}
        />
      </ListPageTemplate>

      {/* 创建/编辑定时任务 Modal - 两栏布局，备注倒数第二，触发器/任务配置为表单 */}
      <FormModalTemplate
        title={isEdit ? t('field.scheduledTask.editTitle') : t('field.scheduledTask.createTitle')}
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
          <Col span={12}>
            <ProFormText
              name="code"
              label={t('field.scheduledTask.code')}
              rules={[
                { required: true, message: t('field.scheduledTask.codeRequired') },
                { pattern: /^[a-z0-9_]+$/, message: t('field.scheduledTask.codePattern') },
              ]}
              placeholder={t('field.scheduledTask.codePlaceholder')}
              disabled={isEdit}
            />
          </Col>
          <Col span={12}>
            <ProFormText
              name="name"
              label={t('field.scheduledTask.name')}
              rules={[{ required: true, message: t('field.scheduledTask.nameRequired') }]}
              placeholder={t('field.scheduledTask.namePlaceholder')}
            />
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <SafeProFormSelect
              name="type"
              label={t('field.scheduledTask.type')}
              rules={[{ required: true, message: t('field.scheduledTask.typeRequired') }]}
              options={[
                { label: t('field.scheduledTask.typePython'), value: 'python_script' },
                { label: t('field.scheduledTask.typeApi'), value: 'api_call' },
              ]}
              fieldProps={{ onChange: (v: string) => setTaskType(v || 'api_call') }}
              disabled={isEdit}
            />
          </Col>
          <Col span={12}>
            <SafeProFormSelect
              name="trigger_type"
              label={t('field.scheduledTask.triggerType')}
              rules={[{ required: true, message: t('field.scheduledTask.triggerTypeRequired') }]}
              options={[
                { label: t('field.scheduledTask.triggerCron'), value: 'cron' },
                { label: t('field.scheduledTask.triggerInterval'), value: 'interval' },
                { label: t('field.scheduledTask.triggerDate'), value: 'date' },
              ]}
              fieldProps={{
                onChange: (value: string) => {
                  setTriggerType(value as 'cron' | 'interval' | 'date');
                  if (value === 'cron') setTriggerCron('0 0 * * *');
                  if (value === 'interval') setTriggerIntervalSeconds(300);
                  if (value === 'date') setTriggerDateAt(new Date().toISOString().slice(0, 16));
                },
              }}
              disabled={isEdit}
            />
          </Col>
        </Row>
        {/* 触发器配置 - 表单模式 */}
        {triggerType === 'cron' && (
          <ProForm.Item label={t('field.scheduledTask.triggerCronLabel')} name="_triggerCron">
            <Input
              value={triggerCron}
              onChange={(e) => setTriggerCron(e.target.value)}
              placeholder={t('field.scheduledTask.triggerConfigPlaceholderCron')}
            />
          </ProForm.Item>
        )}
        {triggerType === 'interval' && (
          <ProForm.Item label={t('field.scheduledTask.triggerIntervalLabel')} name="_triggerInterval">
            <Input
              type="number"
              value={triggerIntervalSeconds}
              onChange={(e) => setTriggerIntervalSeconds(Number(e.target.value) || 300)}
              placeholder={t('field.scheduledTask.triggerConfigPlaceholderInterval')}
            />
          </ProForm.Item>
        )}
        {triggerType === 'date' && (
          <ProForm.Item label={t('field.scheduledTask.triggerDateLabel')} name="_triggerDate">
            <Input
              type="datetime-local"
              value={triggerDateAt}
              onChange={(e) => setTriggerDateAt(e.target.value)}
            />
          </ProForm.Item>
        )}
        {/* 任务配置 - 表单模式 */}
        {taskType === 'api_call' && (
          <Row gutter={16}>
            <Col span={16}>
              <ProForm.Item label={t('field.scheduledTask.taskUrlLabel')} name="_taskUrl">
                <Input
                  value={taskUrl}
                  onChange={(e) => setTaskUrl(e.target.value)}
                  placeholder="https://api.example.com/endpoint"
                />
              </ProForm.Item>
            </Col>
            <Col span={8}>
              <ProForm.Item label={t('field.scheduledTask.taskMethodLabel')} name="_taskMethod">
                <Select
                  value={taskMethod}
                  onChange={setTaskMethod}
                  options={[
                    { value: 'GET', label: 'GET' },
                    { value: 'POST', label: 'POST' },
                    { value: 'PUT', label: 'PUT' },
                    { value: 'DELETE', label: 'DELETE' },
                  ]}
                  style={{ width: '100%' }}
                />
              </ProForm.Item>
            </Col>
          </Row>
        )}
        {taskType === 'python_script' && (
          <ProForm.Item label={t('field.scheduledTask.taskScriptUuidLabel')} name="_taskScriptUuid">
            <Input
              value={taskScriptUuid}
              onChange={(e) => setTaskScriptUuid(e.target.value)}
              placeholder={t('field.scheduledTask.taskConfigPlaceholder')}
            />
          </ProForm.Item>
        )}
        <ProFormTextArea
          name="description"
          label={t('field.scheduledTask.description')}
          placeholder={t('field.scheduledTask.descriptionPlaceholder')}
        />
        <ProFormSwitch
          name="is_active"
          label={t('field.scheduledTask.isActiveLabel')}
        />
      </FormModalTemplate>

      {/* 查看详情 Drawer */}
      <DetailDrawerTemplate
        title={t('field.scheduledTask.detailTitle')}
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        loading={detailLoading}
        width={DRAWER_CONFIG.LARGE_WIDTH}
        dataSource={detailData}
        columns={[
          {
            title: t('field.scheduledTask.name'),
            dataIndex: 'name',
          },
          {
            title: t('field.scheduledTask.code'),
            dataIndex: 'code',
          },
          {
            title: t('field.scheduledTask.type'),
            dataIndex: 'type',
            render: (_, record) => {
              const value = String(record.type ?? '');
              const typeMap: Record<string, string> = {
                python_script: t('field.scheduledTask.typePython'),
                api_call: t('field.scheduledTask.typeApi'),
              };
              return typeMap[value] || value;
            },
          },
          {
            title: t('field.scheduledTask.triggerType'),
            dataIndex: 'trigger_type',
            render: (_, record) => {
              const value = String(record.trigger_type ?? '');
              const triggerMap: Record<string, string> = {
                cron: t('field.scheduledTask.triggerCron'),
                interval: t('field.scheduledTask.triggerInterval'),
                date: t('field.scheduledTask.triggerDate'),
              };
              return triggerMap[value] || value;
            },
          },
          {
            title: t('field.scheduledTask.description'),
            dataIndex: 'description',
          },
          {
            title: t('field.scheduledTask.triggerConfig'),
            dataIndex: 'trigger_config',
            render: (_, record) => {
              const value = record.trigger_config as Record<string, unknown> | undefined;
              return (
              <pre style={{
                margin: 0,
                padding: '8px',
                backgroundColor: '#f5f5f5',
                borderRadius: '4px',
                overflow: 'auto',
                maxHeight: '200px',
                fontSize: 12,
              }}>
                {JSON.stringify(value ?? {}, null, 2)}
              </pre>
            );
            },
          },
          {
            title: t('field.scheduledTask.taskConfig'),
            dataIndex: 'task_config',
            render: (_, record) => {
              const value = record.task_config as Record<string, unknown> | undefined;
              return (
              <pre style={{
                margin: 0,
                padding: '8px',
                backgroundColor: '#f5f5f5',
                borderRadius: '4px',
                overflow: 'auto',
                maxHeight: '200px',
                fontSize: 12,
              }}>
                {JSON.stringify(value ?? {}, null, 2)}
              </pre>
            );
            },
          },
          {
            title: t('field.scheduledTask.inngestFunctionId'),
            dataIndex: 'inngest_function_id',
            render: (_, record) => String(record.inngest_function_id ?? '') || '-',
          },
          {
            title: t('field.scheduledTask.runStatus'),
            dataIndex: 'is_running',
            render: (_, record) => {
              const value = !!record.is_running;
              return (
              <Badge status={value ? 'processing' : 'default'} text={value ? t('field.scheduledTask.running') : t('field.scheduledTask.notRunning')} />
            );
            },
          },
          {
            title: t('field.scheduledTask.activeStatus'),
            dataIndex: 'is_active',
            render: (_, record) => {
              const value = !!record.is_active;
              return (
              <Tag color={value ? 'success' : 'default'}>
                {value ? t('field.systemParameter.enabled') : t('field.systemParameter.disabled')}
              </Tag>
            );
            },
          },
          {
            title: t('field.scheduledTask.lastRunAt'),
            dataIndex: 'last_run_at',
            valueType: 'dateTime',
          },
          {
            title: t('field.scheduledTask.lastRunStatus'),
            dataIndex: 'last_run_status',
            render: (_: React.ReactNode, record: ScheduledTask) => {
              const value = record.last_run_status;
              if (!value) return '-';
              const statusMap: Record<string, { color: string; textKey: string }> = {
                success: { color: 'success', textKey: 'field.scheduledTask.success' },
                failed: { color: 'error', textKey: 'field.scheduledTask.failed' },
              };
              const statusInfo = statusMap[value] || { color: 'default', textKey: value };
              return <Tag color={statusInfo.color}>{t(statusInfo.textKey)}</Tag>;
            },
          },
          {
            title: t('field.scheduledTask.lastError'),
            dataIndex: 'last_error',
            render: (_: React.ReactNode, record: ScheduledTask) => {
              const value = record.last_error;
              return value ? (
              <Tag color="error">{value}</Tag>
            ) : '-';
            },
          },
          {
            title: t('field.scheduledTask.createdAt'),
            dataIndex: 'created_at',
            valueType: 'dateTime',
          },
          {
            title: t('field.scheduledTask.updatedAt'),
            dataIndex: 'updated_at',
            valueType: 'dateTime',
          },
        ]}
      />
    </>
  );
};

export default ScheduledTaskListPage;

