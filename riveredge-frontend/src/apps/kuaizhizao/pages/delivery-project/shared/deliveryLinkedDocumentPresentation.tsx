import React from 'react';
import type { TFunction } from 'i18next';
import type { ColumnsType } from 'antd/es/table';
import { Button, Popconfirm, Typography } from 'antd';
import { PROJECT_STATUS_LABELS } from '../../../services/kuaiplm-rd-project-api';
import { getReviewStatusLabel, getStatusLabel } from '../../../constants/documentStatus';
import { renderDocumentStatusTag } from '../../../../../utils/documentLifecycleStatusTag';
import { formatBusinessDateOnly } from '../../../../../utils/format';
import { DOCUMENT_PROGRESS_COLUMN_DEFAULTS } from '../../sales-management/shared/DocumentPushProgressBar';
import { renderDeliveryProgressCell, resolveDeliveryProgressStatus } from './deliveryProgressColumn';
import { workbenchKeepWidth, workbenchRemainderFlex } from './deliveryWorkbenchTableLayout';
import {
  DELIVERY_NODE_DOCUMENT_TYPES,
  type DeliveryProjectNodeDocument,
} from '../../../services/delivery-project';

export function resolveLinkedDocumentPartyName(row: DeliveryProjectNodeDocument): string {
  return row.party_name?.trim() || row.title?.trim() || '—';
}

function isPendingOrRejectedReview(reviewStatus: string | undefined, reviewLabel: string): boolean {
  const raw = (reviewStatus ?? '').trim().toUpperCase();
  return (
    raw === 'PENDING' ||
    raw === 'REJECTED' ||
    reviewLabel === '待审核' ||
    reviewLabel === '审核驳回'
  );
}

export function resolveLinkedDocumentStatusLabel(row: DeliveryProjectNodeDocument): string {
  const status = row.status?.trim();
  const reviewStatus = row.review_status?.trim();

  if (row.doc_type === 'rd_project' && status) {
    return PROJECT_STATUS_LABELS[status] ?? getStatusLabel(status);
  }

  const statusLabel = status ? getStatusLabel(status) : '';
  const reviewLabel = reviewStatus ? getReviewStatusLabel(reviewStatus) : '';

  if (reviewStatus && isPendingOrRejectedReview(reviewStatus, reviewLabel) && reviewLabel !== '-') {
    return reviewLabel;
  }
  if (statusLabel && statusLabel !== '-') {
    return statusLabel;
  }
  if (reviewLabel && reviewLabel !== '-') {
    return reviewLabel;
  }
  return '—';
}

export function renderLinkedDocumentStatus(row: DeliveryProjectNodeDocument): React.ReactNode {
  const label = resolveLinkedDocumentStatusLabel(row);
  if (label === '—') return label;
  const raw = row.status?.trim() || row.review_status?.trim() || label;
  return renderDocumentStatusTag(label, raw);
}

export function renderLinkedDocumentProgress(
  row: DeliveryProjectNodeDocument,
  t: TFunction,
): React.ReactNode {
  if (row.progress_percent == null) return '—';
  return renderDeliveryProgressCell(row.progress_percent, t, {
    status: resolveDeliveryProgressStatus(row.status ?? row.review_status, row.progress_percent),
  });
}

type BuildLinkedDocumentColumnsOptions = {
  t: TFunction;
  canUpdate: boolean;
  onOpen: (row: DeliveryProjectNodeDocument) => void;
  onOpenDocTypeList: (docType: string) => void;
  onUnlink: (row: DeliveryProjectNodeDocument) => void;
};

