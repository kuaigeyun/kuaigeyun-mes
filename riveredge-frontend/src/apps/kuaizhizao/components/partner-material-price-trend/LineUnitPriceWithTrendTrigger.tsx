import React, { useState } from 'react';
import { Button, Flex, InputNumber } from 'antd';
import type { InputNumberProps } from 'antd';
import { LineChartOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useResourcePermissions } from '../../../../hooks/useResourcePermissions';
import { PartnerMaterialPriceTrendModal } from './PartnerMaterialPriceTrendModal';
import { PARTNER_MATERIAL_PRICE_TREND_RESOURCE, type PartnerMaterialPriceTrendSide } from './types';

export interface LineUnitPriceWithTrendTriggerProps extends InputNumberProps {
  side: PartnerMaterialPriceTrendSide;
  materialId?: number | null;
  partnerId?: number | null;
}

function toNumber(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

export const LineUnitPriceWithTrendTrigger: React.FC<LineUnitPriceWithTrendTriggerProps> = ({
  side,
  materialId,
  partnerId,
  disabled,
  value,
  ...inputProps
}) => {
  const { t } = useTranslation();
  const [modalOpen, setModalOpen] = useState(false);
  const resource = PARTNER_MATERIAL_PRICE_TREND_RESOURCE[side];
  const { canRead } = useResourcePermissions(resource);

  const materialKey = materialId ?? null;
  const partnerKey = partnerId ?? null;

  const trendDisabled = disabled || !materialKey || !partnerKey;
  const trendTitle = !partnerKey
    ? side === 'sales'
      ? t('app.kuaizhizao.priceTrend.selectCustomerFirst')
      : t('app.kuaizhizao.priceTrend.selectSupplierFirst')
    : !materialKey
      ? t('app.kuaizhizao.priceTrend.selectMaterialFirst')
      : t('app.kuaizhizao.priceTrend.openTrend');

  if (!canRead) {
    return <InputNumber {...inputProps} disabled={disabled} value={value} style={{ width: '100%', ...inputProps.style }} />;
  }

  return (
    <>
      <Flex align="center" gap={4} style={{ width: '100%' }}>
        <InputNumber
          {...inputProps}
          disabled={disabled}
          value={value}
          style={{ flex: 1, minWidth: 0, width: '100%', ...inputProps.style }}
        />
        <Button
          type="text"
          size="small"
          icon={<LineChartOutlined />}
          disabled={trendDisabled}
          title={trendTitle}
          aria-label={trendTitle}
          onClick={() => setModalOpen(true)}
          style={{ flexShrink: 0, paddingInline: 4 }}
        />
      </Flex>
      <PartnerMaterialPriceTrendModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        side={side}
        materialId={materialKey}
        partnerId={partnerKey}
        currentPrice={toNumber(value)}
      />
    </>
  );
};
