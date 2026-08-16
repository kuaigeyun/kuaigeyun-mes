/**
 * 订单评审 — 部门意见面板（详情协作区 / 评审 Modal 共用）
 */

import React from 'react';
import { Alert, Button, Descriptions, Form, Input, Space } from 'antd';
import { useTranslation } from 'react-i18next';
import { DetailDrawerSection } from '../../../../../components/layout-templates';
import { ThemedSegmented } from '../../../../../components/themed-segmented';
import { formatDateTime } from '../../../../../utils/format';
import type { SalesReview, SalesReviewDeptCode } from '../../../services/sales-review';
import { renderSalesReviewDeptOpinionResultTag } from '../../../utils/salesReviewPresentation';

export const SALES_REVIEW_DEPT_CODES: SalesReviewDeptCode[] = [
  'tech',
  'process',
  'purchase',
  'production',
  'quality',
];

export type DeptOpinionFormState = { result: 'pass' | 'fail'; opinion: string };

export type SalesReviewDeptOpinionsPanelProps = {
  review: SalesReview;
  canApprove: boolean;
  opinionForms: Record<string, DeptOpinionFormState>;
  setOpinionForms: React.Dispatch<React.SetStateAction<Record<string, DeptOpinionFormState>>>;
  actionLoading?: boolean;
  onSubmitDept: (deptCode: string) => void | Promise<void>;
};

export const SalesReviewDeptOpinionsPanel: React.FC<SalesReviewDeptOpinionsPanelProps> = ({
  review,
  canApprove,
  opinionForms,
  setOpinionForms,
  actionLoading = false,
  onSubmitDept,
}) => {
  const { t } = useTranslation();

  const deptLabel = (code: string) =>
    t(`app.kuaizhizao.salesReview.dept.${code}`, { defaultValue: code });

  const opinionByDept = React.useMemo(() => {
    const map = new Map<string, NonNullable<SalesReview['dept_opinions']>[number]>();
    for (const op of review.dept_opinions || []) {
      if (op?.dept_code) map.set(op.dept_code, op);
    }
    return map;
  }, [review.dept_opinions]);

  return (
    <Space orientation="vertical" style={{ width: '100%' }} size="medium">
      {review.status === 'reviewing' && canApprove ? (
        <Alert type="info" showIcon title={t('app.kuaizhizao.salesReview.deptOpinionHint')} />
      ) : null}
      {SALES_REVIEW_DEPT_CODES.map((code) => {
        const existing = opinionByDept.get(code);
        // 下达评审会 seed result=pending 行；仅 pass/fail 才算已提交
        const isAnswered = Boolean(existing && existing.result !== 'pending');
        const formState = opinionForms[code] || { result: 'pass' as const, opinion: '' };
        const canSubmitThis = canApprove && review.status === 'reviewing' && !isAnswered;
        return (
          <DetailDrawerSection key={code} title={deptLabel(code)} titleAccent={false}>
            {isAnswered && existing ? (
              <Descriptions size="small" column={2}>
                <Descriptions.Item label={t('app.kuaizhizao.salesReview.colOpinionResult')}>
                  {renderSalesReviewDeptOpinionResultTag(t, existing.result)}
                </Descriptions.Item>
                <Descriptions.Item label={t('app.kuaizhizao.salesReview.colReviewedBy')}>
                  {existing.reviewed_by_name || '—'}
                </Descriptions.Item>
                <Descriptions.Item label={t('app.kuaizhizao.salesReview.colReviewedAt')}>
                  {existing.reviewed_at ? formatDateTime(existing.reviewed_at) : '—'}
                </Descriptions.Item>
                <Descriptions.Item label={t('app.kuaizhizao.salesReview.colOpinion')} span={2}>
                  {existing.opinion?.trim() ? existing.opinion : '—'}
                </Descriptions.Item>
              </Descriptions>
            ) : canSubmitThis ? (
              <Form layout="vertical" size="small">
                <Form.Item label={t('app.kuaizhizao.salesReview.colOpinionResult')} required>
                  <ThemedSegmented
                    value={formState.result}
                    onChange={(v) =>
                      setOpinionForms((prev) => ({
                        ...prev,
                        [code]: { ...formState, result: v as 'pass' | 'fail' },
                      }))
                    }
                    options={[
                      { label: t('app.kuaizhizao.salesReview.opinionPass'), value: 'pass' },
                      { label: t('app.kuaizhizao.salesReview.opinionFail'), value: 'fail' },
                    ]}
                  />
                </Form.Item>
                <Form.Item
                  label={t('app.kuaizhizao.salesReview.colOpinion')}
                  required={formState.result === 'fail'}
                >
                  <Input.TextArea
                    rows={2}
                    value={formState.opinion}
                    onChange={(e) =>
                      setOpinionForms((prev) => ({
                        ...prev,
                        [code]: { ...formState, opinion: e.target.value },
                      }))
                    }
                  />
                </Form.Item>
                <Button
                  type="primary"
                  loading={actionLoading}
                  onClick={() => void onSubmitDept(code)}
                >
                  {t('app.kuaizhizao.salesReview.submitDeptOpinion')}
                </Button>
              </Form>
            ) : (
              renderSalesReviewDeptOpinionResultTag(t, 'pending')
            )}
          </DetailDrawerSection>
        );
      })}
    </Space>
  );
};

/** 提交前校验：不通过须填意见 */
export function validateDeptOpinionForm(
  formState: DeptOpinionFormState,
  failMessage: string,
): string | null {
  if (formState.result === 'fail' && !String(formState.opinion || '').trim()) {
    return failMessage;
  }
  return null;
}
