/**
 * 检验四单据原版详情抽屉（来料 / 过程 / 成品 / 出货共用插槽壳）。
 * 单一 DetailDrawerTemplate：列表页传入 extra / 列 / 跟踪，不在 customContent 里再砌分区。
 */

import React from 'react';
import { Button, Descriptions, Empty, Result, Spin, Typography } from 'antd';
import type { ProDescriptionsItemProps } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import {
  DetailDrawerTemplate,
  DRAWER_CONFIG,
  useDetailDrawerDescriptionItems,
} from '../../../../../components/layout-templates';
import { UniLifecycleStepper } from '../../../../../components/uni-lifecycle';
import { DocumentTrackingTimelineBody } from '../../../../../components/document-tracking-panel';
import type { UseDocumentTrackingResult } from '../../../../../components/document-tracking-panel/useDocumentTracking';
import { CustomFieldsDetailSection, hasCustomFieldsDetailContent } from '../../../../../components/custom-fields';
import type { CustomField } from '../../../../../services/customField';
import type { AuditPhaseRecord } from '../../../../../components/uni-audit/AuditPhaseBadge';
import { alignDescriptionColumns } from '../../sales-management/shared/documentFieldAlignment';
import { getIncomingInspectionLifecycle } from '../../../utils/incomingInspectionLifecycle';
import InspectionTemplateConductResultsTable from './InspectionTemplateConductResultsTable';

export type QualityInspectionDetailRecord = {
  id?: number;
  inspection_code?: string;
  notes?: string;
  attachments?: unknown[];
  [key: string]: unknown;
};

export type QualityInspectionDetailDrawerProps<T extends QualityInspectionDetailRecord> = {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  inspection: T | null;
  documentType: string;
  zIndex?: number;
  extra?: React.ReactNode;
  banner?: React.ReactNode;
  basicColumns: ProDescriptionsItemProps<T>[];
  customFields?: CustomField[];
  customFieldValues?: Record<string, unknown>;
  tracking?: UseDocumentTrackingResult;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  renderBriefActions?: NonNullable<
    React.ComponentProps<typeof DetailDrawerTemplate>['traceDocument']
  >['renderBriefActions'];
};

export function QualityInspectionDetailDrawer<T extends QualityInspectionDetailRecord>({
  open,
  onClose,
  title,
  inspection,
  documentType,
  zIndex,
  extra,
  banner,
  basicColumns,
  customFields = [],
  customFieldValues,
  tracking,
  loading = false,
  error = null,
  onRetry,
  renderBriefActions,
}: QualityInspectionDetailDrawerProps<T>) {
  const { t } = useTranslation();
  const contentReady = Boolean(inspection);
  const showError = Boolean(error && !contentReady && !loading);
  const lifecycle = inspection
    ? getIncomingInspectionLifecycle(inspection as Record<string, unknown>)
    : null;
  const mainStages = lifecycle?.mainStages ?? [];
  const nextSteps = lifecycle?.nextStepSuggestions;
  const alignedBasic = alignDescriptionColumns(basicColumns);
  const basicItems = useDetailDrawerDescriptionItems(alignedBasic, inspection, 'quality_inspection');
  if (!open) return null;

  return (
    <DetailDrawerTemplate
      title={title}
      open={open}
      onClose={onClose}
      width={DRAWER_CONFIG.HALF_WIDTH}
      zIndex={zIndex}
      extra={contentReady ? extra : null}
      banner={contentReady ? banner : undefined}
      loading={loading && !contentReady}
      plainBody={
        showError ? (
          <Result
            status="error"
            title={error}
            extra={
              onRetry ? (
                <Button type="primary" onClick={onRetry}>
                  {t('common.retry', { defaultValue: '重试' })}
                </Button>
              ) : null
            }
          />
        ) : undefined
      }
      collaborationTitleSuffix={
        contentReady && nextSteps && nextSteps.length > 0 ? (
          <Typography.Text type="secondary" style={{ fontSize: 13, fontWeight: 400 }}>
            {t('common.next')}：
            {nextSteps.join(t('components.uniLifecycle.nextStepSeparator'))}
          </Typography.Text>
        ) : undefined
      }
      collaborationAuditRecord={contentReady ? (inspection as AuditPhaseRecord) : null}
      basic={
        contentReady && inspection ? (
          <>
            <Descriptions
              column={3}
              size="small"
              items={basicItems}
            />
            {hasCustomFieldsDetailContent(customFields, customFieldValues) ? (
              <div style={{ marginTop: 16 }}>
                <CustomFieldsDetailSection
                  customFields={customFields}
                  customFieldValues={customFieldValues}
                />
              </div>
            ) : null}
          </>
        ) : showError ? null : (
          <div style={{ minHeight: 80 }} />
        )
      }
      collaboration={
        contentReady && mainStages.length > 0 ? (
          <UniLifecycleStepper
            steps={mainStages}
            showLabels
            status={lifecycle?.status}
            nextStepSuggestions={nextSteps}
            hideNextStepSuggestions
          />
        ) : null
      }
      linesTitle={t('app.kuaizhizao.quality.common.sections.detailInfo')}
      lines={
        contentReady && inspection ? (
          <InspectionTemplateConductResultsTable inspection={inspection as Record<string, unknown>} />
        ) : null
      }
      timelineTitle={t('app.kuaizhizao.quality.common.sections.operationLog')}
      timeline={
        contentReady && tracking ? (
          tracking.loading ? (
            <div style={{ textAlign: 'center', padding: 24 }}>
              <Spin />
            </div>
          ) : tracking.error ? (
            <Typography.Text type="danger">{tracking.error}</Typography.Text>
          ) : tracking.data ? (
            <DocumentTrackingTimelineBody data={tracking.data} />
          ) : (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={t('app.kuaizhizao.quality.common.empty.noActivityLog')}
            />
          )
        ) : null
      }
      traceDocument={
        contentReady && inspection?.id != null
          ? {
              documentType,
              documentId: inspection.id,
              selfDocumentId: inspection.id,
              renderBriefActions,
            }
          : undefined
      }
    />
  );
}
