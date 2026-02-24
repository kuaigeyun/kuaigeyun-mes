/**
 * 审批流程实例 - 看板视图组件
 * 
 * 提供看板布局的审批实例管理界面，支持拖拽切换状态
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { App, Card, Badge, Tag, Button, Space, message, Drawer, Typography, Descriptions, Divider, Timeline, Empty, Statistic, Row, Col } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, EyeOutlined, ClockCircleOutlined, StopOutlined, SwapOutlined } from '@ant-design/icons';
import { DragEndEvent } from '@dnd-kit/core';
import KanbanBoard, { KanbanColumn, KanbanCardProps } from '../../../../components/kanban-board';
import {
  getApprovalInstanceList,
  getApprovalInstanceByUuid,
  performApprovalAction,
  ApprovalInstance,
  ApprovalInstanceActionData,
} from '../../../../services/approvalInstance';
import { handleError } from '../../../../utils/errorHandler';

const { Text, Paragraph } = Typography;

/**
 * 审批历史项
 */
interface ApprovalHistoryItem {
  action: 'approve' | 'reject' | 'cancel' | 'transfer';
  approver: string;
  comment?: string;
  timestamp: string;
  node?: string;
}

/**
 * 审批统计
 */
interface ApprovalStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  cancelled: number;
}

/**
 * 看板视图组件
 */
