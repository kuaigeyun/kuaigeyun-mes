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
import { alignProColumns, GLOBAL_DOC_LIST_FIELD_RANK } from '../../../apps/kuaizhizao/pages/sales-management/shared/documentFieldAlignment';
import { renderSystemStatusTag } from '../../system/utils/systemListPresentation';
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
import { downloadRecordsAsXlsx } from '../../../utils/exportRecordsXlsx';
import { formatDateTimeBySiteSetting, formatDateBySiteSetting, todaySiteDateString } from '../../../utils/format';
import {
  KUAIPLM_APPROVAL_TITLE_PREFIX_I18N,
  KUAIPLM_CHANGE_TYPE_I18N,
} from '../../../apps/kuaiplm/components/kuaiplmMeta';
import { buildListPageHelpViewConfig } from '../../../components/page-help-wiki';

/** 后端写入的中文变更类型 → i18n key（与码表对齐，覆盖尚未出现的全部类型） */
const APPROVAL_CHANGE_TYPE_LABEL_TO_I18N: Record<string, string> = {
  ...KUAIPLM_CHANGE_TYPE_I18N,
  新增子件: KUAIPLM_CHANGE_TYPE_I18N.item_add,
  删除子件: KUAIPLM_CHANGE_TYPE_I18N.item_remove,
  修改子件: KUAIPLM_CHANGE_TYPE_I18N.item_modify,
  版本变更: KUAIPLM_CHANGE_TYPE_I18N.version_change,
  生效日期变更: KUAIPLM_CHANGE_TYPE_I18N.effective_change,
  工序变更: KUAIPLM_CHANGE_TYPE_I18N.operation_change,
  标准工时变更: KUAIPLM_CHANGE_TYPE_I18N.time_change,
  SOP变更: KUAIPLM_CHANGE_TYPE_I18N.sop_change,
  其他: KUAIPLM_CHANGE_TYPE_I18N.other,
};

const APPROVAL_CONTENT_AUTO_SUBMIT_ZH = '工程变更自动提交审批';

/** 将审批 content 前缀中的变更类型码/中文标签译为当前语言；兼容历史存量。 */
function formatApprovalTaskContent(
  content: string | null | undefined,
  translate: (key: string) => string,
): string {
  const raw = (content || '').trim();
  if (!raw) return '-';
  if (raw === APPROVAL_CONTENT_AUTO_SUBMIT_ZH) {
    return translate('app.kuaiplm.common.approvalContent.autoSubmit');
  }
  const sep = ' - ';
  const idx = raw.indexOf(sep);
  const head = (idx >= 0 ? raw.slice(0, idx) : raw).trim();
  const rest = idx >= 0 ? raw.slice(idx + sep.length) : '';
  const i18nKey = APPROVAL_CHANGE_TYPE_LABEL_TO_I18N[head];
  if (!i18nKey) return raw;
  const label = translate(i18nKey);
  return rest ? `${label}${sep}${rest}` : label;
}

