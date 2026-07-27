import React from 'react';
import type { NavigateFunction } from 'react-router-dom';
import type { ProDescriptionsItemProps } from '@ant-design/pro-components';
import type { TFunction } from 'i18next';
import { Descriptions, Empty, Spin, Typography } from 'antd';
import { UniLifecycleStepper, type LifecycleResult } from '../../../../../components/uni-lifecycle';
import { DocumentTrackingTimelineBody } from '../../../../../components/document-tracking-panel';
import {
  DetailDrawerTemplate,
  DRAWER_CONFIG,
  detailDrawerDescriptionItems,
} from '../../../../../components/layout-templates';
import {
  CustomFieldsDetailSection,
  hasCustomFieldsDetailContent,
} from '../../../../../components/custom-fields';
import { buildMasterDetailDescriptionItems } from '../../../utils/buildMasterDetailDescriptionItems';
import { PerformanceTraceBriefPrimaryActions } from '../PerformanceTraceBriefFooter';
import type { CustomField } from '../../../../../services/customField';
import type { UseDocumentTrackingResult } from '../../../../../components/document-tracking-panel/useDocumentTracking';

export type PerformanceConfigDetailDrawerProps<T extends Record<string, any>> = {
  title: string;
  open: boolean;
  loading?: boolean;
  onClose: () => void;
  zIndex?: number;
  detail: T | null;
  detailColumns: ProDescriptionsItemProps<T>[];
  /** 使用 detailDrawerDescriptionItems（camelCase 字段）；默认 buildMasterDetailDescriptionItems */
  useSiteDateFormat?: boolean;
  basicColumn?: number;
  documentType?: string;
  detailId?: number | null;
  lifecycleResolver?: (detail: T, t: TFunction) => LifecycleResult;
  tracking?: UseDocumentTrackingResult;
  customFields?: CustomField[];
  customFieldValues?: Record<string, unknown>;
  lines?: React.ReactNode;
  linesTitle?: React.ReactNode;
  linesVisible?: boolean;
  showEmptyDetailPlaceholder?: boolean;
  t: TFunction;
  navigate?: NavigateFunction;
};

export function PerformanceConfigDetailDrawer<T extends Record<string, any>>({
  title,
  open,
  loading,
  onClose,
  zIndex,
  detail,
  detailColumns,
  useSiteDateFormat = true,
  basicColumn = 2,
  documentType,
  detailId,
  lifecycleResolver,
  tracking,
  customFields,
  customFieldValues,
  lines,
  linesTitle,
  linesVisible,
  showEmptyDetailPlaceholder = false,
  t,
  navigate,
}: PerformanceConfigDetailDrawerProps<T>) {
  const basicItems = detail
    ? useSiteDateFormat
      ? buildMasterDetailDescriptionItems(detail, detailColumns)
      : detailDrawerDescriptionItems(detailColumns, detail)
    : undefined;

  const hasLifecycle = Boolean(documentType && detailId != null && lifecycleResolver && detail);
  const hasCustomFields = hasCustomFieldsDetailContent(customFields ?? [], customFieldValues ?? {});
  const hasTracking = Boolean(tracking);

  return (
    <DetailDrawerTemplate
      title={title}
      open={open}
      zIndex={zIndex}
      onClose={onClose}
      width={DRAWER_CONFIG.HALF_WIDTH}
      loading={loading}
      basicTitle={t('app.kuaizhizao.performance.common.sections.basicInfo')}
      basic={
        detail && basicItems ? (
          <Descriptions column={basicColumn} size="small" items={basicItems} />
        ) : undefined
      }
      supplementary={
        hasCustomFields ? (
          <CustomFieldsDetailSection customFields={customFields!} customFieldValues={customFieldValues!} />
        ) : showEmptyDetailPlaceholder ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('app.kuaizhizao.performance.common.empty.noDetailLines')} />
        ) : undefined
      }
      supplementaryTitle={
        hasCustomFields
          ? t('app.master-data.customFields')
          : showEmptyDetailPlaceholder
            ? t('app.kuaizhizao.performance.common.sections.detailInfo')
            : undefined
      }
      supplementaryVisible={hasCustomFields || showEmptyDetailPlaceholder}
      collaborationTitle={t('app.kuaizhizao.performance.common.sections.lifecycle')}
      collaborationLifecycle={
        hasLifecycle && detail ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {(() => {
              const lc = lifecycleResolver!(detail, t);
              const mainStages = lc.mainStages ?? [];
              if (mainStages.length === 0) return null;
              return (
                <UniLifecycleStepper
                  steps={mainStages}
                  showLabels
                  status={lc.status}
                  nextStepSuggestions={lc.nextStepSuggestions}
                  hideNextStepSuggestions
                />
              );
            })()}
          </div>
        ) : undefined
      }
      traceDocument={
        documentType && detailId != null
          ? {
              documentType,
              documentId: detailId,
              selfDocumentId: detailId,
              renderBriefActions: (doc) =>
                navigate ? (
                  <PerformanceTraceBriefPrimaryActions
                    doc={doc}
                    t={t}
                    navigate={navigate}
                    closeDrawer={onClose}
                  />
                ) : null,
            }
          : undefined
      }
      lines={lines}
      linesTitle={linesTitle}
      linesVisible={linesVisible}
      timeline={
        hasTracking ? (
          tracking!.loading ? (
            <div style={{ textAlign: 'center', padding: 24 }}>
              <Spin />
            </div>
          ) : tracking!.error ? (
            <Typography.Text type="danger">{tracking!.error}</Typography.Text>
          ) : tracking!.data ? (
            <DocumentTrackingTimelineBody data={tracking!.data} />
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('app.kuaizhizao.performance.common.empty.noActivityLog')} />
          )
        ) : undefined
      }
      timelineTitle={t('app.kuaizhizao.performance.common.sections.operationLog')}
      timelineVisible={hasTracking}
    />
  );
}
