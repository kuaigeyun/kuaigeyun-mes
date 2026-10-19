/**
 * 新组织首次登录引导：应用注册/启用 + 必备系统初始项
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Modal, Progress, Typography, Spin } from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
  ClockCircleOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  completeBootstrap,
  getBootstrapStatus,
  runBootstrapStep,
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
  const [stepErrors, setStepErrors] = useState<Record<string, string>>({});
  const [bootstrapError, setBootstrapError] = useState<string>();

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
    setBootstrapError(undefined);

    const pendingSteps = steps.filter((step) => stepStatus[step.key] !== 'success');
    setStepStatus((prev) => ({
      ...prev, ...Object.fromEntries(pendingSteps.map((step) => [step.key, 'pending' as const])),
    }));

    let hasError = false;
    for (const step of pendingSteps) {
      setStepStatus((prev) => ({ ...prev, [step.key]: 'running' }));
      setStepErrors((prev) => ({ ...prev, [step.key]: '' }));
      try {
        const result = await runBootstrapStep(step.key);
        if (!result.success) {
          hasError = true;
          setStepStatus((prev) => ({ ...prev, [step.key]: 'error' }));
          setStepErrors((prev) => ({ ...prev, [step.key]: result.error || t('components.tenantBootstrap.stepFailed') }));
          continue;
        }
        setStepStatus((prev) => ({ ...prev, [step.key]: 'success' }));
      } catch (error: any) {
        hasError = true;
        setStepStatus((prev) => ({ ...prev, [step.key]: 'error' }));
        setStepErrors((prev) => ({ ...prev, [step.key]: error?.message || t('components.tenantBootstrap.stepFailed') }));
      }
    }

    if (hasError) {
      setRunning(false);
      return;
    }

    try {
      await completeBootstrap();
      refreshMenus();
      await refetchStatus();
      setFinished(true);
    } catch (error: any) {
      setBootstrapError(error?.message || t('components.tenantBootstrap.completeFailed'));
    } finally {
      setRunning(false);
    }
  }, [refetchStatus, refreshMenus, stepStatus, steps, t]);

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
      mask={{ closable: false }}
      keyboard={false}
      footer={running ? null : finished ? undefined : (
        <Button type="primary" icon={<ReloadOutlined />} onClick={() => void runBootstrap()}>
          {t('common.retry')}
        </Button>
      )}
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
        percent={progressPercent}
        status={finished ? 'success' : running ? 'active' :
          bootstrapError || Object.values(stepStatus).includes('error') ? 'exception' : 'normal'}
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
                {stepErrors[step.key] && (
                  <Typography.Paragraph type="danger" style={{ marginBottom: 0, overflowWrap: 'anywhere' }}>
                    {stepErrors[step.key]}
                  </Typography.Paragraph>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {bootstrapError && <Typography.Paragraph type="danger">{bootstrapError}</Typography.Paragraph>}
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
