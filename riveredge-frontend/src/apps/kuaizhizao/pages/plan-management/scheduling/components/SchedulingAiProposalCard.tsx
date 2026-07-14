/**
 * 可视排产 AI · 改期提案卡片
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Descriptions, Space, Tag, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import type { WorkOrderForGantt } from '../../../../components/GanttSchedulingChart/types';
import type { SchedulingAiProposal } from '../../../../services/scheduling-ai';
import { WorkOrderScoreCell } from '../../../../components/WorkOrderScoreCell';
import SimulationSchedulingScorePreview, {
  type SchedulingScorePreviewData,
} from '../../../../../../components/SimulationSchedulingScorePreview';
import { productionControlApi } from '../../../../services/production';

const I18N = 'app.kuaizhizao.scheduling.aiAssist';

export interface SchedulingAiProposalCardProps {
  proposal: SchedulingAiProposal;
  workOrders?: WorkOrderForGantt[];
  applying?: boolean;
  canApply?: boolean;
  onApply?: () => void;
}

function formatDateRange(start?: string | null, end?: string | null): string {
  if (!start && !end) return '—';
  if (start && end) return `${start} → ${end}`;
  return start || end || '—';
}

export function SchedulingAiProposalCard({
  proposal,
  workOrders = [],
  applying,
  canApply,
  onApply,
}: SchedulingAiProposalCardProps) {
  const { t } = useTranslation();
  const [scorePreview, setScorePreview] = useState<SchedulingScorePreviewData | null>(null);
  const [scoreLoading, setScoreLoading] = useState(false);

  const workOrderById = useMemo(() => {
    const map = new Map<number, WorkOrderForGantt>();
    workOrders.forEach((wo) => map.set(wo.id, wo));
    return map;
  }, [workOrders]);

  const primaryWoAdjustment = proposal.workOrderAdjustments?.[0];

  useEffect(() => {
    let cancelled = false;
    const woAdj = primaryWoAdjustment;
    if (!woAdj?.workOrderId || !woAdj.plannedStartDate || !woAdj.plannedEndDate) {
      setScorePreview(null);
      return undefined;
    }
    const wo = workOrderById.get(woAdj.workOrderId);
    const productId = (wo as { product_id?: number } | undefined)?.product_id;
    if (!productId) {
      setScorePreview(null);
      return undefined;
    }

    setScoreLoading(true);
    productionControlApi
      .simulateImpact({
        product_id: productId,
        quantity: wo?.quantity ?? 1,
        planned_start_date: woAdj.plannedStartDate,
        planned_end_date: woAdj.plannedEndDate,
        priority: wo?.priority || 'normal',
        workshop_id: (wo as { workshop_id?: number } | undefined)?.workshop_id,
        work_center_id: wo?.work_center_id ?? undefined,
      })
      .then((res: { scheduling_score_preview?: SchedulingScorePreviewData | null }) => {
        if (cancelled) return;
        setScorePreview(res?.scheduling_score_preview ?? null);
      })
      .catch(() => {
        if (!cancelled) setScorePreview(null);
      })
      .finally(() => {
        if (!cancelled) setScoreLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [primaryWoAdjustment, workOrderById]);

  const woRows = (proposal.workOrderAdjustments ?? []).map((adj) => {
    const wo = workOrderById.get(adj.workOrderId);
    return {
      key: `wo-${adj.workOrderId}`,
      code: wo?.code || `#${adj.workOrderId}`,
      before: formatDateRange(wo?.planned_start_date, wo?.planned_end_date),
      after: formatDateRange(adj.plannedStartDate, adj.plannedEndDate),
      score: wo?.scheduling_score,
    };
  });

  const opRows = (proposal.operationAdjustments ?? []).map((adj) => ({
    key: `op-${adj.operationId}`,
    id: adj.operationId,
    dates: formatDateRange(adj.plannedStartDate, adj.plannedEndDate),
    station: adj.assignedStationId ? `#${adj.assignedStationId}` : null,
  }));

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      {proposal.summary ? (
        <Typography.Paragraph style={{ marginBottom: 0 }}>{proposal.summary}</Typography.Paragraph>
      ) : null}
      {proposal.confidenceNotes ? (
        <Alert type="info" showIcon message={t(`${I18N}.confidenceNotes`)} description={proposal.confidenceNotes} />
      ) : null}
      {(proposal.warnings ?? []).map((w, i) => (
        <Alert key={`${i}-${w}`} type="warning" showIcon message={w} />
      ))}
      {proposal.validationPreview ? (
        <Alert
          type={proposal.validationPreview.valid ? 'success' : 'error'}
          showIcon
          message={
            proposal.validationPreview.valid
              ? t(`${I18N}.validationPassed`)
              : t(`${I18N}.validationFailed`, { count: proposal.validationPreview.conflictCount })
          }
        />
      ) : null}
      {woRows.length > 0 ? (
        <Descriptions size="small" column={1} bordered title={t(`${I18N}.workOrderAdjustments`)}>
          {woRows.map((row) => (
            <Descriptions.Item key={row.key} label={row.code}>
              <Space direction="vertical" size={4}>
                <Typography.Text delete type="secondary">
                  {row.before}
                </Typography.Text>
                <Typography.Text>{row.after}</Typography.Text>
                {row.score != null ? <WorkOrderScoreCell score={row.score} /> : null}
              </Space>
            </Descriptions.Item>
          ))}
        </Descriptions>
      ) : null}
      {opRows.length > 0 ? (
        <Descriptions size="small" column={1} bordered title={t(`${I18N}.operationAdjustments`)}>
          {opRows.map((row) => (
            <Descriptions.Item key={row.key} label={`#${row.id}`}>
              <Space wrap>
                <span>{row.dates}</span>
                {row.station ? <Tag>{t(`${I18N}.station`)} {row.station}</Tag> : null}
              </Space>
            </Descriptions.Item>
          ))}
        </Descriptions>
      ) : null}
      {(proposal.poolReorder ?? []).length > 0 ? (
        <div>
          <Typography.Text type="secondary">{t(`${I18N}.poolReorder`)}</Typography.Text>
          <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {(proposal.poolReorder ?? []).map((id, index) => (
              <Tag key={id}>{index + 1}. {workOrderById.get(id)?.code || `#${id}`}</Tag>
            ))}
          </div>
        </div>
      ) : null}
      {scoreLoading ? (
        <Typography.Text type="secondary">{t(`${I18N}.scorePreviewLoading`)}</Typography.Text>
      ) : (
        <SimulationSchedulingScorePreview preview={scorePreview} compact />
      )}
      {canApply && onApply ? (
        <Button type="primary" loading={applying} onClick={onApply}>
          {t(`${I18N}.loadDraft`)}
        </Button>
      ) : null}
    </Space>
  );
}
