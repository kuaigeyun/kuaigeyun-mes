/**
 * 从收货通知取单开采购入库 — 独立 Tab 页（预览 → 建单 → 回 Hub 确认）
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Alert, App, Button, Card, Descriptions, Space, Spin, Table, Typography } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import {
  DOCUMENT_DETAIL_PAGE_TITLE_STYLE,
  DocumentFormPageLayout,
  PAGE_SPACING,
} from '../../../../../components/layout-templates';
import {
  receiptNoticeApi,
  type ReceiptNotice,
  type ReceiptNoticeNotifyPreviewResponse,
} from '../../../services/receipt-notice';
import { useInvalidateMenuBadgeCounts } from '../../../../../hooks/useInvalidateMenuBadgeCounts';
import { setCustomPageTitle, removeCustomPageTitle } from '../../../../../utils/customPageTitle';
import { formatQuantity } from '../../../../../utils/format';
import { INBOUND_LIST_PATH, inboundReceiptNoticeEntryPath } from './inboundPaths';
import { navigateLeavingPullEntry, pullEntryTabKey } from '../shared/pullEntryCloseTab';
import { resolveKuaizhizaoDocumentAction } from '../../../constants/documentActionRegistry';
import { receiptNoticeCapabilityReasonMessage } from '../../../../../hooks/useDocumentCapabilities';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';

const InboundReceiptNoticePullEntryPage: React.FC = () => {
  const { noticeId: noticeIdParam } = useParams<{ noticeId: string }>();
  const noticeId = Number(noticeIdParam);
  const navigate = useNavigate();
  const location = useLocation();
  const { message: messageApi } = App.useApp();
  const { t } = useTranslation();
  const pullFromReceiptNoticeAction = resolveKuaizhizaoDocumentAction(
    t,
    'purchase_receipt.pull_from_receipt_notice',
  );
  const invalidateMenuBadgeCounts = useInvalidateMenuBadgeCounts();
  const initRef = useRef(false);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<ReceiptNotice | null>(null);
  const [preview, setPreview] = useState<ReceiptNoticeNotifyPreviewResponse | null>(null);

  const pagePath =
    Number.isFinite(noticeId) && noticeId > 0 ? inboundReceiptNoticeEntryPath(noticeId) : INBOUND_LIST_PATH;
  const pageTitle = notice?.notice_code
    ? `${pullFromReceiptNoticeAction.label} — ${notice.notice_code}`
    : pullFromReceiptNoticeAction.label;

  const leavePage = useCallback(() => {
    navigateLeavingPullEntry(
      navigate,
      INBOUND_LIST_PATH,
      pullEntryTabKey(location.pathname, location.search),
    );
  }, [navigate, location.pathname, location.search]);

  useEffect(() => {
    if (!(Number.isFinite(noticeId) && noticeId > 0)) {
      messageApi.error(t('app.kuaizhizao.receiptNotice.detailFailed'));
      leavePage();
    }
  }, [noticeId, leavePage, messageApi, t]);

  useEffect(() => {
    setCustomPageTitle(pagePath, pageTitle);
    window.dispatchEvent(
      new CustomEvent('riveredge:update-tab-title', {
        detail: { key: pagePath, path: pagePath, title: pageTitle },
      }),
    );
    return () => {
      removeCustomPageTitle(pagePath);
    };
  }, [pageTitle, pagePath]);

  useEffect(() => {
    if (!Number.isFinite(noticeId) || noticeId <= 0 || initRef.current) return;
    initRef.current = true;
    void (async () => {
      setLoading(true);
      try {
        const [noticeRaw, previewRaw] = await Promise.all([
          receiptNoticeApi.get(String(noticeId)) as Promise<ReceiptNotice>,
          receiptNoticeApi.previewNotify(String(noticeId)),
        ]);
        if (noticeRaw.capabilities?.notify?.allowed !== true) {
          const reason = receiptNoticeCapabilityReasonMessage(noticeRaw.capabilities?.notify?.reason, t);
          messageApi.warning(reason || t('app.kuaizhizao.receiptNotice.notifyPreviewBlocked'));
          leavePage();
          return;
        }
        setNotice(noticeRaw);
        setPreview(previewRaw);
      } catch (error: unknown) {
        messageApi.error(getApiErrorMessage(error, t('app.kuaizhizao.receiptNotice.notifyPreviewFailed')));
        leavePage();
      } finally {
        setLoading(false);
      }
    })();
  }, [noticeId, leavePage, messageApi, t]);

  const previewColumns = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.salesOrder.materialCode'),
        dataIndex: 'material_code',
        width: 130,
        ellipsis: true,
      },
      {
        title: t('app.kuaizhizao.salesOrder.materialName'),
        dataIndex: 'material_name',
        width: 160,
        ellipsis: true,
      },
      {
        title: t('common.quantity'),
        dataIndex: 'quantity',
        width: 90,
        align: 'right' as const,
        render: formatQuantity,
      },
      {
        title: t('app.kuaizhizao.purchaseOrder.col.noticeQty'),
        dataIndex: 'notice_quantity',
        width: 90,
        align: 'right' as const,
        render: formatQuantity,
      },
      {
        title: t('app.kuaizhizao.salesOrder.colShippedQty'),
        dataIndex: 'pushed_quantity',
        width: 90,
        align: 'right' as const,
        render: formatQuantity,
      },
      {
        title: t('app.kuaizhizao.salesOrder.colShippableQty'),
        dataIndex: 'max_push_quantity',
        width: 90,
        align: 'right' as const,
        render: formatQuantity,
      },
    ],
    [t],
  );

  const handleConfirm = async () => {
    if (!notice?.id || !preview || preview.has_blocking_issues) return;
    setSubmitting(true);
    try {
      const res = (await receiptNoticeApi.notify(String(notice.id))) as ReceiptNotice;
      const receiptId = res?.purchase_receipt_id;
      if (receiptId == null) {
        messageApi.error(t('app.kuaizhizao.warehouseInbound.entry.purchase.noReceiptId'));
        return;
      }
      invalidateMenuBadgeCounts();
      messageApi.success(
        res?.purchase_receipt_code
          ? t('app.kuaizhizao.receiptNotice.notifySuccessWithDraft', { receiptCode: res.purchase_receipt_code })
          : t('app.kuaizhizao.receiptNotice.notifySuccess'),
      );
      navigateLeavingPullEntry(
        navigate,
        INBOUND_LIST_PATH,
        pullEntryTabKey(location.pathname, location.search),
        {
          inboundDirectConfirm: {
            id: Number(receiptId),
            receipt_type: 'purchase',
          },
        },
      );
    } catch (error: unknown) {
      messageApi.error(getApiErrorMessage(error, t('app.kuaizhizao.shipmentNotice.notifyFailed')));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DocumentFormPageLayout
      title={
        <Space>
          <Button type="text" icon={<ArrowLeftOutlined />} onClick={leavePage} />
          <Typography.Text style={DOCUMENT_DETAIL_PAGE_TITLE_STYLE}>{pageTitle}</Typography.Text>
        </Space>
      }
      extra={
        <Space>
          <Button onClick={leavePage}>{t('common.cancel')}</Button>
          <Button
            type="primary"
            loading={submitting}
            disabled={loading || !preview || !!preview?.has_blocking_issues}
            onClick={() => void handleConfirm()}
          >
            {pullFromReceiptNoticeAction.label}
          </Button>
        </Space>
      }
    >
      {loading ? (
        <div style={{ minHeight: 240, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Spin size="large" />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: PAGE_SPACING }}>
          {notice ? (
            <Card size="small" title={t('app.kuaizhizao.receiptNotice.entityName')}>
              <Descriptions column={3} size="small">
                <Descriptions.Item label={t('app.kuaizhizao.shipmentNotice.noticeCode')}>
                  {notice.notice_code ?? '—'}
                </Descriptions.Item>
                <Descriptions.Item label={t('app.kuaizhizao.receiptNotice.purchaseOrderCode')}>
                  {notice.purchase_order_code ?? '—'}
                </Descriptions.Item>
                <Descriptions.Item label={t('app.kuaizhizao.receiptNotice.supplier')}>
                  {notice.supplier_name ?? '—'}
                </Descriptions.Item>
                <Descriptions.Item label={t('app.kuaizhizao.receiptNotice.inboundWarehouse')}>
                  {notice.warehouse_name ?? '—'}
                </Descriptions.Item>
                <Descriptions.Item label={t('app.kuaizhizao.receiptNotice.plannedReceiptDate')}>
                  {notice.planned_receipt_date ?? '—'}
                </Descriptions.Item>
              </Descriptions>
            </Card>
          ) : null}
          {preview ? (
            <Card size="small" title={pullFromReceiptNoticeAction.label}>
              <p style={{ marginBottom: 12, fontWeight: 500 }}>{preview.summary}</p>
              {preview.has_blocking_issues ? (
                <Alert
                  type="warning"
                  showIcon
                  style={{ marginBottom: 12 }}
                  title={
                    (preview.line_blocking_issues && preview.line_blocking_issues.length > 0
                      ? preview.line_blocking_issues.join('；')
                      : null) ||
                    receiptNoticeCapabilityReasonMessage(preview.blocking_reason, t) ||
                    t('app.kuaizhizao.receiptNotice.notifyPreviewBlocked')
                  }
                />
              ) : null}
              {preview.items?.length > 0 ? (
                <Table
                  size="small"
                  dataSource={preview.items}
                  rowKey={(row) => String(row.item_id)}
                  pagination={false}
                  scroll={{ x: 960 }}
                  columns={previewColumns}
                />
              ) : null}
              {preview.tip ? (
                <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>
                  {preview.tip}
                </Typography.Paragraph>
              ) : null}
            </Card>
          ) : null}
        </div>
      )}
    </DocumentFormPageLayout>
  );
};

export default InboundReceiptNoticePullEntryPage;
