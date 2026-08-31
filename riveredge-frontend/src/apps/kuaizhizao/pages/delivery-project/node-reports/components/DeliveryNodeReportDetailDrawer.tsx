/**
 * 交付节点汇报详情抽屉
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Button, Descriptions, Modal, Result, Space, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import type { ProDescriptionsItemProps } from '@ant-design/pro-components';
import {
  DetailDrawerTemplate,
  DRAWER_CONFIG,
  detailDrawerBasicColumn,
  useDetailDrawerDescriptionItems,
} from '../../../../../../components/layout-templates';
import { alignDescriptionColumns } from '../../../sales-management/shared/documentFieldAlignment';
import { renderDeliveryProgressCell, resolveDeliveryProgressStatus } from '../../shared/deliveryProgressColumn';
import { renderDeliveryStatusTag } from '../../shared/deliveryListPresentation';
import { formatBusinessDateOnly } from '../../../../../../utils/format';
import {
  deliveryNodeReportApi,
  DELIVERY_NODE_REPORT_STATUS,
  type DeliveryNodeReport,
} from '../../../../services/delivery-project';

const PLACEHOLDER: DeliveryNodeReport = {
  id: 0,
  report_code: '',
  project_id: 0,
  project_code: '',
  node_id: 0,
  node_key: '',
  node_name: '',
  report_date: '',
  progress_percent: 0,
  status: 'draft',
};

export type DeliveryNodeReportDetailDrawerProps = {
  open: boolean;
  reportId?: number | null;
  onClose: () => void;
  onChanged?: () => void;
  canUpdate?: boolean;
  canDelete?: boolean;
  canApprove?: boolean;
  onEdit?: (report: DeliveryNodeReport) => void;
  zIndex?: number;
};

export const DeliveryNodeReportDetailDrawer: React.FC<DeliveryNodeReportDetailDrawerProps> = ({
  open,
  reportId,
  onClose,
  onChanged,
  canUpdate = false,
  canDelete = false,
  canApprove = false,
  onEdit,
  zIndex,
}) => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<DeliveryNodeReport | null>(null);

  const load = useCallback(async () => {
    if (!reportId) return;
    setLoading(true);
    setError(null);
    try {
      const detail = await deliveryNodeReportApi.get(reportId);
      setReport(detail);
    } catch (e: unknown) {
      setError((e as Error)?.message ?? t('common.loadFailed'));
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [reportId, t]);

  useEffect(() => {
    if (open && reportId) void load();
    if (!open) {
      setReport(null);
      setError(null);
    }
  }, [open, reportId, load]);

  const runAction = async (action: () => Promise<DeliveryNodeReport>, successKey: string) => {
    try {
      const updated = await action();
      setReport(updated);
      message.success(t(successKey));
      onChanged?.();
    } catch (e: unknown) {
      message.error((e as Error)?.message ?? t('common.operationFailed'));
    }
  };

  const handleDelete = () => {
    if (!reportId) return;
    Modal.confirm({
      title: t('app.kuaizhizao.deliveryProject.deleteReportConfirm'),
      onOk: async () => {
        try {
          await deliveryNodeReportApi.delete(reportId);
          message.success(t('common.deleted'));
          onChanged?.();
          onClose();
        } catch (e: unknown) {
          message.error((e as Error)?.message ?? t('common.operationFailed'));
        }
      },
    });
  };

  const contentReady = Boolean(report);
  const showError = Boolean(error) && !contentReady && !loading;
  const showLoading = loading || (!contentReady && !showError);
  const effective = report ?? PLACEHOLDER;

  const columns = useMemo(
    () =>
      alignDescriptionColumns([
        { title: t('app.kuaizhizao.deliveryProject.fields.reportCode'), dataIndex: 'report_code' },
        { title: t('app.kuaizhizao.deliveryProject.fields.projectCode'), dataIndex: 'project_code' },
        { title: t('app.kuaizhizao.deliveryProject.fields.nodeName'), dataIndex: 'node_name' },
        { title: t('app.kuaizhizao.deliveryProject.fields.reporterName'), dataIndex: 'reporter_name' },
        {
          title: t('app.kuaizhizao.deliveryProject.fields.reportDate'),
          dataIndex: 'report_date',
          render: (_, row) => formatBusinessDateOnly((row as DeliveryNodeReport).report_date),
        },
        {
          title: t('app.kuaizhizao.deliveryProject.fields.progress'),
          dataIndex: 'progress_percent',
          render: (_, row) => {
            const r = row as DeliveryNodeReport;
            return renderDeliveryProgressCell(r.progress_percent, t, {
              status: resolveDeliveryProgressStatus(r.status, r.progress_percent),
              width: 240,
            });
          },
        },
        {
          title: t('app.kuaizhizao.deliveryProject.fields.status'),
          dataIndex: 'status',
          render: (_, row) =>
            renderDeliveryStatusTag((row as DeliveryNodeReport).status, DELIVERY_NODE_REPORT_STATUS),
        },
        { title: t('app.kuaizhizao.deliveryProject.fields.reviewerName'), dataIndex: 'reviewer_name' },
        {
          title: t('app.kuaizhizao.deliveryProject.fields.reviewNotes'),
          dataIndex: 'review_notes',
          span: 3,
        },
        {
          title: t('app.kuaizhizao.deliveryProject.fields.reportContent'),
          dataIndex: 'content',
          span: 3,
        },
      ] as ProDescriptionsItemProps<Record<string, unknown>>[]),
    [t],
  );

  const basicItems = useDetailDrawerDescriptionItems(columns, effective);

  const extra =
    contentReady && (canUpdate || canDelete || canApprove) ? (
      <Space>
        {effective.status === 'draft' && canUpdate && onEdit ? (
          <Button onClick={() => onEdit(effective)}>{t('common.edit')}</Button>
        ) : null}
        {effective.status === 'draft' && canUpdate ? (
          <Button type="primary" onClick={() => void runAction(() => deliveryNodeReportApi.submit(reportId!), 'common.submitted')}>
            {t('common.submit')}
          </Button>
        ) : null}
        {effective.status === 'submitted' && canApprove ? (
          <>
            <Button
              type="primary"
              onClick={() =>
                void runAction(() => deliveryNodeReportApi.review(reportId!, { approved: true }), 'common.approved')
              }
            >
              {t('common.approve')}
            </Button>
            <Button
              danger
              onClick={() =>
                void runAction(
                  () => deliveryNodeReportApi.review(reportId!, { approved: false }),
                  'app.kuaizhizao.deliveryProject.reportRejected',
                )
              }
            >
              {t('common.reject')}
            </Button>
          </>
        ) : null}
        {effective.status === 'draft' && canDelete ? (
          <Button danger onClick={handleDelete}>
            {t('common.delete')}
          </Button>
        ) : null}
      </Space>
    ) : null;

  if (!open) return null;

  return (
    <DetailDrawerTemplate
      title={
        <Space direction="vertical" size={0}>
          <Typography.Text strong>{effective.report_code || '-'}</Typography.Text>
          <Typography.Text type="secondary">{effective.node_name || '-'}</Typography.Text>
        </Space>
      }
      open={open}
      onClose={onClose}
      width={DRAWER_CONFIG.STANDARD_WIDTH}
      zIndex={zIndex}
      loading={showLoading}
      extra={extra}
      plainBody={
        showError ? (
          <Result
            status="error"
            title={error}
            extra={
              <Button type="primary" onClick={() => void load()}>
                {t('common.retry')}
              </Button>
            }
          />
        ) : undefined
      }
      basic={
        contentReady ? (
          <Descriptions column={detailDrawerBasicColumn(false)} size="small" items={basicItems} />
        ) : showError ? null : (
          <div style={{ minHeight: 80 }} />
        )
      }
    />
  );
};

export default DeliveryNodeReportDetailDrawer;
