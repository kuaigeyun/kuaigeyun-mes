/**
 * 交付流程节点步进条 — 工作台节点切换（对齐研发阶段门步进条）
 */

import React, { useMemo } from 'react';
import { Tag, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import {
  CheckCircle2,
  ClipboardList,
  Factory,
  Flag,
  Headphones,
  Package,
  Truck,
  Wrench,
} from 'lucide-react';
import { UniLifecycleStepper } from '../../../../../components/uni-lifecycle/UniLifecycleStepper';
import type { SubStage, SubStageStatus } from '../../../../../components/uni-lifecycle/types';
import { MarkerTag } from '../../../../../constants/statusBadges';
import { DELIVERY_NODE_STATUS, type DeliveryProjectNode } from '../../../services/delivery-project';
import { formatBusinessDateOnly } from '../../../../../utils/format';
import './DeliveryProjectNodeStepper.less';

const NODE_ICON_SIZE = 17;

const NODE_ICONS: Record<string, React.ReactNode> = {
  order_confirm: <ClipboardList size={NODE_ICON_SIZE} strokeWidth={2} aria-hidden />,
  production: <Factory size={NODE_ICON_SIZE} strokeWidth={2} aria-hidden />,
  shipping: <Truck size={NODE_ICON_SIZE} strokeWidth={2} aria-hidden />,
  install: <Wrench size={NODE_ICON_SIZE} strokeWidth={2} aria-hidden />,
  acceptance: <CheckCircle2 size={NODE_ICON_SIZE} strokeWidth={2} aria-hidden />,
  service: <Headphones size={NODE_ICON_SIZE} strokeWidth={2} aria-hidden />,
  delivery: <Package size={NODE_ICON_SIZE} strokeWidth={2} aria-hidden />,
};

function nodeToSubStageStatus(node: DeliveryProjectNode, activeNodeKey?: string): SubStageStatus {
  const ns = node.status ?? 'pending';
  if (ns === 'completed') return 'done';
  if (node.node_key === activeNodeKey) return 'active';
  return 'pending';
}

function buildDeliveryNodeSteps(nodes: DeliveryProjectNode[], activeNodeKey?: string): SubStage[] {
  return [...nodes]
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || (a.id ?? 0) - (b.id ?? 0))
    .map((node) => {
      const key = node.node_key ?? String(node.id);
      return {
        key,
        label: node.node_name ?? key,
        status: nodeToSubStageStatus(node, activeNodeKey),
        icon: node.is_milestone ? (
          <Flag size={NODE_ICON_SIZE} strokeWidth={2} aria-hidden />
        ) : (
          NODE_ICONS[node.node_key ?? ''] ?? (
            <CheckCircle2 size={NODE_ICON_SIZE} strokeWidth={2} aria-hidden />
          )
        ),
      };
    });
}

function resolveNodeStatusColor(status?: string | null): string {
  const ns = status ?? 'pending';
  if (ns === 'completed') return 'success';
  if (ns === 'overdue') return 'error';
  if (ns === 'in_progress') return 'processing';
  return 'default';
}

export interface DeliveryProjectNodeStepperProps {
  nodes: DeliveryProjectNode[];
  activeNodeKey?: string;
  onChange?: (nodeKey: string) => void;
}

export const DeliveryProjectNodeStepper: React.FC<DeliveryProjectNodeStepperProps> = ({
  nodes,
  activeNodeKey,
  onChange,
}) => {
  const { t } = useTranslation();
  const steps = useMemo(() => buildDeliveryNodeSteps(nodes, activeNodeKey), [nodes, activeNodeKey]);
  const activeNode = nodes.find((n) => n.node_key === activeNodeKey);
  const activeStatus = activeNode?.status ?? 'pending';
  const isException = activeStatus === 'overdue';

  const completedCount = nodes.filter((n) => n.status === 'completed').length;

  return (
    <div className="delivery-project-node-stepper">
      <div className="delivery-project-node-stepper__header">
        <Typography.Text className="delivery-project-node-stepper__title">
          {t('app.kuaizhizao.deliveryProject.workbench.nodeStepper.title')}
        </Typography.Text>
        <div className="delivery-project-node-stepper__header-actions">
          <Typography.Text type="secondary" className="delivery-project-node-stepper__meta">
            {t('app.kuaizhizao.deliveryProject.workbench.nodeStepper.completedCount', {
              completed: completedCount,
              total: nodes.length,
            })}
          </Typography.Text>
          {activeNode ? (
            <>
              {activeNode.is_milestone ? (
                <MarkerTag variant="filled" color="gold">
                  {t('app.kuaizhizao.deliveryProject.fields.isMilestone')}
                </MarkerTag>
              ) : null}
              <Tag color={resolveNodeStatusColor(activeStatus)}>
                {activeNode.node_name} - {DELIVERY_NODE_STATUS[activeStatus] ?? activeStatus}
              </Tag>
              {activeNode.planned_end_date ? (
                <Typography.Text
                  type={activeStatus === 'overdue' ? 'danger' : 'secondary'}
                  className="delivery-project-node-stepper__meta"
                >
                  {t('app.kuaizhizao.deliveryProject.fields.plannedEndDate')}{' '}
                  {formatBusinessDateOnly(activeNode.planned_end_date)}
                </Typography.Text>
              ) : null}
            </>
          ) : null}
        </div>
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
    </div>
  );
};

export default DeliveryProjectNodeStepper;
