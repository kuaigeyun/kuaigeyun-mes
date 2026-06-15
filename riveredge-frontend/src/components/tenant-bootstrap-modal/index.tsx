/**
 * 新组织首次登录引导：应用注册/启用 + 必备系统初始项
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { App, Modal, Progress, Typography, Spin } from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  completeBootstrap,
  getBootstrapStatus,
  runBootstrapStep,
  type BootstrapStep,
} from '../../services/tenantInit';
import { NAVIGATION_MENU_TREE_QUERY_KEY } from '../../hooks/useUnifiedMenuData';
import { useGlobalStore } from '../../stores/globalStore';

import {
  tenantBootstrapStepDescription,
  tenantBootstrapStepLabel,
} from '../../utils/tenantInitI18n';

type StepStatus = 'pending' | 'running' | 'success' | 'error';

const TenantBootstrapModal: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const queryClient = useQueryClient();
  const startedRef = useRef(false);

  const { data: status, refetch: refetchStatus } = useQuery({
    queryKey: ['tenantBootstrapStatus'],
    queryFn: getBootstrapStatus,
    staleTime: 0,
  });

  const [visible, setVisible] = useState(false);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const [stepStatus, setStepStatus] = useState<Record<string, StepStatus>>({});

  const steps = status?.steps ?? [];
  const completedCount = steps.filter((s) => stepStatus[s.key] === 'success').length;
  const progressPercent = steps.length > 0 ? Math.round((completedCount / steps.length) * 100) : 0;

  const refreshMenus = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: [NAVIGATION_MENU_TREE_QUERY_KEY] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-menu-tree'] });
    queryClient.invalidateQueries({ queryKey: ['applicationMenus'] });
    useGlobalStore.getState().incrementApplicationMenuVersion();
  }, [queryClient]);

  const runBootstrap = useCallback(async () => {
    if (!steps.length) return;
    setRunning(true);
    setFinished(false);

    const nextStatus: Record<string, StepStatus> = {};
    for (const step of steps) {
      nextStatus[step.key] = 'pending';
    }
    setStepStatus(nextStatus);

    let hasError = false;
    for (const step of steps) {
      setStepStatus((prev) => ({ ...prev, [step.key]: 'running' }));
      try {
        const result = await runBootstrapStep(step.key);
        if (!result.success) {
          hasError = true;
          setStepStatus((prev) => ({ ...prev, [step.key]: 'error' }));
          continue;
        }
        setStepStatus((prev) => ({ ...prev, [step.key]: 'success' }));
      } catch (error: any) {
        hasError = true;
        setStepStatus((prev) => ({ ...prev, [step.key]: 'error' }));
        messageApi.error(error?.message || t('components.tenantBootstrap.stepFailed'));
      }
    }

    try {
      await completeBootstrap();
      refreshMenus();
      await refetchStatus();
      setFinished(true);
      if (hasError) {
        messageApi.warning(t('components.tenantBootstrap.partialSuccess'));
      }
    } catch (error: any) {
      messageApi.error(error?.message || t('components.tenantBootstrap.completeFailed'));
    } finally {
      setRunning(false);
    }
  }, [messageApi, refetchStatus, refreshMenus, steps, t]);

  useEffect(() => {
    if (status?.pending) {
      setVisible(true);
    } else {
      setVisible(false);
    }
  }, [status?.pending]);

  useEffect(() => {
    if (!status?.pending || running || startedRef.current || !steps.length) {
      return;
    }
    startedRef.current = true;
    void runBootstrap();
  }, [runBootstrap, running, status?.pending, steps.length]);

  const handleEnter = () => {
    setVisible(false);
    refreshMenus();
  };

  if (!visible) {
    return null;
  }

  return (
    <Modal
      open
      title={t('components.tenantBootstrap.title')}
      closable={false}
      maskClosable={false}
      keyboard={false}
      footer={finished ? undefined : null}
      okText={t('components.tenantBootstrap.enterSystem')}
      cancelButtonProps={{ style: { display: 'none' } }}
      onOk={handleEnter}
      okButtonProps={{ disabled: running }}
      width={560}
      destroyOnHidden
    >
      <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
        {t('components.tenantBootstrap.description')}
      </Typography.Paragraph>

      <Progress
        percent={running ? progressPercent : finished ? 100 : progressPercent}
        status={finished ? 'success' : running ? 'active' : 'normal'}
        style={{ marginBottom: 16 }}
      />

      <div>
        {steps.map((step) => {
          const state = stepStatus[step.key] ?? 'pending';
          let icon = <ClockCircleOutlined style={{ color: 'var(--ant-color-text-quaternary)' }} />;
          if (state === 'running') {
            icon = <LoadingOutlined spin style={{ color: 'var(--ant-color-primary)' }} />;
          } else if (state === 'success') {
            icon = <CheckCircleOutlined style={{ color: 'var(--ant-color-success)' }} />;
          } else if (state === 'error') {
            icon = <CloseCircleOutlined style={{ color: 'var(--ant-color-error)' }} />;
          }

          return (
            <div key={step.key} style={{ display: 'flex', alignItems: 'center', padding: '8px 0' }}>
              <div style={{ marginRight: 8 }}>{icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div>{tenantBootstrapStepLabel(t, step)}</div>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {tenantBootstrapStepDescription(t, step)}
                </Typography.Text>
              </div>
            </div>
          );
        })}
      </div>

      {running && !finished ? (
        <div style={{ textAlign: 'center', marginTop: 8 }}>
          <Spin size="small" />
          <Typography.Text type="secondary" style={{ marginLeft: 8 }}>
            {t('components.tenantBootstrap.runningHint')}
          </Typography.Text>
        </div>
      ) : null}
    </Modal>
  );
};

export default TenantBootstrapModal;
