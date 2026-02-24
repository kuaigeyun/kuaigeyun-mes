/**
 * 定时任务管理列表页面
 * 
 * 用于系统管理员查看和管理组织内的定时任务。
 * 支持定时任务的 CRUD 操作和启动/停止功能。
 */

import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns, ProFormText, ProFormTextArea, ProFormSwitch, ProFormSelect, ProFormInstance } from '@ant-design/pro-components';
import SafeProFormSelect from '../../../../components/safe-pro-form-select';
import { App, Popconfirm, Button, Tag, Space, Drawer, Modal, message, Input, Badge } from 'antd';
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
  const [triggerConfigJson, setTriggerConfigJson] = useState<string>('{}');
  const [taskConfigJson, setTaskConfigJson] = useState<string>('{}');
  
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
    setTriggerConfigJson('{}');
    setTaskConfigJson('{}');
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
      setTriggerType(record.trigger_type);
      
      // 获取定时任务详情
      const detail = await getScheduledTaskByUuid(record.uuid);
      setTriggerConfigJson(JSON.stringify(detail.trigger_config, null, 2));
      setTaskConfigJson(JSON.stringify(detail.task_config, null, 2));
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
  const handleBatchDelete = () => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning(t('pages.system.selectFirst'));
      return;
    }

    Modal.confirm({
      title: t('field.scheduledTask.batchDeleteTitle'),
      content: t('field.scheduledTask.batchDeleteConfirm', { count: selectedRowKeys.length }),
      okText: t('common.confirm'),
      cancelText: t('common.cancel'),
      okType: 'danger',
      onOk: async () => {
        try {
          let successCount = 0;
          let failCount = 0;
          const errors: string[] = [];

          for (const key of selectedRowKeys) {
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
      },
    });
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
   * 处理提交表单（创建/更新定时任务）
   */
  const handleSubmit = async (values: any): Promise<void> => {
    try {
      setFormLoading(true);
      
      // 解析触发器配置 JSON
      let triggerConfig: Record<string, any> = {};
      try {
        triggerConfig = JSON.parse(triggerConfigJson);
      } catch (e) {
        messageApi.error(t('field.scheduledTask.triggerConfigJsonInvalid'));
        throw new Error(t('field.scheduledTask.triggerConfigJsonInvalid'));
      }
      
      // 解析任务配置 JSON
      let taskConfig: Record<string, any> = {};
      try {
        taskConfig = JSON.parse(taskConfigJson);
      } catch (e) {
        messageApi.error(t('field.scheduledTask.taskConfigJsonInvalid'));
        throw new Error(t('field.scheduledTask.taskConfigJsonInvalid'));
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
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleView(record)}
          >
            {t('field.scheduledTask.view')}
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            {t('field.scheduledTask.edit')}
          </Button>
          {record.is_active ? (
            <Button
              type="link"
              size="small"
              icon={<PauseCircleOutlined />}
              onClick={() => handleStop(record)}
            >
              {t('field.scheduledTask.stop')}
            </Button>
          ) : (
            <Button
              type="link"
              size="small"
              icon={<PlayCircleOutlined />}
              onClick={() => handleStart(record)}
            >
              {t('field.scheduledTask.start')}
            </Button>
          )}
          <Popconfirm
            title={t('field.scheduledTask.deleteConfirm')}
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

      {/* 创建/编辑定时任务 Modal */}
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
        width={MODAL_CONFIG.LARGE_WIDTH}
      >
          <ProFormText
            name="name"
            label={t('field.scheduledTask.name')}
            rules={[{ required: true, message: t('field.scheduledTask.nameRequired') }]}
            placeholder={t('field.scheduledTask.namePlaceholder')}
          />
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
          <SafeProFormSelect
            name="type"
            label={t('field.scheduledTask.type')}
            rules={[{ required: true, message: t('field.scheduledTask.typeRequired') }]}
            options={[
              { label: t('field.scheduledTask.typePython'), value: 'python_script' },
              { label: t('field.scheduledTask.typeApi'), value: 'api_call' },
            ]}
            disabled={isEdit}
          />
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
              onChange: (value) => {
                setTriggerType(value);
                const defaultConfigs: Record<string, Record<string, any>> = {
                  cron: { cron: '0 0 * * *' },
                  interval: { seconds: 300 },
                  date: { at: new Date().toISOString() },
                };
                setTriggerConfigJson(JSON.stringify(defaultConfigs[value] || {}, null, 2));
              },
            }}
            disabled={isEdit}
          />
          <ProFormTextArea
            name="description"
            label={t('field.scheduledTask.description')}
            placeholder={t('field.scheduledTask.descriptionPlaceholder')}
          />
          <div>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
              {t('field.scheduledTask.triggerConfigJson')}
            </label>
            <TextArea
              value={triggerConfigJson}
              onChange={(e) => setTriggerConfigJson(e.target.value)}
              rows={4}
              placeholder={triggerType === 'cron'
                ? t('field.scheduledTask.triggerConfigPlaceholderCron')
                : triggerType === 'interval'
                ? t('field.scheduledTask.triggerConfigPlaceholderInterval')
                : t('field.scheduledTask.triggerConfigPlaceholderDate')
              }
              style={{ fontFamily: CODE_FONT_FAMILY }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
              {t('field.scheduledTask.taskConfigJson')}
            </label>
            <TextArea
              value={taskConfigJson}
              onChange={(e) => setTaskConfigJson(e.target.value)}
              rows={6}
              placeholder={t('field.scheduledTask.taskConfigPlaceholder')}
              style={{ fontFamily: CODE_FONT_FAMILY }}
            />
          </div>
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
            render: (value: string) => {
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
            render: (value: string) => {
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
            render: (value: Record<string, any>) => (
              <pre style={{
                margin: 0,
                padding: '8px',
                backgroundColor: '#f5f5f5',
                borderRadius: '4px',
                overflow: 'auto',
                maxHeight: '200px',
                fontSize: 12,
              }}>
                {JSON.stringify(value, null, 2)}
              </pre>
            ),
          },
          {
            title: t('field.scheduledTask.taskConfig'),
            dataIndex: 'task_config',
            render: (value: Record<string, any>) => (
              <pre style={{
                margin: 0,
                padding: '8px',
                backgroundColor: '#f5f5f5',
                borderRadius: '4px',
                overflow: 'auto',
                maxHeight: '200px',
                fontSize: 12,
              }}>
                {JSON.stringify(value, null, 2)}
              </pre>
            ),
          },
          {
            title: t('field.scheduledTask.inngestFunctionId'),
            dataIndex: 'inngest_function_id',
            render: (value: string) => value || '-',
          },
          {
            title: t('field.scheduledTask.runStatus'),
            dataIndex: 'is_running',
            render: (value: boolean) => (
              <Badge status={value ? 'processing' : 'default'} text={value ? t('field.scheduledTask.running') : t('field.scheduledTask.notRunning')} />
            ),
          },
          {
            title: t('field.scheduledTask.activeStatus'),
            dataIndex: 'is_active',
            render: (value: boolean) => (
              <Tag color={value ? 'success' : 'default'}>
                {value ? t('field.systemParameter.enabled') : t('field.systemParameter.disabled')}
              </Tag>
            ),
          },
          {
            title: t('field.scheduledTask.lastRunAt'),
            dataIndex: 'last_run_at',
            valueType: 'dateTime',
          },
          {
            title: t('field.scheduledTask.lastRunStatus'),
            dataIndex: 'last_run_status',
            render: (value: string) => {
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
            render: (value: string) => value ? (
              <Tag color="error">{value}</Tag>
            ) : '-',
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

