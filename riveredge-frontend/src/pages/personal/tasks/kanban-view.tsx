/**
 * 我的任务 - 看板视图组件
 * 
 * 提供看板布局的任务管理界面，支持拖拽切换状态
 */

import React, { useState, useEffect, useMemo } from 'react';
import { App, Card, Badge, Tag, Button, Space, message, Drawer, Typography, Descriptions, Divider, Empty } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, EyeOutlined, FileTextOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { DragEndEvent } from '@dnd-kit/core';
import KanbanBoard, { KanbanColumn, KanbanCardProps } from '../../../components/kanban-board';
import {
  getUserTasks,
  getUserTaskStats,
  processUserTask,
  UserTask,
  UserTaskStats,
  TaskActionRequest,
} from '../../../services/userTask';
import { handleError } from '../../../utils/errorHandler';

const { Text, Paragraph } = Typography;

/**
 * 看板视图组件属性
 */
interface KanbanViewProps {
  /**
   * 任务类型（pending=待处理, submitted=我提交的）
   */
  taskType: 'pending' | 'submitted';
  /**
   * 刷新回调
   */
  onRefresh?: () => void;
}

/**
 * 看板视图组件
 */
const KanbanView: React.FC<KanbanViewProps> = ({ taskType, onRefresh }) => {
  const { message: messageApi } = App.useApp();
  const [tasks, setTasks] = useState<UserTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [selectedTask, setSelectedTask] = useState<UserTask | null>(null);

  /**
   * 加载任务列表
   */
  const loadTasks = async () => {
    setLoading(true);
    try {
      const response = await getUserTasks({
        page: 1,
        page_size: 1000, // 看板视图需要加载所有任务
        task_type: taskType,
      });
      setTasks(response.items);
    } catch (error: any) {
      handleError(error, '加载任务失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, [taskType]);

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
   * 按状态分组任务
   */
  const columns: KanbanColumn[] = useMemo(() => {
    if (taskType === 'pending') {
      // 待处理任务：只显示待处理状态
      return [
        {
          id: 'pending',
          title: '待处理',
          color: '#1890ff',
          items: tasks.filter((t) => t.status === 'pending'),
        },
      ];
    } else {
      // 我提交的任务：显示所有状态
      return [
        {
          id: 'pending',
          title: '待审批',
          color: '#1890ff',
          items: tasks.filter((t) => t.status === 'pending'),
        },
        {
          id: 'approved',
          title: '已通过',
          color: '#52c41a',
          items: tasks.filter((t) => t.status === 'approved'),
        },
        {
          id: 'rejected',
          title: '已拒绝',
          color: '#ff4d4f',
          items: tasks.filter((t) => t.status === 'rejected'),
        },
        {
          id: 'cancelled',
          title: '已取消',
          color: '#999',
          items: tasks.filter((t) => t.status === 'cancelled'),
        },
      ];
    }
  }, [tasks, taskType]);

  /**
   * 处理拖拽结束
   */
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    // 查找拖拽的任务
    const taskId = String(active.id);
    const task = tasks.find((t) => t.uuid === taskId);

    if (!task) {
      return;
    }

    // 获取目标状态
    const targetColumnId = over.id as string;

    // 如果任务已经在目标状态，不处理
    if (task.status === targetColumnId) {
      return;
    }

    // 只有待处理任务可以拖拽到已通过或已拒绝
    if (task.status === 'pending' && taskType === 'pending') {
      if (targetColumnId === 'approved' || targetColumnId === 'rejected') {
        try {
          const action: TaskActionRequest = {
            action: targetColumnId === 'approved' ? 'approve' : 'reject',
          };
          await processUserTask(task.uuid, action);
          messageApi.success(targetColumnId === 'approved' ? '审批通过' : '审批拒绝');
          loadTasks();
          onRefresh?.();
        } catch (error: any) {
          handleError(error, '处理失败');
        }
      }
    }
  };

  /**
   * 渲染任务卡片
   */
  const renderCard: KanbanCardProps['renderCard'] = (task: UserTask) => {
    return (
      <div>
        <div style={{ marginBottom: 8 }}>
          <Text strong style={{ fontSize: 14 }}>
            {task.title}
          </Text>
        </div>
        {task.content && (
          <Paragraph
            ellipsis={{ rows: 2, expandable: false }}
            style={{ marginBottom: 8, fontSize: 12, color: '#666' }}
          >
            {task.content}
          </Paragraph>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space size="small">
            {getStatusTag(task.status)}
            <Text type="secondary" style={{ fontSize: 12 }}>
              {new Date(task.submitted_at).toLocaleDateString()}
            </Text>
          </Space>
          {task.status === 'pending' && taskType === 'pending' && (
            <Space size="small">
              <Button
                type="text"
                size="small"
                icon={<EyeOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedTask(task);
                  setDetailDrawerVisible(true);
                }}
              />
            </Space>
          )}
        </div>
      </div>
    );
  };

  /**
   * 处理卡片点击
   */
  const handleCardClick = (task: UserTask) => {
    setSelectedTask(task);
    setDetailDrawerVisible(true);
  };

  /**
   * 处理任务（审批或拒绝）
   */
  const handleProcessTask = async (task: UserTask, action: 'approve' | 'reject') => {
    try {
      const data: TaskActionRequest = {
        action,
      };
      await processUserTask(task.uuid, data);
      messageApi.success(action === 'approve' ? '审批通过' : '审批拒绝');
      setDetailDrawerVisible(false);
      setSelectedTask(null);
      loadTasks();
      onRefresh?.();
    } catch (error: any) {
      handleError(error, '处理失败');
    }
  };

  return (
    <>
      <KanbanBoard
        columns={columns}
        cardProps={{
          data: tasks,
          idField: 'uuid',
          titleField: 'title',
          renderCard,
          onCardClick: handleCardClick,
        }}
        onDragEnd={handleDragEnd}
        showCount={true}
      />

      {/* 任务详情抽屉 */}
      <Drawer
        title="任务详情"
        placement="right"
        size={600}
        open={detailDrawerVisible}
        onClose={() => {
          setDetailDrawerVisible(false);
          setSelectedTask(null);
        }}
        extra={
          selectedTask?.status === 'pending' && taskType === 'pending' ? (
            <Space>
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                onClick={() => handleProcessTask(selectedTask, 'approve')}
              >
                审批通过
              </Button>
              <Button
                danger
                icon={<CloseCircleOutlined />}
                onClick={() => handleProcessTask(selectedTask, 'reject')}
              >
                审批拒绝
              </Button>
            </Space>
          ) : null
        }
      >
        {selectedTask && (
          <div>
            <Descriptions column={1} bordered>
              <Descriptions.Item label="任务标题">
                <Text strong>{selectedTask.title}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="任务内容">
                {selectedTask.content || '(无内容)'}
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                {getStatusTag(selectedTask.status)}
              </Descriptions.Item>
              <Descriptions.Item label="提交时间">
                {new Date(selectedTask.submitted_at).toLocaleString()}
              </Descriptions.Item>
              {selectedTask.completed_at && (
                <Descriptions.Item label="完成时间">
                  {new Date(selectedTask.completed_at).toLocaleString()}
                </Descriptions.Item>
              )}
              {selectedTask.current_node && (
                <Descriptions.Item label="当前节点">
                  {selectedTask.current_node}
                </Descriptions.Item>
              )}
            </Descriptions>

            {selectedTask.data && Object.keys(selectedTask.data).length > 0 && (
              <>
                <Divider>表单数据</Divider>
                <pre
                  style={{
                    padding: '12px',
                    background: '#f5f5f5',
                    borderRadius: '4px',
                    maxHeight: '300px',
                    overflow: 'auto',
                  }}
                >
                  {JSON.stringify(selectedTask.data, null, 2)}
                </pre>
              </>
            )}
          </div>
        )}
      </Drawer>
    </>
  );
};

export default KanbanView;

