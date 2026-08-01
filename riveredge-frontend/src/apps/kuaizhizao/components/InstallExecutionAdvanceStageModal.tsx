/**
 * 安装执行阶段推进弹窗
 */

import React, { useMemo } from 'react';
import { Alert } from 'antd';
import { ProFormTextArea } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import { FormModalTemplate, MODAL_CONFIG } from '../../../components/layout-templates';
import {
  type InstallExecution,
  type InstallExecutionAdvanceStagePayload,
} from '../services/install-execution';
import { formatInstallStageLabel } from './InstallExecutionFormModal';
import InstallExecutionStageSteps from './InstallExecutionStageSteps';

interface Props {
  open: boolean;
  job: InstallExecution | null;
  onClose: () => void;
  onSaved: (row: InstallExecution) => void;
  onSubmit: (jobId: number, payload: InstallExecutionAdvanceStagePayload) => Promise<InstallExecution>;
}

export const InstallExecutionAdvanceStageModal: React.FC<Props> = ({
  open,
  job,
  onClose,
  onSaved,
  onSubmit,
}) => {
  const { t } = useTranslation();

  const stageHint = useMemo(() => {
    if (!job?.stages?.length) {
      return t('app.kuaizhizao.installExecution.advanceNoStages');
    }
    const inProgress = job.stages.find((s) => s.status === '进行中');
    const pending = job.stages.find((s) => s.status === '待开始');
    const target = inProgress ?? pending;
    if (!target) {
      return t('app.kuaizhizao.installExecution.advanceAllDone');
    }
    if (inProgress) {
      return t('app.kuaizhizao.installExecution.advanceCompleteHint', {
        stage: formatInstallStageLabel(target.stage_key, target.stage_name),
      });
    }
    return t('app.kuaizhizao.installExecution.advanceStartHint', {
      stage: formatInstallStageLabel(target.stage_key, target.stage_name),
    });
  }, [job, t]);

  return (
    <FormModalTemplate
      title={t('app.kuaizhizao.installExecution.advanceStageTitle')}
      open={open}
      onClose={onClose}
      width={MODAL_CONFIG.LARGE_WIDTH}
      submitText={t('app.kuaizhizao.installExecution.advanceSubmit')}
      onFinish={async (values) => {
        if (!job) return;
        const row = await onSubmit(job.id, { notes: values.notes });
        onSaved(row);
        onClose();
      }}
    >
      <InstallExecutionStageSteps stages={job?.stages} style={{ marginBottom: 16 }} />
      <Alert type="info" showIcon message={stageHint} style={{ marginBottom: 16 }} />
      <ProFormTextArea
        name="notes"
        label={t('app.kuaizhizao.installExecution.advanceNotes')}
        fieldProps={{ rows: 3 }}
      />
    </FormModalTemplate>
  );
};

export default InstallExecutionAdvanceStageModal;
