/**
 * 定时任务管理列表页面
 * 
 * 用于系统管理员查看和管理组织内的定时任务。
 * 支持定时任务的 CRUD 操作和启动/停止功能。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProDescriptions, ProForm, ProFormText, ProFormTextArea, ProFormSwitch, ProFormSelect, ProFormInstance } from '@ant-design/pro-components';
import SafeProFormSelect from '@/components/SafeProFormSelect';
import { App, Popconfirm, Button, Tag, Space, Drawer, Modal, message, Input, Badge } from 'antd';
import { EditOutlined, DeleteOutlined, EyeOutlined, PlusOutlined, PlayCircleOutlined, PauseCircleOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../components/uni_table';
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

const { TextArea } = Input;

/**
 * 定时任务管理列表页面组件
 */
const ScheduledTaskListPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Modal 相关状态（创建/编辑定时任务）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentScheduledTaskUuid, setCurrentScheduledTaskUuid] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
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
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      type: 'api_call',
      trigger_type: 'cron',
      is_active: true,
    });
  };

  /**
   * 处理编辑定时任务
   */
  const handleEdit = async (record: ScheduledTask) => {
    try {
      setIsEdit(true);
      setCurrentScheduledTaskUuid(record.uuid);
      setTriggerType(record.trigger_type);
      setModalVisible(true);
      
      // 获取定时任务详情
      const detail = await getScheduledTaskByUuid(record.uuid);
      setTriggerConfigJson(JSON.stringify(detail.trigger_config, null, 2));
      setTaskConfigJson(JSON.stringify(detail.task_config, null, 2));
      formRef.current?.setFieldsValue({
        name: detail.name,
        code: detail.code,
        description: detail.description,
        type: detail.type,
        trigger_type: detail.trigger_type,
        is_active: detail.is_active,
      });
    } catch (error: any) {
      messageApi.error(error.message || '获取定时任务详情失败');
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
      messageApi.error(error.message || '获取定时任务详情失败');
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
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理启动定时任务
   */
  const handleStart = async (record: ScheduledTask) => {
    try {
      await startScheduledTask(record.uuid);
      messageApi.success('启动成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '启动失败');
    }
  };

  /**
   * 处理停止定时任务
   */
  const handleStop = async (record: ScheduledTask) => {
    try {
      await stopScheduledTask(record.uuid);
      messageApi.success('停止成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '停止失败');
    }
  };

  /**
   * 处理提交表单（创建/更新定时任务）
   */
  const handleSubmit = async () => {
    try {
      setFormLoading(true);
      const values = await formRef.current?.validateFields();
      
      // 解析触发器配置 JSON
      let triggerConfig: Record<string, any> = {};
      try {
        triggerConfig = JSON.parse(triggerConfigJson);
      } catch (e) {
        messageApi.error('触发器配置 JSON 格式不正确');
        return;
      }
      
      // 解析任务配置 JSON
      let taskConfig: Record<string, any> = {};
      try {
        taskConfig = JSON.parse(taskConfigJson);
      } catch (e) {
        messageApi.error('任务配置 JSON 格式不正确');
        return;
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
        messageApi.success('更新成功');
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
  const columns: ProColumns<ScheduledTask>[] = [
    {
      title: '任务名称',
      dataIndex: 'name',
      width: 200,
      fixed: 'left',
    },
    {
      title: '任务代码',
      dataIndex: 'code',
      width: 150,
    },
    {
      title: '任务类型',
      dataIndex: 'type',
      width: 120,
      valueType: 'select',
      valueEnum: {
        python_script: { text: 'Python脚本', status: 'Processing' },
        api_call: { text: 'API调用', status: 'Success' },
      },
      render: (_, record) => {
        const typeMap: Record<string, { color: string; text: string }> = {
          python_script: { color: 'blue', text: 'Python脚本' },
          api_call: { color: 'green', text: 'API调用' },
        };
        const typeInfo = typeMap[record.type] || { color: 'default', text: record.type };
        return <Tag color={typeInfo.color}>{typeInfo.text}</Tag>;
      },
    },
    {
      title: '触发器类型',
      dataIndex: 'trigger_type',
      width: 120,
      valueType: 'select',
      valueEnum: {
        cron: { text: 'Cron', status: 'Success' },
        interval: { text: 'Interval', status: 'Processing' },
        date: { text: 'Date', status: 'Warning' },
      },
      render: (_, record) => {
        const triggerMap: Record<string, { color: string; text: string }> = {
          cron: { color: 'blue', text: 'Cron' },
          interval: { color: 'orange', text: 'Interval' },
          date: { color: 'green', text: 'Date' },
        };
        const triggerInfo = triggerMap[record.trigger_type] || { color: 'default', text: record.trigger_type };
        return <Tag color={triggerInfo.color}>{triggerInfo.text}</Tag>;
      },
    },
    {
      title: '描述',
      dataIndex: 'description',
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: '运行状态',
      dataIndex: 'is_running',
      width: 100,
      render: (_, record) => (
        <Space>
          {record.is_running ? (
            <Badge status="processing" text="运行中" />
          ) : (
            <Badge status="default" text="未运行" />
          )}
        </Space>
      ),
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
      title: '最后运行时间',
      dataIndex: 'last_run_at',
      width: 180,
      valueType: 'dateTime',
      hideInSearch: true,
      sorter: true,
    },
    {
      title: '最后运行状态',
      dataIndex: 'last_run_status',
      width: 120,
      hideInSearch: true,
      render: (_, record) => {
        if (!record.last_run_status) {
          return '-';
        }
        const statusMap: Record<string, { color: string; text: string }> = {
          success: { color: 'success', text: '成功' },
          failed: { color: 'error', text: '失败' },
        };
        const statusInfo = statusMap[record.last_run_status] || { color: 'default', text: record.last_run_status };
        return <Tag color={statusInfo.color}>{statusInfo.text}</Tag>;
      },
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
          {record.is_active ? (
            <Button
              type="link"
              size="small"
              icon={<PauseCircleOutlined />}
              onClick={() => handleStop(record)}
            >
              停止
            </Button>
          ) : (
            <Button
              type="link"
              size="small"
              icon={<PlayCircleOutlined />}
              onClick={() => handleStart(record)}
            >
              启动
            </Button>
          )}
          <Popconfirm
            title="确定要删除这个定时任务吗？"
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
            messageApi.error(error?.message || '获取定时任务列表失败');
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
            新建定时任务
          </Button>,
        ]}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
      />

      {/* 创建/编辑定时任务 Modal */}
      <Modal
        title={isEdit ? '编辑定时任务' : '新建定时任务'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        confirmLoading={formLoading}
        size={900}
      >
        <ProForm
          formRef={formRef}
          submitter={false}
          layout="vertical"
        >
          <ProFormText
            name="name"
            label="任务名称"
            rules={[{ required: true, message: '请输入任务名称' }]}
            placeholder="请输入任务名称"
          />
          <ProFormText
            name="code"
            label="任务代码"
            rules={[
              { required: true, message: '请输入任务代码' },
              { pattern: /^[a-z0-9_]+$/, message: '任务代码只能包含小写字母、数字和下划线' },
            ]}
            placeholder="请输入任务代码（唯一标识，如：daily_report）"
            disabled={isEdit}
          />
          <SafeProFormSelect
            name="type"
            label="任务类型"
            rules={[{ required: true, message: '请选择任务类型' }]}
            options={[
              { label: 'Python脚本', value: 'python_script' },
              { label: 'API调用', value: 'api_call' },
            ]}
            disabled={isEdit}
          />
          <SafeProFormSelect
            name="trigger_type"
            label="触发器类型"
            rules={[{ required: true, message: '请选择触发器类型' }]}
            options={[
              { label: 'Cron', value: 'cron' },
              { label: 'Interval', value: 'interval' },
              { label: 'Date', value: 'date' },
            ]}
            fieldProps={{
              onChange: (value) => {
                setTriggerType(value);
                // 根据类型设置默认配置
                const defaultConfigs: Record<string, Record<string, any>> = {
                  cron: {
                    cron: '0 0 * * *',
                  },
                  interval: {
                    seconds: 300,
                  },
                  date: {
                    at: new Date().toISOString(),
                  },
                };
                setTriggerConfigJson(JSON.stringify(defaultConfigs[value] || {}, null, 2));
              },
            }}
            disabled={isEdit}
          />
          <ProFormTextArea
            name="description"
            label="任务描述"
            placeholder="请输入任务描述"
          />
          <div>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
              触发器配置（JSON）
            </label>
            <TextArea
              value={triggerConfigJson}
              onChange={(e) => setTriggerConfigJson(e.target.value)}
              rows={4}
              placeholder={triggerType === 'cron' 
                ? '请输入 Cron 表达式，例如：{"cron": "0 0 * * *"}'
                : triggerType === 'interval'
                ? '请输入间隔时间（秒），例如：{"seconds": 300}'
                : '请输入执行时间，例如：{"at": "2025-01-01T00:00:00Z"}'
              }
              style={{ fontFamily: 'monospace' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
              任务配置（JSON）
            </label>
            <TextArea
              value={taskConfigJson}
              onChange={(e) => setTaskConfigJson(e.target.value)}
              rows={6}
              placeholder='请输入任务配置（JSON 格式），例如：{"url": "https://api.example.com/endpoint", "method": "POST", "headers": {}, "data": {}}'
              style={{ fontFamily: 'monospace' }}
            />
          </div>
          <ProFormSwitch
            name="is_active"
            label="是否启用"
          />
        </ProForm>
      </Modal>

      {/* 查看详情 Drawer */}
      <Drawer
        title="定时任务详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        size={700}
        loading={detailLoading}
      >
        {detailData && (
          <ProDescriptions<ScheduledTask>
            column={1}
            dataSource={detailData}
            columns={[
              {
                title: '任务名称',
                dataIndex: 'name',
              },
              {
                title: '任务代码',
                dataIndex: 'code',
              },
              {
                title: '任务类型',
                dataIndex: 'type',
                render: (value) => {
                  const typeMap: Record<string, string> = {
                    python_script: 'Python脚本',
                    api_call: 'API调用',
                  };
                  return typeMap[value] || value;
                },
              },
              {
                title: '触发器类型',
                dataIndex: 'trigger_type',
                render: (value) => {
                  const triggerMap: Record<string, string> = {
                    cron: 'Cron',
                    interval: 'Interval',
                    date: 'Date',
                  };
                  return triggerMap[value] || value;
                },
              },
              {
                title: '任务描述',
                dataIndex: 'description',
              },
              {
                title: '触发器配置',
                dataIndex: 'trigger_config',
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
                    {JSON.stringify(value, null, 2)}
                  </pre>
                ),
              },
              {
                title: '任务配置',
                dataIndex: 'task_config',
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
                    {JSON.stringify(value, null, 2)}
                  </pre>
                ),
              },
              {
                title: 'Inngest 函数ID',
                dataIndex: 'inngest_function_id',
                render: (value) => value || '-',
              },
              {
                title: '运行状态',
                dataIndex: 'is_running',
                render: (value) => (
                  <Badge status={value ? 'processing' : 'default'} text={value ? '运行中' : '未运行'} />
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
                title: '最后运行时间',
                dataIndex: 'last_run_at',
                valueType: 'dateTime',
              },
              {
                title: '最后运行状态',
                dataIndex: 'last_run_status',
                render: (value) => {
                  if (!value) return '-';
                  const statusMap: Record<string, { color: string; text: string }> = {
                    success: { color: 'success', text: '成功' },
                    failed: { color: 'error', text: '失败' },
                  };
                  const statusInfo = statusMap[value] || { color: 'default', text: value };
                  return <Tag color={statusInfo.color}>{statusInfo.text}</Tag>;
                },
              },
              {
                title: '最后错误',
                dataIndex: 'last_error',
                render: (value) => value ? (
                  <Tag color="error">{value}</Tag>
                ) : '-',
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

export default ScheduledTaskListPage;

