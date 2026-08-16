/**
 * 订单评审 — 评审中部门意见 Modal（列表操作列「评审」打开）
 * 上半：单头摘要 + 明细（审什么）；下半：各部门意见（怎么审）
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Button, Descriptions, Empty, Modal, Result, Space, Spin, Table } from 'antd';
import { useTranslation } from 'react-i18next';
import { DetailDrawerSection } from '../../../../../components/layout-templates';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';
import { formatBusinessDateOnly } from '../../../../../utils/format';
import {
  salesReviewApi,
  type SalesReview,
  type SalesReviewItem,
} from '../../../services/sales-review';
import {
  renderSalesReviewRiskMarkerTag,
  renderSalesReviewStatusTag,
  renderSalesReviewUrgencyMarkerTag,
} from '../../../utils/salesReviewPresentation';
import {
  SalesReviewDeptOpinionsPanel,
  validateDeptOpinionForm,
  type DeptOpinionFormState,
} from './DeptOpinionsPanel';

export type SalesReviewReviewModalProps = {
  open: boolean;
  reviewId: number | null;
  canApprove: boolean;
  onClose: () => void;
  onSuccess?: (row: SalesReview) => void;
};

export const SalesReviewReviewModal: React.FC<SalesReviewReviewModalProps> = ({
  open,
  reviewId,
  canApprove,
  onClose,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [review, setReview] = useState<SalesReview | null>(null);
  const [opinionForms, setOpinionForms] = useState<Record<string, DeptOpinionFormState>>({});

  const load = useCallback(
    async (id: number) => {
      setLoading(true);
      setError(null);
      try {
        const row = await salesReviewApi.get(id);
        setReview(row);
        setOpinionForms({});
      } catch (err) {
        setReview(null);
        setError(getApiErrorMessage(err, t('app.kuaizhizao.salesReview.loadFailed')));
      } finally {
        setLoading(false);
      }
    },
    [t],
  );

  useEffect(() => {
    if (!open || reviewId == null) {
      setReview(null);
      setError(null);
      setOpinionForms({});
      return;
    }
    void load(reviewId);
  }, [open, reviewId, load]);

  const submitDept = async (deptCode: string) => {
    if (!review) return;
    const formState = opinionForms[deptCode] || { result: 'pass' as const, opinion: '' };
    const invalid = validateDeptOpinionForm(
      formState,
      t('app.kuaizhizao.salesReview.failOpinionRequired'),
    );
    if (invalid) {
      message.error(invalid);
      return;
    }
    setSubmitting(true);
    try {
      const row = await salesReviewApi.submitDeptOpinion(review.id, deptCode, {
        result: formState.result,
        opinion: formState.opinion || null,
      });
      setReview(row);
      message.success(t('app.kuaizhizao.salesReview.deptOpinionSuccess'));
      setOpinionForms((prev) => {
        const next = { ...prev };
        delete next[deptCode];
        return next;
      });
      onSuccess?.(row);
    } catch (err) {
      message.error(getApiErrorMessage(err, t('common.operationFailed')));
    } finally {
      setSubmitting(false);
    }
  };

  const lineColumns = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.salesReview.colMaterialCode'),
        dataIndex: 'material_code',
        width: 120,
        ellipsis: true,
      },
      {
        title: t('app.kuaizhizao.salesReview.colMaterialName'),
        dataIndex: 'material_name',
        ellipsis: true,
      },
      {
        title: t('app.kuaizhizao.salesReview.colQuantity'),
        dataIndex: 'quantity',
        width: 90,
        align: 'right' as const,
      },
      {
        title: t('app.kuaizhizao.salesReview.colUnitPrice'),
        dataIndex: 'unit_price',
        width: 100,
        align: 'right' as const,
        render: (v: unknown) => {
          const n = Number(v);
          return Number.isFinite(n) ? n.toFixed(2) : '—';
        },
      },
      {
        title: t('app.kuaizhizao.salesReview.colAmount'),
        dataIndex: 'amount',
        width: 100,
        align: 'right' as const,
        render: (v: unknown) => {
          const n = Number(v);
          return Number.isFinite(n) ? n.toFixed(2) : '—';
        },
      },
    ],
    [t],
  );

  const titleCode = review?.review_code ? ` ${review.review_code}` : '';
  const items = (review?.items || []) as SalesReviewItem[];
  const totalAmount = Number(review?.total_amount);

  return (
    <Modal
      title={t('app.kuaizhizao.salesReview.reviewModalTitle', { code: titleCode })}
      open={open}
      onCancel={onClose}
      footer={null}
      width={960}
      destroyOnHidden
      mask={{ closable: true }}
      styles={{ body: { maxHeight: '75vh', overflowY: 'auto' } }}
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <Spin />
        </div>
      ) : error ? (
        <Result
          status="error"
          title={error}
          extra={
            reviewId != null ? (
              <Button type="primary" onClick={() => void load(reviewId)}>
                {t('app.kuaizhizao.salesReview.retry')}
              </Button>
            ) : null
          }
        />
      ) : review ? (
        <Space orientation="vertical" style={{ width: '100%' }} size="medium">
          <DetailDrawerSection title={t('app.kuaizhizao.salesReview.basicInfoTitle')} titleAccent>
            <Descriptions size="small" column={2}>
              <Descriptions.Item label={t('app.kuaizhizao.salesReview.colCustomer')}>
                {review.customer_name || '—'}
              </Descriptions.Item>
              <Descriptions.Item label={t('app.kuaizhizao.salesReview.colProjectName')}>
                {review.project_name || '—'}
              </Descriptions.Item>
              <Descriptions.Item label={t('app.kuaizhizao.salesReview.fieldContact')}>
                {review.customer_contact || '—'}
              </Descriptions.Item>
              <Descriptions.Item label={t('app.kuaizhizao.salesReview.fieldPhone')}>
                {review.customer_phone || '—'}
              </Descriptions.Item>
              <Descriptions.Item label={t('app.kuaizhizao.salesReview.fieldDeliveryDate')}>
                {review.delivery_date ? formatBusinessDateOnly(review.delivery_date) : '—'}
              </Descriptions.Item>
              <Descriptions.Item label={t('app.kuaizhizao.salesReview.colTotalAmount')}>
                {Number.isFinite(totalAmount) ? totalAmount.toFixed(2) : '—'}
              </Descriptions.Item>
              <Descriptions.Item label={t('app.kuaizhizao.salesReview.fieldUrgency')}>
                {renderSalesReviewUrgencyMarkerTag(t, review.urgency)}
              </Descriptions.Item>
              <Descriptions.Item label={t('app.kuaizhizao.salesReview.fieldRiskLevel')}>
                {renderSalesReviewRiskMarkerTag(t, review.risk_level)}
              </Descriptions.Item>
              <Descriptions.Item label={t('app.kuaizhizao.salesReview.colSalesman')}>
                {review.salesman_name || '—'}
              </Descriptions.Item>
              <Descriptions.Item label={t('app.kuaizhizao.salesReview.colStatus')}>
                {renderSalesReviewStatusTag(t, review.status)}
              </Descriptions.Item>
              <Descriptions.Item label={t('app.kuaizhizao.salesReview.fieldSettlement')}>
                {review.settlement_method || '—'}
              </Descriptions.Item>
              <Descriptions.Item label={t('app.kuaizhizao.salesReview.fieldPaymentCycle')}>
                {review.payment_cycle || '—'}
              </Descriptions.Item>
              {review.quotation_code ? (
                <Descriptions.Item label={t('app.kuaizhizao.salesReview.colQuotation')} span={2}>
                  {review.quotation_code}
                </Descriptions.Item>
              ) : null}
              {review.remarks ? (
                <Descriptions.Item label={t('app.kuaizhizao.salesReview.fieldRemarks')} span={2}>
                  {review.remarks}
                </Descriptions.Item>
              ) : null}
            </Descriptions>
          </DetailDrawerSection>

          <DetailDrawerSection title={t('app.kuaizhizao.salesReview.itemsTitle')} titleAccent>
            {items.length ? (
              <Table
                size="small"
                rowKey={(r) => String(r.id ?? `${r.material_code}-${r.line_no}`)}
                pagination={false}
                columns={lineColumns}
                dataSource={items}
                style={{ width: '100%', margin: 0 }}
                scroll={{ x: true }}
              />
            ) : (
              <Empty description={t('app.kuaizhizao.salesReview.itemsEmpty')} />
            )}
          </DetailDrawerSection>

          <SalesReviewDeptOpinionsPanel
            review={review}
            canApprove={canApprove}
            opinionForms={opinionForms}
            setOpinionForms={setOpinionForms}
            actionLoading={submitting}
            onSubmitDept={submitDept}
          />
        </Space>
      ) : null}
    </Modal>
  );
};