const KanbanView: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const [instances, setInstances] = useState<ApprovalInstance[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<ApprovalStats | null>(null);
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [selectedInstance, setSelectedInstance] = useState<ApprovalInstance | null>(null);
  const [approvalHistory, setApprovalHistory] = useState<ApprovalHistoryItem[]>([]);

  /**
   * 加载审批实例列表
   */
  const loadInstances = async () => {
    setLoading(true);
    try {
      const data = await getApprovalInstanceList({
        skip: 0,
        limit: 1000, // 看板视图需要加载所有实例
      });
      setInstances(data);
      
      // 计算统计
      const statsData: ApprovalStats = {
        total: data.length,
        pending: data.filter((i) => i.status === 'pending').length,
        approved: data.filter((i) => i.status === 'approved').length,
        rejected: data.filter((i) => i.status === 'rejected').length,
        cancelled: data.filter((i) => i.status === 'cancelled').length,
      };
      setStats(statsData);
    } catch (error: any) {
      handleError(error, t('pages.system.approvalInstances.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInstances();
  }, []);

  /**
   * 审批状态标签
   */
  const getStatusTag = (status: string) => {
    const statusMap: Record<string, { color: string; text: string }> = {
      pending: { color: 'processing', text: t('pages.system.approvalInstances.statusPending') },
      approved: { color: 'success', text: t('pages.system.approvalInstances.statusApproved') },
      rejected: { color: 'error', text: t('pages.system.approvalInstances.statusRejected') },
      cancelled: { color: 'default', text: t('pages.system.approvalInstances.statusCancelled') },
    };
    const statusInfo = statusMap[status] || { color: 'default', text: status };
    return <Tag color={statusInfo.color}>{statusInfo.text}</Tag>;
  };

  /**
   * 按状态分组审批实例
   */
  const columns: KanbanColumn[] = useMemo(() => {
    return [
      {
        id: 'pending',
        title: t('pages.system.approvalInstances.statusPending'),
        color: '#1890ff',
        items: instances.filter((i) => i.status === 'pending'),
      },
      {
        id: 'approved',
        title: t('pages.system.approvalInstances.statusApproved'),
        color: '#52c41a',
        items: instances.filter((i) => i.status === 'approved'),
      },
      {
        id: 'rejected',
        title: t('pages.system.approvalInstances.statusRejected'),
        color: '#ff4d4f',
        items: instances.filter((i) => i.status === 'rejected'),
      },
      {
        id: 'cancelled',
        title: t('pages.system.approvalInstances.statusCancelled'),
        color: '#999',
        items: instances.filter((i) => i.status === 'cancelled'),
      },
    ];
  }, [instances, t]);

  /**
   * 处理拖拽结束
   */
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    // 查找拖拽的实例
    const instanceId = String(active.id);
    const instance = instances.find((i) => i.uuid === instanceId);

    if (!instance) {
      return;
    }

    // 获取目标状态
    const targetColumnId = over.id as string;

    // 如果实例已经在目标状态，不处理
    if (instance.status === targetColumnId) {
      return;
    }

    // 只有待审批状态的实例可以拖拽到已通过或已拒绝
    if (instance.status === 'pending') {
      if (targetColumnId === 'approved' || targetColumnId === 'rejected') {
        try {
          const action: ApprovalInstanceActionData = {
            action: targetColumnId === 'approved' ? 'approve' : 'reject',
          };
          await performApprovalAction(instance.uuid, action);
          messageApi.success(targetColumnId === 'approved' ? t('pages.system.approvalInstances.approveSuccess') : t('pages.system.approvalInstances.rejectSuccess'));
          loadInstances();
        } catch (error: any) {
          handleError(error, t('pages.system.approvalInstances.handleFailed'));
        }
      }
    }
  };

  /**
   * 渲染审批实例卡片
   */
  const renderCard: KanbanCardProps['renderCard'] = (instance: ApprovalInstance) => {
    return (
      <div>
        <div style={{ marginBottom: 8 }}>
          <Text strong style={{ fontSize: 14 }}>
            {instance.title}
          </Text>
        </div>
        {instance.content && (
          <Paragraph
            ellipsis={{ rows: 2, expandable: false }}
            style={{ marginBottom: 8, fontSize: 12, color: '#666' }}
          >
            {instance.content}
          </Paragraph>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <Space size="small">
            {getStatusTag(instance.status)}
            {instance.current_node && (
              <Tag color="blue" style={{ fontSize: 11 }}>
                {instance.current_node}
              </Tag>
            )}
          </Space>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {new Date(instance.submitted_at).toLocaleDateString()}
          </Text>
          <Button
            type="text"
            size="small"
            icon={<EyeOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              handleViewDetail(instance);
            }}
          >
            {t('pages.system.approvalInstances.view')}
          </Button>
        </div>
      </div>
    );
  };

  /**
   * 处理卡片点击
   */
  const handleCardClick = (instance: ApprovalInstance) => {
    handleViewDetail(instance);
  };

  /**
   * 查看详情
   */
  const handleViewDetail = async (instance: ApprovalInstance) => {
    try {
      const detail = await getApprovalInstanceByUuid(instance.uuid);
      setSelectedInstance(detail);
      setDetailDrawerVisible(true);
      
      // 生成审批历史（从实例数据中提取，如果有的话）
      // 这里可以根据实际的数据结构来生成历史记录
      const history: ApprovalHistoryItem[] = [];
      if (detail.data && detail.data.approval_history) {
        // 如果数据中包含审批历史
        history.push(...detail.data.approval_history);
      } else {
        // 否则根据状态生成基本历史
        history.push({
          action: 'approve' as const,
          approver: `用户 ${detail.submitter_id}`,
          timestamp: detail.submitted_at,
          node: detail.current_node,
        });
        if (detail.status === 'approved' && detail.completed_at) {
          history.push({
            action: 'approve' as const,
            approver: `用户 ${detail.current_approver_id || detail.submitter_id}`,
            timestamp: detail.completed_at,
          });
        } else if (detail.status === 'rejected' && detail.completed_at) {
          history.push({
            action: 'reject' as const,
            approver: `用户 ${detail.current_approver_id || detail.submitter_id}`,
            timestamp: detail.completed_at,
          });
        }
      }
      setApprovalHistory(history);
    } catch (error: any) {
      handleError(error, t('pages.system.approvalInstances.getDetailFailed'));
    }
  };

  /**
   * 处理审批操作
   */
  const handleAction = async (instance: ApprovalInstance, action: 'approve' | 'reject' | 'cancel' | 'transfer') => {
    try {
      const actionData: ApprovalInstanceActionData = {
        action,
      };
      await performApprovalAction(instance.uuid, actionData);
      messageApi.success(
        action === 'approve' ? t('pages.system.approvalInstances.approveSuccess') :
        action === 'reject' ? t('pages.system.approvalInstances.rejectSuccess') :
        action === 'cancel' ? t('pages.system.approvalInstances.cancelSuccess') :
        t('pages.system.approvalInstances.transferSuccess')
      );
      setDetailDrawerVisible(false);
      setSelectedInstance(null);
      loadInstances();
    } catch (error: any) {
      handleError(error, t('pages.system.approvalInstances.handleFailed'));
    }
  };

  /**
   * 渲染审批历史时间线
   */
  const renderApprovalHistory = () => {
    if (approvalHistory.length === 0) {
      return <Empty description={t('pages.system.approvalInstances.noHistory')} />;
    }

    return (
      <Timeline>
        {approvalHistory.map((item, index) => {
          let color = 'blue';
          let icon = <ClockCircleOutlined />;
          
          if (item.action === 'approve') {
            color = 'green';
            icon = <CheckCircleOutlined />;
          } else if (item.action === 'reject') {
            color = 'red';
            icon = <CloseCircleOutlined />;
          } else if (item.action === 'cancel') {
            color = 'gray';
            icon = <StopOutlined />;
          } else if (item.action === 'transfer') {
            color = 'orange';
            icon = <SwapOutlined />;
          }

          return (
            <Timeline.Item key={index} color={color} dot={icon}>
              <div>
                <div style={{ marginBottom: 4 }}>
                  <Text strong>
                    {item.action === 'approve' ? t('pages.system.approvalInstances.timelineApprove') :
                     item.action === 'reject' ? t('pages.system.approvalInstances.timelineReject') :
                     item.action === 'cancel' ? t('pages.system.approvalInstances.timelineCancel') :
                     t('pages.system.approvalInstances.timelineTransfer')}
                  </Text>
                  <Text type="secondary" style={{ marginLeft: 8 }}>
                    {item.approver}
                  </Text>
                </div>
                {item.comment && (
                  <Paragraph style={{ marginBottom: 4, fontSize: 12 }}>
                    {item.comment}
                  </Paragraph>
                )}
                {item.node && (
                  <Tag color="blue" style={{ fontSize: 11, marginBottom: 4 }}>
                    {item.node}
                  </Tag>
                )}
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {new Date(item.timestamp).toLocaleString()}
                  </Text>
                </div>
              </div>
            </Timeline.Item>
          );
        })}
      </Timeline>
    );
  };

  return (
    <>
      {/* 统计卡片 */}
      {stats && (
        <Card style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col span={6}>
              <Statistic
                title={t('pages.system.approvalInstances.statTotal')}
                value={stats.total}
                styles={{ content: { color: '#1890ff' } }}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title={t('pages.system.approvalInstances.statusPending')}
                value={stats.pending}
                styles={{ content: { color: '#1890ff' } }}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title={t('pages.system.approvalInstances.statusApproved')}
                value={stats.approved}
                styles={{ content: { color: '#52c41a' } }}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title={t('pages.system.approvalInstances.statusRejected')}
                value={stats.rejected}
                styles={{ content: { color: '#ff4d4f' } }}
              />
            </Col>
          </Row>
        </Card>
      )}

      {/* 看板 */}
      <KanbanBoard
        columns={columns}
        cardProps={{
          data: instances,
          idField: 'uuid',
          titleField: 'title',
          renderCard,
          onCardClick: handleCardClick,
        }}
        onDragEnd={handleDragEnd}
        showCount={true}
      />

      {/* 详情抽屉 */}
      <Drawer
        title={t('pages.system.approvalInstances.detailTitle')}
        placement="right"
        size={700}
        open={detailDrawerVisible}
        onClose={() => {
          setDetailDrawerVisible(false);
          setSelectedInstance(null);
          setApprovalHistory([]);
        }}
        extra={
          selectedInstance?.status === 'pending' ? (
            <Space>
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                onClick={() => handleAction(selectedInstance, 'approve')}
              >
                {t('pages.system.approvalInstances.approve')}
              </Button>
              <Button
                danger
                icon={<CloseCircleOutlined />}
                onClick={() => handleAction(selectedInstance, 'reject')}
              >
                {t('pages.system.approvalInstances.reject')}
              </Button>
              <Button
                icon={<SwapOutlined />}
                onClick={() => handleAction(selectedInstance, 'transfer')}
              >
                {t('pages.system.approvalInstances.transfer')}
              </Button>
              <Button
                icon={<StopOutlined />}
                onClick={() => handleAction(selectedInstance, 'cancel')}
              >
                {t('pages.system.approvalInstances.cancel')}
              </Button>
            </Space>
          ) : null
        }
      >
        {selectedInstance && (
          <div>
            <Descriptions column={1} bordered>
              <Descriptions.Item label={t('pages.system.approvalInstances.title')}>
                <Text strong>{selectedInstance.title}</Text>
              </Descriptions.Item>
              <Descriptions.Item label={t('pages.system.approvalInstances.content')}>
                {selectedInstance.content || t('pages.system.approvalInstances.noContent')}
              </Descriptions.Item>
              <Descriptions.Item label={t('pages.system.approvalInstances.statusLabel')}>
                {getStatusTag(selectedInstance.status)}
              </Descriptions.Item>
              {selectedInstance.current_node && (
                <Descriptions.Item label={t('pages.system.approvalInstances.currentNode')}>
                  {selectedInstance.current_node}
                </Descriptions.Item>
              )}
              {selectedInstance.current_approver_id && (
                <Descriptions.Item label={t('pages.system.approvalInstances.currentApproverId')}>
                  {selectedInstance.current_approver_id}
                </Descriptions.Item>
              )}
              <Descriptions.Item label={t('pages.system.approvalInstances.submittedAt')}>
                {new Date(selectedInstance.submitted_at).toLocaleString()}
              </Descriptions.Item>
              {selectedInstance.completed_at && (
                <Descriptions.Item label={t('pages.system.approvalInstances.completedAt')}>
                  {new Date(selectedInstance.completed_at).toLocaleString()}
                </Descriptions.Item>
              )}
            </Descriptions>

            {selectedInstance.data && Object.keys(selectedInstance.data).length > 0 && (
              <>
                <Divider>{t('pages.system.approvalInstances.approvalData')}</Divider>
                <pre
                  style={{
                    padding: '12px',
                    background: '#f5f5f5',
                    borderRadius: '4px',
                    maxHeight: '200px',
                    overflow: 'auto',
                  }}
                >
                  {JSON.stringify(selectedInstance.data, null, 2)}
                </pre>
              </>
            )}

            <Divider>{t('pages.system.approvalInstances.historyLabel')}</Divider>
            {renderApprovalHistory()}
          </div>
        )}
      </Drawer>
    </>
  );
};

export default KanbanView;

