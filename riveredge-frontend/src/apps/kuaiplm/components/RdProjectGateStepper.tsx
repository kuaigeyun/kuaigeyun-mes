/**
 * NPI 阶段门步进条 — 工作台阶段切换
 */

import React, { useMemo } from 'react';
import { Tag, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import {
  CheckCircle2,
  Layers,
  Lightbulb,
  Package,
  PlayCircle,
  Rocket,
  TrendingUp,
  Truck,
  Factory,
  Headphones,
  XCircle,
} from 'lucide-react';
import { UniLifecycleStepper } from '../../../components/uni-lifecycle/UniLifecycleStepper';
import type { SubStage, SubStageStatus } from '../../../components/uni-lifecycle/types';
import type { ProjectType, RdProjectGate } from '../services/rd-project';
import { getKuaiplmGateStatusText } from './kuaiplmMeta';
import './RdProjectGateStepper.less';

const GATE_ICON_SIZE = 17;

const GATE_ICONS: Record<string, React.ReactNode> = {
  concept: <Lightbulb size={GATE_ICON_SIZE} strokeWidth={2} aria-hidden />,
  design: <Layers size={GATE_ICON_SIZE} strokeWidth={2} aria-hidden />,
  prototype: <Package size={GATE_ICON_SIZE} strokeWidth={2} aria-hidden />,
  pilot: <PlayCircle size={GATE_ICON_SIZE} strokeWidth={2} aria-hidden />,
  release: <Rocket size={GATE_ICON_SIZE} strokeWidth={2} aria-hidden />,
  ramp: <TrendingUp size={GATE_ICON_SIZE} strokeWidth={2} aria-hidden />,
  first_delivery: <Truck size={GATE_ICON_SIZE} strokeWidth={2} aria-hidden />,
  stable_production: <Factory size={GATE_ICON_SIZE} strokeWidth={2} aria-hidden />,
  service_handover: <Headphones size={GATE_ICON_SIZE} strokeWidth={2} aria-hidden />,
};

function gateToSubStageStatus(gate: RdProjectGate, activeGateKey?: string): SubStageStatus {
  const gs = gate.status ?? 'PENDING';
  if (gs === 'PASSED' || gs === 'SKIPPED') return 'done';
  if (gate.gate_key === activeGateKey) return 'active';
  return 'pending';
}

export function buildRdProjectGateSteps(gates: RdProjectGate[], activeGateKey?: string): SubStage[] {
  return gates.map((gate) => {
    const key = gate.gate_key ?? String(gate.id);
    return {
      key,
      label: gate.gate_name ?? key,
      status: gateToSubStageStatus(gate, activeGateKey),
      icon: GATE_ICONS[gate.gate_key ?? ''] ?? <CheckCircle2 size={GATE_ICON_SIZE} strokeWidth={2} aria-hidden />,
    };
  });
}

export interface RdProjectGateStepperProps {
  gates: RdProjectGate[];
  activeGateKey?: string;
  onChange?: (gateKey: string) => void;
  projectType?: ProjectType;
}

export const RdProjectGateStepper: React.FC<RdProjectGateStepperProps> = ({
  gates,
  activeGateKey,
  onChange,
  projectType = 'RD',
}) => {
  const { t } = useTranslation();
  const steps = useMemo(() => buildRdProjectGateSteps(gates, activeGateKey), [gates, activeGateKey]);
  const activeGate = gates.find((g) => g.gate_key === activeGateKey);
  const activeStatus = activeGate?.status ?? 'PENDING';
  const isException = activeStatus === 'FAILED';

  const passedCount = gates.filter((g) => g.status === 'PASSED').length;
  const stageTitle =
    projectType === 'DELIVERY'
      ? t('app.kuaiplm.rdProjects.gateStepper.deliveryTitle')
      : t('app.kuaiplm.rdProjects.gateStepper.npiTitle');

  return (
    <div className="rd-project-gate-stepper">
      <div className="rd-project-gate-stepper__header">
        <Typography.Text className="rd-project-gate-stepper__title">{stageTitle}</Typography.Text>
        <SpaceLike>
          <Typography.Text type="secondary" className="rd-project-gate-stepper__meta">
            {t('app.kuaiplm.rdProjects.gateStepper.passedCount', {
              passed: passedCount,
              total: gates.length,
            })}
          </Typography.Text>
          {activeGate ? (
            <Tag
              color={
                activeStatus === 'PASSED'
                  ? 'success'
                  : activeStatus === 'FAILED'
                    ? 'error'
                    : activeStatus === 'IN_PROGRESS'
                      ? 'processing'
                      : 'default'
              }
            >
              {activeGate.gate_name} · {getKuaiplmGateStatusText(t, activeStatus)}
            </Tag>
          ) : null}
        </SpaceLike>
      </div>
      <UniLifecycleStepper
        steps={steps}
        status={isException ? 'exception' : 'normal'}
        nodeSize={42}
        connectorWidth={56}
        stepLabelMaxWidth={108}
        hideNextStepSuggestions
        onStepClick={onChange ? (key) => onChange(key) : undefined}
      />
      {isException ? (
        <Typography.Text type="danger" className="rd-project-gate-stepper__hint">
          <XCircle size={14} style={{ marginRight: 4, verticalAlign: '-2px' }} aria-hidden />
          {t('app.kuaiplm.rdProjects.gateStepper.failedHint')}
        </Typography.Text>
      ) : null}
    </div>
  );
};

/** 避免仅为两行 header 引入 antd Space 额外间距 */
function SpaceLike({ children }: { children: React.ReactNode }) {
  return <div className="rd-project-gate-stepper__header-actions">{children}</div>;
}

export default RdProjectGateStepper;