/** 将审批 title 前缀（BOM/工艺路线变更）译为当前语言。 */
function formatApprovalTaskTitle(
  title: string | null | undefined,
  translate: (key: string) => string,
): string {
  const raw = (title || '').trim();
  if (!raw) return '-';
  for (const { prefix, i18nKey } of KUAIPLM_APPROVAL_TITLE_PREFIX_I18N) {
    if (raw === prefix) return translate(i18nKey);
    const withColon = `${prefix}: `;
    if (raw.startsWith(withColon)) {
      return `${translate(i18nKey)}: ${raw.slice(withColon.length)}`;
    }
  }
  return raw;
}

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
    return renderSystemStatusTag(statusInfo.text, statusInfo.color);
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
              {formatApprovalTaskTitle(item.title, t)}
            </Typography.Text>
          </Space>
        </div>
        {item.content && (
          <Typography.Paragraph
            ellipsis={{ rows: 2, expandable: false }}
            style={{ marginBottom: 8, fontSize: 12, color: themeToken.colorTextSecondary }}
          >
            {formatApprovalTaskContent(item.content, t)}
          </Typography.Paragraph>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
          {statusInfo}
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {item.submitted_at ? formatDateBySiteSetting(item.submitted_at) : ''}
          </Typography.Text>
        </div>
      </div>
    );
  }, [taskType, themeToken, getStatusTag, handleView, t]);

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
  const columns = useMemo<ProColumns<UserTask>[]>(() => alignProColumns([
    {
      title: t('pages.personal.tasks.title'),
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
      render: (_: any, record: UserTask) => {
        const isPending = record.status === 'pending' && taskType === 'pending';
        return (
          <Space>
            {isPending && <Badge status="error" dot />}
            <span style={{ fontWeight: isPending ? 600 : 400 }}>
              {formatApprovalTaskTitle(record.title, t)}
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
      render: (_: any, record: UserTask) => formatApprovalTaskContent(record.content, t),
    },
    {
      title: taskType === 'submitted' ? t('pages.personal.tasks.currentApproverId') : t('pages.personal.tasks.submitter'),
      dataIndex: taskType === 'submitted' ? 'current_approver_name' : 'submitter_name',
      key: 'relation',
      width: 120,
      minWidth: 120,
      uniTableKeepWidth: true,
      resizable: false,
      hideInSearch: true,
      render: (_: any, record: UserTask) => {
        if (taskType === 'submitted') {
          return record.current_approver_name || record.current_approver_id || '-';
        }
        return record.submitter_name || record.submitter_id || '-';
      },
    },
    {
      title: t('pages.personal.tasks.submittedAt'),
      dataIndex: 'submitted_at',
      key: 'submitted_at',
      valueType: 'dateTime',
      hideInSearch: true,
      sorter: true,
      width: 160,
      minWidth: 160,
      uniTableKeepWidth: true,
      resizable: false,
    },
    {
      title: t('common.status'),
      dataIndex: 'status',
      key: 'lifecycle',
      width: 100,
      minWidth: 100,
      uniTableKeepWidth: true,
      resizable: false,
      fixed: 'right',
      hideInSearch: true,
      valueEnum: {
        pending: { text: t('pages.personal.tasks.statusPending') },
        approved: { text: t('pages.personal.tasks.statusApproved') },
        rejected: { text: t('pages.personal.tasks.statusRejected') },
        cancelled: { text: t('pages.personal.tasks.statusCancelled') },
      },
      render: (_: any, record: UserTask) => getStatusTag(record.status),
    },
    {
      title: t('common.actions'),
      key: 'action',
      valueType: 'option',
      fixed: 'right',
      hideInSearch: true,
      render: (_: any, record: UserTask) => {
        const isPending = record.status === 'pending' && taskType === 'pending';
        return (
          <Space>
            <Button key="view" {...rowActionKind('read')}
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handleView(record)}
            >
              {t('common.view')}
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
                {t('common.delete')}
              </Button>
            )}
          </Space>
        );
      },
    },
  ], GLOBAL_DOC_LIST_FIELD_RANK), [taskType, t, handleView, handleProcessTask, handleDeleteTask, getStatusTag, modalApi]);

  /**
   * 详情列定义
   */
  const detailColumns = useMemo(() => [
    {
      title: t('pages.personal.tasks.title'),
      dataIndex: 'title',
      render: (_: any, record: UserTask) => formatApprovalTaskTitle(record.title, t),
    },
    {
      title: t('pages.personal.tasks.content'),
      dataIndex: 'content',
      span: 2,
      render: (_: any, record: UserTask) => formatApprovalTaskContent(record.content, t),
    },
    {
      title: t('common.status'),
      dataIndex: 'status',
      render: (dom: any) => getStatusTag(dom as string),
    },
    {
      title: t('pages.personal.tasks.submitter'),
      dataIndex: 'submitter_name',
      render: (_: any, record: UserTask) => record.submitter_name || record.submitter_id || '-',
    },
    { title: t('pages.personal.tasks.submittedAt'), dataIndex: 'submitted_at', valueType: 'dateTime' },
    { title: t('common.createdAt'), dataIndex: 'created_at', valueType: 'dateTime' },
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
                {history.timestamp ? formatDateTimeBySiteSetting(history.timestamp) : ''}
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
          columnPersistenceId="pages.personal.tasks.list-v1"
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
              await downloadRecordsAsXlsx(
                items as Array<Record<string, unknown>>,
                t('pages.personal.tasks.exportFileName', {
                  date: todaySiteDateString(),
                }),
              );
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
          helpViewConfig={buildListPageHelpViewConfig('personal.tasks')}
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
              <strong>{t('pages.personal.tasks.taskTitleLabel')}</strong>
              {formatApprovalTaskTitle(currentTask.title, t)}
            </Typography.Paragraph>
            <Typography.Paragraph>
              <strong>{t('pages.personal.tasks.taskContentLabel')}</strong>
              {currentTask.content
                ? formatApprovalTaskContent(currentTask.content, t)
                : t('pages.personal.tasks.noContent')}
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
