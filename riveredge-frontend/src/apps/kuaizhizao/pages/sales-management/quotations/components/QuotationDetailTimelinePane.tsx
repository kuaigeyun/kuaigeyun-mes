/**
 * 报价详情时间线：独立文件 + 列表页 lazy，避免列表首屏静态拉入 document-tracking-panel。
 */

import React from 'react';
import { Spin, Typography } from 'antd';
import {
  DocumentTrackingTimelineBody,
  useDocumentTracking,
} from '../../../../../../components/document-tracking-panel';

export type QuotationDetailTimelinePaneProps = {
  open: boolean;
  quotationId?: number | null;
};

const QuotationDetailTimelinePane: React.FC<QuotationDetailTimelinePaneProps> = ({
  open,
  quotationId,
}) => {
  const tracking = useDocumentTracking(
    open && quotationId != null ? 'quotation' : undefined,
    quotationId ?? undefined,
  );

  if (quotationId == null) return null;

  return (
    <>
      {tracking.loading && (
        <div style={{ textAlign: 'center', padding: 24 }}>
          <Spin />
        </div>
      )}
      {tracking.error && !tracking.loading && (
        <Typography.Text type="danger">{tracking.error}</Typography.Text>
      )}
      {tracking.data && !tracking.loading && (
        <DocumentTrackingTimelineBody data={tracking.data} />
      )}
    </>
  );
};

export default QuotationDetailTimelinePane;
