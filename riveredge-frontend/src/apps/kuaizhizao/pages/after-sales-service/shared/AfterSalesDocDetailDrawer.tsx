/**
 * 售后业务单据详情抽屉壳（列表 / 关联嵌套共用）。
 * 单一 DetailDrawerTemplate：加载中遮罩，失败 Result+重试。
 */

import React from 'react';
import { Button, Descriptions, Result } from 'antd';
import { useTranslation } from 'react-i18next';
import type { ProDescriptionsItemProps } from '@ant-design/pro-components';
import {
  DetailDrawerTemplate,
  DRAWER_CONFIG,
  detailDrawerBasicColumn,
  useDetailDrawerDescriptionItems,
} from '../../../../../components/layout-templates';
import { alignDescriptionColumns } from '../../sales-management/shared/documentFieldAlignment';

export type AfterSalesDocDetailDrawerProps<T extends Record<string, any>> = {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  record: T | null;
  placeholder: T;
  columns: ProDescriptionsItemProps<T>[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  extra?: React.ReactNode;
  footer?: React.ReactNode;
  zIndex?: number;
  lines?: React.ReactNode;
  linesTitle?: React.ReactNode;
  collaboration?: React.ReactNode;
  collaborationTitle?: React.ReactNode;
  supplementary?: React.ReactNode;
  supplementaryTitle?: React.ReactNode;
  timeline?: React.ReactNode;
  timelineTitle?: React.ReactNode;
  traceDocumentType?: string;
  timeFieldDocumentType?: string;
};

export function AfterSalesDocDetailDrawer<T extends Record<string, any>>({
  open,
  onClose,
  title,
  record,
  placeholder,
  columns,
  loading = false,
  error = null,
  onRetry,
  extra,
  footer,
  zIndex,
  lines,
  linesTitle,
  collaboration,
  collaborationTitle,
  supplementary,
  supplementaryTitle,
  timeline,
  timelineTitle,
  traceDocumentType,
  timeFieldDocumentType,
}: AfterSalesDocDetailDrawerProps<T>) {
  const { t } = useTranslation();

  const contentReady = Boolean(record);
  const showError = Boolean(error) && !contentReady && !loading;
  const showLoading = loading || (!contentReady && !showError);
  const effective = record ?? placeholder;
  const alignedColumns = alignDescriptionColumns(
    columns as ProDescriptionsItemProps<Record<string, unknown>>[],
  );
  const basicItems = useDetailDrawerDescriptionItems(
    alignedColumns,
    effective,
    timeFieldDocumentType ?? traceDocumentType,
  );

  if (!open) return null;

  return (
    <DetailDrawerTemplate
      title={title}
      open={open}
      onClose={onClose}
      width={DRAWER_CONFIG.HALF_WIDTH}
      zIndex={zIndex}
      loading={showLoading}
      footer={contentReady ? footer : undefined}
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
        contentReady ? (
          <Descriptions
            column={detailDrawerBasicColumn(false)}
            size="small"
            items={basicItems}
          />
        ) : showError ? null : (
          <div style={{ minHeight: 80 }} />
        )
      }
      collaborationTitle={collaborationTitle}
      collaboration={contentReady ? collaboration : undefined}
      supplementaryTitle={supplementaryTitle}
      supplementary={contentReady ? supplementary : undefined}
      linesTitle={linesTitle}
      lines={contentReady ? lines : undefined}
      timelineTitle={timelineTitle}
      timeline={contentReady ? timeline : undefined}
      traceDocument={
        traceDocumentType && record?.id
          ? { documentType: traceDocumentType, documentId: Number(record.id) }
          : undefined
      }
    />
  );
}
