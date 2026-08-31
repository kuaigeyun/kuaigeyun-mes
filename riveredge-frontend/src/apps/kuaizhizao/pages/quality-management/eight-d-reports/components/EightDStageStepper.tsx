/**
 * 8D 流程节点步进条 — 对齐研发/交付项目节点样式
 */

import React, { useMemo } from 'react';
import { Tag, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  CheckCircle2,
  FileSearch,
  GitBranch,
  Shield,
  ShieldCheck,
  Trophy,
  Users,
  Wrench,
} from 'lucide-react';
import { UniLifecycleStepper } from '../../../../../../components/uni-lifecycle/UniLifecycleStepper';
import type { SubStage, SubStageStatus } from '../../../../../../components/uni-lifecycle/types';
import {
  EIGHT_D_STATUS_ORDER,
  getEightDStageIndex,
  getEightDStatusText,
} from './eightDMeta';
import './EightDStageStepper.less';

const STAGE_ICON_SIZE = 17;

const STAGE_ICONS: Record<string, React.ReactNode> = {
  d0_prepare: <AlertTriangle size={STAGE_ICON_SIZE} strokeWidth={2} aria-hidden />,
  d1_team: <Users size={STAGE_ICON_SIZE} strokeWidth={2} aria-hidden />,
  d2_problem: <FileSearch size={STAGE_ICON_SIZE} strokeWidth={2} aria-hidden />,
  d3_containment: <Shield size={STAGE_ICON_SIZE} strokeWidth={2} aria-hidden />,
  d4_root_cause: <GitBranch size={STAGE_ICON_SIZE} strokeWidth={2} aria-hidden />,
  d5_corrective_action: <Wrench size={STAGE_ICON_SIZE} strokeWidth={2} aria-hidden />,
  d6_implement_result: <CheckCircle2 size={STAGE_ICON_SIZE} strokeWidth={2} aria-hidden />,
  d7_prevent_recurrence: <ShieldCheck size={STAGE_ICON_SIZE} strokeWidth={2} aria-hidden />,
  d8_team_congratulation: <Trophy size={STAGE_ICON_SIZE} strokeWidth={2} aria-hidden />,
};

function stageToSubStageStatus(
  stageKey: string,
  reportStatus?: string | null,
  activeStageKey?: string,
): SubStageStatus {
  const isClosed = reportStatus === 'closed';
  const reportIdx = isClosed
    ? EIGHT_D_STATUS_ORDER.indexOf('d8_team_congratulation')
    : getEightDStageIndex(reportStatus);
  const stageIdx = getEightDStageIndex(stageKey);
  if (stageIdx < 0) return 'pending';
  if (isClosed || stageIdx < reportIdx) return 'done';
  if (stageKey === activeStageKey) return 'active';
  return 'pending';
}

export function buildEightDWorkbenchStageSteps(
  t: (key: string) => string,
  reportStatus?: string | null,
  activeStageKey?: string,
): SubStage[] {
  const workflowStages = EIGHT_D_STATUS_ORDER.filter((key) => key !== 'closed');
  return workflowStages.map((key) => ({
    key,
    label: getEightDStatusText(t, key),
    status: stageToSubStageStatus(key, reportStatus, activeStageKey),
    icon: STAGE_ICONS[key] ?? <CheckCircle2 size={STAGE_ICON_SIZE} strokeWidth={2} aria-hidden />,
  }));
}

export interface EightDStageStepperProps {
  reportStatus?: string | null;
  activeStageKey: string;
  onChange?: (stageKey: string) => void;
}

export const EightDStageStepper: React.FC<EightDStageStepperProps> = ({
  reportStatus,
  activeStageKey,
  onChange,
}) => {
  const { t } = useTranslation();
  const workflowStages = useMemo(
    () => EIGHT_D_STATUS_ORDER.filter((key) => key !== 'closed'),
    [],
  );
  const steps = useMemo(
    () => buildEightDWorkbenchStageSteps(t, reportStatus, activeStageKey),
    [t, reportStatus, activeStageKey],
  );
  const isClosed = reportStatus === 'closed';
  const reportIdx = isClosed
    ? workflowStages.length
    : Math.max(0, getEightDStageIndex(reportStatus));
  const completedCount = isClosed ? workflowStages.length : reportIdx;
  const workflowStageLabel = getEightDStatusText(
    t,
    isClosed ? 'closed' : reportStatus,
  );

  return (
    <div className="eight-d-stage-stepper">
      <div className="eight-d-stage-stepper__header">
        <Typography.Text className="eight-d-stage-stepper__title">
          {t('app.kuaizhizao.eightD.workbench.stageStepper.title')}
        </Typography.Text>
        <div className="eight-d-stage-stepper__header-actions">
          <Typography.Text type="secondary" className="eight-d-stage-stepper__meta">
            {t('app.kuaizhizao.eightD.workbench.stageStepper.completedCount', {
              completed: completedCount,
              total: workflowStages.length,
            })}
          </Typography.Text>
          <Tag color={isClosed ? 'default' : 'processing'}>
            {workflowStageLabel}
            {!isClosed
              ? ` - ${t('app.kuaizhizao.eightD.workbench.stageStepper.inProgress')}`
              : ` - ${t('app.kuaizhizao.eightD.workbench.stageStepper.closed')}`}
          </Tag>
        </div>
      </div>
      <UniLifecycleStepper
        steps={steps}
        status={isClosed ? 'success' : 'normal'}
        nodeSize={42}
        connectorWidth={56}
        stepLabelMaxWidth={108}
        hideNextStepSuggestions
        onStepClick={onChange ? (key) => onChange(key) : undefined}
      />
    </div>
  );
};

export default EightDStageStepper;
