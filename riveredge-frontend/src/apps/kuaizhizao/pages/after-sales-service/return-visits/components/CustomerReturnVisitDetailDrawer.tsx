/**
 * 客户回访详情抽屉。
 */

import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ProDescriptionsItemProps } from '@ant-design/pro-components';
import { MarkerTag } from '../../../../../../constants/statusBadges';
import type { CustomerReturnVisit } from '../../../../services/after-sales-service';
import { renderAfterSalesTypeMarker } from '../../shared/afterSalesListPresentation';
import { SourceDocumentCode } from '../../../../../../components/linked-document-code/SourceDocumentCode';
import { AfterSalesDocDetailDrawer } from '../../shared/AfterSalesDocDetailDrawer';

const PLACEHOLDER: CustomerReturnVisit = {
  id: 0,
  visit_code: '',
  customer_id: 0,
  customer_name: '',
  source_type: '',
  source_id: 0,
  source_code: '',
  visited_at: '',
};

export type CustomerReturnVisitDetailDrawerProps = {
  open: boolean;
  onClose: () => void;
  record: CustomerReturnVisit | null;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  extra?: React.ReactNode;
  zIndex?: number;
};

export const CustomerReturnVisitDetailDrawer: React.FC<CustomerReturnVisitDetailDrawerProps> = ({
  open,
  onClose,
  record,
  loading,
  error,
  onRetry,
  extra,
  zIndex,
}) => {
  const { t } = useTranslation();

  const columns = useMemo(
    () =>
      [
        { title: t('app.kuaizhizao.afterSalesService.returnVisit.field.visitCode'), dataIndex: 'visit_code' },
        { title: t('app.kuaizhizao.afterSalesService.returnVisit.field.customerName'), dataIndex: 'customer_name' },
        {
          title: t('app.kuaizhizao.afterSalesService.returnVisit.field.sourceCode'),
          dataIndex: 'source_code',
          render: (_, row) => (
            <SourceDocumentCode
              sourceType={row.source_type}
              sourceId={row.source_id}
              sourceCode={row.source_code}
            />
          ),
        },
        {
          title: t('app.kuaizhizao.afterSalesService.returnVisit.field.visitMethod'),
          dataIndex: 'visit_method',
          render: (_, row) => renderAfterSalesTypeMarker(row.visit_method),
        },
        {
          title: t('app.kuaizhizao.afterSalesService.returnVisit.field.satisfactionScore'),
          dataIndex: 'satisfaction_score',
          render: (_, row) =>
            row.satisfaction_score != null ? (
              <MarkerTag color="success">{row.satisfaction_score}</MarkerTag>
            ) : (
              '-'
            ),
        },
        { title: t('app.kuaizhizao.afterSalesService.returnVisit.field.visitorName'), dataIndex: 'visitor_name' },
        {
          title: t('app.kuaizhizao.afterSalesService.returnVisit.field.visitedAt'),
          dataIndex: 'visited_at',
          valueType: 'dateTime',
        },
        {
          title: t('app.kuaizhizao.afterSalesService.returnVisit.field.feedback'),
          dataIndex: 'feedback',
          span: 3,
        },
        {
          title: t('app.kuaizhizao.afterSalesService.returnVisit.field.notes'),
          dataIndex: 'notes',
          span: 3,
        },
      ] as ProDescriptionsItemProps<CustomerReturnVisit>[],
    [t],
  );

  const code = String(record?.visit_code ?? '').trim();
  const title = `${t('app.kuaizhizao.afterSalesService.returnVisit.detailTitle')}${code ? ` - ${code}` : ''}`;

  return (
    <AfterSalesDocDetailDrawer
      open={open}
      onClose={onClose}
      title={title}
      record={record}
      placeholder={PLACEHOLDER}
      columns={columns}
      loading={loading}
      error={error}
      onRetry={onRetry}
      extra={extra}
      zIndex={zIndex}
      traceDocumentType="customer_return_visit"
    />
  );
};
