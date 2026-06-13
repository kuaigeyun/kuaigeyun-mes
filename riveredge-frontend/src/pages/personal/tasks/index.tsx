/**
 * 我的任务页面
 * 
 * 用于用户查看和处理自己的任务。
 * 支持任务列表、任务详情、审批/拒绝等功能。
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { rowActionKind } from '../../../components/uni-action';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns, ProFormTextArea } from '@ant-design/pro-components';
import { App, Badge, Tag, Button, Space, Typography } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, EyeOutlined, DeleteOutlined } from '@ant-design/icons';
import { UniTable } from '../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, MODAL_CONFIG, DRAWER_CONFIG } from '../../../components/layout-templates';
import { useListPageStatCardsVisible } from '../../../components/layout-templates/listPageStatCardsContext';
import { theme } from 'antd';
import {
  getUserTasks,
  getUserTaskStats,
  processUserTask,
  deleteUserTask,
  UserTask,
  UserTaskStats,
  TaskActionRequest,
} from '../../../services/userTask';

/**
 * 我的任务页面组件
 */
const UserTasksPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi, modal: modalApi } = App.useApp();
  const { token: themeToken } = theme.useToken();
  const statCardsVisible = useListPageStatCardsVisible();
  const actionRef = useRef<ActionType>(null);
  const [stats, setStats] = useState<UserTaskStats | null>(null);
  const [taskType, setTaskType] = useState<'pending' | 'processed' | 'submitted'>('pending');
  const [processModalVisible, setProcessModalVisible] = useState(false);
  const [currentTask, setCurrentTask] = useState<UserTask | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject'>('approve');
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [detailData, setDetailData] = useState<UserTask | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadStats = useCallback(async () => {
    if (!statCardsVisible) {
      return;
    }
    try {
      const data = await getUserTaskStats();
      setStats(data);
    } catch (error: any) {
      messageApi.error(error.message || t('pages.personal.tasks.loadStatsFailed'));
    }
  }, [messageApi, t, statCardsVisible]);

  /**
   * 加载任务统计
   */
  useEffect(() => {
    let isMounted = true;
    (async () => {
      if (isMounted && statCardsVisible) {
        await loadStats();
      }
    })();
    return () => { isMounted = false; };
  }, [loadStats, statCardsVisible]);

  /**
   * 处理任务（审批或拒绝）
   */
  /**
   * 确认处理任务
   */
  const handleConfirmProcess = useCallback(async (values: any, taskOverride?: UserTask, actionOverride?: 'approve' | 'reject') => {
    const task = taskOverride || currentTask;
    const action = actionOverride || actionType;
    if (!task) return;

    try {
      const data: TaskActionRequest = {
        action: action,
        comment: values.comment || undefined,
      };
      
      await processUserTask(task.uuid, data);
      messageApi.success(action === 'approve' ? t('pages.personal.tasks.approveSuccess') : t('pages.personal.tasks.rejectSuccess'));
      setProcessModalVisible(false);
      setCurrentTask(null);
      // 重新加载数据
      loadStats();
      actionRef.current?.reload();
    } catch (error: any) {
      if (messageApi) {
        messageApi.error(error.message || t('pages.personal.tasks.processFailed'));
      }
      throw error;
    }
  }, [currentTask, actionType, messageApi, t, loadStats]);

  /**
   * 处理任务（审批或拒绝）
   */
  const handleProcessTask = useCallback(async (task: UserTask, action: 'approve' | 'reject') => {
    if (task.data?.is_personal && action === 'approve') {
      // 个人任务直接执行通过逻辑，跳过弹窗
      setCurrentTask(task);
      setActionType(action);
      // 利用 setTimeout 避开并发状态更新问题，或者直接调用逻辑
      handleConfirmProcess({}, task, action);
      return;
    }
    setCurrentTask(task);
    setActionType(action);
    setProcessModalVisible(true);
  }, [handleConfirmProcess]);

  /**
   * 任务状态标签
   */
  const getStatusTag = useCallback((status: string) => {
    const statusMap: Record<string, { color: string; text: string }> = {
      pending: { color: 'processing', text: t('pages.personal.tasks.statusPending') },
      approved: { color: 'success', text: t('pages.personal.tasks.statusApproved') },
      rejected: { color: 'error', text: t('pages.personal.tasks.statusRejected') },
      cancelled: { color: 'default', text: t('pages.personal.tasks.statusCancelled') },
    };
    const statusInfo = statusMap[status] || { color: 'default', text: status };
    return <Tag color={statusInfo.color}>{statusInfo.text}</Tag>;
  }, [t]);

  /**
   * 处理查看详情
   */
  const handleView = useCallback((record: UserTask) => {
    try {
      setDetailLoading(true);
      setDrawerVisible(true);
      setDetailData(record);
    } catch (error: any) {
      if (messageApi) {
        messageApi.error(error.message || t('pages.personal.tasks.getDetailFailed'));
      }
    } finally {
      setDetailLoading(false);
    }
  }, [messageApi, t]);

  /**
   * 渲染看板卡片
   */
  const renderKanbanCard = useCallback((item: UserTask) => {
    const isPending = item.status === 'pending' && taskType === 'pending';
    const statusInfo = getStatusTag(item.status);

    return (
      <div
        key={item.uuid}
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
  }, [taskType, themeToken, getStatusTag, handleView]);

  /**
   * 处理删除任务
   */
  const handleDeleteTask = useCallback(async (record: UserTask) => {
    try {
      await deleteUserTask(record.uuid);
      messageApi.success(t('pages.personal.tasks.deleteSuccess'));
      loadStats();
      actionRef.current?.reload();
    } catch (error: any) {
      if (messageApi) {
        messageApi.error(error.message || t('pages.personal.tasks.deleteFailed'));
      }
    }
  }, [messageApi, t, loadStats]);

  /**
   * 表格列定义
   */
  const columns = useMemo<ProColumns<UserTask>[]>(() => [
    {
      title: t('pages.personal.tasks.title'),
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
      render: (dom: any, record: UserTask) => {
        const isPending = record.status === 'pending' && taskType === 'pending';
        return (
          <Space>
            {isPending && <Badge status="error" dot />}
            <span style={{ fontWeight: isPending ? 600 : 400 }}>
              {dom}
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
      width: 100,
      valueEnum: {
        pending: { text: t('pages.personal.tasks.statusPending') },
        approved: { text: t('pages.personal.tasks.statusApproved') },
        rejected: { text: t('pages.personal.tasks.statusRejected') },
        cancelled: { text: t('pages.personal.tasks.statusCancelled') },
      },
      render: (_: any, record: UserTask) => getStatusTag(record.status),
    },
    {
      title: taskType === 'submitted' ? t('pages.personal.tasks.currentApproverId') : t('pages.personal.tasks.submitter'),
      dataIndex: taskType === 'submitted' ? 'current_approver_id' : 'submitter_id',
      key: 'relation',
      width: 120,
      hideInSearch: true,
      render: (val) => val || '-',
    },
    {
      title: t('pages.personal.tasks.submittedAt'),
      dataIndex: 'submitted_at',
      key: 'submitted_at',
      valueType: 'dateTime',
      hideInSearch: true,
      sorter: true,
      width: 160,
    },
    {
      title: t('pages.personal.tasks.actions'),
      valueType: 'option',
      width: 160,
      fixed: 'right',
      render: (_: any, record: UserTask) => {
        const isPending = record.status === 'pending' && taskType === 'pending';
        return (
          <Space>
            <Button key="view" {...rowActionKind('read')}
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handleView(record)}
            >
              {t('pages.personal.tasks.view')}
            </Button>
            {isPending && (
              <>
                <Button key="approve" {...rowActionKind('audit')}
                  size="small"
                  icon={<CheckCircleOutlined />}
                  onClick={() => handleProcessTask(record, 'approve')}
                >
                  {record.data?.is_personal ? t('pages.personal.tasks.complete') : t('pages.personal.tasks.approve')}
                </Button>
                {!record.data?.is_personal && (
                  <Button key="reject" {...rowActionKind('reject')}
                    size="small"
                    danger
                    icon={<CloseCircleOutlined />}
                    onClick={() => handleProcessTask(record, 'reject')}
                  >
                    {t('pages.personal.tasks.reject')}
                  </Button>
                )}
              </>
            )}
            {taskType === 'submitted' && (
              <Button key="delete" {...rowActionKind('delete')}
                size="small"
                danger
                icon={<DeleteOutlined />}
                onClick={() => {
                  modalApi.confirm({
                    title: t('pages.personal.tasks.deleteConfirmTitle'),
                    centered: true,
                    okButtonProps: { danger: true },
                    onOk: () => handleDeleteTask(record),
                  });
                }}
              >
                {t('pages.personal.tasks.delete')}
              </Button>
            )}
          </Space>
        );
      },
    },
  ], [taskType, t, handleView, handleProcessTask, handleDeleteTask, getStatusTag, modalApi]);

  /**
   * 详情列定义
   */
  const detailColumns = useMemo(() => [
    { title: t('pages.personal.tasks.title'), dataIndex: 'title' },
    { title: t('pages.personal.tasks.content'), dataIndex: 'content', span: 2 },
    {
      title: t('pages.personal.tasks.status'),
      dataIndex: 'status',
      render: (dom: any) => getStatusTag(dom as string),
    },
    { title: t('pages.personal.tasks.submittedAt'), dataIndex: 'submitted_at', valueType: 'dateTime' },
    { title: t('pages.personal.tasks.createdAt'), dataIndex: 'created_at', valueType: 'dateTime' },
    {
      title: t('pages.personal.tasks.formData'),
      dataIndex: 'form_data',
      span: 2,
      render: (dom: any) => dom ? (
        <pre style={{
          margin: 0,
          padding: '12px',
          background: '#f5f5f5',
          borderRadius: '4px',
          maxHeight: '200px',
          overflow: 'auto',
        }}>
          {JSON.stringify(dom, null, 2)}
        </pre>
      ) : '-',
    },
    {
      title: t('pages.personal.tasks.approvalHistory'),
      dataIndex: 'approval_history',
      span: 2,
      render: (dom: any) => dom && Array.isArray(dom) && dom.length > 0 ? (
        <div style={{
          padding: '12px',
          background: '#f5f5f5',
          borderRadius: '4px',
          maxHeight: '200px',
          overflow: 'auto',
        }}>
          {dom.map((history: any, index: number) => (
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
  ], [t, getStatusTag]);

  return (
    <>
      <ListPageTemplate
        statCards={[
          {
            title: t('pages.personal.tasks.totalTasks'),
            value: stats?.total ?? 0,
            valueStyle: { color: themeToken.colorPrimary },
            onClick: () => actionRef.current?.reload(),
          },
          {
            title: t('pages.personal.tasks.pendingTasks'),
            value: stats?.pending ?? 0,
            valueStyle: { color: themeToken.colorError },
            description: taskType === 'pending' ? <Badge status="error" text={t('common.active')} /> : null,
            onClick: () => setTaskType('pending'),
          },
          {
            title: t('pages.personal.tasks.approvedTasks'),
            value: stats?.approved ?? 0,
            valueStyle: { color: themeToken.colorSuccess },
            description: taskType === 'processed' ? <Badge status="success" text={t('common.active')} /> : null,
            onClick: () => setTaskType('processed'),
          },
          {
            title: t('pages.personal.tasks.mySubmitted'),
            value: stats?.submitted ?? 0,
            valueStyle: { color: themeToken.colorWarning },
            description: taskType === 'submitted' ? <Badge status="warning" text={t('common.active')} /> : null,
            onClick: () => setTaskType('submitted'),
          },
        ]}
      >
        <UniTable<UserTask>
          columnPersistenceId="pages.personal.tasks"
          headerTitle={t('pages.personal.tasks.headerTitle')}
          actionRef={actionRef}
          columns={columns}
          params={{ taskType }} // 声明并绑定 taskType 参数，值变化时由 ProTable 自动触发请求，解决逻辑竞争
          request={async (params, _sort, _filter, searchFormValues) => {
            try {
              // 映射逻辑集中管理
              const reqTaskType = params.taskType === 'submitted'
                ? 'submitted'
                : params.taskType === 'processed'
                  ? 'processed'
                  : 'pending';
              const defaultStatus = params.taskType === 'pending' ? 'pending' : (params.taskType === 'processed' ? 'approved,rejected' : undefined);
              
              const response = await getUserTasks({
                page: params.current || 1,
                page_size: params.pageSize || 20,
                status: searchFormValues?.status || defaultStatus,
                task_type: reqTaskType as any,
              });
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
          tanstackQuery={{
            queryKeyPrefix: ['user-personal-tasks'],
            staleTime: 0,
            prefetchNextPage: true,
          }}
          rowKey="uuid"
          showAdvancedSearch={true}
          showImportButton={false}
          showExportButton={true}
          onExport={async (type, keys, pageData) => {
            try {
              const statusFilter = taskType === 'pending' ? 'pending' : (taskType === 'processed' ? 'approved,rejected' : undefined);
              const res = await getUserTasks({ 
                page: 1, 
                page_size: 10000, 
                task_type: taskType as any,
                status: statusFilter
              });
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
              const blob = new window.Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = t('pages.personal.tasks.exportFileName', {
                date: new Date().toISOString().slice(0, 10),
              });
              a.click();
              window.URL.revokeObjectURL(url);
              messageApi.success(t('common.exportSuccess', { count: items.length }));
            } catch (error: any) {
              messageApi.error(error?.message || t('common.updateFailed'));
            }
          }}
          pagination={{
            defaultPageSize: 20,
            showSizeChanger: true,
          }}
          toolbar={{
            menu: {
              type: 'tab',
              activeKey: taskType,
              items: [
                {
                  key: 'pending',
                  label: (
                    <span>
                      {t('pages.personal.tasks.pendingTab')}
                      {stats && stats.pending > 0 && (
                        <Badge count={stats.pending} style={{ marginLeft: 8 }} size="small" />
                      )}
                    </span>
                  ),
                },
                {
                  key: 'processed',
                  label: t('pages.personal.tasks.processedTab'),
                },
                {
                  key: 'submitted',
                  label: t('pages.personal.tasks.mySubmittedTab'),
                },
              ],
              onChange: (key) => setTaskType(key as 'pending' | 'processed' | 'submitted'),
            },
          }}
          viewTypes={['table', 'help']}
          defaultViewType="table"
          kanbanViewConfig={useMemo(() => {
            if (taskType === 'pending') {
              return {
                statusField: 'status',
                statusGroups: {
                  pending: { title: t('pages.personal.tasks.statusPending'), color: '#1890ff' },
                } as any,
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
          }, [taskType, t, renderKanbanCard])}
        />
      </ListPageTemplate>

      {/* 处理任务 Modal */}
      <FormModalTemplate
        title={actionType === 'approve' ? t('pages.personal.tasks.modalApproveTitle') : t('pages.personal.tasks.modalRejectTitle')}
        open={processModalVisible}
        onClose={() => {
          setProcessModalVisible(false);
          setCurrentTask(null);
        }}
        onFinish={handleConfirmProcess}
        loading={false}
        width={MODAL_CONFIG.SMALL_WIDTH}
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
      <DetailDrawerTemplate
        title={t('pages.personal.tasks.detailTitle')}
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        loading={detailLoading}
        width={DRAWER_CONFIG.STANDARD_WIDTH}
        dataSource={detailData as any || {}}
        columns={detailColumns as any}
        column={1}
      />
    </>
  );
};

export default UserTasksPage;
