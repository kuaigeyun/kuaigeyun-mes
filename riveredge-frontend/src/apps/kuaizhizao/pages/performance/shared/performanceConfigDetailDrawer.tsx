/**
 * 绩效配置类基础资料详情抽屉（假期 / 班次 / 技能 / 工时单价 / KPI / 员工配置）。
 * STANDARD_WIDTH、2 列、MASTER_DATA rank；无生命周期 / 全链路。
 */

import React from 'react';
import { Button, Descriptions, Result } from 'antd';
import { useTranslation } from 'react-i18next';
import type { ProDescriptionsItemProps } from '@ant-design/pro-components';
import {
  DetailDrawerTemplate,
  DRAWER_CONFIG,
  useDetailDrawerDescriptionItems,
} from '../../../../../components/layout-templates';
import {
  CustomFieldsDetailSection,
  hasCustomFieldsDetailContent,
} from '../../../../../components/custom-fields';
import type { CustomField } from '../../../../../services/customField';
import {
  alignDescriptionColumns,
  MASTER_DATA_DETAIL_BASIC_FIELD_RANK,
} from '../../sales-management/shared/documentFieldAlignment';

export type PerformanceConfigDetailDrawerProps<T extends Record<string, any>> = {
  title: string;
  open: boolean;
  onClose: () => void;
  zIndex?: number;
  detail: T | null;
  detailColumns: ProDescriptionsItemProps<T>[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  extra?: React.ReactNode;
  customFields?: CustomField[];
  customFieldValues?: Record<string, unknown>;
};

export function PerformanceConfigDetailDrawer<T extends Record<string, any>>({
  title,
  open,
  onClose,
  zIndex,
  detail,
  detailColumns,
  loading = false,
  error = null,
  onRetry,
  extra,
  customFields,
  customFieldValues,
}: PerformanceConfigDetailDrawerProps<T>) {
  const { t } = useTranslation();

  const contentReady = Boolean(detail);
  const showError = Boolean(error) && !contentReady && !loading;
  const showLoading = loading || (!contentReady && !showError);
  const aligned = alignDescriptionColumns(
    detailColumns as ProDescriptionsItemProps<Record<string, unknown>>[],
    MASTER_DATA_DETAIL_BASIC_FIELD_RANK,
  );
  const hasCustomFields = hasCustomFieldsDetailContent(customFields ?? [], customFieldValues ?? {});

  const timeconfigBasicItems = useDetailDrawerDescriptionItems(
    aligned, detail
  );

  if (!open) return null;

  return (
    <DetailDrawerTemplate
      title={title}
      open={open}
      zIndex={zIndex}
      onClose={onClose}
      size={DRAWER_CONFIG.STANDARD_WIDTH}
      loading={showLoading}
      extra={contentReady ? extra ?? null : null}
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
      basic={
        contentReady && detail ? (
          <Descriptions
            column={2}
            size="small"
            items={timeconfigBasicItems}
          />
        ) : showError ? null : (
          <div style={{ minHeight: 80 }} />
        )
      }
      supplementaryTitle={hasCustomFields ? t('app.master-data.customFields') : undefined}
      supplementary={
        contentReady && hasCustomFields ? (
          <CustomFieldsDetailSection customFields={customFields!} customFieldValues={customFieldValues!} />
        ) : undefined
      }
    />
  );
}
