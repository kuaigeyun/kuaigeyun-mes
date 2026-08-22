/**
 * 工艺/设计数据基础资料详情抽屉。
 * STANDARD_WIDTH、2 列、MASTER_DATA rank；无全链路。
 */

import React from 'react';
import { Button, Descriptions, Result } from 'antd';
import { useTranslation } from 'react-i18next';
import type { ProDescriptionsItemProps } from '@ant-design/pro-components';
import {
  DetailDrawerTemplate,
  DRAWER_CONFIG,
  detailDrawerDescriptionItems,
} from '../../../../../components/layout-templates';
import {
  CustomFieldsDetailSection,
  hasCustomFieldsDetailContent,
} from '../../../../../components/custom-fields';
import type { CustomField } from '../../../../../services/customField';
import {
  alignDescriptionColumns,
  MASTER_DATA_DETAIL_BASIC_FIELD_RANK,
} from '../../../../kuaizhizao/pages/sales-management/shared/documentFieldAlignment';

export type ProcessMasterDetailDrawerProps<T extends Record<string, any>> = {
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
  basicExtra?: React.ReactNode;
  customFields?: CustomField[];
  customFieldValues?: Record<string, unknown>;
  supplementaryTitle?: string;
  supplementary?: React.ReactNode;
  linesTitle?: string;
  lines?: React.ReactNode;
  /** 基本信息 Descriptions 列数，默认 2 */
  basicColumn?: 1 | 2;
};

export function ProcessMasterDetailDrawer<T extends Record<string, any>>({
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
  basicExtra,
  customFields,
  customFieldValues,
  supplementaryTitle,
  supplementary,
  linesTitle,
  lines,
  basicColumn = 2,
}: ProcessMasterDetailDrawerProps<T>) {
  const { t } = useTranslation();

  const contentReady = Boolean(detail);
  const showError = Boolean(error) && !contentReady && !loading;
  const showLoading = loading || (!contentReady && !showError);
  const aligned = alignDescriptionColumns(
    detailColumns as ProDescriptionsItemProps<Record<string, unknown>>[],
    MASTER_DATA_DETAIL_BASIC_FIELD_RANK,
  );
  const hasCustomFields = hasCustomFieldsDetailContent(customFields ?? [], customFieldValues ?? {});
  const customSection =
    contentReady && hasCustomFields ? (
      <CustomFieldsDetailSection customFields={customFields!} customFieldValues={customFieldValues!} />
    ) : null;
  const userSupplementary = contentReady ? supplementary : undefined;
  const mergedSupplementary =
    userSupplementary || customSection ? (
      <>
        {userSupplementary}
        {customSection}
      </>
    ) : undefined;
  const mergedSupplementaryTitle =
    supplementaryTitle ?? (hasCustomFields && !userSupplementary ? t('app.master-data.customFields') : undefined);

  if (!open) return null;

  return (
    <DetailDrawerTemplate
      title={title}
      open={open}
      zIndex={zIndex}
      onClose={onClose}
      width={DRAWER_CONFIG.STANDARD_WIDTH}
      loading={showLoading}
      extra={contentReady ? extra ?? null : null}
      basicExtra={contentReady ? basicExtra : undefined}
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
            column={basicColumn}
            size="small"
            items={detailDrawerDescriptionItems(aligned, detail)}
          />
        ) : showError ? null : (
          <div style={{ minHeight: 80 }} />
        )
      }
      supplementaryTitle={mergedSupplementaryTitle}
      supplementary={mergedSupplementary}
      linesTitle={contentReady ? linesTitle : undefined}
      lines={contentReady ? lines : undefined}
    />
  );
}
