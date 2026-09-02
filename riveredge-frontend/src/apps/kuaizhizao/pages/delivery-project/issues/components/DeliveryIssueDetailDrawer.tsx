/**
 * 交付项目问题详情抽屉
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
import { renderDeliveryIssuePriorityTag, renderDeliveryIssueTypeTag, renderDeliveryStatusTag } from '../../shared/deliveryListPresentation';
import { formatBusinessDateOnly } from '../../../../../../utils/format';
import {
  deliveryIssueApi,
  DELIVERY_ISSUE_STATUS,
  type DeliveryIssue,
} from '../../../../services/delivery-project';

const PLACEHOLDER: DeliveryIssue = {
  id: 0,
  issue_code: '',
  project_id: 0,
  project_code: '',
  issue_type: 'other',
  priority: 'normal',
  status: 'open',
  title: '',
};

export type DeliveryIssueDetailDrawerProps = {
  open: boolean;
  issueId?: number | null;
  onClose: () => void;
  onChanged?: () => void;
  canUpdate?: boolean;
  canDelete?: boolean;
  onEdit?: (issue: DeliveryIssue) => void;
  zIndex?: number;
};

export const DeliveryIssueDetailDrawer: React.FC<DeliveryIssueDetailDrawerProps> = ({
  open,
  issueId,
  onClose,
  onChanged,
  canUpdate = false,
  canDelete = false,
  onEdit,
  zIndex,
}) => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issue, setIssue] = useState<DeliveryIssue | null>(null);

  const load = useCallback(async () => {
    if (!issueId) return;
    setLoading(true);
    setError(null);
    try {
      const detail = await deliveryIssueApi.get(issueId);
      setIssue(detail);
    } catch (e: unknown) {
      setError((e as Error)?.message ?? t('common.loadFailed'));
      setIssue(null);
    } finally {
      setLoading(false);
    }
  }, [issueId, t]);

  useEffect(() => {
    if (open && issueId) void load();
    if (!open) {
      setIssue(null);
      setError(null);
    }
  }, [open, issueId, load]);

  const updateStatus = async (status: string, successKey: string) => {
    if (!issueId) return;
    try {
      const updated = await deliveryIssueApi.update(issueId, { status });
      setIssue(updated);
      message.success(t(successKey));
      onChanged?.();
    } catch (e: unknown) {
      message.error((e as Error)?.message ?? t('common.operationFailed'));
    }
  };

  const handleDelete = () => {
    if (!issueId) return;
    Modal.confirm({
      title: t('app.kuaizhizao.deliveryProject.deleteIssueConfirm'),
      onOk: async () => {
        try {
          await deliveryIssueApi.delete(issueId);
          message.success(t('common.deleted'));
          onChanged?.();
          onClose();
        } catch (e: unknown) {
          message.error((e as Error)?.message ?? t('common.operationFailed'));
        }
      },
    });
  };

  const contentReady = Boolean(issue);
  const showError = Boolean(error) && !contentReady && !loading;
  const showLoading = loading || (!contentReady && !showError);
  const effective = issue ?? PLACEHOLDER;

  const columns = useMemo(
    () =>
      alignDescriptionColumns([
        { title: t('app.kuaizhizao.deliveryProject.fields.issueCode'), dataIndex: 'issue_code' },
        { title: t('app.kuaizhizao.deliveryProject.fields.projectCode'), dataIndex: 'project_code' },
        { title: t('app.kuaizhizao.deliveryProject.fields.nodeName'), dataIndex: 'node_name' },
        { title: t('app.kuaizhizao.deliveryProject.fields.title'), dataIndex: 'title', span: 3 },
        {
          title: t('app.kuaizhizao.deliveryProject.fields.issueType'),
          dataIndex: 'issue_type',
          render: (_, row) => renderDeliveryIssueTypeTag((row as DeliveryIssue).issue_type),
        },
        {
          title: t('app.kuaizhizao.deliveryProject.fields.priority'),
          dataIndex: 'priority',
          render: (_, row) =>
            renderDeliveryIssuePriorityTag((row as DeliveryIssue).priority),
        },
        {
          title: t('app.kuaizhizao.deliveryProject.fields.status'),
          dataIndex: 'status',
          render: (_, row) =>
            renderDeliveryStatusTag((row as DeliveryIssue).status, DELIVERY_ISSUE_STATUS),
        },
        { title: t('app.kuaizhizao.deliveryProject.fields.assigneeName'), dataIndex: 'assignee_name' },
        {
          title: t('app.kuaizhizao.deliveryProject.fields.dueDate'),
          dataIndex: 'due_date',
          render: (_, row) => formatBusinessDateOnly((row as DeliveryIssue).due_date),
        },
        {
          title: t('app.kuaizhizao.deliveryProject.fields.description'),
          dataIndex: 'description',
          span: 3,
        },
        {
          title: t('app.kuaizhizao.deliveryProject.fields.resolution'),
          dataIndex: 'resolution',
          span: 3,
        },
      ] as ProDescriptionsItemProps<Record<string, unknown>>[]),
    [t],
  );

  const basicItems = useDetailDrawerDescriptionItems(columns, effective);

  const extra =
    contentReady && (canUpdate || canDelete) ? (
      <Space>
        {effective.status === 'open' && canUpdate && onEdit ? (
          <Button onClick={() => onEdit(effective)}>{t('common.edit')}</Button>
        ) : null}
        {effective.status === 'open' && canUpdate ? (
          <Button onClick={() => void updateStatus('in_progress', 'common.updated')}>{t('common.start')}</Button>
        ) : null}
        {['open', 'in_progress'].includes(effective.status) && canUpdate ? (
          <Button type="primary" onClick={() => void updateStatus('resolved', 'app.kuaizhizao.deliveryProject.issueResolved')}>
            {t('app.kuaizhizao.deliveryProject.resolveIssue')}
          </Button>
        ) : null}
        {effective.status === 'resolved' && canUpdate ? (
          <Button onClick={() => void updateStatus('closed', 'app.kuaizhizao.deliveryProject.issueClosed')}>
            {t('common.close')}
          </Button>
        ) : null}
        {effective.status === 'open' && canDelete ? (
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
        <Space orientation="vertical" size={0}>
          <Typography.Text strong>{effective.title || '-'}</Typography.Text>
          <Typography.Text type="secondary" copyable={contentReady ? { text: effective.issue_code } : false}>
            {effective.issue_code}
          </Typography.Text>
        </Space>
      }
      open={open}
      onClose={onClose}
      size={DRAWER_CONFIG.STANDARD_WIDTH}
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

export default DeliveryIssueDetailDrawer;
