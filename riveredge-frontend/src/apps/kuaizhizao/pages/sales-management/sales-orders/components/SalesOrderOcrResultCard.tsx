/**
 * 销售订单 OCR / 对话录单 · 识别结果预览卡片
 */

import React from 'react';
import { Alert, Button, Descriptions, Space, Tag, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import type { SalesOrderOcrResult } from '../../../../services/sales-order-ocr';
import type { OcrCustomerMatchPreview, OcrMaterialMatchPreview, OcrMasterMatchStatus } from './salesOrderOcrMasters';

type OcrMatchPreview = {
  customer: OcrCustomerMatchPreview;
  items: OcrMaterialMatchPreview[];
};

const { Text } = Typography;
const I18N = 'app.kuaizhizao.salesOrder.aiCreate';

function matchStatusTag(
  t: (key: string) => string,
  status: OcrMasterMatchStatus,
): React.ReactNode {
  if (status === 'empty') return null;
  const config: Record<
    Exclude<OcrMasterMatchStatus, 'empty'>,
    { color: string; labelKey: string }
  > = {
    matched: { color: 'success', labelKey: `${I18N}.matchMatched` },
    will_create: { color: 'processing', labelKey: `${I18N}.matchPendingConfirm` },
    unresolved: { color: 'warning', labelKey: `${I18N}.matchUnresolved` },
  };
  const item = config[status];
  return (
    <Tag color={item.color} style={{ marginInlineStart: 8 }}>
      {t(item.labelKey)}
    </Tag>
  );
}

export interface SalesOrderOcrResultCardProps {
  result: SalesOrderOcrResult;
  matchPreview: OcrMatchPreview | null;
  applying?: boolean;
  onApply: () => void;
}

export function SalesOrderOcrResultCard({
  result,
  matchPreview,
  applying,
  onApply,
}: SalesOrderOcrResultCardProps) {
  const { t } = useTranslation();

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      {result.confidenceNotes ? (
        <Alert
          type="info"
          showIcon
          message={t(`${I18N}.confidenceNotes`)}
          description={result.confidenceNotes}
        />
      ) : null}
      <Descriptions size="small" column={1} bordered>
        {result.customerName ? (
          <Descriptions.Item label={t('app.kuaizhizao.salesOrder.customerName')}>
            <span>
              {result.customerName}
              {matchPreview ? matchStatusTag(t, matchPreview.customer.status) : null}
            </span>
          </Descriptions.Item>
        ) : null}
        {result.orderDate ? (
          <Descriptions.Item label={t('app.kuaizhizao.salesOrder.orderDate')}>
            {result.orderDate}
          </Descriptions.Item>
        ) : null}
        {result.deliveryDate ? (
          <Descriptions.Item label={t('app.kuaizhizao.salesOrder.deliveryDate')}>
            {result.deliveryDate}
          </Descriptions.Item>
        ) : null}
        <Descriptions.Item label={t(`${I18N}.itemCount`)}>
          {result.items?.length ?? 0}
        </Descriptions.Item>
      </Descriptions>
      {(result.items ?? []).length > 0 ? (
        <div className="sales-order-ai-create-items">
          {(result.items ?? []).map((item, index) => {
            const preview = matchPreview?.items[index];
            return (
              <div
                key={`${item.materialCode ?? item.materialName ?? 'row'}-${index}`}
                className="sales-order-ai-create-item"
              >
                <div className="sales-order-ai-create-item-title">
                  <Text strong>{item.materialCode || item.materialName || `#${index + 1}`}</Text>
                  {preview ? matchStatusTag(t, preview.status) : null}
                </div>
                <Text type="secondary">
                  {[item.materialName, item.materialSpec, item.requiredQuantity != null ? `×${item.requiredQuantity}` : null]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </div>
            );
          })}
        </div>
      ) : null}
      <Button type="primary" block onClick={onApply} loading={applying}>
        {t(`${I18N}.applyToForm`)}
      </Button>
    </Space>
  );
}

export default SalesOrderOcrResultCard;
