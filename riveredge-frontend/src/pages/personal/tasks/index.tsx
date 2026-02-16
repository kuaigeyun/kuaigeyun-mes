/**
 * 我的任务页面
 * 
 * 用于用户查看和处理自己的任务。
 * 支持任务列表、任务详情、审批/拒绝等功能。
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ActionType, ProColumns, ProFormTextArea } from '@ant-design/pro-components';
import { App, Badge, Tag, Button, Space, message, Typography } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, EyeOutlined } from '@ant-design/icons';
import { UniTable } from '../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, MODAL_CONFIG, DRAWER_CONFIG } from '../../../components/layout-templates';
import { theme } from 'antd';
import {
  getUserTasks,
  getUserTaskStats,
  processUserTask,
  UserTask,
  UserTaskListResponse,
  UserTaskStats,
  TaskActionRequest,
} from '../../../services/userTask';

/**
 * 我的任务页面组件
 */
const UserTasksPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const { token: themeToken } = theme.useToken();
  const actionRef = useRef<ActionType>(null);
  const [stats, setStats] = useState<UserTaskStats | null>(null);
  const [taskType, setTaskType] = useState<'pending' | 'submitted'>('pending');
  const [tableData, setTableData] = useState<UserTask[]>([]);
  const [processModalVisible, setProcessModalVisible] = useState(false);
  const [currentTask, setCurrentTask] = useState<UserTask | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject'>('approve');
  const [comment, setComment] = useState<string>('');
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [detailData, setDetailData] = useState<UserTask | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  /**
   * 加载任务统计
   */
  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const data = await getUserTaskStats();
      setStats(data);
    } catch (error: any) {
      messageApi.error(error.message || '加载任务统计失败');
    }
  };

  /**
   * 处理任务（审批或拒绝）
   */
  const handleProcessTask = async (task: UserTask, action: 'approve' | 'reject') => {
    setCurrentTask(task);
    setActionType(action);
    setComment('');
    setProcessModalVisible(true);
  };

  /**
   * 确认处理任务
   */
  const handleConfirmProcess = async (values: any) => {
    if (!currentTask) return;

    try {
      const data: TaskActionRequest = {
        action: actionType,
        comment: values.comment || undefined,
      };
      
      await processUserTask(currentTask.uuid, data);
      messageApi.success(actionType === 'approve' ? '审批通过' : '审批拒绝');
      setProcessModalVisible(false);
      setCurrentTask(null);
      setComment('');
      // 重新加载数据
      loadStats();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '处理失败');
      throw error;
    }
  };

  /**
   * 处理查看详情
   */
  const handleView = async (record: UserTask) => {
    try {
      setDetailLoading(true);
      setDrawerVisible(true);
      setDetailData(record);
    } catch (error: any) {
      messageApi.error(error.message || '获取任务详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 渲染看板卡片
   */
  const renderKanbanCard = (item: UserTask, status: string) => {
    const isPending = item.status === 'pending' && taskType === 'pending';
    const statusInfo = getStatusTag(item.status);

    return (
      <div
        style={{
          padding: '12px',
          marginBottom: '8px',
          background: '#fff',
          borderRadius: themeToken.borderRadius,
          border: `1px solid ${themeToken.colorBorder}`,
          cursor: 'pointer',
          transition: 'all 0.2s',
        }}
        onClick={() => handleView(item)}
        onMouseEnter={(e) => {
          e.currentTarget.style.boxShadow = `0 2px 8px ${themeToken.colorFillSecondary}`;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.boxShadow = 'none';
        }}
      >
        <div style={{ marginBottom: 8 }}>
          <Space>
            {isPending && <Badge dot />}
            <Typography.Text strong={isPending} style={{ fontSize: 14 }}>
              {item.title}
            </Typography.Text>
          </Space>
        </div>
        {item.content && (
          <Typography.Paragraph
            ellipsis={{ rows: 2, expandable: false }}
            style={{ marginBottom: 8, fontSize: 12, color: themeToken.colorTextSecondary }}
          >
            {item.content}
          </Typography.Paragraph>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
          {statusInfo}
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {item.submitted_at ? new Date(item.submitted_at).toLocaleDateString() : ''}
          </Typography.Text>
        </div>
      </div>
    );
  };

  /**
   * 任务状态标签
   */
  const getStatusTag = (status: string) => {
    const statusMap: Record<string, { color: string; text: string }> = {
      pending: { color: 'processing', text: '待处理' },
      approved: { color: 'success', text: '已通过' },
      rejected: { color: 'error', text: '已拒绝' },
      cancelled: { color: 'default', text: '已取消' },
    };
    const statusInfo = statusMap[status] || { color: 'default', text: status };
    return <Tag color={statusInfo.color}>{statusInfo.text}</Tag>;
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<UserTask>[] = [
    {
      title: '任务标题',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
      render: (text: string, record: UserTask) => {
        const isPending = record.status === 'pending' && taskType === 'pending';
        return (
          <Space>
            {isPending && <Badge dot />}
            <span style={{ fontWeight: isPending ? 'bold' : 'normal' }}>
              {text}
            </span>
          </Space>
        );
      },
    },
    {
      title: '内容',
      dataIndex: 'content',
      key: 'content',
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      valueEnum: {
        pending: { text: '待处理' },
        approved: { text: '已通过' },
        rejected: { text: '已拒绝' },
        cancelled: { text: '已取消' },
      },
      render: (_: any, record: UserTask) => getStatusTag(record.status),
    },
    {
      title: '提交时间',
      dataIndex: 'submitted_at',
      key: 'submitted_at',
      valueType: 'dateTime',
      hideInSearch: true,
      sorter: true,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      valueType: 'dateTime',
      hideInSearch: true,
      sorter: true,
    },
    {
      title: '操作',
      valueType: 'option',
      width: 250,
      fixed: 'right',
      render: (_: any, record: UserTask) => {
        const isPending = record.status === 'pending' && taskType === 'pending';
        return (
          <Space>
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handleView(record)}
            >
              查看
            </Button>
            {isPending && (
              <>
                <Button
                  type="link"
                  size="small"
                  icon={<CheckCircleOutlined />}
                  onClick={() => handleProcessTask(record, 'approve')}
                >
                  审批
                </Button>
                <Button
                  type="link"
                  size="small"
                  danger
                  icon={<CloseCircleOutlined />}
                  onClick={() => handleProcessTask(record, 'reject')}
                >
                  拒绝
                </Button>
              </>
            )}
          </Space>
        );
      },
    },
  ];

  /**
   * 详情列定义
   */
  const detailColumns = [
    { title: '任务标题', dataIndex: 'title' },
    { title: '任务内容', dataIndex: 'content', span: 2 },
    {
      title: '状态',
      dataIndex: 'status',
      render: (value: string) => getStatusTag(value),
    },
    { title: '提交时间', dataIndex: 'submitted_at', valueType: 'dateTime' },
    { title: '创建时间', dataIndex: 'created_at', valueType: 'dateTime' },
    {
      title: '表单数据',
      dataIndex: 'form_data',
      span: 2,
      render: (value: any) => value ? (
        <pre style={{
          margin: 0,
          padding: '12px',
          background: '#f5f5f5',
          borderRadius: '4px',
          maxHeight: '200px',
          overflow: 'auto',
        }}>
          {JSON.stringify(value, null, 2)}
        </pre>
      ) : '-',
    },
    {
      title: '审批历史',
      dataIndex: 'approval_history',
      span: 2,
      render: (value: any[]) => value && Array.isArray(value) && value.length > 0 ? (
        <div style={{
          padding: '12px',
          background: '#f5f5f5',
          borderRadius: '4px',
          maxHeight: '200px',
          overflow: 'auto',
        }}>
          {value.map((history: any, index: number) => (
            <div key={index} style={{ marginBottom: '8px' }}>
              <Tag color={history.action === 'approve' ? 'success' : 'error'}>
                {history.action === 'approve' ? '通过' : '拒绝'}
              </Tag>
              {history.comment && <span>{history.comment}</span>}
              <Typography.Text type="secondary" style={{ marginLeft: '8px' }}>
                {history.timestamp ? new Date(history.timestamp).toLocaleString() : ''}
              </Typography.Text>
            </div>
          ))}
        </div>
      ) : '-',
    },
  ];

  return (
    <>
      <ListPageTemplate
        statCards={
          stats
            ? [
                {
                  title: '总任务数',
                  value: stats.total,
                  valueStyle: { color: '#1890ff' },
                },
                {
                  title: '待处理任务',
                  value: stats.pending,
                  valueStyle: { color: '#ff4d4f' },
                },
                {
                  title: '已通过任务',
                  value: stats.approved,
                  valueStyle: { color: '#52c41a' },
                },
                {
                  title: '我提交的任务',
                  value: stats.submitted,
                  valueStyle: { color: '#faad14' },
                },
              ]
            : undefined
        }
      >
        <UniTable<UserTask>
          headerTitle="我的任务"
          actionRef={actionRef}
          columns={columns}
          request={async (params, sort, _filter, searchFormValues) => {
            try {
              const response = await getUserTasks({
                page: params.current || 1,
                page_size: params.pageSize || 20,
                status: searchFormValues?.status as string | undefined,
                task_type: taskType,
              });
              // 更新表格数据用于看板视图
              setTableData(response.items);
              return {
                data: response.items,
                success: true,
                total: response.total,
              };
            } catch (error: any) {
              messageApi.error(error?.message || '获取任务列表失败');
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
              key="pending"
              type={taskType === 'pending' ? 'primary' : 'default'}
              onClick={() => {
                setTaskType('pending');
                actionRef.current?.reload();
              }}
            >
              待处理
            </Button>,
            <Button
              key="submitted"
              type={taskType === 'submitted' ? 'primary' : 'default'}
              onClick={() => {
                setTaskType('submitted');
                actionRef.current?.reload();
              }}
            >
              我提交的
            </Button>,
          ]}
          viewTypes={['table', 'help']}
          defaultViewType="table"
          kanbanViewConfig={useMemo(() => {
            if (taskType === 'pending') {
              // 待处理任务：只显示待处理状态
              return {
                statusField: 'status',
                statusGroups: {
                  pending: { title: '待处理', color: '#1890ff' },
                },
                renderCard: renderKanbanCard,
              };
            } else {
              // 我提交的任务：显示所有状态
              return {
                statusField: 'status',
                statusGroups: {
                  pending: { title: '待审批', color: '#1890ff' },
                  approved: { title: '已通过', color: '#52c41a' },
                  rejected: { title: '已拒绝', color: '#ff4d4f' },
                  cancelled: { title: '已取消', color: '#999' },
                },
                renderCard: renderKanbanCard,
              };
            }
          }, [taskType])}
        />
      </ListPageTemplate>

      {/* 处理任务 Modal */}
      <FormModalTemplate
        title={actionType === 'approve' ? '审批通过' : '审批拒绝'}
        open={processModalVisible}
        onClose={() => {
          setProcessModalVisible(false);
          setCurrentTask(null);
          setComment('');
        }}
        onFinish={handleConfirmProcess}
        loading={false}
        width={MODAL_CONFIG.STANDARD_WIDTH}
      >
        {currentTask && (
          <>
            <Typography.Paragraph>
              <strong>任务标题：</strong>{currentTask.title}
            </Typography.Paragraph>
            <Typography.Paragraph>
              <strong>任务内容：</strong>{currentTask.content || '(无内容)'}
            </Typography.Paragraph>
            <ProFormTextArea
              name="comment"
              label="审批意见"
              fieldProps={{
                rows: 4,
                placeholder: actionType === 'approve' ? '请输入审批意见（可选）' : '请输入拒绝原因（可选）',
              }}
            />
          </>
        )}
      </FormModalTemplate>

      {/* 详情 Drawer */}
      <DetailDrawerTemplate<UserTask>
        title="任务详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        loading={detailLoading}
        width={DRAWER_CONFIG.STANDARD_WIDTH}
        dataSource={detailData || {}}
        columns={detailColumns}
        column={1}
      />
    </>
  );
};

export default UserTasksPage;

