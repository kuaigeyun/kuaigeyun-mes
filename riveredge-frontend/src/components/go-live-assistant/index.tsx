/**
 * 上线助手组件
 *
 * 四阶段向导：蓝图确认 → 基础数据 → 业务流程 → 期初数据对齐
 */

import React, { useState, useCallback } from 'react';
import { Modal, Button, Space, Typography, Collapse, Tag, Spin, message } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, ReloadOutlined, LinkOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  getGoLiveAssistant,
  markBlueprintConfirmed,
  markInitialDataVerified,
  type GoLiveAssistantItem,
} from '../../services/onboarding';

export interface GoLiveAssistantContentProps {
  open?: boolean;
  onClose?: () => void;
  showRefresh?: boolean;
  onRefetch?: (refetch: () => void) => void;
}

export const GoLiveAssistantContent: React.FC<GoLiveAssistantContentProps> = ({
  open = false,
  onClose,
  showRefresh = false,
  onRefetch,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [expandedPhases, setExpandedPhases] = useState<string[]>([]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['goLiveAssistant'],
    queryFn: getGoLiveAssistant,
    enabled: open,
  });

  React.useEffect(() => {
    if (!onRefetch) return;
    onRefetch(() => refetch());
  }, [onRefetch, refetch]);

  // 打开时默认展开所有阶段
  React.useEffect(() => {
    if (open && data?.phases?.length) {
      setExpandedPhases(data.phases.map((p) => p.id));
    }
  }, [open, data?.phases]);

  const markBlueprintMutation = useMutation({
    mutationFn: markBlueprintConfirmed,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goLiveAssistant'] });
      message.success(t('goLiveAssistant.blueprintConfirmed') || '已标记蓝图已确认');
    },
  });

  const markInitialDataMutation = useMutation({
    mutationFn: markInitialDataVerified,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goLiveAssistant'] });
      message.success(t('goLiveAssistant.initialDataVerified') || '已标记期初数据已核对');
    },
  });

  const handleJump = useCallback(
    (path?: string) => {
      if (path) {
        navigate(path);
        onClose?.();
      }
    },
    [navigate, onClose]
  );

  const handleConfirmBlueprint = useCallback(() => {
    markBlueprintMutation.mutate();
  }, [markBlueprintMutation]);

  const handleConfirmInitialData = useCallback(() => {
    markInitialDataMutation.mutate();
  }, [markInitialDataMutation]);

  const phases = data?.phases ?? [];
  const allCompleted = data?.all_completed ?? false;

  const renderItem = (item: GoLiveAssistantItem) => {
    const completed = item.completed ?? false;
    const isManualConfirm =
      item.id === 'blueprint_config' || item.id === 'initial_data_verified';

    return (
      <div
        key={item.id}
        style={{ display: 'flex', alignItems: 'flex-start', padding: '8px 0', columnGap: 12 }}
      >
        <div style={{ paddingTop: 2 }}>
          {completed ? (
            <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 20 }} />
          ) : (
            <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: 20 }} />
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Space>
            <span>{item.name}</span>
            {!item.required && <Tag color="default">{t('goLiveAssistant.optional') || '可选'}</Tag>}
          </Space>
          <Space orientation="vertical" size={0}>
            <span>{item.description}</span>
            {isManualConfirm && !completed && (
              <Button
                type="primary"
                size="small"
                onClick={
                  item.id === 'blueprint_config' ? handleConfirmBlueprint : handleConfirmInitialData
                }
                loading={
                  item.id === 'blueprint_config'
                    ? markBlueprintMutation.isPending
                    : markInitialDataMutation.isPending
                }
              >
                {item.id === 'blueprint_config'
                  ? (t('goLiveAssistant.confirmBlueprint') || '确认蓝图已配置')
                  : (t('goLiveAssistant.confirmInitialData') || '确认核对完成')}
              </Button>
            )}
          </Space>
        </div>
        {item.jump_path ? (
          <Button
            key="jump"
            type="link"
            size="small"
            icon={<LinkOutlined />}
            onClick={() => handleJump(item.jump_path)}
          >
            {t('goLiveAssistant.jump') || '跳转'}
          </Button>
        ) : null}
      </div>
    );
  };

  return (
    <div>
      {showRefresh && (
        <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'flex-end' }}>
          <Button icon={<ReloadOutlined />} onClick={() => refetch()}>
            {t('common.refresh') || '刷新'}
          </Button>
        </div>
      )}

      {isLoading ? (
        <div style={{ padding: 48, textAlign: 'center' }}>
          <Spin size="large" />
        </div>
      ) : allCompleted ? (
        <div style={{ padding: 24, textAlign: 'center' }}>
          <CheckCircleOutlined style={{ fontSize: 64, color: '#52c41a', marginBottom: 16 }} />
          <Typography.Title level={4}>
            {t('goLiveAssistant.allCompleted') || '恭喜！所有上线准备项已完成'}
          </Typography.Title>
          <Typography.Paragraph type="secondary">
            {t('goLiveAssistant.allCompletedDesc') || '您可以开始正式使用系统了。'}
          </Typography.Paragraph>
        </div>
      ) : (
        <Collapse
          activeKey={expandedPhases}
          onChange={(keys) => setExpandedPhases(Array.isArray(keys) ? keys : [keys])}
          items={phases.map((phase) => {
            const completedCount = phase.items.filter((i) => i.completed).length;
            const total = phase.items.length;
            const phaseCompleted = completedCount === total;

            return {
              key: phase.id,
              label: (
                <Space>
                  {phaseCompleted ? (
                    <CheckCircleOutlined style={{ color: '#52c41a' }} />
                  ) : (
                    <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
                  )}
                  <span>
                    {phase.name} ({completedCount}/{total})
                  </span>
                </Space>
              ),
              children: <div>{phase.items.map((item) => renderItem(item))}</div>,
            };
          })}
        />
      )}
    </div>
  );
};

export interface GoLiveAssistantProps {
  open?: boolean;
  onClose?: () => void;
}

export const GoLiveAssistantModal: React.FC<GoLiveAssistantProps> = ({ open = false, onClose }) => {
  const { t } = useTranslation();
  const [refetchFn, setRefetchFn] = React.useState<null | (() => void)>(null);

  return (
    <Modal
      title={t('goLiveAssistant.title') || '上线助手'}
      open={open}
      onCancel={onClose}
      footer={[
        <Button key="refresh" icon={<ReloadOutlined />} onClick={() => refetchFn?.()}>
          {t('common.refresh') || '刷新'}
        </Button>,
        <Button key="close" type="primary" onClick={onClose}>
          {t('common.close') || '关闭'}
        </Button>,
      ]}
      width={640}
      destroyOnHidden
    >
      <GoLiveAssistantContent
        open={open}
        onClose={onClose}
        showRefresh={false}
        onRefetch={(fn) => setRefetchFn(() => fn)}
      />
    </Modal>
  );
};

export default GoLiveAssistantModal;