export function buildLinkedDocumentColumns({
  t,
  canUpdate,
  onOpen,
  onOpenDocTypeList,
  onUnlink,
}: BuildLinkedDocumentColumnsOptions): ColumnsType<DeliveryProjectNodeDocument> {
  return [
    {
      title: t('app.kuaizhizao.deliveryProject.fields.docType'),
      dataIndex: 'doc_type',
      key: 'doc_type',
      ...workbenchKeepWidth(88),
      render: (v: string) => {
        const label = DELIVERY_NODE_DOCUMENT_TYPES[v] ?? v;
        return (
          <Button
            type="link"
            size="small"
            style={{ padding: 0, height: 'auto' }}
            onClick={() => onOpenDocTypeList(v)}
          >
            {label}
          </Button>
        );
      },
    },
    {
      title: t('app.kuaizhizao.deliveryProject.fields.docCode'),
      dataIndex: 'doc_code',
      key: 'doc_code',
      ...workbenchKeepWidth(148),
      render: (_: unknown, row: DeliveryProjectNodeDocument) => {
        const text = String(row.doc_code ?? '').trim();
        if (!text) return '—';
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              maxWidth: '100%',
              minWidth: 0,
            }}
          >
            <Typography.Link
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onOpen(row);
              }}
              title={text}
              style={{
                flex: '1 1 auto',
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {text}
            </Typography.Link>
            <Typography.Text
              copyable={{ text, tooltips: true }}
              style={{ flex: '0 0 auto', margin: 0, lineHeight: 1 }}
            />
          </span>
        );
      },
    },
    {
      title: t('app.kuaizhizao.deliveryProject.fields.linkedDocPartyName'),
      dataIndex: 'party_name',
      key: 'party_name',
      ...workbenchRemainderFlex(148),
      render: (_: unknown, row: DeliveryProjectNodeDocument) => (
        <Typography.Text ellipsis={{ tooltip: resolveLinkedDocumentPartyName(row) }}>
          {resolveLinkedDocumentPartyName(row)}
        </Typography.Text>
      ),
    },
    {
      title: t('app.kuaizhizao.deliveryProject.fields.linkedDocDate'),
      dataIndex: 'doc_date',
      key: 'doc_date',
      ...workbenchKeepWidth(96),
      render: (v: string | null | undefined) => formatBusinessDateOnly(v) || '—',
    },
    {
      title: t('app.kuaizhizao.deliveryProject.fields.linkedAt'),
      dataIndex: 'linked_at',
      key: 'linked_at',
      ...workbenchKeepWidth(108),
      render: (v: string | null | undefined, row: DeliveryProjectNodeDocument) =>
        v ? (
          <Typography.Text ellipsis={{ tooltip: row.linked_by_name ? `${v} · ${row.linked_by_name}` : v }}>
            {formatBusinessDateOnly(v) || '—'}
          </Typography.Text>
        ) : (
          '—'
        ),
    },
    {
      title: t('app.kuaizhizao.deliveryProject.fields.linkedDocProgress'),
      dataIndex: 'progress_percent',
      key: 'progress_percent',
      fixed: 'right',
      ...DOCUMENT_PROGRESS_COLUMN_DEFAULTS,
      render: (_: unknown, row: DeliveryProjectNodeDocument) => renderLinkedDocumentProgress(row, t),
    },
    {
      title: t('app.kuaizhizao.deliveryProject.fields.status'),
      dataIndex: 'status',
      key: 'lifecycle',
      fixed: 'right',
      render: (_: unknown, row: DeliveryProjectNodeDocument) => renderLinkedDocumentStatus(row),
    },
    ...(canUpdate
      ? [
          {
            title: t('common.actions'),
            key: 'action',
            fixed: 'right' as const,
            render: (_: unknown, row: DeliveryProjectNodeDocument) => (
              <Popconfirm
                title={t('app.kuaizhizao.deliveryProject.unlinkDocumentConfirm')}
                onConfirm={() => void onUnlink(row)}
              >
                <Button type="link" size="small" danger className="uni-table-operation-actions">
                  {t('app.kuaizhizao.deliveryProject.unlinkDocument')}
                </Button>
              </Popconfirm>
            ),
          },
        ]
      : []),
  ];
}
