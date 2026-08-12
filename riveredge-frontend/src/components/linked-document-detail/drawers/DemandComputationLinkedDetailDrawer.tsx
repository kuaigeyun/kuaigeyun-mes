/**
 * 关联单据：需求计算原版详情（只读插槽壳）
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Descriptions, Spin, Table, Tag, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { DetailDrawerTemplate, DRAWER_CONFIG } from '../../layout-templates';
import { DocumentTrackingTimelineBody, useDocumentTracking } from '../../document-tracking-panel';
import { UniLifecycleStepper } from '../../uni-lifecycle';
import {
  getDemandComputation,
  type DemandComputation,
} from '../../../apps/kuaizhizao/services/demand-computation';
import { getDemandComputationLifecycle } from '../../../apps/kuaizhizao/utils/demandComputationLifecycle';
import { getDemandBusinessModeLabel } from '../../../apps/kuaizhizao/utils/businessMode';
import { getDemandTypeLabel } from '../../../apps/kuaizhizao/utils/demandType';
import { formatDateTime, formatQuantity } from '../../../utils/format';
import { DemandComputationSourceCode } from '../../linked-document-code/DemandComputationSourceCode';

export type DemandComputationLinkedDetailDrawerProps = {
  open: boolean;
  documentId: number;
  onClose: () => void;
  zIndex?: number;
};

export function DemandComputationLinkedDetailDrawer({
  open,
  documentId,
  onClose,
  zIndex,
}: DemandComputationLinkedDetailDrawerProps) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [detail, setDetail] = useState<DemandComputation | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshKey] = useState(0);

  const load = useCallback(async () => {
    if (!open || documentId <= 0) {
      setDetail(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setDetail(await getDemandComputation(documentId, true));
    } catch (e: unknown) {
      const err = e as { message?: string; detail?: string };
      message.error(err?.message || err?.detail || t('common.loadFailed'));
      onClose();
    } finally {
      setLoading(false);
    }
  }, [open, documentId, message, onClose, t]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const lifecycle = useMemo(
    () => (detail ? getDemandComputationLifecycle(detail, t) : null),
    [detail, t],
  );
  const nextSteps = lifecycle?.nextStepSuggestions;
  const tracking = useDocumentTracking(
    open && detail?.id ? 'demand_computation' : undefined,
    detail?.id,
    refreshKey,
  );

  const title = detail?.computation_code
    ? `${t('app.kuaizhizao.demandComputation.detailTitle')} - ${detail.computation_code}`
    : t('app.kuaizhizao.demandComputation.detailTitle');

  if (!open) return null;

  if (loading || !detail) {
    return (
      <DetailDrawerTemplate
        title={title}
        open={open}
        onClose={onClose}
        width={DRAWER_CONFIG.HALF_WIDTH}
        zIndex={zIndex}
        plainBody={
          <div style={{ textAlign: 'center', padding: 48 }}>
            <Spin />
          </div>
        }
      />
    );
  }

  return (
    <DetailDrawerTemplate
      title={title}
      open={open}
      onClose={onClose}
      width={DRAWER_CONFIG.HALF_WIDTH}
      zIndex={zIndex}
      collaborationTitleSuffix={
        nextSteps?.length ? (
          <Typography.Text type="secondary" style={{ fontSize: 13, fontWeight: 400 }}>
            {t('components.uniLifecycle.nextStep')}：
            {nextSteps.join(t('components.uniLifecycle.nextStepSeparator'))}
          </Typography.Text>
        ) : undefined
      }
      collaborationAuditRecord={detail as any}
      collaborationLifecycle={
        lifecycle ? (
          <UniLifecycleStepper
            steps={lifecycle.mainStages ?? []}
            status={lifecycle.status}
            showLabels
            nextStepSuggestions={lifecycle.nextStepSuggestions}
            hideNextStepSuggestions={Boolean(nextSteps?.length)}
          />
        ) : undefined
      }
      basic={
        <Descriptions
          column={3}
          size="small"
          items={[
            {
              key: 'computation_code',
              label: t('app.kuaizhizao.demandComputation.colComputationCode'),
              children: detail.computation_code || '-',
            },
            {
              key: 'demand_code',
              label: t('app.kuaizhizao.demandComputation.colSourceNo'),
              children: (
                <DemandComputationSourceCode
                  demandCode={detail.demand_code}
                  demandType={detail.demand_type}
                  demandId={detail.demand_id}
                  demandIds={detail.demand_ids}
                  sourceId={detail.source_id}
                />
              ),
            },
            {
              key: 'demand_type',
              label: t('app.kuaizhizao.demandComputation.colSourceType'),
              children: getDemandTypeLabel(detail.demand_type),
            },
            {
              key: 'business_mode',
              label: t('app.kuaizhizao.demandComputation.colBusinessMode'),
              children: getDemandBusinessModeLabel(detail.business_mode),
            },
            {
              key: 'status',
              label: t('common.status'),
              children: <Tag>{lifecycle?.stageName || detail.computation_status || '-'}</Tag>,
            },
            {
              key: 'start',
              label: t('app.kuaizhizao.demandComputation.colStartTime'),
              children: detail.computation_start_time
                ? formatDateTime(detail.computation_start_time)
                : '-',
            },
          ]}
        />
      }
      lines={
        <Table
          size="small"
          rowKey={(r) => String(r.id ?? r.material_id ?? Math.random())}
          pagination={false}
          scroll={{ x: 960 }}
          dataSource={detail.items ?? []}
          columns={[
            {
              title: t('app.kuaizhizao.salesOrder.materialCode'),
              dataIndex: 'material_code',
              width: 120,
            },
            {
              title: t('app.kuaizhizao.salesOrder.materialName'),
              dataIndex: 'material_name',
              width: 140,
            },
            {
              title: t('app.kuaizhizao.planReports.colRequirementQty'),
              dataIndex: 'required_quantity',
              width: 100,
              align: 'right',
              render: (v) => formatQuantity(v),
            },
            {
              title: t('app.kuaizhizao.demandComputation.colNetRequirement'),
              dataIndex: 'net_requirement',
              width: 100,
              align: 'right',
              render: (v) => formatQuantity(v),
            },
          ]}
        />
      }
      timeline={
        <>
          {tracking.loading ? (
            <div style={{ textAlign: 'center', padding: 24 }}>
              <Spin />
            </div>
          ) : null}
          {tracking.data && !tracking.loading ? <DocumentTrackingTimelineBody data={tracking.data} /> : null}
        </>
      }
      traceDocument={{
        documentType: 'demand_computation',
        documentId: detail.id!,
        selfDocumentId: detail.id!,
      }}
    />
  );
}
