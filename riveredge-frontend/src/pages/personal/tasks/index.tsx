/**
 * 我的任务页面
 * 
 * 用于用户查看和处理自己的任务。
 * 支持任务列表、任务详情、审批/拒绝等功能。
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
      messageApi.error(error.message || t('pages.personal.tasks.loadStatsFailed'));
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
      messageApi.success(actionType === 'approve' ? t('pages.personal.tasks.approveSuccess') : t('pages.personal.tasks.rejectSuccess'));
      setProcessModalVisible(false);
      setCurrentTask(null);
      setComment('');
      // 重新加载数据
      loadStats();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('pages.personal.tasks.processFailed'));
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
      messageApi.error(error.message || t('pages.personal.tasks.getDetailFailed'));
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
      pending: { color: 'processing', text: t('pages.personal.tasks.statusPending') },
      approved: { color: 'success', text: t('pages.personal.tasks.statusApproved') },
      rejected: { color: 'error', text: t('pages.personal.tasks.statusRejected') },
      cancelled: { color: 'default', text: t('pages.personal.tasks.statusCancelled') },
    };
    const statusInfo = statusMap[status] || { color: 'default', text: status };
    return <Tag color={statusInfo.color}>{statusInfo.text}</Tag>;
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<UserTask>[] = [
    {
      title: t('pages.personal.tasks.title'),
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
      title: t('pages.personal.tasks.content'),
      dataIndex: 'content',
      key: 'content',
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: t('pages.personal.tasks.status'),
      dataIndex: 'status',
      key: 'status',
      valueEnum: {
        pending: { text: t('pages.personal.tasks.statusPending') },
        approved: { text: t('pages.personal.tasks.statusApproved') },
        rejected: { text: t('pages.personal.tasks.statusRejected') },
        cancelled: { text: t('pages.personal.tasks.statusCancelled') },
      },
      render: (_: any, record: UserTask) => getStatusTag(record.status),
    },
    {
      title: t('pages.personal.tasks.submittedAt'),
      dataIndex: 'submitted_at',
      key: 'submitted_at',
      valueType: 'dateTime',
      hideInSearch: true,
      sorter: true,
    },
    {
      title: t('pages.personal.tasks.createdAt'),
      dataIndex: 'created_at',
      key: 'created_at',
      valueType: 'dateTime',
      hideInSearch: true,
      sorter: true,
    },
    {
      title: t('pages.personal.tasks.actions'),
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
              {t('pages.personal.tasks.view')}
            </Button>
            {isPending && (
              <>
                <Button
                  type="link"
                  size="small"
                  icon={<CheckCircleOutlined />}
                  onClick={() => handleProcessTask(record, 'approve')}
                >
                  {t('pages.personal.tasks.approve')}
                </Button>
                <Button
                  type="link"
                  size="small"
                  danger
                  icon={<CloseCircleOutlined />}
                  onClick={() => handleProcessTask(record, 'reject')}
                >
                  {t('pages.personal.tasks.reject')}
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
    { title: t('pages.personal.tasks.title'), dataIndex: 'title' },
    { title: t('pages.personal.tasks.content'), dataIndex: 'content', span: 2 },
    {
      title: t('pages.personal.tasks.status'),
      dataIndex: 'status',
      render: (value: string) => getStatusTag(value),
    },
    { title: t('pages.personal.tasks.submittedAt'), dataIndex: 'submitted_at', valueType: 'dateTime' },
    { title: t('pages.personal.tasks.createdAt'), dataIndex: 'created_at', valueType: 'dateTime' },
    {
      title: t('pages.personal.tasks.formData'),
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
      title: t('pages.personal.tasks.approvalHistory'),
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
                {history.action === 'approve' ? t('pages.personal.tasks.through') : t('pages.personal.tasks.rejectLabel')}
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
                  title: t('pages.personal.tasks.totalTasks'),
                  value: stats.total,
                  valueStyle: { color: '#1890ff' },
                },
                {
                  title: t('pages.personal.tasks.pendingTasks'),
                  value: stats.pending,
                  valueStyle: { color: '#ff4d4f' },
                },
                {
                  title: t('pages.personal.tasks.approvedTasks'),
                  value: stats.approved,
                  valueStyle: { color: '#52c41a' },
                },
                {
                  title: t('pages.personal.tasks.mySubmitted'),
                  value: stats.submitted,
                  valueStyle: { color: '#faad14' },
                },
              ]
            : undefined
        }
      >
        <UniTable<UserTask>
          headerTitle={t('pages.personal.tasks.headerTitle')}
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
              messageApi.error(error?.message || t('pages.personal.tasks.getListFailed'));
              return {
                data: [],
                success: false,
                total: 0,
              };
            }
          }}
          rowKey="uuid"
          showAdvancedSearch={true}
          showImportButton={false}
          showExportButton={true}
          onExport={async (type, keys, pageData) => {
            try {
              const res = await getUserTasks({ page: 1, page_size: 10000, task_type: taskType });
              let items = res.items || [];
              if (type === 'currentPage' && pageData?.length) {
                items = pageData;
              } else if (type === 'selected' && keys?.length) {
                items = items.filter((d) => keys.includes(d.uuid));
              }
              if (items.length === 0) {
                messageApi.warning(t('common.exportNoData'));
                return;
              }
              const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `my-tasks-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              URL.revokeObjectURL(url);
              messageApi.success(t('common.exportSuccess', { count: items.length }));
            } catch (error: any) {
              messageApi.error(error?.message || t('common.updateFailed'));
            }
          }}
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
              {t('pages.personal.tasks.pendingTab')}
            </Button>,
            <Button
              key="submitted"
              type={taskType === 'submitted' ? 'primary' : 'default'}
              onClick={() => {
                setTaskType('submitted');
                actionRef.current?.reload();
              }}
            >
              {t('pages.personal.tasks.mySubmittedTab')}
            </Button>,
          ]}
          viewTypes={['table', 'help']}
          defaultViewType="table"
          kanbanViewConfig={useMemo(() => {
            if (taskType === 'pending') {
              return {
                statusField: 'status',
                statusGroups: {
                  pending: { title: t('pages.personal.tasks.statusPending'), color: '#1890ff' },
                },
                renderCard: renderKanbanCard,
              };
            } else {
              return {
                statusField: 'status',
                statusGroups: {
                  pending: { title: t('pages.personal.tasks.pendingApproval'), color: '#1890ff' },
                  approved: { title: t('pages.personal.tasks.statusApproved'), color: '#52c41a' },
                  rejected: { title: t('pages.personal.tasks.statusRejected'), color: '#ff4d4f' },
                  cancelled: { title: t('pages.personal.tasks.statusCancelled'), color: '#999' },
                },
                renderCard: renderKanbanCard,
              };
            }
          }, [taskType, t])}
        />
      </ListPageTemplate>

      {/* 处理任务 Modal */}
      <FormModalTemplate
        title={actionType === 'approve' ? t('pages.personal.tasks.modalApproveTitle') : t('pages.personal.tasks.modalRejectTitle')}
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
              <strong>{t('pages.personal.tasks.taskTitleLabel')}</strong>{currentTask.title}
            </Typography.Paragraph>
            <Typography.Paragraph>
              <strong>{t('pages.personal.tasks.taskContentLabel')}</strong>{currentTask.content || t('pages.personal.tasks.noContent')}
            </Typography.Paragraph>
            <ProFormTextArea
              name="comment"
              label={t('pages.personal.tasks.commentLabel')}
              fieldProps={{
                rows: 4,
                placeholder: actionType === 'approve' ? t('pages.personal.tasks.commentPlaceholderApprove') : t('pages.personal.tasks.commentPlaceholderReject'),
              }}
            />
          </>
        )}
      </FormModalTemplate>

      {/* 详情 Drawer */}
      <DetailDrawerTemplate<UserTask>
        title={t('pages.personal.tasks.detailTitle')}
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

