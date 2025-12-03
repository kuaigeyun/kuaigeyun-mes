/**
 * 我的任务页面
 * 
 * 用于用户查看和处理自己的任务。
 * 支持任务列表、任务详情、审批/拒绝等功能。
 */

import React, { useState, useEffect } from 'react';
import { ProTable, ProColumns } from '@ant-design/pro-components';
import { App, Card, Badge, Tag, Button, Space, message, Modal, Input } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, EyeOutlined, FileTextOutlined } from '@ant-design/icons';
import {
  getUserTasks,
  getUserTaskStats,
  processUserTask,
  UserTask,
  UserTaskListResponse,
  UserTaskStats,
  TaskActionRequest,
} from '../../../services/userTask';

const { TextArea } = Input;

/**
 * 我的任务页面组件
 */
const UserTasksPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const [stats, setStats] = useState<UserTaskStats | null>(null);
  const [taskType, setTaskType] = useState<'pending' | 'submitted'>('pending');
  const [processModalVisible, setProcessModalVisible] = useState(false);
  const [currentTask, setCurrentTask] = useState<UserTask | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject'>('approve');
  const [comment, setComment] = useState<string>('');

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
  const handleConfirmProcess = async () => {
    if (!currentTask) return;

    try {
      const data: TaskActionRequest = {
        action: actionType,
        comment: comment || undefined,
      };
      
      await processUserTask(currentTask.uuid, data);
      messageApi.success(actionType === 'approve' ? '审批通过' : '审批拒绝');
      setProcessModalVisible(false);
      setCurrentTask(null);
      setComment('');
      // 重新加载数据
      loadStats();
    } catch (error: any) {
      messageApi.error(error.message || '处理失败');
    }
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
      key: 'action',
      hideInSearch: true,
      render: (_: any, record: UserTask) => {
        const isPending = record.status === 'pending' && taskType === 'pending';
        return (
          <Space>
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => {
                Modal.info({
                  title: record.title,
                  width: 600,
                  content: (
                    <div>
                      <p><strong>内容：</strong>{record.content || '(无内容)'}</p>
                      <p><strong>状态：</strong>{getStatusTag(record.status)}</p>
                      {record.form_data && (
                        <>
                          <p><strong>表单数据：</strong></p>
                          <pre style={{ 
                            padding: '12px', 
                            background: '#f5f5f5', 
                            borderRadius: '4px',
                            maxHeight: '200px',
                            overflow: 'auto',
                          }}>
                            {JSON.stringify(record.form_data, null, 2)}
                          </pre>
                        </>
                      )}
                      {record.approval_history && Array.isArray(record.approval_history) && record.approval_history.length > 0 && (
                        <>
                          <p><strong>审批历史：</strong></p>
                          <div style={{ 
                            padding: '12px', 
                            background: '#f5f5f5', 
                            borderRadius: '4px',
                            maxHeight: '200px',
                            overflow: 'auto',
                          }}>
                            {record.approval_history.map((history: any, index: number) => (
                              <div key={index} style={{ marginBottom: '8px' }}>
                                <Tag color={history.action === 'approve' ? 'success' : 'error'}>
                                  {history.action === 'approve' ? '通过' : '拒绝'}
                                </Tag>
                                {history.comment && <span>{history.comment}</span>}
                                <span style={{ color: '#999', marginLeft: '8px' }}>
                                  {history.timestamp ? new Date(history.timestamp).toLocaleString() : ''}
                                </span>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  ),
                });
              }}
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

  return (
    <div style={{ padding: '24px' }}>
      {/* 统计卡片 */}
      {stats && (
        <div style={{ marginBottom: '16px', display: 'flex', gap: '16px' }}>
          <Card style={{ flex: 1 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1890ff' }}>
                {stats.total}
              </div>
              <div style={{ color: '#666', marginTop: '8px' }}>总任务数</div>
            </div>
          </Card>
          <Card style={{ flex: 1 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ff4d4f' }}>
                {stats.pending}
              </div>
              <div style={{ color: '#666', marginTop: '8px' }}>待处理任务</div>
            </div>
          </Card>
          <Card style={{ flex: 1 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#52c41a' }}>
                {stats.approved}
              </div>
              <div style={{ color: '#666', marginTop: '8px' }}>已通过任务</div>
            </div>
          </Card>
          <Card style={{ flex: 1 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#faad14' }}>
                {stats.submitted}
              </div>
              <div style={{ color: '#666', marginTop: '8px' }}>我提交的任务</div>
            </div>
          </Card>
        </div>
      )}

      {/* 任务列表 */}
      <Card>
        <ProTable<UserTask>
          columns={columns}
          request={async (params, sorter, filter) => {
            const response = await getUserTasks({
              page: params.current || 1,
              page_size: params.pageSize || 20,
              status: params.status as string | undefined,
              task_type: taskType,
            });
            return {
              data: response.items,
              success: true,
              total: response.total,
            };
          }}
          rowKey="uuid"
          search={{
            labelWidth: 'auto',
            defaultCollapsed: false,
          }}
          pagination={{
            defaultPageSize: 20,
            showSizeChanger: true,
            showQuickJumper: true,
          }}
          toolBarRender={() => [
            <Button
              key="pending"
              type={taskType === 'pending' ? 'primary' : 'default'}
              onClick={() => setTaskType('pending')}
            >
              待处理
            </Button>,
            <Button
              key="submitted"
              type={taskType === 'submitted' ? 'primary' : 'default'}
              onClick={() => setTaskType('submitted')}
            >
              我提交的
            </Button>,
          ]}
          headerTitle="我的任务"
        />
      </Card>

      {/* 处理任务 Modal */}
      <Modal
        title={actionType === 'approve' ? '审批通过' : '审批拒绝'}
        open={processModalVisible}
        onOk={handleConfirmProcess}
        onCancel={() => {
          setProcessModalVisible(false);
          setCurrentTask(null);
          setComment('');
        }}
        okText={actionType === 'approve' ? '确认通过' : '确认拒绝'}
        okButtonProps={{ danger: actionType === 'reject' }}
      >
        {currentTask && (
          <div>
            <p><strong>任务标题：</strong>{currentTask.title}</p>
            <p><strong>任务内容：</strong>{currentTask.content || '(无内容)'}</p>
            <div style={{ marginTop: '16px' }}>
              <p><strong>审批意见：</strong></p>
              <TextArea
                rows={4}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={actionType === 'approve' ? '请输入审批意见（可选）' : '请输入拒绝原因（可选）'}
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default UserTasksPage;

