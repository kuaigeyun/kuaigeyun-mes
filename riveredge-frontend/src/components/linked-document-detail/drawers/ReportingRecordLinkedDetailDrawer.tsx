/**
 * 关联单据：报工记录只读详情（绩效汇总明细嵌套打开）
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Button, Descriptions, Result } from 'antd';
import { useTranslation } from 'react-i18next';
import type { ProDescriptionsItemProps } from '@ant-design/pro-components';
import {
  DetailDrawerTemplate,
  DRAWER_CONFIG,
  detailDrawerBasicColumn,
  detailDrawerDescriptionItems,
} from '../../layout-templates';
import { LinkedDocumentCode } from '../../linked-document-code';
import { formatDateTimeBySiteSetting } from '../../../utils/format';
import { reportingApi, type ReportingRecord } from '../../../apps/kuaizhizao/services/reporting';
import { buildReportingStatusValueEnum } from '../../../apps/kuaizhizao/utils/reportingLifecycle';

export type ReportingRecordLinkedDetailDrawerProps = {
  open: boolean;
  documentId: number;
  onClose: () => void;
  zIndex?: number;
};

function reportingDisplayCode(record: ReportingRecord): string {
  const op = String(record.operation_code ?? record.operation_name ?? '').trim();
  const id = record.id;
  if (op && id != null) return `${op}-${id}`;
  if (id != null) return `BG${id}`;
  return '-';
}

export function ReportingRecordLinkedDetailDrawer({
  open,
  documentId,
  onClose,
  zIndex,
}: ReportingRecordLinkedDetailDrawerProps) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [detail, setDetail] = useState<ReportingRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const statusEnum = useMemo(() => buildReportingStatusValueEnum(t), [t]);

  const load = useCallback(async () => {
    if (!open || documentId <= 0) {
      setDetail(null);
      setLoadError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    setDetail((prev) => (prev?.id === documentId ? prev : null));
    try {
      const row = (await reportingApi.get(String(documentId))) as ReportingRecord;
      setDetail(row);
    } catch (e: unknown) {
      const err = e as { message?: string; detail?: string };
      const msg = err?.message || err?.detail || t('common.loadFailed');
      setDetail(null);
      setLoadError(msg);
      message.error(msg);
    } finally {
      setLoading(false);
    }
  }, [open, documentId, message, t]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const columns = useMemo(
    () =>
      [
        {
          title: t('app.kuaizhizao.workReporting.colWorkOrderCode'),
          dataIndex: 'work_order_code',
          render: (_, row) => (
            <LinkedDocumentCode
              documentType="work_order"
              documentId={(row as ReportingRecord).work_order_id as number | undefined}
              code={(row as ReportingRecord).work_order_code}
            />
          ),
        },
        { title: t('app.kuaizhizao.workReporting.colOperation'), dataIndex: 'operation_name' },
        { title: t('app.kuaizhizao.workReporting.colWorker'), dataIndex: 'worker_name' },
        { title: t('app.kuaizhizao.workReporting.producerModeTeam'), dataIndex: 'team_name' },
        {
          title: t('app.kuaizhizao.workReporting.colReportedAt'),
          dataIndex: 'reported_at',
          render: (_, row) => {
            const v = (row as ReportingRecord).reported_at;
            return v ? formatDateTimeBySiteSetting(String(v)) : '-';
          },
        },
        {
          title: t('app.kuaizhizao.workReporting.colQualifiedQty'),
          dataIndex: 'qualified_quantity',
          render: (_, row) => String((row as ReportingRecord).qualified_quantity ?? '-'),
        },
        {
          title: t('app.kuaizhizao.workReporting.colWorkHours'),
          dataIndex: 'work_hours',
          render: (_, row) => String((row as ReportingRecord).work_hours ?? '-'),
        },
        {
          title: t('app.kuaizhizao.workReporting.colReviewStatus'),
          dataIndex: 'status',
          render: (_, row) => {
            const status = String((row as ReportingRecord).status ?? '').trim();
            const meta = statusEnum[status];
            if (!status) return '-';
            if (typeof meta === 'object' && meta?.text) return String(meta.text);
            return status;
          },
        },
      ] as ProDescriptionsItemProps<Record<string, unknown>>[],
    [statusEnum, t],
  );

  const title = detail
    ? `${t('app.kuaizhizao.workReporting.detailTitle')} ${reportingDisplayCode(detail)}`
    : t('app.kuaizhizao.workReporting.detailTitle');

  const showError = Boolean(loadError) && !detail && !loading;

  return (
    <DetailDrawerTemplate
      title={title}
      open={open}
      onClose={onClose}
      size={DRAWER_CONFIG.HALF_WIDTH}
      zIndex={zIndex}
      loading={loading}
      plainBody={
        showError ? (
          <Result
            status="error"
            title={loadError}
            extra={
              <Button type="primary" onClick={() => setRefreshKey((k) => k + 1)}>
                {t('common.retry', { defaultValue: '重试' })}
              </Button>
            }
          />
        ) : undefined
      }
      basic={
        detail ? (
          <Descriptions
            column={detailDrawerBasicColumn(false)}
            size="small"
            items={detailDrawerDescriptionItems(columns, detail as unknown as Record<string, unknown>)}
          />
        ) : showError ? null : (
          <div style={{ minHeight: 80 }} />
        )
      }
    />
  );
}
